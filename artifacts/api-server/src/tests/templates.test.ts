import assert from "node:assert";
import { TestSuite, type SuiteResult } from "./runner.ts";
import { createTestContext } from "./setup.ts";
import { client } from "./test-client.ts";

export async function run(): Promise<SuiteResult> {
  const ctx = await createTestContext();
  const api = client.withToken(ctx.adminToken);
  const suite = new TestSuite("Templates Email (CRUD)");
  let templateId: string;
  let outreachId: string;

  // ── CREATE — template outreach
  await suite.test("Créer un template 'outreach' → 201", async () => {
    const r = await api.post<{ id: string }>("/templates", {
      name: `Template Découverte ${Date.now()}`,
      subject: "{{prenom}}, avez-vous 15 min pour {{entreprise}} ?",
      body: "Bonjour {{prenom}},\n\nJe me permets de vous contacter car {{entreprise}} correspond parfaitement à notre cible.\n\nCordialement,\n{{expediteur}}",
      category: "outreach",
      variables: ["prenom", "entreprise", "expediteur"],
    });
    assert.ok([200, 201].includes(r.status), `Status attendu 201, reçu ${r.status}: ${JSON.stringify(r.body)}`);
    assert.ok((r.body as any).id, "id manquant");
    templateId = (r.body as any).id;
    outreachId = templateId;
  });

  // ── CREATE — template followup
  await suite.test("Créer un template 'followup' → 201", async () => {
    const r = await api.post<{ id: string }>("/templates", {
      name: `Relance J+3 ${Date.now()}`,
      subject: "Suivi de mon message — {{entreprise}}",
      body: "Bonjour {{prenom}},\n\nJe me permets de revenir vers vous suite à mon précédent email.\n\nAvez-vous eu l'occasion de le lire ?",
      category: "followup",
      variables: ["prenom", "entreprise"],
    });
    assert.ok([200, 201].includes(r.status), `Status ${r.status}`);
  });

  // ── CREATE — template closing
  await suite.test("Créer un template 'closing' → 201", async () => {
    const r = await api.post<{ id: string }>("/templates", {
      name: `Proposition finale ${Date.now()}`,
      subject: "Votre proposition personnalisée — {{montant}}",
      body: "Bonjour {{prenom}},\n\nJe vous adresse ci-joint notre proposition commerciale pour {{entreprise}}.\n\nMontant : {{montant}}",
      category: "closing",
      variables: ["prenom", "entreprise", "montant"],
    });
    assert.ok([200, 201].includes(r.status));
  });

  // ── CREATE — template nurturing
  await suite.test("Créer un template 'nurturing' → 201", async () => {
    const r = await api.post<{ id: string }>("/templates", {
      name: `Newsletter mensuelle ${Date.now()}`,
      subject: "Les actus de {{secteur}} ce mois-ci",
      body: "Bonjour {{prenom}},\n\nVoici les dernières nouvelles de votre secteur {{secteur}}.",
      category: "nurturing",
      variables: ["prenom", "secteur"],
    });
    assert.ok([200, 201].includes(r.status));
  });

  // ── LIST — tous les templates
  await suite.test("Lister tous les templates → tableau non vide", async () => {
    const r = await api.get("/templates");
    assert.ok(r.ok, `Status ${r.status}`);
    const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? [];
    assert.ok(Array.isArray(arr), "Réponse devrait être un tableau");
    assert.ok(arr.length >= 1, "Au moins un template attendu");
  });

  // ── LIST — filtre par catégorie
  await suite.test("Filtrer les templates par catégorie 'outreach' → catégorie correcte", async () => {
    const r = await api.get("/templates?category=outreach");
    assert.ok(r.ok, `Status ${r.status}`);
    const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? [];
    for (const t of arr) {
      assert.equal(t.category, "outreach", `Catégorie inattendue: ${t.category}`);
    }
  });

  // ── GET by ID
  await suite.test("Lire un template par ID → détails complets", async () => {
    if (!templateId) return;
    const r = await api.get(`/templates/${templateId}`);
    assert.ok(r.ok, `Status ${r.status}`);
    const body = r.body as any;
    assert.equal(body.id, templateId);
    assert.ok(body.name, "name manquant");
    assert.ok(body.subject, "subject manquant");
    assert.ok(body.body ?? body.content, "body/content manquant");
  });

  // ── GET — ID inexistant → 404
  await suite.test("Lire un template inexistant → 404", async () => {
    const r = await api.get("/templates/00000000-0000-0000-0000-000000000000");
    assert.equal(r.status, 404, `Attendu 404, reçu ${r.status}`);
  });

  // ── PATCH — modifier le sujet
  await suite.test("Modifier le sujet d'un template → mis à jour", async () => {
    if (!templateId) return;
    const r = await api.patch(`/templates/${templateId}`, {
      subject: "{{prenom}}, 10 min suffisent pour {{entreprise}} !",
    });
    assert.ok(r.ok, `Status ${r.status}: ${JSON.stringify(r.body)}`);
    const subject = (r.body as any).subject;
    if (subject) assert.ok(subject.includes("10 min"), "Sujet non mis à jour");
  });

  // ── PATCH — modifier la catégorie
  await suite.test("Changer la catégorie d'un template → other", async () => {
    if (!templateId) return;
    const r = await api.patch(`/templates/${templateId}`, { category: "other" });
    assert.ok(r.ok, `Status ${r.status}`);
    const cat = (r.body as any).category;
    if (cat) assert.equal(cat, "other");
  });

  // ── PATCH — catégorie invalide → 400
  await suite.test("Catégorie invalide → 400", async () => {
    if (!templateId) return;
    const r = await api.patch(`/templates/${templateId}`, { category: "invalid_category" });
    assert.equal(r.status, 400, `Attendu 400, reçu ${r.status}`);
  });

  // ── USE — incrémenter le compteur
  await suite.test("POST /:id/use — incrémenter le compteur d'utilisation", async () => {
    if (!outreachId) return;
    const r = await api.post(`/templates/${outreachId}/use`, {});
    assert.ok(r.ok, `Status ${r.status}`);
    assert.ok((r.body as any).ok, "Réponse ok attendue");
  });

  // ── USE — vérifier que used_count a augmenté
  await suite.test("Après use, used_count ≥ 1", async () => {
    if (!outreachId) return;
    await api.post(`/templates/${outreachId}/use`, {});
    const r = await api.get(`/templates/${outreachId}`);
    if (r.ok) {
      const count = (r.body as any).usedCount ?? (r.body as any).used_count;
      if (count !== undefined) assert.ok(count >= 1, `used_count devrait être ≥ 1, reçu ${count}`);
    }
  });

  // ── VALIDATION — champs obligatoires manquants → 400
  await suite.test("Créer un template sans name → 400", async () => {
    const r = await api.post("/templates", {
      subject: "Sujet sans nom",
      body: "Corps du message",
      category: "outreach",
    });
    assert.equal(r.status, 400, `Attendu 400, reçu ${r.status}`);
  });

  // ── AUTH — sans token → 401
  await suite.test("Accès sans token → 401", async () => {
    const r = await client.get("/templates");
    assert.ok([401, 403].includes(r.status), `Attendu 401/403, reçu ${r.status}`);
  });

  // ── ISOLATION TENANT
  await suite.test("Isolation tenant — autre tenant ne voit pas les templates", async () => {
    const ctx2 = await createTestContext();
    const api2 = client.withToken(ctx2.adminToken);
    const r = await api2.get("/templates");
    if (r.ok) {
      const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? [];
      const found = arr.find((t: any) => t.id === templateId);
      assert.ok(!found, "Un autre tenant ne devrait pas voir ce template");
    }
    await ctx2.cleanup();
  });

  // ── DELETE
  await suite.test("Supprimer un template → 200/204", async () => {
    if (!templateId) return;
    const r = await api.delete(`/templates/${templateId}`);
    assert.ok([200, 204].includes(r.status), `Status ${r.status}`);
  });

  // ── Vérifier la suppression
  await suite.test("Template supprimé → 404 en lecture", async () => {
    if (!templateId) return;
    const r = await api.get(`/templates/${templateId}`);
    assert.ok([404, 400].includes(r.status), `Attendu 404, reçu ${r.status}`);
  });

  await ctx.cleanup();
  return suite.getResults();
}
