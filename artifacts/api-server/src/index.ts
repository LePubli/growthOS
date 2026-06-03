import app from "./app";
import { logger } from "./lib/logger";
import { runMigrations, runSourcingMigration, runNotificationsMigration } from "@workspace/db";
import { seedBuiltInPlugins } from "./lib/plugin-runtime/seed-plugins";

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

    await Promise.all([runSourcingMigration(), runNotificationsMigration()]);
    logger.info("Sourcing and notifications tables ready");

    await seedBuiltInPlugins();

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
