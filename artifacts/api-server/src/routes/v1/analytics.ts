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
