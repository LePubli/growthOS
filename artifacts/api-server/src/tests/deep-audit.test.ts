import assert from "node:assert";
import { TestSuite, type SuiteResult } from "./runner.ts";
import { createTestContext } from "./setup.ts";
import { client } from "./test-client.ts";

export async function run(): Promise<SuiteResult> {
  const ctx = await createTestContext();
  const suite = new TestSuite("Audit Système — Deep Audit");

  // ── Sans auth → 401
  await suite.test("GET /audit/deep sans auth → 401", async () => {
    const r = await client.get("/audit/deep");
    assert.equal(r.status, 401, `Attendu 401, reçu ${r.status}`);
  });

  // ── Deep audit — structure du rapport
  await suite.test("GET /audit/deep → rapport structuré", async () => {
    const r = await client.get("/audit/deep", ctx.adminToken);
    assert.ok([200, 429].includes(r.status), `Status inattendu: ${r.status}`);
    if (r.status === 200) {
      const body = r.body as any;
      assert.ok(typeof body.cached === "boolean", "cached doit être un booléen");
      assert.ok(body.report, "report manquant");
      const report = body.report as any;
      assert.ok(report.routes || report.summary || report.checks || report.db || report.plugins,
        `Rapport doit contenir au moins un champ de résultats: ${JSON.stringify(Object.keys(report))}`);
    }
  });

  // ── Cache du deep audit — 2ème appel retourne cached=true
  await suite.test("GET /audit/deep (2ème appel) → cached=true ou 429", async () => {
    const r1 = await client.get("/audit/deep", ctx.adminToken);
    assert.ok([200, 429].includes(r1.status));

    if (r1.status === 200) {
      const r2 = await client.get("/audit/deep", ctx.adminToken);
      assert.ok([200, 429].includes(r2.status));
      if (r2.status === 200) {
        assert.ok((r2.body as any).cached === true, "Deuxième appel devrait retourner cached=true");
      }
    }
  });

  // ── Force refresh — ?force=true contourne le cache
  await suite.test("GET /audit/deep?force=true → force re-exécution", async () => {
    const r = await client.get("/audit/deep?force=true", ctx.adminToken);
    assert.ok([200, 429].includes(r.status), `Status inattendu: ${r.status}`);
    if (r.status === 200) {
      const body = r.body as any;
      assert.ok(body.report, "report attendu avec force=true");
    }
  });

  await ctx.cleanup();
  return suite.getResults();
}
