import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@workspace/db";
import { tenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

type ApiKey = {
  id: string;
  name: string;
  key: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsed: string | null;
  requests: number;
};

async function getTenantKeys(tenantId: string): Promise<ApiKey[]> {
  const [tenant] = await db.select({ settings: tenantsTable.settings }).from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1);
  return (tenant?.settings as any)?.apiKeys || [];
}

async function saveTenantKeys(tenantId: string, keys: ApiKey[]) {
  const [tenant] = await db.select({ settings: tenantsTable.settings }).from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1);
  const settings = { ...(tenant?.settings as any || {}), apiKeys: keys };
  await db.update(tenantsTable).set({ settings }).where(eq(tenantsTable.id, tenantId));
}

function maskKey(key: string): string {
  return key.slice(0, 12) + "•".repeat(20);
}

router.get("/", async (req, res) => {
  const keys = await getTenantKeys(req.auth!.tenantId);
  res.json(keys.map(k => ({ ...k, key: maskKey(k.key) })));
});

const createSchema = z.object({
  name: z.string().min(1).max(60),
  scopes: z.array(z.string()).default(["read", "write"]),
});

router.post("/", async (req, res) => {
  const parse = createSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: "Données invalides" }); return; }

  const raw = `gos_${crypto.randomBytes(24).toString("hex")}`;
  const newKey: ApiKey = {
    id: crypto.randomUUID(),
    name: parse.data.name,
    key: raw,
    prefix: raw.slice(0, 12),
    scopes: parse.data.scopes,
    createdAt: new Date().toISOString(),
    lastUsed: null,
    requests: 0,
  };

  const keys = await getTenantKeys(req.auth!.tenantId);
  keys.push(newKey);
  await saveTenantKeys(req.auth!.tenantId, keys);

  res.status(201).json(newKey);
});

router.delete("/:id", async (req, res) => {
  const keys = await getTenantKeys(req.auth!.tenantId);
  const filtered = keys.filter(k => k.id !== req.params.id);
  if (filtered.length === keys.length) { res.status(404).json({ error: "Clé introuvable" }); return; }
  await saveTenantKeys(req.auth!.tenantId, filtered);
  res.json({ ok: true });
});

export default router;
