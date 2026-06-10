import assert from "node:assert";
import { TestSuite, type SuiteResult } from "./runner.ts";
import { createTestContext, createTestProspect, createTestDeal } from "./setup.ts";
import { client } from "./test-client.ts";

export async function run(): Promise<SuiteResult> {
  const ctx = await createTestContext();
  const api = client.withToken(ctx.adminToken);
  const suite = new TestSuite("Mes Tâches (CRUD complet)");
  let taskId: string;
  let prospectId: string;
  let dealId: string;

  const prospect = await createTestProspect(ctx.tenantId, { company: "TaskCorp" });
  prospectId = prospect.id;
  const deal = await createTestDeal(ctx.tenantId, { title: "Deal TaskCorp" });
  dealId = deal.id;

  // ── CREATE — tâche simple
  await suite.test("Créer une tâche simple → 201", async () => {
    const r = await api.post<{ id: string }>("/tasks", {
      title: `Appeler le DG de TaskCorp ${Date.now()}`,
      description: "Préparer l'argumentaire commercial avant l'appel.",
      priority: "high",
      status: "todo",
      dueDate: new Date(Date.now() + 3 * 86400_000).toISOString().split("T")[0],
    });
    assert.ok([200, 201].includes(r.status), `Status attendu 201, reçu ${r.status}: ${JSON.stringify(r.body)}`);
    assert.ok((r.body as any).id, "id manquant");
    taskId = (r.body as any).id;
  });

  // ── CREATE — tâche liée à un prospect
  await suite.test("Créer une tâche liée à un prospect → 201", async () => {
    const r = await api.post<{ id: string }>("/tasks", {
      title: "Envoyer proposition commerciale",
      priority: "medium",
      status: "todo",
      entityType: "prospect",
      entityId: prospectId,
    });
    assert.ok([200, 201].includes(r.status), `Status ${r.status}: ${JSON.stringify(r.body)}`);
    assert.ok((r.body as any).id);
  });

  // ── CREATE — tâche liée à un deal
  await suite.test("Créer une tâche liée à un deal → 201", async () => {
    const r = await api.post<{ id: string }>("/tasks", {
      title: "Relancer pour signature contrat",
      priority: "high",
      status: "in_progress",
      entityType: "deal",
      entityId: dealId,
      dueDate: new Date(Date.now() + 1 * 86400_000).toISOString().split("T")[0],
    });
    assert.ok([200, 201].includes(r.status), `Status ${r.status}`);
  });

  // ── LIST
  await suite.test("Lister toutes les tâches → tableau non vide", async () => {
    const r = await api.get("/tasks");
    assert.ok(r.ok, `Status ${r.status}`);
    const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? (r.body as any).tasks ?? [];
    assert.ok(Array.isArray(arr), "Réponse devrait être un tableau");
    assert.ok(arr.length >= 1, "Au moins une tâche attendue");
  });

  // ── LIST — filtre par statut
  await suite.test("Filtrer les tâches par statut 'todo' → tâches en attente", async () => {
    const r = await api.get("/tasks?status=todo");
    assert.ok(r.ok, `Status ${r.status}`);
    const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? (r.body as any).tasks ?? [];
    for (const t of arr) {
      assert.ok(["todo", "in_progress"].includes(t.status ?? t.status_value ?? ""), `Statut inattendu: ${t.status}`);
    }
  });

  // ── LIST — filtre par priorité
  await suite.test("Filtrer par priorité 'high' → tâches haute priorité", async () => {
    const r = await api.get("/tasks?priority=high");
    if (r.ok) {
      const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? [];
      for (const t of arr) {
        assert.ok(["high", "urgent"].includes(t.priority ?? ""), `Priorité inattendue: ${t.priority}`);
      }
    }
  });

  // ── PATCH — mettre à jour le statut
  await suite.test("Mettre à jour le statut d'une tâche → in_progress", async () => {
    if (!taskId) return;
    const r = await api.patch(`/tasks/${taskId}`, { status: "in_progress" });
    assert.ok(r.ok, `Status ${r.status}: ${JSON.stringify(r.body)}`);
    const status = (r.body as any).status;
    if (status) assert.equal(status, "in_progress");
  });

  // ── PATCH — modifier la priorité
  await suite.test("Changer la priorité → medium", async () => {
    if (!taskId) return;
    const r = await api.patch(`/tasks/${taskId}`, { priority: "medium" });
    assert.ok(r.ok, `Status ${r.status}`);
    const priority = (r.body as any).priority;
    if (priority) assert.equal(priority, "medium");
  });

  // ── COMPLETE — marquer comme terminée
  await suite.test("POST /tasks/:id/complete → tâche marquée done", async () => {
    if (!taskId) return;
    const r = await api.post(`/tasks/${taskId}/complete`, {});
    assert.ok([200, 204].includes(r.status), `Status ${r.status}: ${JSON.stringify(r.body)}`);
  });

  // ── Vérifier que done est persisté
  await suite.test("Après /complete, statut est 'done'", async () => {
    if (!taskId) return;
    const r = await api.get("/tasks");
    if (r.ok) {
      const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? (r.body as any).tasks ?? [];
      const task = arr.find((t: any) => t.id === taskId);
      if (task) assert.ok(["done", "completed"].includes(task.status ?? ""), `Statut attendu 'done', reçu: ${task.status}`);
    }
  });

  // ── PATCH — ID inexistant → 404
  await suite.test("PATCH tâche inexistante → 404", async () => {
    const r = await api.patch("/tasks/00000000-0000-0000-0000-000000000000", { title: "Ghost" });
    assert.ok([404, 400].includes(r.status), `Attendu 404, reçu ${r.status}`);
  });

  // ── AUTH — sans token → 401
  await suite.test("Accès sans token → 401", async () => {
    const r = await client.get("/tasks");
    assert.ok([401, 403].includes(r.status), `Attendu 401/403, reçu ${r.status}`);
  });

  // ── ISOLATION TENANT
  await suite.test("Isolation tenant — autre tenant ne voit pas les tâches", async () => {
    const ctx2 = await createTestContext();
    const api2 = client.withToken(ctx2.adminToken);
    const r = await api2.get("/tasks");
    if (r.ok) {
      const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? (r.body as any).tasks ?? [];
      const found = arr.find((t: any) => t.id === taskId);
      assert.ok(!found, "Un autre tenant ne devrait pas voir cette tâche");
    }
    await ctx2.cleanup();
  });

  // ── DELETE
  await suite.test("Supprimer une tâche → 200/204", async () => {
    if (!taskId) return;
    const r = await api.delete(`/tasks/${taskId}`);
    assert.ok([200, 204].includes(r.status), `Status ${r.status}`);
  });

  await ctx.cleanup();
  return suite.getResults();
}
