import { Router } from "express";
import { requireAuth } from "../../middlewares/auth";
import { StripeService } from "../../lib/billing/StripeService";
import { getUsage } from "../../middlewares/usageLimit";
import { pool } from "@workspace/db";

const router = Router();

router.get("/subscription", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const sub = await StripeService.getSubscription(tenantId);
  if (!sub) {
    const tenant = await pool.query(`SELECT plan, status FROM tenants WHERE id = $1`, [tenantId]);
    const t = tenant.rows[0] ?? { plan: "starter", status: "active" };
    res.json({ plan: t.plan, status: t.status, stripe_configured: StripeService.isConfigured() });
    return;
  }
  res.json({ ...sub, stripe_configured: StripeService.isConfigured() });
});

router.get("/invoices", requireAuth, async (req, res) => {
  const invoices = await StripeService.getInvoices(req.auth!.tenantId);
  res.json(invoices);
});

router.get("/usage", requireAuth, async (req, res) => {
  const usage = await getUsage(req.auth!.tenantId);
  res.json(usage);
});

router.post("/checkout", requireAuth, async (req, res) => {
  if (!StripeService.isConfigured()) {
    res.status(503).json({
      error: "Stripe non configuré",
      message: "Ajoutez STRIPE_SECRET_KEY dans les variables d'environnement.",
    });
    return;
  }
  const { plan, success_url, cancel_url } = req.body;
  if (!plan) { res.status(400).json({ error: "plan requis" }); return; }
  try {
    const session = await StripeService.createCheckoutSession(
      req.auth!.tenantId,
      plan,
      success_url ?? `${req.headers.origin ?? ""}/settings/billing?success=1`,
      cancel_url ?? `${req.headers.origin ?? ""}/settings/billing`,
    );
    res.json(session);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur Stripe";
    res.status(400).json({ error: msg });
  }
});

router.post("/portal", requireAuth, async (req, res) => {
  if (!StripeService.isConfigured()) {
    res.status(503).json({ error: "Stripe non configuré" });
    return;
  }
  try {
    const session = await StripeService.createCustomerPortalSession(
      req.auth!.tenantId,
      req.body.return_url ?? `${req.headers.origin ?? ""}/settings/billing`,
    );
    res.json(session);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur portail";
    res.status(400).json({ error: msg });
  }
});

/** Endpoint public — pas de requireAuth — vérifié via Stripe-Signature */
router.post("/webhook", async (req, res) => {
  try {
    const event = req.body as Record<string, unknown>;
    await StripeService.handleWebhook(event);
    res.json({ received: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur webhook";
    res.status(400).json({ error: msg });
  }
});

export default router;
