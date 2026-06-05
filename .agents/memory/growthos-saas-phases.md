---
name: GrowthOS SaaS Enterprise Phases
description: Phases 1-4 implémentées — Billing, Collaboration mentions, Webhooks HMAC, API publique, Product Analytics
---

## Phases implémentées

### Phase 1 — Multi-tenancy & Billing
- `runSaaSMigration()` dans `lib/db/src/migrate.ts` : tables `subscriptions`, `invoices`, `usage_limits` + ALTER TABLE tenants (domain, plan, status)
- `TenantService.ts` : createTenant, getTenant, updateTenant
- `StripeService.ts` : checkout sessions, customer portal, webhook handler, graceful fallback si STRIPE_SECRET_KEY absent
- `usageLimit.ts` middleware : `requireUsage(resource)` factory, `checkUsage`, `incrementUsage`, `getUsage`
- Route `/billing` : subscription, invoices, usage, checkout, portal, webhook Stripe
- `settings/BillingPage.tsx` : connectée à l'API réelle, alerte si Stripe non configuré

### Phase 2 — Collaboration mentions & RGPD
- Table `mentions` dans `runSaaSMigration()`
- `CollaborationService.ts` : addMention (avec notification auto), logAudit, getMentions, markMentionRead
- `RGPDService.ts` : exportTenantData (export JSON complet), deleteTenantData (anonymisation ou suppression)
- Route `POST /collaboration/mention`, `GET /collaboration/mentions`, `PATCH /collaboration/mentions/:id/read`

### Phase 3 — Intégrations/Webhooks & API publique
- Table `webhook_logs` dans `runSaaSMigration()`
- `WebhookService.ts` : triggerEvent avec HMAC-SHA256, _deliver avec fire-and-forget, getLogs, verifySignature
- Route `/integrations/webhooks` (CRUD complet + toggle + test + logs + incoming)
- `webhookAuth.ts` middleware : vérifie X-GrowthOS-Signature HMAC
- `ApiKeyService.ts` : keys stockées dans tenant.settings JSONB (pattern existant), rate limiting sliding window 100 req/min en mémoire
- `apiKeyAuth.ts` middleware : Bearer gos_<key>, injecte req.apiKey + req.auth
- Route `/public` : prospects, deals, signals via API key
- `IntegrationsPage.tsx` : page top-level à `/integrations`, webhooks CRUD + journal des livraisons
- Nav AppShell : "Webhooks" → "Intégrations" (href: /integrations), "Facturation" ajouté dans Système

### Phase 4 — Product Analytics
- Table `analytics_events` dans `runSaaSMigration()`
- `ProductAnalytics.ts` : trackEvent (fire-and-forget), getDashboard, getFunnelData
- `analyticsTracker.ts` middleware : auto-track les appels API mutants (POST/PUT/PATCH/DELETE)
- Routes `/analytics/track` (POST) et `/analytics/product-dashboard` (GET) ajoutées
- `lib/analytics.ts` frontend : track(), trackPage(), trackFeature() fire-and-forget vers /analytics/track

## Architecture key decisions
- **Stripe sans SDK** : appels directs vers `https://api.stripe.com/v1` avec fetch (pas de dépendance `stripe`)
- **Rate limiting** : sliding window en mémoire (Map) — suffit pour un seul process Node.js
- **analytics auto-tracking** : middleware `analyticsTracker` à appliquer en amont des routes dans app.ts
- **requireAuth manquant dans analytics.ts** : ajouter l'import explicitement (erreur ReferenceError au démarrage)

**Why:** Eviter l'installation de Stripe SDK pour minimiser les dépendances. Rate limiting in-memory OK car single-process. Toujours importer requireAuth explicitement dans chaque route file.
