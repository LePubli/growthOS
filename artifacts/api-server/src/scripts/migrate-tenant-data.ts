/**
 * Script de migration : assigne un tenant_id aux données orphelines.
 * Usage : pnpm tsx src/scripts/migrate-tenant-data.ts [--tenant-id <uuid>] [--dry-run]
 */
import { pool } from "@workspace/db";

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const tenantIdArg = args[args.indexOf("--tenant-id") + 1];

async function getDefaultTenantId(): Promise<string> {
  if (tenantIdArg) return tenantIdArg;
  const res = await pool.query(
    `SELECT id, slug FROM tenants ORDER BY created_at ASC LIMIT 1`,
  );
  if (res.rows.length === 0) throw new Error("Aucun tenant trouvé en base.");
  const tenant = res.rows[0];
  console.log(`→ Tenant par défaut : ${tenant.slug} (${tenant.id})`);
  return tenant.id;
}

interface TableConfig {
  table: string;
  tenantCol: string;
  label: string;
}

const TABLES: TableConfig[] = [
  { table: "prospects", tenantCol: "tenant_id", label: "Prospects" },
  { table: "deals", tenantCol: "tenant_id", label: "Deals (pipeline)" },
  { table: "signals", tenantCol: "tenant_id", label: "Signaux d'intention" },
  { table: "activities", tenantCol: "tenant_id", label: "Activités" },
  { table: "sequences", tenantCol: "tenant_id", label: "Séquences email" },
  { table: "tasks", tenantCol: "tenant_id", label: "Tâches" },
  { table: "webhooks", tenantCol: "tenant_id", label: "Webhooks" },
  { table: "workflows", tenantCol: "tenant_id", label: "Workflows" },
  { table: "sourcing_jobs", tenantCol: "tenant_id", label: "Jobs de sourcing" },
  { table: "api_keys", tenantCol: "tenant_id", label: "Clés API" },
  { table: "growth_memories", tenantCol: "tenant_id", label: "Growth Memory" },
  { table: "ereputation_campaigns", tenantCol: "tenant_id", label: "Campagnes e-réputation" },
];

interface MigrationResult {
  table: string;
  label: string;
  orphaned: number;
  updated: number;
  error?: string;
}

async function tableExists(tableName: string): Promise<boolean> {
  const res = await pool.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    )`,
    [tableName],
  );
  return res.rows[0].exists;
}

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const res = await pool.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
    )`,
    [tableName, columnName],
  );
  return res.rows[0].exists;
}

async function migrateTable(
  config: TableConfig,
  tenantId: string,
): Promise<MigrationResult> {
  const { table, tenantCol, label } = config;

  if (!(await tableExists(table))) {
    return { table, label, orphaned: 0, updated: 0, error: "Table inexistante (ignorée)" };
  }
  if (!(await columnExists(table, tenantCol))) {
    return { table, label, orphaned: 0, updated: 0, error: `Colonne ${tenantCol} absente` };
  }

  const orphanRes = await pool.query(
    `SELECT COUNT(*) AS n FROM ${table} WHERE ${tenantCol} IS NULL`,
  );
  const orphaned = parseInt(orphanRes.rows[0].n, 10);

  if (orphaned === 0) {
    return { table, label, orphaned: 0, updated: 0 };
  }

  if (isDryRun) {
    return { table, label, orphaned, updated: 0 };
  }

  const updateRes = await pool.query(
    `UPDATE ${table} SET ${tenantCol} = $1 WHERE ${tenantCol} IS NULL`,
    [tenantId],
  );

  return { table, label, orphaned, updated: updateRes.rowCount ?? 0 };
}

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║         MIGRATION DONNÉES ORPHELINES — TENANT ID          ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  if (isDryRun) {
    console.log("⚠️  MODE DRY-RUN — Aucune modification ne sera appliquée\n");
  }

  const tenantId = await getDefaultTenantId();
  console.log(`\n🎯 Tenant cible : ${tenantId}`);
  console.log(`📅 Date         : ${new Date().toISOString()}\n`);

  const results: MigrationResult[] = [];
  let totalOrphaned = 0;
  let totalUpdated = 0;

  for (const tableConfig of TABLES) {
    try {
      const result = await migrateTable(tableConfig, tenantId);
      results.push(result);
      totalOrphaned += result.orphaned;
      totalUpdated += result.updated;

      const icon = result.error ? "⚠️ " : result.orphaned === 0 ? "✅" : isDryRun ? "🔍" : "🔧";
      const detail = result.error
        ? result.error
        : result.orphaned === 0
        ? "OK — aucune donnée orpheline"
        : isDryRun
        ? `${result.orphaned} lignes orphelines trouvées (dry-run)`
        : `${result.updated}/${result.orphaned} lignes mises à jour`;

      console.log(`  ${icon} ${result.label.padEnd(30)} ${detail}`);
    } catch (err: any) {
      const result = { table: tableConfig.table, label: tableConfig.label, orphaned: 0, updated: 0, error: err.message };
      results.push(result);
      console.log(`  ❌ ${result.label.padEnd(30)} ERREUR: ${err.message}`);
    }
  }

  console.log(`\n──────────────────────────────────────────────────────────`);
  console.log(`📊 RÉSUMÉ`);
  console.log(`  Tables analysées    : ${results.length}`);
  console.log(`  Données orphelines  : ${totalOrphaned}`);
  if (!isDryRun) {
    console.log(`  Lignes mises à jour : ${totalUpdated}`);
  }

  if (isDryRun && totalOrphaned > 0) {
    console.log(`\n⚠️  ${totalOrphaned} lignes orphelines détectées.`);
    console.log(`   Relancez sans --dry-run pour appliquer la migration.\n`);
  } else if (!isDryRun && totalUpdated > 0) {
    console.log(`\n✅ Migration terminée : ${totalUpdated} lignes mises à jour.\n`);
  } else if (totalOrphaned === 0) {
    console.log(`\n✅ Aucune donnée orpheline — base déjà propre.\n`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error("❌ Migration échouée :", err.message);
  process.exit(1);
});
