import { Router } from "express";
import { db, pool } from "@workspace/db";
import { prospectsTable, dealsTable, activitiesTable } from "@workspace/db";
import { requireAuth } from "../../middlewares/auth";
import { eq, and, ne, count, sum, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/stats", async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const period = (req.query.period as string) || "30d";
  const days = period === "7d" ? 7 : period === "90d" ? 90 : period === "365d" ? 365 : 30;

  const [
    prospectsByMonth,
    dealsByMonth,
    prospectsByStatus,
    dealsByStage,
    topActivities,
  ] = await Promise.all([
    // Monthly prospects created (last 12 months)
    db.execute(sql`
      SELECT to_char(date_trunc('month', created_at), 'Mon') as month,
             date_trunc('month', created_at) as month_date,
             count(*)::int as total
      FROM prospects
      WHERE tenant_id = ${tenantId}
        AND created_at >= now() - interval '12 months'
      GROUP BY month_date, month
      ORDER BY month_date
    `),

    // Monthly won revenue (last 12 months)
    db.execute(sql`
      SELECT to_char(date_trunc('month', created_at), 'Mon') as month,
             date_trunc('month', created_at) as month_date,
             coalesce(sum(value::numeric), 0)::float as revenue,
             count(*)::int as deals
      FROM deals
      WHERE tenant_id = ${tenantId}
        AND stage = 'won'
        AND created_at >= now() - interval '12 months'
      GROUP BY month_date, month
      ORDER BY month_date
    `),

    // Prospects by status
    db.select({ status: prospectsTable.status, total: count() })
      .from(prospectsTable)
      .where(eq(prospectsTable.tenantId, tenantId))
      .groupBy(prospectsTable.status),

    // Deals by stage with value
    db.select({
      stage: dealsTable.stage,
      total: count(),
      value: sum(dealsTable.value),
    })
      .from(dealsTable)
      .where(eq(dealsTable.tenantId, tenantId))
      .groupBy(dealsTable.stage),

    // Activity type breakdown
    db.execute(sql`
      SELECT type, count(*)::int as total
      FROM activities
      WHERE tenant_id = ${tenantId}
        AND created_at >= now() - interval '${sql.raw(days.toString())} days'
      GROUP BY type
      ORDER BY total DESC
      LIMIT 6
    `).catch(() => ({ rows: [] })),
  ]);

  // ── totals ──────────────────────────────────────────────────────────
  const totalProspects = (prospectsByStatus as any[]).reduce((s, r) => s + Number(r.total), 0);
  const wonValue = (dealsByMonth as any).rows?.reduce((s: number, r: any) => s + Number(r.revenue), 0) || 0;
  const pipelineValue = (dealsByStage as any[])
    .filter(r => !['won', 'lost'].includes(r.stage))
    .reduce((s, r) => s + Number(r.value || 0), 0);

  // ── prospect status distribution ────────────────────────────────────
  const statusDist = (prospectsByStatus as any[]).map(r => ({
    name: r.status,
    value: Number(r.total),
  }));

  // ── monthly prospects ────────────────────────────────────────────────
  const monthlyProspects = ((prospectsByMonth as any).rows || []).map((r: any) => ({
    name: r.month,
    total: Number(r.total),
  }));

  // ── monthly revenue ──────────────────────────────────────────────────
  const monthlyRevenue = ((dealsByMonth as any).rows || []).map((r: any) => ({
    name: r.month,
    revenue: Number(r.revenue),
    deals: Number(r.deals),
  }));

  // ── pipeline funnel ──────────────────────────────────────────────────
  const STAGE_ORDER = ["lead", "qualified", "proposal", "negotiation", "won"];
  const stageMap = Object.fromEntries((dealsByStage as any[]).map(r => [r.stage, { count: Number(r.total), value: Number(r.value || 0) }]));
  const pipelineFunnel = STAGE_ORDER.map(s => ({
    stage: s,
    count: stageMap[s]?.count || 0,
    value: stageMap[s]?.value || 0,
  }));

  // ── activities breakdown ─────────────────────────────────────────────
  const activityBreakdown = ((topActivities as any).rows || []).map((r: any) => ({
    type: r.type,
    total: Number(r.total),
  }));

  res.json({
    overview: {
      total_prospects: totalProspects,
      pipeline_value: pipelineValue,
      won_value: wonValue,
    },
    monthly_prospects: monthlyProspects,
    monthly_revenue: monthlyRevenue,
    status_distribution: statusDist,
    pipeline_funnel: pipelineFunnel,
    activity_breakdown: activityBreakdown,
  });
});

/* ── Analytics Overview — données réelles DB ── */
router.get("/overview", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  try {
    const [counts, dealStages, signalTypes, taskStatus, sequences] = await Promise.all([
      pool.query<{ prospects: string; deals: string; signals: string; tasks: string; meetings: string; activities: string }>(
        `SELECT
           (SELECT COUNT(*) FROM prospects   WHERE tenant_id = $1)::int AS prospects,
           (SELECT COUNT(*) FROM deals       WHERE tenant_id = $1)::int AS deals,
           (SELECT COUNT(*) FROM signals     WHERE tenant_id = $1)::int AS signals,
           (SELECT COUNT(*) FROM tasks       WHERE tenant_id = $1)::int AS tasks,
           (SELECT COUNT(*) FROM meetings    WHERE tenant_id = $1)::int AS meetings,
           (SELECT COUNT(*) FROM activities  WHERE tenant_id = $1)::int AS activities`,
        [tenantId],
      ).catch(() => ({ rows: [{ prospects:"0",deals:"0",signals:"0",tasks:"0",meetings:"0",activities:"0" }] })),
      pool.query(
        `SELECT stage, COUNT(*)::int as count, COALESCE(SUM(value::numeric),0)::float as value
         FROM deals WHERE tenant_id = $1 GROUP BY stage ORDER BY count DESC`,
        [tenantId],
      ).catch(() => ({ rows: [] })),
      pool.query(
        `SELECT type, COUNT(*)::int as count FROM signals WHERE tenant_id = $1 GROUP BY type ORDER BY count DESC`,
        [tenantId],
      ).catch(() => ({ rows: [] })),
      pool.query(
        `SELECT status, COUNT(*)::int as count FROM tasks WHERE tenant_id = $1 GROUP BY status`,
        [tenantId],
      ).catch(() => ({ rows: [] })),
      pool.query<{ total: string; active: string }>(
        `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'active')::int AS active
         FROM sequences WHERE tenant_id = $1`,
        [tenantId],
      ).catch(() => ({ rows: [{ total:"0", active:"0" }] })),
    ]);
    const c = counts.rows[0];
    res.json({
      prospects: parseInt(c.prospects, 10),
      deals: parseInt(c.deals, 10),
      signals: parseInt(c.signals, 10),
      tasks: parseInt(c.tasks, 10),
      meetings: parseInt(c.meetings, 10),
      activities: parseInt(c.activities, 10),
      sequences: { total: parseInt(sequences.rows[0]?.total ?? "0", 10), active: parseInt(sequences.rows[0]?.active ?? "0", 10) },
      dealsByStage: dealStages.rows,
      signalsByType: signalTypes.rows,
      tasksByStatus: taskStatus.rows,
    });
  } catch (err) {
    res.status(500).json({ error: "Erreur interne" });
  }
});

/* ── Analytics Funnel — stages deals ── */
router.get("/funnel", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const STAGES = ["lead","qualified","proposal","negotiation","won","lost"];
  try {
    const { rows } = await pool.query(
      `SELECT stage, COUNT(*)::int as count, COALESCE(SUM(value::numeric),0)::float as value
       FROM deals WHERE tenant_id = $1 GROUP BY stage`,
      [tenantId],
    );
    const map = Object.fromEntries(rows.map((r: any) => [r.stage, { count: r.count, value: r.value }]));
    res.json({ funnel: STAGES.map(s => ({ stage: s, count: map[s]?.count ?? 0, value: map[s]?.value ?? 0 })) });
  } catch { res.status(500).json({ error: "Erreur interne" }); }
});

/* ── Analytics Usage — ressources vs limites ── */
router.get("/usage", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  try {
    const { rows } = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM prospects WHERE tenant_id = $1)::int AS prospects,
         (SELECT COUNT(*) FROM deals     WHERE tenant_id = $1)::int AS deals,
         (SELECT COUNT(*) FROM sequences WHERE tenant_id = $1)::int AS sequences,
         (SELECT COUNT(*) FROM signals   WHERE tenant_id = $1)::int AS signals,
         (SELECT COUNT(*) FROM users     WHERE tenant_id = $1)::int AS users,
         (SELECT COUNT(*) FROM tasks     WHERE tenant_id = $1)::int AS tasks`,
      [tenantId],
    ).catch(() => ({ rows: [{}] }));
    const u = rows[0] ?? {};
    const LIMITS: Record<string, number> = { prospects:10000, deals:5000, sequences:200, signals:50000, users:50, tasks:10000 };
    res.json({
      resources: Object.entries(LIMITS).map(([name, limit]) => ({
        name,
        used: parseInt(u[name] ?? "0", 10),
        limit,
        pct: Math.round((parseInt(u[name] ?? "0", 10) / limit) * 100),
      })),
    });
  } catch { res.status(500).json({ error: "Erreur interne" }); }
});

/* ── Analytics Actions fréquentes ── */
router.get("/actions-frequent", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  try {
    const { rows } = await pool.query(
      `SELECT action, entity_type, COUNT(*)::int as count
       FROM audit_logs
       WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
       GROUP BY action, entity_type
       ORDER BY count DESC
       LIMIT 10`,
      [tenantId],
    ).catch(() => ({ rows: [] }));
    res.json({ actions: rows });
  } catch { res.status(500).json({ error: "Erreur interne" }); }
});

/* ── Analytics Entités actives ── */
router.get("/entities-active", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  try {
    const { rows } = await pool.query(
      `SELECT entity_type, entity_id, COUNT(*)::int as event_count, MAX(created_at) as last_event
       FROM audit_logs
       WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '30 days' AND entity_id IS NOT NULL
       GROUP BY entity_type, entity_id
       ORDER BY event_count DESC
       LIMIT 10`,
      [tenantId],
    ).catch(() => ({ rows: [] }));
    res.json({ entities: rows });
  } catch { res.status(500).json({ error: "Erreur interne" }); }
});

/* ── Product Analytics : track frontend event ── */
router.post("/track", requireAuth, async (req, res) => {
  const { event, properties } = req.body as { event?: string; properties?: Record<string, unknown> };
  if (!event) { res.status(400).json({ error: "event requis" }); return; }
  const tenantId = req.auth!.tenantId;
  const userId = req.auth!.userId;
  try {
    await pool.query(
      `INSERT INTO analytics_events (tenant_id, user_id, event_name, properties)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [tenantId, userId, event, JSON.stringify(properties ?? {})],
    );
  } catch {
    // table might not exist yet — ignore
  }
  res.json({ ok: true });
});

/* ── Product Analytics : dashboard ── */
router.get("/product-dashboard", requireAuth, async (req, res) => {
  const { ProductAnalytics } = await import("../../lib/analytics/ProductAnalytics");
  const days = Number(req.query.days ?? 30);
  const [dashboard, funnel] = await Promise.all([
    ProductAnalytics.getDashboard(req.auth!.tenantId, days),
    ProductAnalytics.getFunnelData(req.auth!.tenantId),
  ]);
  res.json({ ...dashboard, ...funnel });
});

export default router;
