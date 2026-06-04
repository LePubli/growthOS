---
name: GrowthOS Plugin Inventory
description: 11 plugins actifs dans le runtime, leurs routes, services et conventions d'intégration
---

## 13 plugins actifs (seed-plugins.ts)
crm-sync, email-outreach, ai-signals, webhooks-relay, growth-memory, meeting-intelligence, revenue-intelligence, ai-deal-coach, ai-sdr, signal-intelligence, account-intelligence, knowledge-base, executive-command

## Conventions

### Migration pattern
- SQL block + `export runXMigration()` dans `lib/db/src/migrate.ts`
- Export depuis `lib/db/src/index.ts`
- Appel dans `seedBuiltInPlugins()` try/catch dans `seed-plugins.ts`

### Service pattern
- Classe + instance singleton exportée (`export const xService = new XService()`)
- Standalone exports pour fonctions hors-classe (ex: `generatePlaybook`)
- Ollama: `OLLAMA_BASE_URL`/`OLLAMA_MODEL` env vars, fallback mock sur timeout/erreur
- Revenue Intelligence n'utilise PAS Ollama — calculs SQL purs + mock narrative

### Route pattern
- Router dans `artifacts/api-server/src/routes/v1/plugins/<name>.ts`
- Monté dans `artifacts/api-server/src/routes/v1/index.ts` via `router.use("/<name>", router)`
- Toujours `requireAuth` middleware

### Frontend routing
- Pages plugin dans `artifacts/growthos/src/plugins/<plugin-name>/` (ex: revenue-intelligence)
- Pages standard dans `artifacts/growthos/src/pages/<Name>Page.tsx`
- Import + Route dans `App.tsx`
- apiClient dans `@/lib/api-client`

### Permissions enum (types.ts)
prospects:read/write, pipeline:read/write, signals:read/write, analytics:read, sequences:read/write, email:send, memory:read/write, meetings:read/write, accounts:read/write, ai:generate, emails:write, deals:read, ai:analyze, webhooks:send, workflows:read/write, contacts:read/write

## Workflow conflict note
L'artifact system crée ses propres workflows (`artifacts/api-server: API Server`, `artifacts/growthos: web`).
Les anciens workflows `.replit` (`GrowthOS API Server`, `GrowthOS Frontend`) entrent en conflit (même port) — l'artifact workflow démarre en premier et gagne.
Le workflow `.replit` échoue avec EADDRINUSE mais l'API tourne via l'artifact workflow. Ne pas essayer d'éditer `.replit` directement.

## AI Deal Coach (Plugin 6)
- DB: `health_score INT DEFAULT 50`, `risk_factors JSONB DEFAULT '[]'`, `ai_recommendations TEXT`, `last_coached_at TIMESTAMPTZ` sur table `deals`
- Health Score: formule basée sur recency réunion, volume meetings, signaux, mémoire, phase, ancienneté deal
- EventBus: émet `deal.at_risk` (score<40) ou `deal.coached`
- Routes: GET /deal-coach/pipeline/health, GET /deal-coach/risks, GET /deal-coach/deals, POST /deal-coach/deals/:id/analyze, GET /deal-coach/deals/:id/coach

## Revenue Intelligence (Plugin 7)
- Pas de migration DB — agrège les données existantes (deals, accounts)
- Service: getCoreKPIs, getConversionFunnel, getForecast (30/60/90j pondéré), getTrends (6 mois), getAIForecastSummary
- Forecast = value × probability × (health_score/100)
- Routes: GET /revenue/kpis|funnel|forecast|trends|ai-summary
- Frontend: `artifacts/growthos/src/plugins/revenue-intelligence/` — RevenueDashboard.tsx + KPICard.tsx
- recharts déjà installé dans growthos
- Deal Coach page intègre un widget Forecast Pipeline via /revenue/forecast

## Plugin Upload System (WordPress-style ZIP upload)
- `PluginUploaderService.ts` → `artifacts/api-server/src/lib/plugin-uploader/`
- DB: `uploaded_plugins` (slug UNIQUE, manifest JSONB, state CHECK 'uploaded|installed|active|error')
- States: uploaded → installed → active | error
- Routes at `/api/v1/plugin-marketplace`: GET /, GET /format-doc, POST /upload (multer memoryStorage 50MB), POST /install/:slug, POST /activate/:slug, POST /deactivate/:slug, DELETE /:slug
- Activation: `pluginManager.register(safeManifest)` + `pluginManager.enable(slug)` with permissions whitelist
- manifest.json at ZIP root, id must match slug, version = semver
- Frontend: `PluginUploadPage.tsx` → route `/admin/plugins-upload`
- `apiClient.postForm()` added to api-client for multipart uploads

## Deep Audit Tool
- `deep-audit.ts` → `artifacts/api-server/src/lib/audit/`
- `runDeepAudit(app, port)`: real HTTP GET calls (AbortSignal.timeout 5s), DB scan 19 tables, plugin state, healthScore = route(40%) + db(30%) + plugin(30%)
- `runAutoFix()`: re-runs all migrations, re-enables ERROR plugins, cleans orphaned audit logs
- Routes at `/api/v1/audit`: GET /deep (60s cache, ?force=true bypass), POST /auto-fix
- Uses `listRoutes(app)` from `lib/list-routes.ts`
- Test JWT generated with JWT_SECRET (5min expiry, role=admin)
- Frontend: `DeepAuditPage.tsx` → route `/admin/deep-audit`

## Sidebar Extensions (dynamic plugin injection)
- AppShell polls `/plugin-marketplace` every 30s
- Active uploaded plugins' routes injected as "Extensions" section with Package icon
- "Upload Plugins" + "Audit Système" added to Système section (ShieldCheck icon)

## Port conflict note
Restart only `artifacts/api-server: API Server` (not `GrowthOS API Server`) — artifact workflow wins port 8080.

## AI SDR Playbook (feature Account360)
- `generatePlaybook()` standalone export dans AISDRService.ts (hors classe)
- Réutilise buildContext/buildPromptContext/ollamaGenerate internes
- Route: POST /ai-sdr/playbook
- UI: bouton "Playbook IA" (violet) dans Account360Page header, PlaybookModal

**Why standalone export:** pattern standalone export (hors classe) nécessaire car le service est instancié en singleton — les fonctions utilitaires internes ne sont pas exportables via l'instance sans les ajouter à la classe.
