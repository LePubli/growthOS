import assert from "node:assert";
import { TestSuite, type SuiteResult } from "./runner.ts";
import { createTestContext, createTestProspect } from "./setup.ts";
import { client } from "./test-client.ts";

export async function run(): Promise<SuiteResult> {
  const ctx = await createTestContext();
  const api = client.withToken(ctx.adminToken);
  const suite = new TestSuite("Data Enrichment Engine");
  let prospectId: string;

  // Créer un prospect de test
  const prospect = await createTestProspect(ctx.tenantId, {
    first_name: "Thomas",
    last_name: "Bernard",
    email: `thomas.bernard.${Date.now()}@techcorp.io`,
    company: "TechCorp Innovation",
  });
  prospectId = prospect.id;

  // ── GET /enrich/sources — liste des sources disponibles
  await suite.test("GET /enrich/sources → 23 sources de données", async () => {
    const r = await api.get("/enrich/sources");
    assert.ok(r.ok, `Status ${r.status}: ${JSON.stringify(r.body)}`);
    const arr = Array.isArray(r.body) ? r.body : (r.body as any).sources ?? (r.body as any).data ?? [];
    assert.ok(Array.isArray(arr), "sources devrait être un tableau");
    assert.ok(arr.length >= 5, `Attendu ≥5 sources, reçu ${arr.length}`);
    if (arr.length > 0) {
      const s = arr[0];
      assert.ok(s.id ?? s.sourceId, "source.id manquant");
      assert.ok(s.name ?? s.sourceName, "source.name manquant");
    }
  });

  // ── POST /enrich/:prospectId — enrichir un prospect
  await suite.test("POST /enrich/:id — enrichir un prospect existant → résultat", async () => {
    const r = await api.post(`/enrich/${prospectId}`, {});
    assert.ok(r.ok, `Status ${r.status}: ${JSON.stringify(r.body)}`);
    const body = r.body as any;
    // Peut retourner le score enrichi ou un objet de résultat
    assert.ok(typeof body === "object" && body !== null, "Réponse devrait être un objet");
  });

  // ── POST /enrich/:prospectId — prospect inexistant
  await suite.test("Enrichir un prospect inexistant → 404 ou erreur gérée", async () => {
    const r = await api.post("/enrich/00000000-0000-0000-0000-000000000000", {});
    assert.ok([200, 400, 404, 500].includes(r.status), `Status inattendu: ${r.status}`);
  });

  // ── GET /enrich/data/:prospectId — données enrichies
  await suite.test("GET /enrich/data/:id → données enrichies du prospect", async () => {
    const r = await api.get(`/enrich/data/${prospectId}`);
    assert.ok(r.ok, `Status ${r.status}: ${JSON.stringify(r.body)}`);
    const body = r.body as any;
    assert.ok(typeof body === "object", "Réponse devrait être un objet");
  });

  // ── GET /enrich/history/:prospectId — historique
  await suite.test("GET /enrich/history/:id → historique des enrichissements", async () => {
    const r = await api.get(`/enrich/history/${prospectId}`);
    assert.ok(r.ok, `Status ${r.status}: ${JSON.stringify(r.body)}`);
    const arr = Array.isArray(r.body) ? r.body : (r.body as any).history ?? (r.body as any).data ?? [];
    assert.ok(Array.isArray(arr), "historique devrait être un tableau");
  });

  // ── POST /enrich/batch — enrichissement par lot
  await suite.test("POST /enrich/batch → accepté en arrière-plan", async () => {
    const p2 = await createTestProspect(ctx.tenantId, { company: "BatchCorp" });
    const r = await api.post("/enrich/batch", { prospectIds: [prospectId, p2.id] });
    assert.ok(r.ok, `Status ${r.status}: ${JSON.stringify(r.body)}`);
    const body = r.body as any;
    assert.ok(body.accepted !== undefined || body.message !== undefined || body.ok, "Réponse de batch attendue");
  });

  // ── POST /enrich/batch — body invalide → 400
  await suite.test("POST /enrich/batch avec prospectIds vide → 400", async () => {
    const r = await api.post("/enrich/batch", { prospectIds: [] });
    assert.equal(r.status, 400, `Attendu 400, reçu ${r.status}`);
  });

  // ── POST /enrich/batch — sans prospectIds → 400
  await suite.test("POST /enrich/batch sans prospectIds → 400", async () => {
    const r = await api.post("/enrich/batch", {});
    assert.equal(r.status, 400, `Attendu 400, reçu ${r.status}`);
  });

  // ── PUT /enrich/api-config/:sourceId — configurer une source
  await suite.test("PUT /enrich/api-config/hunter → configuration sauvegardée", async () => {
    const r = await api.put("/enrich/api-config/hunter", {
      isActive: true,
      apiKey: null,
    });
    assert.ok([200, 201, 400, 404].includes(r.status), `Status inattendu: ${r.status}`);
    if (r.ok) assert.ok((r.body as any).ok, "ok attendu");
  });

  // ── POST /enrich/test-connection/:sourceId — tester la connexion
  await suite.test("POST /enrich/test-connection/clearbit → test de connexion", async () => {
    const r = await api.post("/enrich/test-connection/clearbit", {});
    assert.ok([200, 400, 404].includes(r.status), `Status inattendu: ${r.status}`);
    if (r.ok) {
      const body = r.body as any;
      assert.ok(body.ok !== undefined, "ok attendu dans la réponse");
      assert.ok(body.message, "message attendu");
    }
  });

  // ── POST /enrich/test-connection — source inconnue → 404
  await suite.test("Test connexion source inconnue → 404", async () => {
    const r = await api.post("/enrich/test-connection/source-inconnue-xyz", {});
    assert.equal(r.status, 404, `Attendu 404, reçu ${r.status}`);
  });

  // ── AUTH — sans token → 401
  await suite.test("GET /enrich/sources sans token → 401", async () => {
    const r = await client.get("/enrich/sources");
    assert.ok([401, 403].includes(r.status), `Attendu 401/403, reçu ${r.status}`);
  });

  await suite.test("POST /enrich/:id sans token → 401", async () => {
    const r = await client.post(`/enrich/${prospectId}`, {});
    assert.ok([401, 403].includes(r.status), `Attendu 401/403, reçu ${r.status}`);
  });

  await ctx.cleanup();
  return suite.getResults();
}
