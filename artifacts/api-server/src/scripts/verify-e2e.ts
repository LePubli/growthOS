/**
 * E2E verification script — GrowthOS
 * Run: pnpm --filter @workspace/api-server test:e2e
 *
 * Scenarios:
 *  1. Prospect  — CREATE / READ / PATCH score / DELETE
 *  2. Deal      — CREATE / PATCH stage Lead → Qualified
 *  3. Signal    — CREATE / mark as read
 *  4. Sequence  — CREATE / toggle (activate)
 */

import jwt from "jsonwebtoken";
import { pool } from "@workspace/db";

const API = process.env.API_URL ?? "http://localhost:8080/api/v1";
const JWT_SECRET = process.env.JWT_SECRET ?? "growthos-dev-secret-change-in-production";

/* ─── Colour helpers ─────────────────────────────────────── */
const green  = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red    = (s: string) => `\x1b[31m${s}\x1b[0m`;
const bold   = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim    = (s: string) => `\x1b[2m${s}\x1b[0m`;

/* ─── Auth token ─────────────────────────────────────────── */
async function getAuthToken(): Promise<{ token: string; tenantId: string }> {
  const tenantRow = await pool.query<{ id: string }>(
    `SELECT id FROM tenants WHERE slug = $1`, ["growthos-demo"],
  );
  if (!tenantRow.rows[0]) {
    throw new Error("Tenant 'growthos-demo' introuvable — lancez d'abord: pnpm seed:realistic");
  }
  const tenantId = tenantRow.rows[0].id;

  const userRow = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE email = $1 AND tenant_id = $2`,
    ["admin@growthos.fr", tenantId],
  );
  if (!userRow.rows[0]) {
    throw new Error("User admin@growthos.fr introuvable — lancez d'abord: pnpm seed:realistic");
  }
  const userId = userRow.rows[0].id;

  const token = jwt.sign(
    { userId, tenantId, email: "admin@growthos.fr" },
    JWT_SECRET,
    { expiresIn: "1h" },
  );
  return { token, tenantId };
}

/* ─── HTTP helpers ───────────────────────────────────────── */
async function api(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  token: string,
  body?: object,
): Promise<{ status: number; data: any }> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function dbQuery<T extends Record<string, unknown>>(sql: string, params: unknown[]): Promise<T[]> {
  const r = await pool.query<T>(sql, params);
  return r.rows;
}

/* ─── Test runner ────────────────────────────────────────── */
interface Result { name: string; passed: boolean; detail?: string }
const results: Result[] = [];

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`  ${green("✅")} ${name}`);
  } catch (err: any) {
    results.push({ name, passed: false, detail: err.message });
    console.log(`  ${red("❌")} ${name}`);
    console.log(`     ${dim(err.message)}`);
  }
}

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(msg);
}

/* ─── Scenarios ──────────────────────────────────────────── */

async function scenarioProspect(token: string, tenantId: string) {
  console.log(bold("\n📋 Scénario 1 — Prospect CRUD"));

  let prospectId: string;

  await test("POST /prospects → 201 + id dans la réponse", async () => {
    const { status, data } = await api("POST", "/prospects", token, {
      firstName: "E2E",
      lastName:  "Test",
      email:     `e2e-${Date.now()}@test.fr`,
      company:   "E2E Corp",
      score:     42,
    });
    assert(status === 201, `Expected 201, got ${status}`);
    assert(!!data.id, "Pas d'id dans la réponse");
    prospectId = data.id;
  });

  await test("DB contient le prospect créé", async () => {
    const rows = await dbQuery<{ id: string }>(
      `SELECT id FROM prospects WHERE id = $1 AND tenant_id = $2`,
      [prospectId!, tenantId],
    );
    assert(rows.length === 1, `Prospect introuvable en DB (id=${prospectId})`);
  });

  await test("PATCH /prospects/:id → score modifié en DB", async () => {
    const { status } = await api("PATCH", `/prospects/${prospectId!}`, token, { score: 88 });
    assert(status === 200, `Expected 200, got ${status}`);
    const rows = await dbQuery<{ score: number }>(
      `SELECT score FROM prospects WHERE id = $1`, [prospectId!],
    );
    assert(rows[0]?.score === 88, `Score en DB = ${rows[0]?.score}, attendu 88`);
  });

  await test("DELETE /prospects/:id → plus en DB", async () => {
    const { status } = await api("DELETE", `/prospects/${prospectId!}`, token);
    assert(status === 200, `Expected 200, got ${status}`);
    const rows = await dbQuery<{ id: string }>(
      `SELECT id FROM prospects WHERE id = $1`, [prospectId!],
    );
    assert(rows.length === 0, "Prospect toujours présent en DB après DELETE");
  });
}

async function scenarioDeal(token: string, tenantId: string) {
  console.log(bold("\n💰 Scénario 2 — Deal Pipeline"));

  let dealId: string;

  await test("POST /pipeline → 201 + stage = 'lead'", async () => {
    const { status, data } = await api("POST", "/pipeline", token, {
      title:   "E2E Test Deal",
      company: "E2E Corp",
      value:   5000,
      stage:   "lead",
    });
    assert(status === 201, `Expected 201, got ${status}`);
    assert(data.stage === "lead", `stage=${data.stage}, attendu 'lead'`);
    dealId = data.id;
  });

  await test("PATCH /pipeline/:id stage lead → qualified → vérifié en DB", async () => {
    const before = await dbQuery<{ stage: string; updated_at: string }>(
      `SELECT stage, updated_at FROM deals WHERE id = $1`, [dealId!],
    );
    const { status } = await api("PATCH", `/pipeline/${dealId!}`, token, { stage: "qualified" });
    assert(status === 200, `Expected 200, got ${status}`);
    const after = await dbQuery<{ stage: string; updated_at: string }>(
      `SELECT stage, updated_at FROM deals WHERE id = $1`, [dealId!],
    );
    assert(after[0]?.stage === "qualified", `stage en DB = ${after[0]?.stage}`);
    assert(
      after[0]?.updated_at !== before[0]?.updated_at,
      "updated_at n'a pas changé après la mise à jour",
    );
  });

  await test("Nettoyage — DELETE deal E2E", async () => {
    const { status } = await api("DELETE", `/pipeline/${dealId!}`, token);
    assert(status === 200, `Expected 200, got ${status}`);
    const rows = await dbQuery<{ id: string }>(
      `SELECT id FROM deals WHERE id = $1`, [dealId!],
    );
    assert(rows.length === 0, "Deal toujours en DB après DELETE");
  });
}

async function scenarioSignal(token: string, tenantId: string) {
  console.log(bold("\n⚡ Scénario 3 — Signal Intent"));

  let signalId: string;

  await test("POST /signals → 201 + is_read = false", async () => {
    const { status, data } = await api("POST", "/signals", token, {
      type:        "intent",
      company:     "E2E Corp",
      title:       "E2E Signal — visite page pricing",
      description: "Test automatique",
      score:       80,
    });
    assert(status === 201, `Expected 201, got ${status}`);
    assert(data.isRead === false, `isRead=${data.isRead}, attendu false`);
    signalId = data.id;
  });

  await test("POST /signals/:id/read → is_read = true en DB", async () => {
    const { status } = await api("POST", `/signals/${signalId!}/read`, token);
    assert(status === 200, `Expected 200, got ${status}`);
    const rows = await dbQuery<{ is_read: boolean }>(
      `SELECT is_read FROM signals WHERE id = $1`, [signalId!],
    );
    assert(rows[0]?.is_read === true, `is_read en DB = ${rows[0]?.is_read}, attendu true`);
  });

  await test("Nettoyage — DELETE signal E2E", async () => {
    await pool.query(`DELETE FROM signals WHERE id = $1`, [signalId!]);
    const rows = await dbQuery<{ id: string }>(`SELECT id FROM signals WHERE id = $1`, [signalId!]);
    assert(rows.length === 0, "Signal toujours en DB");
  });
}

async function scenarioSequence(token: string, tenantId: string) {
  console.log(bold("\n📧 Scénario 4 — Séquence Email"));

  let seqId: string;

  await test("POST /sequences → 201 + status = 'draft'", async () => {
    const { status, data } = await api("POST", "/sequences", token, {
      name:        "E2E Séquence Test",
      description: "Séquence créée par le script E2E",
    });
    assert(status === 201, `Expected 201, got ${status}`);
    assert(data.status === "draft", `status=${data.status}, attendu 'draft'`);
    seqId = data.id;
  });

  await test("POST /sequences/:id/toggle → status = 'active' en DB", async () => {
    const { status, data } = await api("POST", `/sequences/${seqId!}/toggle`, token);
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.status === "active", `status dans réponse = ${data.status}`);
    const rows = await dbQuery<{ status: string }>(
      `SELECT status FROM sequences WHERE id = $1`, [seqId!],
    );
    assert(rows[0]?.status === "active", `status en DB = ${rows[0]?.status}`);
  });

  await test("Nettoyage — DELETE séquence E2E", async () => {
    await pool.query(`DELETE FROM sequences WHERE id = $1`, [seqId!]);
    const rows = await dbQuery<{ id: string }>(`SELECT id FROM sequences WHERE id = $1`, [seqId!]);
    assert(rows.length === 0, "Séquence toujours en DB");
  });
}

/* ─── Main ───────────────────────────────────────────────── */
async function main() {
  console.log(bold("\n🔬  GrowthOS E2E Verification Script"));
  console.log(dim(`    API : ${API}`));
  console.log(dim(`    ${new Date().toLocaleString("fr-FR")}\n`));

  let token: string;
  let tenantId: string;

  try {
    const auth = await getAuthToken();
    token    = auth.token;
    tenantId = auth.tenantId;
    console.log(green("✅  Auth token généré") + dim(` (tenant: ${tenantId})`));
  } catch (err: any) {
    console.error(red(`❌  Impossible d'obtenir un token : ${err.message}`));
    process.exit(1);
  }

  await scenarioProspect(token, tenantId);
  await scenarioDeal(token, tenantId);
  await scenarioSignal(token, tenantId);
  await scenarioSequence(token, tenantId);

  /* ─── Report ── */
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(bold("\n══════════════════════════════════════════"));
  console.log(bold(`  Rapport E2E — ${new Date().toLocaleTimeString("fr-FR")}`));
  console.log(bold("══════════════════════════════════════════"));
  console.log(`  ${green("✅ PASS")} : ${passed} / ${results.length}`);
  if (failed > 0) {
    console.log(`  ${red("❌ FAIL")} : ${failed} / ${results.length}`);
    console.log(red("\n  Tests en échec :"));
    results.filter(r => !r.passed).forEach(r => {
      console.log(`    ${red("•")} ${r.name}`);
      if (r.detail) console.log(`      ${dim(r.detail)}`);
    });
  }
  console.log("");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(red(`\n💥  Erreur fatale : ${err.message}`));
  process.exit(1);
}).finally(() => pool.end());
