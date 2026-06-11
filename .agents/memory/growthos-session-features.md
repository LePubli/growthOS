---
name: GrowthOS Session Features
description: Features implemented across sessions — conventions, patterns, and durable decisions
---

## Implemented Features

- Tasks CRUD (priorities, deadlines, status, entity link)
- Onboarding wizard 5 steps (/onboarding)
- Help center (/help)
- Referral program (/referral)
- CSV export (prospects/deals/signals/activities via GET /reporting/csv/:entity)
- Deal Health Score — frontend-only in PipelinePage.tsx, computeHealthScore()
- Plans & Subscriptions — admin plans page, PlansService, dynamic usageLimit via subscriptions → plans
- Admin Audit Logs — audit_logs table, routes /admin/audit-logs/*, AuditPage
- Provider API Keys — provider_api_keys table (AES-256-CBC), ProviderKeysService, 12 providers, ApiKeysPage
- Quota Monitoring — /admin/quotas route, QuotaMonitoringPage.tsx, per-tenant usage grid with alert badges
- Cross-plugin EventBus — 6 events: prospect.created, deal.stage.changed, signal.detected, erep.audit.completed, sequence.email.sent, meeting.completed
- Account Intelligence Health Score — 5-factor weighted model (activity 40%, email 20%, pipeline 20%, erep 10%, signals 10%)
- Executive Command Center — averageReputationScore, activeReputationAlerts, reputationCrisisCount integrated

## Migration Pattern

`runXxxMigration()` dans `lib/db/src/migrate.ts` → export dans `lib/db/src/index.ts` → appel dans `artifacts/api-server/src/index.ts`

## Admin Route Pattern

Import router in `routes/v1/index.ts` → mount with `router.use("/admin", adminXxxRouter)`.
Admin routes use `requireAuth + requireRBACRole("admin")` (NOT `requireRole` — doesn't exist).

## Icon Convention

`Key` n'existe pas dans cette version lucide-react → utiliser `KeyRound` ou `KeySquare`.

## EventBus Key Decision

`erep.audit.completed` → cross-plugin handler emits `erep.score.updated` (then erep-integrations handles DB update) + `erep.alert` if score < 40. Never emit DB writes directly from cross-plugin-events; delegate to the domain-specific listener.
