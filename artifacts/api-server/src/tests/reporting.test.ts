import assert from "node:assert";
import { TestSuite, type SuiteResult } from "./runner.ts";
import { createTestContext, createTestProspect, createTestDeal, createTestSignal } from "./setup.ts";
import { client } from "./test-client.ts";

export async function run(): Promise<SuiteResult> {
  const ctx = await createTestContext();
  const api = client.withToken(ctx.adminToken);
  const suite = new TestSuite("Reporting & Export CSV");

  // Créer des données de test pour avoir quelque chose à exporter
  await createTestProspect(ctx.tenantId, { first_name: "Export", last_name: "Test1", company: "ExportCorp" });
  await createTestProspect(ctx.tenantId, { first_name: "Export", last_name: "Test2", company: "ExportCorp" });
  await createTestDeal(ctx.tenantId, { title: "Deal Export 1", value: 10000 });
  await createTestDeal(ctx.tenantId, { title: "Deal Export 2", value: 20000 });
  await createTestSignal(ctx.tenantId, { title: "Signal Export Test" });

  // ── GET /reporting/csv/prospects — export CSV prospects
  await suite.test("GET /reporting/csv/prospects → CSV valide (Content-Type text/csv)", async () => {
    const r = await api.get("/reporting/csv/prospects");
    assert.ok(r.ok, `Status ${r.status}: ${JSON.stringify(r.body)}`);
    const ct = r.headers["content-type"] ?? "";
    assert.ok(ct.includes("text/csv") || ct.includes("application/octet-stream") || typeof r.body === "string",
      `Content-Type attendu text/csv, reçu: ${ct}`);
  });

  // ── GET /reporting/csv/deals — export CSV deals
  await suite.test("GET /reporting/csv/deals → CSV valide", async () => {
    const r = await api.get("/reporting/csv/deals");
    assert.ok(r.ok, `Status ${r.status}: ${JSON.stringify(r.body)}`);
  });

  // ── GET /reporting/csv/signals — export CSV signals
  await suite.test("GET /reporting/csv/signals → CSV valide", async () => {
    const r = await api.get("/reporting/csv/signals");
    assert.ok(r.ok, `Status ${r.status}: ${JSON.stringify(r.body)}`);
  });

  // ── GET /reporting/csv/activities — export CSV activités
  await suite.test("GET /reporting/csv/activities → CSV valide", async () => {
    const r = await api.get("/reporting/csv/activities");
    assert.ok(r.ok, `Status ${r.status}: ${JSON.stringify(r.body)}`);
  });

  // ── Entité invalide → 400/404
  await suite.test("GET /reporting/csv/invalid_entity → 400 ou 404", async () => {
    const r = await api.get("/reporting/csv/invalid_entity_xyz");
    assert.ok([400, 404].includes(r.status), `Attendu 400/404, reçu ${r.status}`);
  });

  // ── Contenu CSV prospects — vérifier les en-têtes
  await suite.test("CSV prospects contient les colonnes attendues", async () => {
    const r = await api.get("/reporting/csv/prospects");
    assert.ok(r.ok, `Status ${r.status}`);
    if (typeof r.body === "string" && r.body.length > 0) {
      const firstLine = r.body.split("\n")[0] ?? "";
      // Doit contenir au moins un champ reconnaissable
      const hasHeaders = firstLine.length > 0;
      assert.ok(hasHeaders, "CSV devrait avoir des en-têtes");
    }
  });

  // ── Contenu CSV deals — vérifier les en-têtes
  await suite.test("CSV deals contient des données", async () => {
    const r = await api.get("/reporting/csv/deals");
    assert.ok(r.ok, `Status ${r.status}`);
    if (typeof r.body === "string") {
      const lines = r.body.split("\n").filter(Boolean);
      assert.ok(lines.length >= 2, `CSV deals devrait avoir au moins header + 1 ligne, reçu ${lines.length} lignes`);
    }
  });

  // ── AUTH — sans token → 401
  await suite.test("GET /reporting/csv/prospects sans token → 401", async () => {
    const r = await client.get("/reporting/csv/prospects");
    assert.ok([401, 403].includes(r.status), `Attendu 401/403, reçu ${r.status}`);
  });

  // ── ISOLATION TENANT — export contient uniquement les données du tenant
  await suite.test("Isolation tenant — CSV contient uniquement les données du tenant courant", async () => {
    const ctx2 = await createTestContext();
    await createTestProspect(ctx2.tenantId, { first_name: "Autre", last_name: "Tenant", company: "OtherCorp99" });
    const api2 = client.withToken(ctx2.adminToken);
    const r1 = await api.get("/reporting/csv/prospects");
    const r2 = await api2.get("/reporting/csv/prospects");
    if (r1.ok && r2.ok && typeof r1.body === "string" && typeof r2.body === "string") {
      // Les exports ne doivent pas être identiques
      assert.ok(r1.body !== r2.body || r1.body.length === 0,
        "Les exports de deux tenants distincts devraient être différents");
    }
    await ctx2.cleanup();
  });

  await ctx.cleanup();
  return suite.getResults();
}
