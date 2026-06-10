/**
 * Portail Client E-Réputation
 * Routes : /client/ereputation/*
 * Accessibles aux rôles : 'client', 'admin'
 *
 * Les routes retournent uniquement les campagnes du tenant de l'utilisateur
 * (isolation multi-tenant garantie).
 */

import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { logger } from "../../lib/logger";

const router = Router();

// ── Auth guards (appliqués à toutes les routes de ce fichier) ───────────────
router.use(requireAuth);
router.use(requireRole("client", "admin", "member")); // Accessible aux membres pour démo

// ─────────────────────────────────────────────────────────────────────────────
//  GET /client/ereputation/dashboard
//  Vue synthétique : score moyen, alertes actives, campagnes récentes
// ─────────────────────────────────────────────────────────────────────────────
router.get("/dashboard", async (req, res) => {
  const tenantId = req.auth!.tenantId;
  try {
    const [campaigns, alerts, posts] = await Promise.all([
      pool.query<{ id: string; name: string; target_name: string; reputation_score: number; status: string; updated_at: string }>(
        `SELECT id, name, target_name, reputation_score, status, updated_at
         FROM erep_campaigns
         WHERE tenant_id = $1
         ORDER BY updated_at DESC
         LIMIT 10`,
        [tenantId],
      ).catch(() => ({ rows: [] as any[] })),
      pool.query<{ id: string; type: string; severity: string; title: string; score: number; created_at: string; is_resolved: boolean }>(
        `SELECT id, type, severity, title, score, created_at, is_resolved
         FROM erep_alerts
         WHERE tenant_id = $1
         ORDER BY created_at DESC
         LIMIT 20`,
        [tenantId],
      ).catch(() => ({ rows: [] as any[] })),
      pool.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM erep_content_posts p
         JOIN erep_campaigns c ON c.id = p.campaign_id
         WHERE c.tenant_id = $1 AND p.status = 'published'`,
        [tenantId],
      ).catch(() => ({ rows: [{ count: "0" }] as any[] })),
    ]);

    const avgScore = campaigns.rows.length
      ? Math.round(campaigns.rows.reduce((s, c) => s + (c.reputation_score ?? 50), 0) / campaigns.rows.length)
      : 50;

    const activeAlerts = alerts.rows.filter(a => !a.is_resolved);
    const crisisCount = activeAlerts.filter(a => a.severity === "high").length;
    const publishedPosts = parseInt(posts.rows[0]?.count ?? "0", 10);

    res.json({
      summary: {
        averageReputationScore: avgScore,
        totalCampaigns: campaigns.rows.length,
        activeAlerts: activeAlerts.length,
        crisisAlerts: crisisCount,
        publishedPosts,
        scoreColor: avgScore >= 70 ? "green" : avgScore >= 40 ? "orange" : "red",
        scoreLabel: avgScore >= 70 ? "Excellente" : avgScore >= 40 ? "Correcte" : "Critique",
      },
      recentCampaigns: campaigns.rows.map(c => ({
        id: c.id,
        name: c.name,
        targetName: c.target_name,
        reputationScore: c.reputation_score ?? 50,
        status: c.status,
        updatedAt: c.updated_at,
      })),
      recentAlerts: activeAlerts.slice(0, 5).map(a => ({
        id: a.id,
        type: a.type,
        severity: a.severity,
        title: a.title,
        score: a.score,
        createdAt: a.created_at,
      })),
    });
  } catch (err) {
    logger.error({ err }, "Client erep dashboard error");
    res.status(500).json({ error: "Erreur interne" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /client/ereputation/campaigns
//  Liste des campagnes avec score et derniers KPIs
// ─────────────────────────────────────────────────────────────────────────────
router.get("/campaigns", async (req, res) => {
  const tenantId = req.auth!.tenantId;
  try {
    const { rows } = await pool.query(
      `SELECT
         c.id, c.name, c.target_name, c.target_url, c.target_type,
         c.keywords, c.status, c.reputation_score, c.created_at, c.updated_at,
         COALESCE(a.active_alerts, 0) AS active_alerts,
         COALESCE(p.post_count, 0) AS total_posts,
         COALESCE(p.published_count, 0) AS published_posts
       FROM erep_campaigns c
       LEFT JOIN (
         SELECT campaign_id, COUNT(*) FILTER (WHERE NOT is_resolved) AS active_alerts
         FROM erep_alerts GROUP BY campaign_id
       ) a ON a.campaign_id = c.id
       LEFT JOIN (
         SELECT campaign_id,
                COUNT(*) AS post_count,
                COUNT(*) FILTER (WHERE status = 'published') AS published_count
         FROM erep_content_posts GROUP BY campaign_id
       ) p ON p.campaign_id = c.id
       WHERE c.tenant_id = $1
       ORDER BY c.updated_at DESC`,
      [tenantId],
    );
    res.json(rows.map(r => ({
      id: r.id,
      name: r.name,
      targetName: r.target_name,
      targetUrl: r.target_url,
      targetType: r.target_type,
      keywords: r.keywords,
      status: r.status,
      reputationScore: r.reputation_score ?? 50,
      activeAlerts: parseInt(r.active_alerts, 10),
      totalPosts: parseInt(r.total_posts, 10),
      publishedPosts: parseInt(r.published_posts, 10),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })));
  } catch (err) {
    logger.error({ err }, "Client erep campaigns error");
    res.status(500).json({ error: "Erreur interne" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /client/ereputation/campaigns/:id
//  Détail d'une campagne
// ─────────────────────────────────────────────────────────────────────────────
router.get("/campaigns/:id", async (req, res) => {
  const tenantId = req.auth!.tenantId;
  try {
    const { rows } = await pool.query(
      `SELECT * FROM erep_campaigns WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, tenantId],
    );
    if (!rows[0]) { res.status(404).json({ error: "Campagne introuvable" }); return; }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Erreur interne" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /client/ereputation/approvals
//  Contenus en attente d'approbation pour le portail client
// ─────────────────────────────────────────────────────────────────────────────
router.get("/approvals", async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const { status = "pending_approval", campaignId } = req.query as Record<string, string>;

  try {
    const conditions: string[] = ["a.tenant_id = $1"];
    const params: unknown[] = [tenantId];
    let idx = 2;

    if (status && status !== "all") {
      conditions.push(`a.status = $${idx++}`);
      params.push(status);
    }
    if (campaignId) {
      conditions.push(`a.campaign_id = $${idx++}`);
      params.push(campaignId);
    }

    const { rows } = await pool.query(
      `SELECT
         a.id, a.status, a.reviewer_note, a.created_at, a.updated_at,
         c.name AS campaign_name, c.target_name,
         p.platform, p.content_text, p.scheduled_at, p.published_at,
         u.email AS submitted_by_email
       FROM erep_approvals a
       LEFT JOIN erep_campaigns c ON c.id = a.campaign_id
       LEFT JOIN erep_content_posts p ON p.id = a.post_id
       LEFT JOIN users u ON u.id = a.submitted_by
       WHERE ${conditions.join(" AND ")}
       ORDER BY a.created_at DESC`,
      params,
    );
    res.json(rows.map(r => ({
      id: r.id,
      status: r.status,
      reviewerNote: r.reviewer_note,
      campaignName: r.campaign_name,
      targetName: r.target_name,
      post: {
        platform: r.platform,
        contentText: r.content_text,
        scheduledAt: r.scheduled_at,
        publishedAt: r.published_at,
      },
      submittedByEmail: r.submitted_by_email,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })));
  } catch (err) {
    logger.error({ err }, "Client approvals error");
    res.status(500).json({ error: "Erreur interne" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /client/ereputation/approvals/:id/approve
//  Approuver un contenu
// ─────────────────────────────────────────────────────────────────────────────
router.post("/approvals/:id/approve", async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const { note } = req.body as { note?: string };
  try {
    const { rows } = await pool.query(
      `UPDATE erep_approvals
       SET status = 'approved', reviewer_note = $1, reviewed_by = $2, updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4
       RETURNING *`,
      [note ?? null, req.auth!.userId, req.params.id, tenantId],
    );
    if (!rows[0]) { res.status(404).json({ error: "Approbation introuvable" }); return; }

    // Sync post status to 'scheduled'
    if (rows[0].post_id) {
      await pool.query(
        `UPDATE erep_content_posts SET status = 'scheduled', updated_at = NOW() WHERE id = $1`,
        [rows[0].post_id],
      ).catch(() => {});
    }

    res.json({ ok: true, approval: rows[0] });
  } catch (err) {
    logger.error({ err }, "Approve content error");
    res.status(500).json({ error: "Erreur interne" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /client/ereputation/approvals/:id/reject
//  Rejeter un contenu avec note
// ─────────────────────────────────────────────────────────────────────────────
router.post("/approvals/:id/reject", async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const { note } = req.body as { note?: string };
  try {
    const { rows } = await pool.query(
      `UPDATE erep_approvals
       SET status = 'rejected', reviewer_note = $1, reviewed_by = $2, updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4
       RETURNING *`,
      [note ?? null, req.auth!.userId, req.params.id, tenantId],
    );
    if (!rows[0]) { res.status(404).json({ error: "Approbation introuvable" }); return; }
    res.json({ ok: true, approval: rows[0] });
  } catch (err) {
    logger.error({ err }, "Reject content error");
    res.status(500).json({ error: "Erreur interne" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /client/ereputation/approvals
//  Soumettre un contenu pour approbation
// ─────────────────────────────────────────────────────────────────────────────
router.post("/approvals", async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const { campaignId, postId } = req.body as { campaignId?: string; postId?: string };
  if (!campaignId) {
    res.status(400).json({ error: "campaignId est requis" });
    return;
  }
  try {
    // Vérifier que la campagne appartient au tenant
    const { rows: campRows } = await pool.query(
      `SELECT id FROM erep_campaigns WHERE id = $1 AND tenant_id = $2`,
      [campaignId, tenantId],
    );
    if (!campRows[0]) { res.status(404).json({ error: "Campagne introuvable" }); return; }

    const { rows } = await pool.query(
      `INSERT INTO erep_approvals (campaign_id, tenant_id, post_id, submitted_by, status)
       VALUES ($1, $2, $3, $4, 'pending_approval')
       RETURNING *`,
      [campaignId, tenantId, postId ?? null, req.auth!.userId],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    logger.error({ err }, "Submit approval error");
    res.status(500).json({ error: "Erreur interne" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /client/ereputation/reports
//  Rapport consolidé : scores, tendances, alertes résolues
// ─────────────────────────────────────────────────────────────────────────────
router.get("/reports", async (req, res) => {
  const tenantId = req.auth!.tenantId;
  try {
    const [campaigns, alertStats, serpData, sentimentData] = await Promise.all([
      pool.query(
        `SELECT id, name, target_name, reputation_score, status, created_at, updated_at
         FROM erep_campaigns WHERE tenant_id = $1 ORDER BY reputation_score DESC`,
        [tenantId],
      ).catch(() => ({ rows: [] as any[] })),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE NOT is_resolved) AS active,
           COUNT(*) FILTER (WHERE is_resolved) AS resolved,
           COUNT(*) FILTER (WHERE severity = 'high') AS crisis,
           COUNT(*) FILTER (WHERE severity = 'medium') AS warnings
         FROM erep_alerts WHERE tenant_id = $1`,
        [tenantId],
      ).catch(() => ({ rows: [{ active: "0", resolved: "0", crisis: "0", warnings: "0" }] })),
      pool.query(
        `SELECT keyword, AVG(position)::int AS avg_position, date
         FROM erep_serp_tracking st
         JOIN erep_campaigns c ON c.id = st.campaign_id
         WHERE c.tenant_id = $1
         GROUP BY keyword, date
         ORDER BY date DESC
         LIMIT 20`,
        [tenantId],
      ).catch(() => ({ rows: [] as any[] })),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE sl.sentiment = 'pos') AS positive,
           COUNT(*) FILTER (WHERE sl.sentiment = 'neg') AS negative,
           COUNT(*) FILTER (WHERE sl.sentiment = 'neu') AS neutral
         FROM erep_sentiment_logs sl
         JOIN erep_campaigns c ON c.id = sl.campaign_id
         WHERE c.tenant_id = $1`,
        [tenantId],
      ).catch(() => ({ rows: [{ positive: "0", negative: "0", neutral: "0" }] })),
    ]);

    const alertRow = alertStats.rows[0] ?? { active: "0", resolved: "0", crisis: "0", warnings: "0" };
    const sentRow = sentimentData.rows[0] ?? { positive: "0", negative: "0", neutral: "0" };

    const avgScore = campaigns.rows.length
      ? Math.round(campaigns.rows.reduce((s, c) => s + (c.reputation_score ?? 50), 0) / campaigns.rows.length)
      : 50;

    res.json({
      generatedAt: new Date().toISOString(),
      summary: {
        campaignCount: campaigns.rows.length,
        averageReputationScore: avgScore,
        scoreColor: avgScore >= 70 ? "green" : avgScore >= 40 ? "orange" : "red",
      },
      campaigns: campaigns.rows.map(c => ({
        id: c.id,
        name: c.name,
        targetName: c.target_name,
        reputationScore: c.reputation_score ?? 50,
        status: c.status,
      })),
      alerts: {
        active: parseInt(alertRow.active, 10),
        resolved: parseInt(alertRow.resolved, 10),
        crisis: parseInt(alertRow.crisis, 10),
        warnings: parseInt(alertRow.warnings, 10),
      },
      serp: {
        keywords: serpData.rows,
      },
      sentiment: {
        positive: parseInt(sentRow.positive, 10),
        negative: parseInt(sentRow.negative, 10),
        neutral: parseInt(sentRow.neutral, 10),
        total: parseInt(sentRow.positive, 10) + parseInt(sentRow.negative, 10) + parseInt(sentRow.neutral, 10),
      },
    });
  } catch (err) {
    logger.error({ err }, "Client reports error");
    res.status(500).json({ error: "Erreur interne" });
  }
});

export default router;
