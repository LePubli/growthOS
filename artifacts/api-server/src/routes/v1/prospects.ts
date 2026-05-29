import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { prospectsTable } from "@workspace/db";
import { eq, and, or, ilike, desc, count, sql } from "drizzle-orm";

const router = Router();

const prospectSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  website: z.string().optional(),
  status: z.enum(["new", "contacted", "qualified", "negotiation", "won", "lost"]).optional().default("new"),
  score: z.number().int().min(0).max(100).optional(),
  isStarred: z.boolean().optional(),
});

router.get("/", async (req, res) => {
  const { search, status, page = "1", limit = "50" } = req.query as Record<string, string>;
  const tenantId = req.auth!.tenantId;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const conditions = [eq(prospectsTable.tenantId, tenantId)];
  if (status && status !== "all") {
    conditions.push(eq(prospectsTable.status, status));
  }
  if (search) {
    conditions.push(or(
      ilike(prospectsTable.firstName, `%${search}%`),
      ilike(prospectsTable.lastName, `%${search}%`),
      ilike(prospectsTable.email, `%${search}%`),
      ilike(prospectsTable.company, `%${search}%`),
    )!);
  }

  const where = and(...conditions);

  const [rows, [{ total }]] = await Promise.all([
    db.select().from(prospectsTable).where(where).orderBy(desc(prospectsTable.createdAt)).limit(parseInt(limit)).offset(offset),
    db.select({ total: count() }).from(prospectsTable).where(where),
  ]);

  res.json({ data: rows, total: Number(total), page: parseInt(page), limit: parseInt(limit) });
});

router.post("/", async (req, res) => {
  const parse = prospectSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Données invalides", details: parse.error.issues });
    return;
  }
  const { email, ...rest } = parse.data;
  const [prospect] = await db.insert(prospectsTable).values({
    ...rest,
    email: email || null,
    tenantId: req.auth!.tenantId,
    createdBy: req.auth!.userId,
  }).returning();
  res.status(201).json(prospect);
});

router.post("/bulk", async (req, res) => {
  const { prospects } = req.body as { prospects: any[] };
  if (!Array.isArray(prospects) || prospects.length === 0) {
    res.status(400).json({ error: "Tableau de prospects requis" });
    return;
  }
  const rows = prospects.slice(0, 1000).map((p) => ({
    firstName: p.firstName || null,
    lastName: p.lastName || null,
    email: p.email || null,
    phone: p.phone || null,
    company: p.company || null,
    jobTitle: p.jobTitle || null,
    website: p.website || null,
    status: (p.status as any) || "new",
    tenantId: req.auth!.tenantId,
    createdBy: req.auth!.userId,
  }));

  const inserted = await db.insert(prospectsTable).values(rows).returning({ id: prospectsTable.id });
  res.status(201).json({ count: inserted.length });
});

router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const parse = prospectSchema.partial().safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Données invalides" });
    return;
  }
  const { email, ...rest } = parse.data;
  const updateData: any = { ...rest, updatedAt: new Date() };
  if (email !== undefined) updateData.email = email || null;

  const [updated] = await db.update(prospectsTable)
    .set(updateData)
    .where(and(eq(prospectsTable.id, id), eq(prospectsTable.tenantId, req.auth!.tenantId)))
    .returning();

  if (!updated) { res.status(404).json({ error: "Prospect introuvable" }); return; }
  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  await db.delete(prospectsTable).where(
    and(eq(prospectsTable.id, id), eq(prospectsTable.tenantId, req.auth!.tenantId))
  );
  res.json({ ok: true });
});

export default router;
