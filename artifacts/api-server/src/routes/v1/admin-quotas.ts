import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../../middlewares/auth";
import { requireRBACRole } from "../../middlewares/rbac";
import { getUsage, PLAN_LIMITS } from "../../middlewares/usageLimit";

const router = Router();

router.use(requireAuth, requireRBACRole("admin"));

/* ─── GET /admin/quotas ──────────────────────────────────────────────────────
   Vue admin : quotas de tous les tenants avec plan, usage et %
────────────────────────────────────────────────────────────────────────────── */
router.get("/quotas", async (req, res) => {
  try {
    const { rows: tenants } = await pool.query<{
      id: string; name: string; plan: string; created_at: string;
    }>(`SELECT id, name, plan, created_at FROM tenants ORDER BY name`);

    const result = await Promise.all(tenants.map(async (t) => {
      // Usage ce mois depuis usage_limits
      const usageMap = await getUsage(t.id).catch(() => ({} as Record<string, { used: number; limit: number; percent: number }>));

      // Comptes réels (count physique pour enrichir)
      const [prospectsCount, dealsCount, signalsCount, usersCount, sequencesCount] = await Promise.all([
        pool.query<{ count: string }>(`SELECT COUNT(*) AS count FROM prospects WHERE tenant_id = $1`, [t.id]).then(r => parseInt(r.rows[0]?.count ?? "0", 10)).catch(() => 0),
        pool.query<{ count: string }>(`SELECT COUNT(*) AS count FROM deals WHERE tenant_id = $1`, [t.id]).then(r => parseInt(r.rows[0]?.count ?? "0", 10)).catch(() => 0),
        pool.query<{ count: string }>(`SELECT COUNT(*) AS count FROM signals WHERE tenant_id = $1`, [t.id]).then(r => parseInt(r.rows[0]?.count ?? "0", 10)).catch(() => 0),
        pool.query<{ count: string }>(`SELECT COUNT(*) AS count FROM users WHERE tenant_id = $1`, [t.id]).then(r => parseInt(r.rows[0]?.count ?? "0", 10)).catch(() => 0),
        pool.query<{ count: string }>(`SELECT COUNT(*) AS count FROM sequences WHERE tenant_id = $1`, [t.id]).then(r => parseInt(r.rows[0]?.count ?? "0", 10)).catch(() => 0),
      ]);

      // Plan limits (DB dynamique > statique)
      const planRow = await pool.query(
        `SELECT p.limits, p.name AS plan_name FROM subscriptions s
         JOIN plans p ON p.id = s.plan_id
         WHERE s.tenant_id = $1 AND p.is_active = true
         ORDER BY s.created_at DESC LIMIT 1`,
        [t.id],
      ).catch(() => ({ rows: [] as any[] }));

      const planLimits: Record<string, number> = planRow.rows.length > 0
        ? (planRow.rows[0].limits ?? {})
        : (PLAN_LIMITS[t.plan] ?? PLAN_LIMITS.starter);

      const planName: string = planRow.rows.length > 0
        ? planRow.rows[0].plan_name
        : t.plan;

      function pct(used: number, limit: number) {
        if (limit === -1) return 0;
        return Math.min(100, Math.round((used / limit) * 100));
      }

      const prospectsLimit = planLimits.prospects ?? 500;
      const emailsLimit    = planLimits.emails ?? 1000;
      const seqLimit       = planLimits.sequences ?? 3;
      const usersLimit     = planLimits.users ?? 2;

      return {
        tenantId: t.id,
        tenantName: t.name,
        plan: planName,
        resources: {
          prospects: {
            used: prospectsCount,
            limit: prospectsLimit,
            percent: pct(prospectsCount, prospectsLimit),
            monthly: usageMap.prospects ?? null,
          },
          emails: {
            used: usageMap.emails?.used ?? 0,
            limit: emailsLimit,
            percent: usageMap.emails?.percent ?? 0,
            monthly: usageMap.emails ?? null,
          },
          sequences: {
            used: sequencesCount,
            limit: seqLimit,
            percent: pct(sequencesCount, seqLimit),
            monthly: usageMap.sequences ?? null,
          },
          users: {
            used: usersCount,
            limit: usersLimit,
            percent: pct(usersCount, usersLimit),
            monthly: usageMap.users ?? null,
          },
          deals: {
            used: dealsCount,
            limit: -1,
            percent: 0,
            monthly: null,
          },
          signals: {
            used: signalsCount,
            limit: -1,
            percent: 0,
            monthly: null,
          },
        },
        alerts: buildAlerts(prospectsCount, prospectsLimit, emailsLimit, usageMap),
      };
    }));

    res.json({ tenants: result, generatedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la récupération des quotas" });
  }
});

/* ─── GET /admin/quotas/me ───────────────────────────────────────────────────
   Vue tenant courant uniquement (réutilise billing usage mais avec plan limits)
────────────────────────────────────────────────────────────────────────────── */
router.get("/quotas/me", async (req, res) => {
  try {
    const tenantId = req.auth!.tenantId;
    const usageMap = await getUsage(tenantId);

    const planRow = await pool.query(
      `SELECT p.limits, p.name AS plan_name FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.tenant_id = $1 AND p.is_active = true
       ORDER BY s.created_at DESC LIMIT 1`,
      [tenantId],
    ).catch(() => ({ rows: [] as any[] }));

    const tenantRow = await pool.query(`SELECT plan FROM tenants WHERE id = $1`, [tenantId]);
    const staticPlan = tenantRow.rows[0]?.plan ?? "starter";
    const planLimits: Record<string, number> = planRow.rows.length > 0
      ? (planRow.rows[0].limits ?? {})
      : (PLAN_LIMITS[staticPlan] ?? PLAN_LIMITS.starter);

    res.json({
      usage: usageMap,
      limits: planLimits,
      plan: planRow.rows[0]?.plan_name ?? staticPlan,
    });
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la récupération des quotas" });
  }
});

function buildAlerts(
  prospects: number, prospectsLimit: number,
  emailsLimit: number,
  usageMap: Record<string, { used: number; limit: number; percent: number }>,
): string[] {
  const alerts: string[] = [];
  if (prospectsLimit !== -1 && prospects / prospectsLimit >= 0.8)
    alerts.push(`Prospects à ${Math.round((prospects / prospectsLimit) * 100)}% du quota`);
  if (emailsLimit !== -1 && (usageMap.emails?.percent ?? 0) >= 80)
    alerts.push(`Emails à ${usageMap.emails?.percent}% du quota mensuel`);
  if ((usageMap.sequences?.percent ?? 0) >= 80)
    alerts.push(`Séquences à ${usageMap.sequences?.percent}% du quota`);
  return alerts;
}

export default router;
