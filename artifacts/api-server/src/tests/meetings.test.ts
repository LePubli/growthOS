import assert from "node:assert";
import { TestSuite, type SuiteResult } from "./runner.ts";
import { createTestContext } from "./setup.ts";
import { client } from "./test-client.ts";

export async function run(): Promise<SuiteResult> {
  const ctx = await createTestContext();
  const api = client.withToken(ctx.adminToken);
  const suite = new TestSuite("Réunions (Meeting Intelligence)");
  let meetingId: string;

  // ── CREATE — réunion simple
  await suite.test("Créer une réunion → 201 avec id", async () => {
    const r = await api.post<{ id: string; ok?: boolean }>("/meetings", {
      title: `Démo GrowthOS — Acme Corp ${Date.now()}`,
    });
    assert.ok([200, 201].includes(r.status), `Status attendu 201, reçu ${r.status}: ${JSON.stringify(r.body)}`);
    const body = r.body as any;
    assert.ok(body.id, "id manquant dans la réponse");
    meetingId = body.id;
  });

  // ── CREATE — avec fichier simulé
  await suite.test("Créer une réunion avec simulatedFileName → accepté", async () => {
    const r = await api.post<{ id: string }>("/meetings", {
      title: `Réunion Stratégie Q3 ${Date.now()}`,
      simulatedFileName: "strategy-q3-meeting.mp4",
    });
    assert.ok([200, 201].includes(r.status), `Status ${r.status}: ${JSON.stringify(r.body)}`);
    assert.ok((r.body as any).id, "id manquant");
  });

  // ── CREATE — validation : titre manquant → 400
  await suite.test("Créer une réunion sans titre → 400", async () => {
    const r = await api.post("/meetings", {});
    assert.equal(r.status, 400, `Attendu 400, reçu ${r.status}`);
  });

  // ── CREATE — titre trop long → 400
  await suite.test("Titre trop long (>256 chars) → 400", async () => {
    const r = await api.post("/meetings", { title: "A".repeat(300) });
    assert.equal(r.status, 400, `Attendu 400, reçu ${r.status}`);
  });

  // ── LIST
  await suite.test("Lister les réunions → { meetings: [], total: N }", async () => {
    const r = await api.get("/meetings");
    assert.ok(r.ok, `Status ${r.status}: ${JSON.stringify(r.body)}`);
    const body = r.body as any;
    const arr = body.meetings ?? (Array.isArray(body) ? body : body.data ?? []);
    assert.ok(Array.isArray(arr), "meetings devrait être un tableau");
    assert.ok(arr.length >= 1, "Au moins une réunion attendue");
    if (body.total !== undefined) assert.ok(typeof body.total === "number", "total devrait être un nombre");
  });

  // ── GET by ID
  await suite.test("Lire une réunion par ID → détails", async () => {
    if (!meetingId) return;
    const r = await api.get(`/meetings/${meetingId}`);
    assert.ok(r.ok, `Status ${r.status}`);
    const body = r.body as any;
    assert.equal(body.id, meetingId);
    assert.ok(body.title, "title manquant");
  });

  // ── GET — ID inexistant → 404
  await suite.test("Lire une réunion inexistante → 404", async () => {
    const r = await api.get("/meetings/00000000-0000-0000-0000-000000000000");
    assert.equal(r.status, 404, `Attendu 404, reçu ${r.status}`);
  });

  // ── PROCESS — déclencher le traitement IA
  await suite.test("POST /:id/process — déclencher la transcription IA", async () => {
    if (!meetingId) return;
    const r = await api.post(`/meetings/${meetingId}/process`, {});
    assert.ok([200, 202, 404].includes(r.status), `Status ${r.status}: ${JSON.stringify(r.body)}`);
    if (r.ok) {
      assert.ok((r.body as any).ok !== false, "Traitement refusé");
    }
  });

  // ── PROCESS — réunion inexistante → 404
  await suite.test("Traitement d'une réunion inexistante → 404", async () => {
    const r = await api.post("/meetings/00000000-0000-0000-0000-000000000000/process", {});
    assert.equal(r.status, 404, `Attendu 404, reçu ${r.status}`);
  });

  // ── AUTH — sans token → 401
  await suite.test("Accès sans token → 401", async () => {
    const r = await client.get("/meetings");
    assert.ok([401, 403].includes(r.status), `Attendu 401/403, reçu ${r.status}`);
  });

  // ── ISOLATION TENANT
  await suite.test("Isolation tenant — autre tenant ne voit pas les réunions", async () => {
    const ctx2 = await createTestContext();
    const api2 = client.withToken(ctx2.adminToken);
    const r = await api2.get("/meetings");
    if (r.ok) {
      const body = r.body as any;
      const arr = body.meetings ?? (Array.isArray(body) ? body : []);
      const found = arr.find((m: any) => m.id === meetingId);
      assert.ok(!found, "Un autre tenant ne devrait pas voir cette réunion");
    }
    await ctx2.cleanup();
  });

  // ── DELETE
  await suite.test("Supprimer une réunion → 200/204", async () => {
    if (!meetingId) return;
    const r = await api.delete(`/meetings/${meetingId}`);
    assert.ok([200, 204].includes(r.status), `Status ${r.status}`);
  });

  // ── Vérifier la suppression
  await suite.test("Réunion supprimée → 404 en lecture directe", async () => {
    if (!meetingId) return;
    const r = await api.get(`/meetings/${meetingId}`);
    assert.ok([404, 400].includes(r.status), `Attendu 404, reçu ${r.status}`);
  });

  await ctx.cleanup();
  return suite.getResults();
}
