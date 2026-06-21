import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { signalsTable, prospectsTable } from "@workspace/db";
import { eq, and, desc, gte, isNull } from "drizzle-orm";
import { signalService } from "../../lib/plugin-signal-intelligence/SignalService";
import { signalGeneratorService } from "../../lib/signals/SignalGeneratorService";
import { providerKeysService } from "../../lib/provider-keys/ProviderKeysService";
import { createNotification } from "../../services/notification.service";
import { actionLogger } from "../../lib/ActionLogger";

const router = Router();
router.use(actionLogger);

const signalSchema = z.object({
  type: z.enum(["funding", "hiring", "news", "technology", "intent"]),
  company: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  score: z.number().int().min(0).max(100).optional().default(50),
  isRead: z.boolean().optional(),
  isStarred: z.boolean().optional(),
  source: z.string().optional().default("manual"),
  prospectId: z.string().uuid().optional(),
});

router.get("/", async (req, res) => {
  const rows = await db.select().from(signalsTable)
    .where(eq(signalsTable.tenantId, req.auth!.tenantId))
    .orderBy(desc(signalsTable.createdAt));
  res.json(rows);
});

router.get("/:id", async (req, res) => {
  const [row] = await db.select().from(signalsTable)
    .where(and(eq(signalsTable.id, req.params.id), eq(signalsTable.tenantId, req.auth!.tenantId)));
  if (!row) { res.status(404).json({ error: "Signal introuvable" }); return; }
  res.json(row);
});

router.post("/", async (req, res) => {
  const parse = signalSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Données invalides", details: parse.error.issues });
    return;
  }
  const [signal] = await db.insert(signalsTable).values({
    ...parse.data,
    tenantId: req.auth!.tenantId,
  }).returning();

  if ((signal.score ?? 0) >= 75) {
    createNotification({
      type: "signal",
      title: "Signal chaud détecté ⚡",
      body: `${signal.company} — ${signal.title}`,
      href: `/signals`,
      tenantId: req.auth!.tenantId,
    }).catch(() => {/* fire and forget */});
  }

  res.status(201).json(signal);
});

router.post("/:id/read", async (req, res) => {
  const [updated] = await db.update(signalsTable)
    .set({ isRead: true })
    .where(and(eq(signalsTable.id, req.params.id), eq(signalsTable.tenantId, req.auth!.tenantId)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Signal introuvable" }); return; }
  res.json(updated);
});

router.patch("/:id", async (req, res) => {
  const parse = signalSchema.partial().safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: "Données invalides" }); return; }
  const [updated] = await db.update(signalsTable)
    .set(parse.data)
    .where(and(eq(signalsTable.id, req.params.id), eq(signalsTable.tenantId, req.auth!.tenantId)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Signal introuvable" }); return; }
  res.json(updated);
});


// POST /signals/generate — génération mock (compatibilité ascendante)
router.post("/generate", async (req, res) => {
  try {
    const tenantId = req.auth!.tenantId;
    const signals = await signalService.generateForAllAccounts(tenantId);
    res.status(201).json({ generated: signals.length, signals });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /signals/generate-real — génération depuis sources réelles (RSS, SerpAPI, Crunchbase)
const generateRealSchema = z.object({
  sourceType: z.enum(["rss", "serpapi", "crunchbase", "mock"]).default("rss"),
  keywords: z.array(z.string()).optional().default([]),
  companies: z.array(z.string()).optional().default([]),
  maxResults: z.number().int().min(1).max(50).optional().default(15),
  apiKey: z.string().optional(),
  targetType: z.enum(["prospect", "account", "custom"]).optional(),
  targetId: z.string().uuid().optional(),
  targetName: z.string().optional(),
});

router.post("/generate-real", async (req, res) => {
  try {
    const tenantId = req.auth!.tenantId;
    const parse = generateRealSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Données invalides", details: parse.error.issues });
      return;
    }

    const config = parse.data;
    const { targetType, targetId, targetName } = config;

    // Si ciblage prospect, récupérer l'entreprise du prospect et l'ajouter aux sociétés
    let resolvedCompany: string | null = null;
    if (targetType === "prospect" && targetId) {
      const [prospect] = await db.select().from(prospectsTable)
        .where(and(eq(prospectsTable.id, targetId), eq(prospectsTable.tenantId, tenantId)))
        .limit(1);
      if (prospect?.company) {
        resolvedCompany = prospect.company;
        if (!config.companies.includes(prospect.company)) {
          config.companies = [...config.companies, prospect.company];
        }
      }
    } else if (targetType === "account" && targetName) {
      resolvedCompany = targetName;
      if (!config.companies.includes(targetName)) {
        config.companies = [...config.companies, targetName];
      }
    } else if (targetType === "custom" && targetName) {
      resolvedCompany = targetName;
    }

    // Si sourceType nécessite une clé API et qu'elle n'est pas dans le body,
    // essayer de la récupérer depuis la DB du tenant
    let apiKey = config.apiKey;
    if (!apiKey && (config.sourceType === "serpapi" || config.sourceType === "crunchbase")) {
      const dbKey = await providerKeysService.getKey(tenantId, config.sourceType).catch(() => null);
      apiKey = dbKey?.apiKey;
    }

    // Si mock demandé ou pas de clé pour source payante → forcer RSS
    const effectiveSource = config.sourceType === "mock" ? "rss" : (
      (config.sourceType !== "rss" && !apiKey) ? "rss" : config.sourceType
    );

    const generatedAt = new Date();

    const result = await signalGeneratorService.generate(tenantId, {
      ...config,
      sourceType: effectiveSource as any,
      apiKey,
    });

    // Lier les signaux générés à la cible (prospect/account/source)
    if (result.inserted > 0) {
      try {
        const updateData: any = { source: effectiveSource };
        if (targetType === "prospect" && targetId) {
          updateData.prospectId = targetId;
        }
        // Mettre à jour les signaux fraîchement insérés (créés depuis generatedAt)
        await db.update(signalsTable)
          .set(updateData)
          .where(
            and(
              eq(signalsTable.tenantId, tenantId),
              gte(signalsTable.createdAt, generatedAt),
              isNull(signalsTable.source)
            )
          );
      } catch (e) {
        // Non-bloquant
        console.warn("Échec du lien prospect→signal:", e);
      }
    }

    // Notifier si des signaux hot ont été générés
    const hotCount = result.signals.filter(s => s.score >= 85).length;
    if (hotCount > 0) {
      createNotification({
        type: "signal",
        title: `${hotCount} signal${hotCount > 1 ? "s" : ""} chaud${hotCount > 1 ? "s" : ""} détecté${hotCount > 1 ? "s" : ""} ⚡`,
        body: `Recherche depuis ${result.source}${resolvedCompany ? ` — ${resolvedCompany}` : ""} — ${result.inserted} nouveau${result.inserted > 1 ? "x" : ""} signal${result.inserted > 1 ? "s" : ""}`,
        href: "/signals",
        tenantId,
      }).catch(() => {});
    }

    res.json({
      inserted: result.inserted,
      total: result.signals.length,
      source: result.source,
      signals: result.signals,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur lors de la génération des signaux" });
  }
});

// GET /signals/account/:company — signals for a specific account
router.get("/account/:company", async (req, res) => {
  try {
    const tenantId = req.auth!.tenantId;
    const company = decodeURIComponent(req.params.company);
    const signals = await signalService.getSignalsByAccount(company, tenantId);
    res.json(signals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /signals/:id/status — update signal status
router.patch("/:id/status", async (req, res) => {
  try {
    const tenantId = req.auth!.tenantId;
    const { status } = req.body;
    if (!["new", "read", "actioned"].includes(status)) {
      res.status(400).json({ error: "Invalid status. Must be one of: new, read, actioned" });
      return;
    }
    const signal = await signalService.updateStatus(req.params.id, tenantId, status);
    if (!signal) { res.status(404).json({ error: "Signal introuvable" }); return; }
    res.json(signal);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
