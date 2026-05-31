import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

function sanitizeUser(user: any) {
  const { passwordHash: _, ...safe } = user;
  return safe;
}

router.get("/me", async (req, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.auth!.userId)).limit(1);
  if (!user) { res.status(404).json({ error: "Utilisateur introuvable" }); return; }
  res.json(sanitizeUser(user));
});

const updateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  website: z.string().optional(),
  bio: z.string().optional(),
});

router.patch("/me", async (req, res) => {
  const parse = updateSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: "Données invalides", details: parse.error.issues }); return; }

  const [updated] = await db.update(usersTable)
    .set({ ...parse.data, updatedAt: new Date() })
    .where(eq(usersTable.id, req.auth!.userId))
    .returning();

  res.json(sanitizeUser(updated));
});

const pwSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

router.post("/me/password", async (req, res) => {
  const parse = pwSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: "Données invalides" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.auth!.userId)).limit(1);
  if (!user) { res.status(404).json({ error: "Utilisateur introuvable" }); return; }

  const valid = await bcrypt.compare(parse.data.currentPassword, user.passwordHash);
  if (!valid) { res.status(400).json({ error: "Mot de passe actuel incorrect" }); return; }

  const hash = await bcrypt.hash(parse.data.newPassword, 12);
  await db.update(usersTable).set({ passwordHash: hash, updatedAt: new Date() }).where(eq(usersTable.id, req.auth!.userId));

  res.json({ ok: true });
});

export default router;
