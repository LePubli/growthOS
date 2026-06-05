import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../../middlewares/auth";

const router = Router();

router.get("/audit-logs", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const { entityType, entityId, userId, limit = "50", offset = "0" } = req.query as Record<string, string>;

  let query = `
    SELECT al.*, u.first_name, u.last_name, u.email as user_email
    FROM audit_logs al
    LEFT JOIN users u ON u.id = al.user_id
    WHERE al.tenant_id = $1
  `;
  const params: any[] = [tenantId];
  let p = 2;

  if (entityType) { query += ` AND al.entity_type = $${p++}`; params.push(entityType); }
  if (entityId)   { query += ` AND al.entity_id = $${p++}`;   params.push(entityId); }
  if (userId)     { query += ` AND al.user_id = $${p++}`;     params.push(userId); }

  query += ` ORDER BY al.created_at DESC LIMIT $${p++} OFFSET $${p++}`;
  params.push(Number(limit), Number(offset));

  const result = await pool.query(query, params);
  res.json({ logs: result.rows, total: result.rows.length });
});

router.post("/audit-logs", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const userId = req.auth!.userId;
  const { action, entityType, entityId, oldValue, newValue, metadata } = req.body;

  const result = await pool.query(
    `INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, old_value, new_value, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [tenantId, userId, action, entityType, entityId || null, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null, metadata ? JSON.stringify(metadata) : null]
  );
  res.status(201).json(result.rows[0]);
});

router.get("/audit-logs/stats", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const { days = "30" } = req.query as Record<string, string>;

  const [byAction, byEntity, byUser, recent] = await Promise.all([
    pool.query(`SELECT action, COUNT(*) as count FROM audit_logs WHERE tenant_id=$1 AND created_at > NOW() - INTERVAL '${Number(days)} days' GROUP BY action ORDER BY count DESC`, [tenantId]),
    pool.query(`SELECT entity_type, COUNT(*) as count FROM audit_logs WHERE tenant_id=$1 AND created_at > NOW() - INTERVAL '${Number(days)} days' GROUP BY entity_type ORDER BY count DESC`, [tenantId]),
    pool.query(`SELECT u.first_name, u.last_name, u.email, COUNT(*) as count FROM audit_logs al JOIN users u ON u.id=al.user_id WHERE al.tenant_id=$1 AND al.created_at > NOW() - INTERVAL '${Number(days)} days' GROUP BY u.id, u.first_name, u.last_name, u.email ORDER BY count DESC LIMIT 10`, [tenantId]),
    pool.query(`SELECT COUNT(*) as total FROM audit_logs WHERE tenant_id=$1 AND created_at > NOW() - INTERVAL '${Number(days)} days'`, [tenantId]),
  ]);

  res.json({
    total: Number(recent.rows[0]?.total ?? 0),
    byAction: byAction.rows,
    byEntity: byEntity.rows,
    byUser: byUser.rows,
  });
});

router.delete("/audit-logs", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const { olderThanDays = "90" } = req.query as Record<string, string>;

  const result = await pool.query(
    `DELETE FROM audit_logs WHERE tenant_id=$1 AND created_at < NOW() - INTERVAL '${Number(olderThanDays)} days'`,
    [tenantId]
  );
  res.json({ deleted: result.rowCount });
});

export default router;
