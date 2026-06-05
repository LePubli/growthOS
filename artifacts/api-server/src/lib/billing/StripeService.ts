import { pool } from "@workspace/db";
import { logger } from "../logger";

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_API = "https://api.stripe.com/v1";

const PLAN_PRICES: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_STARTER ?? "price_starter",
  pro: process.env.STRIPE_PRICE_PRO ?? "price_pro",
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE ?? "price_enterprise",
};

function isStripeConfigured(): boolean {
  return !!STRIPE_KEY && !STRIPE_KEY.startsWith("sk_test_placeholder");
}

async function stripeRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<unknown> {
  if (!isStripeConfigured()) {
    throw new Error("Stripe non configuré (STRIPE_SECRET_KEY manquant)");
  }
  const bodyStr = body
    ? new URLSearchParams(
        Object.fromEntries(
          Object.entries(body).map(([k, v]) => [k, String(v)]),
        ),
      ).toString()
    : undefined;

  const res = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${STRIPE_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: bodyStr,
    signal: AbortSignal.timeout(15_000),
  });
  const json = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`Stripe error: ${(json.error as Record<string, string>)?.message ?? res.statusText}`);
  }
  return json;
}

export const StripeService = {
  isConfigured: isStripeConfigured,

  async getOrCreateCustomer(tenantId: string, email: string, name: string): Promise<string> {
    const existing = await pool.query(
      `SELECT stripe_customer_id FROM subscriptions WHERE tenant_id = $1`,
      [tenantId],
    );
    if (existing.rows[0]?.stripe_customer_id) return existing.rows[0].stripe_customer_id;

    const customer = await stripeRequest("POST", "/customers", {
      email,
      name,
      metadata: { tenant_id: tenantId },
    }) as { id: string };
    return customer.id;
  },

  async createCheckoutSession(
    tenantId: string,
    plan: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<{ url: string }> {
    const priceId = PLAN_PRICES[plan];
    if (!priceId) throw new Error(`Plan inconnu: ${plan}`);

    const tenant = await pool.query(
      `SELECT name FROM tenants WHERE id = $1`,
      [tenantId],
    );
    const tenantName = tenant.rows[0]?.name ?? tenantId;

    const customerId = await StripeService.getOrCreateCustomer(
      tenantId,
      `billing@${tenantName.toLowerCase().replace(/\s+/g, "")}.fr`,
      tenantName,
    );

    const session = await stripeRequest("POST", "/checkout/sessions", {
      mode: "subscription",
      customer: customerId,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: successUrl,
      cancel_url: cancelUrl,
      "metadata[tenant_id]": tenantId,
      "metadata[plan]": plan,
    }) as { url: string };

    return { url: session.url };
  },

  async handleWebhook(event: Record<string, unknown>): Promise<void> {
    const type = event.type as string;
    const obj = event.data as Record<string, unknown>;
    const dataObj = obj?.object as Record<string, unknown>;

    if (type === "customer.subscription.updated" || type === "customer.subscription.created") {
      const tenantId = (dataObj?.metadata as Record<string, string>)?.tenant_id;
      if (!tenantId) return;
      await pool.query(
        `INSERT INTO subscriptions (tenant_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end)
         VALUES ($1, $2, $3, $4, $5, to_timestamp($6))
         ON CONFLICT (tenant_id)
         DO UPDATE SET
           stripe_subscription_id = EXCLUDED.stripe_subscription_id,
           plan = EXCLUDED.plan,
           status = EXCLUDED.status,
           current_period_end = EXCLUDED.current_period_end,
           updated_at = NOW()`,
        [
          tenantId,
          dataObj.customer,
          dataObj.id,
          (dataObj.metadata as Record<string, string>)?.plan ?? "pro",
          dataObj.status,
          dataObj.current_period_end,
        ],
      );
      await pool.query(
        `UPDATE tenants SET plan = $1, status = $2 WHERE id = $3`,
        [(dataObj.metadata as Record<string, string>)?.plan ?? "pro", "active", tenantId],
      );
    }

    if (type === "invoice.paid") {
      const tenantId = (dataObj?.subscription_details as Record<string, Record<string, string>>)
        ?.metadata?.tenant_id;
      if (!tenantId) return;
      await pool.query(
        `INSERT INTO invoices (tenant_id, stripe_invoice_id, amount, currency, status, invoice_url)
         VALUES ($1, $2, $3, $4, 'paid', $5)`,
        [tenantId, dataObj.id, dataObj.amount_paid, dataObj.currency ?? "eur", dataObj.hosted_invoice_url ?? null],
      );
    }

    if (type === "customer.subscription.deleted") {
      const tenantId = (dataObj?.metadata as Record<string, string>)?.tenant_id;
      if (!tenantId) return;
      await pool.query(
        `UPDATE subscriptions SET status = 'canceled', updated_at = NOW() WHERE tenant_id = $1`,
        [tenantId],
      );
      await pool.query(
        `UPDATE tenants SET plan = 'starter', status = 'active' WHERE id = $1`,
        [tenantId],
      );
    }
  },

  async getSubscription(tenantId: string): Promise<Record<string, unknown> | null> {
    const result = await pool.query(
      `SELECT s.*, t.plan as tenant_plan, t.status as tenant_status
       FROM tenants t
       LEFT JOIN subscriptions s ON s.tenant_id = t.id
       WHERE t.id = $1`,
      [tenantId],
    );
    return result.rows[0] ?? null;
  },

  async getInvoices(tenantId: string): Promise<unknown[]> {
    const result = await pool.query(
      `SELECT * FROM invoices WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 24`,
      [tenantId],
    );
    return result.rows;
  },

  async createCustomerPortalSession(
    tenantId: string,
    returnUrl: string,
  ): Promise<{ url: string }> {
    const sub = await pool.query(
      `SELECT stripe_customer_id FROM subscriptions WHERE tenant_id = $1`,
      [tenantId],
    );
    const customerId = sub.rows[0]?.stripe_customer_id;
    if (!customerId) throw new Error("Aucun abonnement Stripe actif");

    const session = await stripeRequest("POST", "/billing_portal/sessions", {
      customer: customerId,
      return_url: returnUrl,
    }) as { url: string };
    return { url: session.url };
  },
};

export type { };
