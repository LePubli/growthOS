import { pool } from "@workspace/db";
import { logger } from "../logger";

export type EngagementLevel = "low" | "medium" | "high" | "very_high";

export interface ScoreBreakdown {
  recentActivityScore: number;
  emailEngagementScore: number;
  pipelineProgressionScore: number;
  reputationScore: number;
  intentSignalsScore: number;
  total: number;
  // legacy fields kept for upsertMetrics compatibility
  prospectsCount: number;
  meetingsCount: number;
  memorySignalsCount: number;
}

export interface AccountMetrics {
  accountId: string;
  tenantId: string;
  healthScore: number;
  engagementLevel: EngagementLevel;
  lastActivityAt: string | null;
  scoreBreakdown: ScoreBreakdown;
  updatedAt: string;
}

export interface TimelineEvent {
  id: string;
  type: "meeting" | "memory" | "prospect" | "activity";
  title: string;
  description: string | null;
  date: string;
  icon: string;
}

export interface Account360 {
  accountId: string;
  name: string;
  domain: string;
  contacts: { name: string; email: string; role: string }[];
  metrics: AccountMetrics;
  timeline: TimelineEvent[];
  recentMeetings: { id: string; title: string; status: string; createdAt: string; summary: string | null }[];
  memorySignals: { id: string; content: string; sourceType: string; createdAt: string }[];
}

/* ─── Scoring helpers ────────────────────────────────────── */

function toEngagementLevel(score: number): EngagementLevel {
  if (score >= 75) return "very_high";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

/* ─── Service ────────────────────────────────────────────── */

class AccountService {
  /**
   * Calcule le Health Score unifié (100 pts) en 5 facteurs pondérés :
   *   40% Activité récente (activities + meetings last 30j)
   *   20% Engagement email (emails envoyés via séquences)
   *   20% Progression pipeline (deals actifs hors lost/won)
   *   10% Score E-Réputation (accounts.reputation_health_score)
   *   10% Signaux d'intention (signals last 60j)
   */
  async calculateHealthScore(accountId: string, tenantId: string): Promise<ScoreBreakdown> {
    const companyPattern = `%${accountId}%`;

    const [activitiesRes, meetingsRes, emailsRes, dealsRes, reputationRes, signalsRes] =
      await Promise.all([
        // ── Activité récente (40 pts max)
        pool.query<{ count: string }>(
          `SELECT COUNT(*) AS count
           FROM activities
           WHERE tenant_id = $1
             AND prospect_id IN (
               SELECT id FROM prospects
               WHERE tenant_id = $1 AND LOWER(company) = LOWER($2)
             )
             AND created_at > NOW() - INTERVAL '30 days'`,
          [tenantId, accountId],
        ).catch(() => ({ rows: [{ count: "0" }] })),

        // Meetings (inclus dans activité récente)
        pool.query<{ count: string; last_created: Date | null }>(
          `SELECT COUNT(*) AS count, MAX(created_at) AS last_created
           FROM meetings
           WHERE tenant_id = $1 AND LOWER(title) LIKE LOWER($2)`,
          [tenantId, companyPattern],
        ).catch(() => ({ rows: [{ count: "0", last_created: null }] })),

        // ── Engagement email (20 pts max)
        pool.query<{ count: string }>(
          `SELECT COUNT(*) AS count
           FROM activities
           WHERE tenant_id = $1
             AND type = 'email'
             AND prospect_id IN (
               SELECT id FROM prospects
               WHERE tenant_id = $1 AND LOWER(company) = LOWER($2)
             )
             AND created_at > NOW() - INTERVAL '90 days'`,
          [tenantId, accountId],
        ).catch(() => ({ rows: [{ count: "0" }] })),

        // ── Progression pipeline (20 pts max)
        pool.query<{ count: string; total_value: string }>(
          `SELECT COUNT(*) AS count, COALESCE(SUM(value), 0) AS total_value
           FROM deals
           WHERE tenant_id = $1
             AND LOWER(company) LIKE LOWER($2)
             AND stage NOT IN ('won', 'lost')`,
          [tenantId, companyPattern],
        ).catch(() => ({ rows: [{ count: "0", total_value: "0" }] })),

        // ── Score E-Réputation (10 pts max) — depuis accounts
        pool.query<{ reputation_health_score: number | null }>(
          `SELECT reputation_health_score
           FROM accounts
           WHERE tenant_id = $1 AND LOWER(name) LIKE LOWER($2)
           LIMIT 1`,
          [tenantId, companyPattern],
        ).catch(() => ({ rows: [] as any[] })),

        // ── Signaux d'intention (10 pts max)
        pool.query<{ count: string }>(
          `SELECT COUNT(*) AS count
           FROM signals
           WHERE tenant_id = $1
             AND LOWER(company) LIKE LOWER($2)
             AND detected_at > NOW() - INTERVAL '60 days'`,
          [tenantId, companyPattern],
        ).catch(() => ({ rows: [{ count: "0" }] })),
      ]);

    // ── Calcul facteur 1 : Activité récente (40 pts)
    const recentActivities = parseInt(activitiesRes.rows[0]?.count ?? "0", 10);
    const recentMeetings   = parseInt(meetingsRes.rows[0]?.count ?? "0", 10);
    const recentActivityScore = Math.min(40,
      recentActivities * 4 + recentMeetings * 8,
    );

    // ── Calcul facteur 2 : Engagement email (20 pts)
    const emailCount = parseInt(emailsRes.rows[0]?.count ?? "0", 10);
    const emailEngagementScore = Math.min(20, emailCount * 4);

    // ── Calcul facteur 3 : Progression pipeline (20 pts)
    const activeDeals = parseInt(dealsRes.rows[0]?.count ?? "0", 10);
    const pipelineValue = parseFloat(dealsRes.rows[0]?.total_value ?? "0");
    const pipelineProgressionScore = Math.min(20,
      activeDeals * 5 + Math.min(5, Math.floor(pipelineValue / 10000)),
    );

    // ── Calcul facteur 4 : E-Réputation (10 pts)
    const rawReputation = reputationRes.rows[0]?.reputation_health_score ?? null;
    const reputationScore = rawReputation !== null
      ? Math.round((rawReputation / 100) * 10)
      : 5; // neutre si pas de données

    // ── Calcul facteur 5 : Signaux d'intention (10 pts)
    const signalCount = parseInt(signalsRes.rows[0]?.count ?? "0", 10);
    const intentSignalsScore = Math.min(10, signalCount * 3);

    const total = Math.min(100,
      recentActivityScore + emailEngagementScore + pipelineProgressionScore +
      reputationScore + intentSignalsScore,
    );

    return {
      recentActivityScore,
      emailEngagementScore,
      pipelineProgressionScore,
      reputationScore,
      intentSignalsScore,
      total,
      // legacy
      prospectsCount: activeDeals,
      meetingsCount: recentMeetings,
      memorySignalsCount: signalCount,
    };
  }

  async upsertMetrics(accountId: string, tenantId: string): Promise<AccountMetrics> {
    const breakdown = await this.calculateHealthScore(accountId, tenantId);
    const engagementLevel = toEngagementLevel(breakdown.total);

    const lastRes = await pool.query<{ last_at: Date | null }>(
      `SELECT GREATEST(
         (SELECT MAX(updated_at) FROM prospects WHERE LOWER(company)=LOWER($1) AND tenant_id=$2),
         (SELECT MAX(created_at) FROM meetings WHERE LOWER(title) LIKE LOWER($3) AND tenant_id=$2),
         (SELECT MAX(created_at) FROM activities WHERE tenant_id=$2
            AND prospect_id IN (SELECT id FROM prospects WHERE tenant_id=$2 AND LOWER(company)=LOWER($1)))
       ) AS last_at`,
      [accountId, tenantId, `%${accountId}%`],
    );
    const lastActivityAt = lastRes.rows[0]?.last_at ?? null;

    await pool.query(
      `INSERT INTO account_metrics (account_id, tenant_id, health_score, engagement_level, last_activity_at, score_breakdown, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())
       ON CONFLICT (account_id, tenant_id)
       DO UPDATE SET
         health_score     = EXCLUDED.health_score,
         engagement_level = EXCLUDED.engagement_level,
         last_activity_at = EXCLUDED.last_activity_at,
         score_breakdown  = EXCLUDED.score_breakdown,
         updated_at       = NOW()`,
      [accountId, tenantId, breakdown.total, engagementLevel, lastActivityAt, JSON.stringify(breakdown)],
    );

    const row = await pool.query(
      `SELECT account_id AS "accountId", tenant_id AS "tenantId", health_score AS "healthScore",
              engagement_level AS "engagementLevel", last_activity_at AS "lastActivityAt",
              score_breakdown AS "scoreBreakdown", updated_at AS "updatedAt"
       FROM account_metrics WHERE account_id = $1 AND tenant_id = $2`,
      [accountId, tenantId],
    );

    return row.rows[0];
  }

  async getAccount360(accountId: string, tenantId: string): Promise<Account360 | null> {
    const companyPattern = `%${accountId}%`;

    const prospectsRes = await pool.query<{ first_name: string; last_name: string; email: string; job_title: string; updated_at: Date }>(
      `SELECT first_name, last_name, email, job_title, updated_at
       FROM prospects
       WHERE LOWER(company) = LOWER($1) AND tenant_id = $2
       ORDER BY updated_at DESC LIMIT 20`,
      [accountId, tenantId],
    );

    const contacts = prospectsRes.rows.map((p) => ({
      name: `${p.first_name || ""} ${p.last_name || ""}`.trim() || accountId,
      email: p.email || "",
      role: p.job_title || "",
    }));

    const domain = contacts.find((c) => c.email.includes("@"))?.email.split("@")[1] || "";

    const meetingsRes = await pool.query<{ id: string; title: string; status: string; created_at: Date; summary: string | null }>(
      `SELECT id, title, status, created_at, summary
       FROM meetings
       WHERE LOWER(title) LIKE LOWER($1) AND tenant_id = $2
       ORDER BY created_at DESC LIMIT 10`,
      [companyPattern, tenantId],
    );
    const recentMeetings = meetingsRes.rows.map((m) => ({
      id: m.id,
      title: m.title,
      status: m.status,
      createdAt: m.created_at.toISOString(),
      summary: m.summary,
    }));

    const memoryRes = await pool.query<{ id: string; content: string; source_type: string; created_at: Date }>(
      `SELECT id, content, source_type, created_at
       FROM memory_documents
       WHERE LOWER(content) LIKE LOWER($1) AND tenant_id = $2
       ORDER BY created_at DESC LIMIT 15`,
      [companyPattern, tenantId],
    );
    const memorySignals = memoryRes.rows.map((d) => ({
      id: d.id,
      content: d.content.length > 200 ? d.content.slice(0, 200) + "…" : d.content,
      sourceType: d.source_type,
      createdAt: d.created_at.toISOString(),
    }));

    const timeline: TimelineEvent[] = [
      ...prospectsRes.rows.map((p) => ({
        id: `prospect-${p.email}`,
        type: "prospect" as const,
        title: `Contact: ${`${p.first_name || ""} ${p.last_name || ""}`.trim() || p.email}`,
        description: p.job_title || null,
        date: p.updated_at.toISOString(),
        icon: "User",
      })),
      ...meetingsRes.rows.map((m) => ({
        id: `meeting-${m.id}`,
        type: "meeting" as const,
        title: m.title,
        description: m.summary ? m.summary.slice(0, 120) + (m.summary.length > 120 ? "…" : "") : null,
        date: m.created_at.toISOString(),
        icon: "Video",
      })),
      ...memoryRes.rows.map((d) => ({
        id: `memory-${d.id}`,
        type: "memory" as const,
        title: `Signal mémoire (${d.source_type})`,
        description: d.content.slice(0, 120) + (d.content.length > 120 ? "…" : ""),
        date: d.created_at.toISOString(),
        icon: "Brain",
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 30);

    let metrics: AccountMetrics;
    try {
      metrics = await this.upsertMetrics(accountId, tenantId);
    } catch (err) {
      logger.warn({ accountId, err }, "upsertMetrics failed — using default metrics");
      metrics = {
        accountId,
        tenantId,
        healthScore: 0,
        engagementLevel: "low",
        lastActivityAt: null,
        scoreBreakdown: { recentActivityScore:0, emailEngagementScore:0, pipelineProgressionScore:0, reputationScore:0, intentSignalsScore:0, total:0, prospectsCount:0, meetingsCount:0, memorySignalsCount:0 },
        updatedAt: new Date().toISOString(),
      };
    }

    return {
      accountId,
      name: accountId,
      domain,
      contacts,
      metrics,
      timeline,
      recentMeetings,
      memorySignals,
    };
  }
}

export const accountService = new AccountService();
