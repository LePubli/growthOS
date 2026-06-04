import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { signalsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { signalService } from "../../lib/plugin-signal-intelligence/SignalService";
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
});

router.get("/", async (req, res) => {
  const rows = await db.select().from(signalsTable)
    .where(eq(signalsTable.tenantId, req.auth!.tenantId))
    .orderBy(desc(signalsTable.createdAt));
  res.json(rows);
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


// POST /signals/generate — trigger mock signal generation for all accounts
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
