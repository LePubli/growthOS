# GrowthOS — Parcours de vérification et validation d'une source en un clic

> **Relais fonctionnel à l'autre agent — 27 novembre 2026.** Demande directe du propriétaire : « la vérification et la validation sur le navigateur cloud est un véritable bourbier ; il ne valide pas les vérifications et ne renvoie pas sur la fiche prospect ». **Ce document est une spécification, pas une fonctionnalité livrée.** Aucun changement de code métier ne fait partie de ce lot documentaire.

## Objectif non négociable

Depuis **Prospect 360° → Enrichissements**, une personne doit pouvoir vérifier une source, confirmer les données autorisées et **revenir automatiquement à la même fiche, sur l'onglet Enrichissements**, sans chercher manuellement la tâche ni recommencer la comparaison.

Le flux doit demander **une seule confirmation explicite** des données à appliquer. Il ne doit jamais appliquer silencieusement un SIREN/SIRET divergent, inventer un champ absent, forcer un captcha, ni considérer qu'une page ouverte prouve l'identité d'une société.

## Parcours cible

1. Sur la fiche 360°, une carte source indique clairement l'action pertinente :
   - **Données prêtes à comparer** : bouton **« Vérifier et valider »** ; ouvre immédiatement la comparaison **dans la fiche** si une capture confirmable est déjà disponible.
   - **Lecture ou sélection humaine nécessaire** : bouton **« Ouvrir la source »** ; ouvre le navigateur cloud déjà ciblé sur **ce prospect, cette source, ce profil et cette tâche**. Les autres sources continuent indépendamment.
   - **Source déjà appliquée** : état **« Enregistré »** ; aucune seconde validation inutile.
2. Quand la source n'a pas encore de capture, le navigateur montre une consigne contextualisée (par exemple « choisir la fiche Pappers de cette entreprise », « terminer la vérification Cloudflare » ou « sélectionner le bon établissement »), et **une seule commande principale « Lire cette fiche » / « Reprendre la lecture »**. Ne jamais proposer « Valider » sur une tâche sans capture.
3. À l'arrivée d'une capture exploitable, la comparaison **s'ouvre dans le même parcours automatiquement** ; pas de retour préalable au catalogue, à l'historique ni à une autre page.
4. La comparaison présente uniquement les champs nouveaux ou différents, leur valeur CRM, leur valeur source et leur provenance. Les remplacements non triviaux restent des cases explicites ; les identifiants légaux incohérents bloquent la confirmation, sans écraser le CRM.
5. Un seul bouton **« Valider et enregistrer »** lance `POST /browser/jobs/:id/confirm`, désactivé pendant la requête. Si le serveur confirme la sauvegarde, actualiser prospect/activités/enrichissement et **naviguer automatiquement vers `/prospects/:id` avec l'onglet Enrichissements actif** ; afficher « Enregistré depuis [source] », nombre de champs effectivement modifiés et éventuellement une mention « Déjà enregistré ». La redirection ne doit jamais précéder la réussite serveur.
6. Une fois de retour, afficher l'état réel de la source et le résultat conservé. Le bouton « Vérifier » ne doit plus réapparaître pour les mêmes données déjà appliquées ; proposer une nouvelle lecture uniquement lorsqu'elle est nécessaire.

## Simplification de l'écran cloud

- Le navigateur et la fiche source restent visibles, avec un **panneau de contrôle étroit** : statut réel, prochaine action unique, nombre de captures, résumé de la comparaison, validation et retour.
- Réutiliser la mise en page ATLAS × ORBIT actuelle ; **ne pas refaire la charte ni les cartes Prospect 360°**.
- Éviter de demander successivement « Reprendre le contrôle », « Relancer », « Comparer », « Confirmer », « Retour à la fiche » pour une seule vérification. Quand une étape automatique peut enchaîner **sans décision humaine ni changement d'identité**, elle doit le faire.
- Le lien « Retour à la fiche » reste toujours accessible. Au retour manuel, conserver l'onglet et la source en cours ; ne jamais annoncer « Enregistré » si la validation n'a pas abouti.
- Prévoir le clavier, les annonces `role="status"` / `role="alert"` et des boutons désactivés avec explication, sans focus bleu agressif.

## Erreurs et états à traiter explicitement

| État observé | Comportement attendu | Ce qui est interdit |
|---|---|---|
| `awaiting_user`, zéro capture | Ouvrir la bonne session source, consigne précise et bouton de lecture/reprise | Appeler `/review` puis afficher un `409` générique |
| `needs_review`, capture disponible | Comparaison directement sur la fiche ou dans le navigateur, avec preuve | Relancer la collecte sans nécessité |
| `409` session fermée ou mauvais profil | Reconnecter/réouvrir la session ciblée et conserver `prospectId`, `jobId`, `profileId`, `source` | Perdre le contexte ou basculer silencieusement de profil |
| `423` navigateur occupé | Indiquer « collecte en cours », différer l'action ou proposer une reprise sûre une fois libre | Réessayer en boucle ou piloter deux profils dans une même session |
| `409` identité/concurrence CRM | Afficher les champs concernés et une référence diagnostic ; proposer une nouvelle comparaison sans effacer les choix | Assimiler à une panne du navigateur ou forcer l'écriture |
| Capture absente, source vide, consentement ou Cloudflare | État informatif et action humaine autorisée, autres sources non bloquées | Contournement automatique, confirmation fictive |
| Sauvegarde réussie / `alreadyApplied` | Retour automatique à la fiche et état final cohérent, idempotent | Réenregistrer une activité identique ou rester bloqué sur le navigateur |
| Sauvegarde échouée, délai ou serveur indisponible | Rester dans la comparaison, conserver capture et cases, afficher motif + `traceId`, réessayer sans doublon | Afficher un succès ou effacer les données saisies |
| Plusieurs fiches candidates | Sélectionner explicitement le bon établissement avec nom, adresse et SIREN/SIRET quand disponibles | Choisir silencieusement un candidat ambigu |

## Contrats techniques à respecter

- **Tenant et identité** : toute lecture/écriture reste limitée à l'agence, l'utilisateur autorisé, le prospect et le `jobId` visés. Aucune URL de retour arbitraire : construire le lien interne à partir du prospect vérifié, en tenant compte de l'onglet demandé.
- **API existante** : réutiliser `GET /browser/jobs/:id`, `GET /browser/jobs/:id/review`, `POST /browser/jobs/:id/confirm`, `POST /browser/jobs/:id/retry` et le suivi d'enrichissement ; vérifier le vrai résultat serveur avant toute transition UX. Ajouter un petit endpoint spécialisé seulement si les contrats actuels ne permettent pas le suivi sans course entre états.
- **État d'onglet** : `ProspectDetailPage` utilise actuellement `active360View` en état local (initial `overview`). Implémenter un **deep link vérifiable** vers Enrichissements et l'appliquer à l'arrivée et au rechargement, sinon un simple retour vers `/prospects/:id` ne suffit pas.
- **Validation atomique et idempotente** : conserver les protections existantes `expectedUpdatedAt`, `expectedCaptureDigest`, `expectedValues`, `replaceFields`, le choix du nom affiché, la traçabilité et les coordonnées multiples livrées en PR75. Acquitter la tâche et mettre à jour le bilan parent sans double activité.
- **Rafraîchissement** : relire prospect, activités et bilan d'enrichissement après succès et **avant** d'afficher les valeurs finales ; une capture appliquée sur un autre onglet doit aboutir au même état déjà traité.
- **Concurrence du navigateur** : les `409/423` des profils ont été observés dans l'export #4. L'agent fonctionnel doit rendre l'état occupé compréhensible et empêcher le déclenchement d'actions concurrentes incompatibles ; les captures déjà lues doivent rester disponibles.
- **Diagnostic** : codes métier non trompeurs pour `CAPTURE_REQUIRED`, `BROWSER_ACTION_CONFLICT`, `CRM_IDENTITY_DUPLICATE`, `CRM_SAVE_FAILED`, `REVIEW_READY`, `CONFIRMATION_SAVED`, `RETURN_TO_PROSPECT`. Corréler `traceId`, `source`, `jobId`, `prospectId` et durées ; ne jamais enregistrer page HTML, cookies, corps HTTP, email, téléphone ou données personnelles.

## Recette de bout en bout obligatoire

1. Prospect ayant une source `awaiting_user`, zéro capture → « Ouvrir la source » → lecture réelle → comparaison → validation unique → **retour automatique au bon prospect, onglet Enrichissements actif** → preuve enregistrée.
2. Prospect ayant une capture `needs_review` → comparaison immédiate sur la fiche, sans passage inutile par le navigateur → confirmation → actualisation des cartes, activités et contacts.
3. Profil occupé (`423`) et session perdue (`409`) → pas de perte d'identité, de capture ni de sélection, reprise explicite quand le navigateur est prêt.
4. Capture modifiée entre lecture et validation, identifiant contradictoire, SIRET déjà utilisé → refus sûr et message intelligible, comparaison encore accessible, aucune modification CRM non autorisée.
5. Deux clics de validation, reprise après rafraîchissement, réponse `alreadyApplied` → une seule mise à jour réelle, puis retour normal.
6. Parcours depuis le panneau Chrome local de PR75 → même écran de comparaison et même résultat CRM ; pas de second écran ou seconde confirmation superflue.
7. Validation d'une source avec une donnée nouvelle et une donnée divergente → seule la donnée autorisée est appliquée, l'autre reste tracée à vérifier.
8. Tests automatisés API/React et Chromium réel avec données de fixture ; un test doit **cliquer jusqu'au retour dans la fiche et vérifier l'onglet actif**, pas seulement vérifier le statut HTTP de `/confirm`.

## Répartition et intégration

- **Propriétaire de l'implémentation** : agent fonctionnel GrowthOS (validation, navigation, état cloud et API), sur branche isolée puis PR vers `fix/growthos-functional-redesign`.
- **Zones à coordonner** : `artifacts/growthos/src/pages/CloudBrowserPage.tsx`, `ProspectDetailPage.tsx`, `components/ProspectEnrichmentsTab.tsx`, `components/cloud-browser/CloudCaptureReview.tsx`, `artifacts/api-server/src/routes/v1/cloud-browser.ts`, services d'enrichissement et tests correspondants. Partir de la version après **PR75 (`30f98d5`)**, ne pas annuler les correctifs PR74/75.
- **Design** : conserver ATLAS × ORBIT approuvé. L'agent design n'intervient sur ces fichiers qu'avec coordination explicite.
- **Relais IP locale / proxy domestique** : **option distincte, non nécessaire pour régler ce parcours UX**. L'étudier après stabilisation des conflits de session, dans un module isolé, avec consentement de l'utilisateur et sans proxy ouvert ni contournement de contrôles des sources. Ne pas conditionner la réparation « Vérifier → Valider → Retour » à son existence.

**Priorité demandée : critique — corriger d'abord le parcours de validation et son retour CRM, avant d'ajouter d'autres sources ou modes réseau.**
