# GrowthOS — remise en état en préproduction

Date : 22 novembre 2026. Base : branche `growthos-preprod` (`51e85be8`). Travail isolé : `fix/growthos-functional-redesign`.

## Objectif et limites de validation

Transformer le prototype en outil B2B honnête : chaque vue doit utiliser les vraies données de son compte, montrer les erreurs et ne jamais faire passer une simulation pour une action réelle.

**Attention :** cette branche ne constitue pas un SaaS entièrement vérifié en production. Le backend et l'interface compilent ; les tests de connecteurs IA sont **simulés hors ligne**. Les appels réels aux fournisseurs et les parcours métier complets restent à valider sur une instance isolée avec des clés de test, avant tout usage commercial.

## Fonctionnalités par niveau de préparation

| Fonction | État de la branche | Limites restantes |
| --- | --- | --- |
| Wizard premier compte et configuration | Test d'intégration CI prévu sur PostgreSQL 16 | Vérifier visuellement la première installation vierge |
| CRM prospects, comptes, contacts, pipeline | API CRUD existante ; vues contacts/comptes branchées sur les données réelles | Tester les actions UI après déploiement de préproduction |
| Recherche d'entreprises françaises | API publique avec données de sociétés réelles, max 25 par recherche | N'invente ni email ni site ; doublons possibles |
| Diagnostic d'un site | Requête HTTPS limitée, vérification title/H1/description/viewport/canonical/noindex | Ne fait ni Lighthouse ni analyse de positionnement Google ; 6 audits/h par instance |
| Agent IA | Appels OpenAI/Claude/DeepSeek configurés, contexte CRM réel, **lecture seule** | Clés réelles et facturation non testées ; 15 requêtes/h par instance |
| Rédaction IA pour réputation | Génération via fournisseur réel, brouillons à relire | Pas de publication automatique |
| Enrichissement | Google News RSS + adaptateurs Pappers/INSEE/Wappalyzer/Hunter avec clé et sans faux fallback | Adaptateurs payants non testés en conditions réelles ; pas de job par lot durable |
| Séquences email | Création, modification et stockage de **brouillons** | Activation et envoi bloqués en l'absence d'anti-désabonnement, tracking fiable, contrôle des consentements |
| Workflows | Enregistrement de **brouillons** | Exécution automatique désactivée (moteur absent) |
| Webhooks | Gestion des définitions ; pas de succès fictifs | Vérification et relance réelles non démontrées |
| Réunions | Consultation des anciens enregistrements | Aucune transcription possible sans moteur audio ; simulation refusée |
| E-réputation | Campagnes et données existantes, agrégats affichés uniquement à partir de mesures | Pas d'agrégation historique garantie, pas de suivi complet réseaux sociaux ou PBN |
| Audit technique « profond » | Inventaire routes/tables et sondes HTTP de lecture, avec couverture explicite | Ne teste **pas** les POST/PUT/DELETE, scripts métiers, providers ni email ; score global non certifié |
| Design | Navigation réduite, dashboard plus mobile, vue SEO dédiée, écrans démo inaccessibles | Refonte visuelle complète de toutes les pages encore à terminer |

## Correctifs de sécurité et fiabilité

- Les données aléatoires d'entreprise, actualités, réunions et marketing ne sont plus exposées comme vérifiées.
- Les secrets d'enrichissement ne doivent plus provenir de la table globale non isolée `enrichment_api_configs` : utiliser les clés chiffrées par compte dans **Clés API Providers**.
- Les lectures d'historique et de données d'enrichissement vérifient l'appartenance du prospect au compte.
- Les campagnes E-réputation vérifient la propriété par compte avant les actions imbriquées.
- Les URL SEO refusent les adresses privées et les protocoles non HTTPS ; DNS résolu et épinglé, limite 250 Ko/8 s, redirections non suivies.
- Les endpoints qui simulaient une réponse email, un résultat de connexion, un envoi en masse ou une transcription retournent une erreur explicite.

## Validation technique attendue dans GitHub Actions

La CI construit sur GitHub (jamais sur le VPS) :

1. Installation à partir du lockfile, TypeScript frontend/backend et compilation API.
2. Test de bootstrap/wizard, import de sociétés via **stub local**, isolation d'authentification, brouillons email, endpoints de simulation bloqués, audit de couverture partielle, PostgreSQL 16 temporaire.
3. Tests locaux de format Claude/OpenAI/DeepSeek, **sans appel externe**.
4. Tests SSRF sur URL et IPv4 pour diagnostic SEO.
5. Construction et publication des images GHCR versionnées par SHA seulement si tous les tests précédents réussissent.

Un statut `running` de conteneur ne certifie pas que ses fonctionnalités fonctionnent. Cette validation CI ne remplace pas une recette de navigation et tests réels en préproduction.

## Déploiement DockPanel — uniquement après CI verte et sauvegarde

1. Conserver les trois services et le **volume PostgreSQL existant**. Ne **pas** créer un deuxième volume sous le même nom et ne pas supprimer la stack.
2. Dans DockPanel, effectuer un **snapshot/sauvegarde PostgreSQL vérifiée** avant tout changement, puis contrôler la place libre (le VPS avait ~26 Go libres lors du dernier relevé).
3. Ouvrir **Docker Apps → stack `growthos-preprod` → Edit**. Modifier uniquement les deux tags `ghcr.io/lepubli/growthos-api:<SHA>` et `ghcr.io/lepubli/growthos-web:<SHA>` par le même SHA **approuvé** et construit dans la CI.
4. Ne pas modifier les variables de secrets, le réseau, le port `13000:3000`, la base ou le domaine `agile.le-publicitaire.fr` ; conserver les plafonds CPU/RAM existants et les autres applications du VPS.
5. Déployer depuis DockPanel ; vérifier `3/3 running`, journaux API, puis wizard/session, prospects, sourcing, diagnostic SEO, IA (avec clé de test), brouillons de séquence, mobilité et audit partiel.
6. Si régression, revenir aux **deux anciens tags d'images** dans DockPanel, **sans effacer le volume**. Ne jamais faire de rollback de schéma DB sans procédure dédiée.

**Ne pas faire** : `docker system prune`, remise à zéro du VPS, réutilisation des mots de passe de MajlisTV/Trimaint, redéploiement automatique de tous les services, déploiement sur `main`.

## Conditions pour une version commercialisable

- Tests E2E réels et recettes manuelles complets de chaque parcours (dont isolation multi-comptes et migration DB).
- Moteur de relance persisté avec file de tâches, consentement/opposition, désabonnement, plafonds de volume, délivrabilité et journal d'envoi.
- Connecteurs externes testés avec de vraies clés, quotas et gestion des coûts ; sauvegardes/restauration vérifiées.
- UX harmonisée sur desktop et mobile, erreurs accessibles et états vides clairs.
- Réévaluation sécurité/RGPD et rotation des secrets qui ont été partagés en clair dans une conversation.
