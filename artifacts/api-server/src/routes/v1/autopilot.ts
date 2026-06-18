/**
 * Routes Autopilot — Agents IA autonomes
 * Toutes les routes filtrent par tenantId (multi-tenant).
 */

import { Router } from "express";
import { z } from "zod";
import { autopilotService, type TriggerEvent, type ActionType } from "../../lib/autopilot/AutopilotService";

const router = Router();

const TRIGGER_EVENTS: TriggerEvent[] = [
  "signal.received",
  "erep.alert",
  "deal.stage_changed",
  "prospect.created",
  "sequence.email.sent",
  "meeting.completed",
];

const ACTION_TYPES: ActionType[] = [
  "create_task",
  "send_notification",
  "generate_draft_email",
  "add_tag",
  "update_deal_score",
];

const createRuleSchema = z.object({
  name: z.string().min(2),
  triggerEvent: z.enum(TRIGGER_EVENTS as [TriggerEvent, ...TriggerEvent[]]),
  conditionJson: z.record(z.any()).optional().default({}),
  actionType: z.enum(ACTION_TYPES as [ActionType, ...ActionType[]]),
  actionConfig: z.record(z.any()).optional().default({}),
});

const updateRuleSchema = z.object({
  name: z.string().min(2).optional(),
  isActive: z.boolean().optional(),
  conditionJson: z.record(z.any()).optional(),
  actionConfig: z.record(z.any()).optional(),
});

/* ── GET /autopilot/rules — Liste des règles du tenant ── */
router.get("/rules", async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const rules = await autopilotService.getRules(tenantId);
  res.json({ rules });
});

/* ── POST /autopilot/rules — Créer une règle ── */
router.post("/rules", async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const parse = createRuleSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Données invalides", details: parse.error.issues });
    return;
  }

  const rule = await autopilotService.createRule(tenantId, parse.data);
  res.status(201).json(rule);
});

/* ── PATCH /autopilot/rules/:id — Modifier une règle (toggle ON/OFF, etc.) ── */
router.patch("/rules/:id", async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const parse = updateRuleSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Données invalides", details: parse.error.issues });
    return;
  }

  const rule = await autopilotService.updateRule(tenantId, req.params.id, parse.data);
  if (!rule) {
    res.status(404).json({ error: "Règle introuvable" });
    return;
  }
  res.json(rule);
});

/* ── DELETE /autopilot/rules/:id — Supprimer une règle ── */
router.delete("/rules/:id", async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const deleted = await autopilotService.deleteRule(tenantId, req.params.id);
  if (!deleted) {
    res.status(404).json({ error: "Règle introuvable" });
    return;
  }
  res.json({ ok: true });
});

/* ── GET /autopilot/logs — Historique des exécutions ── */
router.get("/logs", async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const logs = await autopilotService.getLogs(tenantId, limit);
  res.json({ logs });
});

/* ── GET /autopilot/meta — Déclencheurs et actions disponibles ── */
router.get("/meta", (_req, res) => {
  res.json({
    triggerEvents: [
      { value: "signal.received",      label: "Signal reçu",                  description: "Un nouveau signal d'intention est détecté" },
      { value: "erep.alert",           label: "Alerte e-réputation",           description: "Une alerte e-réputation est générée" },
      { value: "deal.stage_changed",   label: "Deal — changement de stage",    description: "Un deal change de stage dans le pipeline" },
      { value: "prospect.created",     label: "Nouveau prospect",              description: "Un prospect est créé dans le CRM" },
      { value: "sequence.email.sent",  label: "Email de séquence envoyé",      description: "Un email de séquence est envoyé" },
      { value: "meeting.completed",    label: "Réunion terminée",              description: "Une réunion est marquée comme terminée" },
    ],
    actionTypes: [
      { value: "create_task",          label: "Créer une tâche",               configSchema: { title: "string", priority: "low|medium|high", dueDays: "number" } },
      { value: "send_notification",    label: "Envoyer une notification",      configSchema: { title: "string", message: "string" } },
      { value: "generate_draft_email", label: "Générer un draft email",        configSchema: { subject: "string", tone: "string" } },
      { value: "add_tag",              label: "Ajouter un tag",                configSchema: { tag: "string" } },
      { value: "update_deal_score",    label: "Modifier le score du deal",     configSchema: { delta: "number" } },
    ],
  });
});

export default router;
