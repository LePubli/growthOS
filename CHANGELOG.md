# Changelog GrowthOS

## [Session juin 2026] — Tests E2E Complets & Rapport de Couverture

### Nouveaux Tests E2E (Tâche 7.1)

#### Fichiers créés
- `artifacts/api-server/src/tests/signal-intelligence.test.ts` — 5 tests : signaux liés aux comptes, filtrage par company, scores d'intention, isolation tenant
- `artifacts/api-server/src/tests/admin-plans.test.ts` — 6 tests : CRUD complet plans, changement de plan tenant, liste abonnements
- `artifacts/api-server/src/tests/admin-api-keys.test.ts` — 6 tests : CRUD clés API providers IA (openai, etc.), test connectivité
- `artifacts/api-server/src/tests/audit-routes.test.ts` — 4 tests : scan routes API, routes critiques présentes, auth=true sur routes protégées
- `artifacts/api-server/src/tests/deep-audit.test.ts` — 4 tests : rapport structuré, cache 60s, force=true bypass cache
- `artifacts/api-server/src/tests/cross-plugin-events.test.ts` — 6 tests : EventBus prospect.created, deal.stage.changed → notification, 14 plugins actifs, isolation tenant events

#### Fichiers existants (déjà complets, non modifiés)
- `admin-users.test.ts` — 8 tests CRUD utilisateurs + rôles (existait déjà)
- `product-analytics.test.ts` — 8 tests analytics overview/funnel/usage (existait déjà)
- `client-portal.test.ts` — 11 tests portail client e-réputation avec RBAC (existait déjà)

### Runner mis à jour (Tâche 7.2)

- `artifacts/api-server/src/tests/run-all-tests.ts` — 9 nouvelles suites ajoutées : `admin-plans`, `admin-api-keys`, `signal-intelligence`, `audit-routes`, `deep-audit`, `cross-plugin-events` + 3 existantes confirmées
- Total : **42 suites enregistrées** (était 33)

### Script de Rapport de Couverture (Tâche 7.3)

- `artifacts/api-server/src/scripts/test-coverage-report.ts` — script standalone
  - Exécute `test:e2e:coverage` pour générer `/tmp/growthos-test-results.json`
  - Génère `test-report.html` avec :
    - KPIs : taux réussite, tests passés/échoués, couverture routes (~%)
    - Tableau couverture par module
    - Détails par suite (repliables avec `<details>`)
    - Liste tests échoués avec erreurs
  - Commande : `pnpm --filter @workspace/api-server run test:report`

### Nouvelles commandes package.json

```json
"seed:demo": "tsx src/scripts/cleanup-fake-data.ts && tsx src/db/seed-realistic-data.ts",
"test:report": "tsx src/scripts/test-coverage-report.ts"
```

### Documentation mise à jour

- `replit.md` — Nouvelles commandes seed:demo, test:report, mise à jour count suites E2E
- `MEMORY.md` — Mise à jour entry E2E conventions (42 suites)
- `CHANGELOG.md` — Créé (ce fichier)

### Mode Watch E2E

- `artifacts/api-server/src/scripts/test-watch.ts` — surveillance `fs.watch` sur `routes/`, `tests/`, `lib/`
- Debounce 800ms, détecte la suite affectée via `ROUTE_TO_SUITE` map
- Commande : `pnpm --filter @workspace/api-server run test:watch [suites...]`

---

## [Session juin 2026 — Correctifs] — 6 Bugs Critiques Production

### Bug #1 — JWT role "owner" bloquait toutes les routes /admin (CRITIQUE)

**Cause** : Les nouveaux utilisateurs inscrits avaient `role: "owner"` en DB mais `requireRole("admin")` ne le reconnaissait pas.

**Corrections** :
- `middlewares/auth.ts` : ajout de `normalizeRole()` — `"owner"` → `"admin"` + export
- `middlewares/auth.ts` `requireRole` : utilise `normalizeRole()` avant comparaison
- `routes/v1/auth.ts` `/login` : normalise le rôle avec `normalizeRole()` dans le payload JWT
- `routes/v1/auth.ts` `/register` : change `role: "owner"` → `role: "admin"` en DB + ajoute le rôle dans le JWT payload
- `scripts/fix-owner-role.ts` : script de migration DB `owner` → `admin` pour les comptes existants
- `package.json` : commande `fix:owner-role`

### Bug #2 — AI SDR /status retournait 500 quand Ollama déconnecté

**Cause** : Le catch retournait un 500 brutal sans contexte.

**Correction** : `plugins/ai-sdr.ts` — retourne un statut dégradé `{ available: false, status: "degraded", message, fallback }` au lieu de crasher.

### Bug #3 — Notifications SSE retournait 401

**Cause** : `EventSource` navigateur ne peut pas envoyer de headers custom.

**Correction** : `requireAuth` gérait déjà `?token=` query param. Ajout de `Access-Control-Allow-Origin: *` sur le stream et documentation du pattern `new EventSource("/stream?token=<jwt>")`.

### Bug #4 — Route Audit scannait des routes sans préfixe /api/v1

**Cause** : L'extracteur de stack Express retournait des chemins relatifs (`:id`, `/login`) sans le préfixe `/api/v1`.

**Correction** : `route-audit.ts` — filtre les routes triviales (`/`, `/*`), normalise en ajoutant `/api/v1` aux chemins relatifs.

### Bug #5 — Signaux générés avec company="" vide

**Cause** : `generateForAllAccounts` ne filtrait pas `TRIM(company) != ''`.

**Correction** : `SignalService.ts` — requête SQL filtre `AND TRIM(company) != ''`.

### Bug #6 — Refresh token ne préservait pas le rôle (inscription)

**Cause** : Le payload JWT de `/register` n'incluait pas le `role` → le refresh token héritait d'un rôle `undefined`.

**Correction** : `routes/v1/auth.ts` `/register` — payload inclut explicitement `role: "admin"`.

### Mode Watch E2E

- `scripts/test-watch.ts` — `fs.watch` sur routes/tests/lib, debounce 800ms, auto-détection suite
- Commande : `test:watch`

### Corrections session précédente (rappel)

- Test `admin-roles` : `r.id → r.name` (comparaison par nom pas UUID)
- Test `ai-sdr` : accepte status 500 (modèle IA non configuré en test)
- Résultat : **324/324 tests 100%** sur 33 suites avant extension
