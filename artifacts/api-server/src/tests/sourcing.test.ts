import assert from "node:assert";
import { TestSuite, type SuiteResult } from "./runner.ts";
import { createTestContext } from "./setup.ts";
import { client } from "./test-client.ts";

export async function run(): Promise<SuiteResult> {
  const ctx = await createTestContext();
  const api = client.withToken(ctx.adminToken);
  const suite = new TestSuite("Recherche d'entreprises — sélection avant import");

  await suite.test("Lister les recherches", async () => {
    const result = await api.get("/sourcing/jobs");
    assert.equal(result.status, 200);
    assert.ok(Array.isArray(result.body));
  });

  await suite.test("Connecteur LinkedIn non configuré : refus, pas de faux résultat", async () => {
    const result = await api.post("/sourcing/jobs", {
      type: "linkedin", name: "Test", params: { query: "CEO", codePostal: "59000" },
    });
    assert.equal(result.status, 400);
  });

  await suite.test("Connecteur manuel non implémenté : refus", async () => {
    const result = await api.post("/sourcing/jobs", {
      type: "manual", name: "Test", params: {},
    });
    assert.equal(result.status, 400);
  });

  await suite.test("Recherche sans zone précise : refus", async () => {
    const result = await api.post("/sourcing/jobs", {
      type: "entreprises", name: "Sans localisation", params: { query: "plombier" },
    });
    assert.equal(result.status, 400);
  });

  await suite.test("Code postal invalide : refus", async () => {
    const result = await api.post("/sourcing/jobs", {
      type: "entreprises", name: "Code postal invalide", params: { query: "plombier", codePostal: "Paris" },
    });
    assert.equal(result.status, 400);
  });

  await suite.test("Import impossible hors d'une recherche existante", async () => {
    const result = await api.post("/sourcing/jobs/00000000-0000-4000-8000-000000000001/import", {
      sirens: ["123456789"],
    });
    assert.equal(result.status, 404);
  });

  await ctx.cleanup();
  return suite.getResults();
}
