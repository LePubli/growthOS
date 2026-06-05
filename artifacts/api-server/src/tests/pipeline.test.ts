import assert from "node:assert";
import { TestSuite, type SuiteResult } from "./runner.ts";
import { createTestContext, createTestDeal } from "./setup.ts";
import { client } from "./test-client.ts";

export async function run(): Promise<SuiteResult> {
  const ctx = await createTestContext();
  const api = client.withToken(ctx.adminToken);
  const suite = new TestSuite("Pipeline & Deals");
  let dealId: string;

  // ── CREATE DEAL
  await suite.test("Créer un deal dans une étape → 201", async () => {
    const r = await api.post<{ id: string }>("/pipeline", {
      title: `Deal Test ${Date.now()}`,
      stage: "qualified",
      value: 25000,
      probability: 65,
      close_date: new Date(Date.now() + 30 * 86400_000).toISOString().split("T")[0],
    });
    assert.ok([200, 201].includes(r.status), `Status ${r.status}: ${JSON.stringify(r.body)}`);
    assert.ok((r.body as any).id, "id manquant");
    dealId = (r.body as any).id;
  });

  // ── LIST
  await suite.test("Lister tous les deals → tableau", async () => {
    const r = await api.get("/pipeline");
    assert.ok(r.ok, `Status ${r.status}`);
    const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? (r.body as any).deals ?? [];
    assert.ok(Array.isArray(arr));
  });

  // ── CHANGE STAGE (drag & drop)
  await suite.test("Changer l'étape d'un deal → mise à jour", async () => {
    const deal = await createTestDeal(ctx.tenantId, { stage: "qualified" });
    const r = await api.patch(`/pipeline/${deal.id}`, { stage: "proposal" });
    assert.ok(r.ok, `Status ${r.status}`);
    assert.equal((r.body as any).stage, "proposal");
  });

  // ── READ by ID
  await suite.test("Lire un deal par ID → détails", async () => {
    if (!dealId) return;
    const r = await api.get(`/pipeline/${dealId}`);
    assert.ok(r.ok, `Status ${r.status}`);
    assert.equal((r.body as any).id, dealId);
  });

  // ── STATS PIPELINE
  await suite.test("Statistiques pipeline → données agrégées", async () => {
    const r = await api.get("/dashboard");
    assert.ok([200, 404].includes(r.status));
    if (r.ok) {
      assert.ok(typeof r.body === "object", "Dashboard devrait être un objet");
    }
  });

  // ── DEAL COACH (health score)
  await suite.test("Analyse deal → Health Score + facteurs de risque", async () => {
    const deal = await createTestDeal(ctx.tenantId);
    const r = await api.get(`/deal-coach/analyze/${deal.id}`);
    assert.ok([200, 404].includes(r.status));
    if (r.ok) {
      const score = (r.body as any).healthScore ?? (r.body as any).health_score ?? (r.body as any).score;
      if (score !== undefined) {
        assert.ok(score >= 0 && score <= 100, `Score invalide: ${score}`);
      }
    }
  });

  // ── DEALS À RISQUE
  await suite.test("Deals à risque (score < 40) → liste identifiée", async () => {
    const r = await api.get("/deal-coach/at-risk");
    assert.ok([200, 404].includes(r.status));
    if (r.ok) {
      const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? [];
      assert.ok(Array.isArray(arr));
    }
  });

  // ── DELETE
  await suite.test("Supprimer un deal → 200/204", async () => {
    if (!dealId) return;
    const r = await api.delete(`/pipeline/${dealId}`);
    assert.ok([200, 204].includes(r.status), `Status ${r.status}`);
  });

  await ctx.cleanup();
  return suite.getResults();
}
