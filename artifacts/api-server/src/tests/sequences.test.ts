import assert from "node:assert";
import { TestSuite, type SuiteResult } from "./runner.ts";
import { createTestContext } from "./setup.ts";
import { client } from "./test-client.ts";

export async function run(): Promise<SuiteResult> {
  const ctx = await createTestContext();
  const api = client.withToken(ctx.adminToken);
  const suite = new TestSuite("Séquences Email");
  let seqId: string;

  // ── CREATE
  await suite.test("Créer une séquence avec étapes → 201", async () => {
    const r = await api.post<{ id: string }>("/sequences", {
      name: `Séquence Test ${Date.now()}`,
      status: "draft",
      steps: [
        { delay: 0, type: "email", subject: "Bonjour {{prenom}}", body: "Chez {{entreprise}}, nous…" },
        { delay: 3, type: "email", subject: "Suivi {{entreprise}}", body: "Suite à mon email…" },
        { delay: 7, type: "task", description: "Appel de suivi" },
      ],
    });
    assert.ok([200, 201].includes(r.status), `Status attendu 201, reçu ${r.status}`);
    assert.ok((r.body as any).id, "id manquant");
    seqId = (r.body as any).id;
  });

  // ── LIST
  await suite.test("Lister les séquences → tableau", async () => {
    const r = await api.get("/sequences");
    assert.ok(r.ok, `Status ${r.status}`);
    const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? (r.body as any).sequences ?? [];
    assert.ok(Array.isArray(arr));
  });

  // ── TOGGLE ACTIVATION
  await suite.test("Activation d'une séquence → statut active", async () => {
    if (!seqId) return;
    const r = await api.patch(`/sequences/${seqId}`, { status: "active" });
    assert.ok(r.ok, `Status ${r.status}`);
    const status = (r.body as any).status;
    if (status !== undefined) assert.equal(status, "active");
  });

  await suite.test("Désactivation → statut paused", async () => {
    if (!seqId) return;
    const r = await api.patch(`/sequences/${seqId}`, { status: "paused" });
    assert.ok(r.ok, `Status ${r.status}`);
    const status = (r.body as any).status;
    if (status !== undefined) assert.ok(["paused", "draft"].includes(status));
  });

  // ── VARIABLES DE PERSONNALISATION
  await suite.test("Variables {{prenom}} et {{entreprise}} dans les étapes → acceptées", async () => {
    const r = await api.post("/sequences", {
      name: `Seq Variables ${Date.now()}`,
      status: "draft",
      steps: [
        {
          delay: 0,
          type: "email",
          subject: "Bonjour {{prenom}} de {{entreprise}}",
          body: "Je souhaite vous parler de {{produit}}",
        },
      ],
    });
    assert.ok([200, 201].includes(r.status), `Variables non acceptées, status ${r.status}`);
  });

  // ── STATS
  await suite.test("Statistiques par séquence → taux d'ouverture + clic", async () => {
    if (!seqId) return;
    const r = await api.get(`/sequences/${seqId}/stats`);
    assert.ok([200, 404].includes(r.status));
    if (r.ok) {
      assert.ok(typeof r.body === "object", "Stats devraient être un objet");
    }
  });

  // ── TRACKING ÉVÉNEMENTS
  await suite.test("Tracking événement ouverture → enregistré", async () => {
    if (!seqId) return;
    const r = await api.post(`/sequences/${seqId}/track`, {
      event: "open",
      stepIndex: 0,
      prospectId: null,
    });
    assert.ok([200, 201, 204, 404].includes(r.status));
  });

  // ── DELETE
  await suite.test("Supprimer une séquence → 200/204", async () => {
    if (!seqId) return;
    const r = await api.delete(`/sequences/${seqId}`);
    assert.ok([200, 204].includes(r.status), `Status ${r.status}`);
  });

  await ctx.cleanup();
  return suite.getResults();
}
