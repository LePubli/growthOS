import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { sequencesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

const sequenceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["draft", "active", "paused"]).optional().default("draft"),
  steps: z.array(z.any()).optional().default([]),
});

router.get("/", async (req, res) => {
  const rows = await db.select().from(sequencesTable)
    .where(eq(sequencesTable.tenantId, req.auth!.tenantId))
    .orderBy(desc(sequencesTable.createdAt));

  const sequences = rows.map(s => ({
    ...s,
    openRate: Number(s.openRate) || 0,
    replyRate: Number(s.replyRate) || 0,
  }));
  res.json(sequences);
});

router.get("/:id", async (req, res) => {
  const [seq] = await db.select().from(sequencesTable)
    .where(and(eq(sequencesTable.id, req.params.id), eq(sequencesTable.tenantId, req.auth!.tenantId)))
    .limit(1);
  if (!seq) { res.status(404).json({ error: "Séquence introuvable" }); return; }
  res.json({ ...seq, openRate: Number(seq.openRate), replyRate: Number(seq.replyRate) });
});

router.post("/", async (req, res) => {
  const parse = sequenceSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Données invalides", details: parse.error.issues });
    return;
  }
  const [seq] = await db.insert(sequencesTable).values({
    ...parse.data,
    tenantId: req.auth!.tenantId,
    createdBy: req.auth!.userId,
  }).returning();
  res.status(201).json({ ...seq, openRate: Number(seq.openRate), replyRate: Number(seq.replyRate) });
});

router.post("/:id/toggle", async (req, res) => {
  const { id } = req.params;
  const [seq] = await db.select().from(sequencesTable)
    .where(and(eq(sequencesTable.id, id), eq(sequencesTable.tenantId, req.auth!.tenantId)))
    .limit(1);

  if (!seq) { res.status(404).json({ error: "Séquence introuvable" }); return; }

  const newStatus = seq.status === "active" ? "paused" : "active";
  const [updated] = await db.update(sequencesTable)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(sequencesTable.id, id))
    .returning();

  res.json({ ...updated, openRate: Number(updated.openRate), replyRate: Number(updated.replyRate) });
});

router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const parse = sequenceSchema.partial().safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Données invalides" });
    return;
  }
  const [updated] = await db.update(sequencesTable)
    .set({ ...parse.data, updatedAt: new Date() })
    .where(and(eq(sequencesTable.id, id), eq(sequencesTable.tenantId, req.auth!.tenantId)))
    .returning();

  if (!updated) { res.status(404).json({ error: "Séquence introuvable" }); return; }
  res.json({ ...updated, openRate: Number(updated.openRate), replyRate: Number(updated.replyRate) });
});

router.delete("/:id", async (req, res) => {
  await db.delete(sequencesTable).where(
    and(eq(sequencesTable.id, req.params.id), eq(sequencesTable.tenantId, req.auth!.tenantId))
  );
  res.json({ ok: true });
});

export default router;
