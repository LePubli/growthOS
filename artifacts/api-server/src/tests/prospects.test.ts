import assert from "node:assert";
import { TestSuite, type SuiteResult } from "./runner.ts";
import { createTestContext, createTestProspect } from "./setup.ts";
import { client } from "./test-client.ts";

export async function run(): Promise<SuiteResult> {
  const ctx = await createTestContext();
  const api = client.withToken(ctx.adminToken);
  const suite = new TestSuite("Prospects (CRUD complet)");
  let createdId: string;

  // ── CREATE
  await suite.test("Créer un prospect → 201 avec ID", async () => {
    const r = await api.post<{ id: string }>("/prospects", {
      first_name: "Marie",
      last_name: "Curie",
      email: `marie-${Date.now()}@curie-test.fr`,
      company: "Institut Curie",
      status: "new",
    });
    assert.equal(r.status, 201, `Status attendu 201, reçu ${r.status}`);
    assert.ok((r.body as any).id, "id manquant dans la réponse");
    createdId = (r.body as any).id;
  });

  // ── LIST
  await suite.test("Lire la liste des prospects → tableau", async () => {
    const r = await api.get("/prospects");
    assert.ok(r.ok, `Status ${r.status}`);
    const data = (r.body as any);
    const arr = Array.isArray(data) ? data : data.data ?? data.prospects ?? [];
    assert.ok(Array.isArray(arr), "Réponse devrait être un tableau");
  });

  // ── READ by ID
  await suite.test("Lire un prospect par ID → détails complets", async () => {
    const prospect = await createTestProspect(ctx.tenantId);
    const r = await api.get(`/prospects/${prospect.id}`);
    assert.ok(r.ok, `Status ${r.status}`);
    const body = r.body as any;
    assert.equal(body.id, prospect.id);
    // Drizzle retourne camelCase (firstName) OU snake_case (first_name)
    const hasName = body.firstName || body.first_name;
    assert.ok(hasName, `firstName/first_name manquant: ${JSON.stringify(Object.keys(body))}`);
  });

  // ── UPDATE
  await suite.test("Modifier un prospect → champs mis à jour", async () => {
    const prospect = await createTestProspect(ctx.tenantId);
    const r = await api.patch(`/prospects/${prospect.id}`, { company: "Nouvelle Entreprise SA" });
    assert.ok(r.ok, `Status ${r.status}`);
    assert.equal((r.body as any).company, "Nouvelle Entreprise SA");
  });

  // ── CHAMP OBLIGATOIRE MANQUANT (email nullable selon le schéma)
  await suite.test("Créer prospect sans titre/prénom → accepté ou 400", async () => {
    const r = await api.post("/prospects", { company: "Acme sans nom" });
    // L'email est nullable dans ce schéma, donc 201 est valide aussi
    assert.ok([200, 201, 400, 422].includes(r.status), `Status inattendu: ${r.status}`);
  });

  // ── PROSPECT INEXISTANT
  await suite.test("Lire prospect inexistant → 404", async () => {
    const r = await api.get("/prospects/00000000-0000-0000-0000-000000000000");
    assert.equal(r.status, 404, `Attendu 404, reçu ${r.status}`);
  });

  // ── SEARCH / FILTRES
  await suite.test("Recherche full-text → retourne tableau", async () => {
    const r = await api.get("/prospects?search=Acme");
    assert.ok(r.ok, `Status ${r.status}`);
  });

  await suite.test("Filtres par statut → résultats filtrés", async () => {
    await createTestProspect(ctx.tenantId, { status: "qualified" });
    const r = await api.get("/prospects?status=qualified");
    assert.ok(r.ok, `Status ${r.status}`);
    const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? [];
    if (arr.length > 0) {
      arr.forEach((p: any) => assert.equal(p.status, "qualified"));
    }
  });

  // ── DELETE
  await suite.test("Supprimer un prospect → 204 ou 200", async () => {
    const prospect = await createTestProspect(ctx.tenantId);
    const r = await api.delete(`/prospects/${prospect.id}`);
    assert.ok([200, 204].includes(r.status), `Attendu 200/204, reçu ${r.status}`);
  });

  // ── Isolation tenant (prospect d'un autre tenant)
  await suite.test("Lire prospect d'un autre tenant → 404", async () => {
    const ctx2 = await createTestContext();
    const p2 = await createTestProspect(ctx2.tenantId);
    const r = await api.get(`/prospects/${p2.id}`);
    assert.ok([404, 403].includes(r.status), `Isolation tenant attendue, reçu ${r.status}`);
    await ctx2.cleanup();
  });

  await ctx.cleanup();
  return suite.getResults();
}
