import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../../middlewares/auth";

const router = Router();

router.get("/consent-logs", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const { userId } = req.query as Record<string, string>;
  let query = `SELECT cl.*, u.first_name, u.last_name, u.email FROM consent_logs cl JOIN users u ON u.id=cl.user_id WHERE cl.tenant_id=$1`;
  const params: any[] = [tenantId];
  if (userId) { query += ` AND cl.user_id=$2`; params.push(userId); }
  query += ` ORDER BY cl.created_at DESC LIMIT 200`;
  const result = await pool.query(query, params);
  res.json(result.rows);
});

router.post("/consent", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const userId = req.auth!.userId;
  const { consentType, granted, ipAddress } = req.body;

  const result = await pool.query(
    `INSERT INTO consent_logs (tenant_id, user_id, consent_type, granted, ip_address) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [tenantId, userId, consentType, granted, ipAddress || null]
  );
  res.status(201).json(result.rows[0]);
});

router.post("/export-data", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const userId = req.auth!.userId;

  const [userRows, prospectsRows, activitiesRows, tasksRows, auditRows] = await Promise.all([
    pool.query(`SELECT id, email, first_name, last_name, role, created_at FROM users WHERE id=$1`, [userId]),
    pool.query(`SELECT * FROM prospects WHERE tenant_id=$1 AND created_by=$2 LIMIT 1000`, [tenantId, userId]),
    pool.query(`SELECT * FROM activities WHERE tenant_id=$1 AND created_by=$2 LIMIT 1000`, [tenantId, userId]),
    pool.query(`SELECT * FROM tasks WHERE tenant_id=$1 AND created_by=$2 LIMIT 500`, [tenantId, userId]),
    pool.query(`SELECT action, entity_type, entity_id, created_at FROM audit_logs WHERE tenant_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 500`, [tenantId, userId]),
  ]);

  const exportData = {
    exported_at: new Date().toISOString(),
    user: userRows.rows[0],
    prospects_created: prospectsRows.rows,
    activities: activitiesRows.rows,
    tasks: tasksRows.rows,
    audit_trail: auditRows.rows,
  };

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="growthos-data-export-${Date.now()}.json"`);
  res.json(exportData);
});

router.post("/delete-data", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const userId = req.auth!.userId;
  const { confirm } = req.body;

  if (confirm !== "DELETE_MY_DATA") {
    return res.status(400).json({ error: "Confirmation requise : envoyez confirm='DELETE_MY_DATA'" });
  }

  await Promise.all([
    pool.query(`DELETE FROM activities WHERE tenant_id=$1 AND created_by=$2`, [tenantId, userId]),
    pool.query(`DELETE FROM tasks WHERE tenant_id=$1 AND created_by=$2`, [tenantId, userId]),
    pool.query(`DELETE FROM audit_logs WHERE tenant_id=$1 AND user_id=$2`, [tenantId, userId]),
    pool.query(`DELETE FROM consent_logs WHERE tenant_id=$1 AND user_id=$2`, [tenantId, userId]),
  ]);

  res.json({ success: true, message: "Données personnelles supprimées (hors prospects partagés)" });
});

router.get("/data-retention", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;

  const [prospects, activities, signals, auditLogs] = await Promise.all([
    pool.query(`SELECT COUNT(*) as count, MIN(created_at) as oldest FROM prospects WHERE tenant_id=$1`, [tenantId]),
    pool.query(`SELECT COUNT(*) as count, MIN(created_at) as oldest FROM activities WHERE tenant_id=$1`, [tenantId]),
    pool.query(`SELECT COUNT(*) as count, MIN(created_at) as oldest FROM signals WHERE tenant_id=$1`, [tenantId]),
    pool.query(`SELECT COUNT(*) as count, MIN(created_at) as oldest FROM audit_logs WHERE tenant_id=$1`, [tenantId]),
  ]);

  res.json({
    prospects: { count: Number(prospects.rows[0].count), oldest: prospects.rows[0].oldest },
    activities: { count: Number(activities.rows[0].count), oldest: activities.rows[0].oldest },
    signals: { count: Number(signals.rows[0].count), oldest: signals.rows[0].oldest },
    audit_logs: { count: Number(auditLogs.rows[0].count), oldest: auditLogs.rows[0].oldest },
  });
});

export default router;
