/**
 * Cross-Plugin EventBus — Interconnexion totale des plugins GrowthOS
 *
 * Événements gérés :
 *   prospect.created      → Growth Memory index, webhook, notification
 *   deal.stage.changed    → Revenue forecast invalidation, webhook, notification
 *   signal.detected       → Notification, Account Health Score update
 *   sequence.email.sent   → Activité CRM, stats séquence
 *   meeting.completed     → Indexation mémoire, activité CRM
 */

import { pool } from "@workspace/db";
import { pluginEventBus } from "../plugin-runtime/event-bus";
import { memoryService } from "../plugin-growth-memory/MemoryService";
import { logger } from "../logger";

const PLUGIN_ID = "cross-plugin-integrations";

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function createNotification(
  tenantId: string,
  type: string,
  title: string,
  message: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO notifications (tenant_id, type, title, message, read)
       VALUES ($1, $2, $3, $4, false)`,
      [tenantId, type, title, message],
    );
  } catch { /* non-fatal */ }
}

async function sendWebhooksForEvent(
  tenantId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const { rows: webhooks } = await pool.query(
      `SELECT id, url, secret FROM webhooks
       WHERE tenant_id = $1 AND is_active = true AND events @> ARRAY[$2]::text[]`,
      [tenantId, eventType],
    );
    if (webhooks.length === 0) return;

    const body = JSON.stringify({ event: eventType, data: payload, timestamp: new Date().toISOString() });

    for (const wh of webhooks) {
      try {
        const { createHmac } = await import("node:crypto");
        const sig = wh.secret ? `sha256=${createHmac("sha256", wh.secret).update(body).digest("hex")}` : "";
        const resp = await fetch(wh.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(sig ? { "X-GrowthOS-Signature": sig } : {}) },
          body,
          signal: AbortSignal.timeout(5000),
        });
        await pool.query(
          `INSERT INTO webhook_logs (webhook_id, event_type, status_code, response_body, sent_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT DO NOTHING`,
          [wh.id, eventType, resp.status, null],
        ).catch(() => {});
      } catch (err) {
        logger.warn({ err, webhookId: wh.id }, "Webhook delivery failed");
      }
    }
  } catch (err) {
    logger.warn({ err }, "sendWebhooksForEvent error");
  }
}

async function updateAccountHealthScore(tenantId: string, company: string): Promise<void> {
  try {
    // Recalcule un score simplifié basé sur activités récentes + signaux
    await pool.query(
      `UPDATE accounts
       SET health_score = LEAST(100, GREATEST(0, (
         (SELECT COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') FROM activities
          WHERE prospect_id IN (SELECT id FROM prospects WHERE tenant_id = $1 AND company ILIKE $2)) * 5
         +
         (SELECT COUNT(*) FROM signals WHERE tenant_id = $1 AND company ILIKE $2 AND created_at > NOW() - INTERVAL '30 days') * 3
         + 50
       )::int)),
       updated_at = NOW()
       WHERE tenant_id = $1 AND name ILIKE $2`,
      [tenantId, `%${company}%`],
    ).catch(() => {});
  } catch { /* non-fatal */ }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Enregistrement des listeners
// ─────────────────────────────────────────────────────────────────────────────

export function registerCrossPluginEvents(): void {

  // ── 1. prospect.created ────────────────────────────────────────────────────
  pluginEventBus.on(
    "prospect.created",
    PLUGIN_ID,
    async (p: { prospectId: string; tenantId: string; company: string; email: string; name: string }) => {
      logger.info({ prospectId: p.prospectId }, "prospect.created cross-plugin");

      await Promise.allSettled([
        // Index en mémoire
        memoryService.indexDocument({
          sourceType: "prospect_created",
          sourceId: p.prospectId,
          content: `Nouveau prospect : ${p.name} chez ${p.company} (${p.email}).`,
          tenantId: p.tenantId,
          metadata: { prospectId: p.prospectId, company: p.company },
        }),

        // Notification
        createNotification(
          p.tenantId,
          "prospect_created",
          `Nouveau prospect : ${p.name}`,
          `${p.name} (${p.company}) vient d'être ajouté.`,
        ),

        // Webhook
        sendWebhooksForEvent(p.tenantId, "prospect.created", {
          id: p.prospectId,
          name: p.name,
          company: p.company,
          email: p.email,
        }),
      ]);
    },
  );

  // ── 2. deal.stage.changed ──────────────────────────────────────────────────
  pluginEventBus.on(
    "deal.stage.changed",
    PLUGIN_ID,
    async (p: {
      dealId: string; tenantId: string; title: string;
      previousStage: string; newStage: string; value: number;
    }) => {
      logger.info({ dealId: p.dealId, from: p.previousStage, to: p.newStage }, "deal.stage.changed cross-plugin");

      const isWon = p.newStage === "won";
      const isLost = p.newStage === "lost";

      await Promise.allSettled([
        // Notification
        createNotification(
          p.tenantId,
          "deal_stage_changed",
          `Deal ${isWon ? "gagné 🎉" : isLost ? "perdu" : "mis à jour"} : ${p.title}`,
          `${p.title} : ${p.previousStage} → ${p.newStage}${isWon ? ` (+${p.value?.toLocaleString("fr-FR")}€)` : ""}`,
        ),

        // Indexation mémoire si Won/Lost
        (isWon || isLost) && memoryService.indexDocument({
          sourceType: isWon ? "deal_won" : "deal_lost",
          sourceId: p.dealId,
          content: `Deal ${isWon ? "remporté" : "perdu"} : ${p.title}. Valeur : ${p.value}€. Étape précédente : ${p.previousStage}.`,
          tenantId: p.tenantId,
          metadata: { dealId: p.dealId, stage: p.newStage, value: p.value },
        }),

        // Webhook
        sendWebhooksForEvent(p.tenantId, "deal.stage.changed", {
          id: p.dealId,
          title: p.title,
          previousStage: p.previousStage,
          newStage: p.newStage,
          value: p.value,
        }),
      ]);
    },
  );

  // ── 3. signal.detected ────────────────────────────────────────────────────
  pluginEventBus.on(
    "signal.detected",
    PLUGIN_ID,
    async (p: {
      signalId: string; tenantId: string; company: string;
      type: string; title: string; score: number;
    }) => {
      logger.info({ signalId: p.signalId, company: p.company }, "signal.detected cross-plugin");

      await Promise.allSettled([
        // Notification si score élevé
        p.score >= 70 && createNotification(
          p.tenantId,
          "signal_high",
          `Signal prioritaire : ${p.company}`,
          `${p.title} — score ${p.score}/100`,
        ),

        // Mise à jour health score du compte
        updateAccountHealthScore(p.tenantId, p.company),

        // Webhook
        sendWebhooksForEvent(p.tenantId, "signal.detected", {
          id: p.signalId,
          company: p.company,
          type: p.type,
          title: p.title,
          score: p.score,
        }),
      ]);
    },
  );

  // ── 4. sequence.email.sent ────────────────────────────────────────────────
  pluginEventBus.on(
    "sequence.email.sent",
    PLUGIN_ID,
    async (p: {
      sequenceId: string; tenantId: string; prospectId: string;
      prospectEmail: string; stepIndex: number;
    }) => {
      logger.info({ sequenceId: p.sequenceId, step: p.stepIndex }, "sequence.email.sent cross-plugin");

      // Créer activité CRM (email)
      try {
        await pool.query(
          `INSERT INTO activities (tenant_id, prospect_id, type, title, description)
           VALUES ($1, $2, 'email', 'Email de séquence envoyé', $3)`,
          [p.tenantId, p.prospectId, `Étape ${p.stepIndex + 1} de la séquence ${p.sequenceId} envoyée à ${p.prospectEmail}.`],
        ).catch(() => {});
      } catch { /* non-fatal */ }
    },
  );

  // ── 5. meeting.completed ──────────────────────────────────────────────────
  pluginEventBus.on(
    "meeting.completed",
    PLUGIN_ID,
    async (p: {
      meetingId: string; tenantId: string; title: string;
      summary?: string; prospectId?: string;
    }) => {
      logger.info({ meetingId: p.meetingId }, "meeting.completed cross-plugin");

      await Promise.allSettled([
        // Indexation mémoire
        p.summary && memoryService.indexDocument({
          sourceType: "meeting_summary",
          sourceId: p.meetingId,
          content: `Réunion : ${p.title}. Résumé : ${p.summary}`,
          tenantId: p.tenantId,
          metadata: { meetingId: p.meetingId, prospectId: p.prospectId },
        }),

        // Activité CRM
        p.prospectId && pool.query(
          `INSERT INTO activities (tenant_id, prospect_id, type, title, description)
           VALUES ($1, $2, 'meeting', $3, $4)`,
          [p.tenantId, p.prospectId, p.title, p.summary ?? "Réunion complétée."],
        ).catch(() => {}),
      ]);
    },
  );

  logger.info(
    { events: ["prospect.created","deal.stage.changed","signal.detected","sequence.email.sent","meeting.completed"] },
    "Cross-plugin integrations registered on EventBus",
  );
}
