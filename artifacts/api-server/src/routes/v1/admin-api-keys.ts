/**
 * Admin — Gestion des clés API providers IA
 * Routes: /admin/api-keys/*
 */

import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { providerKeysService, PROVIDERS } from "../../lib/provider-keys/ProviderKeysService";
import { logger } from "../../lib/logger";

const router = Router();

router.use(requireAuth);
router.use(requireRole("admin"));

// ── GET /admin/api-keys — Liste les clés du tenant (masquées) ─────────────────
router.get("/api-keys", async (req, res) => {
  try {
    const tenantId = req.auth!.tenantId;
    const keys = await providerKeysService.getKeys(tenantId);
    // Inclure la liste des providers supportés même si pas de clé configurée
    const keysMap = new Map(keys.map(k => [k.provider, k]));
    const providers = PROVIDERS.map(p => ({
      ...p,
      configured: keysMap.has(p.id),
      key: keysMap.get(p.id) ?? null,
    }));
    res.json({ providers, keys });
  } catch (err) {
    logger.error({ err }, "admin/api-keys GET error");
    res.status(500).json({ error: "Erreur interne" });
  }
});

// ── POST /admin/api-keys — Ajouter/mettre à jour une clé ─────────────────────
const upsertSchema = z.object({
  provider: z.string().min(2),
  apiKey: z.string().min(1, "Clé API requise"),
  apiSecret: z.string().optional(),
  endpointUrl: z.string().url("URL invalide").optional().or(z.literal("")),
});

router.post("/api-keys", async (req, res) => {
  const parse = upsertSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Données invalides", details: parse.error.issues });
    return;
  }
  const { provider, apiKey, apiSecret, endpointUrl } = parse.data;
  try {
    const key = await providerKeysService.upsertKey(
      req.auth!.tenantId, provider, apiKey, apiSecret, endpointUrl || undefined,
    );
    res.status(201).json(key);
  } catch (err: any) {
    logger.error({ err }, "admin/api-keys POST error");
    res.status(500).json({ error: err.message ?? "Erreur interne" });
  }
});

// ── DELETE /admin/api-keys/:provider — Supprimer une clé ─────────────────────
router.delete("/api-keys/:provider", async (req, res) => {
  try {
    await providerKeysService.deleteKey(req.auth!.tenantId, req.params.provider);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(err.message?.includes("introuvable") ? 404 : 500).json({ error: err.message });
  }
});

// ── POST /admin/api-keys/:provider/test — Tester une clé ─────────────────────
router.post("/api-keys/:provider/test", async (req, res) => {
  const { apiKey, endpointUrl } = req.body as { apiKey?: string; endpointUrl?: string };
  const provider = req.params.provider;

  // Si pas de clé dans le body, récupérer depuis DB
  let keyToTest = apiKey;
  if (!keyToTest) {
    const dbKey = await providerKeysService.getKey(req.auth!.tenantId, provider);
    if (!dbKey) {
      res.status(400).json({ ok: false, message: "Aucune clé configurée pour ce provider" });
      return;
    }
    keyToTest = dbKey.apiKey;
  }

  try {
    const result = await providerKeysService.testKey(provider, keyToTest, endpointUrl);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err.message ?? "Erreur lors du test" });
  }
});

// ── GET /admin/api-keys/providers — Liste des providers supportés ─────────────
router.get("/api-keys/providers", async (_req, res) => {
  res.json(PROVIDERS);
});

export default router;
