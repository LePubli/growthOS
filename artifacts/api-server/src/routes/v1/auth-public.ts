/**
 * Routes d'inscription publiques — aucun middleware requireAuth.
 * POST /api/v1/auth/register-public — crée un tenant + user admin + subscription
 */

import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@workspace/db";
import { usersTable, tenantsTable } from "@workspace/db";
import { pool } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signAccessToken, signRefreshToken, type AuthPayload } from "../../middlewares/auth";

const router = Router();

const registerPublicSchema = z.object({
  companyName: z.string().min(2, "Nom d'entreprise requis (min 2 caractères)"),
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Mot de passe trop court (min 8 caractères)"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  planSlug: z.enum(["starter", "pro", "enterprise"]).optional().default("starter"),
  referralCode: z.string().optional(),
});

function makeSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "company";
}

function sanitizeUser(user: any) {
  const { passwordHash: _, ...safe } = user;
  return safe;
}

router.post("/register-public", async (req, res) => {
  const parse = registerPublicSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Données invalides", details: parse.error.issues });
    return;
  }

  const { companyName, email, password, firstName, lastName, planSlug, referralCode } = parse.data;

  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "Un compte existe déjà avec cet email" });
    return;
  }

  let slug = makeSlug(companyName);
  const existingSlugs = await db
    .select({ slug: tenantsTable.slug })
    .from(tenantsTable)
    .where(eq(tenantsTable.slug, slug));
  if (existingSlugs.length > 0) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const [tenant] = await db.insert(tenantsTable).values({ name: companyName, slug }).returning();

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db.insert(usersTable).values({
    email: email.toLowerCase(),
    passwordHash,
    firstName: firstName ?? null,
    lastName: lastName ?? null,
    role: "admin",
    tenantId: tenant.id,
  }).returning();

  // Créer la subscription au plan choisi
  try {
    const { rows: plans } = await pool.query<{ id: string }>(
      `SELECT id FROM plans WHERE slug = $1 LIMIT 1`,
      [planSlug],
    );
    if (plans.length > 0) {
      await pool.query(
        `INSERT INTO subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end)
         VALUES ($1, $2, 'active', NOW(), NOW() + INTERVAL '30 days')
         ON CONFLICT (tenant_id) DO UPDATE SET plan_id = EXCLUDED.plan_id, status = 'active'`,
        [tenant.id, plans[0].id],
      );
    }
  } catch {
    // Non-bloquant — la subscription sera créée au prochain login
  }

  // Gérer le code parrainage si fourni
  if (referralCode) {
    try {
      await pool.query(
        `INSERT INTO referral_uses (code, referred_tenant_id, used_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT DO NOTHING`,
        [referralCode.toUpperCase(), tenant.id],
      );
    } catch {
      // Non-bloquant
    }
  }

  const payload: AuthPayload = { userId: user.id, tenantId: tenant.id, email: user.email, role: "admin" };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/api/v1/auth",
  });

  res.status(201).json({
    accessToken,
    user: sanitizeUser(user),
    tenant,
    plan: planSlug,
    message: "Compte créé avec succès",
  });
});

export default router;
