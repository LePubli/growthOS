import assert from "node:assert";
import { TestSuite, type SuiteResult } from "./runner.ts";
import { createTestContext } from "./setup.ts";
import { client } from "./test-client.ts";
import { pool } from "@workspace/db";

export async function run(): Promise<SuiteResult> {
  const ctx = await createTestContext();
  const suite = new TestSuite("Product Analytics — Routes réelles");

  // ── Seed : quelques données pour que les aggrégations soient non vides
  await pool.query(
    `INSERT INTO prospects (tenant_id, first_name, last_name, email, company, status)
     VALUES ($1, 'Alice', 'Martin', 'alice@analytics-test.fr', 'AnalyticsCo', 'new'),
            ($1, 'Bob',   'Durand', 'bob@analytics-test.fr',   'AnalyticsCo', 'contacted')`,
    [ctx.tenantId],
  );
  await pool.query(
    `INSERT INTO deals (tenant_id, title, stage, value, probability)
     VALUES ($1, 'Deal Analytics A', 'lead', 5000, 30),
            ($1, 'Deal Analytics B', 'won',  12000, 100)`,
    [ctx.tenantId],
  );

  // ── GET /analytics/overview — sans auth → 401
  await suite.test("GET /analytics/overview sans auth → 401", async () => {
    const r = await client.get("/analytics/overview");
    assert.equal(r.status, 401, `Attendu 401, reçu ${r.status}`);
  });

  // ── GET /analytics/overview — avec auth → objet de stats
  await suite.test("GET /analytics/overview → stats réelles DB", async () => {
    const r = await client.get("/analytics/overview", ctx.adminToken);
    assert.equal(r.status, 200, `Attendu 200, reçu ${r.status}: ${JSON.stringify(r.body)}`);
    const body = r.body as any;
    assert.ok(typeof body.prospects === "number", "prospects attendu comme nombre");
    assert.ok(typeof body.deals === "number", "deals attendu comme nombre");
    assert.ok(typeof body.signals === "number", "signals attendu comme nombre");
    assert.ok(typeof body.tasks === "number", "tasks attendu comme nombre");
    assert.ok(Array.isArray(body.dealsByStage), "dealsByStage doit être un tableau");
    assert.ok(Array.isArray(body.signalsByType), "signalsByType doit être un tableau");
    assert.ok(Array.isArray(body.tasksByStatus), "tasksByStatus doit être un tableau");
    assert.ok(body.sequences && typeof body.sequences.total === "number", "sequences attendu");
    assert.ok(body.prospects >= 0, "prospects doit être >= 0");
    assert.ok(body.deals >= 0, "deals doit être >= 0");
  });

  // ── GET /analytics/funnel → funnel de conversion
  await suite.test("GET /analytics/funnel → stages deal agrégés", async () => {
    const r = await client.get("/analytics/funnel", ctx.adminToken);
    assert.equal(r.status, 200, `Attendu 200, reçu ${r.status}`);
    const body = r.body as any;
    assert.ok(Array.isArray(body.funnel), "funnel doit être un tableau");
    assert.equal(body.funnel.length, 6, `Doit avoir 6 stages, reçu ${body.funnel.length}`);
    const stages = body.funnel.map((s: any) => s.stage);
    assert.ok(stages.includes("lead"), "Stage lead manquant");
    assert.ok(stages.includes("won"), "Stage won manquant");
    const leadStage = body.funnel.find((s: any) => s.stage === "lead");
    assert.ok(leadStage.count >= 1, `Lead doit avoir ≥1 deal, reçu ${leadStage.count}`);
  });

  // ── GET /analytics/usage → usage par ressource
  await suite.test("GET /analytics/usage → usage vs limites", async () => {
    const r = await client.get("/analytics/usage", ctx.adminToken);
    assert.equal(r.status, 200, `Attendu 200, reçu ${r.status}`);
    const body = r.body as any;
    assert.ok(Array.isArray(body.resources), "resources doit être un tableau");
    assert.ok(body.resources.length >= 4, "Doit avoir au moins 4 ressources");
    for (const res of body.resources) {
      assert.ok(res.name, "name manquant");
      assert.ok(typeof res.used === "number", "used doit être un nombre");
      assert.ok(typeof res.limit === "number", "limit doit être un nombre");
      assert.ok(typeof res.pct === "number", "pct doit être un nombre");
      assert.ok(res.limit > 0, "limit doit être > 0");
    }
    const prospectsUsage = body.resources.find((r: any) => r.name === "prospects");
    assert.ok(prospectsUsage, "Ressource prospects manquante");
    assert.ok(prospectsUsage.used >= 2, `Doit avoir ≥2 prospects, reçu ${prospectsUsage.used}`);
  });

  // ── GET /analytics/actions-frequent → top actions audit
  await suite.test("GET /analytics/actions-frequent → retourne tableau", async () => {
    const r = await client.get("/analytics/actions-frequent", ctx.adminToken);
    assert.equal(r.status, 200, `Attendu 200, reçu ${r.status}`);
    const body = r.body as any;
    assert.ok(Array.isArray(body.actions), "actions doit être un tableau");
  });

  // ── GET /analytics/entities-active → top entités actives
  await suite.test("GET /analytics/entities-active → retourne tableau", async () => {
    const r = await client.get("/analytics/entities-active", ctx.adminToken);
    assert.equal(r.status, 200, `Attendu 200, reçu ${r.status}`);
    const body = r.body as any;
    assert.ok(Array.isArray(body.entities), "entities doit être un tableau");
  });

  // ── GET /analytics/stats — route existante toujours fonctionnelle
  await suite.test("GET /analytics/stats → toujours fonctionnel", async () => {
    const r = await client.get("/analytics/stats", ctx.adminToken);
    assert.equal(r.status, 200, `Attendu 200, reçu ${r.status}`);
    const body = r.body as any;
    assert.ok(body.overview, "overview attendu");
    assert.ok(Array.isArray(body.pipeline_funnel), "pipeline_funnel attendu");
  });

  // ── Isolation tenant : overview ne voit que les données du tenant
  await suite.test("GET /analytics/overview isolation tenant", async () => {
    const r1 = await client.get("/analytics/overview", ctx.adminToken);
    assert.equal(r1.status, 200);
    const body1 = r1.body as any;
    // Créer un autre contexte pour vérifier l'isolation
    const { createTestContext: ctc } = await import("./setup.ts");
    const ctx2 = await ctc();
    const r2 = await client.get("/analytics/overview", ctx2.adminToken);
    assert.equal(r2.status, 200, `Attendu 200, reçu ${r2.status}`);
    const body2 = r2.body as any;
    // ctx2 est un tenant vide — prospects et deals doivent être 0
    assert.equal(body2.prospects, 0, `Tenant vide: attendu 0 prospects, reçu ${body2.prospects}`);
    assert.equal(body2.deals, 0, `Tenant vide: attendu 0 deals, reçu ${body2.deals}`);
    await ctx2.cleanup();
  });

  await ctx.cleanup();
  return suite.getResults();
}
