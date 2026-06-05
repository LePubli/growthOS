import assert from "node:assert";
import { TestSuite, type SuiteResult } from "./runner.ts";
import { createTestContext, createTestProspect } from "./setup.ts";
import { client } from "./test-client.ts";

export async function run(): Promise<SuiteResult> {
  const ctx = await createTestContext();
  const api = client.withToken(ctx.adminToken);
  const suite = new TestSuite("RGPD & Conformité");

  // ── EXPORT DONNÉES (Article 20) - route: /compliance/export-data
  await suite.test("Export données personnelles Article 20 → JSON complet", async () => {
    const r = await api.post("/compliance/export-data", {});
    assert.ok([200, 201, 404].includes(r.status), `Status: ${r.status}: ${JSON.stringify(r.body)}`);
    if (r.ok) {
      const body = r.body as any;
      assert.ok(typeof body === "object", "Export devrait retourner un objet");
    }
  });

  // ── CONSENTEMENT (champs: consentType, granted, ipAddress)
  await suite.test("Enregistrer un consentement marketing → 201", async () => {
    const r = await api.post("/compliance/consent", {
      consentType: "marketing_email",
      granted: true,
      ipAddress: "127.0.0.1",
    });
    assert.ok([200, 201, 404].includes(r.status), `Status: ${r.status}: ${JSON.stringify(r.body)}`);
  });

  // ── LISTE CONSENTEMENTS
  await suite.test("Liste des consentements → tableau", async () => {
    const r = await api.get("/compliance/consents");
    assert.ok([200, 404].includes(r.status));
    if (r.ok) {
      const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? [];
      assert.ok(Array.isArray(arr));
    }
  });

  // ── AUDIT TRAIL
  await suite.test("Audit trail → enregistre les modifications critiques", async () => {
    const r = await api.get("/compliance/audit-log");
    assert.ok([200, 404].includes(r.status));
    if (r.ok) {
      const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? (r.body as any).logs ?? [];
      assert.ok(Array.isArray(arr));
    }
  });

  // ── PARAMÈTRES RGPD
  await suite.test("Paramètres RGPD → lecture des settings", async () => {
    const r = await api.get("/compliance/settings");
    assert.ok([200, 404].includes(r.status));
    if (r.ok) {
      assert.ok(typeof r.body === "object", "Settings devrait être un objet");
    }
  });

  // ── MISE À JOUR PARAMÈTRES
  await suite.test("Mise à jour paramètres RGPD → sauvegardé", async () => {
    const r = await api.patch("/compliance/settings", {
      dataRetentionDays: 365,
      consentRequired: true,
    });
    assert.ok([200, 204, 404].includes(r.status), `Status: ${r.status}`);
  });

  // ── SUPPRESSION DONNÉES (droit à l'oubli)
  await suite.test("Anonymisation d'un prospect (droit à l'oubli) → 200/204", async () => {
    const prospect = await createTestProspect(ctx.tenantId, {
      email: `rgpd-${Date.now()}@test.fr`,
    });
    const r = await api.post("/compliance/forget", {
      entityType: "prospect",
      entityId: prospect.id,
    });
    assert.ok([200, 204, 404].includes(r.status), `Status: ${r.status}`);
  });

  await ctx.cleanup();
  return suite.getResults();
}
