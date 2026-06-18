/**
 * SignalCron — Génération automatique de signaux depuis les sources RSS
 * Fréquence : toutes les 2h par défaut (configurable via env SIGNAL_CRON_INTERVAL_MS)
 * Démarre automatiquement au boot du serveur pour tous les tenants actifs.
 */

import { pool } from "@workspace/db";
import { signalGeneratorService } from "../signals/SignalGeneratorService";
import { providerKeysService } from "../provider-keys/ProviderKeysService";
import { logger } from "../logger";

const INTERVAL_MS = Number(process.env.SIGNAL_CRON_INTERVAL_MS ?? 2 * 60 * 60 * 1000); // 2h
const MAX_TENANTS_PER_TICK = 10; // Limiter le nombre de tenants traités par tick

let cronHandle: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

/* ─── Tick principal ────────────────────────────────────────── */

async function tick(): Promise<void> {
  if (isRunning) {
    logger.debug("SignalCron: tick skipped (previous still running)");
    return;
  }

  isRunning = true;
  const start = Date.now();

  try {
    // Récupérer les tenants actifs (ceux qui ont au moins un utilisateur)
    const { rows: tenants } = await pool.query<{ id: string; name: string }>(
      `SELECT DISTINCT t.id, t.name
       FROM tenants t
       INNER JOIN users u ON u.tenant_id = t.id
       ORDER BY t.name
       LIMIT $1`,
      [MAX_TENANTS_PER_TICK],
    );

    if (tenants.length === 0) {
      logger.debug("SignalCron: no active tenants");
      return;
    }

    logger.info({ tenants: tenants.length }, "SignalCron: tick started");

    let totalInserted = 0;

    for (const tenant of tenants) {
      try {
        // Vérifier si une clé SerpAPI est configurée pour ce tenant
        const serpKey = await providerKeysService.getKey(tenant.id, "serpapi").catch(() => null);

        const config = serpKey
          ? { sourceType: "serpapi" as const, apiKey: serpKey.apiKey, maxResults: 10 }
          : { sourceType: "rss" as const, maxResults: 8 };

        const result = await signalGeneratorService.generate(tenant.id, config);
        totalInserted += result.inserted;

        if (result.inserted > 0) {
          logger.info(
            { tenantId: tenant.id, tenantName: tenant.name, inserted: result.inserted, source: result.source },
            "SignalCron: signals generated",
          );
        }
      } catch (err) {
        logger.error({ err, tenantId: tenant.id }, "SignalCron: tenant tick failed");
      }
    }

    logger.info(
      { totalInserted, tenants: tenants.length, durationMs: Date.now() - start },
      "SignalCron: tick completed",
    );
  } catch (err) {
    logger.error({ err }, "SignalCron: tick error");
  } finally {
    isRunning = false;
  }
}

/* ─── API publique ────────────────────────────────────────────── */

export function startSignalCron(): void {
  if (cronHandle) {
    logger.warn("SignalCron: already started");
    return;
  }

  logger.info(
    { intervalMs: INTERVAL_MS, intervalHours: (INTERVAL_MS / 3600000).toFixed(1) },
    "SignalCron: starting",
  );

  // Premier tick après 30 secondes (laisser le serveur démarrer)
  setTimeout(() => tick().catch(err => logger.error({ err }, "SignalCron: first tick failed")), 30_000);

  cronHandle = setInterval(() => {
    tick().catch(err => logger.error({ err }, "SignalCron: scheduled tick failed"));
  }, INTERVAL_MS);

  // Permettre au process de se terminer proprement même si le cron tourne
  if (cronHandle.unref) cronHandle.unref();
}

export function stopSignalCron(): void {
  if (cronHandle) {
    clearInterval(cronHandle);
    cronHandle = null;
    logger.info("SignalCron: stopped");
  }
}

/** Forcer un tick immédiat (via admin API) */
export async function triggerSignalCron(): Promise<{ inserted: number; tenants: number }> {
  if (isRunning) return { inserted: 0, tenants: 0 };
  await tick();
  return { inserted: 0, tenants: 0 }; // result tracked internally
}
