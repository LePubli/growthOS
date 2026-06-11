import { pool } from "@workspace/db";
import { logger } from "../logger";

export interface RBACRole {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  tenantId?: string | null;
  userCount?: number;
  createdAt?: string;
}

export interface RBACPermission {
  id: string;
  name: string;
  description: string;
  module: string;
}

export class RBACService {
  async getRoles(tenantId: string): Promise<RBACRole[]> {
    const { rows } = await pool.query(
      `SELECT r.*, COUNT(DISTINCT ur.user_id)::int AS user_count
       FROM rbac_roles r
       LEFT JOIN rbac_user_roles ur ON ur.role_id = r.id
       WHERE r.is_system = true OR r.tenant_id = $1
       GROUP BY r.id
       ORDER BY r.is_system DESC, r.name ASC`,
      [tenantId],
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? "",
      permissions: r.permissions ?? [],
      isSystem: r.is_system,
      tenantId: r.tenant_id,
      userCount: r.user_count ?? 0,
      createdAt: r.created_at,
    }));
  }

  async createRole(
    tenantId: string,
    name: string,
    description: string,
    permissions: string[],
  ): Promise<RBACRole> {
    const { rows } = await pool.query(
      `INSERT INTO rbac_roles (name, description, permissions, is_system, tenant_id)
       VALUES ($1, $2, $3::jsonb, false, $4)
       RETURNING *`,
      [name, description, JSON.stringify(permissions), tenantId],
    );
    const r = rows[0];
    return { id: r.id, name: r.name, description: r.description ?? "", permissions: r.permissions ?? [], isSystem: false, tenantId: r.tenant_id };
  }

  async updateRole(
    roleId: string,
    tenantId: string,
    updates: Partial<{ name: string; description: string; permissions: string[] }>,
  ): Promise<RBACRole> {
    const parts: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (updates.name !== undefined) { parts.push(`name = $${idx++}`); params.push(updates.name); }
    if (updates.description !== undefined) { parts.push(`description = $${idx++}`); params.push(updates.description); }
    if (updates.permissions !== undefined) { parts.push(`permissions = $${idx++}::jsonb`); params.push(JSON.stringify(updates.permissions)); }
    if (parts.length === 0) throw new Error("Aucune modification fournie");
    params.push(roleId);
    const { rows } = await pool.query(
      `UPDATE rbac_roles SET ${parts.join(", ")}
       WHERE id = $${idx} AND is_system = false
       RETURNING *`,
      params,
    );
    if (!rows[0]) throw new Error("Rôle introuvable ou rôle système non modifiable");
    const r = rows[0];
    return { id: r.id, name: r.name, description: r.description ?? "", permissions: r.permissions ?? [], isSystem: false };
  }

  async deleteRole(roleId: string): Promise<void> {
    const { rows } = await pool.query(`SELECT is_system FROM rbac_roles WHERE id = $1`, [roleId]);
    if (!rows[0]) throw new Error("Rôle introuvable");
    if (rows[0].is_system) throw new Error("Impossible de supprimer un rôle système");
    await pool.query(`DELETE FROM rbac_roles WHERE id = $1`, [roleId]);
  }

  async assignRole(userId: string, roleId: string, assignedBy: string): Promise<void> {
    await pool.query(
      `INSERT INTO rbac_user_roles (user_id, role_id, assigned_by)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [userId, roleId, assignedBy],
    );
  }

  async removeUserRole(userId: string, roleId: string): Promise<void> {
    await pool.query(
      `DELETE FROM rbac_user_roles WHERE user_id = $1 AND role_id = $2`,
      [userId, roleId],
    );
  }

  async getUserRoles(userId: string): Promise<RBACRole[]> {
    const { rows } = await pool.query(
      `SELECT r.* FROM rbac_roles r
       JOIN rbac_user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id = $1
       ORDER BY r.name`,
      [userId],
    );
    return rows.map((r) => ({
      id: r.id, name: r.name, description: r.description ?? "",
      permissions: r.permissions ?? [], isSystem: r.is_system,
    }));
  }

  async getPermissions(): Promise<RBACPermission[]> {
    const { rows } = await pool.query(
      `SELECT * FROM rbac_permissions ORDER BY module, name`,
    );
    return rows.map((r) => ({ id: r.id, name: r.name, description: r.description ?? "", module: r.module }));
  }

  async hasPermission(userId: string, permissionName: string): Promise<boolean> {
    const { rows } = await pool.query(
      `SELECT 1 FROM rbac_user_roles ur
       JOIN rbac_role_permissions rp ON rp.role_id = ur.role_id
       JOIN rbac_permissions p ON p.id = rp.permission_id
       WHERE ur.user_id = $1 AND p.name = $2
       LIMIT 1`,
      [userId, permissionName],
    );
    return rows.length > 0;
  }
}

export const rbacService = new RBACService();
