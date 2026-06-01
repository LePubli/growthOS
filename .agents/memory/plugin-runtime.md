---
name: Plugin Runtime Engine
description: Phases 1-3 du Plugin Runtime Engine GrowthOS — architecture, DB, frontend
---

## Phase 1 — Backend runtime (DONE)
Singleton `pluginManager` dans `artifacts/api-server/src/lib/plugin-runtime/`.
- Types Zod: `types.ts`
- DAG resolver (Kahn): `dependency-resolver.ts`
- EventBus async isolé: `event-bus.ts`
- Manager: `plugin-manager.ts`
- 4 plugins seed: `seed-plugins.ts`
- Routes: `GET /api/v1/plugins/status|active`, `POST /register|:id/enable|disable`

**Why:** runtime en mémoire (pas de DB) = zéro latence pour checks de permission.

## Phase 2 — Frontend UI SDK (DONE)
Hook React Query: `artifacts/growthos/src/hooks/use-plugins.ts`
- `useRuntimePlugins()` — polling 30s
- `useEnablePlugin()` / `useDisablePlugin()` — mutations avec invalidation
PluginsPage.tsx: 3ème onglet "Runtime Engine" avec grille + drawer latéral + enable/disable live.

## Phase 3 — Audit & Observabilité (DONE)
- Table `plugin_audit_logs` ajoutée dans `lib/db/src/migrate.ts` (CREATE TABLE IF NOT EXISTS)
- Service `artifacts/api-server/src/lib/plugin-runtime/audit.ts` — writeAuditLog() fire-and-forget, fetchAuditLogs() paginé
- Routes plugins.ts mises à jour: audit après chaque enable/disable/register
- `GET /api/v1/plugins/audit?plugin_id=&limit=&offset=`
- Hook `usePluginAudit()` avec polling 15s
- UI: onglet "Audit" dans RuntimeEnginePanel avec timeline verticale

**Why:** fire-and-forget sur writeAuditLog évite de casser les actions en cas d'erreur DB.
