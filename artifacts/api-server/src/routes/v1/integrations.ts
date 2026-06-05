import { Router } from "express";
import { z } from "zod";
import { db, webhooksTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";
import { requireAuth } from "../../middlewares/auth";
import { WebhookService } from "../../lib/integrations/WebhookService";
import { pool } from "@workspace/db";

const router = Router();

const ALL_EVENTS = [
  "prospect.created", "prospect.updated", "prospect.deleted",
  "deal.created", "deal.stage_changed", "deal.won", "deal.lost",
  "sequence.enrolled", "sequence.completed",
  "signal.created", "task.created", "task.completed",
];

const webhookSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url("URL invalide"),
  events: z.array(z.string()).min(1, "Au moins un événement requis"),
  status: z.enum(["active", "paused"]).optional().default("active"),
});

/* ── Liste des webhooks ── */
router.get("/webhooks", requireAuth, async (req, res) => {
  const rows = await db
    .select()
    .from(webhooksTable)
    .where(eq(webhooksTable.tenantId, req.auth!.tenantId))
    .orderBy(desc(webhooksTable.createdAt));
  res.json(rows);
});

/* ── Événements disponibles ── */
router.get("/webhooks/events", requireAuth, (_req, res) => {
  res.json(ALL_EVENTS);
});

/* ── Logs de livraison ── */
router.get("/webhooks/logs", requireAuth, async (req, res) => {
  const { webhookId, limit = "50" } = req.query as Record<string, string>;
  const logs = await WebhookService.getLogs(req.auth!.tenantId, webhookId, Number(limit));
  res.json(logs);
});

router.get("/webhooks/:id/logs", requireAuth, async (req, res) => {
  const logs = await WebhookService.getLogs(req.auth!.tenantId, req.params.id, 50);
  res.json(logs);
});

/* ── Créer un webhook ── */
router.post("/webhooks", requireAuth, async (req, res) => {
  const parse = webhookSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Données invalides", details: parse.error.issues });
    return;
  }
  const secret = `whs_${crypto.randomBytes(20).toString("hex")}`;
  const [wh] = await db
    .insert(webhooksTable)
    .values({
      ...parse.data,
      secret,
      tenantId: req.auth!.tenantId,
      createdBy: req.auth!.userId,
    })
    .returning();
  res.status(201).json(wh);
});

/* ── Mettre à jour un webhook ── */
router.patch("/webhooks/:id", requireAuth, async (req, res) => {
  const parse = webhookSchema.partial().safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Données invalides" });
    return;
  }
  const [updated] = await db
    .update(webhooksTable)
    .set({ ...parse.data, updatedAt: new Date() })
    .where(and(eq(webhooksTable.id, req.params.id), eq(webhooksTable.tenantId, req.auth!.tenantId)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Webhook introuvable" }); return; }
  res.json(updated);
});

/* ── Toggle actif/pause ── */
router.post("/webhooks/:id/toggle", requireAuth, async (req, res) => {
  const [wh] = await db
    .select()
    .from(webhooksTable)
    .where(and(eq(webhooksTable.id, req.params.id), eq(webhooksTable.tenantId, req.auth!.tenantId)))
    .limit(1);
  if (!wh) { res.status(404).json({ error: "Webhook introuvable" }); return; }
  const [updated] = await db
    .update(webhooksTable)
    .set({ status: wh.status === "active" ? "paused" : "active", updatedAt: new Date() })
    .where(eq(webhooksTable.id, req.params.id))
    .returning();
  res.json(updated);
});

/* ── Test manuel d'un webhook ── */
router.post("/webhooks/:id/test", requireAuth, async (req, res) => {
  const [wh] = await db
    .select()
    .from(webhooksTable)
    .where(and(eq(webhooksTable.id, req.params.id), eq(webhooksTable.tenantId, req.auth!.tenantId)))
    .limit(1);
  if (!wh) { res.status(404).json({ error: "Webhook introuvable" }); return; }
  await WebhookService.triggerEvent(req.auth!.tenantId, "test.ping", {
    message: "Test GrowthOS Webhook",
    webhook_id: wh.id,
    sent_at: new Date().toISOString(),
  });
  res.json({ ok: true, message: "Ping envoyé" });
});

/* ── Supprimer un webhook ── */
router.delete("/webhooks/:id", requireAuth, async (req, res) => {
  await db.delete(webhooksTable).where(
    and(eq(webhooksTable.id, req.params.id), eq(webhooksTable.tenantId, req.auth!.tenantId)),
  );
  res.json({ ok: true });
});

/* ── Endpoint public entrant — reçoit des données depuis un webhook externe ── */
router.post("/incoming/:webhookId", async (req, res) => {
  const { webhookId } = req.params;
  const wh = await pool.query(
    `SELECT id, tenant_id, secret FROM webhooks WHERE id = $1 AND status = 'active'`,
    [webhookId],
  );
  if (!wh.rows[0]) {
    res.status(404).json({ error: "Webhook introuvable ou inactif" });
    return;
  }
  const webhook = wh.rows[0];

  // Vérifier signature si présente
  const signature = req.headers["x-growthos-signature"] as string | undefined;
  if (signature && webhook.secret) {
    const valid = WebhookService.verifySignature(webhook.secret, JSON.stringify(req.body), signature);
    if (!valid) {
      res.status(401).json({ error: "Signature invalide" });
      return;
    }
  }

  // Log la réception
  await pool.query(
    `INSERT INTO webhook_logs (webhook_id, event_type, status, response_code, payload)
     VALUES ($1, 'incoming', 'delivered', 200, $2::jsonb)`,
    [webhookId, JSON.stringify(req.body)],
  );
  await pool.query(
    `UPDATE webhooks SET deliveries = deliveries + 1, last_triggered_at = NOW() WHERE id = $1`,
    [webhookId],
  );

  res.json({ received: true });
});

export default router;
