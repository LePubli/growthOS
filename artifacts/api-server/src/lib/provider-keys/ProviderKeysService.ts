/**
 * ProviderKeysService — Gestion chiffrée des clés API providers IA
 * Chiffrement AES-256-CBC avec ENCRYPTION_KEY (32 octets).
 * Fallback transparent sur process.env si pas de clé en DB.
 */

import crypto from "crypto";
import { pool } from "@workspace/db";
import { logger } from "../logger";

// ── Chiffrement ────────────────────────────────────────────────────────────────
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ALGO = "aes-256-cbc";

function deriveKey(): Buffer {
  if (ENCRYPTION_KEY) {
    const k = Buffer.from(ENCRYPTION_KEY, "hex");
    if (k.length === 32) return k;
  }
  // Clé dérivée stable à partir du DATABASE_URL (fallback non-prod)
  const seed = process.env.DATABASE_URL ?? "growthos-dev-key-fallback-32bytes";
  return crypto.createHash("sha256").update(seed).digest();
}

function encrypt(plaintext: string): string {
  try {
    const key = deriveKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return `enc:${iv.toString("hex")}:${encrypted.toString("hex")}`;
  } catch {
    // Fallback base64 si erreur
    return `b64:${Buffer.from(plaintext).toString("base64")}`;
  }
}

function decrypt(stored: string): string {
  try {
    if (stored.startsWith("enc:")) {
      const [, ivHex, encHex] = stored.split(":");
      const key = deriveKey();
      const iv = Buffer.from(ivHex, "hex");
      const enc = Buffer.from(encHex, "hex");
      const decipher = crypto.createDecipheriv(ALGO, key, iv);
      return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
    }
    if (stored.startsWith("b64:")) {
      return Buffer.from(stored.slice(4), "base64").toString("utf8");
    }
    return stored; // Legacy non-chiffré
  } catch {
    return stored;
  }
}

function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "…" + key.slice(-4);
}

// ── Types ──────────────────────────────────────────────────────────────────────
export interface ProviderKey {
  id: string;
  tenantId: string;
  provider: string;
  apiKeyMasked: string;
  hasSecret: boolean;
  endpointUrl?: string;
  isActive: boolean;
  lastUsedAt?: string;
  createdAt: string;
}

export const PROVIDERS = [
  { id: "openai",    name: "OpenAI (GPT-4/3.5)",   icon: "🤖", description: "AI SDR, Deal Coach, génération de contenu" },
  { id: "anthropic", name: "Anthropic / Claude",    icon: "🧠", description: "Alternative à OpenAI, vision avancée" },
  { id: "gemini",    name: "Google Gemini",         icon: "✨", description: "IA Google, multimodal" },
  { id: "mistral",   name: "Mistral API",           icon: "🌪️", description: "IA européenne souveraine" },
  { id: "ollama",    name: "Ollama (local)",        icon: "🦙", description: "LLM local — Llama, Mistral, Qwen", hasEndpoint: true },
  { id: "serpapi",   name: "SerpAPI",               icon: "🔍", description: "Suivi SERP, résultats Google" },
  { id: "linkedin",  name: "LinkedIn API",          icon: "💼", description: "Enrichissement LinkedIn", hasSecret: true },
  { id: "hunter",    name: "Hunter.io",             icon: "📧", description: "Recherche emails professionnels" },
  { id: "clearbit",  name: "Clearbit",              icon: "🔮", description: "Enrichissement données B2B" },
  { id: "dropcontact", name: "Dropcontact",         icon: "📨", description: "Enrichissement email FR" },
  { id: "apollo",    name: "Apollo.io",             icon: "🚀", description: "Base de contacts B2B" },
  { id: "crunchbase", name: "Crunchbase",           icon: "💰", description: "Données startup & funding" },
] as const;

export class ProviderKeysService {
  // ── Lecture ──────────────────────────────────────────────────────────────────

  async getKeys(tenantId: string): Promise<ProviderKey[]> {
    const { rows } = await pool.query(
      `SELECT id, tenant_id, provider, api_key, api_secret, endpoint_url,
              is_active, last_used_at, created_at
       FROM provider_api_keys WHERE tenant_id = $1 ORDER BY provider`,
      [tenantId],
    );
    return rows.map(r => ({
      id: r.id,
      tenantId: r.tenant_id,
      provider: r.provider,
      apiKeyMasked: maskKey(decrypt(r.api_key)),
      hasSecret: !!r.api_secret,
      endpointUrl: r.endpoint_url ?? undefined,
      isActive: r.is_active,
      lastUsedAt: r.last_used_at?.toISOString(),
      createdAt: r.created_at.toISOString(),
    }));
  }

  /** Récupère la clé déchiffrée pour usage interne (services IA) */
  async getKey(tenantId: string, provider: string): Promise<{ apiKey: string; apiSecret?: string; endpointUrl?: string } | null> {
    const { rows } = await pool.query(
      `SELECT api_key, api_secret, endpoint_url FROM provider_api_keys
       WHERE tenant_id = $1 AND provider = $2 AND is_active = true`,
      [tenantId, provider],
    );
    if (!rows[0]) return null;

    // Marquer last_used_at
    pool.query(
      `UPDATE provider_api_keys SET last_used_at = NOW() WHERE tenant_id = $1 AND provider = $2`,
      [tenantId, provider],
    ).catch(() => {});

    return {
      apiKey: decrypt(rows[0].api_key),
      apiSecret: rows[0].api_secret ? decrypt(rows[0].api_secret) : undefined,
      endpointUrl: rows[0].endpoint_url ?? undefined,
    };
  }

  // ── Écriture ─────────────────────────────────────────────────────────────────

  async upsertKey(
    tenantId: string,
    provider: string,
    apiKey: string,
    apiSecret?: string,
    endpointUrl?: string,
  ): Promise<ProviderKey> {
    if (!apiKey.trim()) throw new Error("La clé API ne peut pas être vide");

    const encKey = encrypt(apiKey.trim());
    const encSecret = apiSecret?.trim() ? encrypt(apiSecret.trim()) : null;

    const { rows } = await pool.query(
      `INSERT INTO provider_api_keys (tenant_id, provider, api_key, api_secret, endpoint_url)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, provider) DO UPDATE
         SET api_key = EXCLUDED.api_key,
             api_secret = COALESCE(EXCLUDED.api_secret, provider_api_keys.api_secret),
             endpoint_url = COALESCE(EXCLUDED.endpoint_url, provider_api_keys.endpoint_url),
             is_active = true,
             updated_at = NOW()
       RETURNING id, tenant_id, provider, api_key, api_secret, endpoint_url, is_active, last_used_at, created_at`,
      [tenantId, provider, encKey, encSecret, endpointUrl?.trim() || null],
    );

    return {
      id: rows[0].id,
      tenantId: rows[0].tenant_id,
      provider: rows[0].provider,
      apiKeyMasked: maskKey(apiKey.trim()),
      hasSecret: !!rows[0].api_secret,
      endpointUrl: rows[0].endpoint_url ?? undefined,
      isActive: rows[0].is_active,
      createdAt: rows[0].created_at.toISOString(),
    };
  }

  async deleteKey(tenantId: string, provider: string): Promise<void> {
    const { rowCount } = await pool.query(
      `DELETE FROM provider_api_keys WHERE tenant_id = $1 AND provider = $2`,
      [tenantId, provider],
    );
    if (!rowCount) throw new Error(`Clé '${provider}' introuvable`);
  }

  // ── Test de clé ──────────────────────────────────────────────────────────────

  async testKey(provider: string, apiKey: string, endpointUrl?: string): Promise<{ ok: boolean; message: string; latencyMs?: number }> {
    const start = Date.now();
    try {
      const result = await _testProvider(provider, apiKey, endpointUrl);
      return { ...result, latencyMs: Date.now() - start };
    } catch (err: any) {
      return { ok: false, message: err.message ?? "Erreur de connexion", latencyMs: Date.now() - start };
    }
  }

  // ── Fallback env ─────────────────────────────────────────────────────────────

  /** Récupère la clé depuis DB ou process.env en fallback */
  async getKeyWithFallback(tenantId: string, provider: string): Promise<{ apiKey: string; endpointUrl?: string } | null> {
    const dbKey = await this.getKey(tenantId, provider);
    if (dbKey) return dbKey;

    // Fallback process.env
    const envMap: Record<string, string> = {
      openai: "OPENAI_API_KEY",
      anthropic: "ANTHROPIC_API_KEY",
      gemini: "GEMINI_API_KEY",
      mistral: "MISTRAL_API_KEY",
      serpapi: "SERPAPI_KEY",
      hunter: "HUNTER_API_KEY",
      clearbit: "CLEARBIT_API_KEY",
      linkedin: "LINKEDIN_API_KEY",
    };
    const envKey = process.env[envMap[provider] ?? ""];
    if (envKey) return { apiKey: envKey };

    // Ollama spécial
    if (provider === "ollama") {
      return { apiKey: "", endpointUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434" };
    }

    return null;
  }
}

// ── Tests par provider ─────────────────────────────────────────────────────────

async function _testProvider(provider: string, apiKey: string, endpointUrl?: string): Promise<{ ok: boolean; message: string }> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 8000);

  try {
    switch (provider) {
      case "openai": {
        const r = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` }, signal: ctrl.signal,
        });
        if (r.ok) return { ok: true, message: "OpenAI ✅ Clé valide" };
        const e = await r.json().catch(() => ({})) as any;
        return { ok: false, message: `OpenAI ❌ ${e.error?.message ?? r.statusText}` };
      }
      case "anthropic": {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
          body: JSON.stringify({ model: "claude-3-haiku-20240307", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
          signal: ctrl.signal,
        });
        if (r.ok || r.status === 400) return { ok: true, message: "Anthropic ✅ Clé valide" };
        return { ok: false, message: `Anthropic ❌ HTTP ${r.status}` };
      }
      case "mistral": {
        const r = await fetch("https://api.mistral.ai/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` }, signal: ctrl.signal,
        });
        if (r.ok) return { ok: true, message: "Mistral ✅ Clé valide" };
        return { ok: false, message: `Mistral ❌ HTTP ${r.status}` };
      }
      case "gemini": {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, { signal: ctrl.signal });
        if (r.ok) return { ok: true, message: "Gemini ✅ Clé valide" };
        return { ok: false, message: `Gemini ❌ HTTP ${r.status}` };
      }
      case "ollama": {
        const base = endpointUrl ?? "http://localhost:11434";
        const r = await fetch(`${base}/api/tags`, { signal: ctrl.signal });
        if (r.ok) {
          const d = await r.json() as any;
          const models = d.models?.map((m: any) => m.name).join(", ") || "aucun";
          return { ok: true, message: `Ollama ✅ Connecté — modèles: ${models}` };
        }
        return { ok: false, message: `Ollama ❌ HTTP ${r.status} — vérifiez l'URL` };
      }
      case "serpapi": {
        const r = await fetch(`https://serpapi.com/account?api_key=${apiKey}`, { signal: ctrl.signal });
        if (r.ok) return { ok: true, message: "SerpAPI ✅ Clé valide" };
        return { ok: false, message: `SerpAPI ❌ HTTP ${r.status}` };
      }
      case "hunter": {
        const r = await fetch(`https://api.hunter.io/v2/account?api_key=${apiKey}`, { signal: ctrl.signal });
        if (r.ok) {
          const d = await r.json() as any;
          return { ok: true, message: `Hunter.io ✅ ${d.data?.requests?.searches?.available ?? "?"} recherches disponibles` };
        }
        return { ok: false, message: `Hunter.io ❌ HTTP ${r.status}` };
      }
      case "clearbit": {
        const r = await fetch("https://person.clearbit.com/v2/people/find?email=test@clearbit.com", {
          headers: { Authorization: `Bearer ${apiKey}` }, signal: ctrl.signal,
        });
        if (r.ok || r.status === 404 || r.status === 422) return { ok: true, message: "Clearbit ✅ Clé valide" };
        return { ok: false, message: `Clearbit ❌ HTTP ${r.status}` };
      }
      default:
        return { ok: true, message: `${provider} — Test non disponible (clé sauvegardée)` };
    }
  } finally {
    clearTimeout(timeout);
  }
}

export const providerKeysService = new ProviderKeysService();
