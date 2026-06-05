import { pool } from "@workspace/db";
import { logger } from "../logger";

export const ProductAnalytics = {
  /**
   * Enregistre un événement produit (action utilisateur ou API).
   */
  async trackEvent(
    tenantId: string,
    userId: string | null,
    eventName: string,
    properties: Record<string, unknown> = {},
  ): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO analytics_events (tenant_id, user_id, event_name, properties)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [tenantId, userId ?? null, eventName, JSON.stringify(properties)],
      );
    } catch (err) {
      logger.warn({ err, eventName }, "ProductAnalytics.trackEvent failed silently");
    }
  },

  /**
   * Retourne les métriques d'utilisation du produit pour les 30 derniers jours.
   */
  async getDashboard(tenantId: string, days = 30): Promise<Record<string, unknown>> {
    const [
      topEvents,
      dailyActive,
      featureUsage,
      totalEvents,
      recentEvents,
    ] = await Promise.all([
      pool.query(
        `SELECT event_name, COUNT(*)::int as count
         FROM analytics_events
         WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '${days} days'
         GROUP BY event_name ORDER BY count DESC LIMIT 20`,
        [tenantId],
      ),
      pool.query(
        `SELECT DATE(created_at) as date, COUNT(DISTINCT user_id)::int as active_users
         FROM analytics_events
         WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '${days} days'
           AND user_id IS NOT NULL
         GROUP BY DATE(created_at) ORDER BY date`,
        [tenantId],
      ),
      pool.query(
        `SELECT event_name,
                COUNT(*)::int as calls,
                COUNT(DISTINCT user_id)::int as unique_users
         FROM analytics_events
         WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '${days} days'
         GROUP BY event_name ORDER BY calls DESC LIMIT 10`,
        [tenantId],
      ),
      pool.query(
        `SELECT COUNT(*)::int as total FROM analytics_events
         WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '${days} days'`,
        [tenantId],
      ),
      pool.query(
        `SELECT event_name, properties, created_at FROM analytics_events
         WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [tenantId],
      ),
    ]);

    return {
      period_days: days,
      total_events: Number(totalEvents.rows[0]?.total ?? 0),
      top_events: topEvents.rows,
      daily_active_users: dailyActive.rows,
      feature_usage: featureUsage.rows,
      recent_events: recentEvents.rows,
    };
  },

  /**
   * Données d'entonnoir de conversion : prospect → deal → won
   */
  async getFunnelData(tenantId: string): Promise<Record<string, unknown>> {
    const [prospects, deals, wonDeals] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int as total FROM prospects WHERE tenant_id = $1`, [tenantId]),
      pool.query(`SELECT COUNT(*)::int as total FROM deals WHERE tenant_id = $1`, [tenantId]),
      pool.query(`SELECT COUNT(*)::int as total FROM deals WHERE tenant_id = $1 AND stage = 'won'`, [tenantId]),
    ]);

    const p = Number(prospects.rows[0]?.total ?? 0);
    const d = Number(deals.rows[0]?.total ?? 0);
    const w = Number(wonDeals.rows[0]?.total ?? 0);

    return {
      funnel: [
        { stage: "Prospects", count: p, rate: 100 },
        { stage: "Deals créés", count: d, rate: p > 0 ? Math.round((d / p) * 100) : 0 },
        { stage: "Deals gagnés", count: w, rate: d > 0 ? Math.round((w / d) * 100) : 0 },
      ],
    };
  },
};
