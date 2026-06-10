/**
 * E-Réputation ↔ GrowthOS Interconnexion
 *
 * Branche le plugin E-Réputation sur le reste de la plateforme via l'EventBus :
 *   erep.score.updated   → stocke en erep_alerts si score critique, met à jour accounts
 *   erep.alert           → crée un signal dans signals + notification
 *   signal.received      → (erep) persiste en signal réputationnel dans la table signals
 */

import { pool } from "@workspace/db";
import { pluginEventBus } from "../plugin-runtime/event-bus";
import { memoryService } from "../plugin-growth-memory/MemoryService";
import { logger } from "../logger";

const PLUGIN_ID = "erep-integrations";

// ──────────────────────────────────────────────────────────────────────────────
//  Types des événements
// ──────────────────────────────────────────────────────────────────────────────

export interface ErepScoreUpdatedPayload {
  campaignId: string;
  tenantId: string;
  targetName: string;
  previousScore: number;
  newScore: number;
}

export interface ErepAlertPayload {
  campaignId: string;
  tenantId: string;
  targetName: string;
  alertType: "crisis" | "warning" | "score_drop" | "serp_drop";
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  score: number;
}

export interface SignalReceivedPayload {
  type: string;
  company: string;
  title: string;
  description: string;
  impactScore: number;
  metadata?: Record<string, unknown>;
  tenantId?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
//  Helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Persiste une alerte E-Rep dans erep_alerts. */
async function persistAlert(payload: ErepAlertPayload): Promise<string | null> {
  try {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO erep_alerts
         (campaign_id, tenant_id, type, severity, title, description, score)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        payload.campaignId,
        payload.tenantId,
        payload.alertType,
        payload.severity,
        payload.title,
        payload.description,
        payload.score,
      ],
    );
    return rows[0]?.id ?? null;
  } catch (err) {
    logger.warn({ err }, "erep_alerts insert failed — table may not be ready yet");
    return null;
  }
}

/** Crée un signal réputationnel dans la table signals (rattaché au tenant). */
async function createReputationSignal(
  tenantId: string,
  company: string,
  title: string,
  description: string,
  score: number,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO signals
         (tenant_id, type, company, title, description, score, is_read, is_starred, detected_at)
       VALUES ($1, 'reputation_crisis', $2, $3, $4, $5, false, false, NOW())`,
      [tenantId, company, title, description, Math.min(100, score)],
    );
    logger.info({ tenantId, company, title }, "Reputation signal persisted in signals table");
  } catch (err) {
    logger.warn({ err }, "Could not create reputation signal in signals table");
  }
}

/** Met à jour le score de réputation moyen sur accounts pour le tenant. */
async function updateAccountReputationScore(tenantId: string, targetName: string, score: number): Promise<void> {
  try {
    // Tente de mettre à jour le compte correspondant
    await pool.query(
      `UPDATE accounts
       SET reputation_health_score = $1, updated_at = NOW()
       WHERE tenant_id = $2 AND (name ILIKE $3 OR domain ILIKE $4)`,
      [score, tenantId, `%${targetName}%`, `%${targetName.toLowerCase().replace(/\s+/g, "")}%`],
    );
  } catch {
    // Column may not exist yet — migration adds it
  }
}

/** Émet une notification temps réel pour un tenant. */
async function createNotification(
  tenantId: string,
  type: string,
  title: string,
  message: string,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO notifications (tenant_id, type, title, message, read)
       VALUES ($1, $2, $3, $4, false)`,
      [tenantId, type, title, message],
    );
  } catch {
    // notifications table may not have these columns — non-fatal
  }
}

// ──────────────────────────────────────────────────────────────────────────────
//  Enregistrement des listeners EventBus
// ──────────────────────────────────────────────────────────────────────────────

export function registerErepIntegrations(): void {
  // ── 1. erep.score.updated ──────────────────────────────────────────────────
  //      Déclenché par CampaignService.calculateReputationScore()
  //      • Score < 40 → alerte critique + signal
  //      • Chute > 10 points → alerte warning
  //      • Met à jour le compte correspondant dans accounts
  pluginEventBus.on<ErepScoreUpdatedPayload>(
    "erep.score.updated",
    PLUGIN_ID,
    async (p) => {
      logger.info({ campaignId: p.campaignId, score: p.newScore }, "erep.score.updated received");

      // Mise à jour du score sur accounts
      await updateAccountReputationScore(p.tenantId, p.targetName, p.newScore);

      // Score critique < 40 → alert HIGH
      if (p.newScore < 40) {
        await persistAlert({
          campaignId: p.campaignId,
          tenantId: p.tenantId,
          targetName: p.targetName,
          alertType: "crisis",
          severity: "high",
          title: `Réputation critique pour ${p.targetName} (score ${p.newScore}/100)`,
          description: `Le score de réputation est tombé à ${p.newScore}/100. Action urgente recommandée.`,
          score: p.newScore,
        });

        await createReputationSignal(
          p.tenantId,
          p.targetName,
          `Crise réputationnelle : ${p.targetName} — score ${p.newScore}/100`,
          `Le score E-Rep de ${p.targetName} est critique (${p.newScore}/100). Action immédiate recommandée.`,
          p.newScore,
        );

        await createNotification(
          p.tenantId,
          "erep_crisis",
          `⚠️ Score E-Rep critique : ${p.targetName}`,
          `Score tombé à ${p.newScore}/100 — action urgente recommandée.`,
        );
      } else if (p.previousScore - p.newScore >= 10) {
        // Chute significative → warning
        await persistAlert({
          campaignId: p.campaignId,
          tenantId: p.tenantId,
          targetName: p.targetName,
          alertType: "score_drop",
          severity: "medium",
          title: `Chute de réputation pour ${p.targetName} (-${p.previousScore - p.newScore} pts)`,
          description: `Score passé de ${p.previousScore} à ${p.newScore} (-${p.previousScore - p.newScore} pts). Surveillance accrue recommandée.`,
          score: p.newScore,
        });

        await createNotification(
          p.tenantId,
          "erep_warning",
          `Score E-Rep en baisse : ${p.targetName}`,
          `Score passé de ${p.previousScore} à ${p.newScore}/100.`,
        );
      }

      // Indexer en mémoire si variation significative
      if (Math.abs(p.previousScore - p.newScore) >= 5) {
        await memoryService.indexDocument({
          sourceType: "erep_score_change",
          sourceId: `${p.campaignId}-${Date.now()}`,
          content: `Score E-Rep de ${p.targetName} : ${p.previousScore} → ${p.newScore}. ${p.newScore < p.previousScore ? "Dégradation" : "Amélioration"} de ${Math.abs(p.newScore - p.previousScore)} points.`,
          tenantId: p.tenantId,
          metadata: { campaignId: p.campaignId, targetName: p.targetName, previousScore: p.previousScore, newScore: p.newScore },
        }).catch(() => {});
      }
    },
  );

  // ── 2. erep.alert ──────────────────────────────────────────────────────────
  //      Déclenché par CampaignService (SERP drop, nouveaux audits, etc.)
  //      • Persiste en erep_alerts + signal dans signals table
  pluginEventBus.on<ErepAlertPayload>(
    "erep.alert",
    PLUGIN_ID,
    async (p) => {
      logger.info({ campaignId: p.campaignId, alertType: p.alertType }, "erep.alert received");

      await persistAlert(p);

      // Toutes les alertes HIGH deviennent des signaux
      if (p.severity === "high") {
        await createReputationSignal(
          p.tenantId,
          p.targetName,
          p.title,
          p.description,
          p.score,
        );
      }

      await createNotification(
        p.tenantId,
        `erep_${p.alertType}`,
        p.title,
        p.description,
      );
    },
  );

  // ── 3. signal.received (type=reputation_crisis) ───────────────────────────
  //      Émis par CampaignService.addSentimentLog() sur mention très négative.
  //      • On persiste le signal dans signals table avec tenant lookup
  //      • On crée une alerte dans erep_alerts
  pluginEventBus.on<SignalReceivedPayload>(
    "signal.received",
    PLUGIN_ID,
    async (p) => {
      if (p.type !== "reputation_crisis") return; // Ignorer les autres types

      logger.info({ company: p.company }, "signal.received (reputation_crisis) intercepted by erep-integrations");

      const metadata = p.metadata as Record<string, unknown> | undefined;
      const campaignId = metadata?.campaignId as string | undefined;

      if (!campaignId) return;

      // Lookup tenant depuis la campagne
      let tenantId = p.tenantId;
      if (!tenantId) {
        try {
          const { rows } = await pool.query<{ tenant_id: string }>(
            `SELECT tenant_id FROM erep_campaigns WHERE id = $1`,
            [campaignId],
          );
          tenantId = rows[0]?.tenant_id;
        } catch { return; }
      }

      if (!tenantId) return;

      // Persiste le signal réputationnel
      await createReputationSignal(
        tenantId,
        p.company,
        p.title,
        p.description ?? "",
        p.impactScore,
      );

      // Crée une alerte E-Rep
      await persistAlert({
        campaignId,
        tenantId,
        targetName: p.company,
        alertType: "crisis",
        severity: "high",
        title: p.title,
        description: p.description ?? "Crise réputationnelle détectée via analyse de sentiment.",
        score: Math.max(0, 50 - p.impactScore * 0.5),
      }).catch(() => {});

      // Notification temps réel
      await createNotification(
        tenantId,
        "erep_crisis",
        `🚨 Crise réputationnelle : ${p.company}`,
        p.title,
      ).catch(() => {});
    },
  );

  logger.info(
    { events: ["erep.score.updated", "erep.alert", "signal.received"] },
    "E-Réputation integrations registered on EventBus",
  );
}
