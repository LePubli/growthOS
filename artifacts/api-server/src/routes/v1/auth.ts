import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { db } from "@workspace/db";
import { usersTable, tenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signAccessToken, signRefreshToken, JWT_REFRESH_SECRET, normalizeRole, type AuthPayload } from "../../middlewares/auth";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  companyName: z.string().optional(),
});

function makeSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "company";
}

function sanitizeUser(user: any) {
  const { passwordHash: _, ...safe } = user;
  return safe;
}

router.post("/login", async (req, res) => {
  const parse = loginSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Données invalides", details: parse.error.issues });
    return;
  }
  const { email, password } = parse.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  if (!user) {
    res.status(401).json({ error: "Email ou mot de passe incorrect" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Email ou mot de passe incorrect" });
    return;
  }

  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, user.tenantId)).limit(1);

  // Bug #1 fix: normaliser "owner" → "admin" pour compatibilité RBAC
  const payload: AuthPayload = { userId: user.id, tenantId: user.tenantId, email: user.email, role: normalizeRole((user as any).role) };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/api/v1/auth",
  });

  res.json({ accessToken, user: sanitizeUser(user), tenant });
});

router.post("/register", async (req, res) => {
  const parse = registerSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Données invalides", details: parse.error.issues });
    return;
  }
  const { email, password, firstName, lastName, companyName } = parse.data;

  const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Un compte existe déjà avec cet email" });
    return;
  }

  const tenantName = companyName || `${firstName || email.split("@")[0]}'s company`;
  let slug = makeSlug(tenantName);

  const existingSlugs = await db.select({ slug: tenantsTable.slug }).from(tenantsTable).where(eq(tenantsTable.slug, slug));
  if (existingSlugs.length > 0) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const [tenant] = await db.insert(tenantsTable).values({ name: tenantName, slug }).returning();

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db.insert(usersTable).values({
    email: email.toLowerCase(),
    passwordHash,
    firstName: firstName || null,
    lastName: lastName || null,
    role: "admin",
    tenantId: tenant.id,
  }).returning();

  // Bug #1 & #6 fix: inclure le rôle dans le payload JWT dès l'inscription
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

  res.status(201).json({ accessToken, user: sanitizeUser(user), tenant });
});

router.post("/refresh", (req, res) => {
  const token = req.cookies?.refresh_token;
  if (!token) {
    res.status(401).json({ error: "Refresh token manquant" });
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_REFRESH_SECRET) as AuthPayload;
    const newAccess = signAccessToken({ userId: payload.userId, tenantId: payload.tenantId, email: payload.email, role: payload.role });
    res.json({ accessToken: newAccess });
  } catch {
    res.status(401).json({ error: "Refresh token invalide" });
  }
});

router.post("/logout", (_req, res) => {
  res.clearCookie("refresh_token", { path: "/api/v1/auth" });
  res.json({ ok: true });
});

export default router;
