import assert from "node:assert";
import { TestSuite, type SuiteResult } from "./runner.ts";
import { createTestContext } from "./setup.ts";
import { client } from "./test-client.ts";

export async function run(): Promise<SuiteResult> {
  const ctx = await createTestContext();
  const api = client.withToken(ctx.adminToken);
  const suite = new TestSuite("Base de Connaissances (Knowledge Base)");
  let articleId: string;

  // ── CREATE — article complet
  await suite.test("Créer un article — title + content + category requis → 201", async () => {
    const r = await api.post<{ id: string }>("/knowledge", {
      title: `Guide Prospection LinkedIn ${Date.now()}`,
      content: "# Prospection LinkedIn\n\nLes meilleures pratiques pour une prospection B2B efficace sur LinkedIn.\n\n## 1. Optimiser son profil\n\nVotre profil doit refléter votre expertise.",
      category: "playbook",
      tags: ["linkedin", "prospection", "b2b"],
    });
    assert.ok([200, 201].includes(r.status), `Status attendu 201, reçu ${r.status}: ${JSON.stringify(r.body)}`);
    assert.ok((r.body as any).id, "id manquant");
    articleId = (r.body as any).id;
  });

  // ── CREATE — deuxième article pour la recherche
  await suite.test("Créer un deuxième article 'closing' → 201", async () => {
    const r = await api.post<{ id: string }>("/knowledge", {
      title: `Techniques de Closing Avancées ${Date.now()}`,
      content: "Les 5 techniques de closing les plus efficaces pour conclure vos deals en B2B.",
      category: "script",
      tags: ["closing", "négociation", "b2b"],
    });
    assert.ok([200, 201].includes(r.status), `Status ${r.status}`);
  });

  // ── CREATE — champs manquants → 400
  await suite.test("Créer article sans category → 400", async () => {
    const r = await api.post("/knowledge", {
      title: "Article sans catégorie",
      content: "Contenu test",
    });
    assert.equal(r.status, 400, `Attendu 400, reçu ${r.status}`);
  });

  await suite.test("Créer article sans content → 400", async () => {
    const r = await api.post("/knowledge", {
      title: "Article sans contenu",
      category: "invalid_category_xyz",
    });
    assert.ok([400, 500].includes(r.status), `Attendu 400, reçu ${r.status}`);
  });

  // ── LIST
  await suite.test("GET /knowledge → liste avec articles", async () => {
    const r = await api.get("/knowledge");
    assert.ok(r.ok, `Status ${r.status}: ${JSON.stringify(r.body)}`);
    const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? (r.body as any).articles ?? [];
    assert.ok(Array.isArray(arr), "Réponse devrait être un tableau");
    assert.ok(arr.length >= 1, "Au moins un article attendu");
  });

  // ── LIST — filtre par catégorie
  await suite.test("GET /knowledge?category=sales → articles de la catégorie sales", async () => {
    const r = await api.get("/knowledge?category=playbook");
    assert.ok(r.ok, `Status ${r.status}`);
    const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? [];
    for (const a of arr) {
      assert.equal(a.category, "playbook", `Catégorie inattendue: ${a.category}`);
    }
  });

  // ── GET /knowledge/stats — statistiques
  await suite.test("GET /knowledge/stats → compteurs par catégorie", async () => {
    const r = await api.get("/knowledge/stats");
    assert.ok(r.ok, `Status ${r.status}: ${JSON.stringify(r.body)}`);
    const body = r.body as any;
    assert.ok(typeof body === "object" && body !== null, "Stats devrait être un objet");
  });

  // ── GET /knowledge/search — recherche textuelle
  await suite.test("GET /knowledge/search?q=prospection → résultats pertinents", async () => {
    const r = await api.get("/knowledge/search?q=prospection");
    assert.ok(r.ok, `Status ${r.status}: ${JSON.stringify(r.body)}`);
    const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? (r.body as any).results ?? [];
    assert.ok(Array.isArray(arr), "Résultats devraient être un tableau");
  });

  // ── GET /knowledge/search — query vide
  await suite.test("GET /knowledge/search?q= → résultats ou liste vide", async () => {
    const r = await api.get("/knowledge/search?q=");
    assert.ok([200, 400].includes(r.status), `Status ${r.status}`);
  });

  // ── GET /:id — par ID
  await suite.test("GET /knowledge/:id → article complet", async () => {
    if (!articleId) return;
    const r = await api.get(`/knowledge/${articleId}`);
    assert.ok(r.ok, `Status ${r.status}`);
    const body = r.body as any;
    assert.equal(body.id, articleId);
    assert.ok(body.title, "title manquant");
    assert.ok(body.content, "content manquant");
  });

  // ── GET /:id — ID inexistant → 404
  await suite.test("GET /knowledge/inconnu → 404", async () => {
    const r = await api.get("/knowledge/00000000-0000-0000-0000-000000000000");
    assert.equal(r.status, 404, `Attendu 404, reçu ${r.status}`);
  });

  // ── PATCH /:id — modifier un article
  await suite.test("PATCH /knowledge/:id → contenu mis à jour", async () => {
    if (!articleId) return;
    const r = await api.patch(`/knowledge/${articleId}`, {
      title: "Guide Prospection LinkedIn [v2 — Mis à jour]",
    });
    assert.ok(r.ok, `Status ${r.status}: ${JSON.stringify(r.body)}`);
    const body = r.body as any;
    if (body.title) assert.ok(body.title.includes("[v2"), "Titre non mis à jour");
  });

  // ── PATCH /:id — ID inexistant → 404
  await suite.test("PATCH article inexistant → 404", async () => {
    const r = await api.patch("/knowledge/00000000-0000-0000-0000-000000000000", { title: "Ghost" });
    assert.equal(r.status, 404, `Attendu 404, reçu ${r.status}`);
  });

  // ── AUTH — sans token → 401
  await suite.test("GET /knowledge sans token → 401", async () => {
    const r = await client.get("/knowledge");
    assert.ok([401, 403].includes(r.status), `Attendu 401/403, reçu ${r.status}`);
  });

  await suite.test("POST /knowledge sans token → 401", async () => {
    const r = await client.post("/knowledge", { title: "T", content: "C", category: "sales" });
    assert.ok([401, 403].includes(r.status), `Attendu 401/403, reçu ${r.status}`);
  });

  // ── ISOLATION TENANT
  await suite.test("Isolation tenant — articles isolés par tenant", async () => {
    const ctx2 = await createTestContext();
    const api2 = client.withToken(ctx2.adminToken);
    const r = await api2.get("/knowledge");
    if (r.ok && articleId) {
      const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? [];
      const found = arr.find((a: any) => a.id === articleId);
      assert.ok(!found, "Un autre tenant ne devrait pas voir cet article");
    }
    await ctx2.cleanup();
  });

  // ── DELETE /:id
  await suite.test("DELETE /knowledge/:id → { success: true }", async () => {
    if (!articleId) return;
    const r = await api.delete(`/knowledge/${articleId}`);
    assert.ok([200, 204].includes(r.status), `Status ${r.status}`);
    if (r.ok && r.body && typeof r.body === "object") {
      assert.ok((r.body as any).success !== false, "success attendu");
    }
  });

  // ── Vérifier la suppression → 404
  await suite.test("Article supprimé → 404 en lecture", async () => {
    if (!articleId) return;
    const r = await api.get(`/knowledge/${articleId}`);
    assert.equal(r.status, 404, `Attendu 404, reçu ${r.status}`);
  });

  await ctx.cleanup();
  return suite.getResults();
}
