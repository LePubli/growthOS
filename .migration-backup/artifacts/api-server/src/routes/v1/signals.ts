import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { signalsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

const signalSchema = z.object({
  type: z.enum(["funding", "hiring", "news", "technology", "intent"]),
  company: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  score: z.number().int().min(0).max(100).optional().default(50),
  isRead: z.boolean().optional(),
  isStarred: z.boolean().optional(),
});

router.get("/", async (req, res) => {
  const rows = await db.select().from(signalsTable)
    .where(eq(signalsTable.tenantId, req.auth!.tenantId))
    .orderBy(desc(signalsTable.createdAt));
  res.json(rows);
});

router.post("/", async (req, res) => {
  const parse = signalSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Données invalides", details: parse.error.issues });
    return;
  }
  const [signal] = await db.insert(signalsTable).values({
    ...parse.data,
    tenantId: req.auth!.tenantId,
  }).returning();
  res.status(201).json(signal);
});

router.post("/:id/read", async (req, res) => {
  const [updated] = await db.update(signalsTable)
    .set({ isRead: true })
    .where(and(eq(signalsTable.id, req.params.id), eq(signalsTable.tenantId, req.auth!.tenantId)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Signal introuvable" }); return; }
  res.json(updated);
});

router.patch("/:id", async (req, res) => {
  const parse = signalSchema.partial().safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: "Données invalides" }); return; }
  const [updated] = await db.update(signalsTable)
    .set(parse.data)
    .where(and(eq(signalsTable.id, req.params.id), eq(signalsTable.tenantId, req.auth!.tenantId)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Signal introuvable" }); return; }
  res.json(updated);
});

export default router;
