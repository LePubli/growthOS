import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { dealsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

const dealSchema = z.object({
  title: z.string().min(1),
  company: z.string().optional(),
  value: z.number().min(0).optional().default(0),
  stage: z.enum(["lead", "qualified", "proposal", "negotiation", "won", "lost"]).optional().default("lead"),
  probability: z.number().int().min(0).max(100).optional(),
  closeDate: z.string().optional(),
  prospect: z.string().optional(),
});

router.get("/", async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const rows = await db.select().from(dealsTable)
    .where(eq(dealsTable.tenantId, tenantId))
    .orderBy(desc(dealsTable.createdAt));

  const deals = rows.map(d => ({
    ...d,
    value: Number(d.value) || 0,
  }));
  res.json(deals);
});

router.post("/", async (req, res) => {
  const parse = dealSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Données invalides", details: parse.error.issues });
    return;
  }
  const { value, ...rest } = parse.data;
  const [deal] = await db.insert(dealsTable).values({
    ...rest,
    value: String(value ?? 0),
    tenantId: req.auth!.tenantId,
    createdBy: req.auth!.userId,
  }).returning();
  res.status(201).json({ ...deal, value: Number(deal.value) });
});

router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const parse = dealSchema.partial().safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Données invalides" });
    return;
  }
  const { value, ...rest } = parse.data;
  const updateData: any = { ...rest, updatedAt: new Date() };
  if (value !== undefined) updateData.value = String(value);

  const [updated] = await db.update(dealsTable)
    .set(updateData)
    .where(and(eq(dealsTable.id, id), eq(dealsTable.tenantId, req.auth!.tenantId)))
    .returning();

  if (!updated) { res.status(404).json({ error: "Deal introuvable" }); return; }
  res.json({ ...updated, value: Number(updated.value) });
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  await db.delete(dealsTable).where(
    and(eq(dealsTable.id, id), eq(dealsTable.tenantId, req.auth!.tenantId))
  );
  res.json({ ok: true });
});

export default router;
