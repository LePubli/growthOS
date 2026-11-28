import { pool } from "@workspace/db";
type PoolClient = { query: typeof pool.query };

/**
 * Historique des interventions e-réputation (« qui a modifié quoi, et quand »).
 *
 * - Écrit dans la même transaction que la modification qu'il décrit.
 * - Conservé après suppression d'une campagne (pas de clé étrangère).
 * - Pour une personne physique, les valeurs sont expurgées lors de la
 *   suppression ou de la purge RGPD : l'acte reste tracé, pas la donnée.
 */

export interface ChangeActor {
  userId?: string | null;
  email?: string | null;
}

export type ChangeAction = "create" | "update" | "status" | "delete" | "retention_purge" | "crisis_open" | "crisis_escalate" | "crisis_close";

export interface ChangeEntry {
  id: string;
  campaignId: string;
  action: ChangeAction;
  actor: { userId: string | null; email: string | null };
  changes: Record<string, { before: unknown; after: unknown }>;
  redacted: boolean;
  createdAt: string;
}

const REDACTED = "[données personnelles purgées]";

export const changeLog = {
  async record(client: PoolClient, entry: {
    tenantId: string; campaignId: string; actor?: ChangeActor; action: ChangeAction;
    changes: Record<string, { before: unknown; after: unknown }>; redacted?: boolean;
  }): Promise<void> {
    await client.query(
      `INSERT INTO erep_change_log (tenant_id, campaign_id, actor_user_id, actor_email, action, changes, redacted)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [entry.tenantId, entry.campaignId, entry.actor?.userId ?? null, entry.actor?.email ?? null,
        entry.action, JSON.stringify(entry.changes), entry.redacted ?? false],
    );
  },

  /** Remplace toutes les valeurs avant/après par un marqueur, en gardant les noms de champs et les dates. */
  async redactCampaign(client: PoolClient, tenantId: string, campaignId: string): Promise<void> {
    await client.query(
      `UPDATE erep_change_log l
          SET changes = COALESCE((
                SELECT jsonb_object_agg(k, jsonb_build_object(
                  'before', CASE WHEN v->'before' = 'null'::jsonb THEN 'null'::jsonb ELSE to_jsonb($3::text) END,
                  'after',  CASE WHEN v->'after'  = 'null'::jsonb THEN 'null'::jsonb ELSE to_jsonb($3::text) END))
                FROM jsonb_each(l.changes) AS e(k, v)), '{}'::jsonb),
              redacted = true
        WHERE l.tenant_id = $1 AND l.campaign_id = $2 AND NOT l.redacted`,
      [tenantId, campaignId, REDACTED],
    );
  },

  async list(tenantId: string, campaignId: string, limit = 200): Promise<ChangeEntry[]> {
    const { rows } = await pool.query(
      `SELECT id, campaign_id, action, actor_user_id, actor_email, changes, redacted, created_at
         FROM erep_change_log WHERE tenant_id = $1 AND campaign_id = $2
        ORDER BY created_at DESC, id DESC LIMIT $3`,
      [tenantId, campaignId, Math.min(Math.max(limit, 1), 500)],
    );
    return rows.map(r => ({
      id: r.id, campaignId: r.campaign_id, action: r.action,
      actor: { userId: r.actor_user_id, email: r.actor_email },
      changes: r.changes ?? {}, redacted: r.redacted,
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    }));
  },
};
