import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { templatesTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";

const router = Router();

const templateSchema = z.object({
  name: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  category: z.enum(["outreach", "followup", "closing", "nurturing", "other"]).default("outreach"),
  variables: z.array(z.string()).optional().default([]),
});

router.get("/", async (req, res) => {
  const { category } = req.query as Record<string, string>;
  const conditions: any[] = [eq(templatesTable.tenantId, req.auth!.tenantId)];
  if (category) conditions.push(eq(templatesTable.category, category));

  const rows = await db.select().from(templatesTable)
    .where(and(...conditions))
    .orderBy(desc(templatesTable.createdAt));
  res.json(rows);
});

router.get("/:id", async (req, res) => {
  const [row] = await db.select().from(templatesTable)
    .where(and(eq(templatesTable.id, req.params.id), eq(templatesTable.tenantId, req.auth!.tenantId)))
    .limit(1);
  if (!row) { res.status(404).json({ error: "Template introuvable" }); return; }
  res.json(row);
});

router.post("/", async (req, res) => {
  const parse = templateSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Données invalides", details: parse.error.issues });
    return;
  }
  const [tmpl] = await db.insert(templatesTable).values({
    ...parse.data,
    tenantId: req.auth!.tenantId,
    createdBy: req.auth!.userId,
  }).returning();
  res.status(201).json(tmpl);
});

router.patch("/:id", async (req, res) => {
  const parse = templateSchema.partial().safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Données invalides" });
    return;
  }
  const [updated] = await db.update(templatesTable)
    .set({ ...parse.data, updatedAt: new Date() })
    .where(and(eq(templatesTable.id, req.params.id), eq(templatesTable.tenantId, req.auth!.tenantId)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Template introuvable" }); return; }
  res.json(updated);
});

router.post("/:id/use", async (req, res) => {
  await db.update(templatesTable)
    .set({ usedCount: sql`used_count + 1` })
    .where(and(eq(templatesTable.id, req.params.id), eq(templatesTable.tenantId, req.auth!.tenantId)));
  res.json({ ok: true });
});

router.delete("/:id", async (req, res) => {
  await db.delete(templatesTable).where(
    and(eq(templatesTable.id, req.params.id), eq(templatesTable.tenantId, req.auth!.tenantId))
  );
  res.json({ ok: true });
});

export default router;
