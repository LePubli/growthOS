import { Request, Response, NextFunction } from "express";
import { pool } from "@workspace/db";

export const PLAN_LIMITS: Record<string, Record<string, number>> = {
  starter:    { prospects: 500,   sequences: 3,  users: 2,   emails: 1000  },
  pro:        { prospects: 5000,  sequences: -1, users: 10,  emails: 50000 },
  enterprise: { prospects: -1,    sequences: -1, users: -1,  emails: -1    },
};

export async function checkUsage(tenantId: string, resource: string): Promise<boolean> {
  const row = await _getOrInitUsage(tenantId, resource);
  if (row.limit_value === -1) return true;
  return row.current_usage < row.limit_value;
}

export async function incrementUsage(tenantId: string, resource: string): Promise<void> {
  await pool.query(
    `UPDATE usage_limits
     SET current_usage = current_usage + 1, updated_at = NOW()
     WHERE tenant_id = $1 AND resource = $2
       AND period_start = date_trunc('month', NOW())`,
    [tenantId, resource],
  );
}

export async function getUsage(
  tenantId: string,
): Promise<Record<string, { used: number; limit: number; percent: number }>> {
  const result = await pool.query(
    `SELECT resource, current_usage, limit_value
     FROM usage_limits
     WHERE tenant_id = $1 AND period_start = date_trunc('month', NOW())`,
    [tenantId],
  );
  const out: Record<string, { used: number; limit: number; percent: number }> = {};
  for (const row of result.rows) {
    const pct =
      row.limit_value === -1
        ? 0
        : Math.min(100, Math.round((row.current_usage / row.limit_value) * 100));
    out[row.resource] = { used: Number(row.current_usage), limit: Number(row.limit_value), percent: pct };
  }
  return out;
}

/** Middleware factory — à placer après requireAuth sur les routes coûteuses */
export function requireUsage(resource: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) { next(); return; }
    try {
      const allowed = await checkUsage(tenantId, resource);
      if (!allowed) {
        res.status(402).json({
          error: "Quota dépassé",
          message: `Limite ${resource} atteinte pour ce mois. Mettez à jour votre plan.`,
          resource,
          upgrade_url: "/settings/billing",
        });
        return;
      }
      next();
    } catch {
      next();
    }
  };
}

async function _getLimitFromPlan(tenantId: string, resource: string): Promise<number> {
  // 1. Essayer via subscriptions → plans (DB dynamique)
  const planRow = await pool.query(
    `SELECT p.limits, p.name as plan_name
     FROM subscriptions s
     JOIN plans p ON p.id = s.plan_id
     WHERE s.tenant_id = $1 AND p.is_active = true
     ORDER BY s.created_at DESC LIMIT 1`,
    [tenantId],
  );
  if (planRow.rows.length > 0) {
    const limits: Record<string, number> = planRow.rows[0].limits ?? {};
    if (resource in limits) return limits[resource];
  }

  // 2. Fallback : tenants.plan → PLAN_LIMITS statique
  const tenant = await pool.query(`SELECT plan FROM tenants WHERE id = $1`, [tenantId]);
  const plan = (tenant.rows[0]?.plan ?? "starter") as string;
  return PLAN_LIMITS[plan]?.[resource] ?? 1000;
}

async function _getOrInitUsage(
  tenantId: string,
  resource: string,
): Promise<{ current_usage: number; limit_value: number }> {
  const existing = await pool.query(
    `SELECT current_usage, limit_value FROM usage_limits
     WHERE tenant_id = $1 AND resource = $2 AND period_start = date_trunc('month', NOW())`,
    [tenantId, resource],
  );
  if (existing.rows.length > 0) return existing.rows[0];

  const limitValue = await _getLimitFromPlan(tenantId, resource);

  const result = await pool.query(
    `INSERT INTO usage_limits (tenant_id, resource, limit_value, current_usage, period_start)
     VALUES ($1, $2, $3, 0, date_trunc('month', NOW()))
     ON CONFLICT (tenant_id, resource)
     DO UPDATE SET period_start = date_trunc('month', NOW()), current_usage = 0, limit_value = EXCLUDED.limit_value
     RETURNING current_usage, limit_value`,
    [tenantId, resource, limitValue],
  );
  return result.rows[0];
}
