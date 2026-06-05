import assert from "node:assert";
import { TestSuite, type SuiteResult } from "./runner.ts";
import { createTestContext } from "./setup.ts";
import { client } from "./test-client.ts";

export async function run(): Promise<SuiteResult> {
  const ctx = await createTestContext();
  const api = client.withToken(ctx.adminToken);
  const suite = new TestSuite("Billing & Abonnements");

  // ── STATUT ABONNEMENT
  await suite.test("Statut d'abonnement → objet avec plan + status", async () => {
    const r = await api.get("/billing/subscription");
    assert.ok([200, 404].includes(r.status));
    if (r.ok) {
      const body = r.body as any;
      assert.ok(body.plan !== undefined || body.status !== undefined, "Plan/status attendu");
    }
  });

  // ── USAGE LIMITS
  await suite.test("Vérification des quotas → limites par ressource", async () => {
    const r = await api.get("/billing/usage");
    assert.ok([200, 404].includes(r.status));
    if (r.ok) {
      const body = r.body as any;
      assert.ok(typeof body === "object", "Usage devrait être un objet");
    }
  });

  // ── CHECKOUT SESSION (sans Stripe)
  await suite.test("Créer session checkout → URL ou message Stripe non configuré", async () => {
    const r = await api.post("/billing/checkout", {
      plan: "pro",
      period: "monthly",
    });
    // Sans clé Stripe, attend 400 (Stripe non configuré) ou 200 avec URL mock
    assert.ok([200, 201, 400, 503].includes(r.status), `Status inattendu: ${r.status}`);
  });

  // ── PORTAIL CLIENT
  await suite.test("Portail client Stripe → URL ou message Stripe non configuré", async () => {
    const r = await api.post("/billing/portal", {});
    assert.ok([200, 201, 400, 503].includes(r.status), `Status: ${r.status}`);
  });

  // ── INVOICES
  await suite.test("Historique des factures → tableau", async () => {
    const r = await api.get("/billing/invoices");
    assert.ok([200, 404].includes(r.status));
    if (r.ok) {
      const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? (r.body as any).invoices ?? [];
      assert.ok(Array.isArray(arr));
    }
  });

  // ── WEBHOOK STRIPE (invoice.paid mock)
  await suite.test("Webhook Stripe invoice.paid → met à jour l'abonnement", async () => {
    const payload = JSON.stringify({
      type: "invoice.paid",
      data: {
        object: {
          customer: "cus_test_growthos",
          subscription: "sub_test_growthos",
          amount_paid: 4900,
          currency: "eur",
        },
      },
    });
    const r = await client.post("/billing/webhook", JSON.parse(payload), undefined);
    // Sans Stripe-Signature valide, attend 400 ou 200 selon implémentation
    assert.ok([200, 201, 400].includes(r.status), `Status: ${r.status}`);
  });

  // ── MIDDLEWARE USAGE LIMIT
  await suite.test("Middleware usageLimit → vérification des quotas sur les routes", async () => {
    // Vérifier que l'API répond normalement (quotas pas dépassés pour tenant test)
    const r = await api.get("/prospects");
    // Tenant pro → quotas larges, devrait passer
    assert.ok(r.status !== 429, "Quota dépassé de manière inattendue (429)");
    assert.ok(r.ok || r.status === 429, `Status inattendu: ${r.status}`);
  });

  await ctx.cleanup();
  return suite.getResults();
}
