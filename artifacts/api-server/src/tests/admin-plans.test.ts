import assert from "node:assert";
import { TestSuite, type SuiteResult } from "./runner.ts";
import { createTestContext } from "./setup.ts";
import { client } from "./test-client.ts";

export async function run(): Promise<SuiteResult> {
  const ctx = await createTestContext();
  const suite = new TestSuite("Admin — Plans & Abonnements");

  let createdPlanId: string | undefined;
  const uniqueName = `plan-test-${Date.now()}`;

  // ── Sans auth → 401
  await suite.test("GET /admin/plans sans auth → 401", async () => {
    const r = await client.get("/admin/plans");
    assert.equal(r.status, 401, `Attendu 401, reçu ${r.status}`);
  });

  // ── Liste des plans système
  await suite.test("GET /admin/plans → liste les plans", async () => {
    const r = await client.get("/admin/plans", ctx.adminToken);
    assert.equal(r.status, 200, `Attendu 200, reçu ${r.status}: ${JSON.stringify(r.body)}`);
    const body = r.body as any[];
    assert.ok(Array.isArray(body), "Réponse doit être un tableau");
    assert.ok(body.length >= 3, `Doit avoir au moins 3 plans (starter/pro/enterprise), reçu ${body.length}`);
    for (const plan of body) {
      assert.ok(plan.id, "id manquant");
      assert.ok(plan.name || plan.displayName, "name/displayName manquant");
      assert.ok(typeof plan.priceMonthly === "number", "priceMonthly doit être un nombre");
    }
  });

  // ── Créer un plan
  await suite.test("POST /admin/plans → crée un plan personnalisé", async () => {
    const r = await client.post(
      "/admin/plans",
      {
        name: uniqueName,
        displayName: "Plan Test E2E",
        description: "Plan créé par les tests automatisés",
        priceMonthly: 4900,
        priceYearly: 49000,
        features: ["Fonctionnalité A", "Fonctionnalité B"],
        limits: { prospects: 500, deals: 100 },
      },
      ctx.adminToken,
    );
    assert.equal(r.status, 201, `Attendu 201, reçu ${r.status}: ${JSON.stringify(r.body)}`);
    const body = r.body as any;
    assert.ok(body.id, "id manquant");
    assert.equal(body.name, uniqueName, "Nom du plan incorrect");
    assert.equal(body.priceMonthly, 4900, "Prix mensuel incorrect");
    createdPlanId = body.id;
  });

  // ── Modifier le plan
  await suite.test("PATCH /admin/plans/:id → modifie le plan", async () => {
    assert.ok(createdPlanId, "createdPlanId manquant (test précédent échoué)");
    const r = await client.patch(
      `/admin/plans/${createdPlanId}`,
      { displayName: "Plan Test E2E — Modifié", priceMonthly: 5900 },
      ctx.adminToken,
    );
    assert.equal(r.status, 200, `Attendu 200, reçu ${r.status}: ${JSON.stringify(r.body)}`);
    const body = r.body as any;
    assert.equal(body.displayName, "Plan Test E2E — Modifié", "displayName non mis à jour");
    assert.equal(body.priceMonthly, 5900, "priceMonthly non mis à jour");
  });

  // ── Changement de plan d'un tenant
  await suite.test("POST /admin/plans/change → change le plan du tenant", async () => {
    assert.ok(createdPlanId, "createdPlanId manquant");
    const r = await client.post(
      "/admin/plans/change",
      { tenantId: ctx.tenantId, planId: createdPlanId },
      ctx.adminToken,
    );
    assert.ok([200, 201].includes(r.status), `Attendu 200/201, reçu ${r.status}: ${JSON.stringify(r.body)}`);
    const body = r.body as any;
    assert.ok(body.ok === true || body.subscription, "Réponse ok ou subscription attendue");
  });

  // ── Liste des abonnements
  await suite.test("GET /admin/subscriptions → liste les abonnements", async () => {
    const r = await client.get("/admin/subscriptions", ctx.adminToken);
    assert.equal(r.status, 200, `Attendu 200, reçu ${r.status}`);
    const body = r.body as any[];
    assert.ok(Array.isArray(body), "Réponse doit être un tableau");
  });

  // ── Supprimer le plan créé
  await suite.test("DELETE /admin/plans/:id → supprime le plan", async () => {
    assert.ok(createdPlanId, "createdPlanId manquant");
    const r = await client.delete(`/admin/plans/${createdPlanId}`, ctx.adminToken);
    assert.ok([200, 204].includes(r.status), `Attendu 200/204, reçu ${r.status}: ${JSON.stringify(r.body)}`);
    if (r.status === 200) {
      assert.ok((r.body as any).ok, "ok attendu dans la réponse");
    }
  });

  await ctx.cleanup();
  return suite.getResults();
}
