import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { dealsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { createNotification } from "../../services/notification.service";

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

router.get("/:id", async (req, res) => {
  const [deal] = await db.select().from(dealsTable)
    .where(and(eq(dealsTable.id, req.params.id), eq(dealsTable.tenantId, req.auth!.tenantId)))
    .limit(1);
  if (!deal) { res.status(404).json({ error: "Deal introuvable" }); return; }
  res.json({ ...deal, value: Number(deal.value) });
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

  const [prev] = await db.select().from(dealsTable)
    .where(and(eq(dealsTable.id, id), eq(dealsTable.tenantId, req.auth!.tenantId)))
    .limit(1);

  const [updated] = await db.update(dealsTable)
    .set(updateData)
    .where(and(eq(dealsTable.id, id), eq(dealsTable.tenantId, req.auth!.tenantId)))
    .returning();

  if (!updated) { res.status(404).json({ error: "Deal introuvable" }); return; }

  if (prev && prev.stage !== "won" && updated.stage === "won") {
    createNotification({
      type: "deal",
      title: "Deal gagné 🎉",
      body: `${updated.title}${updated.company ? ` — ${updated.company}` : ""}${updated.value ? ` — ${Number(updated.value).toLocaleString("fr-FR")}€` : ""} marqué comme Gagné.`,
      href: `/pipeline/${updated.id}`,
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
    }).catch(() => {/* fire and forget */});
  }

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
