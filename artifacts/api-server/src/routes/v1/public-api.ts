import { Router } from "express";
import { apiKeyAuth, requireScope } from "../../middlewares/apiKeyAuth";
import { db, prospectsTable, dealsTable, signalsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

/**
 * API publique — accessible via clé API (Authorization: Bearer gos_...)
 * Toutes les routes filtrent par tenant_id issu de la clé.
 */
const router = Router();

router.use(apiKeyAuth);

/* ── Prospects ── */
router.get("/prospects", requireScope("read"), async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const limit = Math.min(Number(req.query.limit ?? 50), 500);
  const offset = Number(req.query.offset ?? 0);

  const rows = await db
    .select()
    .from(prospectsTable)
    .where(eq(prospectsTable.tenantId, tenantId))
    .orderBy(desc(prospectsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({ data: rows, limit, offset });
});

router.get("/prospects/:id", requireScope("read"), async (req, res) => {
  const [row] = await db
    .select()
    .from(prospectsTable)
    .where(eq(prospectsTable.id, String(req.params.id)))
    .limit(1);
  if (!row || row.tenantId !== req.auth!.tenantId) {
    res.status(404).json({ error: "Prospect introuvable" });
    return;
  }
  res.json(row);
});

/* ── Deals ── */
router.get("/deals", requireScope("read"), async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const limit = Math.min(Number(req.query.limit ?? 50), 500);
  const offset = Number(req.query.offset ?? 0);

  const rows = await db
    .select()
    .from(dealsTable)
    .where(eq(dealsTable.tenantId, tenantId))
    .orderBy(desc(dealsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({ data: rows, limit, offset });
});

router.get("/deals/:id", requireScope("read"), async (req, res) => {
  const [row] = await db
    .select()
    .from(dealsTable)
    .where(eq(dealsTable.id, String(req.params.id)))
    .limit(1);
  if (!row || row.tenantId !== req.auth!.tenantId) {
    res.status(404).json({ error: "Deal introuvable" });
    return;
  }
  res.json(row);
});

/* ── Signals ── */
router.get("/signals", requireScope("read"), async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);

  const rows = await db
    .select()
    .from(signalsTable)
    .where(eq(signalsTable.tenantId, tenantId))
    .orderBy(desc(signalsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({ data: rows, limit, offset });
});

export default router;
