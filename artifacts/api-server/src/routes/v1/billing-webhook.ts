/**
 * Route publique Stripe webhook — pas de requireAuth.
 * Authentifié via Stripe-Signature header côté StripeService.
 */
import { Router } from "express";
import { StripeService } from "../../lib/billing/StripeService.ts";

const router = Router();

router.post("/", async (req, res) => {
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
