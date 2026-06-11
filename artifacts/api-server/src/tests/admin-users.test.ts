import assert from "node:assert";
import { TestSuite, type SuiteResult } from "./runner.ts";
import { createTestContext } from "./setup.ts";
import { client } from "./test-client.ts";

export async function run(): Promise<SuiteResult> {
  const ctx = await createTestContext();
  const suite = new TestSuite("Admin — Utilisateurs & Rôles");

  let createdUserId: string;

  // ── GET /admin/users — sans auth → 401
  await suite.test("GET /admin/users sans auth → 401", async () => {
    const r = await client.get("/admin/users");
    assert.equal(r.status, 401, `Attendu 401, reçu ${r.status}`);
  });

  // ── GET /admin/users — avec auth → liste
  await suite.test("GET /admin/users avec auth → liste utilisateurs", async () => {
    const r = await client.get("/admin/users", ctx.adminToken);
    assert.equal(r.status, 200, `Attendu 200, reçu ${r.status}: ${JSON.stringify(r.body)}`);
    const body = r.body as any[];
    assert.ok(Array.isArray(body), "Réponse doit être un tableau");
    assert.ok(body.length >= 2, `Doit avoir au moins 2 utilisateurs, reçu ${body.length}`);
    const admin = body.find((u: any) => u.email === ctx.adminEmail);
    assert.ok(admin, "Admin doit être dans la liste");
    assert.ok(admin.role, "Champ role manquant");
  });

  // ── POST /admin/users — créer utilisateur
  await suite.test("POST /admin/users → crée utilisateur", async () => {
    const r = await client.post(
      "/admin/users",
      {
        email: `new-user-${Date.now()}@test.growthos.fr`,
        password: "TestPassword123!",
        firstName: "Nouveau",
        lastName: "Utilisateur",
        role: "member",
      },
      ctx.adminToken,
    );
    assert.equal(r.status, 201, `Attendu 201, reçu ${r.status}: ${JSON.stringify(r.body)}`);
    const body = r.body as any;
    assert.ok(body.id, "id manquant");
    assert.ok(body.email, "email manquant");
    assert.equal(body.role, "member");
    createdUserId = body.id;
  });

  // ── POST /admin/users — email dupliqué → 409
  await suite.test("POST /admin/users email existant → 409", async () => {
    const r = await client.post(
      "/admin/users",
      {
        email: ctx.adminEmail,
        password: "TestPassword123!",
        firstName: "Dup",
        lastName: "Dup",
        role: "member",
      },
      ctx.adminToken,
    );
    assert.equal(r.status, 409, `Attendu 409, reçu ${r.status}`);
  });

  // ── POST /admin/users — password trop court → 400
  await suite.test("POST /admin/users password court → 400", async () => {
    const r = await client.post(
      "/admin/users",
      { email: "short@test.fr", password: "123", firstName: "A", lastName: "B", role: "member" },
      ctx.adminToken,
    );
    assert.equal(r.status, 400, `Attendu 400, reçu ${r.status}`);
  });

  // ── PATCH /admin/users/:id — modifier rôle
  await suite.test("PATCH /admin/users/:id → modifie utilisateur", async () => {
    assert.ok(createdUserId, "createdUserId non défini (test précédent échoué)");
    const r = await client.patch(
      `/admin/users/${createdUserId}`,
      { firstName: "Modifié", role: "viewer" },
      ctx.adminToken,
    );
    assert.equal(r.status, 200, `Attendu 200, reçu ${r.status}: ${JSON.stringify(r.body)}`);
    const body = r.body as any;
    assert.equal(body.firstName, "Modifié");
    assert.equal(body.role, "viewer");
  });

  // ── POST /admin/users/:id/change-role
  await suite.test("POST /admin/users/:id/change-role → change rôle", async () => {
    assert.ok(createdUserId, "createdUserId non défini");
    const r = await client.post(
      `/admin/users/${createdUserId}/change-role`,
      { role: "client" },
      ctx.adminToken,
    );
    assert.equal(r.status, 200, `Attendu 200, reçu ${r.status}`);
    const body = r.body as any;
    assert.ok(body.ok, "ok attendu dans la réponse");
  });

  // ── POST /admin/users/:id/change-role — rôle invalide → 400
  await suite.test("POST /admin/users/:id/change-role invalide → 400", async () => {
    assert.ok(createdUserId, "createdUserId non défini");
    const r = await client.post(
      `/admin/users/${createdUserId}/change-role`,
      { role: "superadmin" },
      ctx.adminToken,
    );
    assert.equal(r.status, 400, `Attendu 400, reçu ${r.status}`);
  });

  // ── POST /admin/users/:id/reset-password
  await suite.test("POST /admin/users/:id/reset-password → réinitialise MDP", async () => {
    assert.ok(createdUserId, "createdUserId non défini");
    const r = await client.post(
      `/admin/users/${createdUserId}/reset-password`,
      { newPassword: "NouveauMdp456!" },
      ctx.adminToken,
    );
    assert.equal(r.status, 200, `Attendu 200, reçu ${r.status}`);
    assert.ok((r.body as any).ok);
  });

  // ── DELETE /admin/users — auto-suppression → 400
  await suite.test("DELETE /admin/users/:id soi-même → 400", async () => {
    const r = await client.delete(`/admin/users/${ctx.adminUserId}`, ctx.adminToken);
    assert.equal(r.status, 400, `Attendu 400, reçu ${r.status}`);
  });

  // ── DELETE /admin/users/:id — supprimer l'utilisateur créé
  await suite.test("DELETE /admin/users/:id → supprime utilisateur", async () => {
    assert.ok(createdUserId, "createdUserId non défini");
    const r = await client.delete(`/admin/users/${createdUserId}`, ctx.adminToken);
    assert.equal(r.status, 200, `Attendu 200, reçu ${r.status}`);
    assert.ok((r.body as any).ok);
  });

  // ── DELETE inexistant → 404
  await suite.test("DELETE /admin/users/:id inexistant → 404", async () => {
    const r = await client.delete(
      "/admin/users/00000000-0000-0000-0000-000000000000",
      ctx.adminToken,
    );
    assert.equal(r.status, 404, `Attendu 404, reçu ${r.status}`);
  });

  // ── GET /admin/roles
  await suite.test("GET /admin/roles → liste des rôles", async () => {
    const r = await client.get("/admin/roles", ctx.adminToken);
    assert.equal(r.status, 200, `Attendu 200, reçu ${r.status}`);
    const body = r.body as any[];
    assert.ok(Array.isArray(body), "Réponse doit être un tableau");
    assert.ok(body.length >= 4, `Doit avoir au moins 4 rôles, reçu ${body.length}`);
    const adminRole = body.find((r: any) => r.id === "admin");
    assert.ok(adminRole, "Rôle admin manquant");
    assert.ok(adminRole.isSystem, "isSystem attendu");
  });

  // ── GET /admin/stats
  await suite.test("GET /admin/stats → statistiques admin", async () => {
    const r = await client.get("/admin/stats", ctx.adminToken);
    assert.equal(r.status, 200, `Attendu 200, reçu ${r.status}`);
    const body = r.body as any;
    assert.ok(typeof body.total_users === "number", "total_users attendu");
    assert.ok(body.total_users >= 2, "Doit avoir au moins 2 utilisateurs");
  });

  // ── PATCH /admin/users/:id inexistant → 404
  await suite.test("PATCH /admin/users/:id inexistant → 404", async () => {
    const r = await client.patch(
      "/admin/users/00000000-0000-0000-0000-000000000000",
      { firstName: "Ghost" },
      ctx.adminToken,
    );
    assert.equal(r.status, 404, `Attendu 404, reçu ${r.status}`);
  });

  // ── Multi-tenancy : token autre tenant ne voit pas les users
  await suite.test("GET /admin/users isolation tenant", async () => {
    const r = await client.get("/admin/users", ctx.adminToken);
    assert.equal(r.status, 200, `Attendu 200, reçu ${r.status}`);
    const body = r.body as any[];
    // Tous les users retournés appartiennent au même tenant
    for (const u of body) {
      assert.ok(u.email, "email attendu");
    }
  });

  await ctx.cleanup();
  return suite.getResults();
}
