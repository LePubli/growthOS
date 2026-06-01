import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { webhooksTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

const ALL_EVENTS = ["prospect.created", "prospect.updated", "deal.created", "deal.stage_changed", "sequence.enrolled", "signal.created"];

const webhookSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  status: z.enum(["active", "paused"]).optional().default("active"),
});

router.get("/", async (req, res) => {
  const rows = await db.select().from(webhooksTable)
    .where(eq(webhooksTable.tenantId, req.auth!.tenantId))
    .orderBy(desc(webhooksTable.createdAt));
  res.json(rows);
});

router.get("/events", async (_req, res) => {
  res.json(ALL_EVENTS);
});

router.post("/", async (req, res) => {
  const parse = webhookSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Données invalides", details: parse.error.issues });
    return;
  }
  const secret = `whs_${crypto.randomBytes(20).toString("hex")}`;
  const [wh] = await db.insert(webhooksTable).values({
    ...parse.data,
    secret,
    tenantId: req.auth!.tenantId,
    createdBy: req.auth!.userId,
  }).returning();
  res.status(201).json(wh);
});

router.patch("/:id", async (req, res) => {
  const parse = webhookSchema.partial().safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Données invalides" });
    return;
  }
  const [updated] = await db.update(webhooksTable)
    .set({ ...parse.data, updatedAt: new Date() })
    .where(and(eq(webhooksTable.id, req.params.id), eq(webhooksTable.tenantId, req.auth!.tenantId)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Webhook introuvable" }); return; }
  res.json(updated);
});

router.post("/:id/toggle", async (req, res) => {
  const [wh] = await db.select().from(webhooksTable)
    .where(and(eq(webhooksTable.id, req.params.id), eq(webhooksTable.tenantId, req.auth!.tenantId)))
    .limit(1);
  if (!wh) { res.status(404).json({ error: "Webhook introuvable" }); return; }
  const [updated] = await db.update(webhooksTable)
    .set({ status: wh.status === "active" ? "paused" : "active", updatedAt: new Date() })
    .where(eq(webhooksTable.id, req.params.id))
    .returning();
  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  await db.delete(webhooksTable).where(
    and(eq(webhooksTable.id, req.params.id), eq(webhooksTable.tenantId, req.auth!.tenantId))
  );
  res.json({ ok: true });
});

export default router;
