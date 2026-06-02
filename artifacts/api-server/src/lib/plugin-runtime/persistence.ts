import { pool } from "@workspace/db";
import { logger } from "../logger";

/**
 * Persist a plugin's state to the database so it survives server restarts.
 * Fire-and-forget — errors are logged but never thrown.
 */
export async function savePluginState(
  pluginId: string,
  state: "ACTIVE" | "DISABLED",
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO plugin_states (plugin_id, state, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (plugin_id) DO UPDATE SET state = $2, updated_at = NOW()`,
      [pluginId, state],
    );
  } catch (err) {
    logger.warn({ pluginId, state, err }, "Could not persist plugin state");
  }
}

/**
 * Return plugin IDs that were explicitly DISABLED in the DB.
 * Used at boot to restore the previous disabled state.
 */
export async function loadDisabledPluginIds(): Promise<string[]> {
  try {
    const result = await pool.query<{ plugin_id: string }>(
      `SELECT plugin_id FROM plugin_states WHERE state = 'DISABLED'`,
    );
    return result.rows.map((r) => r.plugin_id);
  } catch (err) {
    logger.warn({ err }, "Could not load persisted plugin states — starting fresh");
    return [];
  }
}
