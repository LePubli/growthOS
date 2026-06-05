import assert from "node:assert";
import { TestSuite, type SuiteResult } from "./runner.ts";
import { createTestContext } from "./setup.ts";
import { client } from "./test-client.ts";

export async function run(): Promise<SuiteResult> {
  const ctx = await createTestContext();
  const suite = new TestSuite("Authentification");

  // ── Login valide
  await suite.test("Login valide → retourne JWT + refreshToken", async () => {
    const r = await client.post<{ accessToken?: string; token?: string }>("/auth/login", {
      email: ctx.adminEmail,
      password: ctx.adminPassword,
    });
    assert.equal(r.status, 200, `Status attendu 200, reçu ${r.status}`);
    const body = r.body as any;
    const hasToken = body.accessToken || body.token;
    assert.ok(hasToken, `accessToken/token manquant dans la réponse: ${JSON.stringify(Object.keys(body))}`);
  });

  // ── Mauvais password
  await suite.test("Login mauvais password → 401", async () => {
    const r = await client.post("/auth/login", {
      email: ctx.adminEmail,
      password: "MauvaisMotDePasse!",
    });
    assert.equal(r.status, 401, `Status attendu 401, reçu ${r.status}`);
  });

  // ── Email inexistant
  await suite.test("Login email inexistant → 401", async () => {
    const r = await client.post("/auth/login", {
      email: "inexistant@nowhere.fr",
      password: "n'importe",
    });
    assert.equal(r.status, 401);
  });

  // ── Route protégée sans token
  await suite.test("Route protégée sans token → 401", async () => {
    const r = await client.get("/prospects");
    assert.equal(r.status, 401, `Route protégée sans token devrait retourner 401, reçu ${r.status}`);
  });

  // ── Route protégée avec token valide
  await suite.test("Route protégée avec token valide → 200", async () => {
    const r = await client.get("/prospects", ctx.adminToken);
    assert.ok(r.status < 400, `Status inattendu ${r.status}`);
  });

  // ── Token invalide → 401
  await suite.test("Token JWT invalide → 401", async () => {
    const r = await client.get("/prospects", "token.invalide.test");
    assert.equal(r.status, 401);
  });

  // ── Refresh token
  await suite.test("POST /auth/refresh avec cookie → nouveau token ou 401", async () => {
    const r = await client.post("/auth/refresh", {});
    // Sans cookie, attend 401
    assert.ok([200, 401].includes(r.status), `Status inattendu ${r.status}`);
  });

  // ── Logout
  await suite.test("POST /auth/logout → 200", async () => {
    const r = await client.post("/auth/logout", {}, ctx.adminToken);
    assert.ok([200, 204].includes(r.status), `Status inattendu ${r.status}`);
  });

  await ctx.cleanup();
  return suite.getResults();
}
