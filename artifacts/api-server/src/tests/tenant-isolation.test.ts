import assert from "node:assert";
import { TestSuite, type SuiteResult } from "./runner.ts";
import { createTestContext, createTestProspect, createTestDeal, createTestSignal } from "./setup.ts";
import { client } from "./test-client.ts";

export async function run(): Promise<SuiteResult> {
  const suite = new TestSuite("Multi-Tenancy & Isolation");

  // ── ISOLATION PROSPECTS
  await suite.test("Tenant A ne voit pas les prospects du Tenant B", async () => {
    const ctxA = await createTestContext();
    const ctxB = await createTestContext();

    const prospectB = await createTestProspect(ctxB.tenantId);
    const apiA = client.withToken(ctxA.adminToken);
    const r = await apiA.get(`/prospects/${prospectB.id}`);
    assert.ok([404, 403].includes(r.status), `Isolation attendue, reçu ${r.status}`);

    await ctxA.cleanup();
    await ctxB.cleanup();
  });

  // ── ISOLATION DEALS
  await suite.test("Tenant A ne voit pas les deals du Tenant B", async () => {
    const ctxA = await createTestContext();
    const ctxB = await createTestContext();

    const dealB = await createTestDeal(ctxB.tenantId);
    const apiA = client.withToken(ctxA.adminToken);
    const r = await apiA.get(`/deals/${dealB.id}`);
    assert.ok([404, 403].includes(r.status), `Isolation attendue, reçu ${r.status}`);

    await ctxA.cleanup();
    await ctxB.cleanup();
  });

  // ── ISOLATION SIGNAUX
  await suite.test("Tenant A ne voit pas les signaux du Tenant B", async () => {
    const ctxA = await createTestContext();
    const ctxB = await createTestContext();

    const signalB = await createTestSignal(ctxB.tenantId);
    const apiA = client.withToken(ctxA.adminToken);
    const r = await apiA.get(`/signals/${signalB.id}`);
    assert.ok([404, 403].includes(r.status), `Isolation attendue, reçu ${r.status}`);

    await ctxA.cleanup();
    await ctxB.cleanup();
  });

  // ── LISTE ISOLÉE
  await suite.test("Liste prospects isolée par tenant → pas de fuite croisée", async () => {
    const ctxA = await createTestContext();
    const ctxB = await createTestContext();

    await createTestProspect(ctxB.tenantId, { email: `leak-test-${Date.now()}@ctxb.fr` });
    const apiA = client.withToken(ctxA.adminToken);
    const r = await apiA.get("/prospects");
    assert.ok(r.ok, `Status ${r.status}`);
    const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? [];
    const leaked = arr.filter((p: any) => p.tenant_id === ctxB.tenantId);
    assert.equal(leaked.length, 0, `Fuite de ${leaked.length} prospect(s) du tenant B`);

    await ctxA.cleanup();
    await ctxB.cleanup();
  });

  // ── PATCH CROSS-TENANT INTERDIT
  await suite.test("Modifier un prospect d'un autre tenant → 404/403", async () => {
    const ctxA = await createTestContext();
    const ctxB = await createTestContext();

    const prospectB = await createTestProspect(ctxB.tenantId);
    const apiA = client.withToken(ctxA.adminToken);
    const r = await apiA.patch(`/prospects/${prospectB.id}`, { company: "Hack Corp" });
    assert.ok([404, 403].includes(r.status), `Cross-tenant PATCH bloqué attendu, reçu ${r.status}`);

    await ctxA.cleanup();
    await ctxB.cleanup();
  });

  // ── STATISTIQUES ISOLÉES
  await suite.test("Stats pipeline isolées par tenant → pas de contamination", async () => {
    const ctxA = await createTestContext();
    const ctxB = await createTestContext();

    await createTestDeal(ctxB.tenantId, { value: 999999 });
    const apiA = client.withToken(ctxA.adminToken);
    const r = await apiA.get("/deals/stats");
    assert.ok([200, 404].includes(r.status));
    if (r.ok) {
      const body = r.body as any;
      const total = body.totalValue ?? body.total ?? 0;
      assert.ok(total < 999999, `Stats contaminées par le tenant B: valeur ${total}`);
    }

    await ctxA.cleanup();
    await ctxB.cleanup();
  });

  return suite.getResults();
}
