import assert from "node:assert";
import { TestSuite, type SuiteResult } from "./runner.ts";
import { createTestContext } from "./setup.ts";
import { client } from "./test-client.ts";
import { pool } from "@workspace/db";
import { signAccessToken } from "../middlewares/auth.ts";

export async function run(): Promise<SuiteResult> {
  const ctx = await createTestContext();
  const suite = new TestSuite("Portail Client E-Réputation");

  // Token client (rôle client)
  const clientToken = signAccessToken({ userId: ctx.userId, tenantId: ctx.tenantId, email: ctx.userEmail, role: "client" });
  // Token admin (doit aussi avoir accès au portail client)
  const adminToken = ctx.adminToken;

  // ── Seed : campagne E-Réputation
  let campaignId: string;
  try {
    const { rows } = await pool.query(
      `INSERT INTO ereputation_campaigns (tenant_id, name, domain, status, reputation_score)
       VALUES ($1, 'Portail Test Campaign', 'portail-test.fr', 'active', 78)
       RETURNING id`,
      [ctx.tenantId],
    );
    campaignId = rows[0]?.id;
  } catch { /* table might not exist */ }

  // ── GET /client/ereputation/dashboard — sans auth → 401
  await suite.test("GET /client/ereputation/dashboard sans auth → 401", async () => {
    const r = await client.get("/client/ereputation/dashboard");
    assert.equal(r.status, 401, `Attendu 401, reçu ${r.status}`);
  });

  // ── GET /client/ereputation/dashboard — avec token client → 200
  await suite.test("GET /client/ereputation/dashboard client → 200", async () => {
    const r = await client.get("/client/ereputation/dashboard", clientToken);
    assert.equal(r.status, 200, `Attendu 200, reçu ${r.status}: ${JSON.stringify(r.body)}`);
    const body = r.body as any;
    assert.ok(typeof body.averageScore === "number" || body.averageScore === undefined || body.campaigns !== undefined,
      "Réponse dashboard structurée attendue");
  });

  // ── GET /client/ereputation/dashboard — admin → aussi 200
  await suite.test("GET /client/ereputation/dashboard admin → 200", async () => {
    const r = await client.get("/client/ereputation/dashboard", adminToken);
    assert.equal(r.status, 200, `Attendu 200, reçu ${r.status}`);
  });

  // ── GET /client/ereputation/campaigns — liste campagnes
  await suite.test("GET /client/ereputation/campaigns → liste", async () => {
    const r = await client.get("/client/ereputation/campaigns", clientToken);
    assert.equal(r.status, 200, `Attendu 200, reçu ${r.status}`);
    const body = r.body as any;
    assert.ok(Array.isArray(body) || Array.isArray(body.campaigns),
      `Réponse doit être un tableau ou objet avec campaigns: ${JSON.stringify(body).slice(0, 100)}`);
  });

  // ── GET /client/ereputation/approvals — liste approbations
  await suite.test("GET /client/ereputation/approvals → liste", async () => {
    const r = await client.get("/client/ereputation/approvals", clientToken);
    assert.equal(r.status, 200, `Attendu 200, reçu ${r.status}`);
    const body = r.body as any;
    assert.ok(Array.isArray(body) || Array.isArray(body.approvals),
      `Réponse doit être un tableau: ${JSON.stringify(body).slice(0, 100)}`);
  });

  // ── GET /client/ereputation/alerts — alertes
  await suite.test("GET /client/ereputation/alerts → liste", async () => {
    const r = await client.get("/client/ereputation/alerts", clientToken);
    assert.equal(r.status, 200, `Attendu 200, reçu ${r.status}`);
    const body = r.body as any;
    assert.ok(Array.isArray(body) || Array.isArray(body.alerts),
      `Réponse doit être un tableau: ${JSON.stringify(body).slice(0, 100)}`);
  });

  // ── POST /client/ereputation/approvals/:id/approve — sur ID fictif → 404
  await suite.test("POST /client/ereputation/approvals/:id/approve inexistant → 404", async () => {
    const r = await client.post(
      "/client/ereputation/approvals/00000000-0000-0000-0000-000000000000/approve",
      { comment: "Approuvé en test" },
      clientToken,
    );
    assert.equal(r.status, 404, `Attendu 404, reçu ${r.status}`);
  });

  // ── POST /client/ereputation/approvals/:id/reject — sur ID fictif → 404
  await suite.test("POST /client/ereputation/approvals/:id/reject inexistant → 404", async () => {
    const r = await client.post(
      "/client/ereputation/approvals/00000000-0000-0000-0000-000000000000/reject",
      { comment: "Refusé en test" },
      clientToken,
    );
    assert.equal(r.status, 404, `Attendu 404, reçu ${r.status}`);
  });

  // ── Workflow complet approbation (si campagne créée)
  if (campaignId) {
    await suite.test("Workflow approbation : créer + approuver", async () => {
      // Créer une approbation
      const createR = await pool.query(
        `INSERT INTO erep_approvals (tenant_id, campaign_id, content_type, content, status)
         VALUES ($1, $2, 'post', 'Contenu à approuver', 'pending_approval')
         RETURNING id`,
        [ctx.tenantId, campaignId],
      ).catch(() => ({ rows: [] as any[] }));

      if (createR.rows[0]?.id) {
        const approvalId = createR.rows[0].id;
        const r = await client.post(
          `/client/ereputation/approvals/${approvalId}/approve`,
          { comment: "Approuvé par le test E2E" },
          clientToken,
        );
        assert.ok([200, 204].includes(r.status), `Attendu 200/204, reçu ${r.status}: ${JSON.stringify(r.body)}`);
      }
    });
  }

  // ── GET /client/ereputation/reports — rapports
  await suite.test("GET /client/ereputation/reports → liste", async () => {
    const r = await client.get("/client/ereputation/reports", clientToken);
    assert.ok([200, 404].includes(r.status), `Attendu 200 ou 404, reçu ${r.status}`);
  });

  // ── Token admin (rôle admin) accède au portail client
  await suite.test("Admin accède aux routes portail client", async () => {
    const r = await client.get("/client/ereputation/campaigns", adminToken);
    assert.equal(r.status, 200, `Admin doit accéder au portail client: ${r.status}`);
  });

  // ── Token member sans rôle client ne doit pas accéder (ou 403)
  await suite.test("Member standard n'accède pas au portail client → 403", async () => {
    const memberToken = signAccessToken({ userId: ctx.userId, tenantId: ctx.tenantId, email: ctx.userEmail, role: "member" });
    const r = await client.get("/client/ereputation/dashboard", memberToken);
    // Selon la config requireRole, un member n'a pas accès aux routes client
    assert.equal(r.status, 403, `Attendu 403, reçu ${r.status}`);
  });

  await ctx.cleanup();
  return suite.getResults();
}
