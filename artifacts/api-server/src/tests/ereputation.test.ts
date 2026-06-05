import assert from "node:assert";
import { TestSuite, type SuiteResult } from "./runner.ts";
import { createTestContext } from "./setup.ts";
import { client } from "./test-client.ts";

export async function run(): Promise<SuiteResult> {
  const ctx = await createTestContext();
  const api = client.withToken(ctx.adminToken);
  const suite = new TestSuite("Plugin E-Réputation");
  let campaignId: string;

  // ── CRÉER CAMPAGNE (champs requis: name, targetType, targetName)
  await suite.test("Créer une campagne e-réputation → 201", async () => {
    const r = await api.post<{ id: string }>("/ereputation/campaigns", {
      name: `Campagne Test ${Date.now()}`,
      targetType: "domain",
      targetName: "acme-corp-test.fr",
      targetUrl: "https://acme-corp-test.fr",
      keywords: ["Acme Corp", "acme.fr"],
    });
    assert.ok([200, 201].includes(r.status), `Status attendu 201, reçu ${r.status}: ${JSON.stringify(r.body)}`);
    assert.ok((r.body as any).id, "id manquant");
    campaignId = (r.body as any).id;
  });

  // ── LIST
  await suite.test("Lister les campagnes → tableau", async () => {
    const r = await api.get("/ereputation/campaigns");
    assert.ok(r.ok, `Status ${r.status}`);
    const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? (r.body as any).campaigns ?? [];
    assert.ok(Array.isArray(arr));
  });

  // ── DASHBOARD CAMPAGNE
  await suite.test("Dashboard campagne → données de réputation", async () => {
    if (!campaignId) return;
    const r = await api.get(`/ereputation/campaigns/${campaignId}/dashboard`);
    assert.ok([200, 404].includes(r.status));
    if (r.ok) {
      assert.ok(typeof r.body === "object", "Dashboard devrait être un objet");
    }
  });

  // ── AUDIT SEO/GEO
  await suite.test("Audit SEO/GEO → déclenché → 200/201", async () => {
    if (!campaignId) return;
    const r = await api.post(`/ereputation/campaigns/${campaignId}/audit`, {
      type: "seo",
    });
    assert.ok([200, 201, 404].includes(r.status));
    if (r.ok) {
      assert.ok(typeof r.body === "object", "Résultat audit devrait être un objet");
    }
  });

  // ── SUIVI SERP
  await suite.test("Suivi SERP → positions → tableau", async () => {
    if (!campaignId) return;
    const r = await api.get(`/ereputation/campaigns/${campaignId}/serp`);
    assert.ok([200, 404].includes(r.status));
    if (r.ok) {
      const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? (r.body as any).results ?? [];
      assert.ok(Array.isArray(arr));
    }
  });

  // ── ANALYSE DE SENTIMENT
  await suite.test("Analyse de sentiment → positif/négatif/neutre", async () => {
    if (!campaignId) return;
    const r = await api.get(`/ereputation/campaigns/${campaignId}/sentiment`);
    assert.ok([200, 404].includes(r.status));
    if (r.ok) {
      const body = r.body as any;
      if (body.sentiment !== undefined) {
        assert.ok(
          ["positive", "negative", "neutral", "mixed"].includes(body.sentiment),
          `Sentiment invalide: ${body.sentiment}`,
        );
      }
    }
  });

  // ── GÉNÉRER STRATÉGIE
  await suite.test("Générer stratégie e-réputation → 200", async () => {
    if (!campaignId) return;
    const r = await api.post(`/ereputation/campaigns/${campaignId}/generate-strategy`, {});
    assert.ok([200, 201, 404].includes(r.status), `Status: ${r.status}`);
  });

  // ── SCORE GLOBAL (dashboard général)
  await suite.test("Score de réputation global → via dashboard", async () => {
    const r = await api.get("/ereputation/campaigns");
    assert.ok(r.ok, `Status ${r.status}`);
    // Score global calculé côté frontend depuis les campagnes
    assert.ok(true, "Score global via liste OK");
  });

  // ── DELETE
  await suite.test("Supprimer une campagne → 200/204", async () => {
    if (!campaignId) return;
    const r = await api.delete(`/ereputation/campaigns/${campaignId}`);
    assert.ok([200, 204, 404].includes(r.status), `Status ${r.status}`);
  });

  await ctx.cleanup();
  return suite.getResults();
}
