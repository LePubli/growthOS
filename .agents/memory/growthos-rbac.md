---
name: GrowthOS RBAC
description: Système RBAC complet — tables DB, service, middleware, routes, frontend, SSE
---

## Tables DB (runRBACMigration)
- `rbac_roles` — id, name, description, permissions JSONB, is_system, tenant_id
- `rbac_permissions` — id, name, description, module (45 permissions insérées)
- `rbac_role_permissions` — many-to-many
- `rbac_user_roles` — user_id, role_id, assigned_at, assigned_by
- `users.is_active` — colonne ajoutée via ALTER TABLE IF NOT EXISTS

## 4 rôles système (is_system=true, tenant_id=NULL)
admin, manager, commercial, viewer — non supprimables

## Fichiers créés
- `artifacts/api-server/src/lib/rbac/RBACService.ts` — CRUD complet
- `artifacts/api-server/src/middlewares/rbac.ts` — requirePermission + requireRBACRole
- `artifacts/api-server/src/routes/v1/admin-users.ts` — réécriture complète avec RBAC
- `artifacts/growthos/src/pages/admin/UsersPage.tsx` — page 2 onglets (users + roles)
- `artifacts/growthos/src/hooks/useSignalNotifications.ts` — hook SSE activé dans App.tsx

## Routes admin (toutes requireAuth + requireRole('admin'))
- GET/POST /admin/users — liste avec rbac_roles join, création
- PATCH/DELETE /admin/users/:id — édition (inclut isActive, password optionnel)
- POST /admin/users/:id/reset-password
- POST/DELETE /admin/users/:id/roles — assignation/retrait rôle RBAC
- GET/POST /admin/roles — système + custom
- PATCH/DELETE /admin/roles/:id — seulement si is_system=false
- GET /admin/permissions — 45 permissions par module
- GET /admin/stats

## SSE Notifications (déjà existant)
- Backend: `notification.service.ts` avec `registerSSEClient` + `pushSSE`
- GET /api/v1/notifications/stream — SSE endpoint
- Hook `useSignalNotifications` branché dans `App.tsx` (AppRoutes)
- Les signaux déclenchent `createNotification` → toast client

## Auth
- Seed password: `demo1234` (bcrypt hash valide, mis à jour en DB)
- Refresh token: préserve maintenant le champ `role` dans le JWT

**Why:** Admin bypass dans requirePermission — les admins ont toujours accès sans vérifier rbac_user_roles, évitant de bloquer l'admin avant assignation de rôles RBAC explicites.
