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

  // ── A first visit must not start an expensive scan.
  await suite.test("GET /audit/deep → statut sans bloquer", async () => {
    const r = await client.get("/audit/deep", ctx.adminToken);
    assert.equal(r.status, 200);
    assert.ok(["idle", "complete", "failed"].includes((r.body as any).status));
  });

  // ── Launch is asynchronous to avoid the browser's 30s Axios timeout.
  await suite.test("GET /audit/deep?force=true → 202 + progression", async () => {
    const r = await client.get("/audit/deep?force=true", ctx.adminToken);
    assert.equal(r.status, 202, `Attendu 202, reçu ${r.status}`);
    const body = r.body as any;
    assert.equal(body.status, "running");
    assert.ok(typeof body.startedAt === "number");
    assert.ok(typeof body.progress?.completed === "number");
  });

  // ── A second force call must join the same background scan, not start another.
  await suite.test("GET /audit/deep?force=true pendant le scan → pas de doublon", async () => {
    const r = await client.get("/audit/deep?force=true", ctx.adminToken);
    assert.ok([200, 202].includes(r.status), `Status inattendu: ${r.status}`);
    assert.ok(["running", "complete"].includes((r.body as any).status));
  });

  await ctx.cleanup();
  return suite.getResults();
}
