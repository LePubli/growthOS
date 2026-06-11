/**
 * Admin — Journal d'audit des accès RBAC
 * Routes: GET /admin/audit-logs, GET /admin/audit-logs/csv, GET /admin/audit-logs/stats
 */

import { Router } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { pool } from "@workspace/db";
import { logger } from "../../lib/logger";

const router = Router();

router.use(requireAuth);
router.use(requireRole("admin"));

// ── GET /admin/audit-logs — Journal filtrable ─────────────────────────────────
router.get("/audit-logs", async (req, res) => {
  try {
    const {
      page = "1",
      limit = "50",
      userId,
      action,
      entityType,
      from,
      to,
      search,
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (userId) { conditions.push(`al.user_id = $${idx++}`); params.push(userId); }
    if (action) { conditions.push(`al.action = $${idx++}`); params.push(action); }
    if (entityType) { conditions.push(`al.entity_type = $${idx++}`); params.push(entityType); }
    if (from) { conditions.push(`al.created_at >= $${idx++}`); params.push(from); }
    if (to) { conditions.push(`al.created_at <= $${idx++}`); params.push(to); }
    if (search) {
      conditions.push(`(al.action ILIKE $${idx} OR al.entity_type ILIKE $${idx} OR u.email ILIKE $${idx} OR u.name ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [rows, countRow] = await Promise.all([
      pool.query(
        `SELECT al.id, al.action, al.entity_type, al.entity_id, al.old_value, al.new_value,
                al.metadata, al.ip_address, al.created_at,
                al.user_id, u.email as user_email, u.name as user_name,
                al.tenant_id, t.name as tenant_name
         FROM audit_logs al
         LEFT JOIN users u ON u.id = al.user_id
         LEFT JOIN tenants t ON t.id = al.tenant_id
         ${where}
         ORDER BY al.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limitNum, offset],
      ),
      pool.query(`SELECT COUNT(*) FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id ${where}`, params),
    ]);

    const total = parseInt(countRow.rows[0].count, 10);
    res.json({
      logs: rows.rows.map(r => ({
        id: r.id,
        action: r.action,
        entityType: r.entity_type,
        entityId: r.entity_id,
        oldValue: r.old_value,
        newValue: r.new_value,
        metadata: r.metadata,
        ipAddress: r.ip_address,
        createdAt: r.created_at,
        user: r.user_id ? { id: r.user_id, email: r.user_email, name: r.user_name } : null,
        tenantName: r.tenant_name,
      })),
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    logger.error({ err }, "admin/audit-logs GET error");
    res.status(500).json({ error: "Erreur interne" });
  }
});

// ── GET /admin/audit-logs/stats — Statistiques ───────────────────────────────
router.get("/audit-logs/stats", async (_req, res) => {
  try {
    const [byAction, byEntity, byUser, recent] = await Promise.all([
      pool.query(
        `SELECT action, COUNT(*) as count
         FROM audit_logs
         WHERE created_at > NOW() - INTERVAL '30 days'
         GROUP BY action ORDER BY count DESC LIMIT 15`,
      ),
      pool.query(
        `SELECT entity_type, COUNT(*) as count
         FROM audit_logs
         WHERE created_at > NOW() - INTERVAL '30 days'
         GROUP BY entity_type ORDER BY count DESC LIMIT 10`,
      ),
      pool.query(
        `SELECT u.email, u.name, COUNT(al.*) as count
         FROM audit_logs al
         JOIN users u ON u.id = al.user_id
         WHERE al.created_at > NOW() - INTERVAL '30 days'
         GROUP BY u.email, u.name ORDER BY count DESC LIMIT 10`,
      ),
      pool.query(
        `SELECT date_trunc('day', created_at) as day, COUNT(*) as count
         FROM audit_logs
         WHERE created_at > NOW() - INTERVAL '30 days'
         GROUP BY day ORDER BY day DESC`,
      ),
    ]);

    const total30d = byAction.rows.reduce((s, r) => s + parseInt(r.count, 10), 0);

    res.json({
      total30d,
      byAction: byAction.rows.map(r => ({ action: r.action, count: Number(r.count) })),
      byEntity: byEntity.rows.map(r => ({ entityType: r.entity_type, count: Number(r.count) })),
      byUser: byUser.rows.map(r => ({ email: r.email, name: r.name, count: Number(r.count) })),
      daily: recent.rows.map(r => ({ day: r.day, count: Number(r.count) }),),
    });
  } catch (err) {
    res.status(500).json({ error: "Erreur interne" });
  }
});

// ── GET /admin/audit-logs/csv — Export CSV ───────────────────────────────────
router.get("/audit-logs/csv", async (req, res) => {
  try {
    const { from, to, userId, action, entityType } = req.query as Record<string, string>;
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (userId) { conditions.push(`al.user_id = $${idx++}`); params.push(userId); }
    if (action) { conditions.push(`al.action = $${idx++}`); params.push(action); }
    if (entityType) { conditions.push(`al.entity_type = $${idx++}`); params.push(entityType); }
    if (from) { conditions.push(`al.created_at >= $${idx++}`); params.push(from); }
    if (to) { conditions.push(`al.created_at <= $${idx++}`); params.push(to); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT al.created_at, u.email as user_email, u.name as user_name,
              al.action, al.entity_type, al.entity_id, al.ip_address,
              al.metadata, t.name as tenant_name
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       LEFT JOIN tenants t ON t.id = al.tenant_id
       ${where}
       ORDER BY al.created_at DESC LIMIT 10000`,
      params,
    );

    const header = "Date,Utilisateur,Email,Action,Entité,ID Entité,Tenant,IP,Métadonnées";
    const csvRows = rows.map(r => {
      const date = new Date(r.created_at).toISOString();
      const meta = r.metadata ? JSON.stringify(r.metadata).replace(/"/g, '""') : "";
      return [date, r.user_name ?? "", r.user_email ?? "", r.action, r.entity_type, r.entity_id ?? "", r.tenant_name ?? "", r.ip_address ?? "", `"${meta}"`].join(",");
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="audit-logs-${Date.now()}.csv"`);
    res.send("\uFEFF" + [header, ...csvRows].join("\n"));
  } catch (err) {
    res.status(500).json({ error: "Erreur interne" });
  }
});

// ── GET /admin/audit-logs/actions — Liste des actions distinctes ──────────────
router.get("/audit-logs/actions", async (_req, res) => {
  const { rows } = await pool.query(`SELECT DISTINCT action FROM audit_logs ORDER BY action`);
  res.json(rows.map(r => r.action));
});

export default router;
