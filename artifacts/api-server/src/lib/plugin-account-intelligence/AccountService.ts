import { pool } from "@workspace/db";
import { logger } from "../logger";

export type EngagementLevel = "low" | "medium" | "high" | "very_high";

export interface ScoreBreakdown {
  prospectsCount: number;
  prospectsScore: number;
  meetingsCount: number;
  meetingsScore: number;
  memorySignalsCount: number;
  memoryScore: number;
  recencyScore: number;
  total: number;
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

function recencyScore(lastActivityAt: Date | null): number {
  if (!lastActivityAt) return 0;
  const daysSince = (Date.now() - lastActivityAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince <= 7) return 25;
  if (daysSince <= 30) return 18;
  if (daysSince <= 90) return 10;
  if (daysSince <= 180) return 4;
  return 0;
}

/* ─── Service ────────────────────────────────────────────── */

class AccountService {
  async calculateHealthScore(accountId: string, tenantId: string): Promise<ScoreBreakdown> {
    const companyPattern = `%${accountId}%`;

    // Prospects linked to this account
    const prospectsRes = await pool.query<{ count: string; max_score: string; last_updated: Date | null }>(
      `SELECT COUNT(*) AS count, COALESCE(MAX(score),0) AS max_score, MAX(updated_at) AS last_updated
       FROM prospects
       WHERE LOWER(company) = LOWER($1) AND tenant_id = $2`,
      [accountId, tenantId],
    );
    const prospectsCount = parseInt(prospectsRes.rows[0]?.count ?? "0", 10);
    const maxProspectScore = parseInt(String(prospectsRes.rows[0]?.max_score ?? "0"), 10);
    const prospectsScore = Math.min(30, prospectsCount * 8 + Math.round(maxProspectScore * 0.15));

    // Meetings mentioning this company (via memory_documents)
    const meetingsRes = await pool.query<{ count: string; last_created: Date | null }>(
      `SELECT COUNT(*) AS count, MAX(m.created_at) AS last_created
       FROM meetings m
       WHERE LOWER(m.title) LIKE LOWER($1) AND m.tenant_id = $2`,
      [companyPattern, tenantId],
    );
    const meetingsCount = parseInt(meetingsRes.rows[0]?.count ?? "0", 10);
    const meetingsScore = Math.min(25, meetingsCount * 12);

    // Memory signals (documents mentioning this company)
    const memoryRes = await pool.query<{ count: string; last_created: Date | null }>(
      `SELECT COUNT(*) AS count, MAX(created_at) AS last_created
       FROM memory_documents
       WHERE LOWER(content) LIKE LOWER($1) AND tenant_id = $2`,
      [companyPattern, tenantId],
    );
    const memorySignalsCount = parseInt(memoryRes.rows[0]?.count ?? "0", 10);
    const memoryScore = Math.min(20, memorySignalsCount * 5);

    // Last activity across all sources
    const dates: (Date | null)[] = [
      prospectsRes.rows[0]?.last_updated ?? null,
      meetingsRes.rows[0]?.last_created ?? null,
      memoryRes.rows[0]?.last_created ?? null,
    ];
    const validDates = dates.filter((d): d is Date => d !== null);
    const lastActivity = validDates.length > 0 ? new Date(Math.max(...validDates.map((d) => d.getTime()))) : null;
    const recency = recencyScore(lastActivity);

    const total = Math.min(100, prospectsScore + meetingsScore + memoryScore + recency);

    return {
      prospectsCount,
      prospectsScore,
      meetingsCount,
      meetingsScore,
      memorySignalsCount,
      memoryScore,
      recencyScore: recency,
      total,
    };
  }

  async upsertMetrics(accountId: string, tenantId: string): Promise<AccountMetrics> {
    const breakdown = await this.calculateHealthScore(accountId, tenantId);
    const engagementLevel = toEngagementLevel(breakdown.total);

    // Derive lastActivityAt from a cross-source query
    const lastRes = await pool.query<{ last_at: Date | null }>(
      `SELECT GREATEST(
         (SELECT MAX(updated_at) FROM prospects WHERE LOWER(company)=LOWER($1) AND tenant_id=$2),
         (SELECT MAX(created_at) FROM meetings WHERE LOWER(title) LIKE LOWER($3) AND tenant_id=$2),
         (SELECT MAX(created_at) FROM memory_documents WHERE LOWER(content) LIKE LOWER($3) AND tenant_id=$2)
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

    const row = await pool.query<AccountMetrics & { account_id: string; tenant_id: string; health_score: number; engagement_level: EngagementLevel; last_activity_at: Date | null; score_breakdown: ScoreBreakdown; updated_at: Date }>(
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

    // Contacts (prospects) for this account
    const prospectsRes = await pool.query<{ first_name: string; last_name: string; email: string; job_title: string; updated_at: Date }>(
      `SELECT first_name, last_name, email, job_title, updated_at
       FROM prospects
       WHERE LOWER(company) = LOWER($1) AND tenant_id = $2
       ORDER BY updated_at DESC LIMIT 20`,
      [accountId, tenantId],
    );
    if (prospectsRes.rows.length === 0) {
      logger.warn({ accountId }, "No prospects found for account");
    }

    const contacts = prospectsRes.rows.map((p) => ({
      name: `${p.first_name || ""} ${p.last_name || ""}`.trim() || accountId,
      email: p.email || "",
      role: p.job_title || "",
    }));

    // Domain from first contact email
    const domain = contacts.find((c) => c.email.includes("@"))?.email.split("@")[1] || "";

    // Recent meetings (by title match)
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

    // Memory signals
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

    // Build timeline
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

    // Compute and persist metrics
    const metrics = await this.upsertMetrics(accountId, tenantId);

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
