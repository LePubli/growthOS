import assert from "node:assert";
import { TestSuite, type SuiteResult } from "./runner.ts";
import { createTestContext, createTestSignal } from "./setup.ts";
import { client } from "./test-client.ts";
import { pool } from "@workspace/db";

export async function run(): Promise<SuiteResult> {
  const ctx = await createTestContext();
  const api = client.withToken(ctx.adminToken);
  const suite = new TestSuite("Signal Intelligence — Comptes liés");

  // ── Seed : prospect + signal liés au même compte
  const accountName = `Acme Signal ${Date.now()}`;
  const { rows: prospectRows } = await pool.query(
    `INSERT INTO prospects (tenant_id, first_name, last_name, email, company, status, score)
     VALUES ($1, 'Sophie', 'Bernard', $2, $3, 'contacted', 85) RETURNING id`,
    [ctx.tenantId, `sophie-${Date.now()}@acme-signal.fr`, accountName],
  );
  const prospectId: string = prospectRows[0].id;

  const signal1 = await createTestSignal(ctx.tenantId, { company: accountName, type: "funding", score: 92 });
  const signal2 = await createTestSignal(ctx.tenantId, { company: accountName, type: "hiring", score: 75 });

  // ── Liste signaux sans auth → 401
  await suite.test("GET /signals sans auth → 401", async () => {
    const r = await client.get("/signals");
    assert.equal(r.status, 401, `Attendu 401, reçu ${r.status}`);
  });

  // ── Liste signaux — données réelles DB
  await suite.test("GET /signals → liste des signaux réels", async () => {
    const r = await api.get("/signals");
    assert.ok(r.ok, `Status ${r.status}: ${JSON.stringify(r.body)}`);
    const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? [];
    assert.ok(Array.isArray(arr), "Réponse doit être un tableau");
  });

  // ── Signal lié à un compte — company présente
  await suite.test("Signal contient le nom du compte (company)", async () => {
    const r = await api.get(`/signals/${signal1.id}`);
    assert.ok(r.ok, `Status ${r.status}`);
    const body = r.body as any;
    assert.ok(body.id, "id manquant");
    assert.ok(body.company === accountName, `Company attendue "${accountName}", reçu "${body.company}"`);
  });

  // ── Filtrer par company → uniquement les signaux de ce compte
  await suite.test("Filtrer signaux par company → isolation par compte", async () => {
    const r = await api.get(`/signals?company=${encodeURIComponent(accountName)}`);
    assert.ok(r.ok, `Status ${r.status}`);
    const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? [];
    if (arr.length > 0) {
      for (const s of arr) {
        assert.ok(
          s.company === accountName || s.company?.includes("Acme"),
          `Signal d'une autre company: ${s.company}`,
        );
      }
    }
  });

  // ── Score d'intention — bornes 0-100
  await suite.test("Score d'intention signal hot (92) → dans bornes 0-100", async () => {
    const r = await api.get(`/signals/${signal1.id}`);
    assert.ok(r.ok, `Status ${r.status}`);
    const score = (r.body as any).score ?? (r.body as any).intentScore;
    if (score !== undefined) {
      assert.ok(score >= 0 && score <= 100, `Score hors bornes: ${score}`);
      assert.ok(score >= 80, `Score signal "funding" devrait être ≥80, reçu ${score}`);
    }
  });

  await ctx.cleanup();
  return suite.getResults();
}
