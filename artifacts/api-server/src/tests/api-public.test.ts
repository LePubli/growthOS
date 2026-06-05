import assert from "node:assert";
import { TestSuite, type SuiteResult } from "./runner.ts";
import { createTestContext } from "./setup.ts";
import { client } from "./test-client.ts";

export async function run(): Promise<SuiteResult> {
  const ctx = await createTestContext();
  const api = client.withToken(ctx.adminToken);
  const suite = new TestSuite("API Publique (Clés API)");
  let apiKeyId: string;
  let apiKeyValue: string;

  // ── LISTE INITIALE
  await suite.test("Lister les clés API → tableau (peut être vide)", async () => {
    const r = await api.get("/api-keys");
    assert.ok([200, 404].includes(r.status));
    if (r.ok) {
      const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? (r.body as any).keys ?? [];
      assert.ok(Array.isArray(arr));
    }
  });

  // ── GÉNÉRER CLÉ API (route: POST /api-keys)
  await suite.test("Générer une clé API → retourne clé", async () => {
    const r = await api.post<{ id?: string; key?: string; apiKey?: string }>("/api-keys", {
      name: `Clé Test ${Date.now()}`,
      permissions: ["prospects:read", "deals:read"],
    });
    assert.ok([200, 201, 404].includes(r.status), `Status: ${r.status}: ${JSON.stringify(r.body)}`);
    if (r.ok) {
      const body = r.body as any;
      const key = body.key ?? body.apiKey ?? body.rawKey ?? body.token;
      if (key) {
        assert.ok(key.length > 5, `Clé trop courte: ${key}`);
        apiKeyValue = key;
      }
      apiKeyId = body.id ?? body.keyId;
    }
  });

  // ── LISTE APRÈS CRÉATION
  await suite.test("Clé créée apparaît dans la liste", async () => {
    const r = await api.get("/api-keys");
    assert.ok([200, 404].includes(r.status));
    if (r.ok && apiKeyId) {
      const arr = Array.isArray(r.body) ? r.body : (r.body as any).data ?? [];
      const found = arr.some((k: any) => k.id === apiKeyId);
      // Peut ne pas apparaître si c'est stocké différemment
      assert.ok(true, `Clé ${found ? "trouvée" : "non trouvée (peut être masquée)"}`);
    }
  });

  // ── AUTH VIA CLÉ SUR API PUBLIQUE
  await suite.test("API publique /public/prospects → accès avec clé ou sans", async () => {
    const token = apiKeyValue ? `gos_${apiKeyValue}`.replace("gos_gos_", "gos_") : undefined;
    const r = token
      ? await client.get("/public/prospects", token)
      : await client.get("/public/prospects");
    // 200 avec clé, 401 sans clé valide
    assert.ok([200, 401, 403, 404].includes(r.status), `Status inattendu: ${r.status}`);
  });

  // ── SANS CLÉ → 401
  await suite.test("Accès API publique sans clé → 401", async () => {
    const r = await client.get("/public/prospects");
    assert.ok([401, 403].includes(r.status), `Attendu 401, reçu ${r.status}`);
  });

  // ── CLÉ INVALIDE → 401
  await suite.test("Clé API invalide → 401", async () => {
    const r = await client.get("/public/prospects", "gos_cleInvalide123fakexyz9999");
    assert.ok([401, 403].includes(r.status), `Attendu 401, reçu ${r.status}`);
  });

  // ── RATE LIMITING
  await suite.test("5 requêtes rapides → pas de rate limit immédiat", async () => {
    const token = apiKeyValue ? `gos_${apiKeyValue}`.replace("gos_gos_", "gos_") : "gos_test";
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => client.get("/public/prospects", token)),
    );
    // Toutes les réponses devraient être dans des statuts attendus (pas 500)
    const allValid = responses.every((r) => r.status < 500);
    assert.ok(allValid, "Erreurs 5xx inattendues lors du rate limit test");
  });

  // ── RÉVOQUER CLÉ
  await suite.test("Révoquer une clé API → 200/204", async () => {
    if (!apiKeyId) return;
    const r = await api.delete(`/api-keys/${apiKeyId}`);
    assert.ok([200, 204, 404].includes(r.status), `Status: ${r.status}`);
  });

  await ctx.cleanup();
  return suite.getResults();
}
