import {startProspectEnrichments} from './services/prospect-enrichment';
import { startProspectWatch } from './services/prospect-monitoring';
import {startCloudJobs} from './services/cloud-browser';
import app from "./app";
import { logger } from "./lib/logger";
import { runMigrations, runSourcingMigration, runNotificationsMigration, runProspectGeoMigration, runEnrichmentMigration, runEreputationMigration, runTasksMigration, runEnterpriseMigration, runSaaSMigration, runErepIntegrationsMigration, runRBACMigration, runPlansMigration, runProviderKeysMigration, runAutopilotMigration, runDealProspectLinkMigration, runSignalEnhanceMigration, runDiagnosticsMigration } from "@workspace/db";
import { seedBuiltInPlugins } from "./lib/plugin-runtime/seed-plugins";
import { registerErepIntegrations } from "./lib/integrations/erep-integrations";
import { registerCrossPluginEvents } from "./lib/integrations/cross-plugin-events";
import { startSignalCron } from "./lib/cron/SignalCron";
import { startAgentWorker } from "./lib/autopilot/AgentWorker";
import { startDiagnosticsRetention } from './lib/diagnostics';
import { runEreputationFoundationsMigration } from "@workspace/db";
import { startErepRetention } from "./lib/plugin-ereputation/RetentionService";
import { startErepWatch } from "./lib/plugin-ereputation/WatchService";
import { startErepAlerts } from "./lib/plugin-ereputation/ErepDigest";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

runMigrations()
  .then(async () => {
    logger.info("Database migrations applied");

    // Run DDL in a stable order. Parallel schema migrations can race on
    // shared tables and make the first Docker startup fail intermittently.
    await runSourcingMigration();
    await runNotificationsMigration();
    await runProspectGeoMigration();
    await runEnrichmentMigration();
    await runEreputationMigration();
    await runTasksMigration();
    await runEnterpriseMigration();
    logger.info("All tables ready (sourcing, notifications, geo, enrichment, ereputation, tasks, enterprise)");

    await runSaaSMigration();
    logger.info("SaaS tables ready (billing, mentions, webhook_logs, analytics_events)");

    await runErepIntegrationsMigration();
    logger.info("E-Rep integration tables ready (erep_alerts, erep_approvals, accounts.reputation_health_score)");

    await runEreputationFoundationsMigration();
    logger.info("E-Rep foundations ready (subject, GDPR mandate, erep_change_log)");

    await runRBACMigration();
    logger.info("RBAC tables ready (rbac_roles, rbac_permissions, rbac_user_roles, users.is_active)");

    await runPlansMigration();
    logger.info("Plans tables ready (plans x3 defaults, subscriptions updated)");

    await runProviderKeysMigration();
    logger.info("Provider API keys table ready (provider_api_keys)");

    await runAutopilotMigration();
    logger.info("Autopilot tables ready (autopilot_rules, autopilot_logs)");

    await runDealProspectLinkMigration();
    logger.info("Deal prospect link ready (deals.prospect_id)");

    await runSignalEnhanceMigration();
    logger.info("Signal enhance ready (signals.source, signals.prospect_id)");

    await runDiagnosticsMigration();
    logger.info("Diagnostics ready (tenant-isolated diagnostic_events)");

    await seedBuiltInPlugins();

    // ── Register cross-plugin EventBus integrations
    registerErepIntegrations();
    registerCrossPluginEvents();

    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");

      // ── Démarrer le cron de génération de signaux (toutes les 2h)
      startSignalCron();
      startProspectWatch();
      startCloudJobs();
      startProspectEnrichments();
      startDiagnosticsRetention();
      startErepRetention();
      startErepWatch();
      startErepAlerts();

      // ── Démarrer l'AgentWorker (Autopilot IA)
      startAgentWorker();
    });
  })
  .catch((err) => {
    logger.error({ err }, "Failed to apply database migrations");
    process.exit(1);
  });
