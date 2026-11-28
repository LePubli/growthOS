import { pool } from "@workspace/db";
import { logger } from "../logger";
import { campaignService } from "./CampaignService";

/**
 * Purge RGPD des campagnes visant une personne physique (B2C) dont la date de
 * fin de conservation est dépassée : suppression de la campagne et de toutes
 * ses données collectées, historique expurgé (voir CampaignService.deleteCampaign).
 *
 * Exécution : au démarrage puis toutes les 6 heures. Désactivée pendant les
 * tests de fumée (GROWTHOS_SMOKE_TEST=true) ; les tests appellent purgeExpiredPersonCampaigns().
 */
export async function purgeExpiredPersonCampaigns(tenantId?: string): Promise<{ purged: string[] }> {
  const { rows } = await pool.query<{ id: string; tenant_id: string }>(
    `SELECT id, tenant_id FROM erep_campaigns
      WHERE target_type = 'B2C' AND retention_until IS NOT NULL AND retention_until < CURRENT_DATE
        ${tenantId ? "AND tenant_id = $1" : ""}
      ORDER BY retention_until LIMIT 200`,
    tenantId ? [tenantId] : [],
  );
  const purged: string[] = [];
  for (const row of rows) {
    try {
      await campaignService.deleteCampaign(row.id, row.tenant_id, { email: "system:retention" }, "retention_purge");
      purged.push(row.id);
    } catch (error) {
      logger.warn({ campaignId: row.id, reason: error instanceof Error ? error.message : "unknown" }, "E-rep retention purge failed");
    }
  }
  if (purged.length) logger.info({ count: purged.length }, "E-rep expired person campaigns purged");
  return { purged };
}

export function startErepRetention(): void {
  if (process.env.GROWTHOS_SMOKE_TEST === "true") return;
  const run = () => void purgeExpiredPersonCampaigns().catch(error =>
    logger.warn({ reason: error instanceof Error ? error.name : "unknown" }, "E-rep retention unavailable"));
  run();
  setInterval(run, 6 * 60 * 60 * 1000).unref();
}
