import { pool } from "@workspace/db";

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  plan: string;
  status: string;
  branding: Record<string, unknown> | null;
  settings: Record<string, unknown> | null;
  created_at: Date;
}

export const TenantService = {
  async createTenant(data: {
    name: string;
    slug: string;
    domain?: string;
    plan?: string;
  }): Promise<TenantInfo> {
    const result = await pool.query(
      `INSERT INTO tenants (name, slug, domain, plan, status)
       VALUES ($1, $2, $3, $4, 'active') RETURNING *`,
      [data.name, data.slug, data.domain ?? null, data.plan ?? "starter"],
    );
    return result.rows[0];
  },

  async getTenant(tenantId: string): Promise<TenantInfo | null> {
    const result = await pool.query(
      `SELECT * FROM tenants WHERE id = $1`,
      [tenantId],
    );
    return result.rows[0] ?? null;
  },

  async updateTenant(
    tenantId: string,
    updates: Partial<Pick<TenantInfo, "name" | "domain" | "plan" | "status" | "branding" | "settings">>,
  ): Promise<TenantInfo | null> {
    const entries = Object.entries(updates).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return TenantService.getTenant(tenantId);
    const setClause = entries.map(([k], i) => `${k} = $${i + 2}`).join(", ");
    const values = entries.map(([, v]) => v);
    const result = await pool.query(
      `UPDATE tenants SET ${setClause} WHERE id = $1 RETURNING *`,
      [tenantId, ...values],
    );
    return result.rows[0] ?? null;
  },

  async listTenants(): Promise<TenantInfo[]> {
    const result = await pool.query(
      `SELECT * FROM tenants ORDER BY created_at DESC`,
    );
    return result.rows;
  },
};
