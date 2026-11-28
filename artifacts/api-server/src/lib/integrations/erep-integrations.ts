/**
 * E-Réputation ↔ GrowthOS Interconnexion
 *
 * Branche le plugin E-Réputation sur le reste de la plateforme via l'EventBus :
 *   erep.score.updated   → met à jour le compte CRM d'une entité, mémoire IA
 *   erep.alert           → persiste une alerte historique non enregistrée + notification
 * Lot 3 : alertes, notifications et plans de crise sont gérés par AlertService ;
 * plus aucune écriture dans le fil « signals » de la prospection.
 */

import { pool } from "@workspace/db";
import { pluginEventBus } from "../plugin-runtime/event-bus";
import { memoryService } from "../plugin-growth-memory/MemoryService";
import { logger } from "../logger";
import { createNotification } from "../../services/notification.service";

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

// ──────────────────────────────────────────────────────────────────────────────
//  Enregistrement des listeners EventBus
// ──────────────────────────────────────────────────────────────────────────────

export function registerErepIntegrations(): void {
  // ── 1. erep.score.updated ──────────────────────────────────────────────────
  //      Déclenché par CampaignService.calculateReputationScore().
  //      Les alertes de score (seuil, baisse sur 7 jours) et les plans de crise
  //      sont gérés par AlertService (lot 3) : ici, seulement la mise à jour du
  //      compte CRM d'une entité et la mémoire IA.
  pluginEventBus.on<ErepScoreUpdatedPayload>(
    "erep.score.updated",
    PLUGIN_ID,
    async (p) => {
      logger.info({ campaignId: p.campaignId, score: p.newScore }, "erep.score.updated received");
      const kind = await pool.query<{ target_type: string }>(`SELECT target_type FROM erep_campaigns WHERE id = $1`, [p.campaignId]).catch(() => null);
      // Jamais de rapprochement par nom pour une personne physique.
      if (kind?.rows[0]?.target_type === "B2B") await updateAccountReputationScore(p.tenantId, p.targetName, p.newScore);

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
  //      Les alertes d'AlertService arrivent déjà enregistrées (persisted: true)
  //      et notifiées. Un émetteur historique sans enregistrement est persisté ici,
  //      sans écriture dans le fil « signals » de la prospection.
  pluginEventBus.on<ErepAlertPayload & { persisted?: boolean }>(
    "erep.alert",
    PLUGIN_ID,
    async (p) => {
      if (p.persisted) return;
      logger.info({ campaignId: p.campaignId, alertType: p.alertType }, "erep.alert received");
      const id = await persistAlert(p);
      if (id) {
        await createNotification({
          type: "signal", title: p.title, body: p.description, tenantId: p.tenantId,
          href: `/ereputation/watch?campaign=${p.campaignId}&tab=alerts`,
          payload: { module: "ereputation", campaignId: p.campaignId, alertId: id, severity: p.severity },
        });
      }
    },
  );

  logger.info({ events: ["erep.score.updated", "erep.alert"] }, "E-Réputation integrations registered on EventBus");
}
