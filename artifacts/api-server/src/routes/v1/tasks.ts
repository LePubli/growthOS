import { Router } from "express";
import { z } from "zod";
import { db, tasksTable } from "@workspace/db";
import { eq, and, desc, asc } from "drizzle-orm";

const router = Router();

const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["todo", "in_progress", "done", "cancelled"]).default("todo"),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  dueDate: z.string().optional().nullable(),
  entityType: z.enum(["prospect", "deal", "signal"]).optional().nullable(),
  entityId: z.string().uuid().optional().nullable(),
});

router.get("/", async (req, res) => {
  const { status, priority, entityType, entityId } = req.query as Record<string, string>;
  const tenantId = req.auth!.tenantId;
  const conditions: any[] = [eq(tasksTable.tenantId, tenantId)];
  if (status) conditions.push(eq(tasksTable.status, status));
  if (priority) conditions.push(eq(tasksTable.priority, priority));
  if (entityType) conditions.push(eq(tasksTable.entityType, entityType));
  if (entityId) conditions.push(eq(tasksTable.entityId, entityId));

  const rows = await db.select().from(tasksTable)
    .where(and(...conditions))
    .orderBy(asc(tasksTable.dueDate), desc(tasksTable.createdAt))
    .limit(200);
  res.json(rows);
});

router.get("/:id", async (req, res) => {
  const [row] = await db.select().from(tasksTable)
    .where(and(eq(tasksTable.id, req.params.id), eq(tasksTable.tenantId, req.auth!.tenantId)));
  if (!row) { res.status(404).json({ error: "Tâche introuvable" }); return; }
  res.json(row);
});

router.post("/", async (req, res) => {
  const parse = taskSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: "Données invalides", details: parse.error.issues }); return; }
  const { dueDate, ...rest } = parse.data;
  const [task] = await db.insert(tasksTable).values({
    ...rest,
    dueDate: dueDate ? new Date(dueDate) : null,
    tenantId: req.auth!.tenantId,
    createdBy: req.auth!.userId,
  }).returning();
  res.status(201).json(task);
});

router.patch("/:id", async (req, res) => {
  const parse = taskSchema.partial().safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: "Données invalides" }); return; }
  const { dueDate, ...rest } = parse.data;
  const [task] = await db.update(tasksTable)
    .set({ ...rest, dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : undefined, updatedAt: new Date() })
    .where(and(eq(tasksTable.id, req.params.id), eq(tasksTable.tenantId, req.auth!.tenantId)))
    .returning();
  if (!task) { res.status(404).json({ error: "Tâche introuvable" }); return; }
  res.json(task);
});

router.post("/:id/complete", async (req, res) => {
  const [task] = await db.update(tasksTable)
    .set({ status: "done", completedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(tasksTable.id, req.params.id), eq(tasksTable.tenantId, req.auth!.tenantId)))
    .returning();
  if (!task) { res.status(404).json({ error: "Tâche introuvable" }); return; }
  res.json(task);
});

router.delete("/:id", async (req, res) => {
  await db.delete(tasksTable)
    .where(and(eq(tasksTable.id, req.params.id), eq(tasksTable.tenantId, req.auth!.tenantId)));
  res.status(204).end();
});

export default router;
