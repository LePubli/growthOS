import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { sequencesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { createNotification } from "../../services/notification.service";

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

/**
 * POST /sequences/:id/events — simulate inbound email events
 * Body: { type: "reply" | "open", contact?: string, subject?: string, openCount?: number }
 * Triggers a push notification when:
 *   - type === "reply"  (always)
 *   - type === "open"   and openCount >= 3
 */
router.post("/:id/events", async (req, res) => {
  const [seq] = await db.select().from(sequencesTable)
    .where(and(eq(sequencesTable.id, req.params.id), eq(sequencesTable.tenantId, req.auth!.tenantId)))
    .limit(1);
  if (!seq) { res.status(404).json({ error: "Séquence introuvable" }); return; }

  const eventSchema = z.object({
    type: z.enum(["reply", "open"]),
    contact: z.string().optional(),
    subject: z.string().optional(),
    openCount: z.number().int().optional(),
  });
  const parse = eventSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: "Données invalides" }); return; }

  const { type, contact, subject, openCount = 1 } = parse.data;

  if (type === "reply") {
    createNotification({
      type: "email",
      title: "Réponse reçue ✉️",
      body: `${contact ?? "Un contact"} a répondu à "${subject ?? seq.name}".`,
      href: `/sequences/${seq.id}`,
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
    }).catch(() => {});
  }

  if (type === "open" && openCount >= 3) {
    createNotification({
      type: "email",
      title: "Email très consulté 👀",
      body: `${contact ?? "Un contact"} a ouvert "${subject ?? seq.name}" ${openCount}× — signe d'intérêt fort.`,
      href: `/sequences/${seq.id}`,
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
    }).catch(() => {});
  }

  res.json({ ok: true, type, triggered: type === "reply" || (type === "open" && openCount >= 3) });
});

export default router;
