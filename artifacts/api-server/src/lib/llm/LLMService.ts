/**
 * LLMService — Service central de gestion des LLM
 * Supporte : Ollama (local), DeepSeek, OpenAI, Mistral (OpenAI-compatible), Anthropic
 * Si aucune clé n'est configurée → fallback silencieux sur null → mock LLM dans les services appelants.
 */

import { providerKeysService } from "../provider-keys/ProviderKeysService";
import { logger } from "../logger";

/* ─── Config providers ───────────────────────────────────────── */

const OPENAI_COMPAT_PROVIDERS: Record<string, { baseUrl: string; defaultModel: string }> = {
  openai:   { baseUrl: "https://api.openai.com/v1",      defaultModel: "gpt-4o-mini" },
  deepseek: { baseUrl: "https://api.deepseek.com/v1",    defaultModel: "deepseek-chat" },
  mistral:  { baseUrl: "https://api.mistral.ai/v1",      defaultModel: "mistral-small-latest" },
  gemini:   { baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", defaultModel: "gemini-2.0-flash" },
};

const DEFAULT_TIMEOUT_MS = 25_000;

/* ─── Types ──────────────────────────────────────────────────── */

export interface LLMOptions {
  /** Provider à utiliser. Défaut : "ollama" */
  provider?: string;
  /** tenantId pour récupérer la clé en DB */
  tenantId?: string;
}

/* ─── Helpers ────────────────────────────────────────────────── */

function makeAbortSignal(ms: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, clear: () => clearTimeout(t) };
}

/* ─── Calls par provider ─────────────────────────────────────── */

async function callOllama(prompt: string, baseUrl: string): Promise<string | null> {
  const model = process.env.OLLAMA_MODEL ?? "llama3.2";
  const { signal, clear } = makeAbortSignal(DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false }),
      signal,
    });
    clear();
    if (!res.ok) return null;
    const data = await res.json() as { response?: string };
    return data.response?.trim() ?? null;
  } catch {
    clear();
    return null;
  }
}

async function callOpenAICompat(
  prompt: string,
  apiKey: string,
  baseUrl: string,
  model: string,
): Promise<string | null> {
  const { signal, clear } = makeAbortSignal(DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 1500,
      }),
      signal,
    });
    clear();
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      logger.warn({ provider: baseUrl, status: res.status, err }, "LLM API error");
      return null;
    }
    const data = await res.json() as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch (err: any) {
    clear();
    logger.debug({ err: err.message }, "LLM call failed");
    return null;
  }
}

async function callAnthropic(prompt: string, apiKey: string): Promise<string | null> {
  const { signal, clear } = makeAbortSignal(DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
      signal,
    });
    clear();
    if (!res.ok) return null;
    const data = await res.json() as { content?: { type: string; text: string }[] };
    return data.content?.find(b => b.type === "text")?.text?.trim() ?? null;
  } catch {
    clear();
    return null;
  }
}

/* ─── Service central ────────────────────────────────────────── */

class LLMService {
  /**
   * Génère du texte via le provider demandé.
   * Retourne null si le provider est indisponible / clé manquante → le service appelant utilise son mock.
   */
  async generate(prompt: string, opts: LLMOptions = {}): Promise<string | null> {
    const provider = opts.provider ?? "ollama";
    const tenantId = opts.tenantId;

    logger.debug({ provider, tenantId: tenantId ? "***" : undefined }, "LLM generate");

    /* ── Ollama ── */
    if (provider === "ollama") {
      let baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
      if (tenantId) {
        const key = await providerKeysService.getKeyWithFallback(tenantId, "ollama").catch(() => null);
        if (key?.endpointUrl) baseUrl = key.endpointUrl;
      }
      const result = await callOllama(prompt, baseUrl);
      logger.info({ provider: "ollama", ok: result !== null }, "LLM call completed");
      return result;
    }

    /* ── Anthropic ── */
    if (provider === "anthropic") {
      const key = tenantId
        ? await providerKeysService.getKeyWithFallback(tenantId, "anthropic").catch(() => null)
        : null;
      if (!key?.apiKey) {
        logger.warn({ provider }, "No Anthropic key — skip");
        return null;
      }
      const result = await callAnthropic(prompt, key.apiKey);
      logger.info({ provider: "anthropic", ok: result !== null }, "LLM call completed");
      return result;
    }

    /* ── OpenAI-compatible (openai, deepseek, mistral, gemini) ── */
    const compatConfig = OPENAI_COMPAT_PROVIDERS[provider];
    if (compatConfig) {
      const key = tenantId
        ? await providerKeysService.getKeyWithFallback(tenantId, provider).catch(() => null)
        : null;
      if (!key?.apiKey) {
        logger.warn({ provider }, `No ${provider} API key in DB — skip, falling back to mock`);
        return null;
      }
      const baseUrl = key.endpointUrl ?? compatConfig.baseUrl;
      const model = compatConfig.defaultModel;
      const result = await callOpenAICompat(prompt, key.apiKey, baseUrl, model);
      logger.info({ provider, model, ok: result !== null }, "LLM call completed");
      return result;
    }

    logger.warn({ provider }, "Unknown provider — falling back to mock");
    return null;
  }
}

export const llmService = new LLMService();
