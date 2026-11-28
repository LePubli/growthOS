# Module E-réputation & SEO/GEO — GrowthOS

Module de pilotage des campagnes d'e-réputation de l'agence, pour des **entités** (« B2B » : entreprise, établissement, marque) et des **personnes physiques** (« B2C » : particulier, dirigeant). Cadrage, règles et feuille de route : [CAHIER-DES-CHARGES.md](CAHIER-DES-CHARGES.md). Avancement : [registre §13](../REGISTRE-FONCTIONNALITES.md).

## État livré — lot 1 « fondations »

- Campagnes : création, modification partielle, statut **active / en pause / archivée**, suppression définitive.
- Cible entité ou personne physique, variantes du nom (homonymes), localisation, fonction, **lien vers une fiche CRM** (client ou prospect de la même agence).
- **Mandat RGPD obligatoire** pour une personne physique : référence, signataire, date de signature, périmètre, **fin de conservation**. Purge automatique à échéance (toutes les 6 h) et purge manuelle par un administrateur.
- **Historique des interventions** (qui, quoi, quand, valeurs avant/après), conservé après suppression ; expurgé pour une personne physique.
- **Score honnête** : `null` (« Non évalué ») tant qu'aucune mesure réelle n'existe ; moyenne globale limitée aux campagnes évaluées ; plus d'alerte recréée à chaque consultation du tableau de bord.
- Suivi SERP : saisie validée (positions 1 à 100, ou `null` = absence constatée du top 100, comptée 0 dans le score), écart calculé avec la mesure précédente réelle.
- Une campagne personne physique ne peut pas être convertie en entité (la purge RGPD et l'expurgation dépendent du type).
- La suppression ou la purge d'une campagne efface aussi ses copies dans la mémoire IA (`memory_documents` : audits, variations de score).

## Architecture

```
lib/db/src/migrate-ereputation.ts                      migration additive du lot 1 (idempotente)
artifacts/api-server/src/lib/plugin-ereputation/
  CampaignService.ts      règles métier, score, transactions
  ChangeLog.ts            historique des interventions + expurgation
  RetentionService.ts     purge RGPD des personnes à échéance
  SentimentAnalyzer.ts    analyse par liste de mots (remplacée au lot 3)
  StrategyEngine.ts       brouillons IA (fournisseur configuré)
artifacts/api-server/src/routes/v1/plugins/ereputation.ts   API /api/v1/ereputation
artifacts/api-server/src/routes/v1/client-ereputation.ts    API du portail /api/v1/client/ereputation
artifacts/growthos/src/plugins/ereputation/                 écrans agence
artifacts/growthos/src/plugins/client-portal/               écrans portail
scripts/test-ereputation.mjs                                tests d'intégration PostgreSQL
scripts/test-ereputation-ui.mjs                             tests de rendu et anti-valeurs fictives
```

Tables : `erep_campaigns` (+ colonnes du lot 1), `erep_change_log` (nouvelle), `erep_serp_tracking`, `erep_sentiment_logs`, `erep_content_posts`, `erep_audits`, `erep_pbn_sites`, `erep_alerts`, `erep_approvals`.

## Prérequis

- Node.js 22+ et pnpm 10 ; PostgreSQL 16.
- Aucune variable d'environnement spécifique au module : il utilise celles de l'API (`DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`…), voir [DEPLOYMENT.md](../../DEPLOYMENT.md).
- `GROWTHOS_SMOKE_TEST=true` désactive la purge planifiée (utilisé par les tests).

## Installation et lancement local

```bash
pnpm install --frozen-lockfile
pnpm --filter @workspace/api-server build
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/growthos pnpm --filter @workspace/api-server start
```

La migration du lot 1 s'exécute au démarrage de l'API (journal : `E-Rep foundations ready`). Elle n'efface aucune table. Elle remet à `NULL` les scores hérités **sans aucune mesure** (anciennes valeurs par défaut 50 ou 0).

## Tests

```bash
# Rendu des écrans et contrôles anti-valeurs fictives (sans base)
node scripts/test-ereputation-ui.mjs

# Intégration : crée une base jetable growthos_erep_xxxx, démarre l'API, la supprime à la fin
pnpm --filter @workspace/api-server build
EREP_POSTGRES_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres node scripts/test-ereputation.mjs
```

Les deux scripts sont exécutés par le workflow `growthos-preprod-images.yml`.

## API (lot 1)

| Méthode | Chemin | Rôle |
|---|---|---|
| GET | `/api/v1/ereputation/campaigns[?includeArchived=true]` | Liste des campagnes de l'agence |
| POST | `/api/v1/ereputation/campaigns` | Création (mandat obligatoire si `targetType=B2C`) |
| GET / PATCH / DELETE | `/api/v1/ereputation/campaigns/:id` | Lecture, modification partielle, suppression définitive |
| POST | `/api/v1/ereputation/campaigns/:id/status` | `{ "status": "active" \| "paused" \| "archived" }` |
| GET | `/api/v1/ereputation/campaigns/:id/history` | Historique (disponible après suppression) |
| POST | `/api/v1/ereputation/retention/purge` | Purge RGPD immédiate (administrateur) |
| GET / POST | `/api/v1/ereputation/campaigns/:id/serp` | Mesures SERP |
| GET | `/api/v1/ereputation/campaigns/:id/dashboard` | Score, composantes, tâches dérivées des mesures |
| GET | `/api/v1/ereputation/score-global` | Score moyen des campagnes évaluées |

Exemple — personne physique :

```bash
curl -X POST "$API/api/v1/ereputation/campaigns" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{
  "name": "Réputation Albert Ducamps", "targetType": "B2C", "targetName": "Albert Ducamps",
  "subjectAliases": ["A. Ducamps"], "subjectRole": "Dirigeant", "keywords": ["albert ducamps"],
  "mandateReference": "MAND-2026-014", "mandateSignatory": "Albert Ducamps",
  "mandateSignedAt": "2026-11-28", "retentionUntil": "2027-11-28",
  "mandateScope": "Veille et contre-mesures sur les résultats Google nominatifs"
}'
```

Réponses d'erreur : `400` validation (message en français), `404` campagne ou fiche CRM hors de l'agence, `403` purge sans rôle administrateur, `500` erreur serveur journalisée.

## Debug

- Journal API : messages `E-reputation campaign created/deleted`, `E-rep expired person campaigns purged`, `E-rep retention purge failed`.
- Contrôle SQL :
  ```sql
  SELECT id, name, target_type, status, reputation_score, retention_until FROM erep_campaigns WHERE tenant_id = '<tenant>';
  SELECT action, actor_email, changes, redacted, created_at FROM erep_change_log WHERE campaign_id = '<id>' ORDER BY created_at DESC;
  ```
- Un échec d'écriture renvoie désormais une erreur (il n'est plus ignoré silencieusement).

## Déploiement

Aucun nouveau service, conteneur ni secret. Après fusion dans `fix/growthos-functional-redesign` et publication des images `:preprod`, le propriétaire redéploie dans DockPanel (**Edit / Save avec `pull_policy: always`**). Ne pas toucher aux volumes PostgreSQL. Sur Ubuntu 24 / Coolify, la procédure reste celle de [DEPLOYMENT.md](../../DEPLOYMENT.md).

## Recette manuelle conseillée

1. Menu **SEO et réputation → Campagnes** : créer une entité liée à une fiche CRM, puis une personne physique (le bloc « Mandat RGPD » est obligatoire).
2. Modifier un champ, mettre en pause, archiver (case « Afficher les archivées »), ouvrir l'**historique**.
3. Supprimer la campagne personne : message « données personnelles purgées » ; l'historique ne contient plus de nom.
4. Vérifier qu'une campagne sans mesure affiche « Non évalué » partout (liste, tableau de bord, portail).
