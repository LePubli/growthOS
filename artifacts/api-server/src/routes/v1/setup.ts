/**
 * First-run installer. The database and JWT secrets must be provisioned by
 * Docker before the UI is served; everything else is configured in the UI.
 */
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { db, pool, tenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole, signAccessToken, signRefreshToken } from "../../middlewares/auth";
import { throttleAuthentication } from "../../middlewares/authGate";
import { providerKeysService } from "../../lib/provider-keys/ProviderKeysService";
import { verifySmtpConnection } from "../../services/email";

const router = Router();

const bootstrapSchema = z.object({
  setupToken: z.string().min(1),
  companyName: z.string().trim().min(2).max(120),
  email: z.string().email().max(255),
  password: z.string().min(12).max(200),
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
});

function verifySetupToken(supplied: string): boolean {
  const configured = process.env.SETUP_TOKEN;
  if (!configured || configured.length < 32) return false;
  const a = Buffer.from(configured);
  const b = Buffer.from(supplied);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

router.get("/status", async (_req, res) => {
  try {
    const { rows } = await pool.query<{ has_user: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM users) AS has_user",
    );
    res.setHeader("Cache-Control", "no-store");
    res.json({ databaseReady: true, needsBootstrap: !rows[0]?.has_user });
  } catch {
    res.status(503).json({ databaseReady: false, error: "Base de données indisponible" });
  }
});

router.post("/bootstrap", throttleAuthentication, async (req, res) => {
  const parsed = bootstrapSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Données d'installation invalides" }); return; }
  if (!verifySetupToken(parsed.data.setupToken)) {
    res.status(403).json({ error: "Code d'installation invalide" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Prevent two concurrent requests from creating two installation owners.
    await client.query("SELECT pg_advisory_xact_lock(7026134)");
    const { rows: existing } = await client.query<{ has_user: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM users) AS has_user",
    );
    if (existing[0]?.has_user) {
      await client.query("ROLLBACK");
      res.status(409).json({ error: "GrowthOS est déjà initialisé" });
      return;
    }

    const { companyName, email, password, firstName, lastName } = parsed.data;
    const slug = companyName.toLowerCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workspace";
    const { rows: tenants } = await client.query<{ id: string; name: string; slug: string }>(
      `INSERT INTO tenants (name, slug, settings)
       VALUES ($1, $2, $3::jsonb) RETURNING id, name, slug`,
      [companyName, slug, JSON.stringify({ onboardingComplete: false, aiProvider: "disabled" })],
    );
    const passwordHash = await bcrypt.hash(password, 12);
    const { rows: users } = await client.query<{ id: string; email: string; role: string }>(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, tenant_id)
       VALUES ($1, $2, $3, $4, 'platform_admin', $5)
       RETURNING id, email, role`,
      [email.toLowerCase(), passwordHash, firstName ?? null, lastName ?? null, tenants[0].id],
    );
    await client.query("COMMIT");

    const user = users[0];
    const tenant = { ...tenants[0], settings: { onboardingComplete: false, aiProvider: "disabled" } };
    const auth = { userId: user.id, tenantId: tenant.id, email: user.email, role: "platform_admin" };
    res.cookie("refresh_token", signRefreshToken(auth), {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000, path: "/api/v1/auth",
    });
    res.status(201).json({ accessToken: signAccessToken(auth), user, tenant });
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    res.status(500).json({ error: "L'initialisation a échoué. Consultez les journaux du serveur." });
  } finally {
    client.release();
  }
});

router.use(requireAuth, requireRole("admin"));

router.get("/configuration", async (req, res) => {
  const [tenant] = await db.select().from(tenantsTable)
    .where(eq(tenantsTable.id, req.auth!.tenantId)).limit(1);
  if (!tenant) { res.status(404).json({ error: "Espace introuvable" }); return; }
  const email = (tenant.settings?.email ?? {}) as Record<string, unknown>;
  const smtp = await providerKeysService.getKey(req.auth!.tenantId, "smtp");
  const keys = await providerKeysService.getKeys(req.auth!.tenantId);
  res.setHeader("Cache-Control", "no-store");
  res.json({
    companyName: tenant.name,
    website: tenant.settings?.website ?? "",
    targetRegion: tenant.settings?.targetRegion ?? "",
    offer: tenant.settings?.offer ?? "sites-web-seo",
    dailyEmailLimit: tenant.settings?.dailyEmailLimit ?? 10,
    email: { ...email, passwordConfigured: Boolean(smtp) },
    aiProviders: keys.filter(key => ["anthropic", "openai", "deepseek"].includes(key.provider)).map(key => key.provider),
    aiProvider: tenant.settings?.aiProvider ?? "disabled",
    onboardingComplete: tenant.settings?.onboardingComplete === true,
  });
});

const configurationSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  website: z.union([z.literal(""), z.string().url().max(300)]).optional(),
  targetRegion: z.string().max(120).optional(),
  offer: z.enum(["sites-web-seo", "sites-web", "seo"]).optional(),
  dailyEmailLimit: z.number().int().min(0).max(50).optional(),
  aiProvider: z.enum(["disabled", "anthropic", "openai", "deepseek"]).optional(),
  email: z.object({
    mode: z.enum(["disabled", "smtp", "resend"]),
    host: z.string().max(250).optional(),
    port: z.number().int().min(1).max(65535).optional(),
    secure: z.boolean().optional(),
    username: z.string().max(255).optional(),
    from: z.string().email().max(255).optional(),
    replyTo: z.union([z.literal(""), z.string().email()]).optional(),
    password: z.string().max(500).optional(),
  }).optional(),
});

router.patch("/configuration", async (req, res) => {
  const parsed = configurationSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Paramètres invalides", details: parsed.error.issues }); return; }
  const config = parsed.data;
  const [tenant] = await db.select().from(tenantsTable)
    .where(eq(tenantsTable.id, req.auth!.tenantId)).limit(1);
  if (!tenant) { res.status(404).json({ error: "Espace introuvable" }); return; }

  if (config.aiProvider && config.aiProvider !== "disabled") {
    const configuredKeys = await providerKeysService.getKeys(req.auth!.tenantId);
    if (!configuredKeys.some(key => key.provider === config.aiProvider && key.isActive)) {
      res.status(422).json({ error: "Configurez la clé API du fournisseur choisi avant de l'activer." });
      return;
    }
  }

  if (config.email?.password) {
    await providerKeysService.upsertKey(req.auth!.tenantId, "smtp", config.email.password);
  }
  const { email: emailWithPassword, ...business } = config;
  const email = emailWithPassword
    ? (({ password: _password, ...safe }) => safe)(emailWithPassword)
    : undefined;
  const settings = {
    ...tenant.settings,
    ...business,
    ...(email ? { email: { ...(tenant.settings?.email ?? {}), ...email } } : {}),
  };
  const [updated] = await db.update(tenantsTable)
    .set({ name: config.companyName, settings })
    .where(eq(tenantsTable.id, req.auth!.tenantId)).returning();
  res.json({ ok: true, companyName: updated.name, emailPasswordStored: Boolean(config.email?.password) });
});

router.post("/finish", async (req, res) => {
  const [tenant] = await db.select().from(tenantsTable)
    .where(eq(tenantsTable.id, req.auth!.tenantId)).limit(1);
  if (!tenant) { res.status(404).json({ error: "Espace introuvable" }); return; }
  await db.update(tenantsTable)
    .set({ settings: { ...tenant.settings, onboardingComplete: true } })
    .where(eq(tenantsTable.id, req.auth!.tenantId));
  res.json({ ok: true });
});

router.post("/smtp/verify", async (req, res) => {
  const result = await verifySmtpConnection(req.auth!.tenantId);
  res.status(result.ok ? 200 : 422).json(result);
});

export default router;
