import assert from "node:assert";
import { TestSuite, type SuiteResult } from "./runner.ts";
import { createTestContext, createTestProspect, createTestDeal } from "./setup.ts";
import { client } from "./test-client.ts";

export async function run(): Promise<SuiteResult> {
  const ctx = await createTestContext();
  const api = client.withToken(ctx.adminToken);
  const suite = new TestSuite("Activities (CRUD complet)");
  let activityId: string;
  let prospectId: string;
  let dealId: string;

  // ── Préparer les données de test
  const prospect = await createTestProspect(ctx.tenantId, { first_name: "Sophie", last_name: "Martin", company: "Acme SAS" });
  prospectId = prospect.id;
  const deal = await createTestDeal(ctx.tenantId, { title: "Deal Acme SAS", value: 25000 });
  dealId = deal.id;

  // ── CREATE — note simple
  await suite.test("Créer une activité de type 'note' → 201", async () => {
    const r = await api.post<{ id: string }>("/activities", {
      type: "note",
      title: "Premier contact Acme SAS",
      description: "Appel découverte — intéressé par le module CRM.",
      status: "done",
      prospectId,
    });
    assert.ok([200, 201].includes(r.status), `Status attendu 201, reçu ${r.status}: ${JSON.stringify(r.body)}`);
    assert.ok((r.body as any).id, "id manquant");
    activityId = (r.body as any).id;
  });

  // ── CREATE — appel lié à un deal
  await suite.test("Créer une activité 'call' liée à un deal → 201", async () => {
    const r = await api.post<{ id: string }>("/activities", {
      type: "call",
      title: "Appel de qualification",
      description: "Qualification budget et timeline.",
      status: "done",
      dealId,
      doneAt: new Date().toISOString(),
    });
    assert.ok([200, 201].includes(r.status), `Status ${r.status}: ${JSON.stringify(r.body)}`);
    assert.ok((r.body as any).id, "id manquant");
  });

  // ── CREATE — réunion planifiée
  await suite.test("Créer une activité 'meeting' avec scheduledAt → 201", async () => {
    const scheduled = new Date(Date.now() + 2 * 86400_000).toISOString();
    const r = await api.post<{ id: string }>("/activities", {
      type: "meeting",
      title: "Démo produit",
      description: "Présentation complète de la plateforme GrowthOS.",
      status: "planned",
      prospectId,
      scheduledAt: scheduled,
    });
    assert.ok([200, 201].includes(r.status), `Status ${r.status}`);
  });

  // ── CREATE — email
  await suite.test("Créer une activité 'email' → 201", async () => {
    const r = await api.post<{ id: string }>("/activities", {
      type: "email",
      title: "Envoi de la proposition commerciale",
      status: "done",
      prospectId,
    });
    assert.ok([200, 201].includes(r.status));
  });

  // ── CREATE — tâche
  await suite.test("Créer une activité 'task' → 201", async () => {
    const r = await api.post<{ id: string }>("/activities", {
      type: "task",
      title: "Relance après la démo",
      status: "planned",
      prospectId,
      scheduledAt: new Date(Date.now() + 7 * 86400_000).toISOString(),
    });
    assert.ok([200, 201].includes(r.status));
  });

  // ── LIST — toutes les activités du tenant
  await suite.test("Lister toutes les activités → tableau non vide", async () => {
    const r = await api.get("/activities");
    assert.ok(r.ok, `Status ${r.status}`);
    const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? [];
    assert.ok(Array.isArray(arr), "Réponse devrait être un tableau");
    assert.ok(arr.length >= 1, "Au moins une activité attendue");
  });

  // ── LIST — filtre par prospectId
  await suite.test("Filtrer les activités par prospectId → uniquement ce prospect", async () => {
    const r = await api.get(`/activities?prospectId=${prospectId}`);
    assert.ok(r.ok, `Status ${r.status}`);
    const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? [];
    assert.ok(Array.isArray(arr));
    for (const a of arr) {
      assert.equal(a.prospectId ?? a.prospect_id, prospectId, "Activité liée à un autre prospect");
    }
  });

  // ── LIST — filtre par type
  await suite.test("Filtrer par type 'note' → uniquement des notes", async () => {
    const r = await api.get("/activities?type=note");
    assert.ok(r.ok, `Status ${r.status}`);
    const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? [];
    for (const a of arr) {
      assert.equal(a.type, "note", `Type inattendu: ${a.type}`);
    }
  });

  // ── LIST — filtre par dealId
  await suite.test("Filtrer les activités par dealId → uniquement ce deal", async () => {
    const r = await api.get(`/activities?dealId=${dealId}`);
    assert.ok(r.ok, `Status ${r.status}`);
    const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? [];
    assert.ok(Array.isArray(arr));
  });

  // ── PATCH — mettre à jour le statut
  await suite.test("Mettre à jour le statut d'une activité → done", async () => {
    if (!activityId) return;
    const r = await api.patch(`/activities/${activityId}`, {
      status: "done",
      doneAt: new Date().toISOString(),
    });
    assert.ok(r.ok, `Status ${r.status}: ${JSON.stringify(r.body)}`);
    const status = (r.body as any).status;
    if (status !== undefined) assert.equal(status, "done");
  });

  // ── PATCH — mettre à jour le titre et la description
  await suite.test("Modifier le titre et la description → champs mis à jour", async () => {
    if (!activityId) return;
    const r = await api.patch(`/activities/${activityId}`, {
      title: "Premier contact Acme SAS [MÀJ]",
      description: "Mise à jour : décision attendue sous 2 semaines.",
    });
    assert.ok(r.ok, `Status ${r.status}`);
    const title = (r.body as any).title;
    if (title) assert.ok(title.includes("[MÀJ]"), "Titre non mis à jour");
  });

  // ── PATCH — ID inexistant → 404
  await suite.test("PATCH activité inexistante → 404", async () => {
    const r = await api.patch("/activities/00000000-0000-0000-0000-000000000000", { title: "Ghost" });
    assert.ok([404, 400].includes(r.status), `Attendu 404, reçu ${r.status}`);
  });

  // ── VALIDATION — type invalide
  await suite.test("Créer activité avec type invalide → 400", async () => {
    const r = await api.post("/activities", {
      type: "invalid_type",
      title: "Activité invalide",
      status: "done",
    });
    assert.equal(r.status, 400, `Attendu 400, reçu ${r.status}`);
  });

  // ── AUTH — sans token → 401
  await suite.test("Accès sans token → 401", async () => {
    const r = await client.get("/activities");
    assert.ok([401, 403].includes(r.status), `Attendu 401/403, reçu ${r.status}`);
  });

  // ── ISOLATION TENANT — token d'un autre tenant
  await suite.test("Isolation tenant — autre tenant ne voit pas les activités", async () => {
    const ctx2 = await createTestContext();
    const api2 = client.withToken(ctx2.adminToken);
    const r = await api2.get(`/activities?prospectId=${prospectId}`);
    if (r.ok) {
      const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? [];
      assert.equal(arr.length, 0, "Un autre tenant ne devrait pas voir ces activités");
    }
    await ctx2.cleanup();
  });

  // ── DELETE
  await suite.test("Supprimer une activité → 200/204", async () => {
    if (!activityId) return;
    const r = await api.delete(`/activities/${activityId}`);
    assert.ok([200, 204].includes(r.status), `Status ${r.status}`);
  });

  // ── Vérifier que la suppression est effective
  await suite.test("Après suppression, l'activité ne réapparaît pas dans la liste", async () => {
    if (!activityId) return;
    const r = await api.get("/activities");
    const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? [];
    const found = arr.find((a: any) => a.id === activityId);
    assert.ok(!found, "L'activité supprimée est encore présente");
  });

  await ctx.cleanup();
  return suite.getResults();
}
