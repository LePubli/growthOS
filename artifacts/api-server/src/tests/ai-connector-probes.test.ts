/**
 * Offline regression checks for Claude/OpenAI/DeepSeek credential probes.
 * No real provider request or token generation is performed.
 * Run: pnpm --filter @workspace/api-server exec node --import tsx src/tests/ai-connector-probes.test.ts
 */
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgresql://unused:unused@127.0.0.1:1/unused";

const { providerKeysService } = await import("../lib/provider-keys/ProviderKeysService");
const { llmService } = await import("../lib/llm/LLMService");

const probes = [
  { provider: "anthropic", url: "https://api.anthropic.com/v1/models", label: "Claude" },
  { provider: "openai", url: "https://api.openai.com/v1/models", label: "OpenAI" },
  { provider: "deepseek", url: "https://api.deepseek.com/models", label: "DeepSeek" },
] as const;

const originalFetch = globalThis.fetch;
const originalGetKey = providerKeysService.getKeyWithFallback;
let assertions = 0;

try {
  for (const probe of probes) {
    for (const httpStatus of [200, 400, 401, 403]) {
      let calls = 0;
      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        calls++;
        assert.equal(String(url), probe.url, `${probe.label}: endpoint exact`);
        assert.equal(init?.method ?? "GET", "GET", `${probe.label}: aucun appel de génération`);
        const headers = new Headers(init?.headers);
        assert.equal(headers.get("authorization"), "Bearer fake-key", `${probe.label}: authentification`);
        if (probe.provider === "anthropic") {
          assert.equal(headers.get("anthropic-version"), "2026-10-21", "Version Claude");
        }
        return new Response(httpStatus === 200 ? '{"data":[]}' : '{"error":"simulated"}', {
          status: httpStatus,
          headers: { "Content-Type": "application/json" },
        });
      }) as typeof fetch;

      const tested = await providerKeysService.testKey(probe.provider, "fake-key");
      assert.equal(calls, 1, `${probe.label}: une requête`);
      assert.equal(tested.ok, httpStatus === 200, `${probe.label}: réponse ${httpStatus}`);
      assertions++;
      console.log(`  ✓ ${probe.label}, HTTP ${httpStatus} → ${tested.ok ? "accepté" : "refusé"}`);
    }
  }

  // Verify real request serialization with mocked provider responses.
  providerKeysService.getKeyWithFallback = async () => ({ apiKey: "fake-key" });
  for (const probe of probes) {
    let requests = 0;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      requests++;
      const expectedUrl = probe.provider === "anthropic"
        ? "https://api.anthropic.com/v1/messages"
        : probe.provider === "deepseek"
          ? "https://api.deepseek.com/chat/completions"
          : "https://api.openai.com/v1/chat/completions";
      assert.equal(String(url), expectedUrl);
      assert.equal(init?.method, "POST");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model,
        probe.provider === "anthropic" ? "claude-haiku-5-5"
          : probe.provider === "deepseek" ? "deepseek-flash" : "gpt-4o-mini");
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer fake-key");
      return new Response(probe.provider === "anthropic"
        ? JSON.stringify({ content: [{ type: "text", text: "Bonjour via Claude" }] })
        : JSON.stringify({ choices: [{ message: { content: `Bonjour via ${probe.label}` } }] }),
      { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;

    const generated = await llmService.generate("Dis bonjour", {
      provider: probe.provider, tenantId: "test-tenant",
    });
    assert.equal(generated, `Bonjour via ${probe.label}`);
    assert.equal(requests, 1);
    assertions++;
    console.log(`  ✓ ${probe.label} : génération simulée au format officiel`);
  }
  console.log(`\nPASS — ${assertions} tests de connecteurs IA hors ligne (aucun appel externe)\n`);
} finally {
  globalThis.fetch = originalFetch;
  providerKeysService.getKeyWithFallback = originalGetKey;
}
