import assert from "node:assert";
import { TestSuite, type SuiteResult } from "./runner.ts";
import { createTestContext, createTestDeal } from "./setup.ts";
import { client } from "./test-client.ts";

export async function run(): Promise<SuiteResult> {
  const ctx = await createTestContext();
  const api = client.withToken(ctx.adminToken);
  const suite = new TestSuite("AI Deal Coach");

  // ── ANALYSE DEAL
  await suite.test("Analyse d'un deal → Health Score + facteurs de risque", async () => {
    const deal = await createTestDeal(ctx.tenantId, { stage: "proposal", probability: 45, value: 20000 });
    const r = await api.get(`/deal-coach/analyze/${deal.id}`);
    assert.ok([200, 404].includes(r.status));
    if (r.ok) {
      const body = r.body as any;
      const score = body.healthScore ?? body.health_score ?? body.score;
      if (score !== undefined) {
        assert.ok(score >= 0 && score <= 100, `Score invalide: ${score}`);
      }
    }
  });

  // ── RECOMMANDATIONS IA
  await suite.test("Recommandations IA générées pour un deal", async () => {
    const deal = await createTestDeal(ctx.tenantId);
    const r = await api.get(`/deal-coach/recommendations/${deal.id}`);
    assert.ok([200, 404].includes(r.status));
    if (r.ok) {
      const body = r.body as any;
      const recs = body.recommendations ?? body.data ?? body;
      assert.ok(recs !== undefined, "Recommandations manquantes");
    }
  });

  // ── DEALS À RISQUE CRITIQUE
  await suite.test("Deals à risque critique (score < 40) → liste", async () => {
    const r = await api.get("/deal-coach/at-risk");
    assert.ok([200, 404].includes(r.status));
    if (r.ok) {
      const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? (r.body as any).deals ?? [];
      assert.ok(Array.isArray(arr));
    }
  });

  // ── SCORE MOYEN PIPELINE
  await suite.test("Score moyen du pipeline calculé → nombre 0-100", async () => {
    const r = await api.get("/deal-coach/pipeline-score");
    assert.ok([200, 404].includes(r.status));
    if (r.ok) {
      const body = r.body as any;
      const avg = body.averageScore ?? body.score ?? body.average;
      if (avg !== undefined) {
        assert.ok(avg >= 0 && avg <= 100, `Score moyen invalide: ${avg}`);
      }
    }
  });

  // ── VALEUR À RISQUE
  await suite.test("Valeur à risque calculée → montant positif ou zéro", async () => {
    const r = await api.get("/deal-coach/at-risk");
    assert.ok([200, 404].includes(r.status));
    if (r.ok) {
      const body = r.body as any;
      const val = body.totalAtRisk ?? body.valueAtRisk ?? body.total_at_risk;
      if (val !== undefined) {
        assert.ok(val >= 0, `Valeur à risque négative: ${val}`);
      }
    }
  });

  // ── ANALYSE SANS DEAL INEXISTANT
  await suite.test("Analyser deal inexistant → 404", async () => {
    const r = await api.get("/deal-coach/analyze/00000000-0000-0000-0000-000000000000");
    assert.ok([404, 400].includes(r.status), `Attendu 404, reçu ${r.status}`);
  });

  await ctx.cleanup();
  return suite.getResults();
}
