/**
 * Admin — Gestion des Plans d'abonnement
 * Routes: /admin/plans/*, /admin/subscriptions/*
 */

import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { plansService } from "../../lib/plans/PlansService";
import { logger } from "../../lib/logger";
import { pool } from "@workspace/db";

const router = Router();

router.use(requireAuth);
router.use(requireRole("admin"));

// ── GET /admin/plans — Liste tous les plans ───────────────────────────────────
router.get("/plans", async (req, res) => {
  try {
    const includeInactive = req.query.all === "true";
    const plans = await plansService.getPlans(includeInactive);
    res.json(plans);
  } catch (err) {
    logger.error({ err }, "admin/plans GET error");
    res.status(500).json({ error: "Erreur interne" });
  }
});

// ── POST /admin/plans — Créer un plan ────────────────────────────────────────
const createPlanSchema = z.object({
  name: z.string().min(2).max(50).regex(/^[a-z0-9_-]+$/, "Nom en minuscules sans espaces"),
  displayName: z.string().min(2).max(100),
  description: z.string().optional().default(""),
  priceMonthly: z.number().int().min(0),
  priceYearly: z.number().int().min(0),
  features: z.array(z.string()).optional().default([]),
  limits: z.record(z.number()).optional().default({}),
  stripePriceId: z.string().optional(),
  stripePriceYearlyId: z.string().optional(),
});

router.post("/plans", async (req, res) => {
  const parse = createPlanSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: "Données invalides", details: parse.error.issues }); return; }
  try {
    const plan = await plansService.createPlan(parse.data);
    res.status(201).json(plan);
  } catch (err: any) {
    if (err.code === "23505") { res.status(409).json({ error: "Un plan avec ce nom existe déjà" }); return; }
    logger.error({ err }, "admin/plans POST error");
    res.status(500).json({ error: "Erreur interne" });
  }
});

// ── PATCH /admin/plans/:id — Modifier un plan ────────────────────────────────
const updatePlanSchema = z.object({
  displayName: z.string().min(2).max(100).optional(),
  description: z.string().optional(),
  priceMonthly: z.number().int().min(0).optional(),
  priceYearly: z.number().int().min(0).optional(),
  features: z.array(z.string()).optional(),
  limits: z.record(z.number()).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  stripePriceId: z.string().optional(),
  stripePriceYearlyId: z.string().optional(),
});

router.patch("/plans/:id", async (req, res) => {
  const parse = updatePlanSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: "Données invalides" }); return; }
  try {
    const plan = await plansService.updatePlan(req.params.id, parse.data);
    res.json(plan);
  } catch (err: any) {
    logger.error({ err }, "admin/plans PATCH error");
    res.status(err.message?.includes("introuvable") ? 404 : 500).json({ error: err.message ?? "Erreur interne" });
  }
});

// ── DELETE /admin/plans/:id — Soft delete ────────────────────────────────────
router.delete("/plans/:id", async (req, res) => {
  try {
    await plansService.deletePlan(req.params.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(err.message?.includes("introuvable") ? 404 : err.message?.includes("défaut") ? 403 : 500)
      .json({ error: err.message ?? "Erreur interne" });
  }
});

// ── GET /admin/subscriptions — Toutes les subscriptions ──────────────────────
router.get("/subscriptions", async (req, res) => {
  try {
    const subs = await plansService.getAllSubscriptions();
    res.json(subs);
  } catch (err) {
    res.status(500).json({ error: "Erreur interne" });
  }
});

// ── POST /admin/plans/change — Changer le plan d'un tenant ───────────────────
router.post("/plans/change", async (req, res) => {
  const { tenantId, planId } = req.body as { tenantId?: string; planId?: string };
  if (!tenantId || !planId) { res.status(400).json({ error: "tenantId et planId requis" }); return; }
  try {
    const sub = await plansService.changeUserPlan(tenantId, planId);
    res.json({ ok: true, subscription: sub });
  } catch (err: any) {
    logger.error({ err }, "admin/plans/change error");
    res.status(err.message?.includes("introuvable") ? 404 : 500).json({ error: err.message ?? "Erreur interne" });
  }
});

// ── GET /admin/plans/usage/:tenantId — Usage d'un tenant ─────────────────────
router.get("/plans/usage/:tenantId", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT resource, current_usage, limit_value, period_start
       FROM usage_limits WHERE tenant_id = $1 AND period_start = date_trunc('month', NOW())
       ORDER BY resource`,
      [req.params.tenantId],
    );
    const usage: Record<string, { used: number; limit: number; pct: number }> = {};
    for (const r of rows) {
      const pct = r.limit_value === -1 ? 0 : Math.min(100, Math.round((r.current_usage / r.limit_value) * 100));
      usage[r.resource] = { used: Number(r.current_usage), limit: Number(r.limit_value), pct };
    }
    res.json(usage);
  } catch (err) {
    res.status(500).json({ error: "Erreur interne" });
  }
});

// ── GET /admin/tenants — Liste des tenants pour changement de plan ────────────
router.get("/tenants", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.id, t.name, t.slug, t.plan, t.status,
              s.id as sub_id, s.plan_id, s.status as sub_status,
              p.display_name as plan_display_name
       FROM tenants t
       LEFT JOIN subscriptions s ON s.tenant_id = t.id
       LEFT JOIN plans p ON p.id = s.plan_id
       ORDER BY t.created_at DESC`,
    );
    res.json(rows.map(r => ({
      id: r.id, name: r.name, slug: r.slug, plan: r.plan,
      status: r.status, planId: r.plan_id, planDisplayName: r.plan_display_name,
      subStatus: r.sub_status,
    })));
  } catch (err) {
    res.status(500).json({ error: "Erreur interne" });
  }
});

export default router;
