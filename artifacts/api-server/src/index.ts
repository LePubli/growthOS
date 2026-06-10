import app from "./app";
import { logger } from "./lib/logger";
import { runMigrations, runSourcingMigration, runNotificationsMigration, runProspectGeoMigration, runEnrichmentMigration, runEreputationMigration, runTasksMigration, runEnterpriseMigration, runSaaSMigration, runErepIntegrationsMigration } from "@workspace/db";
import { seedBuiltInPlugins } from "./lib/plugin-runtime/seed-plugins";
import { registerErepIntegrations } from "./lib/integrations/erep-integrations";

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

    await Promise.all([runSourcingMigration(), runNotificationsMigration(), runProspectGeoMigration(), runEnrichmentMigration(), runEreputationMigration(), runTasksMigration(), runEnterpriseMigration()]);
    logger.info("All tables ready (sourcing, notifications, geo, enrichment, ereputation, tasks, enterprise)");

    await runSaaSMigration();
    logger.info("SaaS tables ready (billing, mentions, webhook_logs, analytics_events)");

    await runErepIntegrationsMigration();
    logger.info("E-Rep integration tables ready (erep_alerts, erep_approvals, accounts.reputation_health_score)");

    await seedBuiltInPlugins();

    // ── Register cross-plugin EventBus integrations
    registerErepIntegrations();

    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
    });
  })
  .catch((err) => {
    logger.error({ err }, "Failed to apply database migrations");
    process.exit(1);
  });
