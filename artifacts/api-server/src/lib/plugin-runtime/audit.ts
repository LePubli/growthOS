import { pool } from "@workspace/db";
import { logger } from "../logger";

export type PluginAuditAction =
  | "REGISTERED"
  | "ENABLED"
  | "DISABLED"
  | "ACTIVATION_SUCCEEDED"
  | "ACTIVATION_FAILED";

export interface AuditEntry {
  pluginId: string;
  pluginName: string;
  action: PluginAuditAction;
  actorUserId?: string;
  actorEmail?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLog {
  id: string;
  pluginId: string;
  pluginName: string;
  action: PluginAuditAction;
  actorUserId: string | null;
  actorEmail: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

/**
 * Write an audit log entry to plugin_audit_logs.
 * Fire-and-forget: errors are logged but never rethrown so they
 * cannot break the operation that triggered them.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO plugin_audit_logs
         (plugin_id, plugin_name, action, actor_user_id, actor_email, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        entry.pluginId,
        entry.pluginName,
        entry.action,
        entry.actorUserId ?? null,
        entry.actorEmail ?? null,
        JSON.stringify(entry.metadata ?? {}),
      ],
    );
  } catch (err) {
    logger.error({ err, entry }, "Failed to write plugin audit log");
  }
}

/**
 * Fetch audit logs, most recent first.
 * Optionally filter by pluginId.
 */
export async function fetchAuditLogs(opts: {
  pluginId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ logs: AuditLog[]; total: number }> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;

  const where = opts.pluginId ? `WHERE plugin_id = $3` : "";
  const params: unknown[] = opts.pluginId
    ? [limit, offset, opts.pluginId]
    : [limit, offset];

  const [rows, countRow] = await Promise.all([
    pool.query(
      `SELECT id, plugin_id, plugin_name, action,
              actor_user_id, actor_email, metadata, created_at
       FROM plugin_audit_logs
       ${where}
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      params,
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total FROM plugin_audit_logs ${where}`,
      opts.pluginId ? [opts.pluginId] : [],
    ),
  ]);

  return {
    logs: rows.rows.map((r) => ({
      id: r.id,
      pluginId: r.plugin_id,
      pluginName: r.plugin_name,
      action: r.action as PluginAuditAction,
      actorUserId: r.actor_user_id,
      actorEmail: r.actor_email,
      metadata: r.metadata ?? {},
      createdAt: r.created_at instanceof Date
        ? r.created_at.toISOString()
        : String(r.created_at),
    })),
    total: countRow.rows[0]?.total ?? 0,
  };
}
