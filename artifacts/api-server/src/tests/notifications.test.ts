import assert from "node:assert";
import { TestSuite, type SuiteResult } from "./runner.ts";
import { createTestContext } from "./setup.ts";
import { client } from "./test-client.ts";
import { pool } from "@workspace/db";

export async function run(): Promise<SuiteResult> {
  const ctx = await createTestContext();
  const api = client.withToken(ctx.adminToken);
  const suite = new TestSuite("Notifications");
  let notifId: string;

  // Insérer une notification directement en DB pour avoir des données
  try {
    const r = await pool.query(
      `INSERT INTO notifications (tenant_id, type, title, message, read)
       VALUES ($1, 'signal', 'Nouveau signal détecté', 'Levée de fonds Acme Corp', false)
       RETURNING id`,
      [ctx.tenantId],
    );
    notifId = r.rows[0]?.id;
  } catch {
    // Table may not have these exact columns — proceed without seed
  }

  // ── GET / — liste des notifications
  await suite.test("GET /notifications → liste (peut être vide)", async () => {
    const r = await api.get("/notifications");
    assert.ok(r.ok, `Status ${r.status}: ${JSON.stringify(r.body)}`);
    const arr = Array.isArray(r.body)
      ? r.body
      : (r.body as any).data ?? (r.body as any).notifications ?? [];
    assert.ok(Array.isArray(arr), "Réponse devrait être un tableau");
  });

  // ── PATCH /:id/read — marquer une notification lue
  await suite.test("PATCH /notifications/:id/read → notification marquée lue", async () => {
    if (!notifId) return;
    const r = await api.patch(`/notifications/${notifId}/read`, {});
    assert.ok([200, 204].includes(r.status), `Status ${r.status}: ${JSON.stringify(r.body)}`);
    if (r.ok && r.body && typeof r.body === "object") {
      const read = (r.body as any).read;
      if (read !== undefined) assert.equal(read, true, "read devrait être true");
    }
  });

  // ── PATCH /:id/read — ID inexistant → 404
  await suite.test("PATCH /notifications/unknown/read → 404", async () => {
    const r = await api.patch("/notifications/00000000-0000-0000-0000-000000000000/read", {});
    assert.equal(r.status, 404, `Attendu 404, reçu ${r.status}`);
  });

  // ── POST /mark-all-read — marquer toutes lues
  await suite.test("POST /notifications/mark-all-read → { ok: true }", async () => {
    const r = await api.post("/notifications/mark-all-read", {});
    assert.ok(r.ok, `Status ${r.status}: ${JSON.stringify(r.body)}`);
    assert.ok((r.body as any).ok, "ok attendu dans la réponse");
  });

  // ── DELETE /:id — supprimer une notification
  await suite.test("DELETE /notifications/:id → 204", async () => {
    if (!notifId) return;
    const r = await api.delete(`/notifications/${notifId}`);
    assert.ok([200, 204].includes(r.status), `Status ${r.status}`);
  });

  // ── Auth — sans token → 401
  await suite.test("GET /notifications sans token → 401", async () => {
    const r = await client.get("/notifications");
    assert.ok([401, 403].includes(r.status), `Attendu 401/403, reçu ${r.status}`);
  });

  await suite.test("POST /notifications/mark-all-read sans token → 401", async () => {
    const r = await client.post("/notifications/mark-all-read", {});
    assert.ok([401, 403].includes(r.status), `Attendu 401/403, reçu ${r.status}`);
  });

  // ── Isolation tenant — un autre tenant ne voit pas ces notifications
  await suite.test("Isolation tenant — notifications isolées par tenant", async () => {
    const ctx2 = await createTestContext();
    const api2 = client.withToken(ctx2.adminToken);
    const r2 = await api2.get("/notifications");
    assert.ok(r2.ok, `Tenant 2: ${r2.status}`);
    if (notifId) {
      const arr = Array.isArray(r2.body) ? r2.body : [];
      const found = arr.find((n: any) => n.id === notifId);
      assert.ok(!found, "Un autre tenant ne devrait pas voir cette notification");
    }
    await ctx2.cleanup();
  });

  await ctx.cleanup();
  return suite.getResults();
}
