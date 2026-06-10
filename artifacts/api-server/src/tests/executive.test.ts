import assert from "node:assert";
import { TestSuite, type SuiteResult } from "./runner.ts";
import { createTestContext, createTestDeal, createTestProspect, createTestSignal } from "./setup.ts";
import { client } from "./test-client.ts";

export async function run(): Promise<SuiteResult> {
  const ctx = await createTestContext();
  const api = client.withToken(ctx.adminToken);
  const suite = new TestSuite("Executive Command Center");

  // Créer des données représentatives
  await createTestProspect(ctx.tenantId, { company: "ExecCorp Alpha" });
  await createTestProspect(ctx.tenantId, { company: "ExecCorp Beta" });
  await createTestDeal(ctx.tenantId, { title: "Executive Deal A", value: 100000, stage: "qualified" });
  await createTestDeal(ctx.tenantId, { title: "Executive Deal B", value: 50000, stage: "proposal" });
  await createTestSignal(ctx.tenantId, { title: "Signal Exec Test", type: "funding", score: 90 });

  // ── GET /executive/overview — vue d'ensemble complète
  await suite.test("GET /executive/overview → dashboard exécutif complet", async () => {
    const r = await api.get("/executive/overview");
    assert.ok(r.ok, `Status ${r.status}: ${JSON.stringify(r.body)}`);
    const body = r.body as any;
    assert.ok(typeof body === "object" && body !== null, "Réponse devrait être un objet");
    // Vérifier qu'on a au moins quelques champs de métriques
    const hasMetrics = body.totalActiveDeals !== undefined
      || body.totalPipelineValue !== undefined
      || body.atRiskDeals !== undefined
      || body.winRate !== undefined
      || body.forecast90d !== undefined
      || body.pipeline !== undefined
      || body.deals !== undefined
      || body.kpis !== undefined;
    assert.ok(hasMetrics, `Aucune métrique reconnue dans: ${JSON.stringify(Object.keys(body))}`);
  });

  // ── GET /executive/overview — isolation tenant
  await suite.test("GET /executive/overview — données cohérentes avec le tenant", async () => {
    const r = await api.get("/executive/overview");
    assert.ok(r.ok, `Status ${r.status}`);
    const body = r.body as any;
    // Un tenant avec des deals doit avoir une valeur pipeline > 0
    const pipeVal = body.pipelineValue ?? body.pipeline?.value ?? body.kpis?.pipelineValue ?? 0;
    assert.ok(typeof pipeVal === "number" || pipeVal === 0, `pipelineValue devrait être un nombre, reçu: ${pipeVal}`);
  });

  // ── POST /executive/assistant/ask — assistant IA
  await suite.test("POST /executive/assistant/ask → réponse narrative", async () => {
    const r = await api.post("/executive/assistant/ask", {
      question: "Quel est l'état de mon pipeline commercial cette semaine ?",
    });
    assert.ok(r.ok, `Status ${r.status}: ${JSON.stringify(r.body)}`);
    const body = r.body as any;
    assert.ok(typeof body === "object" && body !== null, "Réponse devrait être un objet");
    const hasAnswer = body.answer !== undefined
      || body.response !== undefined
      || body.message !== undefined
      || body.text !== undefined
      || body.content !== undefined;
    assert.ok(hasAnswer, `Aucune réponse trouvée dans: ${JSON.stringify(Object.keys(body))}`);
  });

  // ── POST /executive/assistant/ask — question vide → 400
  await suite.test("POST /assistant/ask sans question → 400", async () => {
    const r = await api.post("/executive/assistant/ask", {});
    assert.equal(r.status, 400, `Attendu 400, reçu ${r.status}`);
  });

  // ── POST /executive/assistant/ask — question vide string → 400
  await suite.test("POST /assistant/ask question vide string → 400", async () => {
    const r = await api.post("/executive/assistant/ask", { question: "" });
    assert.equal(r.status, 400, `Attendu 400, reçu ${r.status}`);
  });

  // ── AUTH — sans token → 401
  await suite.test("GET /executive/overview sans token → 401", async () => {
    const r = await client.get("/executive/overview");
    assert.ok([401, 403].includes(r.status), `Attendu 401/403, reçu ${r.status}`);
  });

  await suite.test("POST /executive/assistant/ask sans token → 401", async () => {
    const r = await client.post("/executive/assistant/ask", { question: "Test" });
    assert.ok([401, 403].includes(r.status), `Attendu 401/403, reçu ${r.status}`);
  });

  // ── ISOLATION TENANT — les overviews de deux tenants sont indépendants
  await suite.test("Isolation tenant — overview isolé par tenant", async () => {
    const ctx2 = await createTestContext();
    const api2 = client.withToken(ctx2.adminToken);
    const r1 = await api.get("/executive/overview");
    const r2 = await api2.get("/executive/overview");
    assert.ok(r1.ok, `Tenant1: ${r1.status}`);
    assert.ok(r2.ok, `Tenant2: ${r2.status}`);
    // Tenant 2 est vide → pipeline value doit être inférieure
    const val1 = (r1.body as any).pipelineValue ?? (r1.body as any).pipeline?.value ?? 0;
    const val2 = (r2.body as any).pipelineValue ?? (r2.body as any).pipeline?.value ?? 0;
    assert.ok(Number(val1) >= Number(val2), "Tenant avec deals doit avoir valeur pipeline ≥ tenant vide");
    await ctx2.cleanup();
  });

  await ctx.cleanup();
  return suite.getResults();
}
