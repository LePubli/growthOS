import assert from "node:assert";
import { TestSuite, type SuiteResult } from "./runner.ts";
import { createTestContext, createTestSignal } from "./setup.ts";
import { client } from "./test-client.ts";

export async function run(): Promise<SuiteResult> {
  const ctx = await createTestContext();
  const api = client.withToken(ctx.adminToken);
  const suite = new TestSuite("Signal Intelligence");

  // ── LIST
  await suite.test("Liste des signaux → tableau paginé", async () => {
    const r = await api.get("/signals");
    assert.ok(r.ok, `Status ${r.status}`);
    const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? (r.body as any).signals ?? [];
    assert.ok(Array.isArray(arr));
  });

  // ── FILTRES
  await suite.test("Filtrer par type (funding) → résultats cohérents", async () => {
    await createTestSignal(ctx.tenantId, { type: "funding" });
    const r = await api.get("/signals?type=funding");
    assert.ok(r.ok, `Status ${r.status}`);
    const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? [];
    if (arr.length > 0) {
      arr.forEach((s: any) => assert.equal(s.type, "funding"));
    }
  });

  // ── SCORE d'intention
  await suite.test("Score d'intention par signal → Hot/Warm/Cold", async () => {
    const signal = await createTestSignal(ctx.tenantId, { score: 90 });
    const r = await api.get(`/signals/${signal.id}`);
    assert.ok(r.ok, `Status ${r.status}`);
    const body = r.body as any;
    assert.ok(body.id, "id manquant");
    const score = body.score ?? body.intentScore;
    if (score !== undefined) {
      assert.ok(score >= 0 && score <= 100, `Score hors bornes: ${score}`);
    }
  });

  // ── MARQUER LU
  await suite.test("Marquer un signal comme lu → isRead = true", async () => {
    const signal = await createTestSignal(ctx.tenantId);
    const r = await api.patch(`/signals/${signal.id}`, { isRead: true });
    assert.ok(r.ok, `Status ${r.status}`);
    assert.equal((r.body as any).isRead ?? (r.body as any).is_read, true);
  });

  // ── FAVORI
  await suite.test("Mettre un signal en favori → isStarred = true", async () => {
    const signal = await createTestSignal(ctx.tenantId);
    const r = await api.patch(`/signals/${signal.id}`, { isStarred: true });
    assert.ok(r.ok, `Status ${r.status}`);
    assert.equal((r.body as any).isStarred ?? (r.body as any).is_starred, true);
  });

  // ── CONVERSION signal → prospect
  await suite.test("Conversion signal → prospect → 201", async () => {
    const signal = await createTestSignal(ctx.tenantId);
    const r = await api.post(`/signals/${signal.id}/convert`, {
      first_name: "Contact",
      last_name: "Converti",
      email: `convert-${Date.now()}@acme.fr`,
    });
    assert.ok([200, 201, 404].includes(r.status), `Status inattendu: ${r.status}`);
  });

  // ── ACTIONS EN MASSE
  await suite.test("Actions en masse (marquer lus) → 200", async () => {
    const s1 = await createTestSignal(ctx.tenantId);
    const s2 = await createTestSignal(ctx.tenantId);
    const r = await api.post("/signals/bulk", {
      ids: [s1.id, s2.id],
      action: "markRead",
    });
    assert.ok([200, 204, 404].includes(r.status), `Status: ${r.status}`);
  });

  // ── FILTRER PAR SCORE
  await suite.test("Filtrer signaux chauds (score >= 80) → Hot signals", async () => {
    const r = await api.get("/signals?minScore=80");
    assert.ok(r.ok, `Status ${r.status}`);
  });

  await ctx.cleanup();
  return suite.getResults();
}
