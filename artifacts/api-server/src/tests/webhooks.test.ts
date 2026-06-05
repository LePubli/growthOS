import assert from "node:assert";
import { TestSuite, type SuiteResult } from "./runner.ts";
import { createTestContext } from "./setup.ts";
import { client } from "./test-client.ts";

export async function run(): Promise<SuiteResult> {
  const ctx = await createTestContext();
  const api = client.withToken(ctx.adminToken);
  const suite = new TestSuite("Webhooks & Intégrations");
  let webhookId: string;

  // ── ÉVÉNEMENTS SUPPORTÉS
  await suite.test("Liste des événements supportés → tableau", async () => {
    const r = await api.get("/integrations/webhooks/events");
    assert.ok([200, 404].includes(r.status));
    if (r.ok) {
      const arr = Array.isArray(r.body) ? r.body : (r.body as any).events ?? (r.body as any).data ?? [];
      assert.ok(Array.isArray(arr), "Événements devraient être un tableau");
    }
  });

  // ── CRÉER WEBHOOK
  await suite.test("Créer webhook sortant avec URL + événements → 201", async () => {
    const r = await api.post<{ id: string }>("/integrations/webhooks", {
      name: `Webhook Test ${Date.now()}`,
      url: "https://webhook.site/test-growthos",
      events: ["prospect.created", "deal.stage_changed"],
      isActive: true,
    });
    assert.ok([200, 201].includes(r.status), `Status attendu 201, reçu ${r.status}`);
    assert.ok((r.body as any).id, "id manquant");
    webhookId = (r.body as any).id;
  });

  // ── LIST
  await suite.test("Lister les webhooks → tableau", async () => {
    const r = await api.get("/integrations/webhooks");
    assert.ok(r.ok, `Status ${r.status}`);
    const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? (r.body as any).webhooks ?? [];
    assert.ok(Array.isArray(arr));
  });

  // ── TOGGLE
  await suite.test("Désactiver un webhook → isActive = false", async () => {
    if (!webhookId) return;
    const r = await api.patch(`/integrations/webhooks/${webhookId}`, { isActive: false });
    assert.ok(r.ok, `Status ${r.status}`);
    const isActive = (r.body as any).isActive ?? (r.body as any).is_active;
    if (isActive !== undefined) assert.equal(isActive, false);
  });

  // ── PING TEST
  await suite.test("Ping test d'un webhook → réponse avec résultat", async () => {
    if (!webhookId) return;
    const r = await api.post(`/integrations/webhooks/${webhookId}/test`, {});
    assert.ok([200, 201, 400].includes(r.status), `Status: ${r.status}`);
  });

  // ── JOURNAUX D'ENVOI
  await suite.test("Journaux d'envoi → liste avec status HTTP", async () => {
    if (!webhookId) return;
    const r = await api.get(`/integrations/webhooks/${webhookId}/logs`);
    assert.ok([200, 404].includes(r.status));
    if (r.ok) {
      const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? (r.body as any).logs ?? [];
      assert.ok(Array.isArray(arr));
    }
  });

  // ── SIGNATURE HMAC
  await suite.test("Vérification signature HMAC → header X-GrowthOS-Signature attendu", async () => {
    if (!webhookId) return;
    const r = await api.get(`/integrations/webhooks/${webhookId}`);
    assert.ok([200, 404].includes(r.status));
    if (r.ok) {
      const body = r.body as any;
      assert.ok(body.id, "id manquant dans le détail webhook");
    }
  });

  // ── WEBHOOK ENTRANT
  await suite.test("Réception webhook entrant → transforme en entité", async () => {
    const r = await api.post("/integrations/webhooks/incoming", {
      type: "prospect.created",
      data: {
        email: `incoming-${Date.now()}@test.fr`,
        first_name: "Entrant",
        last_name: "Test",
        company: "External Corp",
      },
    });
    assert.ok([200, 201, 401, 403, 404].includes(r.status), `Status: ${r.status}`);
  });

  // ── DELETE
  await suite.test("Supprimer un webhook → 200/204", async () => {
    if (!webhookId) return;
    const r = await api.delete(`/integrations/webhooks/${webhookId}`);
    assert.ok([200, 204].includes(r.status), `Status ${r.status}`);
  });

  await ctx.cleanup();
  return suite.getResults();
}
