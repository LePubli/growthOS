# Référence produit : Linked Helper 2

Revue du 26 novembre 2026 à partir des captures de modèles, de séquences, du Plug-in Store et du navigateur intégré fournies par l’utilisateur. Certaines cartes sont coupées ; le tableau recense les fonctions lisibles, sans prétendre inventorier le produit entier.

Objectif GrowthOS : des outils spécialisés, des parcours composables et un CRM commun, avec nos propres collecteurs et traitements. Ces captures sont une référence fonctionnelle, pas une preuve d’implémentation dans GrowthOS.

## Parcours de campagne de référence

Choisir un modèle ou une campagne vide, nommer la campagne, sélectionner une liste et le compte connecté. Qualifier éventuellement les profils selon le client idéal, préparer les messages, inviter, attendre l’acceptation, envoyer le premier message, attendre une réponse puis relancer seulement les contacts encore éligibles. Une réponse ou une exclusion arrête les relances.

Le moteur reste à développer. Les séquences GrowthOS existantes restent des brouillons. Le catalogue de collecte ne lance pas de campagne LinkedIn.

## Fonctions observées et correspondance GrowthOS

| Catégorie | Fonctions visibles | Situation ou suite pour GrowthOS |
|---|---|---|
| Catalogue et modèles | Catégories, installé/non installé, campagne vide, connexion et relance, messagerie, export, InMail, enrichissement, événements | Premier catalogue de collecte et enrichissement dans `/outils`. Activation de modules et modèles de campagnes à construire. |
| Collecte | Visite et extraction de profils, organisations, employés, collecte depuis une source | Collecteurs entreprise réutilisés. LinkedIn Entreprises reste assisté. Profils personnels et relation personne/entreprise à développer séparément. |
| Enrichissement | Emails, téléphones, profils, entreprises et réseaux | Champs visibles, provenance et désaccords. Sources directes et officielles à étendre. Aucune base équivalente à Linked Helper ne devient disponible par le seul auto-hébergement. |
| Qualification IA | Détection du profil client idéal, score et filtrage | Connecteurs IA existants ; critères explicites, score justifié, validation et filtre de campagne à développer. |
| Contact | Invitations, messages aux premières connexions, InMail, groupes et événements | Actions de campagne non implémentées. Prévoir destinataires, capacités du compte et aperçu avant activation. |
| Relations | Suivi, interactions, promotion de publications, invitation à suivre une organisation, à rejoindre un groupe ou un événement, approbation de compétences, suppression de connexions | Fonctions complémentaires après validation de la collecte et des premières séquences. |
| Conditions | Acceptation, vérification des réponses, comportement selon le type de message, filtrage du contenu | Moteur d’états par contact à développer. Une réponse et une exclusion doivent bloquer la prochaine relance. |
| Temps et exécution | Attente, début différé, délai des étapes, heures de travail, paramètres avancés | Ordonnanceur persistant, fuseau Europe/Paris, pause/reprise, limites et journal d’erreurs à développer. La fenêtre d’extension ne sert pas d’ordonnanceur durable. |
| Invitations | Acceptation des invitations entrantes, retrait des invitations envoyées | À développer après suivi fiable des états ; aperçu et confirmation des actions. |
| Messages | Messages IA, variables personnalisées, IF/THEN/ELSE, images, mots d’arrêt, réponses génériques | Éditeur, prévisualisation et vérification par destinataire à construire. Les réponses ambiguës restent à revoir. |
| Conversations | Historique, boîte de réception, réponse transmise par webhook | Activités CRM existantes. Synchronisation réelle des conversations LinkedIn et événements de réponse à construire. |
| CRM et listes | Tags, notes, CRM intégré, gestion des listes, fusion, intersection et exclusion | Prospects, deals et activités existants. Listes de campagne et exclusions communes à compléter. |
| Connexions externes | Webhooks profils/organisations/réponses, CRM externes, Snov.io | Rattachement direct à GrowthOS dans le parcours natif. Export et webhooks optionnels ensuite, sans dépendance à Snov.io, Apollo, Zapier ou Make. |
| Plateformes et informations | LinkedIn/Sales Navigator/Recruiter, description et métadonnées de campagne | Décrire les capacités réelles par compte. Les abonnements propres au réseau ne sont pas remplacés par l’auto-hébergement. |
| Comptes connectés | Connexion à son compte dans le navigateur intégré | Espace GrowthOS à développer : réseau, compte, état, dernière vérification, reconnexion, déconnexion, compte sélectionné par campagne et séparation entre agences. |

## Connexion à ses propres comptes

- Aujourd’hui : l’utilisateur se connecte directement au réseau dans son profil Chrome. L’extension utilise la page ouverte pour les lectures disponibles ; elle ne transmet ni mot de passe, ni cookie de session, ni JWT GrowthOS. Cela ne constitue pas encore une interface de gestion des comptes.
- Étape suivante : associer explicitement un navigateur compagnon et un compte à GrowthOS, avec états connecté, hors ligne, session expirée et intervention requise. Nommer le compte et sélectionner le compte de chaque campagne.
- Les comptes LinkedIn, Facebook, Instagram et autres doivent annoncer des capacités distinctes. Une connexion ne rend pas automatiquement disponibles les messages, invitations ou extractions.
- Si un fournisseur propose l’autorisation officielle nécessaire, utiliser ce parcours de connexion. Le navigateur intégré souhaité correspond à une application compagnon avec profil isolé ; une simple iframe dans GrowthOS n’est pas une solution fiable.
- Pour des tâches navigateur, prévoir un compagnon ouvert et connecté. Une extension Chrome fermée n’offre pas une exécution autonome permanente sur le VPS. La file et l’historique des futures campagnes doivent rester dans PostgreSQL.
- Déconnexion et changement de compte doivent interrompre les tâches concernées et empêcher une reprise avec le mauvais compte.

## Ordre des lots et critères de recette

- [ ] **Collecte ciblée** : valider dans Chrome chaque source, l’identité de l’établissement, les champs manquants, les désaccords et la reprise. Voir [le suivi fonctionnel](../SUIVI-FONCTIONNEL.md).
- [ ] **Comptes connectés** : association au compagnon, sélection explicite, états de session et déconnexion ; tester deux comptes sans mélanger leurs tâches ni les agences.
- [ ] **Contacts LinkedIn** : modèle personne/entreprise, rôle, URL, dédoublonnage, collecte visible confirmée et exclusion. Un profil personnel ne doit pas passer pour une page entreprise.
- [ ] **Listes et qualification** : listes sauvegardées, tags, exclusions communes, score IA expliqué et prévisualisation des destinataires.
- [ ] **Moteur de campagne** : états PostgreSQL par contact, journal, conditions, délais, pause/reprise et prévention des doubles exécutions.
- [ ] **Premier modèle** : invitation, acceptation, message, attente puis réponse ou relance ; vérifier chaque transition avec comptes et destinataires de recette.
- [ ] **Conversations** : historique, rattachement au contact, arrêt des relances et notification GrowthOS.
- [ ] **Exploitation** : interruption, connexion expirée, reprise sans double envoi, limites par compte et plages horaires.
- [ ] **Compléments** : événements, groupes, interactions, retrait des invitations, images personnalisées et exports.

Les sources françaises directes RNE/INPI, BODACC, BOAMP et les annuaires sectoriels restent un autre axe du plan. Elles doivent alimenter le même CRM avec date et provenance.
