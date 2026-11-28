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

## État livré — lot 2 « veille »

- **Réglages par campagne** (écran **SEO et réputation → Veille**) : moteurs Google / Bing, requêtes générées (nom exact, variantes, lieu, fonction, mots-clés, sites d'avis pour une entité, réseaux et annuaires de dirigeants pour une personne) + requêtes libres, fiche Google Maps, fiche PagesJaunes, Google Actualités, flux RSS de presse.
- **SERP** : top 20 chaque nuit, top 50 le dimanche (réglables de 10 à 100). Chaque relevé est conservé ; un second relevé signale les **nouveaux résultats**, les **disparus** et les **déplacés**. Si l'URL de la cible est renseignée, sa position alimente le suivi SERP et le score.
- **Avis** : note, volume et derniers avis Google Maps (tri « plus récents ») et PagesJaunes, sans doublon (l'empreinte ignore la date relative « il y a 2 jours »). Les avis et articles alimentent la composante « mentions » du score.
- **Presse** : Google Actualités (flux RSS public) et flux RSS ajoutés par l'agence, filtrés sur le nom de la cible.
- **Fil des mentions** : résultats, avis et articles, avec sentiment provisoire (liste de mots ; IA au lot 3), repère « Nouveau » / « Référence » (premier passage), qualification « à traiter / qualifiée / ignorée ».
- **Planification** : créneau de nuit 3 h – 6 h (heure de Paris), décalé par campagne ; « Lancer maintenant » ; une seule veille active par campagne.
- **Navigateur cloud partagé** : la veille utilise les profils navigateur déjà créés par l'agence (Prospection → Navigateur cloud). Elle **laisse la priorité à la prospection** (aucune étape navigateur tant qu'une collecte prospect est en file ou en cours ; nouvel essai 2 min plus tard). Un contrôle de sécurité ou de consentement n'est **jamais contourné** : le passage indique « Vérification requise », l'opérateur l'effectue dans la vue navigateur puis clique « Reprendre » (seules les étapes en attente sont rejouées).

## Architecture

```
lib/db/src/migrate-ereputation.ts                      migration additive du lot 1 (idempotente)
artifacts/api-server/src/lib/plugin-ereputation/
  CampaignService.ts      règles métier, score, transactions
  ChangeLog.ts            historique des interventions + expurgation
  RetentionService.ts     purge RGPD des personnes à échéance
  SentimentAnalyzer.ts    analyse par liste de mots (remplacée au lot 3)
  StrategyEngine.ts       brouillons IA (fournisseur configuré)
  WatchService.ts         lot 2 : réglages, file des passages, détection, planification
  FeedReader.ts           lot 2 : flux RSS/Atom (HTTPS public, IP épinglée, 2 Mo / 10 s)
workers/cloud-browser/erep.mjs                              lot 2 : lecteurs SERP et avis (route /erep-collect)
workers/cloud-browser/erep-test.mjs                         lot 2 : lecteurs testés dans un vrai Chromium
scripts/test-ereputation-watch.mjs                          lot 2 : intégration avec faux navigateur et faux flux
artifacts/api-server/src/routes/v1/plugins/ereputation.ts   API /api/v1/ereputation
artifacts/api-server/src/routes/v1/client-ereputation.ts    API du portail /api/v1/client/ereputation
artifacts/growthos/src/plugins/ereputation/                 écrans agence
artifacts/growthos/src/plugins/client-portal/               écrans portail
scripts/test-ereputation.mjs                                tests d'intégration PostgreSQL
scripts/test-ereputation-ui.mjs                             tests de rendu et anti-valeurs fictives
```

Tables : `erep_campaigns` (+ colonnes du lot 1), `erep_change_log` (nouvelle), lot 2 : `erep_watch_settings`, `erep_watch_runs`, `erep_serp_snapshots`, `erep_serp_collections`, `erep_reviews`, `erep_review_stats`, `erep_mentions` (toutes supprimées en cascade avec la campagne), `erep_serp_tracking`, `erep_sentiment_logs`, `erep_content_posts`, `erep_audits`, `erep_pbn_sites`, `erep_alerts`, `erep_approvals`.

## Prérequis

- Node.js 22+ et pnpm 10 ; PostgreSQL 16.
- Aucune variable d'environnement spécifique au module : il utilise celles de l'API (`DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`…), voir [DEPLOYMENT.md](../../DEPLOYMENT.md).
- `GROWTHOS_SMOKE_TEST=true` désactive la purge et la veille planifiées (utilisé par les tests ; « Lancer maintenant » reste actif).
- Lot 2 : `CLOUD_BROWSER_URL` et `CLOUD_BROWSER_TOKEN` (déjà requis par la prospection). Sans eux, seule la presse est lue.
- Lot 2, facultatif : `EREP_GOOGLE_NEWS_RSS_URL` (défaut `https://news.google.com/rss/search`, ne change qu'en test).

## Installation et lancement local

```bash
pnpm install --frozen-lockfile
pnpm --filter @workspace/api-server build
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/growthos pnpm --filter @workspace/api-server start
```

La migration des lots 1 et 2 s'exécute au démarrage de l'API (journal : `E-Rep foundations ready`). Elle n'efface aucune table. Elle remet à `NULL` les scores hérités **sans aucune mesure** (anciennes valeurs par défaut 50 ou 0).

## Tests

```bash
# Rendu des écrans et contrôles anti-valeurs fictives (sans base)
node scripts/test-ereputation-ui.mjs

# Intégration : crée une base jetable growthos_erep_xxxx, démarre l'API, la supprime à la fin
pnpm --filter @workspace/api-server build
EREP_POSTGRES_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres node scripts/test-ereputation.mjs

# Lot 2 : veille (faux navigateur et faux Google Actualités locaux)
EREP_POSTGRES_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres node scripts/test-ereputation-watch.mjs

# Lot 2 : lecteurs SERP / avis dans un vrai Chromium sur pages de recette
node workers/cloud-browser/erep-test.mjs
```

Ces scripts sont exécutés par le workflow `growthos-preprod-images.yml` (le test Chromium dans l'image `browser`).

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

### API lot 2 (veille)

| Méthode | Chemin | Rôle |
|---|---|---|
| GET / PUT | `/api/v1/ereputation/campaigns/:id/watch` | Réglages, requêtes générées, profils navigateur disponibles, dernier passage |
| POST | `/api/v1/ereputation/campaigns/:id/watch/run` | « Lancer maintenant » (`{ "depth": 10..100 }` facultatif) → 202 ; 409 si une veille est active ou la campagne n'est pas active |
| GET | `/api/v1/ereputation/campaigns/:id/watch/runs` | 20 derniers passages, étapes et statistiques |
| POST | `/api/v1/ereputation/watch/runs/:runId/resume` · `/cancel` | Reprendre après vérification · annuler une veille en file |
| GET | `/api/v1/ereputation/campaigns/:id/mentions?status=new&kind=serp` | Fil des mentions et compteurs |
| PATCH | `/api/v1/ereputation/mentions/:mentionId` | `{ "status": "new" \| "qualified" \| "ignored" }` |
| GET | `/api/v1/ereputation/campaigns/:id/watch/serp` | Dernier relevé par moteur et requête (`is_new`, `previous_position`) |
| GET | `/api/v1/ereputation/campaigns/:id/reviews` | Note / volume par source et avis relevés |

```bash
curl -X PUT "$API/api/v1/ereputation/campaigns/$ID/watch" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{
  "engines": ["google_search", "bing"], "frequency": "daily", "dailyDepth": 20, "weeklyDepth": 50,
  "mapsUrl": "https://www.google.com/maps/place/Acme+Lille/...", "pagesjaunesUrl": "https://www.pagesjaunes.fr/pros/12345678",
  "newsEnabled": true, "rssFeeds": ["https://www.lavoixdunord.fr/rss"], "extraQueries": ["acme lille travaux"]
}'
curl -X POST "$API/api/v1/ereputation/campaigns/$ID/watch/run" -H "Authorization: Bearer $TOKEN"
```

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
- Veille : journaux `E-rep watch run queued/finished`, `E-rep watch step failed` ; côté worker, les erreurs de `/erep-collect` suivent le format `cloud-worker` existant.
  ```sql
  SELECT id, kind, status, message, stats, not_before FROM erep_watch_runs WHERE campaign_id = '<id>' ORDER BY created_at DESC LIMIT 5;
  SELECT engine, query, position, url FROM erep_serp_snapshots WHERE campaign_id = '<id>' ORDER BY captured_at DESC, position LIMIT 30;
  ```
- Étape « ignorée » : profil navigateur manquant pour la source ou navigateur cloud non configuré. Passage resté « En file » : une collecte prospect occupe le navigateur (message explicite), il reprend seul.

## Déploiement

Lot 1 : aucun nouveau service, conteneur ni secret. **Lot 2 : aucun nouveau service ni secret, mais les images `api`, `web` et `browser` changent** (route `/erep-collect` ajoutée au worker navigateur) : redéployer la stack entière sur le même SHA. Après fusion dans `fix/growthos-functional-redesign` et publication des images `:preprod`, le propriétaire redéploie dans DockPanel (**Edit / Save avec `pull_policy: always`**). Ne pas toucher aux volumes PostgreSQL. Sur Ubuntu 24 / Coolify, la procédure reste celle de [DEPLOYMENT.md](../../DEPLOYMENT.md).

## Recette manuelle conseillée

1. Menu **SEO et réputation → Campagnes** : créer une entité liée à une fiche CRM, puis une personne physique (le bloc « Mandat RGPD » est obligatoire).
2. Modifier un champ, mettre en pause, archiver (case « Afficher les archivées »), ouvrir l'**historique**.
3. Supprimer la campagne personne : message « données personnelles purgées » ; l'historique ne contient plus de nom.
4. Vérifier qu'une campagne sans mesure affiche « Non évalué » partout (liste, tableau de bord, portail).

Lot 2 :
1. Prospection → Navigateur cloud : créer (si absent) un profil Google, Bing, Google Maps et PagesJaunes, ouvrir chacun une fois et accepter le consentement.
2. Campagnes → icône **Veille** d'une entité : coller sa fiche Google Maps complète et sa fiche PagesJaunes, enregistrer.
3. « Lancer maintenant » : le passage se termine (ou indique « Vérification requise » → effectuer le contrôle dans le navigateur → « Reprendre »).
4. Vérifier le relevé Google/Bing, la note Maps et les avis, les articles Google Actualités dans le fil.
5. Relancer le lendemain (ou manuellement) : les nouveaux résultats sont marqués « Nouveau ». Qualifier / ignorer une mention.
