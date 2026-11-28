# E-réputation & SEO/GEO — cahier des charges validé

> Cadrage validé par le propriétaire le 28/11/2026 dans le fil de l'agent 3 (périmètre **e-réputation B2B et B2C**). Ce document est la référence durable du module. L'avancement par fonction est tenu dans [docs/REGISTRE-FONCTIONNALITES.md](../REGISTRE-FONCTIONNALITES.md) (lignes `REP-*`) et les interventions dans [COORDINATION-AGENTS.md](../../COORDINATION-AGENTS.md).

## 1. Objectif

Plateforme pilotée **par l'agence** (les clients finaux ne se connectent pas pour l'instant) pour gérer des campagnes d'e-réputation et de SEO/GEO centrées sur :

- une **personne physique** (dite « B2C » dans l'interface et l'API : particulier, dirigeant, élu, professionnel — ex. « Monsieur Albert Ducamps ») ;
- une **entité** (dite « B2B » : entreprise, établissement, marque, association).

Les campagnes servent **aux clients de l'agence** (service vendu) **et aux prospects** (diagnostic de réputation comme argument commercial). Une campagne peut être liée à une fiche du CRM.

Cycle complet : **surveiller** (SERP, avis, presse, réseaux, réponses des IA) → **analyser** (sentiment, score sur 100) → **agir** (contenus, profils, PBN, netlinking, réseaux sociaux, réponses) → **alerter** → **prouver** (rapports PDF, historique archivé).

## 2. Sources

| Cible | Sources prioritaires |
|---|---|
| Entité (B2B) | Sources B2B déjà utilisées par la prospection (Annuaire/INSEE, Societe.com, Pappers, BODACC, PagesJaunes, Google Maps, Google/Bing) **+ presse** (nationale, régionale, Google Actualités, RSS). |
| Personne physique (B2C) | [Catalogue fourni](CATALOGUE-SOURCES-PERSONNES-FOURNI.md) : avis, réseaux sociaux, forums, presse, publications officielles, moteurs de recherche et moteurs IA. |

**Mode de collecte :** GrowthOS collecte par lecture des pages publiques rendues dans le **navigateur cloud** (`workers/cloud-browser`, Playwright sur le VPS), avec profils publics ou connectés. L'e-réputation réutilise ce moteur et ses diagnostics. Les lecteurs propres à l'e-réputation (avis, mentions, SERP de réputation) sont ajoutés **dans des fichiers séparés** pour ne pas modifier les lecteurs de prospection de l'agent 2. Un contrôle anti-robot est signalé pour intervention humaine, jamais contourné. Une source inaccessible est enregistrée avec sa raison, jamais remplacée par une donnée inventée.

## 3. Fonctionnalités attendues (spécification du propriétaire)

1. **Campagnes** : CRUD complet (création, modification, suppression, activation/pause/archivage), audits, rapports PDF, score global sur 100 (SERP, backlinks, mentions, SEO/GEO), historique des actions pour archivage.
2. **Audits SEO/GEO** : analyse d'un site ou d'un mot-clé, stockage (score, commentaires, détails techniques), historique, stratégie IA post-audit, suggestions fondées sur les résultats antérieurs.
3. **Tableau de bord** : synthèse de toutes les campagnes, évolution des scores, checklist stratégique IA, score dynamique.
4. **Suivi SERP** : collecte des positions Google/Bing (navigateur cloud ; SerpAPI/SEMrush optionnels si clé), historisation, **détection des nouveaux résultats**, plan d'action automatique en cas de chute.
5. **Import / export** CSV et JSON, réimportable sur un autre environnement.
6. **Historique des modifications** : qui a modifié quoi et quand, archivage des interventions.
7. **PBN** (réseau de sites appartenant à l'agence) : sites avec DA/PA, publication d'articles sur ces sites (WordPress), suivi des backlinks (date, ancre, statut actif/brisé).
8. **Netlinking** : opportunités de liens (forums, profils, annuaires), vérification régulière des liens, ajustement des campagnes en cas de stagnation.
9. **Réseaux sociaux** : multi-comptes (Facebook, LinkedIn, X, Instagram, Pinterest, Reddit), calendrier glisser-déposer, publication (API officielles), statistiques, réponses aux mentions, sentiment.
10. **Sentiment** : positif/négatif/neutre par IA (fournisseurs configurés : OpenAI, Claude, DeepSeek, Ollama) avec repli local, brouillons de réponses.
11. **Reporting unifié** : SEO/GEO + social + sentiment, graphiques, PDF, export horodaté.
12. **Publication multiplateforme** (Facebook, LinkedIn, X, Instagram, Medium, Telegram, Threads) avec reprise sur échec (jeton expiré, quota).
13. **Notifications temps réel** (mention négative, audit terminé, publication échouée) **et e-mail**, rythme **quotidien et hebdomadaire** ; plans de crise selon seuils.
14. **Visibilité IA / GEO** (ce que les moteurs IA disent d'une entité ou d'une personne) : interrogations répétées et journalisées.
15. **Application mobile** : reportée (« on verra plus tard »).

## 4. Règles fixées par le propriétaire

- **Pas de spam de sites tiers** : aucune création automatique de comptes ni de publication automatique de liens sur des forums, profils ou annuaires de tiers. Le netlinking propose des opportunités et des brouillons ; la publication est faite ou validée par un humain. La **création assistée de profils légitimes au nom du client** (profils officiels sur plateformes à forte autorité) est prévue, au choix de l'agence, avec validation humaine.
- **Aucun faux avis**, aucune fausse note, aucun témoignage fabriqué. Les réponses sont publiées depuis les comptes du client, après validation.
- **PBN conservé** comme fonction de l'agence, sur des sites qu'elle possède. Risque documenté : Google sanctionne les réseaux de liens détectés, et c'est le site du client qui en subit les effets.
- **Personnes physiques (RGPD)** : une campagne sur une personne exige un **mandat** enregistré (référence, signataire, date, périmètre) et une **date de fin de conservation**. À échéance, les données collectées sont purgées automatiquement et l'historique est expurgé. Non optionnel.
- **Preuve** : les exports sont horodatés et signés par empreinte ; ils ne sont pas présentés comme ayant une valeur probante qualifiée (horodatage qualifié eIDAS ou constat d'huissier nécessaires).
- Aucun chiffre, score, position ou avis inventé : une mesure absente s'affiche « non évalué ».

## 5. Stratégie de contre-mesure (enfouissement des résultats négatifs)

Objectif : faire reculer dans Google les résultats négatifs visant une personne ou une entité, par des moyens que la plateforme mesure.

1. **Cartographier** : SERP de la requête nominative (nom, nom + ville, nom + fonction), Google et Bing, desktop/mobile ; qualifier chaque résultat (positif, neutre, négatif, propriétaire, tiers) et suivre sa position dans le temps.
2. **Occuper la première page avec des actifs contrôlés** : site officiel et pages dédiées, profils officiels sur plateformes à forte autorité (LinkedIn, Google Business Profile, réseaux sociaux, annuaires professionnels, Wikidata si éligible), création **assistée** et validée.
3. **Renforcer ces actifs** : contenus réguliers, communiqués, interviews, tribunes, PBN de l'agence et liens internes, optimisation des pages existantes (titres, balisage, entité).
4. **Traiter à la source quand le droit le permet** : droit de réponse, demande de rectification ou de retrait à l'éditeur, **demande de déréférencement** (droit à l'oubli, formulaire Google), signalement de contenus illicites ; modèles de courriers et suivi des demandes.
5. **Mesurer et ajuster** : position de chaque résultat négatif, part de la première page détenue, alertes en cas de remontée, plan d'action revu si stagnation.

## 6. Découpage en lots (validé)

| Lot | Contenu | État |
|---|---|---|
| 1 | Fondations : nettoyage des fausses données, CRUD complet, cible personne/entité liée au CRM, historique des modifications, mandat RGPD et purge, cahier des charges | **En cours** (branche `claude/project-thread-i6xqwe`) |
| 2 | Veille : SERP Google/Bing + nouveaux résultats, avis Google Maps et PagesJaunes, presse, collectes quotidiennes/hebdomadaires, sources du catalogue | À faire |
| 3 | Analyse et alertes : sentiment IA, score historisé, notifications + e-mail, plans de crise | À faire |
| 4 | Audits SEO/GEO, stratégie et checklist IA, visibilité dans les moteurs IA | À faire |
| 5 | Reporting PDF, import/export CSV/JSON, export horodaté | À faire |
| 6 | PBN (publication WordPress, backlinks) et netlinking (opportunités, profils assistés) | À faire |
| 7 | Réseaux sociaux multi-comptes, calendrier (design avec l'agent 1), publication, statistiques | À faire |
| 8 | Application mobile | Reporté |

## 7. Coordination

- Agent 1 (design) : pages `artifacts/growthos/src/plugins/ereputation/*`, `plugins/client-portal/*`, menu `AppShell.tsx`, routes `App.tsx`. L'agent 3 ne fait que du raccordement fonctionnel avec les composants et variables de thème existants ; toute refonte visuelle passe par l'agent 1.
- Agent 2 (prospection B2B, CRM, API, navigateur cloud, extension Chrome) : `lib/db/src/migrate.ts`, `routes/v1/index.ts`, `workers/cloud-browser/*`, services d'enrichissement et BODACC. L'agent 3 ajoute ses migrations dans `lib/db/src/migrate-ereputation.ts` et ses lecteurs dans des fichiers séparés ; toute modification de fichier de l'agent 2 est annoncée dans `COORDINATION-AGENTS.md`.
