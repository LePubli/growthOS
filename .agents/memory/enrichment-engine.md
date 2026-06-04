---
name: Data Enrichment Engine
description: Plugin 11 — moteur d'enrichissement multi-sources B2B complet
---

# Data Enrichment Engine (Plugin 11)

## Architecture

**DB (5 tables)** — migrées via `runEnrichmentMigration()` au démarrage:
- `enrichment_api_configs` — config des 23 sources (clé, secret, is_active)
- `enrichment_data` — données enrichies par prospect/source/type
- `enrichment_signals` — signaux faibles détectés
- `enrichment_cache` — cache (géré en mémoire Map en pratique)
- `enrichment_history` — log de chaque enrichissement

**Service** — `artifacts/api-server/src/lib/plugin-enrichment/EnrichmentEngine.ts`
- 23 sources: 15 gratuites + 8 payantes (clé API optionnelle)
- Sources gratuites: Pappers, INSEE, BODACC, Google Maps/Search/News, Pages Jaunes, Societe.info, WTJ, Indeed, APEC, Twitter, Facebook, Instagram, Site web entreprise
- Sources payantes: LinkedIn, Dropcontact, Infogreffe, Crunchbase, Dealroom, Wappalyzer, Hunter.io, Apollo.io
- Mocks réalistes quand pas de clé API configurée
- Rate limiting in-memory (Map sourceId→nextAllowed)
- Cache in-memory (Map key→{value,expiresAt}) — 1h TTL
- Retry 3x avec exponential backoff (2s, 4s, 8s)
- Timeout 10s par source via AbortController
- `detectSignals()`: 6 types (hiring, funding, leadership_change, tech_investment, media_positive, expansion)
- `calculateLeadScore()`: 0-100 depuis résultats + signaux
- `interconnectWithPlugins()`: injecte dans Memory, Signals, Account Metrics

**Routes** — `GET|POST /enrich/*` (montées dans v1/index.ts):
- `POST /enrich/:prospectId` — enrichissement complet
- `POST /enrich/batch` — batch async (fire and forget)
- `GET /enrich/sources` — liste 23 sources + statut config
- `PUT /enrich/api-config/:sourceId` — sauvegarder clé API
- `POST /enrich/test-connection/:sourceId` — tester connexion
- `GET /enrich/data/:prospectId` — données enrichies
- `GET /enrich/history/:prospectId` — historique

**UI** — `artifacts/growthos/src/pages/EnrichmentPage.tsx`:
- Onglet "Configuration APIs": liste des 23 sources par catégorie, toggle actif/inactif, saisie clé API, test connexion
- Onglet "Enrichissement": recherche prospect, bouton "Enrichir maintenant", score + stats + signaux + données par onglet (Légal/Financier/Digital/Social/Actualités/Emploi/Organigramme)
- Onglet "Signaux": signaux détectés dans la session en cours

**Navigation**: `/enrichment` dans section Sourcing de AppShell, icône `Database` de lucide-react

## "Géocoder tous" button (ProspectsPage)

Apparaît uniquement quand filtre `noGeo` actif + prospects visibles.
Barre ambrée avec barre de progression + bouton "Géocoder tous" → `geocodeAll()` 
→ PATCH chaque prospect avec son adresse, 1.3s entre chaque (Nominatim ToS).

**Why:** séquence respectant le rate limit Nominatim (1 req/s); le backend déclenche le géocodage automatiquement quand address est fourni sans lat/lng.
