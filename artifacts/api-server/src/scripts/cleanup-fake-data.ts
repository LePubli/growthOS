/**
 * cleanup-fake-data.ts
 * Supprime les données fictives de la base de données GrowthOS.
 *
 * Usage : pnpm --filter @workspace/api-server run cleanup:fake-data
 * Dry-run : pnpm --filter @workspace/api-server run cleanup:fake-data -- --dry-run
 */

import { pool } from "@workspace/db";

const isDryRun = process.argv.includes("--dry-run");

type CleanupResult = { table: string; deleted: number; criteria: string };

async function run(): Promise<void> {
  console.log(`\n🧹 GrowthOS — Nettoyage des données fictives${isDryRun ? " [DRY-RUN]" : ""}`);
  console.log("=".repeat(60));

  const results: CleanupResult[] = [];

  // ── 1. Prospects avec email @example.com ou nom "Test*" ──────────────────
  {
    const count = await countRows(
      `SELECT COUNT(*) FROM prospects
       WHERE email ILIKE '%@example.com' OR first_name ILIKE 'Test%' OR last_name ILIKE 'Test%'`
    );
    if (!isDryRun && count > 0) {
      await pool.query(
        `DELETE FROM prospects
         WHERE email ILIKE '%@example.com' OR first_name ILIKE 'Test%' OR last_name ILIKE 'Test%'`
      );
    }
    results.push({ table: "prospects", deleted: count, criteria: "email @example.com ou nom Test*" });
  }

  // ── 2. Accounts avec domain @example.com ou name "Test*" ─────────────────
  {
    const count = await countRows(
      `SELECT COUNT(*) FROM accounts
       WHERE domain ILIKE '%example.com' OR name ILIKE 'Test%'`
    );
    if (!isDryRun && count > 0) {
      await pool.query(
        `DELETE FROM accounts
         WHERE domain ILIKE '%example.com' OR name ILIKE 'Test%'`
      );
    }
    results.push({ table: "accounts", deleted: count, criteria: "domain example.com ou name Test*" });
  }

  // ── 3. Deals avec title "Test*" ───────────────────────────────────────────
  {
    const count = await countRows(
      `SELECT COUNT(*) FROM deals WHERE title ILIKE 'Test%'`
    );
    if (!isDryRun && count > 0) {
      await pool.query(`DELETE FROM deals WHERE title ILIKE 'Test%'`);
    }
    results.push({ table: "deals", deleted: count, criteria: "title Test*" });
  }

  // ── 4. Signals avec company vide ou nulle ─────────────────────────────────
  {
    const count = await countRows(
      `SELECT COUNT(*) FROM signals WHERE company IS NULL OR TRIM(company) = ''`
    );
    if (!isDryRun && count > 0) {
      await pool.query(
        `DELETE FROM signals WHERE company IS NULL OR TRIM(company) = ''`
      );
    }
    results.push({ table: "signals", deleted: count, criteria: "company vide ou null" });
  }

  // ── 5. Notifications de test (body contient "[test]") ────────────────────
  {
    const count = await countRows(
      `SELECT COUNT(*) FROM notifications WHERE LOWER(body) LIKE '%[test]%' OR LOWER(title) LIKE '%[test]%'`
    );
    if (!isDryRun && count > 0) {
      await pool.query(
        `DELETE FROM notifications WHERE LOWER(body) LIKE '%[test]%' OR LOWER(title) LIKE '%[test]%'`
      );
    }
    results.push({ table: "notifications", deleted: count, criteria: "title/body contenant [test]" });
  }

  // ── 6. Activities orphelines (prospect_id inexistant) ────────────────────
  {
    const count = await countRows(
      `SELECT COUNT(*) FROM activities a
       WHERE a.prospect_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM prospects p WHERE p.id = a.prospect_id)`
    );
    if (!isDryRun && count > 0) {
      await pool.query(
        `DELETE FROM activities a
         WHERE a.prospect_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM prospects p WHERE p.id = a.prospect_id)`
      );
    }
    results.push({ table: "activities (orphelines)", deleted: count, criteria: "prospect_id inexistant" });
  }

  // ── Rapport ───────────────────────────────────────────────────────────────
  console.log("\n📊 Résultats :\n");
  let totalDeleted = 0;
  for (const r of results) {
    const status = r.deleted === 0 ? "✅" : isDryRun ? "🔍" : "🗑️";
    console.log(`  ${status} ${r.table.padEnd(30)} ${String(r.deleted).padStart(5)} ligne(s)  [${r.criteria}]`);
    totalDeleted += r.deleted;
  }

  console.log("\n" + "=".repeat(60));
  if (isDryRun) {
    console.log(`🔍 DRY-RUN terminé — ${totalDeleted} ligne(s) seraient supprimées.`);
    console.log("   Relancez sans --dry-run pour appliquer les suppressions.");
  } else {
    console.log(`✅ Nettoyage terminé — ${totalDeleted} ligne(s) supprimées.`);
  }
  console.log("");

  await pool.end();
  process.exit(0);
}

async function countRows(query: string): Promise<number> {
  try {
    const result = await pool.query<{ count: string }>(query);
    return parseInt(result.rows[0]?.count ?? "0", 10);
  } catch {
    return 0;
  }
}

run().catch((err) => {
  console.error("❌ Erreur lors du nettoyage :", err);
  process.exit(1);
});
