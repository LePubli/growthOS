import { pool } from "@workspace/db";
import { logger } from "../logger";

export interface Plan {
  id: string;
  name: string;
  displayName: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
  limits: Record<string, number>;
  isActive: boolean;
  isDefault: boolean;
  stripePriceId?: string;
  stripePriceYearlyId?: string;
  createdAt?: string;
}

export interface Subscription {
  id: string;
  tenantId: string;
  userId?: string;
  planId?: string;
  plan?: Plan;
  status: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId?: string;
}

function mapPlan(r: any): Plan {
  return {
    id: r.id,
    name: r.name,
    displayName: r.display_name,
    description: r.description ?? "",
    priceMonthly: r.price_monthly,
    priceYearly: r.price_yearly,
    features: r.features ?? [],
    limits: r.limits ?? {},
    isActive: r.is_active,
    isDefault: r.is_default,
    stripePriceId: r.stripe_price_id ?? undefined,
    stripePriceYearlyId: r.stripe_price_yearly_id ?? undefined,
    createdAt: r.created_at,
  };
}

export class PlansService {
  // ── Gestion des plans ──────────────────────────────────────────────────────

  async getPlans(includeInactive = false): Promise<Plan[]> {
    const { rows } = await pool.query(
      `SELECT * FROM plans ${includeInactive ? "" : "WHERE is_active = true"} ORDER BY price_monthly ASC`,
    );
    return rows.map(mapPlan);
  }

  async getPlanById(planId: string): Promise<Plan | null> {
    const { rows } = await pool.query(`SELECT * FROM plans WHERE id = $1`, [planId]);
    return rows[0] ? mapPlan(rows[0]) : null;
  }

  async getPlanByName(name: string): Promise<Plan | null> {
    const { rows } = await pool.query(`SELECT * FROM plans WHERE name = $1`, [name]);
    return rows[0] ? mapPlan(rows[0]) : null;
  }

  async createPlan(data: {
    name: string;
    displayName: string;
    description?: string;
    priceMonthly: number;
    priceYearly: number;
    features?: string[];
    limits?: Record<string, number>;
    stripePriceId?: string;
    stripePriceYearlyId?: string;
  }): Promise<Plan> {
    const { rows } = await pool.query(
      `INSERT INTO plans (name, display_name, description, price_monthly, price_yearly, features, limits, stripe_price_id, stripe_price_yearly_id)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)
       RETURNING *`,
      [
        data.name, data.displayName, data.description ?? "",
        data.priceMonthly, data.priceYearly,
        JSON.stringify(data.features ?? []),
        JSON.stringify(data.limits ?? {}),
        data.stripePriceId ?? null,
        data.stripePriceYearlyId ?? null,
      ],
    );
    return mapPlan(rows[0]);
  }

  async updatePlan(planId: string, updates: Partial<{
    displayName: string;
    description: string;
    priceMonthly: number;
    priceYearly: number;
    features: string[];
    limits: Record<string, number>;
    isActive: boolean;
    isDefault: boolean;
    stripePriceId: string;
    stripePriceYearlyId: string;
  }>): Promise<Plan> {
    const parts: string[] = ["updated_at = NOW()"];
    const params: unknown[] = [];
    let idx = 1;

    if (updates.displayName !== undefined) { parts.push(`display_name = $${idx++}`); params.push(updates.displayName); }
    if (updates.description !== undefined) { parts.push(`description = $${idx++}`); params.push(updates.description); }
    if (updates.priceMonthly !== undefined) { parts.push(`price_monthly = $${idx++}`); params.push(updates.priceMonthly); }
    if (updates.priceYearly !== undefined) { parts.push(`price_yearly = $${idx++}`); params.push(updates.priceYearly); }
    if (updates.features !== undefined) { parts.push(`features = $${idx++}::jsonb`); params.push(JSON.stringify(updates.features)); }
    if (updates.limits !== undefined) { parts.push(`limits = $${idx++}::jsonb`); params.push(JSON.stringify(updates.limits)); }
    if (updates.isActive !== undefined) { parts.push(`is_active = $${idx++}`); params.push(updates.isActive); }
    if (updates.isDefault !== undefined) { parts.push(`is_default = $${idx++}`); params.push(updates.isDefault); }
    if (updates.stripePriceId !== undefined) { parts.push(`stripe_price_id = $${idx++}`); params.push(updates.stripePriceId || null); }
    if (updates.stripePriceYearlyId !== undefined) { parts.push(`stripe_price_yearly_id = $${idx++}`); params.push(updates.stripePriceYearlyId || null); }

    if (parts.length === 1) throw new Error("Aucune modification fournie");

    params.push(planId);
    const { rows } = await pool.query(
      `UPDATE plans SET ${parts.join(", ")} WHERE id = $${idx} RETURNING *`,
      params,
    );
    if (!rows[0]) throw new Error("Plan introuvable");
    return mapPlan(rows[0]);
  }

  async deletePlan(planId: string): Promise<void> {
    const { rows } = await pool.query(`SELECT is_default FROM plans WHERE id = $1`, [planId]);
    if (!rows[0]) throw new Error("Plan introuvable");
    if (rows[0].is_default) throw new Error("Impossible de supprimer le plan par défaut");
    await pool.query(`UPDATE plans SET is_active = false, updated_at = NOW() WHERE id = $1`, [planId]);
  }

  // ── Gestion des abonnements utilisateurs ──────────────────────────────────

  async getUserPlan(tenantId: string): Promise<(Subscription & { plan: Plan | null }) | null> {
    const { rows } = await pool.query(
      `SELECT s.*, p.id as p_id, p.name as p_name, p.display_name as p_display_name,
              p.description as p_desc, p.price_monthly, p.price_yearly, p.features, p.limits,
              p.is_active as p_is_active, p.is_default as p_is_default, p.stripe_price_id,
              p.stripe_price_yearly_id
       FROM subscriptions s
       LEFT JOIN plans p ON p.id = s.plan_id
       WHERE s.tenant_id = $1
       ORDER BY s.created_at DESC LIMIT 1`,
      [tenantId],
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: r.id,
      tenantId: r.tenant_id,
      userId: r.user_id,
      planId: r.plan_id,
      status: r.status,
      currentPeriodStart: r.current_period_start,
      currentPeriodEnd: r.current_period_end,
      cancelAtPeriodEnd: r.cancel_at_period_end ?? false,
      stripeSubscriptionId: r.stripe_subscription_id,
      plan: r.p_id ? {
        id: r.p_id, name: r.p_name, displayName: r.p_display_name, description: r.p_desc ?? "",
        priceMonthly: r.price_monthly, priceYearly: r.price_yearly,
        features: r.features ?? [], limits: r.limits ?? {},
        isActive: r.p_is_active, isDefault: r.p_is_default,
        stripePriceId: r.stripe_price_id, stripePriceYearlyId: r.stripe_price_yearly_id,
      } : null,
    };
  }

  async changeUserPlan(tenantId: string, planId: string, userId?: string): Promise<Subscription> {
    const plan = await this.getPlanById(planId);
    if (!plan) throw new Error("Plan introuvable");
    if (!plan.isActive) throw new Error("Ce plan n'est plus disponible");

    // Mettre à jour le plan sur le tenant
    await pool.query(`UPDATE tenants SET plan = $1, updated_at = NOW() WHERE id = $2`, [plan.name, tenantId]);

    // UPSERT subscription
    const { rows } = await pool.query(
      `INSERT INTO subscriptions (tenant_id, plan_id, user_id, plan, status, current_period_start, current_period_end)
       VALUES ($1, $2, $3, $4, 'active', NOW(), NOW() + INTERVAL '1 month')
       ON CONFLICT (tenant_id) DO UPDATE
         SET plan_id = EXCLUDED.plan_id,
             plan = EXCLUDED.plan,
             user_id = COALESCE(EXCLUDED.user_id, subscriptions.user_id),
             status = 'active',
             current_period_start = NOW(),
             current_period_end = NOW() + INTERVAL '1 month',
             updated_at = NOW()
       RETURNING *`,
      [tenantId, planId, userId ?? null, plan.name],
    );

    // Mettre à jour usage_limits pour ce tenant selon les nouvelles limites
    for (const [resource, limit] of Object.entries(plan.limits)) {
      await pool.query(
        `INSERT INTO usage_limits (tenant_id, resource, limit_value, current_usage, period_start)
         VALUES ($1, $2, $3, 0, date_trunc('month', NOW()))
         ON CONFLICT (tenant_id, resource)
         DO UPDATE SET limit_value = EXCLUDED.limit_value, updated_at = NOW()`,
        [tenantId, resource, limit],
      );
    }

    return {
      id: rows[0].id,
      tenantId: rows[0].tenant_id,
      planId: rows[0].plan_id,
      status: rows[0].status,
      currentPeriodStart: rows[0].current_period_start,
      currentPeriodEnd: rows[0].current_period_end,
      cancelAtPeriodEnd: rows[0].cancel_at_period_end ?? false,
    };
  }

  // ── Vérification des quotas ──────────────────────────────────────────────

  async checkLimit(tenantId: string, resource: string): Promise<{ allowed: boolean; used: number; limit: number }> {
    const { rows } = await pool.query(
      `SELECT current_usage, limit_value FROM usage_limits
       WHERE tenant_id = $1 AND resource = $2
         AND period_start = date_trunc('month', NOW())`,
      [tenantId, resource],
    );

    if (!rows[0]) {
      // Initialiser à partir du plan
      const sub = await this.getUserPlan(tenantId);
      const limit = sub?.plan?.limits?.[resource] ?? 1000;
      await pool.query(
        `INSERT INTO usage_limits (tenant_id, resource, limit_value, current_usage, period_start)
         VALUES ($1, $2, $3, 0, date_trunc('month', NOW()))
         ON CONFLICT DO NOTHING`,
        [tenantId, resource, limit],
      );
      return { allowed: limit === -1 || 0 < limit, used: 0, limit };
    }

    const { current_usage: used, limit_value: limit } = rows[0];
    return { allowed: limit === -1 || used < limit, used: Number(used), limit: Number(limit) };
  }

  async getCurrentUsage(tenantId: string, resource: string): Promise<number> {
    const result = await this.checkLimit(tenantId, resource);
    return result.used;
  }

  async getAllSubscriptions(): Promise<(Subscription & { plan: Plan | null; tenantName?: string })[]> {
    const { rows } = await pool.query(
      `SELECT s.*, t.name as tenant_name, t.slug as tenant_slug,
              p.id as p_id, p.name as p_name, p.display_name as p_display_name,
              p.price_monthly, p.features, p.limits
       FROM subscriptions s
       JOIN tenants t ON t.id = s.tenant_id
       LEFT JOIN plans p ON p.id = s.plan_id
       ORDER BY s.created_at DESC`,
    );
    return rows.map(r => ({
      id: r.id, tenantId: r.tenant_id, userId: r.user_id, planId: r.plan_id,
      status: r.status, currentPeriodStart: r.current_period_start,
      currentPeriodEnd: r.current_period_end, cancelAtPeriodEnd: r.cancel_at_period_end ?? false,
      stripeSubscriptionId: r.stripe_subscription_id,
      tenantName: r.tenant_name,
      plan: r.p_id ? {
        id: r.p_id, name: r.p_name, displayName: r.p_display_name, description: "",
        priceMonthly: r.price_monthly, priceYearly: 0, features: r.features ?? [],
        limits: r.limits ?? {}, isActive: true, isDefault: false,
      } : null,
    }));
  }
}

export const plansService = new PlansService();
