import assert from "node:assert";
import { TestSuite, type SuiteResult } from "./runner.ts";
import { createTestContext } from "./setup.ts";
import { client } from "./test-client.ts";

export async function run(): Promise<SuiteResult> {
  const ctx = await createTestContext();
  const suite = new TestSuite("Admin — Clés API Providers");

  const testProvider = "openai";

  // ── Sans auth → 401
  await suite.test("GET /admin/api-keys sans auth → 401", async () => {
    const r = await client.get("/admin/api-keys");
    assert.equal(r.status, 401, `Attendu 401, reçu ${r.status}`);
  });

  // ── Liste providers — structure correcte
  await suite.test("GET /admin/api-keys → liste providers et clés", async () => {
    const r = await client.get("/admin/api-keys", ctx.adminToken);
    assert.equal(r.status, 200, `Attendu 200, reçu ${r.status}: ${JSON.stringify(r.body)}`);
    const body = r.body as any;
    assert.ok(Array.isArray(body.providers), "providers doit être un tableau");
    assert.ok(Array.isArray(body.keys), "keys doit être un tableau");
    assert.ok(body.providers.length >= 1, "Doit avoir au moins 1 provider");
    for (const p of body.providers) {
      assert.ok(p.id, "id provider manquant");
      assert.ok(p.name, "name provider manquant");
      assert.ok(typeof p.configured === "boolean", "configured doit être un booléen");
    }
  });

  // ── Liste des providers supportés (route publique admin)
  await suite.test("GET /admin/api-keys/providers → liste statique des providers", async () => {
    const r = await client.get("/admin/api-keys/providers", ctx.adminToken);
    assert.equal(r.status, 200, `Attendu 200, reçu ${r.status}`);
    const body = r.body as any[];
    assert.ok(Array.isArray(body), "Réponse doit être un tableau");
    assert.ok(body.length >= 3, `Doit avoir au moins 3 providers, reçu ${body.length}`);
    const openai = body.find((p: any) => p.id === "openai");
    assert.ok(openai, "Provider openai manquant");
  });

  // ── Ajouter une clé (valeur fictive pour le test)
  await suite.test("POST /admin/api-keys → ajoute/met à jour une clé", async () => {
    const r = await client.post(
      "/admin/api-keys",
      {
        provider: testProvider,
        apiKey: `sk-test-${Date.now()}-e2e-fake-key`,
      },
      ctx.adminToken,
    );
    assert.equal(r.status, 201, `Attendu 201, reçu ${r.status}: ${JSON.stringify(r.body)}`);
    const body = r.body as any;
    assert.ok(body.id || body.provider, "id ou provider manquant");
    assert.ok(body.provider === testProvider || body.id, "Provider incorrect");
  });

  // ── Tester la clé (sans vraie clé → résultat invalide mais route réelle)
  await suite.test("POST /admin/api-keys/:provider/test → test de connectivité", async () => {
    const r = await client.post(
      `/admin/api-keys/${testProvider}/test`,
      { apiKey: `sk-test-${Date.now()}-e2e-fake` },
      ctx.adminToken,
    );
    assert.ok([200, 400, 401, 422, 500].includes(r.status), `Status inattendu: ${r.status}`);
    const body = r.body as any;
    assert.ok(typeof body.ok === "boolean" || body.error || body.message, "Réponse structurée attendue");
  });

  // ── Supprimer la clé
  await suite.test("DELETE /admin/api-keys/:provider → supprime la clé", async () => {
    const r = await client.delete(`/admin/api-keys/${testProvider}`, ctx.adminToken);
    assert.ok([200, 404].includes(r.status), `Attendu 200/404, reçu ${r.status}: ${JSON.stringify(r.body)}`);
    if (r.status === 200) {
      assert.ok((r.body as any).ok, "ok attendu");
    }
  });

  await ctx.cleanup();
  return suite.getResults();
}
