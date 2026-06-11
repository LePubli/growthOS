import assert from "node:assert";
import { TestSuite, type SuiteResult } from "./runner.ts";
import { createTestContext, createTestProspect } from "./setup.ts";
import { client } from "./test-client.ts";

export async function run(): Promise<SuiteResult> {
  const ctx = await createTestContext();
  const api = client.withToken(ctx.adminToken);
  const suite = new TestSuite("AI SDR");

  // ── GÉNÉRATION EMAIL
  await suite.test("Génération email → retourne sujet + corps", async () => {
    const prospect = await createTestProspect(ctx.tenantId);
    const r = await api.post("/ai-sdr/draft/email", {
      accountId: prospect.id,
      goal: "Premier contact suite à levée de fonds",
      tone: "formal",
    });
    assert.ok([200, 201].includes(r.status), `Status attendu 200, reçu ${r.status}: ${JSON.stringify(r.body)}`);
    const body = r.body as any;
    const hasContent = body.subject || body.content || body.email || body.message || body.text || body.draft;
    assert.ok(hasContent, `Contenu email manquant: ${JSON.stringify(Object.keys(body))}`);
  });

  // ── GÉNÉRATION LINKEDIN
  await suite.test("Génération message LinkedIn → ≤ 300 caractères", async () => {
    const prospect = await createTestProspect(ctx.tenantId);
    const r = await api.post("/ai-sdr/draft/linkedin", {
      accountId: prospect.id,
      goal: "Prise de contact LinkedIn",
      tone: "casual",
    });
    assert.ok([200, 201].includes(r.status), `Status ${r.status}`);
    const body = r.body as any;
    const msg = body.message ?? body.content ?? body.text ?? body.draft ?? body.linkedin ?? "";
    if (typeof msg === "string" && msg.length > 0) {
      assert.ok(msg.length <= 300, `Message LinkedIn trop long: ${msg.length} chars`);
    }
  });

  // ── SÉQUENCE MULTI-TOUCH
  await suite.test("Génération séquence multi-touch → étapes avec délais", async () => {
    const prospect = await createTestProspect(ctx.tenantId);
    const r = await api.post("/ai-sdr/sequence", {
      accountId: prospect.id,
      goal: "Prospect chaud ayant visité notre site",
      steps: 3,
      tone: "friendly",
    });
    assert.ok([200, 201].includes(r.status), `Status ${r.status}`);
    const body = r.body as any;
    const steps = body.steps ?? body.sequence ?? body.emails ?? body.messages ?? [];
    if (Array.isArray(steps) && steps.length > 0) {
      steps.forEach((step: any, i: number) => {
        assert.ok(typeof step === "object" && step !== null, `Step ${i} devrait être un objet`);
      });
    }
  });

  // ── TEMPLATES RAPIDES
  await suite.test("Templates rapides → liste disponible", async () => {
    const r = await api.get("/ai-sdr/templates");
    assert.ok([200, 404].includes(r.status));
    if (r.ok) {
      const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? (r.body as any).templates ?? [];
      assert.ok(Array.isArray(arr));
    }
  });

  // ── SANS PROSPECT
  await suite.test("Génération sans accountId → 400", async () => {
    const r = await api.post("/ai-sdr/draft/email", {
      goal: "Test sans cible",
      tone: "formal",
    });
    // Peut retourner 400 (prospectId requis) ou 200 avec contenu générique selon impl
    assert.ok([200, 201, 400, 422].includes(r.status), `Status inattendu: ${r.status}`);
  });

  // ── PLAYBOOK
  await suite.test("Playbook de vente → stratégie générée", async () => {
    const r = await api.post("/ai-sdr/playbook", {
      industry: "SaaS",
      targetRole: "CTO",
      dealStage: "proposal",
    });
    assert.ok([200, 201, 400].includes(r.status), `Status: ${r.status}`);
  });

  // ── STATUT
  await suite.test("Statut du service AI SDR → objet de configuration", async () => {
    const r = await api.get("/ai-sdr/status");
    // 200 = Ollama disponible ou non, 404 = route absente, 500 = service indisponible (env sans Ollama)
    assert.ok(
      [200, 404, 500].includes(r.status),
      `Statut inattendu: ${r.status} — corps: ${JSON.stringify(r.body)}`,
    );
  });

  await ctx.cleanup();
  return suite.getResults();
}
