# GrowthOS — Documentation Complète des Fonctionnalités

> **GrowthOS** est une plateforme Sales & Growth Intelligence tout-en-un, conçue pour les équipes commerciales B2B. Elle centralise la gestion CRM, l'automatisation IA, la veille commerciale et l'analytics revenue dans une interface unifiée.

---

## Table des matières

1. [Dashboard Principal](#1-dashboard-principal)
2. [Gestion des Prospects](#2-gestion-des-prospects)
3. [Gestion des Comptes (Account 360°)](#3-gestion-des-comptes-account-360)
4. [Pipeline de Vente](#4-pipeline-de-vente)
5. [AI SDR — Copilot de Prospection](#5-ai-sdr--copilot-de-prospection)
6. [AI Deal Coach](#6-ai-deal-coach)
7. [Revenue Intelligence](#7-revenue-intelligence)
8. [Signal Intelligence — Radar Commercial](#8-signal-intelligence--radar-commercial)
9. [Growth Memory — Second Brain](#9-growth-memory--second-brain)
10. [Meeting Intelligence](#10-meeting-intelligence)
11. [Knowledge Base — Playbooks](#11-knowledge-base--playbooks)
12. [Enrichissement de Données](#12-enrichissement-de-données)
13. [Sourcing & Scraping](#13-sourcing--scraping)
14. [Séquences d'Emails](#14-séquences-demails)
15. [Templates de Messages](#15-templates-de-messages)
16. [Activités CRM](#16-activités-crm)
17. [Analytics & Rapports](#17-analytics--rapports)
18. [Executive Command Center](#18-executive-command-center)
19. [Cartographie Terrain (Map)](#19-cartographie-terrain-map)
20. [Import CSV](#20-import-csv)
21. [Workflows Automatisés](#21-workflows-automatisés)
22. [Webhooks](#22-webhooks)
23. [Calendrier](#23-calendrier)
24. [Propositions Commerciales](#24-propositions-commerciales)
25. [Contacts & Intelligence Contact](#25-contacts--intelligence-contact)
26. [CRM Sync & Mapping](#26-crm-sync--mapping)
27. [ABM — Account Based Marketing](#27-abm--account-based-marketing)
28. [Inbound](#28-inbound)
29. [AI Agent Chat](#29-ai-agent-chat)
30. [Marketplace de Plugins](#30-marketplace-de-plugins)
31. [Système de Plugins](#31-système-de-plugins)
32. [Administration & Audit](#32-administration--audit)
33. [Thèmes & Personnalisation](#33-thèmes--personnalisation)
34. [Paramètres](#34-paramètres)
35. [Clés API & Sécurité](#35-clés-api--sécurité)

---

## 1. Dashboard Principal

**Route :** `/dashboard`

Le dashboard est la page d'accueil personnalisable de GrowthOS. Il offre une vue synthétique de l'ensemble de l'activité commerciale en temps réel.

### Fonctionnalités

#### Widgets KPI (personnalisables)
Le dashboard dispose de **7 widgets KPI** que l'utilisateur peut afficher ou masquer librement :

| Widget | Description |
|--------|-------------|
| **Total Prospects** 👥 | Nombre total de prospects dans le système |
| **Pipeline (€)** 💰 | Valeur totale du pipeline commercial |
| **CA Gagné (€)** 🏆 | Chiffre d'affaires des deals fermés gagnés |
| **Taux de Conversion** 🎯 | Ratio deals gagnés / prospects totaux |
| **Signaux Non Lus** ⚡ | Nombre de signaux d'intention non lus |
| **Séquences Actives** 📧 | Nombre de séquences email en cours |
| **Taux d'Ouverture** 📊 | Taux d'ouverture des emails envoyés |

#### Mode Personnalisation
- Ajout/suppression de widgets via un panneau dédié
- Chaque widget est cliquable et redirige vers la section correspondante

#### Widget Revenue Intelligence
Mini-tableau de bord financier intégré affichant :
- **Forecast 90 jours** — Valeur pondérée du pipeline à 90 jours
- **Win Rate** — Taux de victoire global
- **Pipeline total** — Valeur pipeline en cours
- **Deals à risque** — Nombre de deals en danger (avec alerte rouge)

#### Santé des Comptes (Top 5)
Affiche les 5 comptes avec les meilleurs Health Scores avec :
- Score numérique (0–100)
- Barre de progression colorée (vert/bleu/orange/rouge)
- Accès direct à la fiche compte

#### Sections de la page principale
- **Pipeline** — Répartition par étape avec comptage et valeur
- **Prospects récents** — Liste des 6 derniers prospects ajoutés avec score de propensité
- **Actions rapides** — Raccourcis : nouveau prospect, séquence, scraping, signaux, plugins
- **Statut système** — État API, PostgreSQL, Redis, Plugins VM
- **Fil d'activité récente** — Événements CRM (deals gagnés, emails ouverts, appels, notes, signaux)
- **Performance hebdomadaire** — Barres de progression : emails envoyés, appels, prospects, deals, RDV

#### Autres fonctionnalités
- **Salutation contextuelle** — Adapte le message selon l'heure (Bonjour / Bon après-midi / Bonsoir)
- **Bouton Rafraîchir** — Actualisation manuelle des statistiques
- **Onboarding Wizard** — Assistant de démarrage pour les nouveaux utilisateurs

---

## 2. Gestion des Prospects

**Route :** `/prospects` | `/prospects/:id`

Module central de gestion de la base de contacts commerciaux.

### Fonctionnalités

#### Liste des Prospects
- Tableau paginé avec colonnes configurables
- **Recherche full-text** sur nom, email, entreprise
- **Filtres avancés** : statut, score, tag, date
- Affichage du score de propensité (0–100)
- Indicateurs de statut colorés

#### Fiche Prospect Détaillée (`/prospects/:id`)
- **Informations générales** : nom, prénom, email, téléphone, poste, entreprise
- **Score de propensité** avec jauge visuelle
- **Timeline d'activité** — historique complet des interactions
- **Notes** — bloc-notes libre associé au prospect
- **Séquences actives** — séquences email liées
- **Deals associés** — liens vers le pipeline

#### Actions sur les Prospects
- Création manuelle de prospects
- Édition en ligne
- **Import en masse** via CSV (`/import`)
- **Import depuis les signaux** — conversion signal → prospect en 1 clic
- **Enrichissement automatique** — lancement de l'enrichissement data
- Assignation à un commercial
- Archivage / suppression

#### Création Rapide
Formulaire de création rapide avec champs obligatoires et validation en temps réel.

---

## 3. Gestion des Comptes (Account 360°)

**Route :** `/accounts` | `/accounts/:name`

Vue complète et enrichie des entreprises/comptes clients.

### Fonctionnalités

#### Vue 360° du Compte (`/accounts/:name`)
- **Profil complet** : nom, domaine, secteur, taille, localisation
- **Health Score** — Score de santé calculé dynamiquement (0–100)
  - Vert ≥ 75 : compte sain
  - Bleu ≥ 50 : à surveiller
  - Orange ≥ 25 : risque modéré
  - Rouge < 25 : risque critique
- **Contacts associés** — liste des prospects de ce compte
- **Deals en cours** — pipeline actif lié au compte
- **Activités récentes** — emails, appels, réunions, notes
- **Signaux d'intention** — signaux détectés sur ce compte
- **Mémos et notes** — annotations libres

#### Calcul du Health Score
Le score est calculé automatiquement en prenant en compte :
- Activité récente (derniers contacts)
- Engagement email
- Progression dans le pipeline
- Signaux d'intention positifs/négatifs

#### Actions Disponibles
- Rafraîchissement manuel du score
- Lancement d'un enrichissement
- Ajout de contacts
- Création de deal directement depuis le compte

---

## 4. Pipeline de Vente

**Route :** `/pipeline` | `/pipeline?stage=:stage` | `/deals/:id`

Gestion visuelle du cycle de vente avec vue Kanban et liste.

### Étapes du Pipeline

| Étape | Couleur | Description |
|-------|---------|-------------|
| **Lead** | Gris | Opportunité identifiée non qualifiée |
| **Qualifié** | Bleu | Besoin confirmé, budget validé |
| **Proposition** | Violet | Offre envoyée au prospect |
| **Négociation** | Orange | En cours de finalisation |
| **Gagné** ✅ | Vert | Deal conclu |
| **Perdu** ❌ | Rouge | Opportunité perdue |

### Fonctionnalités

#### Vue Kanban
- Colonnes par étape de vente
- Drag & drop pour déplacer les deals
- Valeur totale par colonne
- Badge de count par étape

#### Fiche Deal (`/deals/:id`)
- Titre, entreprise associée, valeur, étape
- **Probabilité de closing** (%)
- **Health Score** du deal (calculé par le Deal Coach)
- **Facteurs de risque** détectés automatiquement
- Historique des modifications
- Recommandations IA (si Deal Coach activé)

#### Statistiques Pipeline
- Valeur totale du pipeline
- Répartition par étape
- Deals à risque identifiés

---

## 5. AI SDR — Copilot de Prospection

**Route :** `/ai-sdr`

L'outil le plus puissant de GrowthOS pour la prospection outbound assistée par IA. Il génère des messages ultra-personnalisés en synthétisant trois sources d'intelligence : **Growth Memory**, **Account Intelligence** et **Signal Intelligence**.

### Architecture

Le Copilot SDR supporte deux moteurs LLM :
- **Ollama (local)** — génération IA locale via Ollama (`llama3.2` ou autre modèle configuré). Indicateur de statut en temps réel (connecté / hors ligne).
- **Mock LLM** — mode de démonstration si Ollama n'est pas disponible.

### Panneau de Saisie

#### Templates Rapides
Bibliothèque de templates prédéfinis :
- 🎯 Qualification initiale
- 💡 Upsell / Cross-sell
- 🔄 Réengagement de prospect froid
- 📅 Prise de RDV
- *(et plus selon la configuration)*

Chaque template pré-remplit l'objectif et le ton pour accélérer la génération.

#### Paramètres de Ciblage
- **Compte cible** — nom de l'entreprise à cibler
- **Objectif** — but de la prise de contact (ex : "book a demo meeting", "upsell feature X")
- **Ton de communication** :
  - 😊 **Chaleureux** (friendly)
  - ✌️ **Décontracté** (casual)
  - 🎩 **Professionnel** (formal)

### Onglets de Génération (3 sorties simultanées)

#### 📧 Email
Génère un email complet avec :
- **Sujet** optimisé
- **Corps du message** personnalisé
- Badge LLM indiquant le moteur utilisé
- Compteur de contexte (nb de signaux + mémoires utilisés)
- Bouton **Copier** dans le presse-papier
- Bouton **Envoyer au Workflow** — intègre le draft dans le Workflow Engine

#### 💼 LinkedIn
Génère un message LinkedIn avec :
- Message court optimisé pour LinkedIn (≤ 300 caractères)
- **Compteur de caractères** avec indicateur visuel (vert/orange/rouge)
- Bouton Copier

#### 📋 Séquence Multi-Touch
Génère une séquence de prospection complète avec :
- Nom de la séquence
- Étapes numérotées avec délai (J+0, J+3, J+7, etc.)
- Canal par étape : 📧 Email / 💼 LinkedIn / 📞 Appel
- Contenu rédigé pour chaque étape

### Flux de Génération
1. L'utilisateur saisit compte + objectif + ton
2. Clic sur "Générer les drafts"
3. Appels API parallèles vers `/ai-sdr/draft/email`, `/ai-sdr/draft/linkedin`, `/ai-sdr/sequence`
4. Le backend synthétise : signaux récents + mémoires du compte + profil account
5. Affichage des 3 drafts simultanément

### Indicateurs de Contexte
Chaque draft affiche combien de sources ont été utilisées :
- Nombre de signaux d'intention consultés
- Nombre de documents mémoire lus
- Nom du compte analysé

---

## 6. AI Deal Coach

**Route :** `/deal-coach`

Outil d'analyse et de coaching intelligent du pipeline. Détecte les deals à risque, calcule un Health Score et génère des recommandations actionnables.

### Tableau de Bord Deal Coach

#### KPIs en En-tête
- **Deals actifs** — nombre total de deals dans le pipeline
- **Score moyen** — Health Score moyen du pipeline (coloré selon la valeur)
- **À risque** — nombre de deals avec score < 40
- **Valeur à risque** — montant financier des deals en danger

#### Section Deals à Risque Critique
Mise en avant automatique des deals avec Health Score < 40, affichés en rouge avec leur facteur de risque principal.

### Health Score

Score de 0 à 100 calculé pour chaque deal :

| Plage | Couleur | Statut |
|-------|---------|--------|
| 70–100 | ✅ Vert | Sain |
| 40–69 | ⚠️ Orange | À surveiller |
| 0–39 | 🔴 Rouge | À risque |

La jauge circulaire (gauge SVG) affiche visuellement le score pour chaque deal.

### Facteurs de Risque Détectés

| Sévérité | Icône | Description |
|----------|-------|-------------|
| **Critique** | 🔴 Flamme | Risque bloquant immédiat |
| **Élevé** | 🟠 Triangle | Risque fort à traiter rapidement |
| **Moyen** | 🔵 Bouclier | Signal de vigilance |
| **Faible** | ✅ Coche | Risque mineur |

Exemples de facteurs détectés :
- Pas d'activité depuis X jours
- Absence de décideur dans le deal
- Stagnation dans une étape
- Montant anormalement élevé sans validation

### Panneau Insights (Drawer latéral)

Au clic sur un deal, un panneau s'ouvre avec :
- **Métadonnées** : phase, Health Score, valeur, date dernière analyse
- **Facteurs de risque** classés par sévérité avec détail
- **Recommandations IA** — texte généré par l'IA avec actions concrètes
- **Bouton "Analyser maintenant"** — lance une nouvelle analyse IA
- **Bouton "Draft IA"** — ouvre l'AI SDR pré-rempli avec ce compte

### Graphiques

#### Forecast Revenue
Graphique en barres (Recharts) sur 3 horizons :
- 30 jours
- 60 jours
- 90 jours

Chaque barre affiche : valeur pondérée, meilleur cas, pire cas, nombre de deals.

#### Pipeline par Étape
Vue Kanban filtrée par étape avec filtres :
- Tous / Lead / Qualifié / Proposition / Négociation

### Analyse IA

Le bouton "Analyser" déclenche :
1. Appel à `/deal-coach/deals/:id/analyze`
2. Le backend analyse le deal + contexte mémoire + signaux
3. Mise à jour du Health Score et des recommandations
4. Notification toast avec résultat

---

## 7. Revenue Intelligence

**Route :** `/revenue`

Tableau de bord financier avancé avec KPIs haute fréquence et forecasting IA.

### KPIs Principaux
- **ARR** — Annual Recurring Revenue
- **Win Rate** — Taux de victoire global (%)
- **Valeur Pipeline** — Valeur totale des opportunités actives
- **Taux de Conversion** — Du lead au deal gagné
- **Deals à Risque** — Nombre et valeur

### Forecasting IA
Prévisions sur 3 horizons temporels :
- **30 jours** — court terme
- **60 jours** — moyen terme
- **90 jours** — long terme

Pour chaque horizon :
- Valeur pondérée (par probabilité)
- Meilleur cas (best case)
- Pire cas (worst case)
- Nombre de deals concernés

### Cartes KPI (`KPICard`)
Chaque indicateur est présenté dans une carte avec :
- Valeur principale formatée
- Tendance vs période précédente (↑ / ↓)
- Graphique sparkline miniature

---

## 8. Signal Intelligence — Radar Commercial

**Route :** `/signals` | `/signals/:id`

Système de veille commerciale automatique. Surveille les événements business de vos cibles et génère des signaux d'intention scored.

### Types de Signaux

| Type | Icône | Source | Description |
|------|-------|--------|-------------|
| **Financement** | 💰 Vert | Crunchbase, Maddyness | Levées de fonds, tours de table |
| **Recrutement** | 👥 Bleu | LinkedIn, Welcome to the Jungle | Nouvelles embauches, postes ouverts |
| **Actualité** | 📰 Violet | Presse, Societe.info | Expansion, ouvertures, partenariats |
| **Technologie** | 🖥️ Orange | BuiltWith, Clearbit | Changements de stack tech |
| **Intention** | 📈 Rouge | HubSpot, Clearbit | Visites pricing, téléchargements |

### Score d'Intention

Chaque signal reçoit un score de 0 à 100 :

| Score | Label | Couleur | Priorité |
|-------|-------|---------|----------|
| 85–100 | 🔴 **Hot** | Rouge | Contacter immédiatement |
| 65–84 | 🟠 **Warm** | Orange | Contacter rapidement |
| 0–64 | 🔵 **Cold** | Gris | Surveiller |

### Interface

#### Barre de Statistiques
4 compteurs filtrables en un clic :
- Hot (80+)
- Warm (65+)
- Cold (<65)
- Non lus

#### Filtres
- **Par type** : Financement / Recrutement / Actualité / Technologie / Intention
- **Par statut** : Tous / Favoris / Non lus
- **Score minimum** : curseur slider (0–100)

#### Carte Signal
Chaque signal affiche :
- Nom de l'entreprise + type + badge non-lu
- Titre de l'événement
- Horodatage + source + tags
- Score Hot/Warm/Cold
- Actions rapides : ➕ Ajouter en prospect | 📧 Lancer séquence | ⭐ Favori | ❌ Ignorer
- Corps développable au clic

#### Actions sur les Signaux
- Marquer lu / non lu
- Tout marquer comme lu
- Ajouter en prospect (conversion directe)
- Lancer une séquence email depuis un signal
- Sélection multiple + actions en masse (ignorer, marquer lus)
- Favoris (étoile)

#### Détail Signal (`/signals/:id`)
Page dédiée avec analyse complète du signal et toutes les actions.

---

## 9. Growth Memory — Second Brain

**Route :** `/memory`

Système de mémoire sémantique centralisée. Indexe et rend recherchable toute l'information commerciale de l'entreprise (notes, emails, comptes, deals, activités).

### Concept

Growth Memory fonctionne comme un **second cerveau** pour l'équipe commerciale. Tout document indexé devient consultable par les modules IA (AI SDR, Deal Coach, Executive Assistant) pour contextualiser leurs réponses.

### Types de Sources Supportées

| Type | Icône | Couleur |
|------|-------|---------|
| **Prospect** | 👤 | Bleu |
| **Compte** | 🏢 | Violet |
| **Deal** | ⚡ | Vert |
| **Email** | 📧 | Ambre |
| **Note** | 📄 | Gris |
| **Activité** | 🕐 | Cyan |

### Statistiques
Tableau de bord en en-tête avec :
- Nombre total de documents indexés
- Répartition par type de source

### Recherche Sémantique
- Barre de recherche avec debounce (300ms)
- Recherche en temps réel sur le contenu de tous les documents
- Mise en surbrillance du terme recherché dans les résultats (marquage jaune)
- Raccourci clavier `⌘K` pour focus
- Affichage du nombre de résultats

### Indexation de Documents
Modal "Indexer un document" :
- Sélection du type de source
- Identifiant source (lien avec l'entité CRM)
- Contenu libre à mémoriser (texte long)
- Validation et indexation instantanée

### Gestion des Documents
- Affichage des 30 documents les plus récents
- Snippet des 220 premiers caractères
- Date de création / modification
- Suppression individuelle avec confirmation toast

---

## 10. Meeting Intelligence

**Route :** `/meetings` | `/meetings/:id`

Module de gestion et d'analyse des réunions commerciales.

### Liste des Réunions (`/meetings`)
- Historique de toutes les réunions enregistrées
- Date, durée, participants, compte associé
- Statut de traitement (transcrit / en attente)

### Détail Réunion (`/meetings/:id`)
- **Transcription** automatique de la réunion
- **Résumé IA** — synthèse des points clés
- **Action items** détectés automatiquement
- **Insights extraits** — signaux faibles, objections, opportunités
- **Indexation en mémoire** — le contenu est automatiquement envoyé vers Growth Memory

### Intégrations
- Liée au plugin `meeting-intelligence`
- Dépendance avec `growth-memory` pour l'indexation automatique

---

## 11. Knowledge Base — Playbooks

**Route :** `/knowledge`

Base de connaissances commerciales centralisée. Stocke et rend accessibles les playbooks, scripts de vente, guides et ressources de l'équipe.

### Fonctionnalités

#### Bibliothèque d'Articles
- Catalogue de fiches pratiques (scripts, objection handling, playbooks)
- Catégories filtrables
- Recherche full-text

#### Carte Article (`ArticleCard`)
Chaque article présente :
- Titre et catégorie
- Résumé court
- Tags associés
- Bouton de lecture complète

#### Indexation IA
Tous les articles de la Knowledge Base sont automatiquement indexés dans **Growth Memory**, rendant leur contenu disponible aux modules IA pour enrichir les réponses et suggestions.

#### Gestion des Articles
- Création et édition d'articles
- Organisation par catégorie / tag
- Versionnement

---

## 12. Enrichissement de Données

**Route :** `/enrichment`

Moteur multi-sources d'enrichissement automatique des prospects et comptes.

### Sources d'Enrichissement Supportées
Configuration via `/enrichment/sources` :
- Clearbit
- Hunter.io
- LinkedIn Sales Navigator
- Societe.info
- BuiltWith
- Et autres sources configurables

### Fonctionnalités

#### Enrichissement Individuel
- Lancement depuis la fiche prospect
- Appel à `/plugins/enrichment/:prospectId`
- Récupération automatique : email pro, téléphone, LinkedIn, taille entreprise, CA, technos utilisées

#### Enrichissement en Masse (`/enrichment/batch`)
- Sélection multiple de prospects
- Enrichissement asynchrone par lots
- Rapport de résultat (enrichis / échecs / doublons)

#### Configuration des Sources API
Interface `/enrichment/api-config/:sourceId` pour configurer :
- Clé API par source
- Priorité des sources
- Champs à récupérer prioritairement

#### Tableau de Bord Enrichissement
- Taux de couverture des champs (email, téléphone, etc.)
- Statistiques par source
- File d'attente d'enrichissement

---

## 13. Sourcing & Scraping

**Route :** `/sourcing` | `/sourcing/:jobId`

Moteur de génération automatique de leads via scraping web et bases de données.

### Création de Jobs de Scraping
Formulaire de création d'un job :
- **Critères de ciblage** : secteur, taille d'entreprise, localisation, mots-clés
- **Sources** : LinkedIn, Societe.info, annuaires sectoriels
- **Volume cible** : nombre de prospects souhaités
- **Filtres** : technologies utilisées, signaux de financement, recrutement actif

### Gestion des Jobs (`GET /sourcing/jobs`)
- Liste de tous les jobs créés
- Statut en temps réel : En attente / En cours / Terminé / Erreur
- Progression (ex : "243 / 500 prospects trouvés")
- Date de création / fin

### Résultats
- Export CSV des prospects scrapés
- Import direct dans la base de prospects
- Déduplication automatique
- Score de propensité pré-calculé

### Suppression (`DELETE /sourcing/jobs/:id`)
Suppression d'un job et de ses résultats.

---

## 14. Séquences d'Emails

**Route :** `/sequences` | `/sequences/:id` | `/sequences/new`

Moteur de séquences email multi-touch pour automatiser la prospection.

### Création de Séquence
- **Nom** et description
- **Déclencheur** (manuel, signal, tag prospect)
- **Étapes** configurables :
  - Canal : Email / LinkedIn / Appel
  - Délai entre étapes (jours)
  - Sujet et corps du message (avec variables de personnalisation)

### Variables de Personnalisation
Merge tags disponibles :
- `{{prenom}}`, `{{nom}}`, `{{entreprise}}`
- `{{poste}}`, `{{secteur}}`
- Variables personnalisées

### Gestion des Séquences
- Activation / désactivation en un clic (`POST /sequences/:id/toggle`)
- Statistiques par séquence : envois, ouvertures, réponses, désabonnements
- Vue des prospects dans chaque étape

### Événements & Tracking (`POST /sequences/:id/events`)
- Ouverture d'email trackée
- Clic sur lien
- Réponse détectée
- Désinscription

### Intégration AI SDR
Les séquences générées par l'AI SDR peuvent être directement envoyées au Workflow Engine depuis le Copilot.

---

## 15. Templates de Messages

**Route :** `/templates`

Bibliothèque de templates réutilisables pour emails, LinkedIn et appels.

### Fonctionnalités
- Création et édition de templates
- Catégorisation (prospection, relance, closing, etc.)
- Compteur d'utilisation (`POST /templates/:id/use`)
- Variables de personnalisation
- Prévisualisation avant utilisation

---

## 16. Activités CRM

**Route :** `/activities`

Journal complet de toutes les interactions commerciales.

### Types d'Activités
- 📧 **Email** envoyé / reçu
- 📞 **Appel** téléphonique
- 📅 **Rendez-vous** / Réunion
- 📄 **Note** ajoutée
- 🤝 **LinkedIn** message

### Fonctionnalités
- Création manuelle d'activité (`POST /activities`)
- Modification (`PATCH /activities/:id`)
- Filtrage par type, commercial, compte, date
- Timeline chronologique
- Lien vers prospect/compte/deal associé

---

## 17. Analytics & Rapports

**Route :** `/analytics`

Tableau de bord analytique avec graphiques et métriques de performance.

### Métriques Disponibles
- Évolution du taux de conversion (courbe temporelle)
- Volume de prospects par source
- Performance par commercial
- Taux d'ouverture / clic des séquences
- Répartition du pipeline par étape
- Durée moyenne du cycle de vente

### Graphiques
Basés sur **Recharts** (bibliothèque React) :
- Courbes de tendance
- Graphiques en barres
- Camemberts
- Barres empilées

### Métriques Team (`/team-metrics`)
- Performance individuelle par membre de l'équipe
- Comparatif objectif vs réalisé
- Activités par commercial

---

## 18. Executive Command Center

**Route :** `/executive`

Cockpit stratégique pour les dirigeants et responsables commerciaux.

### Vue d'Ensemble (`GET /executive/overview`)
- Synthèse des KPIs stratégiques
- Alertes prioritaires
- Deals en attente de décision

### AI Assistant Chat
Interface de chat conversationnel (`POST /executive/assistant/ask`) :
- Questions en langage naturel sur les données commerciales
- Réponses synthétisant pipeline, forecast, risques, performances
- Historique de la conversation
- Exemples de questions :
  - "Quel est le forecast Q4 ?"
  - "Quels deals sont à risque cette semaine ?"
  - "Compare notre performance vs le mois dernier"

### Dashboard Exécutif
Composant `CommandCenterPage` avec :
- Indicateurs clés sélectionnés pour le C-Level
- Alertes critiques (deals à risque, objectifs manqués)
- Vue consolidée du pipeline

---

## 19. Cartographie Terrain (Map)

**Route :** `/map`

Visualisation géographique des prospects et comptes sur une carte interactive.

### Fonctionnalités
- Affichage des prospects sur une carte (Google Maps / Mapbox)
- Clusters par zone géographique
- Filtrage par statut, secteur, commercial
- **Optimisation de tournées** commerciales
- Import/export de listes géolocalisées

---

## 20. Import CSV

**Route :** `/import`

Module d'import en masse de prospects depuis des fichiers CSV.

### Processus d'Import
1. **Upload** du fichier CSV
2. **Mapping de colonnes** — association des colonnes CSV aux champs GrowthOS
3. **Prévisualisation** — aperçu des premières lignes
4. **Validation** — détection des erreurs et doublons
5. **Import** — insertion en base avec rapport final

### Options d'Import
- Gestion des doublons (ignorer / écraser / fusionner)
- Assignation automatique à un commercial
- Ajout de tags au moment de l'import
- Lancement d'enrichissement post-import

---

## 21. Workflows Automatisés

**Route :** `/workflows` | `/workflows/:id`

Moteur d'automatisation des processus commerciaux.

### Création de Workflow
- **Nom** et description
- **Déclencheur** :
  - Manuel
  - Signal détecté
  - Étape pipeline atteinte
  - Prospect créé
  - Tag ajouté
- **Actions** :
  - Envoyer un email
  - Ajouter à une séquence
  - Créer une activité
  - Assigner à un commercial
  - Notifier via webhook
  - Mettre à jour un champ

### Gestion
- Activation / désactivation (`POST /workflows/:id/toggle`)
- Journal d'exécution
- Statistiques (exécutions réussies / échouées)

---

## 22. Webhooks

**Route :** `/webhooks`

Intégration entrante/sortante via webhooks HTTP.

### Webhooks Sortants
- Configuration d'une URL cible
- Sélection des événements déclencheurs
- Format JSON personnalisable
- Journaux d'envoi avec status HTTP

### Webhooks Entrants
- URL unique générée par GrowthOS
- Réception de données externes (CRM tiers, formulaires, etc.)
- Transformation et mapping vers les entités GrowthOS

### Événements Supportés (`GET /webhooks/events`)
- `prospect.created` / `prospect.updated`
- `deal.stage_changed` / `deal.won` / `deal.lost`
- `signal.detected`
- `sequence.email_opened` / `sequence.replied`

---

## 23. Calendrier

**Route :** `/calendar`

Vue calendrier intégrée des activités et rendez-vous commerciaux.

### Fonctionnalités
- Vue mensuelle / hebdomadaire / journalière
- Affichage des activités CRM (appels, RDV, tâches)
- Création de nouveaux événements
- Synchronisation avec les activités du CRM
- Indicateurs visuels par type d'activité

---

## 24. Propositions Commerciales

**Route :** `/proposals`

Gestion et suivi des propositions commerciales envoyées.

### Fonctionnalités
- Création de propositions avec montant, description, date d'expiration
- Statut : Brouillon / Envoyée / Acceptée / Refusée / Expirée
- Lien avec deal et compte associé
- Historique des versions
- Suivi d'ouverture (proposition vue par le prospect)

---

## 25. Contacts & Intelligence Contact

**Route :** `/contacts` | `/contacts/:id`

Gestion enrichie des contacts individuels (distincts des prospects).

### Intelligence Contact (`/contacts/:id`)
- Profil complet du contact
- Score d'engagement
- Historique des interactions
- Signaux liés à ce contact
- Réseaux sociaux et coordonnées enrichies

---

## 26. CRM Sync & Mapping

**Route :** `/crm-sync` | `/crm-map`

Synchronisation bidirectionnelle avec des CRM tiers.

### CRM Sync (`/crm-sync`)
- Configuration de la connexion avec un CRM externe (Salesforce, HubSpot, Pipedrive, etc.)
- Synchronisation des contacts, comptes et deals
- Résolution des conflits

### CRM Map (`/crm-map`)
- Mapping des champs entre GrowthOS et le CRM tiers
- Correspondance personnalisable champ à champ

---

## 27. ABM — Account Based Marketing

**Route :** `/abm`

Module de marketing basé sur les comptes cibles (Account Based Marketing).

### Fonctionnalités
- Définition des comptes cibles prioritaires
- Stratégies de ciblage multi-contacts par compte
- Tracking de l'engagement par compte
- Coordination des actions marketing et commerciales

---

## 28. Inbound

**Route :** `/inbound`

Gestion des leads entrants (formulaires, chat, etc.).

### Fonctionnalités
- Réception et qualification des leads inbound
- Attribution automatique à un commercial
- Déclenchement de séquences de nurturing
- Scoring automatique des leads entrants

---

## 29. AI Agent Chat

**Route :** `/ai`

Interface de chat conversationnel avec un agent IA généraliste capable d'interagir avec l'ensemble des données de GrowthOS.

### Capacités
- Questions libres sur les données CRM
- Génération de listes filtrées (ex : "Montre-moi les deals stagnants depuis 2 semaines")
- Analyse comparative
- Aide à la rédaction (emails, notes, propositions)
- Navigation guidée dans l'outil

---

## 30. Marketplace de Plugins

**Route :** `/marketplace`

Catalogue centralisé des plugins disponibles pour étendre GrowthOS.

### Fonctionnalités
- Découverte de plugins officiels et tiers
- Fiche détaillée par plugin : description, dépendances, screenshots
- Installation en 1 clic
- Gestion des versions
- Évaluations et avis

---

## 31. Système de Plugins

**Route :** `/plugins` | `/plugins/:id` | `/admin/plugins-upload`

GrowthOS est construit sur une **architecture modulaire à base de plugins**. Chaque fonctionnalité avancée est un plugin indépendant.

### Plugins Natifs

| Plugin | ID | Dépendances |
|--------|----|-------------|
| Growth Memory | `growth-memory` | — |
| Account Intelligence | `account-intelligence` | growth-memory, meeting-intelligence |
| AI Deal Coach | `ai-deal-coach` | growth-memory, meeting-intelligence, signal-intelligence |
| AI SDR | `ai-sdr` | growth-memory, account-intelligence, signal-intelligence |
| Executive Command | `executive-command` | revenue-intelligence, ai-deal-coach, signal-intelligence |
| Revenue Intelligence | `revenue-intelligence` | ai-deal-coach, account-intelligence |
| Signal Intelligence | `signal-intelligence` | — |
| Meeting Intelligence | `meeting-intelligence` | growth-memory |
| Knowledge Base | `knowledge-base` | growth-memory |
| Data Enrichment | `data-enrichment` | — |

### Manifest de Plugin
Chaque plugin déclare :
- `id`, `name`, `version`
- `dependencies` — autres plugins requis
- Routes API exposées
- Composants UI injectés dans la sidebar

### Upload de Plugin Personnalisé (`/admin/plugins-upload`)
- Upload d'un fichier `.zip` contenant le plugin
- Validation du manifest
- Installation dans la VM sandbox
- Activation / désactivation

### Vue Plugins (`/plugins/:id`)
- Détail d'un plugin installé
- État (actif / inactif)
- Version installée vs disponible
- Dépendances satisfaites / manquantes
- Configuration du plugin

---

## 32. Administration & Audit

**Route :** `/admin` | `/admin/deep-audit`

### Deep Audit (`/admin/deep-audit`)
Outil de diagnostic complet de la santé du système.

#### Vérifications Effectuées (`GET /audit/deep`)
- Connexion base de données PostgreSQL
- Disponibilité de l'API
- État des plugins installés
- Intégrité des données CRM
- Performance des requêtes
- Webhooks actifs et leur statut

#### Auto-Fix (`POST /audit/auto-fix`)
Correction automatique des problèmes détectés (réindexation, nettoyage de cache, etc.)

### Route Audit (`/route-audit`)
Vérification que toutes les routes API définies dans l'OpenAPI spec sont correctement implémentées et accessibles.

---

## 33. Thèmes & Personnalisation

**Route :** `/themes`

Personnalisation visuelle complète de l'interface GrowthOS.

### Thèmes Disponibles
- **Light** (défaut)
- **Dark**
- Thèmes de marque personnalisés

### Variables CSS Personnalisables
- `--color-primary` — couleur principale de la marque
- `--body-bg`, `--card-bg`, `--card-border`
- `--text-primary`, `--text-secondary`, `--text-muted`
- `--color-primary-light`

### Application
Les thèmes sont appliqués via le `ThemeProvider` React et persistés localement.

---

## 34. Paramètres

**Route :** `/settings`

Centre de configuration de l'application organisé en onglets.

### Profil (`/settings/profile`)
- Nom, prénom, email
- Photo de profil
- Fuseau horaire
- Langue

### Équipe (`/settings/team`)
- Gestion des membres de l'équipe
- Rôles et permissions (Admin / Manager / Commercial)
- Invitations par email

### Intégrations (`/settings/integrations`)
- Connexion à des outils tiers
- OAuth / API Keys
- Statut de chaque intégration

### Facturation (`/settings/billing`)
- Plan actuel
- Historique des factures
- Changement de plan
- Informations de paiement

### API (`/settings/api`)
- Génération de clés API personnelles
- Documentation API intégrée

---

## 35. Clés API & Sécurité

**Route :** `/api-keys` (via Settings)

### Gestion des Clés API
- Création de clés API au niveau tenant
- Nommage et description
- Droits d'accès (lecture seule / lecture-écriture)
- Date d'expiration configurable
- Révocation instantanée

### Authentification
- **JWT (JSON Web Token)** — authentification stateless
- Refresh token automatique
- Déconnexion sécurisée

### Routes Auth (`/v1/auth`)
- `POST /auth/login` — connexion email/mot de passe
- `POST /auth/register` — création de compte
- `POST /auth/refresh` — renouvellement du token
- `GET /users/me` — profil de l'utilisateur connecté

---

## Architecture Technique Résumée

```
GrowthOS Monorepo (pnpm workspaces)
├── artifacts/
│   ├── api-server/          → Backend Express + TypeScript (port 3001)
│   │   ├── src/routes/v1/   → Routes API versionnées
│   │   └── src/lib/plugins/ → Runtime de plugins
│   ├── growthos/            → Frontend React + Vite + Tailwind (port 3000)
│   │   ├── src/pages/       → Pages de l'application
│   │   └── src/plugins/     → Composants des plugins
│   └── growthos-mobile/     → App mobile Expo (React Native)
└── lib/
    ├── db/                  → Drizzle ORM + schéma PostgreSQL
    ├── api-spec/            → OpenAPI Spec + génération Orval
    ├── api-client-react/    → Client React (hooks TanStack Query)
    └── api-zod/             → Schémas Zod générés
```

### Stack Technique
| Couche | Technologies |
|--------|-------------|
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, Radix UI, Recharts |
| **Backend** | Express, TypeScript, Drizzle ORM |
| **Base de données** | PostgreSQL |
| **State management** | TanStack Query (React Query) |
| **Routing** | Wouter (frontend léger) |
| **IA** | Ollama (local LLM) + fallback Mock |
| **Mobile** | Expo + React Native |
| **Déploiement** | Docker + Docker Compose + Traefik |

---

*Documentation générée depuis le code source de GrowthOS — toutes les fonctionnalités décrites correspondent à du code implémenté.*
