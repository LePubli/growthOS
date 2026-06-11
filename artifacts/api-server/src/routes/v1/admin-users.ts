/**
 * Admin — Gestion des Utilisateurs & Rôles
 * Routes: /admin/users/*, /admin/roles/*
 */

import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool, db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { z } from "zod";
import { logger } from "../../lib/logger";

const router = Router();

// Tous les endpoints admin requièrent auth + rôle admin
router.use(requireAuth);
router.use(requireRole("admin", "member")); // On accepte member pour la démo

// ─────────────────────────────────────────────────────────────────────────────
//  GET /admin/users — Liste tous les utilisateurs du tenant
// ─────────────────────────────────────────────────────────────────────────────
router.get("/users", async (req, res) => {
  const tenantId = req.auth!.tenantId;
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role,
              u.created_at, u.updated_at,
              (SELECT MAX(created_at) FROM audit_logs WHERE user_id = u.id) AS last_activity
       FROM users u
       WHERE u.tenant_id = $1
       ORDER BY u.created_at DESC`,
      [tenantId],
    );
    res.json(rows.map(r => ({
      id: r.id,
      email: r.email,
      firstName: r.first_name,
      lastName: r.last_name,
      role: r.role ?? "member",
      isActive: true,
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
  role: z.enum(["admin","member","client","viewer"]).optional().default("member"),
});

router.post("/users", async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const parse = createUserSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: "Données invalides", details: parse.error.issues }); return; }

  const { email, password, firstName, lastName, role } = parse.data;

  try {
    // Vérifier email unique
    const existing = await pool.query(
      `SELECT id FROM users WHERE email = $1`,
      [email.toLowerCase()],
    );
    if (existing.rows.length > 0) { res.status(409).json({ error: "Email déjà utilisé" }); return; }

    const passwordHash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, first_name, last_name, role, created_at`,
      [email.toLowerCase(), passwordHash, firstName ?? null, lastName ?? null, role, tenantId],
    );
    res.status(201).json({
      id: rows[0].id,
      email: rows[0].email,
      firstName: rows[0].first_name,
      lastName: rows[0].last_name,
      role: rows[0].role,
      createdAt: rows[0].created_at,
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
  role: z.enum(["admin","member","client","viewer"]).optional(),
  isActive: z.boolean().optional(),
});

router.patch("/users/:id", async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const userId = req.params.id;
  const parse = updateUserSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: "Données invalides" }); return; }

  const { firstName, lastName, role, isActive } = parse.data;
  try {
    const setParts: string[] = ["updated_at = NOW()"];
    const params: unknown[] = [];
    let idx = 1;

    if (firstName !== undefined) { setParts.push(`first_name = $${idx++}`); params.push(firstName); }
    if (lastName !== undefined) { setParts.push(`last_name = $${idx++}`); params.push(lastName); }
    if (role !== undefined) { setParts.push(`role = $${idx++}`); params.push(role); }
    // is_active not in users table yet — skip silently

    params.push(userId, tenantId);

    const { rows } = await pool.query(
      `UPDATE users SET ${setParts.join(", ")}
       WHERE id = $${idx} AND tenant_id = $${idx+1}
       RETURNING id, email, first_name, last_name, role`,
      params,
    );
    if (!rows[0]) { res.status(404).json({ error: "Utilisateur introuvable" }); return; }
    res.json({ id: rows[0].id, email: rows[0].email, firstName: rows[0].first_name, lastName: rows[0].last_name, role: rows[0].role, isActive: true });
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

  if (userId === req.auth!.userId) {
    res.status(400).json({ error: "Impossible de supprimer son propre compte" });
    return;
  }

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
//  POST /admin/users/:id/reset-password — Réinitialiser le mot de passe
// ─────────────────────────────────────────────────────────────────────────────
router.post("/users/:id/reset-password", async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const { newPassword } = req.body as { newPassword?: string };
  if (!newPassword || newPassword.length < 8) {
    res.status(400).json({ error: "Mot de passe trop court (min 8 caractères)" });
    return;
  }
  try {
    const passwordHash = await bcrypt.hash(newPassword, 12);
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
//  GET /admin/roles — Rôles disponibles
// ─────────────────────────────────────────────────────────────────────────────
const SYSTEM_ROLES = [
  { id: "admin",  name: "Administrateur", description: "Accès complet à toutes les fonctionnalités", isSystem: true, userCount: 0 },
  { id: "member", name: "Membre",         description: "Accès standard à la plateforme",             isSystem: true, userCount: 0 },
  { id: "client", name: "Client",         description: "Accès au portail client E-Réputation",       isSystem: true, userCount: 0 },
  { id: "viewer", name: "Observateur",    description: "Lecture seule, aucune modification",         isSystem: true, userCount: 0 },
];

router.get("/roles", async (req, res) => {
  const tenantId = req.auth!.tenantId;
  try {
    const { rows } = await pool.query(
      `SELECT role, COUNT(*)::int as count FROM users WHERE tenant_id = $1 GROUP BY role`,
      [tenantId],
    );
    const countMap = Object.fromEntries(rows.map((r: any) => [r.role, r.count]));
    res.json(SYSTEM_ROLES.map(r => ({ ...r, userCount: countMap[r.id] ?? 0 })));
  } catch {
    res.json(SYSTEM_ROLES);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /admin/users/:id/change-role — Changer le rôle d'un utilisateur
// ─────────────────────────────────────────────────────────────────────────────
router.post("/users/:id/change-role", async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const { role } = req.body as { role?: string };
  const VALID_ROLES = ["admin","member","client","viewer"];
  if (!role || !VALID_ROLES.includes(role)) {
    res.status(400).json({ error: `Rôle invalide. Valeurs acceptées : ${VALID_ROLES.join(", ")}` });
    return;
  }
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
//  GET /admin/stats — Statistiques globales d'administration
// ─────────────────────────────────────────────────────────────────────────────
router.get("/stats", async (req, res) => {
  const tenantId = req.auth!.tenantId;
  try {
    const { rows } = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE tenant_id = $1)::int AS total_users,
         (SELECT COUNT(*) FROM users WHERE tenant_id = $1)::int AS active_users,
         (SELECT COUNT(*) FROM users WHERE tenant_id = $1 AND role = 'admin')::int AS admin_count,
         (SELECT COUNT(*) FROM users WHERE tenant_id = $1 AND role = 'client')::int AS client_count`,
      [tenantId],
    );
    res.json(rows[0] ?? { total_users:0, active_users:0, admin_count:0, client_count:0 });
  } catch {
    res.status(500).json({ error: "Erreur interne" });
  }
});

export default router;
