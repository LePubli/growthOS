import assert from "node:assert";
import { TestSuite, type SuiteResult } from "./runner.ts";
import { createTestContext } from "./setup.ts";
import { client } from "./test-client.ts";
import { pool } from "@workspace/db";

export async function run(): Promise<SuiteResult> {
  const ctx = await createTestContext();
  const api = client.withToken(ctx.adminToken);
  const suite = new TestSuite("Tests de Performance");

  // ── TEMPS DE RÉPONSE LISTE
  await suite.test("GET /prospects → temps de réponse < 500ms (p95)", async () => {
    const times: number[] = [];
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      const r = await api.get("/prospects");
      times.push(Date.now() - start);
      assert.ok(r.ok || r.status === 401, `Requête ${i + 1} échouée: ${r.status}`);
    }
    times.sort((a, b) => a - b);
    const p95 = times[Math.floor(times.length * 0.95)] ?? times[times.length - 1]!;
    assert.ok(p95 < 500, `P95 trop lent: ${p95}ms (attendu < 500ms)`);
  });

  // ── CRÉATION EN MASSE (100 prospects via DB directe)
  await suite.test("Insertion de 100 prospects en < 15 secondes", async () => {
    const insertStart = Date.now();
    const values = Array.from({ length: 100 }, (_, i) => ({
      email: `perf-${ctx.tenantId.slice(0, 8)}-${i}-${Date.now()}@perftest.fr`,
      first_name: "Perf",
      last_name: `Test${i}`,
      company: `PerfCorp${i}`,
    }));

    // Insertion par batches de 10 (évite ON CONFLICT)
    for (const v of values) {
      await pool.query(
        `INSERT INTO prospects (tenant_id, first_name, last_name, email, company, status)
         VALUES ($1, $2, $3, $4, $5, 'new')`,
        [ctx.tenantId, v.first_name, v.last_name, v.email, v.company],
      );
    }
    const elapsed = Date.now() - insertStart;
    assert.ok(elapsed < 15_000, `Insertion trop lente: ${elapsed}ms (attendu < 15s)`);
  });

  // ── LISTE APRÈS MASSE
  await suite.test("GET /prospects avec 100+ enregistrements → < 1000ms", async () => {
    const start = Date.now();
    const r = await api.get("/prospects?limit=100");
    const elapsed = Date.now() - start;
    assert.ok(r.ok, `Status ${r.status}`);
    assert.ok(elapsed < 1000, `Liste trop lente: ${elapsed}ms (attendu < 1s)`);
  });

  // ── RECHERCHE FULL-TEXT
  await suite.test("Recherche full-text → < 500ms", async () => {
    const start = Date.now();
    const r = await api.get("/prospects?search=Perf");
    const elapsed = Date.now() - start;
    assert.ok(r.ok, `Status ${r.status}`);
    assert.ok(elapsed < 500, `Recherche trop lente: ${elapsed}ms`);
  });

  // ── DASHBOARD
  await suite.test("GET /dashboard → < 1000ms", async () => {
    const start = Date.now();
    const r = await api.get("/dashboard");
    const elapsed = Date.now() - start;
    assert.ok([200, 404].includes(r.status));
    if (r.ok) {
      assert.ok(elapsed < 1000, `Dashboard trop lent: ${elapsed}ms`);
    }
  });

  // ── GÉNÉRATION IA
  await suite.test("Génération email IA < 5 secondes", async () => {
    const start = Date.now();
    const r = await api.post("/ai-sdr/draft/email", {
      context: "Test de performance génération IA",
      tone: "professional",
    });
    const elapsed = Date.now() - start;
    assert.ok([200, 201, 400].includes(r.status));
    assert.ok(elapsed < 5000, `Génération IA trop lente: ${elapsed}ms (attendu < 5s)`);
  });

  // ── REQUÊTES PARALLÈLES
  await suite.test("10 requêtes parallèles → toutes < 2 secondes", async () => {
    const start = Date.now();
    const requests = Array.from({ length: 10 }, () => api.get("/prospects"));
    const results = await Promise.all(requests);
    const elapsed = Date.now() - start;
    const allOk = results.every((r) => r.ok || r.status === 404);
    assert.ok(allOk, "Certaines requêtes parallèles ont échoué");
    assert.ok(elapsed < 2000, `Requêtes parallèles trop lentes: ${elapsed}ms`);
  });

  await ctx.cleanup();
  return suite.getResults();
}
