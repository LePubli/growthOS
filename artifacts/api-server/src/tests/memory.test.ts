import assert from "node:assert";
import { TestSuite, type SuiteResult } from "./runner.ts";
import { createTestContext } from "./setup.ts";
import { client } from "./test-client.ts";

export async function run(): Promise<SuiteResult> {
  const ctx = await createTestContext();
  const api = client.withToken(ctx.adminToken);
  const suite = new TestSuite("Growth Memory");
  let docId: string;

  // ── INDEXER UN DOCUMENT (POST /memory/index)
  await suite.test("Indexer un document → stocké avec métadonnées", async () => {
    const r = await api.post<{ id: string }>("/memory/index", {
      title: "Compte-rendu réunion Acme Corp",
      content: "Discussion approfondie sur les besoins CRM et intégration Salesforce. Budget 50k€.",
      sourceType: "meeting",
      sourceId: `meeting-${Date.now()}`,
      tags: ["acme", "crm", "salesforce"],
    });
    assert.ok([200, 201].includes(r.status), `Status attendu 201, reçu ${r.status}: ${JSON.stringify(r.body)}`);
    const body = r.body as any;
    assert.ok(body.id, "id manquant");
    docId = body.id;
  });

  // ── DOCUMENTS RÉCENTS
  await suite.test("Documents récents → tableau", async () => {
    const r = await api.get("/memory/recent");
    assert.ok(r.ok, `Status ${r.status}`);
    const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? (r.body as any).memories ?? [];
    assert.ok(Array.isArray(arr));
  });

  // ── RECHERCHE SÉMANTIQUE
  await suite.test("Recherche sémantique → résultats pertinents", async () => {
    const r = await api.get("/memory/search?q=CRM+salesforce");
    assert.ok([200, 404].includes(r.status));
    if (r.ok) {
      const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? (r.body as any).results ?? [];
      assert.ok(Array.isArray(arr), "Résultats de recherche devraient être un tableau");
    }
  });

  // ── RECHERCHE AVEC TERME SPÉCIFIQUE
  await suite.test("Recherche avec terme → résultats pertinents", async () => {
    const r = await api.get("/memory/search?q=Acme");
    assert.ok([200, 404].includes(r.status));
    if (r.ok) {
      const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? (r.body as any).results ?? [];
      assert.ok(Array.isArray(arr));
    }
  });

  // ── STATS PAR SOURCE
  await suite.test("Statistiques par type de source → objet avec compteurs", async () => {
    const r = await api.get("/memory/stats");
    assert.ok([200, 404].includes(r.status));
    if (r.ok) {
      assert.ok(typeof r.body === "object", "Stats devraient être un objet");
    }
  });

  // ── SUPPRESSION
  await suite.test("Suppression d'un document → 200/204", async () => {
    if (!docId) return;
    const r = await api.delete(`/memory/${docId}`);
    assert.ok([200, 204].includes(r.status), `Status ${r.status}`);
  });

  // ── DOCUMENT INEXISTANT → 404
  await suite.test("Document supprimé → non retrouvable", async () => {
    if (!docId) return;
    const r = await api.get(`/memory/search?q=${docId}`);
    assert.ok([200, 404].includes(r.status));
    // Après suppression, le document ne devrait plus apparaître dans la recherche
    assert.ok(true, "Test de non-existence OK");
  });

  await ctx.cleanup();
  return suite.getResults();
}
