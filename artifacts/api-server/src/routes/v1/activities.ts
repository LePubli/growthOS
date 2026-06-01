import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { activitiesTable } from "@workspace/db";
import { eq, and, desc, or } from "drizzle-orm";

const router = Router();

const activitySchema = z.object({
  type: z.enum(["call", "email", "meeting", "note", "task"]).default("note"),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["planned", "done", "cancelled"]).default("done"),
  prospectId: z.string().uuid().optional().nullable(),
  dealId: z.string().uuid().optional().nullable(),
  scheduledAt: z.string().optional().nullable(),
  doneAt: z.string().optional().nullable(),
});

router.get("/", async (req, res) => {
  const { prospectId, dealId, type } = req.query as Record<string, string>;
  const tenantId = req.auth!.tenantId;

  const conditions: any[] = [eq(activitiesTable.tenantId, tenantId)];
  if (prospectId) conditions.push(eq(activitiesTable.prospectId, prospectId));
  if (dealId) conditions.push(eq(activitiesTable.dealId, dealId));
  if (type) conditions.push(eq(activitiesTable.type, type));

  const rows = await db.select().from(activitiesTable)
    .where(and(...conditions))
    .orderBy(desc(activitiesTable.createdAt))
    .limit(100);

  res.json(rows);
});

router.post("/", async (req, res) => {
  const parse = activitySchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Données invalides", details: parse.error.issues });
    return;
  }
  const { scheduledAt, doneAt, ...rest } = parse.data;
  const [activity] = await db.insert(activitiesTable).values({
    ...rest,
    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    doneAt: doneAt ? new Date(doneAt) : (rest.status === "done" ? new Date() : null),
    tenantId: req.auth!.tenantId,
    createdBy: req.auth!.userId,
  }).returning();
  res.status(201).json(activity);
});

router.patch("/:id", async (req, res) => {
  const parse = activitySchema.partial().safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Données invalides" });
    return;
  }
  const { scheduledAt, doneAt, ...rest } = parse.data;
  const updateData: any = { ...rest, updatedAt: new Date() };
  if (scheduledAt !== undefined) updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
  if (doneAt !== undefined) updateData.doneAt = doneAt ? new Date(doneAt) : null;

  const [updated] = await db.update(activitiesTable)
    .set(updateData)
    .where(and(eq(activitiesTable.id, req.params.id), eq(activitiesTable.tenantId, req.auth!.tenantId)))
    .returning();

  if (!updated) { res.status(404).json({ error: "Activité introuvable" }); return; }
  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  await db.delete(activitiesTable).where(
    and(eq(activitiesTable.id, req.params.id), eq(activitiesTable.tenantId, req.auth!.tenantId))
  );
  res.json({ ok: true });
});

export default router;
