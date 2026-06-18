/**
 * Routes publiques — plans tarifaires (sans auth)
 * Montées sous /api/v1/plans (pas de requireAuth)
 */

import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const { rows } = await pool.query<{
      id: string; name: string; slug: string; price_monthly: number;
      price_yearly: number; features: any; max_users: number;
      max_prospects: number; max_signals: number;
    }>(
      `SELECT id, name, slug, price_monthly, price_yearly, features,
              max_users, max_prospects, max_signals
       FROM plans
       WHERE is_active = true
       ORDER BY price_monthly ASC`,
    );
    res.json({ plans: rows });
  } catch {
    // Fallback statique si la table n'existe pas encore
    res.json({
      plans: [
        {
          id: "starter",
          name: "Starter",
          slug: "starter",
          price_monthly: 49,
          price_yearly: 490,
          max_users: 3,
          max_prospects: 500,
          max_signals: 100,
          features: ["CRM & Pipeline", "Séquences Email", "Signaux IA (100/mois)", "Export CSV", "Support email"],
        },
        {
          id: "pro",
          name: "Pro",
          slug: "pro",
          price_monthly: 149,
          price_yearly: 1490,
          max_users: 15,
          max_prospects: 5000,
          max_signals: 1000,
          features: ["Tout Starter", "AI SDR", "E-Réputation", "Data Enrichment", "Webhooks", "Support prioritaire"],
        },
        {
          id: "enterprise",
          name: "Enterprise",
          slug: "enterprise",
          price_monthly: 499,
          price_yearly: 4990,
          max_users: -1,
          max_prospects: -1,
          max_signals: -1,
          features: ["Tout Pro", "SSO / SAML 2.0", "SLA 99.9%", "Onboarding dédié", "Manager de compte", "API illimitée"],
        },
      ],
    });
  }
});

export default router;
