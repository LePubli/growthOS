/**
 * Admin — Gestion des Utilisateurs & Rôles (RBAC)
 * Routes: /admin/users/*, /admin/roles/*
 */

import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "@workspace/db";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { z } from "zod";
import { logger } from "../../lib/logger";
import { rbacService } from "../../lib/rbac/RBACService";

const router = Router();

router.use(requireAuth);
router.use(requireRole("admin"));

// ─────────────────────────────────────────────────────────────────────────────
//  GET /admin/users — Liste tous les utilisateurs du tenant
// ─────────────────────────────────────────────────────────────────────────────
router.get("/users", async (req, res) => {
  const tenantId = req.auth!.tenantId;
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.is_active,
              u.created_at, u.updated_at,
              (SELECT MAX(created_at) FROM audit_logs WHERE user_id = u.id) AS last_activity,
              COALESCE(
                json_agg(
                  json_build_object('id', r.id, 'name', r.name, 'isSystem', r.is_system)
                ) FILTER (WHERE r.id IS NOT NULL), '[]'
              ) AS rbac_roles
       FROM users u
       LEFT JOIN rbac_user_roles ur ON ur.user_id = u.id
       LEFT JOIN rbac_roles r ON r.id = ur.role_id
       WHERE u.tenant_id = $1
       GROUP BY u.id
       ORDER BY u.created_at DESC`,
      [tenantId],
    );
    res.json(rows.map((r) => ({
      id: r.id,
      email: r.email,
      firstName: r.first_name,
      lastName: r.last_name,
      role: r.role ?? "member",
      isActive: r.is_active ?? true,
      rbacRoles: r.rbac_roles ?? [],
      createdAt: r.created_at,
      lastActivity: r.last_activity ?? null,
    })));
  } catch (err) {
    logger.error({ err }, "admin/users GET error");
    res.status(500).json({ error: "Erreur interne" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /admin/users — Créer un utilisateur
// ─────────────────────────────────────────────────────────────────────────────
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(["admin", "manager", "commercial", "member", "client", "viewer"]).optional().default("commercial"),
});

router.post("/users", async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const parse = createUserSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: "Données invalides", details: parse.error.issues }); return; }

  const { email, password, firstName, lastName, role } = parse.data;
  try {
    const existing = await pool.query(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase()]);
    if (existing.rows.length > 0) { res.status(409).json({ error: "Email déjà utilisé" }); return; }

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, tenant_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, email, first_name, last_name, role, is_active, created_at`,
      [email.toLowerCase(), passwordHash, firstName ?? null, lastName ?? null, role, tenantId],
    );
    res.status(201).json({
      id: rows[0].id, email: rows[0].email,
      firstName: rows[0].first_name, lastName: rows[0].last_name,
      role: rows[0].role, isActive: rows[0].is_active, createdAt: rows[0].created_at,
    });
  } catch (err) {
    logger.error({ err }, "admin/users POST error");
    res.status(500).json({ error: "Erreur interne" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /admin/users/:id — Modifier un utilisateur
// ─────────────────────────────────────────────────────────────────────────────
const updateUserSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(["admin", "manager", "commercial", "member", "client", "viewer"]).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

router.patch("/users/:id", async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const userId = req.params.id;
  const parse = updateUserSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: "Données invalides" }); return; }

  const { firstName, lastName, role, isActive, password } = parse.data;
  try {
    const setParts: string[] = ["updated_at = NOW()"];
    const params: unknown[] = [];
    let idx = 1;

    if (firstName !== undefined) { setParts.push(`first_name = $${idx++}`); params.push(firstName); }
    if (lastName !== undefined) { setParts.push(`last_name = $${idx++}`); params.push(lastName); }
    if (role !== undefined) { setParts.push(`role = $${idx++}`); params.push(role); }
    if (isActive !== undefined) { setParts.push(`is_active = $${idx++}`); params.push(isActive); }
    if (password !== undefined) {
      const passwordHash = await bcrypt.hash(password, 10);
      setParts.push(`password_hash = $${idx++}`);
      params.push(passwordHash);
    }

    params.push(userId, tenantId);
    const { rows } = await pool.query(
      `UPDATE users SET ${setParts.join(", ")}
       WHERE id = $${idx} AND tenant_id = $${idx + 1}
       RETURNING id, email, first_name, last_name, role, is_active`,
      params,
    );
    if (!rows[0]) { res.status(404).json({ error: "Utilisateur introuvable" }); return; }
    res.json({ id: rows[0].id, email: rows[0].email, firstName: rows[0].first_name, lastName: rows[0].last_name, role: rows[0].role, isActive: rows[0].is_active });
  } catch (err) {
    logger.error({ err }, "admin/users PATCH error");
    res.status(500).json({ error: "Erreur interne" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  DELETE /admin/users/:id — Supprimer un utilisateur (pas soi-même)
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/users/:id", async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const userId = req.params.id;
  if (userId === req.auth!.userId) { res.status(400).json({ error: "Impossible de supprimer son propre compte" }); return; }
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM users WHERE id = $1 AND tenant_id = $2`,
      [userId, tenantId],
    );
    if (!rowCount) { res.status(404).json({ error: "Utilisateur introuvable" }); return; }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "admin/users DELETE error");
    res.status(500).json({ error: "Erreur interne" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /admin/users/:id/reset-password
// ─────────────────────────────────────────────────────────────────────────────
router.post("/users/:id/reset-password", async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const { newPassword } = req.body as { newPassword?: string };
  if (!newPassword || newPassword.length < 8) { res.status(400).json({ error: "Mot de passe trop court (min 8 caractères)" }); return; }
  try {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const { rowCount } = await pool.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`,
      [passwordHash, req.params.id, tenantId],
    );
    if (!rowCount) { res.status(404).json({ error: "Utilisateur introuvable" }); return; }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur interne" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /admin/users/:id/change-role — Changer le rôle simple
// ─────────────────────────────────────────────────────────────────────────────
router.post("/users/:id/change-role", async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const { role } = req.body as { role?: string };
  const VALID_ROLES = ["admin", "manager", "commercial", "member", "client", "viewer"];
  if (!role || !VALID_ROLES.includes(role)) { res.status(400).json({ error: `Rôle invalide. Valeurs acceptées : ${VALID_ROLES.join(", ")}` }); return; }
  try {
    const { rows } = await pool.query(
      `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3 RETURNING id, email, role`,
      [role, req.params.id, tenantId],
    );
    if (!rows[0]) { res.status(404).json({ error: "Utilisateur introuvable" }); return; }
    res.json({ ok: true, user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Erreur interne" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /admin/users/:id/roles — Assigner un rôle RBAC
// ─────────────────────────────────────────────────────────────────────────────
router.post("/users/:id/roles", async (req, res) => {
  const { roleId } = req.body as { roleId?: string };
  if (!roleId) { res.status(400).json({ error: "roleId requis" }); return; }
  try {
    await rbacService.assignRole(req.params.id, roleId, req.auth!.userId);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "assign role error");
    res.status(500).json({ error: "Erreur interne" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  DELETE /admin/users/:id/roles/:roleId — Retirer un rôle RBAC
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/users/:id/roles/:roleId", async (req, res) => {
  try {
    await rbacService.removeUserRole(req.params.id, req.params.roleId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur interne" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /admin/roles — Rôles disponibles (système + custom du tenant)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/roles", async (req, res) => {
  try {
    const roles = await rbacService.getRoles(req.auth!.tenantId);
    res.json(roles);
  } catch (err) {
    logger.error({ err }, "admin/roles GET error");
    res.status(500).json({ error: "Erreur interne" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /admin/roles — Créer un rôle custom
// ─────────────────────────────────────────────────────────────────────────────
const createRoleSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().optional().default(""),
  permissions: z.array(z.string()).optional().default([]),
});

router.post("/roles", async (req, res) => {
  const parse = createRoleSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: "Données invalides", details: parse.error.issues }); return; }
  try {
    const role = await rbacService.createRole(req.auth!.tenantId, parse.data.name, parse.data.description, parse.data.permissions);
    res.status(201).json(role);
  } catch (err: any) {
    if (err.code === "23505") { res.status(409).json({ error: "Un rôle avec ce nom existe déjà" }); return; }
    logger.error({ err }, "admin/roles POST error");
    res.status(500).json({ error: "Erreur interne" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /admin/roles/:id — Modifier un rôle custom
// ─────────────────────────────────────────────────────────────────────────────
const updateRoleSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});

router.patch("/roles/:id", async (req, res) => {
  const parse = updateRoleSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: "Données invalides" }); return; }
  try {
    const role = await rbacService.updateRole(req.params.id, req.auth!.tenantId, parse.data);
    res.json(role);
  } catch (err: any) {
    logger.error({ err }, "admin/roles PATCH error");
    res.status(err.message?.includes("système") ? 403 : 404).json({ error: err.message ?? "Erreur interne" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  DELETE /admin/roles/:id — Supprimer un rôle custom
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/roles/:id", async (req, res) => {
  try {
    await rbacService.deleteRole(req.params.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(err.message?.includes("système") ? 403 : 404).json({ error: err.message ?? "Erreur interne" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /admin/permissions — Liste toutes les permissions disponibles
// ─────────────────────────────────────────────────────────────────────────────
router.get("/permissions", async (req, res) => {
  try {
    const permissions = await rbacService.getPermissions();
    res.json(permissions);
  } catch (err) {
    res.status(500).json({ error: "Erreur interne" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /admin/stats — Statistiques globales
// ─────────────────────────────────────────────────────────────────────────────
router.get("/stats", async (req, res) => {
  const tenantId = req.auth!.tenantId;
  try {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*)::int AS total_users,
         COUNT(*) FILTER (WHERE is_active = true)::int AS active_users,
         COUNT(*) FILTER (WHERE role = 'admin')::int AS admin_count,
         COUNT(*) FILTER (WHERE role = 'client')::int AS client_count
       FROM users WHERE tenant_id = $1`,
      [tenantId],
    );
    res.json(rows[0] ?? { total_users: 0, active_users: 0, admin_count: 0, client_count: 0 });
  } catch {
    res.status(500).json({ error: "Erreur interne" });
  }
});

export default router;
