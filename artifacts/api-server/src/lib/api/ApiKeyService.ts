import crypto from "crypto";
import { db, tenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { pool } from "@workspace/db";

export interface ApiKeyRecord {
  id: string;
  name: string;
  key: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsed: string | null;
  requests: number;
}

/** Sliding window in-memory rate limiter: max 100 req/min per key */
const _rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT = 100;
const WINDOW_MS = 60_000;

async function _getTenantKeys(tenantId: string): Promise<ApiKeyRecord[]> {
  const [tenant] = await db
    .select({ settings: tenantsTable.settings })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, tenantId))
    .limit(1);
  return ((tenant?.settings as Record<string, unknown>)?.apiKeys as ApiKeyRecord[]) ?? [];
}

async function _saveTenantKeys(tenantId: string, keys: ApiKeyRecord[]): Promise<void> {
  const [tenant] = await db
    .select({ settings: tenantsTable.settings })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, tenantId))
    .limit(1);
  const settings = { ...((tenant?.settings as Record<string, unknown>) ?? {}), apiKeys: keys };
  await db.update(tenantsTable).set({ settings }).where(eq(tenantsTable.id, tenantId));
}

export const ApiKeyService = {
  async generateApiKey(
    tenantId: string,
    name: string,
    scopes: string[] = ["read", "write"],
  ): Promise<ApiKeyRecord> {
    const raw = `gos_${crypto.randomBytes(24).toString("hex")}`;
    const newKey: ApiKeyRecord = {
      id: crypto.randomUUID(),
      name,
      key: raw,
      prefix: raw.slice(0, 12),
      scopes,
      createdAt: new Date().toISOString(),
      lastUsed: null,
      requests: 0,
    };
    const keys = await _getTenantKeys(tenantId);
    keys.push(newKey);
    await _saveTenantKeys(tenantId, keys);
    return newKey;
  },

  async revokeApiKey(tenantId: string, keyId: string): Promise<boolean> {
    const keys = await _getTenantKeys(tenantId);
    const filtered = keys.filter((k) => k.id !== keyId);
    if (filtered.length === keys.length) return false;
    await _saveTenantKeys(tenantId, filtered);
    return true;
  },

  async listApiKeys(tenantId: string): Promise<ApiKeyRecord[]> {
    const keys = await _getTenantKeys(tenantId);
    return keys.map((k) => ({ ...k, key: k.key.slice(0, 12) + "•".repeat(20) }));
  },

  /**
   * Valide une clé API brute et retourne { tenantId, scopes } si valide.
   */
  async validateApiKey(
    raw: string,
  ): Promise<{ tenantId: string; keyId: string; scopes: string[] } | null> {
    if (!raw.startsWith("gos_")) return null;
    // Chercher dans tous les tenants via la colonne settings JSONB
    const result = await pool.query(
      `SELECT id, settings FROM tenants WHERE settings::jsonb->'apiKeys' @> $1::jsonb`,
      [JSON.stringify([{ prefix: raw.slice(0, 12) }])],
    );
    for (const row of result.rows) {
      const keys: ApiKeyRecord[] = (row.settings?.apiKeys ?? []) as ApiKeyRecord[];
      const found = keys.find((k) => k.key === raw);
      if (found) {
        // Mettre à jour lastUsed + compteur
        const updated = keys.map((k) =>
          k.id === found.id
            ? { ...k, lastUsed: new Date().toISOString(), requests: k.requests + 1 }
            : k,
        );
        const settings = { ...(row.settings ?? {}), apiKeys: updated };
        await pool.query(`UPDATE tenants SET settings = $1 WHERE id = $2`, [
          JSON.stringify(settings),
          row.id,
        ]);
        return { tenantId: row.id, keyId: found.id, scopes: found.scopes };
      }
    }
    return null;
  },

  /**
   * Vérifie le rate limit pour une clé API (sliding window 100 req/min).
   * Retourne true si autorisé.
   */
  checkRateLimit(keyId: string): boolean {
    const now = Date.now();
    const entry = _rateLimitMap.get(keyId);
    if (!entry || now - entry.windowStart > WINDOW_MS) {
      _rateLimitMap.set(keyId, { count: 1, windowStart: now });
      return true;
    }
    entry.count += 1;
    if (entry.count > RATE_LIMIT) return false;
    return true;
  },
};
