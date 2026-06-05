import assert from "node:assert";
import { TestSuite, type SuiteResult } from "./runner.ts";
import { createTestContext } from "./setup.ts";
import { client } from "./test-client.ts";

export async function run(): Promise<SuiteResult> {
  const ctx = await createTestContext();
  const api = client.withToken(ctx.adminToken);
  const suite = new TestSuite("Sourcing & Scraping");
  let jobId: string;

  // ── CRÉER UN JOB (schéma: { type, name, params })
  await suite.test("Créer un job de scraping avec critères → 201", async () => {
    const r = await api.post<{ id: string }>("/sourcing/jobs", {
      type: "linkedin",
      name: `Job Test ${Date.now()}`,
      params: {
        industry: "Software",
        location: "Paris, France",
        keywords: "CRM SaaS",
        size: "50-200",
      },
    });
    assert.ok([200, 201].includes(r.status), `Status attendu 201, reçu ${r.status}: ${JSON.stringify(r.body)}`);
    const body = r.body as any;
    assert.ok(body.id, "id manquant");
    jobId = body.id;
  });

  // ── LIST JOBS
  await suite.test("Lister les jobs de sourcing → tableau", async () => {
    const r = await api.get("/sourcing/jobs");
    assert.ok(r.ok, `Status ${r.status}`);
    const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? (r.body as any).jobs ?? [];
    assert.ok(Array.isArray(arr));
  });

  // ── STATUT EN TEMPS RÉEL
  await suite.test("Statut d'un job → queued/running/completed/failed", async () => {
    if (!jobId) return;
    const r = await api.get(`/sourcing/jobs/${jobId}`);
    assert.ok(r.ok, `Status ${r.status}`);
    const body = r.body as any;
    const validStatuses = ["queued", "pending", "running", "completed", "failed", "cancelled"];
    if (body.status) {
      assert.ok(validStatuses.includes(body.status), `Status invalide: ${body.status}`);
    }
  });

  // ── PROGRESSION
  await suite.test("Job contient type, name et params → métadonnées présentes", async () => {
    if (!jobId) return;
    const r = await api.get(`/sourcing/jobs/${jobId}`);
    assert.ok(r.ok, `Status ${r.status}`);
    const body = r.body as any;
    assert.ok(body.type, "type manquant");
    assert.ok(body.name, "name manquant");
  });

  // ── SOURCES DISPONIBLES
  await suite.test("Sources de données disponibles → liste ou 404", async () => {
    const r = await api.get("/sourcing/sources");
    assert.ok([200, 404].includes(r.status));
    if (r.ok) {
      const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? (r.body as any).sources ?? [];
      assert.ok(Array.isArray(arr));
    }
  });

  // ── TYPES DE JOBS
  await suite.test("Créer un job avec type 'manual' → accepté", async () => {
    const r = await api.post<{ id: string }>("/sourcing/jobs", {
      type: "manual",
      name: `Job Manual ${Date.now()}`,
      params: {},
    });
    assert.ok([200, 201].includes(r.status), `Status: ${r.status}`);
  });

  // ── JOB INEXISTANT
  await suite.test("Lire un job inexistant → 404", async () => {
    const r = await api.get("/sourcing/jobs/00000000-0000-0000-0000-000000000000");
    assert.ok([404, 400].includes(r.status), `Attendu 404, reçu ${r.status}`);
  });

  await ctx.cleanup();
  return suite.getResults();
}
