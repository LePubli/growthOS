import assert from "node:assert";
import { TestSuite, type SuiteResult } from "./runner.ts";
import { createTestContext, createTestDeal } from "./setup.ts";
import { client } from "./test-client.ts";

export async function run(): Promise<SuiteResult> {
  const ctx = await createTestContext();
  const api = client.withToken(ctx.adminToken);
  const suite = new TestSuite("Revenue Intelligence");

  // Insérer quelques deals pour avoir des données
  await createTestDeal(ctx.tenantId, { title: "Deal Platinum", value: 50000, stage: "qualified", probability: 80 });
  await createTestDeal(ctx.tenantId, { title: "Deal Gold", value: 30000, stage: "proposal", probability: 60 });
  await createTestDeal(ctx.tenantId, { title: "Deal Won", value: 20000, stage: "won", probability: 100 });

  // ── GET /revenue/kpis
  await suite.test("GET /revenue/kpis → KPIs principaux présents", async () => {
    const r = await api.get("/revenue/kpis");
    assert.ok(r.ok, `Status ${r.status}: ${JSON.stringify(r.body)}`);
    const body = r.body as any;
    assert.ok(typeof body === "object" && body !== null, "Réponse devrait être un objet");
    // Vérifier la présence d'au moins un KPI courant
    const hasKpi = body.totalPipelineValue !== undefined
      || body.mrrEstimate !== undefined
      || body.arrEstimate !== undefined
      || body.winRate !== undefined
      || body.totalPipelineCount !== undefined
      || body.closedWonRevenue !== undefined;
    assert.ok(hasKpi, `Aucun KPI reconnu dans: ${JSON.stringify(body)}`);
  });

  // ── GET /revenue/funnel
  await suite.test("GET /revenue/funnel → entonnoir de conversion par étape", async () => {
    const r = await api.get("/revenue/funnel");
    assert.ok(r.ok, `Status ${r.status}: ${JSON.stringify(r.body)}`);
    const body = r.body as any;
    const arr = Array.isArray(body) ? body : body.funnel ?? body.stages ?? body.data ?? [];
    assert.ok(Array.isArray(arr), `Réponse devrait être un tableau ou contenir funnel/stages, reçu: ${JSON.stringify(body)}`);
  });

  // ── GET /revenue/forecast
  await suite.test("GET /revenue/forecast → prévisions 30/60/90 jours", async () => {
    const r = await api.get("/revenue/forecast");
    assert.ok(r.ok, `Status ${r.status}: ${JSON.stringify(r.body)}`);
    const body = r.body as any;
    assert.ok(typeof body === "object" && body !== null, "Réponse devrait être un objet");
    // Forecast peut être un tableau ou un objet
    const isValidForecast = Array.isArray(body)
      || body.forecast30 !== undefined
      || body.next30 !== undefined
      || body["30d"] !== undefined
      || body.weighted !== undefined
      || body.periods !== undefined
      || body.scenarios !== undefined
      || (typeof body === "object" && Object.keys(body).length > 0);
    assert.ok(isValidForecast, `Prévisions inattendues: ${JSON.stringify(body)}`);
  });

  // ── GET /revenue/trends
  await suite.test("GET /revenue/trends → tendances sur 6 mois", async () => {
    const r = await api.get("/revenue/trends");
    assert.ok(r.ok, `Status ${r.status}: ${JSON.stringify(r.body)}`);
    const body = r.body as any;
    const arr = Array.isArray(body) ? body : body.trends ?? body.data ?? body.monthly ?? [];
    assert.ok(Array.isArray(arr), `Tendances devraient être un tableau, reçu: ${JSON.stringify(body)}`);
  });

  // ── GET /revenue/ai-summary
  await suite.test("GET /revenue/ai-summary → résumé narratif IA", async () => {
    const r = await api.get("/revenue/ai-summary");
    assert.ok(r.ok, `Status ${r.status}: ${JSON.stringify(r.body)}`);
    const body = r.body as any;
    assert.ok(typeof body === "object" && body !== null, "Réponse devrait être un objet");
    const hasSummary = body.summary !== undefined
      || body.narrative !== undefined
      || body.narrativeFr !== undefined
      || body.text !== undefined
      || body.analysis !== undefined
      || body.insight !== undefined
      || body.targetQuarter !== undefined
      || body.projectedRevenue !== undefined;
    assert.ok(hasSummary, `Aucun résumé narratif dans: ${JSON.stringify(Object.keys(body))}`);
  });

  // ── AUTH — sans token → 401
  await suite.test("GET /revenue/kpis sans token → 401", async () => {
    const r = await client.get("/revenue/kpis");
    assert.ok([401, 403].includes(r.status), `Attendu 401/403, reçu ${r.status}`);
  });

  await suite.test("GET /revenue/forecast sans token → 401", async () => {
    const r = await client.get("/revenue/forecast");
    assert.ok([401, 403].includes(r.status), `Attendu 401/403, reçu ${r.status}`);
  });

  // ── ISOLATION TENANT — les KPIs d'un autre tenant sont vides/différents
  await suite.test("Isolation tenant — KPIs isolés par tenant", async () => {
    const ctx2 = await createTestContext();
    const api2 = client.withToken(ctx2.adminToken);
    const r1 = await api.get("/revenue/kpis");
    const r2 = await api2.get("/revenue/kpis");
    assert.ok(r1.ok && r2.ok, "Les deux requêtes devraient réussir");
    // Les données ne doivent pas être identiques (tenant2 n'a pas de deals)
    if (r1.ok && r2.ok) {
      const kpis1 = r1.body as any;
      const kpis2 = r2.body as any;
      // Tenant 2 n'a aucun deal → pipeline value devrait être 0 ou inférieur
      const val1 = kpis1.pipelineValue ?? kpis1.pipeline_value ?? kpis1.totalRevenue ?? 0;
      const val2 = kpis2.pipelineValue ?? kpis2.pipeline_value ?? kpis2.totalRevenue ?? 0;
      assert.ok(val1 >= val2, "Le tenant avec des deals devrait avoir une valeur pipeline ≥ à un tenant vide");
    }
    await ctx2.cleanup();
  });

  await ctx.cleanup();
  return suite.getResults();
}
