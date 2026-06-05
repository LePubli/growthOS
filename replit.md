# GrowthOS

GrowthOS est une plateforme B2B de Sales & Growth Intelligence multi-tenant — pipeline commercial, prospection intelligente, séquences email, signaux d'intention, enrichissement de données, e-réputation et plugins d'IA.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/growthos run dev` — run the frontend (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only, requires TTY)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (port 8080)
- DB: PostgreSQL + Drizzle ORM + migrations auto-run at startup via `lib/db/src/migrate.ts`
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React 18 + Vite + Tailwind CSS + TanStack Query

## Where things live

- `lib/db/src/schema/` — Drizzle ORM table definitions (source of truth for DB schema)
- `lib/db/src/migrate.ts` — Raw SQL migrations run at server startup (`CREATE TABLE IF NOT EXISTS`)
- `lib/db/src/index.ts` — DB exports (add new `runXxxMigration` exports here)
- `artifacts/api-server/src/routes/v1/` — all REST API routes
- `artifacts/api-server/src/routes/v1/index.ts` — route mounting
- `artifacts/api-server/src/index.ts` — server startup + migration calls
- `artifacts/growthos/src/pages/` — React page components
- `artifacts/growthos/src/App.tsx` — Wouter routes
- `artifacts/growthos/src/components/layout/AppShell.tsx` — sidebar nav (NAV_SECTIONS array)
- `artifacts/growthos/src/lib/api-client.ts` — typed API client (wraps fetch)

## Architecture decisions

- **Migrations**: No Drizzle `drizzle-kit push` in CI (requires TTY). All new tables are added as `runXxxMigration()` functions in `lib/db/src/migrate.ts` and called in `artifacts/api-server/src/index.ts` at startup.
- **Multi-tenancy**: JWT middleware injects `tenantId` into `req.auth`. All routes filter by `tenantId` at the application level. Every new table must include `tenant_id UUID NOT NULL REFERENCES tenants(id)`.
- **Plugin system**: 14 built-in plugins registered at startup. Each plugin has a manifest with permissions, and is shown/hidden in the nav via `pluginId` on `NavItem`.
- **Reporting/Export**: `GET /api/v1/reporting/csv/:entity` — supports `prospects`, `deals`, `signals`, `activities`. Returns CSV with UTF-8 encoding.
- **Deal Health Score**: Computed frontend-only in `PipelinePage.tsx` — `computeHealthScore(deal)` returns `{ score 0-100, color, label }` based on stage (40%), close date (30%), probability (30%) + priority bonus.

## Product

GrowthOS couvre les fonctionnalités suivantes :

### CRM & Pipeline
- Prospects avec enrichissement, géolocalisation, scoring, notes historisées, activités
- Pipeline Kanban/Liste/Forecast avec Deal Health Score (♥ vert/orange/rouge)
- Deal Coach IA — recommandations par deal
- Activities (appels, emails, réunions, notes, tâches)

### Prospection & Intelligence
- Scraping / Sourcing avec 23 sources de données
- Data Enrichment Engine (géocodage, technographies, signaux)
- Signaux d'intention (funding, hiring, news, technology, intent)
- Contact Intel, ABM / TAM targeting
- Carte & tournées commerciales

### Marketing & Outreach
- Séquences email multi-étapes (draft/active/paused)
- Templates email avec variables
- Inbound marketing, Propositions commerciales
- CRM Sync (Salesforce, HubSpot, Pipedrive)

### E-Réputation (plugin)
- Dashboard e-réputation + score
- Suivi SERP, Analyse de sentiment
- Calendrier social, Réseau PBN

### IA & Revenue
- AI SDR — génération de messages personnalisés
- Revenue Intelligence — dashboard CA et prévisions
- Base de connaissances commerciale
- Command Center exécutif
- Growth Memory — mémoire long-terme des interactions

### Collaboration & Productivité
- **Mes Tâches** — CRUD complet, priorités, échéances, statuts, lien entité (prospect/deal/signal)
- Réunions avec transcription et résumé IA
- Calendrier, Workflows d'automatisation
- Dashboards partagés, Métriques équipe

### Onboarding & Go-to-Market
- **Wizard d'onboarding 5 étapes** — /onboarding (sans auth requise)
- **Centre d'aide** — /help (articles, FAQ, tutoriels vidéo)
- **Programme de parrainage** — /referral (code unique, historique)

### Système
- Webhooks sortants configurables
- Clés API, audit de routes, audit système (Deep Audit)
- Marketplace de plugins (upload + activation)
- Export CSV — prospects, deals, signals, activities (`GET /reporting/csv/:entity`)
- Thèmes (dark/light + palettes)
- Notifications temps réel

## API Endpoints notables

| Méthode | Route | Description |
|---------|-------|-------------|
| GET/POST/PATCH/DELETE | `/tasks` | Gestion des tâches |
| POST | `/tasks/:id/complete` | Marquer une tâche terminée |
| GET | `/reporting/csv/:entity` | Export CSV (prospects/deals/signals/activities) |
| GET | `/signals/:id` | Détail d'un signal par ID |
| GET | `/audit/deep` | Deep audit de toutes les routes API |
| GET | `/activities?prospectId=&type=note` | Notes d'un prospect |

## User preferences

- Langue : Français (UI et messages d'erreur)
- Pas de données mockées côté frontend — toujours charger depuis l'API
- StatusBadge Deep Audit : vert 200-304, orange 401/403, rouge 404/500/ERR
- Imports lucide-react explicites (pas de barrel imports)

## Gotchas

- **Migration TTY** : `drizzle-kit push` nécessite un terminal interactif. Toujours ajouter une fonction `runXxxMigration()` dans `migrate.ts` et l'appeler dans `index.ts` au démarrage.
- **Signals table** : pas de colonne `status` — utiliser `isRead` / `isStarred` uniquement.
- **Deal stages valides** : `lead`, `qualified`, `proposal`, `negotiation`, `won`, `lost`.
- **Activity types valides** : `call`, `email`, `meeting`, `note`, `task`.
- **Après tout changement backend** : redémarrer le workflow "GrowthOS API Server" (rebuild esbuild).
- **`and()` drizzle** : toujours importer depuis `drizzle-orm`, pas depuis `@workspace/db`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Seed: `pnpm --filter @workspace/api-server run seed:realistic` — 30 prospects, 15 deals, 20 signals
- E2E test: `pnpm --filter @workspace/api-server run test:e2e` — 13 scénarios automatisés
- Auth credentials demo: `admin@growthos.fr` / `pierre@growthos.fr`, tenant `growthos-demo`
