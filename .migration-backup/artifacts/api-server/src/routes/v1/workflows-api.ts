import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { workflowsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

const workflowSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  trigger: z.string().default("prospect_created"),
  triggerConfig: z.record(z.any()).optional().default({}),
  actions: z.array(z.any()).optional().default([]),
  status: z.enum(["draft", "active", "paused"]).optional().default("draft"),
});

router.get("/", async (req, res) => {
  const rows = await db.select().from(workflowsTable)
    .where(eq(workflowsTable.tenantId, req.auth!.tenantId))
    .orderBy(desc(workflowsTable.createdAt));
  res.json(rows);
});

router.get("/:id", async (req, res) => {
  const [row] = await db.select().from(workflowsTable)
    .where(and(eq(workflowsTable.id, req.params.id), eq(workflowsTable.tenantId, req.auth!.tenantId)))
    .limit(1);
  if (!row) { res.status(404).json({ error: "Workflow introuvable" }); return; }
  res.json(row);
});

router.post("/", async (req, res) => {
  const parse = workflowSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Données invalides", details: parse.error.issues });
    return;
  }
  const [wf] = await db.insert(workflowsTable).values({
    ...parse.data,
    tenantId: req.auth!.tenantId,
    createdBy: req.auth!.userId,
  }).returning();
  res.status(201).json(wf);
});

router.patch("/:id", async (req, res) => {
  const parse = workflowSchema.partial().safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Données invalides" });
    return;
  }
  const [updated] = await db.update(workflowsTable)
    .set({ ...parse.data, updatedAt: new Date() })
    .where(and(eq(workflowsTable.id, req.params.id), eq(workflowsTable.tenantId, req.auth!.tenantId)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Workflow introuvable" }); return; }
  res.json(updated);
});

router.post("/:id/toggle", async (req, res) => {
  const [wf] = await db.select().from(workflowsTable)
    .where(and(eq(workflowsTable.id, req.params.id), eq(workflowsTable.tenantId, req.auth!.tenantId)))
    .limit(1);
  if (!wf) { res.status(404).json({ error: "Workflow introuvable" }); return; }
  const newStatus = wf.status === "active" ? "paused" : "active";
  const [updated] = await db.update(workflowsTable)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(workflowsTable.id, req.params.id))
    .returning();
  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  await db.delete(workflowsTable).where(
    and(eq(workflowsTable.id, req.params.id), eq(workflowsTable.tenantId, req.auth!.tenantId))
  );
  res.json({ ok: true });
});

export default router;
