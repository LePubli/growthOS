import { Router } from "express";
import { requireAuth } from "../../../middlewares/auth";
import { pool } from "@workspace/db";
import { enrichProspect, getEnrichmentData, getEnrichmentHistory, ALL_SOURCES, IMPLEMENTED_SOURCES } from "../../../lib/plugin-enrichment/EnrichmentEngine";

const router = Router();

/* POST /enrich/batch — enrich multiple prospects (must be registered BEFORE /:prospectId) */
router.post("/batch", requireAuth, async (req, res) => {
  // No durable queue/worker exists: a detached promise would be lost on redeploy.
  res.status(501).json({ error: "Enrichissement par lot indisponible sans moteur de tâches persistant. Utilisez la fiche d'un prospect." });
});

/* POST /enrich/:prospectId — enrich a single prospect */
router.post("/:prospectId", requireAuth, async (req, res) => {
  const prospectId = String(req.params.prospectId);
  const tenantId = req.auth!.tenantId;
  try {
    const result = await enrichProspect(prospectId, tenantId);
    res.json(result);
  } catch (err: any) {
    res.status(err?.message === "Prospect not found" ? 404 : 500).json({ error: err.message ?? "Enrichment failed" });
  }
});


/* GET /enrich/data/:prospectId — get enriched data */
router.get("/data/:prospectId", requireAuth, async (req, res) => {
  const prospectId = String(req.params.prospectId);
  const data = await getEnrichmentData(prospectId, req.auth!.tenantId);
  res.json(data);
});

/* GET /enrich/history/:prospectId — get enrichment history */
router.get("/history/:prospectId", requireAuth, async (req, res) => {
  const prospectId = String(req.params.prospectId);
  const history = await getEnrichmentHistory(prospectId, req.auth!.tenantId);
  res.json(history);
});

/* GET /enrich/sources — list all sources with their config */
router.get("/sources", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT provider FROM provider_api_keys WHERE tenant_id = $1 AND is_active = true`,
    [req.auth!.tenantId]
  );
  const configured = new Set(rows.map((r: any) => r.provider));
  const sources = ALL_SOURCES.map(s => ({
    ...s,
    implemented: IMPLEMENTED_SOURCES.has(s.id),
    isActive: IMPLEMENTED_SOURCES.has(s.id) && (s.id === "google_news" || configured.has(s.id)),
    hasKey: configured.has(s.id),
    lastTestedAt: null,
    testStatus: "non_testé",
  }));
  res.json(sources);
});

/* PUT /enrich/api-config/:sourceId — configure an API source */
router.put("/api-config/:sourceId", requireAuth, async (req, res) => {
  res.status(410).json({ error: "Ancienne configuration globale désactivée pour la sécurité. Utilisez Clés API Providers : clés chiffrées et isolées par compte." });
});

/* POST /enrich/test-connection/:sourceId */
router.post("/test-connection/:sourceId", requireAuth, async (req, res) => {
  const { sourceId } = req.params;
  const source = ALL_SOURCES.find(s => s.id === sourceId);
  if (!source) { res.status(404).json({ error: "Source inconnue" }); return; }
  res.status(501).json({ ok: false, error: "Test de connexion non implémenté pour cette source. Aucune réussite simulée." });
});

export default router;
