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

## État livré — lot 3 « analyse et alertes »

- **Sentiment par IA** : chaque nouvelle mention (résultat, avis, article) est requalifiée par le fournisseur IA choisi par l'agence (Paramètres → IA : OpenAI, Claude, DeepSeek, Ollama) : sentiment, intensité, thèmes, gravité **critique** (accusation d'arnaque, fraude, pénal, diffamation, données personnelles). Sans fournisseur, l'analyse locale (lexique avec négations : « pas satisfait ») reste en place. La source de l'analyse est affichée ; l'agence peut **corriger** le sentiment (prioritaire, jamais écrasé). Plafond de 40 mentions par passage.
- **Score sur 100 précis et expliqué** (`ScoreModel.ts`) : résultats de recherche 40 %, sentiment des mentions 30 %, avis 20 %, liens 10 %, **renormalisé sur les seules composantes mesurées** (une composante sans donnée n'est jamais supposée).
  - SERP = moyenne de la visibilité du site de la cible et de la **tonalité de la première page** (chaque résultat du top 10 pèse 1/log2(position + 1) ; positif ou site de la cible 100, neutre 70, négatif 0).
  - Sentiment = moyenne de (score + 1) × 50, pondérée par l'ancienneté (demi-vie 60 jours), hors avis et mentions ignorées.
  - Avis = dernière note par source pondérée par le nombre d'avis, de 1–5 vers 0–100.
  - Chaque **facteur** est chiffré en points du score final (écart par rapport à un élément neutre) : « Résultat négatif critique en position 4 sur Google sur 5 requêtes (−6,2 pts) ».
  - **Résumé lisible** : score et niveau, ce qui pèse le plus, ce qui soutient le score, évolution depuis le relevé précédent par composante, composantes non mesurées signalées.
  - **Historique** : un relevé par jour (heure de Paris), courbe 90 jours dans l'écran Veille ; lien « Pourquoi ce score ? » depuis la liste des campagnes.
- **Alertes** (règles réglables par campagne) : nouvelle mention négative (regroupée par passage), mention critique, avis 1–2 étoiles, baisse de note ≥ 0,3, résultat négatif entrant dans le top 10, score sous 40 (au franchissement), baisse ≥ 10 points en 7 jours, veille bloquée par un captcha. **Dédoublonnées**, visibles dans la cloche de notifications avec lien vers la campagne, résolubles. Les relevés de référence ne déclenchent pas d'alerte « nouvelle mention ».
- **Plans de crise** : niveaux Vigilance, Alerte, Crise selon des seuils (score, mentions critiques sur 72 h, mentions négatives sur 7 jours, résultat négatif en top 3 / top 10). Le plan s'ouvre ou monte de niveau automatiquement, **ne se ferme que sur décision de l'agence**, liste des actions légitimes à cocher et attribuer (réponses validées, rectification à la source, contenus positifs, signalement officiel, **déréférencement RGPD** pour une personne, avocat pour une entité). Ouverture, escalade et clôture tracées dans l'historique.
- **Brouillons de réponse aux avis** (IA, ou modèle local) : à relire et copier ; **rien n'est publié ni envoyé automatiquement**.
- **E-mails internes** : récapitulatif quotidien (8 h) et hebdomadaire (lundi 8 h, heure de Paris), e-mail immédiat pour les alertes critiques. Destinataires : **membres de l'agence uniquement**. Un envoi par période au plus, journal des envois, aperçu et envoi de test.
- **Confidentialité** : les alertes e-réputation n'écrivent plus dans le fil « signals » de la prospection ; le rapprochement d'un compte CRM par le nom est limité aux entités ; les notifications d'une campagne sont supprimées avec elle (purge RGPD comprise).

## Architecture

```
lib/db/src/migrate-ereputation.ts                      migration additive du lot 1 (idempotente)
artifacts/api-server/src/lib/plugin-ereputation/
  CampaignService.ts      règles métier, score, transactions
  ChangeLog.ts            historique des interventions + expurgation
  RetentionService.ts     purge RGPD des personnes à échéance
  SentimentAnalyzer.ts    analyse locale (lexique, négations, gravité) : repli sans IA
  StrategyEngine.ts       brouillons IA (fournisseur configuré)
  WatchService.ts         lot 2 : réglages, file des passages, détection, planification
  FeedReader.ts           lot 2 : flux RSS/Atom (HTTPS public, IP épinglée, 2 Mo / 10 s)
  ErepAI.ts               lot 3 : sentiment par IA, correction manuelle, brouillons de réponse
  ScoreModel.ts           lot 3 : modèle du score, facteurs chiffrés et explication
  AlertService.ts         lot 3 : règles, alertes dédoublonnées, plans de crise
  ErepDigest.ts           lot 3 : récapitulatifs et e-mails immédiats internes
artifacts/api-server/src/services/email.ts                  sendInternalEmail (lot 3, SMTP de l'agence)
artifacts/growthos/src/plugins/ereputation/AlertsPanels.tsx lot 3 : score expliqué, alertes, crise, e-mails
scripts/test-ereputation-alerts.mjs                         lot 3 : intégration avec faux fournisseur IA
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

Tables : `erep_campaigns` (+ colonnes du lot 1), `erep_change_log` (nouvelle), lot 2 : `erep_watch_settings`, `erep_watch_runs`, `erep_serp_snapshots`, `erep_serp_collections`, `erep_reviews`, `erep_review_stats`, `erep_mentions`, lot 3 : `erep_score_history`, `erep_alert_settings`, `erep_crisis_plans` (toutes supprimées en cascade avec la campagne), `erep_email_settings`, `erep_email_log` (par agence), `erep_serp_tracking`, `erep_sentiment_logs`, `erep_content_posts`, `erep_audits`, `erep_pbn_sites`, `erep_alerts`, `erep_approvals`.

## Prérequis

- Node.js 22+ et pnpm 10 ; PostgreSQL 16.
- Aucune variable d'environnement spécifique au module : il utilise celles de l'API (`DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`…), voir [DEPLOYMENT.md](../../DEPLOYMENT.md).
- `GROWTHOS_SMOKE_TEST=true` désactive la purge et la veille planifiées (utilisé par les tests ; « Lancer maintenant » reste actif).
- Lot 2 : `CLOUD_BROWSER_URL` et `CLOUD_BROWSER_TOKEN` (déjà requis par la prospection). Sans eux, seule la presse est lue.
- Lot 2, facultatif : `EREP_GOOGLE_NEWS_RSS_URL` (défaut `https://news.google.com/rss/search`, ne change qu'en test).
- Lot 3, facultatif :
  - `EREP_ALERT_EMAIL_ENABLED` : `false` (défaut, aucun e-mail), `log` (recette : e-mails journalisés, rien n'envoyé), `true` (envoi par le SMTP de l'agence, Paramètres → E-mail). Indépendant de `ENABLE_OUTBOUND_EMAIL`, qui reste à `false` pour les campagnes externes.
  - `EREP_APP_URL` : adresse publique de GrowthOS (ex. `https://agile.le-publicitaire.fr`) pour les liens des e-mails ; sans elle, les e-mails n'ont pas de lien.
  - Fournisseur IA : celui de l'agence (Paramètres → IA). Sans fournisseur, l'analyse locale et les modèles de réponse s'appliquent.

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

# Lot 3 : sentiment IA, score expliqué, alertes, plans de crise, e-mails (faux fournisseur IA local, e-mails en mode journal)
EREP_POSTGRES_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres node scripts/test-ereputation-alerts.mjs
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

### API lot 3 (analyse et alertes)

| Méthode | Chemin | Rôle |
|---|---|---|
| GET | `/api/v1/ereputation/campaigns/:id/score` | Score, composantes (valeur, poids, points), facteurs chiffrés, résumé, évolution, historique 90 jours |
| PATCH | `/api/v1/ereputation/mentions/:mentionId` | `{ "status"?, "sentiment"?: "pos" \| "neg" \| "neu", "critical"?: true }` — qualification et correction manuelle |
| GET | `/api/v1/ereputation/alerts?campaignId=&open=1` | Alertes de l'agence |
| PATCH | `/api/v1/ereputation/alerts/:alertId` | `{ "resolved": true \| false }` |
| GET / PUT | `/api/v1/ereputation/campaigns/:id/alert-rules` | Règles d'alerte et seuils de crise (valeurs par défaut renvoyées) |
| GET | `/api/v1/ereputation/campaigns/:id/crisis` | Niveau mesuré et raisons, plan ouvert, plans clôturés |
| POST | `/api/v1/ereputation/campaigns/:id/crisis/evaluate` | Réévaluation immédiate des seuils |
| PATCH | `/api/v1/ereputation/crisis/:planId/actions/:actionId` | `{ "done"?, "assigneeId"? }` (membre de l'agence) |
| POST | `/api/v1/ereputation/crisis/:planId/close` | `{ "note"? }` — clôture décidée par l'agence |
| POST | `/api/v1/ereputation/reviews/:reviewId/reply-draft` | Brouillon de réponse (jamais publié) |
| GET / PUT | `/api/v1/ereputation/alert-email` | Réglages e-mail et membres de l'agence |
| GET | `/api/v1/ereputation/alert-email/preview?kind=daily\|weekly` | Aperçu HTML du récapitulatif |
| POST | `/api/v1/ereputation/alert-email/test` · `/send-now` | Envoi de test · envoi de la période (administrateur, une fois au plus) |

```bash
curl "$API/api/v1/ereputation/campaigns/$ID/score" -H "Authorization: Bearer $TOKEN" | jq '.summary'
curl -X PUT "$API/api/v1/ereputation/campaigns/$ID/alert-rules" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{ "scoreLow": 45, "negativeSerpTop": 10, "crisis": { "alertScore": 55, "crisisScore": 40, "criticalCrisis": 3 } }'
curl -X PUT "$API/api/v1/ereputation/alert-email" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{ "daily": true, "weekly": true, "immediateCritical": true, "recipients": ["<id utilisateur de l agence>"] }'
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
- Lot 3 : journaux `E-rep AI sentiment analysis`, `E-rep alert evaluation failed`, `E-rep digest failed`, `[email] Mode journal — e-mail interne non envoyé`.
  ```sql
  SELECT type, severity, title, dedup_key, is_resolved, emailed_at, created_at FROM erep_alerts WHERE campaign_id = '<id>' ORDER BY created_at DESC LIMIT 20;
  SELECT day, score, components FROM erep_score_history WHERE campaign_id = '<id>' ORDER BY day DESC LIMIT 10;
  SELECT level, status, reasons, opened_at, closed_at FROM erep_crisis_plans WHERE campaign_id = '<id>';
  SELECT kind, period_key, status, error, sent_at FROM erep_email_log WHERE tenant_id = '<tenant>' ORDER BY sent_at DESC LIMIT 10;
  ```
- Mentions restées « analyse locale » : aucun fournisseur IA sélectionné pour l'agence, clé absente, ou deux réponses illisibles du modèle (repli local définitif).
- Aucun e-mail : `EREP_ALERT_EMAIL_ENABLED` absent ou `false`, SMTP de l'agence incomplet, aucun destinataire coché, ou récapitulatif quotidien sans événement (« rien à signaler »).
- Étape « ignorée » : profil navigateur manquant pour la source ou navigateur cloud non configuré. Passage resté « En file » : une collecte prospect occupe le navigateur (message explicite), il reprend seul.

## Déploiement

Lot 1 : aucun nouveau service, conteneur ni secret. **Lot 2 : aucun nouveau service ni secret, mais les images `api`, `web` et `browser` changent** (route `/erep-collect` ajoutée au worker navigateur) : redéployer la stack entière sur le même SHA. Après fusion dans `fix/growthos-functional-redesign` et publication des images `:preprod`, le propriétaire redéploie dans DockPanel (**Edit / Save avec `pull_policy: always`**). Ne pas toucher aux volumes PostgreSQL. Sur Ubuntu 24 / Coolify, la procédure reste celle de [DEPLOYMENT.md](../../DEPLOYMENT.md).

Lot 3 : aucun nouveau service ; images `api` et `web` modifiées (worker navigateur inchangé). Variables facultatives à ajouter au service `api` si souhaité : `EREP_ALERT_EMAIL_ENABLED` (`log` pour la recette, `true` ensuite) et `EREP_APP_URL`. Sans elles, tout fonctionne sauf l'envoi d'e-mails.

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

Lot 3 :
1. Paramètres → IA : vérifier le fournisseur choisi. Relancer une veille : le fil affiche « analyse IA », des thèmes, et « Critique » pour une accusation grave.
2. Écran Veille → **Score de réputation expliqué** : lire le résumé, les points par composante et par facteur ; vérifier qu'une composante sans donnée est marquée « Non mesuré ».
3. Corriger le sentiment d'une mention (liste à droite) : le score et, si « Critique », une alerte suivent.
4. Cloche de notifications : les alertes renvoient vers la campagne. Les marquer « traitées ».
5. Plan de crise : cocher une action, l'attribuer, puis clôturer avec une note ; l'historique de la campagne trace l'ouverture et la clôture.
6. Avis négatif : « Préparer une réponse », relire, copier ; rien n'est publié.
7. E-mails : avec `EREP_ALERT_EMAIL_ENABLED=log`, cocher un destinataire et « Envoyer un test » (journal API) ; passer à `true` une fois le SMTP de l'agence vérifié.
