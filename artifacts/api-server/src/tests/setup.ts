import bcrypt from "bcryptjs";
import { pool } from "@workspace/db";
import { signAccessToken } from "../middlewares/auth";

export interface TestContext {
  tenantId: string;
  slug: string;
  adminToken: string;
  adminUserId: string;
  adminEmail: string;
  adminPassword: string;
  userToken: string;
  userId: string;
  userEmail: string;
  userPassword: string;
  cleanup: () => Promise<void>;
}

const CLEANUP_TABLES = [
  "tasks", "activities", "signals", "deals", "prospects",
  "sequences", "workflow_executions", "workflows",
  "webhook_logs", "webhooks", "audit_logs", "consent_logs",
  "mentions", "subscriptions", "invoices", "usage_limits",
  "analytics_events", "sourcing_jobs", "growth_memory",
  "accounts", "sso_configs", "plugin_states",
  "ereputation_campaigns", "serp_results", "pbn_sites",
  "enrich_jobs", "enrich_contacts",
];

export async function createTestContext(): Promise<TestContext> {
  const slug = `test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const tenantResult = await pool.query(
    `INSERT INTO tenants (name, slug, plan, status)
     VALUES ($1, $2, 'pro', 'active') RETURNING id`,
    [`Tenant ${slug}`, slug],
  );
  const tenantId: string = tenantResult.rows[0].id;

  const adminPassword = "TestAdmin123!";
  const adminHash = await bcrypt.hash(adminPassword, 10);
  const adminEmail = `admin-${slug}@test.growthos.fr`;
  const adminRes = await pool.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, role, tenant_id)
     VALUES ($1, $2, 'Admin', 'Test', 'admin', $3) RETURNING id`,
    [adminEmail, adminHash, tenantId],
  );
  const adminUserId: string = adminRes.rows[0].id;

  const userPassword = "TestUser123!";
  const userHash = await bcrypt.hash(userPassword, 10);
  const userEmail = `commercial-${slug}@test.growthos.fr`;
  const userRes = await pool.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, role, tenant_id)
     VALUES ($1, $2, 'Commercial', 'Test', 'commercial', $3) RETURNING id`,
    [userEmail, userHash, tenantId],
  );
  const userId: string = userRes.rows[0].id;

  const adminToken = signAccessToken({ userId: adminUserId, tenantId, email: adminEmail });
  const userToken = signAccessToken({ userId, tenantId, email: userEmail });

  const cleanup = async () => {
    for (const table of CLEANUP_TABLES) {
      await pool
        .query(`DELETE FROM ${table} WHERE tenant_id = $1`, [tenantId])
        .catch(() => undefined);
    }
    await pool.query(`DELETE FROM users WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]);
  };

  return {
    tenantId, slug,
    adminToken, adminUserId, adminEmail, adminPassword,
    userToken, userId, userEmail, userPassword,
    cleanup,
  };
}

/** Crée un prospect de test directement en DB */
export async function createTestProspect(tenantId: string, overrides: Record<string, unknown> = {}) {
  const n = Date.now();
  const result = await pool.query(
    `INSERT INTO prospects (tenant_id, first_name, last_name, email, company, status, score)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      tenantId,
      overrides.first_name ?? "Jean",
      overrides.last_name ?? "Dupont",
      overrides.email ?? `jean-${n}@acme-test.fr`,
      overrides.company ?? "Acme Corp",
      overrides.status ?? "new",
      overrides.score ?? 72,
    ],
  );
  return result.rows[0];
}

/** Crée un deal de test directement en DB */
export async function createTestDeal(tenantId: string, overrides: Record<string, unknown> = {}) {
  const result = await pool.query(
    `INSERT INTO deals (tenant_id, title, stage, value, probability, close_date)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      tenantId,
      overrides.title ?? "Deal Test",
      overrides.stage ?? "qualified",
      overrides.value ?? 15000,
      overrides.probability ?? 60,
      overrides.close_date ?? new Date(Date.now() + 30 * 86400_000).toISOString().split("T")[0],
    ],
  );
  return result.rows[0];
}

/** Crée un signal de test directement en DB */
export async function createTestSignal(tenantId: string, overrides: Record<string, unknown> = {}) {
  const result = await pool.query(
    `INSERT INTO signals (tenant_id, type, title, company, score, is_read, is_starred)
     VALUES ($1, $2, $3, $4, $5, false, false) RETURNING *`,
    [
      tenantId,
      overrides.type ?? "funding",
      overrides.title ?? "Levée de fonds Acme Corp",
      overrides.company ?? "Acme Corp",
      overrides.score ?? 85,
    ],
  );
  return result.rows[0];
}
