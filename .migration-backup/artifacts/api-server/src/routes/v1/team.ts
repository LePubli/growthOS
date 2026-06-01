import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, and, ne } from "drizzle-orm";

const router = Router();

function sanitize(user: any) {
  const { passwordHash: _, ...safe } = user;
  return safe;
}

router.get("/", async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const members = await db.select().from(usersTable).where(eq(usersTable.tenantId, tenantId));
  res.json(members.map(sanitize));
});

const inviteSchema = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(["admin", "member"]).default("member"),
});

router.post("/invite", async (req, res) => {
  const parse = inviteSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: "Données invalides", details: parse.error.issues }); return; }

  const { email, firstName, lastName, role } = parse.data;
  const tenantId = req.auth!.tenantId;

  const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  if (existing.length > 0) { res.status(409).json({ error: "Un utilisateur existe déjà avec cet email" }); return; }

  const tempPassword = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const [user] = await db.insert(usersTable).values({
    email: email.toLowerCase(),
    passwordHash,
    firstName: firstName || null,
    lastName: lastName || null,
    role,
    tenantId,
  }).returning();

  res.status(201).json({ ...sanitize(user), tempPassword });
});

const roleSchema = z.object({ role: z.enum(["admin", "member"]) });

router.patch("/:id/role", async (req, res) => {
  const parse = roleSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: "Rôle invalide" }); return; }

  const tenantId = req.auth!.tenantId;
  const [member] = await db.select().from(usersTable).where(and(eq(usersTable.id, req.params.id), eq(usersTable.tenantId, tenantId))).limit(1);
  if (!member) { res.status(404).json({ error: "Membre introuvable" }); return; }
  if (member.role === "owner") { res.status(403).json({ error: "Impossible de modifier le rôle du propriétaire" }); return; }

  const [updated] = await db.update(usersTable).set({ role: parse.data.role, updatedAt: new Date() })
    .where(eq(usersTable.id, req.params.id)).returning();
  res.json(sanitize(updated));
});

router.delete("/:id", async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const userId = req.auth!.userId;

  if (req.params.id === userId) { res.status(400).json({ error: "Impossible de vous supprimer vous-même" }); return; }

  const [member] = await db.select().from(usersTable).where(and(eq(usersTable.id, req.params.id), eq(usersTable.tenantId, tenantId))).limit(1);
  if (!member) { res.status(404).json({ error: "Membre introuvable" }); return; }
  if (member.role === "owner") { res.status(403).json({ error: "Impossible de supprimer le propriétaire" }); return; }

  await db.delete(usersTable).where(eq(usersTable.id, req.params.id));
  res.json({ ok: true });
});

export default router;
