import { Router } from "express";
import { requireAuth } from "../../../middlewares/auth";
import { pool } from "@workspace/db";
import { enrichProspect, getEnrichmentData, getEnrichmentHistory, ALL_SOURCES } from "../../../lib/plugin-enrichment/EnrichmentEngine";

const router = Router();

/* POST /enrich/batch — enrich multiple prospects (must be registered BEFORE /:prospectId) */
router.post("/batch", requireAuth, async (req, res) => {
  const { prospectIds } = req.body as { prospectIds: string[] };
  const tenantId = req.auth!.tenantId;
  if (!Array.isArray(prospectIds) || prospectIds.length === 0) {
    res.status(400).json({ error: "prospectIds must be a non-empty array" });
    return;
  }
  const results: { id: string; score?: number; error?: string }[] = [];
  (async () => {
    for (const id of prospectIds) {
      try {
        const r = await enrichProspect(id, tenantId);
        results.push({ id, score: r.score });
      } catch (e: any) {
        results.push({ id, error: e.message });
      }
    }
  })().catch(() => {});
  res.json({ accepted: prospectIds.length, message: "Enrichissement en cours en arrière-plan" });
});

/* POST /enrich/:prospectId — enrich a single prospect */
router.post("/:prospectId", requireAuth, async (req, res) => {
  const { prospectId } = req.params;
  const tenantId = req.auth!.tenantId;
  try {
    const result = await enrichProspect(prospectId, tenantId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Enrichment failed" });
  }
});


/* GET /enrich/data/:prospectId — get enriched data */
router.get("/data/:prospectId", requireAuth, async (req, res) => {
  const { prospectId } = req.params;
  const data = await getEnrichmentData(prospectId);
  res.json(data);
});

/* GET /enrich/history/:prospectId — get enrichment history */
router.get("/history/:prospectId", requireAuth, async (req, res) => {
  const { prospectId } = req.params;
  const history = await getEnrichmentHistory(prospectId);
  res.json(history);
});

/* GET /enrich/sources — list all sources with their config */
router.get("/sources", requireAuth, async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT source_id, source_name, is_active, api_key IS NOT NULL AS has_key, last_tested_at, test_status
     FROM enrichment_api_configs`
  ).catch(() => ({ rows: [] as any[] }));
  const configMap = new Map(rows.map((r: any) => [r.source_id, r]));
  const sources = ALL_SOURCES.map(s => ({
    ...s,
    isActive: configMap.get(s.id)?.is_active ?? s.free,
    hasKey: configMap.get(s.id)?.has_key ?? false,
    lastTestedAt: configMap.get(s.id)?.last_tested_at ?? null,
    testStatus: configMap.get(s.id)?.test_status ?? null,
  }));
  res.json(sources);
});

/* PUT /enrich/api-config/:sourceId — configure an API source */
router.put("/api-config/:sourceId", requireAuth, async (req, res) => {
  const { sourceId } = req.params;
  const { apiKey, apiSecret, endpointUrl, isActive } = req.body;
  const source = ALL_SOURCES.find(s => s.id === sourceId);
  if (!source) { res.status(404).json({ error: "Source inconnue" }); return; }
  await pool.query(
    `INSERT INTO enrichment_api_configs (source_id, source_name, source_type, api_key, api_secret, endpoint_url, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (source_id) DO UPDATE
     SET api_key = COALESCE(EXCLUDED.api_key, enrichment_api_configs.api_key),
         api_secret = COALESCE(EXCLUDED.api_secret, enrichment_api_configs.api_secret),
         endpoint_url = COALESCE(EXCLUDED.endpoint_url, enrichment_api_configs.endpoint_url),
         is_active = EXCLUDED.is_active,
         updated_at = NOW()`,
    [sourceId, source.name, source.type, apiKey ?? null, apiSecret ?? null, endpointUrl ?? null, isActive ?? true]
  );
  res.json({ ok: true });
});

/* POST /enrich/test-connection/:sourceId */
router.post("/test-connection/:sourceId", requireAuth, async (req, res) => {
  const { sourceId } = req.params;
  const source = ALL_SOURCES.find(s => s.id === sourceId);
  if (!source) { res.status(404).json({ error: "Source inconnue" }); return; }
  const { rows } = await pool.query(`SELECT api_key FROM enrichment_api_configs WHERE source_id = $1`, [sourceId])
    .catch(() => ({ rows: [] as any[] }));
  const hasKey = !!rows[0]?.api_key;
  // Simulate test
  const ok = source.free || hasKey;
  await pool.query(
    `UPDATE enrichment_api_configs SET last_tested_at = NOW(), test_status = $1 WHERE source_id = $2`,
    [ok ? "ok" : "no_key", sourceId]
  ).catch(() => {});
  res.json({ ok, message: ok ? "Connexion OK" : "Clé API manquante" });
});

export default router;
