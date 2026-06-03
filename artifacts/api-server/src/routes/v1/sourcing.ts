import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { sourcingJobsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../../middlewares/auth";

const router = Router();

const jobSchema = z.object({
  type: z.string().min(1),
  name: z.string().min(1),
  params: z.record(z.string()).optional().default({}),
});

router.get("/jobs", requireAuth, async (req, res) => {
  const rows = await db.select().from(sourcingJobsTable)
    .where(eq(sourcingJobsTable.tenantId, req.auth!.tenantId))
    .orderBy(desc(sourcingJobsTable.createdAt))
    .limit(100);
  res.json(rows);
});

router.post("/jobs", requireAuth, async (req, res) => {
  const parse = jobSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Données invalides", details: parse.error.issues });
    return;
  }
  const [job] = await db.insert(sourcingJobsTable).values({
    type: parse.data.type,
    name: parse.data.name,
    params: parse.data.params,
    status: "queued",
    tenantId: req.auth!.tenantId,
    createdBy: req.auth!.userId,
  }).returning();
  res.status(201).json(job);
});

router.get("/jobs/:id", requireAuth, async (req, res) => {
  const [job] = await db.select().from(sourcingJobsTable)
    .where(and(
      eq(sourcingJobsTable.id, req.params.id),
      eq(sourcingJobsTable.tenantId, req.auth!.tenantId),
    ))
    .limit(1);
  if (!job) { res.status(404).json({ error: "Job introuvable" }); return; }
  res.json(job);
});

router.patch("/jobs/:id", requireAuth, async (req, res) => {
  const allowed = z.object({
    status: z.enum(["queued", "running", "paused", "completed", "error"]).optional(),
    count: z.number().int().optional(),
    progress: z.number().int().min(0).max(100).optional(),
    duration: z.string().optional(),
    error: z.string().nullable().optional(),
  }).safeParse(req.body);
  if (!allowed.success) {
    res.status(400).json({ error: "Données invalides" });
    return;
  }
  const [updated] = await db.update(sourcingJobsTable)
    .set({ ...allowed.data, updatedAt: new Date() })
    .where(and(
      eq(sourcingJobsTable.id, req.params.id),
      eq(sourcingJobsTable.tenantId, req.auth!.tenantId),
    ))
    .returning();
  if (!updated) { res.status(404).json({ error: "Job introuvable" }); return; }
  res.json(updated);
});

router.delete("/jobs/:id", requireAuth, async (req, res) => {
  await db.delete(sourcingJobsTable).where(
    and(
      eq(sourcingJobsTable.id, req.params.id),
      eq(sourcingJobsTable.tenantId, req.auth!.tenantId),
    )
  );
  res.status(204).send();
});

export default router;
