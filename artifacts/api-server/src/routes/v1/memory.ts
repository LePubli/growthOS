import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middlewares/auth";
import { logger } from "../../lib/logger";
import { memoryService } from "../../lib/plugin-growth-memory/MemoryService";

const router = Router();

router.use(requireAuth);

/* ──────────────────────────────────────────
   GET /api/v1/memory/search?q=...&limit=10
   Keyword search (+ recent documents when q is empty)
────────────────────────────────────────── */
router.get("/search", async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 100);
    const tenantId = req.auth!.tenantId;

    const results = await memoryService.search(q, tenantId, limit);
    res.json({ results, total: results.length, query: q });
  } catch (err) {
    logger.error({ err }, "Memory search error");
    res.status(500).json({ error: "Erreur lors de la recherche" });
  }
});

/* ──────────────────────────────────────────
   GET /api/v1/memory/recent?limit=20
────────────────────────────────────────── */
router.get("/recent", async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 100);
    const tenantId = req.auth!.tenantId;
    const results = await memoryService.listRecent(tenantId, limit);
    res.json({ results, total: results.length });
  } catch (err) {
    logger.error({ err }, "Memory recent error");
    res.status(500).json({ error: "Erreur lors de la récupération" });
  }
});

/* ──────────────────────────────────────────
   GET /api/v1/memory/stats
────────────────────────────────────────── */
router.get("/stats", async (req, res) => {
  try {
    const tenantId = req.auth!.tenantId;
    const stats = await memoryService.getStats(tenantId);
    res.json(stats);
  } catch (err) {
    logger.error({ err }, "Memory stats error");
    res.status(500).json({ error: "Erreur lors des statistiques" });
  }
});

/* ──────────────────────────────────────────
   POST /api/v1/memory/index
   Body: { sourceType, sourceId, content, metadata? }
────────────────────────────────────────── */
const indexSchema = z.object({
  sourceType: z.string().min(1).max(64),
  sourceId: z.string().min(1).max(256),
  content: z.string().min(1).max(32_000),
  metadata: z.record(z.unknown()).optional(),
});

router.post("/index", async (req, res) => {
  const parse = indexSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Données invalides", details: parse.error.issues });
    return;
  }

  try {
    const tenantId = req.auth!.tenantId;
    const id = await memoryService.indexDocument({ ...parse.data, tenantId });
    res.status(201).json({ id, ok: true });
  } catch (err) {
    logger.error({ err }, "Memory index error");
    res.status(500).json({ error: "Erreur lors de l'indexation" });
  }
});

/* ──────────────────────────────────────────
   DELETE /api/v1/memory/:id
────────────────────────────────────────── */
router.delete("/:id", async (req, res) => {
  try {
    const tenantId = req.auth!.tenantId;
    const deleted = await memoryService.deleteDocument(req.params.id, tenantId);
    if (!deleted) {
      res.status(404).json({ error: "Document introuvable" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Memory delete error");
    res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

export default router;
