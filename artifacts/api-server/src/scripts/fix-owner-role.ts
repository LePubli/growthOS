/**
 * fix-owner-role.ts
 * Migration : normalise tous les utilisateurs avec role='owner' → role='admin'
 * en base de données pour corriger le bug RBAC JWT "owner" vs "admin".
 *
 * Usage : pnpm --filter @workspace/api-server run fix:owner-role
 */

import { pool } from "@workspace/db";

async function main() {
  console.log("🔧 GrowthOS — Migration rôle 'owner' → 'admin'\n");

  // Compter les utilisateurs impactés
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) as count FROM users WHERE role = 'owner'`,
  );
  const count = Number(countRows[0]?.count ?? 0);

  if (count === 0) {
    console.log("✅ Aucun utilisateur avec role='owner' trouvé. Rien à migrer.");
    process.exit(0);
  }

  console.log(`📋 ${count} utilisateur(s) avec role='owner' trouvé(s)`);

  // Lister les utilisateurs concernés
  const { rows: users } = await pool.query(
    `SELECT id, email, role, tenant_id FROM users WHERE role = 'owner' ORDER BY created_at`,
  );

  console.log("\nUtilisateurs à migrer :");
  for (const u of users) {
    console.log(`  - ${u.email} (${u.id.slice(0, 8)}…) — tenant: ${u.tenant_id.slice(0, 8)}…`);
  }

  // Appliquer la migration
  const { rowCount } = await pool.query(
    `UPDATE users SET role = 'admin' WHERE role = 'owner' RETURNING id, email`,
  );

  console.log(`\n✅ ${rowCount} utilisateur(s) migré(s) : role 'owner' → 'admin'`);
  console.log("\n📌 Action requise :");
  console.log("   Ces utilisateurs doivent se re-connecter pour obtenir un nouveau JWT avec role='admin'.");
  console.log("   Ou vider leurs tokens en base si un mécanisme de revocation est en place.\n");

  // Vérification finale
  const { rows: remaining } = await pool.query(
    `SELECT COUNT(*) as count FROM users WHERE role = 'owner'`,
  );
  const leftover = Number(remaining[0]?.count ?? 0);
  if (leftover > 0) {
    console.error(`❌ ${leftover} utilisateur(s) toujours avec role='owner' — vérifiez les contraintes.`);
    process.exit(1);
  }

  console.log("✅ Migration terminée avec succès.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Erreur lors de la migration:", err);
  process.exit(1);
});
