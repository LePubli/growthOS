---
name: GrowthOS Plugin Inventory
description: 10 plugins actifs dans le runtime, leurs routes, services et conventions d'intégration
---

## 10 plugins actifs (seed-plugins.ts)
crm-sync, email-outreach, ai-signals, webhooks-relay, growth-memory, meeting-intelligence, ai-deal-coach, ai-sdr, signal-intelligence, account-intelligence

## Conventions

### Migration pattern
- SQL block + `export runXMigration()` dans `lib/db/src/migrate.ts`
- Export depuis `lib/db/src/index.ts`
- Appel dans `seedBuiltInPlugins()` try/catch dans `seed-plugins.ts`

### Service pattern
- Classe + instance singleton exportée (`export const xService = new XService()`)
- Standalone exports pour fonctions hors-classe (ex: `generatePlaybook`)
- Ollama: `OLLAMA_BASE_URL`/`OLLAMA_MODEL` env vars, fallback mock sur timeout/erreur

### Route pattern
- Router dans `artifacts/api-server/src/routes/v1/plugins/<name>.ts`
- Monté dans `artifacts/api-server/src/routes/v1/index.ts` via `router.use("/<name>", router)`
- Toujours `requireAuth` middleware

### Permissions déclarées dans types.ts PluginPermission enum
Actuellement: prospects:read/write, pipeline:read/write, signals:read/write, analytics:read, sequences:read/write, email:send, memory:read/write, meetings:read/write, accounts:read/write, ai:generate, emails:write, deals:read, ai:analyze, webhooks:send

### Frontend routing
- Page dans `artifacts/growthos/src/pages/<Name>Page.tsx`
- Import + Route dans `App.tsx`
- apiClient dans `@/lib/api-client` — tous les appels via ce client

## AI Deal Coach (Plugin 6)
- DB: `health_score INT DEFAULT 50`, `risk_factors JSONB DEFAULT '[]'`, `ai_recommendations TEXT`, `last_coached_at TIMESTAMPTZ` sur table `deals`
- Health Score: formule basée sur recency réunion, volume meetings, signaux, mémoire, phase, ancienneté deal
- EventBus: émet `deal.at_risk` (score<40) ou `deal.coached`
- Routes: GET /deal-coach/pipeline/health, GET /deal-coach/risks, GET /deal-coach/deals, POST /deal-coach/deals/:id/analyze, GET /deal-coach/deals/:id/coach

## AI SDR Playbook (feature Account360)
- `generatePlaybook()` standalone export dans AISDRService.ts (hors classe)
- Réutilise buildContext/buildPromptContext/ollamaGenerate internes
- Route: POST /ai-sdr/playbook
- UI: bouton "Playbook IA" (violet) dans Account360Page header, PlaybookModal avec talking points/objections/competitor notes/next steps + copier

**Why:** pattern standalone export (hors classe) nécessaire car le service est instancié en singleton — les fonctions utilitaires internes ne sont pas exportables via l'instance sans les ajouter à la classe.
