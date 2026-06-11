---
name: GrowthOS Auth Bugs & Production Fixes
description: 6 bugs production corrigés — RBAC owner/admin, SSE token, route-audit, signals, refresh JWT
---

# GrowthOS — Bugs Production Corrigés

## Bug #1 — JWT role "owner" bloque les routes /admin

**Symptôme** : Toutes les routes `/api/v1/admin/*` retournent 403 pour les premiers utilisateurs inscrits.

**Cause** : `/register` créait l'utilisateur avec `role: "owner"` en DB et ne mettait pas le rôle dans le JWT. Le middleware `requireRole("admin")` ne reconnaissait pas "owner".

**Corrections** :
- `normalizeRole(role?)` ajouté dans `middlewares/auth.ts` : `"owner"` → `"admin"`
- `requireRole` utilise `normalizeRole()` avant de comparer
- `/login` : `role: normalizeRole((user as any).role)` dans le payload JWT
- `/register` : `role: "admin"` en DB ET dans le payload JWT (plus `"owner"`)
- Script `fix-owner-role.ts` pour migrer les utilisateurs existants : `pnpm run fix:owner-role`

**Why:** Les anciens comptes créés avant le fix ont "owner" en DB. Le script doit être exécuté en production après déploiement.

## Bug #2 — AI SDR /status → 500

**Cause** : Ollama non connecté, le catch renvoyait un 500 brut.
**Fix** : Retourne `{ available: false, status: "degraded", message, fallback }` avec HTTP 200.

## Bug #3 — SSE Notifications → 401

**Cause** : EventSource navigateur ne peut pas envoyer de headers Authorization.
**Fix** : `requireAuth` supporte déjà `?token=<jwt>` query param. Ajout de `Access-Control-Allow-Origin: *` sur le stream. Pattern côté frontend : `new EventSource(\`/api/v1/notifications/stream?token=${accessToken}\`)`.

## Bug #4 — Route Audit → 404 en masse

**Cause** : L'extracteur de stack Express retournait des chemins relatifs sans préfixe (`/:id`, `/login`). Les outils externes qui scannaient ces chemins obtenaient des 404.
**Fix** : `route-audit.ts` filtre les chemins triviaux et ajoute `/api/v1` aux chemins relatifs.

## Bug #5 — Signaux générés avec company=""

**Cause** : `generateForAllAccounts` ne filtrait pas les company vides.
**Fix** : `AND TRIM(company) != ''` dans la requête SQL de `SignalService.ts`.

## Bug #6 — Refresh token sans rôle (inscription)

**Cause** : Le payload JWT de `/register` n'incluait pas le rôle → refresh token héritait de `role: undefined`.
**Fix** : Payload `/register` inclut `role: "admin"` explicitement.
