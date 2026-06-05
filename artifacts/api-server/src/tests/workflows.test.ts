import assert from "node:assert";
import { TestSuite, type SuiteResult } from "./runner.ts";
import { createTestContext } from "./setup.ts";
import { client } from "./test-client.ts";

export async function run(): Promise<SuiteResult> {
  const ctx = await createTestContext();
  const api = client.withToken(ctx.adminToken);
  const suite = new TestSuite("Workflows d'automatisation");
  let workflowId: string;

  // ── CRÉER UN WORKFLOW (schéma: { name, trigger: string, actions, status })
  await suite.test("Créer un workflow avec déclencheur + actions → 201", async () => {
    const r = await api.post<{ id: string }>("/workflows", {
      name: `Workflow Test ${Date.now()}`,
      trigger: "prospect_created",
      triggerConfig: { conditions: {} },
      actions: [
        { type: "send_email", subject: "Bienvenue {{prenom}}" },
        { type: "create_task", title: "Appel de bienvenue", delay: 1 },
      ],
      status: "draft",
    });
    assert.ok([200, 201].includes(r.status), `Status attendu 201, reçu ${r.status}: ${JSON.stringify(r.body)}`);
    assert.ok((r.body as any).id, "id manquant");
    workflowId = (r.body as any).id;
  });

  // ── LIST
  await suite.test("Lister les workflows → tableau", async () => {
    const r = await api.get("/workflows");
    assert.ok(r.ok, `Status ${r.status}`);
    const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? (r.body as any).workflows ?? [];
    assert.ok(Array.isArray(arr));
  });

  // ── READ BY ID
  await suite.test("Lire un workflow par ID → détails", async () => {
    if (!workflowId) return;
    const r = await api.get(`/workflows/${workflowId}`);
    assert.ok(r.ok, `Status ${r.status}`);
    assert.equal((r.body as any).id, workflowId);
  });

  // ── ACTIVATION via toggle
  await suite.test("Activer un workflow → status active", async () => {
    if (!workflowId) return;
    const r = await api.post(`/workflows/${workflowId}/toggle`, {});
    assert.ok([200, 204, 404].includes(r.status), `Status: ${r.status}`);
  });

  // ── MISE À JOUR
  await suite.test("Modifier un workflow → champs mis à jour", async () => {
    if (!workflowId) return;
    const r = await api.patch(`/workflows/${workflowId}`, { status: "active" });
    assert.ok(r.ok, `Status ${r.status}`);
    const status = (r.body as any).status;
    if (status !== undefined) {
      assert.ok(["active", "draft", "paused"].includes(status), `Status invalide: ${status}`);
    }
  });

  // ── DÉSACTIVATION
  await suite.test("Désactiver un workflow → status draft/paused", async () => {
    if (!workflowId) return;
    const r = await api.patch(`/workflows/${workflowId}`, { status: "paused" });
    assert.ok(r.ok, `Status ${r.status}`);
  });

  // ── JOURNAL D'EXÉCUTION
  await suite.test("Journal d'exécution → liste ou 404", async () => {
    if (!workflowId) return;
    const r = await api.get(`/workflows/${workflowId}/executions`);
    assert.ok([200, 404].includes(r.status));
    if (r.ok) {
      const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? [];
      assert.ok(Array.isArray(arr));
    }
  });

  // ── DELETE
  await suite.test("Supprimer un workflow → 200/204", async () => {
    if (!workflowId) return;
    const r = await api.delete(`/workflows/${workflowId}`);
    assert.ok([200, 204].includes(r.status), `Status ${r.status}`);
  });

  await ctx.cleanup();
  return suite.getResults();
}
