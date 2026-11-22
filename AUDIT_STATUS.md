# GrowthOS — état de validation (22 novembre 2026)

Ce rapport distingue les fonctionnalités effectivement exécutées dans un
environnement de test des modules qui existent seulement dans le code. Il ne
constitue pas une homologation de production ni une validation de l'ensemble
des dizaines de pages du produit.

## Résultats obtenus

| Périmètre | Résultat | Preuve / limite |
| --- | --- | --- |
| Build API (Node 24, esbuild) | PASS | `pnpm --filter @workspace/api-server build` |
| TypeScript API | PASS | `pnpm --filter @workspace/api-server typecheck` |
| Build interface (Vite) | PASS | `pnpm --filter @workspace/growthos build` |
| TypeScript interface | PASS | `pnpm --filter @workspace/growthos typecheck` |
| Migrations et démarrage API | PASS en émulation | PostgreSQL compatible via PGlite ; vrai PostgreSQL 16 non exécuté |
| Initialisation administrateur | PASS | Code unique, JWT, double bootstrap refusé |
| Paramétrage agence | PASS | Sauvegarde persistante en base |
| Configuration SMTP | PARTIEL | Chiffrement et rejet de config invalide vérifiés ; SMTP réel non testé |
| Ollama | EN VEILLE | Connecteur conservé pour plus tard ; non sélectionné automatiquement |
| Claude, OpenAI, DeepSeek | PARTIEL | Trois clés distinctes et fournisseur principal en base ; tests API `/models` simulés, aucune vraie clé testée |
| Import de sociétés françaises | PARTIEL | Deux entreprises importées vers CRM depuis réponse simulée de l'API publique |
| Récupération des résultats sourcing | PASS | Résultats liés au job, protégés par tenant |
| CRM | PARTIEL | Lecture après import vérifiée ; tous les parcours de modification non testés |
| Séquences | PARTIEL | Création et lecture d'un brouillon ; pas de moteur d'envoi |
| Envois externes | BLOQUÉ | Aucun envoi autorisé par défaut ; protection testée |
| Anti-régression du wizard | PASS | `node scripts/smoke-wizard.mjs` : 29 contrôles positifs |
| Tests connecteurs cloud | PASS en simulation | 15 contrôles sur authentification, rejet des erreurs et format des générations, sans vrai appel fournisseur |
| Docker / DockPanel | NON EXÉCUTÉ | Compose analysé comme YAML, pas de démon Docker accessible |
| Affichage dans Chromium | NON EXÉCUTÉ | Le bac à sable interdit les sockets du navigateur ; le build React passe |

## Corrections principales

- Installation dans l'écran `/setup` avec création sécurisée du premier compte
  et étapes agence, SMTP, IA, vérifications.
- Secrets JWT obligatoires en production ; clé de chiffrement AES-GCM pour les
  identifiants fournisseurs, avec lecture des anciennes clés.
- Inscriptions publiques fermées en production ; limitation des tentatives
  d'authentification ; restrictions aux vrais administrateurs plateforme pour
  les plans, les plugins globaux et les audits techniques.
- Exclusion des mots de passe, clés API et données des corps de requête des
  journaux de diagnostic.
- Migrations SQL exécutées séquentiellement au démarrage.
- Fournisseur SMTP par tenant configurable et testable ; envoi externe bloqué
  tant que les protections de campagnes ne sont pas opérationnelles.
- Suppression des faux jobs et faux prospects des écrans Sourcing. Un connecteur
  gratuit vers l'API Recherche d'entreprises a été implémenté (25 maximum par
  requête) ; le test a été effectué avec une réponse simulée.
- Chargement différé de 82 écrans secondaires React. Taille du fichier JavaScript
  initial passée d'environ **2,26 Mo à 422 Ko** avant compression.
- Claude, OpenAI et DeepSeek configurables ensemble dans le wizard, sélection
  d'un fournisseur principal explicite, clés AES-GCM, tests de connexion sans
  génération. Ollama n'est plus le fournisseur de secours automatique.

## Restant à terminer avant la mise en production

1. Déployer et valider les trois conteneurs avec **Docker Engine**, **PostgreSQL
   16 réel**, DockPanel et HTTPS sur un environnement de préproduction isolé.
2. Parcourir le wizard dans un vrai navigateur et vérifier les écrans sur
   ordinateur et mobile, y compris les étapes de retour/reprise.
3. Connecter les **vrais** identifiants SMTP du domaine et le réseau Docker
   puis tester les clés Claude/OpenAI/DeepSeek depuis la préproduction.
   Ollama reste en veille ; aucune installation locale n'est nécessaire.
4. Tester l'API publique Recherche d'entreprises depuis l'IP du VPS et ajouter
   une stratégie de déduplication des entreprises déjà présentes.
5. Construire et tester le vrai moteur de prospection : liste d'opposition,
   désabonnement fonctionnel, traitement des réponses, mise en pause,
   planification et quotas d'envoi ; seulement ensuite autoriser les emails.
6. Examiner et tester fonction par fonction les autres modules non couverts
   (facturation, SSO, webhooks, e-réputation, extensions, enrichissement,
   workflows, cartes, analytics, portail client, etc.). Des écrans du dépôt
   initial contiennent encore du code de démonstration.
7. Réaliser une revue de sécurité approfondie avant toute exposition publique,
   en particulier sur les plugins téléversés, les intégrations sortantes, le
   contrôle d'accès par tenant, la sauvegarde et la restauration.

### Réexécuter les contrôles sans toucher aux données réelles

```bash
pnpm --filter @workspace/api-server build
pnpm --filter @workspace/api-server typecheck
pnpm --filter @workspace/growthos build
pnpm --filter @workspace/growthos typecheck
node scripts/smoke-wizard.mjs
pnpm --filter @workspace/api-server exec node --import tsx src/tests/ai-connector-probes.test.ts
```

Le script crée puis détruit sa propre base de test temporaire. Il utilise des
serveurs locaux factices pour Ollama et l'annuaire. Aucun email n'est envoyé.

Voir [DOCKPANEL_SETUP.md](./DOCKPANEL_SETUP.md) pour les instructions de
préparation et l'assistant de première installation.
