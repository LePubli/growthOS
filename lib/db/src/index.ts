import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export * from "./schema";
export { runMigrations, runPluginStateMigration, runGrowthMemoryMigration, runMeetingIntelligenceMigration, runAccountIntelligenceMigration, runSignalIntelligenceMigration, runDealCoachMigration, runKnowledgeBaseMigration, runSourcingMigration, runNotificationsMigration, runProspectGeoMigration, runEnrichmentMigration, runEreputationMigration, runTasksMigration, runEnterpriseMigration, runSaaSMigration, runErepIntegrationsMigration, runRBACMigration, runPlansMigration, runProviderKeysMigration, runAutopilotMigration, runDealProspectLinkMigration, runSignalEnhanceMigration } from "./migrate";
