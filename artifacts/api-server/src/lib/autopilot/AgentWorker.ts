/**
 * AgentWorker — Listener EventBus → AutopilotService
 * S'inscrit sur les événements clés et délègue l'évaluation au service.
 */

import { pluginEventBus } from "../plugin-runtime/event-bus";
import { autopilotService, type TriggerEvent } from "./AutopilotService";
import { pool } from "@workspace/db";
import { logger } from "../logger";

const WATCHED_EVENTS: TriggerEvent[] = [
  "signal.received",
  "erep.alert",
  "deal.stage_changed",
  "prospect.created",
  "sequence.email.sent",
  "meeting.completed",
];

/** Résout le tenantId depuis un payload d'événement */
function extractTenantId(payload: any): string | null {
  return payload?.tenantId ?? payload?.tenant_id ?? null;
}

/** Récupère tous les tenants actifs (pour les événements sans tenantId) */
async function getActiveTenantIds(): Promise<string[]> {
  try {
    const { rows } = await pool.query<{ id: string }>(
      `SELECT DISTINCT t.id FROM tenants t INNER JOIN users u ON u.tenant_id = t.id LIMIT 50`,
    );
    return rows.map(r => r.id);
  } catch {
    return [];
  }
}

export function startAgentWorker(): void {
  for (const event of WATCHED_EVENTS) {
    pluginEventBus.on(event, "autopilot-agent", async (payload: any) => {
      try {
        const tenantId = extractTenantId(payload);

        if (tenantId) {
          await autopilotService.evaluateAndExecute(event, tenantId, payload ?? {});
        } else {
          // Broadcast sur tous les tenants actifs (ex: événements système)
          const tenantIds = await getActiveTenantIds();
          for (const tid of tenantIds) {
            await autopilotService.evaluateAndExecute(event, tid, payload ?? {}).catch(
              err => logger.error({ err, tenantId: tid }, "AgentWorker: evaluate failed"),
            );
          }
        }
      } catch (err) {
        logger.error({ err, event }, "AgentWorker: event handler failed");
      }
    });
  }

  logger.info({ events: WATCHED_EVENTS }, "AgentWorker: started — listening on EventBus");
}
