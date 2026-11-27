# Coordination temporaire des agents — GrowthOS

Notes de travail demandées par le propriétaire le 26 novembre 2026. À lire avant de modifier des fichiers partagés. Chaque agent peut compléter son périmètre et son état sans effacer les notes de l’autre.

**Suppression : conserver ce fichier et les autres notes temporaires de coordination jusqu’au lancement final en production. Les supprimer lors de ce lancement, sur autorisation explicite du propriétaire. Ne pas considérer une mise à jour de préproduction comme ce lancement.** Le suivi fonctionnel durable reste dans `SUIVI-FONCTIONNEL.md`.

## Répartition annoncée par le propriétaire

| Agent | Périmètre | Coordination |
|---|---|---|
| Agent design, dans une autre conversation | Design du logiciel GrowthOS uniquement | Préserver les contrôles, validations, états de chargement et liaisons de données. Ajouter ici sa branche et ses fichiers lorsqu’ils sont connus. |
| Agent fonctionnement, branche active `fix/watch-baseline-identity` | Fonctionnement : enrichissement, veille, mise à jour et traçabilité | Modifications d’interface limitées au parcours demandé et à l’affichage des données. Aucune refonte de la charte, de la navigation générale ou du style. |

## État du travail fonctionnel

- Base livrée : PR 38, fusion `c9110a99d9ee33a8085c44085b8c146d7e57f453`, catalogue `/outils`, enrichissement lié au prospect et Chrome `0.11.0.12`.
- PR 39 fusionnée, commit `071114127269e30d94d9275c2b816822b1afe1e6`, 268 contrôles API réussis ; recette Chrome encore ouverte : « Lire la fiche » avant la confirmation/retour ; catégorie « Chauffagiste » exclue de l’inférence d’une ville ; même SIRET autorise la comparaison malgré un nom ou une ville erronés ; remplacement explicite des valeurs divergentes.
- Veille activée : appliquer les données officielles d’identité, d’adresse et d’activité pour l’établissement exact, conserver les champs absents, notifier et historiser les valeurs avant/après. Les coordonnées commerciales non fournies par l’Annuaire restent conservées.
- Traçabilité dans les activités de la fiche, avec source, date et valeurs. Les activités automatiques utilisent le type `data_update` et restent en lecture seule.

- Correctif complémentaire sur `fix/watch-baseline-identity` après revue de la PR 39 : ne comparer les dates officielles que pour le même SIREN et le même SIRET demandé. Une identité corrigée doit pouvoir établir un nouveau contrôle. Ce complément touche seulement le service API de veille, ses tests et la documentation. 270 contrôles d’intégration réussis sur PostgreSQL 16 jetable, fournisseurs simulés.

## Fichiers d’interface partagés à intégrer avec précaution

- `artifacts/growthos/src/pages/ProspectDetailPage.tsx` : rafraîchissement des données et activités après enrichissement/veille, comparaison de valeurs, protection des modifications en cours et affichage de l’historique.
- `artifacts/growthos/src/components/ProspectCompanyProfile.tsx` : dernier résultat de synchronisation et rafraîchissement de la fiche après veille.
- `artifacts/growthos/src/components/ConnectorEnrichmentReturn.tsx` : lien vers la comparaison des données proposées après capture.
- `extensions/growthos-pagesjaunes/popup.html` : ordre fonctionnel lecture → comparaison → confirmation → retour. Préserver les identifiants utilisés par `popup.js`.
- Autres fichiers du lot : API sourcing, service de veille, protection des activités automatiques et tests. Aucun changement de thème global.

## Règles de synchronisation

- Travailler sur des branches distinctes et publier des PR ciblées. Avant chaque commit et fusion, relire les changements locaux et distants, contrôler la branche cible et les PR ouvertes. Ne committer que les fichiers du lot, sans inclure le travail non committé de l’autre agent.
- Pas de `push --force`, de réinitialisation destructive ou d’écrasement d’une branche partagée. Une fusion conflictuelle doit intégrer les deux versions de façon ciblée.
- En cas de fichier commun, intégrer les changements des deux agents : conserver le design de l’agent design et le comportement validé de l’agent fonctionnel.
- Ne pas remplacer un fichier entier par une ancienne copie pour résoudre un conflit.
- Inscrire ici les changements de périmètre, points bloquants et résultats utiles. Ne jamais inscrire de secrets, mots de passe ou cookies.
- Déploiement DockPanel laissé au propriétaire. Le lancement final en production reste soumis à son autorisation.
- **Annonce de fin obligatoire pour les deux agents** : à la fin de chaque lot, prévenir le propriétaire quand les commits sont poussés, les contrôles réussis et les images nécessaires publiées. Fournir le lien du ZIP Chrome si le connecteur change et les étapes de redéploiement/recette. Distinguer code prêt, compilation en cours et lot réellement disponible. Chaque agent annonce son propre lot avec les preuves connues ; ne pas annoncer celui de l’autre sans les vérifier. Aucun redéploiement DockPanel par les agents.

## Relais design

**Lot design ATLAS × ORBIT du 26/11/2026 :** branche `feat/atlas-orbit-design-20261126`. La fiche Prospect 360° reprend le parcours **liste → aperçu latéral → bouton « Ouvrir la fiche 360° » → page pleine largeur**. S'y ajoutent le thème bleu/blanc ATLAS, navigation par onglets/ancres et cartographie des relations avec molette, glisser et filtre des anciens mandats.

Fichiers UX : `artifacts/growthos/src/atlas-orbit.css`, `components/atlas/ProspectQuickPreview.tsx`, `components/atlas/ProspectRelationshipMap.tsx`, `providers/theme-provider.tsx`, `components/layout/AppShell.tsx`, `pages/ProspectsPage.tsx` et `pages/ProspectDetailPage.tsx`.

**Point de fusion vérifié :** les corrections fonctionnelles de la PR 39 ont été conservées lors du rebase, en particulier les callbacks `ConnectorEnrichmentReturn.onSaved` et `ProspectCompanyProfile.onUpdated` qui rafraîchissent simultanément la fiche et les activités. Aucun changement voulu sur la logique serveur.

**Pappers :** la cartographie installée est un instantané **documenté uniquement pour SOLUTION ENR (SIREN 981075252)** ; il n'y a pas encore de clé ni de client API Pappers. Le futur endpoint tenant-aware, les vérifications, sources, quotas, limites légales et tests de recette sont détaillés dans `docs/design/ATLAS-ORBIT-HANDOFF.md`. Les autres SIREN affichent un état d'attente, jamais la carte SOLUTION ENR.

**Ne pas effacer** cette note ni le relais UX avant le lancement final expressément autorisé. Les validations de déploiement de préproduction restent la responsabilité du propriétaire.

**Correctif UX de précision du 26/11/2026** — branche design
`fix/atlas-orbit-visual-polish-20261126` : la notification de retour
d'enrichissement affiche désormais explicitement les états « déjà enregistré »,
« enregistré », « en cours » ou « erreur » avec un traitement coloré, une
icône, des actions contextuelles et une fermeture non destructive. Elle est
placée **après l'en-tête identité** ; l'historique des captures est déplacé dans
le dossier détaillé existant, sans perte de données. La grille Prospect 360°
conserve le Copilote IA en colonne étroite **à droite** sur les résolutions
desktop courantes (notamment ~1366 px), au lieu de l'étendre en travers de
toute la ligne. Sont concernés uniquement
`components/ConnectorEnrichmentReturn.tsx`, `pages/ProspectDetailPage.tsx`
et `atlas-prospect-360.css`. Aucun changement serveur ni contrat API.

**Lot fidélité visuelle ATLAS × ORBIT (26/11/2026)** — branche isolée
`feat/atlas-orbit-pixel-360-20261126`, cible de fusion
`fix/growthos-functional-redesign`. La page Prospect 360° affiche désormais en
premier un **tableau de bord 3 + 4 cartes** inspiré de la maquette validée
(identité légale, complétude circulaire calculée sur les données existantes,
copilote contextuel, contacts, chronologie réelle, surveillance et opportunité),
avec bandeau ORBIT, rail d'actions, hiérarchie visuelle et logo ATLAS.
Le **dossier historique intégral** reste préservé, dépliable, et les onglets
ouvrent les sections correspondantes. La cartographie Pappers existante est
conservée dans son onglet dédié. Aucun nouveau connecteur Pappers ni appel IA
serveur n'est ajouté : la recommandation est une aide UX déterministe.

Fichiers de ce lot :
`artifacts/growthos/src/components/atlas/Prospect360Dashboard.tsx` (nouveau),
`artifacts/growthos/src/atlas-prospect-360.css` (nouveau),
`artifacts/growthos/src/pages/ProspectDetailPage.tsx`,
`artifacts/growthos/src/components/layout/AppShell.tsx`,
`artifacts/growthos/src/index.css`. Conserver les callbacks de veille,
les enrichissements, les relations, la comparaison des valeurs et les activités
automatiques de l'agent fonctionnel. Toute future modification simultanée de
`ProspectDetailPage.tsx` exige une relecture de fusion ciblée.


## Protocole de notification au propriétaire

Demande explicite du propriétaire du 26/11/2026 : **les deux agents doivent le prévenir, dans leur conversation respective, dès qu'un lot est réellement terminé et prêt à être redéployé**.

- Message obligatoire : **« ✅ PRÊT À REDÉPLOYER »**, branche, commit GitHub exact, liste succincte des modifications, résultat de la CI des images, tests à faire dans GrowthOS.
- Tant que la fusion, la validation ou la publication GHCR n'est pas terminée, annoncer **« ⏳ PAS ENCORE PRÊT À REDÉPLOYER »**. Ne pas faire croire qu'un simple commit de code suffit.
- En cas de nouveau push concurrent, vérifier le SHA de la branche commune et attendre le dernier workflow vert, pour que le propriétaire ne déploie pas une image intermédiaire.
- Le propriétaire réalise le déploiement dans DockPanel : **Edit / Save avec pull_policy: always**, pas seulement « Restart » (qui peut garder une ancienne image). Ne toucher ni aux volumes PostgreSQL ni aux secrets.
- Après redéploiement, le propriétaire teste et fait son retour ; l'agent concerné corrige puis réannonce un nouveau lot prêt.
- Conserver cette règle et le reste des notes jusqu'à l'autorisation explicite du lancement final de production.


## Changement de parcours demandé — automatisation intégrée et trois plateformes

Le 26/11/2026, le propriétaire précise que l'extension et la saisie assistée ne sont pas le parcours principal attendu. GrowthOS doit lancer lui-même recherche, collecte et enrichissement, dans un navigateur intégré, avec ses comptes connectés quand la source le permet et en navigation publique sinon. L'extension est un secours externe en cas de difficulté.

Il demande les trois accès : **Web + application PC + application Android**. Proposition de socle : un moteur d'automatisation et une file PostgreSQL sur son VPS, partagés par ces clients ; profils de comptes isolés, progression, reprise et traçabilité communes. Le pilote du moteur Web précède l'installateur Windows et l'APK Android. La base Expo existante est à auditer/raccorder ; aucune nouvelle application n'est annoncée comme livrée.

Cadrage et état du code : [docs/NAVIGATEUR-INTEGRE-AUTOMATISATION.md](docs/NAVIGATEUR-INTEGRE-AUTOMATISATION.md). Branche du cadrage : `plan/integrated-browser-automation`. L'agent fonctionnement traite le moteur, les sessions, les adaptateurs et l'API ; l'agent design conserve son périmètre visuel. Les écrans « Comptes », « Navigateur » et « Tâches de collecte » doivent refléter des capacités réelles, avec une interface adaptée au tactile. Aucun changement de thème ou de composant de design dans ce cadrage.

Cette note complète les deux relais existants et le protocole de notification. Elle ne constitue ni une fonction terminée, ni un feu vert pour redéployer, ni une autorisation de lancement en production.
## Lot design : dossier complémentaire et contacts (26/11/2026)

- Branche isolée : `feat/atlas-orbit-deep-details-20261126`, cible `fix/growthos-functional-redesign`. L'objectif est d'aligner **tous les blocs sous « Informations détaillées, édition et historique »** sur les cartes ATLAS × ORBIT, et non de les afficher avec l'ancienne charte.
- Fichiers UX : `src/atlas-prospect-details.css` (import dans `src/index.css`), `src/pages/ProspectDetailPage.tsx`, `src/components/ProspectCompanyProfile.tsx`, `src/components/atlas/Prospect360Dashboard.tsx`, `src/components/common/CommentsPanel.tsx` sous `artifacts/growthos/`.
- **Contacts harmonisés** : `src/lib/prospect-people.ts` lit les contacts dirigeants et leurs fonctions de la capture Societe.com, les dirigeants du relevé officiel de surveillance et le nom éventuel du CRM ; dédoublonne et ne présente comme « directes » que les coordonnées rattachées explicitement à une personne. La synthèse 360° et le répertoire détaillé lisent **la même liste**. Test régression : `scripts/test-prospect-people.mjs` (workflow préprod inclus).
- La colonne droite ancienne (Informations / 2e complétude / Actions rapides dupliquées) est remplacée par la **traçabilité** et l'outil d'enrichissement spécifique. L'enrichissement, la veille, la comparaison, les modifications, la localisation et le journal des changements restent utilisables. Les longues descriptions des activités `data_update` restent accessibles dans des détails repliables, tandis que ces événements ne sont plus répétés dans les commentaires d'équipe.
- **Points d'interface avec l'autre agent** : conserver les API `/prospects/:id/monitoring`, `/prospects/:id/verify-company`, `/activities` et `/enrich/:id`, les protections des activités automatiques, ainsi que les callbacks de rafraîchissement. Le lot design n'introduit aucun changement de schéma serveur et ne doit pas remplacer une correction fonctionnelle parallèle de `ProspectDetailPage.tsx` ou `ProspectCompanyProfile.tsx`. Synchroniser la base avant fusion.
- Cette note temporaire reste présente jusqu'à l'autorisation explicite de production finale. **Lot livré via PR #47**, fusion `a4fba2f79777c78fe962b3b177b9f7e945af0672`, workflow préprod #74 (`45812101688`) vert : images `growthos-web`, `growthos-api` et `growthos-pagesjaunes` publiées sous `:preprod`.

## Lot design : carte d'adresse, boutons et complétude stricte (26/11/2026)

- Branche `feat/atlas-orbit-polish-map-score-20261126`, issue du dernier commit préprod fusionné (PR #47) et ciblant `fix/growthos-functional-redesign`. Aucun contrat serveur ni migration.
- La **localisation** de la fiche CRM n'est plus une carte séparée en bas de page : même composant Leaflet affiché dans la carte supérieure « Identité & données légales », sous l'adresse (ou action « Localiser l'adresse » si GPS absent). Les accès à la carte CRM et Google Maps restent visibles ; l'édition d'adresse et son géocodage sont conservés.
- Les liens de recherche de sources professionnelles, liens de provenance et liens d'actions sont présentés comme **boutons ATLAS** tout en restant des liens accessibles ouvrant les destinations existantes. La nomenclature NAF n'est plus affichée ni proposée dans l'édition de la fiche, mais sa donnée et l'historique backend ne sont pas supprimés.
- `src/lib/prospect-completeness.ts` remplace le calcul permissif à cinq cases par **9 critères documentaires stricts** pour l'anneau 360° : identifiants SIREN/SIRET cohérents, vérification Annuaire, APE + libellé, adresse complète, GPS, téléphone exploitable, email valide, site valide et dirigeant avec rôle. Tooltip d'aide pour chaque point manquant. `scripts/test-prospect-completeness.mjs` est exécuté par le workflow préprod.
- Fichiers communs à surveiller avec l'autre agent : `src/pages/ProspectDetailPage.tsx`, `src/components/ProspectCompanyProfile.tsx`, `src/components/atlas/Prospect360Dashboard.tsx`. Préserver leurs comportements de veille/édition/sauvegarde/renouvellement et ne pas écraser de modification fonctionnelle concurrente.
- Ces notes restent temporaires **jusqu'à l'autorisation explicite de lancement final en production**. Publication CI à vérifier avant toute annonce « prêt à redéployer ».

## Lot design : repères chromatiques et logos des sources/entreprises (26/11/2026)

- Branche isolée `feat/atlas-orbit-color-logos-20261126`, cible `fix/growthos-functional-redesign`. Seuls le rendu et les tests de l'interface sont concernés. Préserver le fonctionnement de veille, les enrichissements et le backend de l'autre agent.
- Le fichier `src/atlas-prospect-colors.css` complète le thème ATLAS × ORBIT avec des accents **sémantiques** : identité bleu, complétude cyan, contacts turquoise, activités indigo, veille verte, opportunités ambre, copilote violet, ainsi que les blocs détaillés correspondants. Pas de changement de palette globale ni de perte de contraste des boutons.
- Le composant `components/atlas/ProspectLogos.tsx` affiche des favicons des **domaines officiels des sources** (Annuaire/INSEE, Societe.com, Pappers, PagesJaunes, Google, Bing, LinkedIn, Facebook, Instagram, TikTok), avec monogramme coloré lorsqu'une icône n'est pas disponible. Les cartes de sources, les provenance, la synthèse et la cartographie utilisent ce composant.
- Pour un logo d'entreprise, `lib/prospect-logo.ts` ne lit que le domaine Web public déclaré : favicon, puis icône Apple Touch, sinon initiales. Une URL de logo explicitement fournie est acceptée seulement sur le même domaine HTTPS. **Aucun logo d'un concurrent, aucune recherche de logo à partir du nom, aucune image Pappers utilisée comme logo d'une société**, pas de service tiers de recherche de logos ni de nouvel appel serveur.
- La cartographie des relations (`ProspectRelationshipMap.tsx`) peut montrer l'icône de l'entreprise principale grâce à `prospect.website` et, pour un nœud ultérieur, un domaine `node.website` explicitement sourcé ; les autres entités gardent leurs initiales. L'instantané documentaire Pappers ne gagne aucune information factuelle inventée.
- Test `scripts/test-prospect-logos.mjs`, inclus dans le workflow de préproduction. Fichiers UX concernés : `ProspectDetailPage.tsx`, `Prospect360Dashboard.tsx`, `ProspectProfessionalSources.tsx`, `ProspectCompanyProfile.tsx`, `ProspectRelationshipMap.tsx`, CSS et nouveaux composants utilitaires. Tout point concurrent sur ces fichiers exige une fusion ciblée.
- Conserver ces notes jusqu'à la mise en production finale sur autorisation explicite du propriétaire. Statut de CI/PR à contrôler avant annonce DockPanel.

## Lot fonctionnel Web cloud — PR 43 (26/11/2026)

Priorité corrigée par le propriétaire : **Web cloud d'abord ; Windows et Android plus tard**. Branche `plan/integrated-browser-automation`, base synchronisée avec la PR 49 (`82d40f0`). Nouveau worker `workers/cloud-browser`, `Dockerfile.browser`, API `/api/v1/browser`, tables de profils/tâches, route Web `/navigateur` et entrée de menu. Catalogue : lancement intégré prioritaire, extension en secours.

L'interface utilise les variables du thème actif et `SourceLogo` ; aucune modification de `ProspectDetailPage.tsx`, des CSS ATLAS, des logos ni du dashboard de l'autre agent. Le seul delta AppShell est le lien fonctionnel vers `/navigateur`. Préserver les adaptateurs, l'isolation utilisateur/agence et la transaction annulation/mise à jour du prospect.

Le compose ajoute un **nouveau service navigateur** et un **CLOUD_BROWSER_TOKEN séparé** (au moins 32 caractères), à configurer par le propriétaire ; ne pas régénérer les secrets existants ni les volumes DB. Aucune action DockPanel par l'agent. Nouvelle image GHCR `growthos-browser`, quatre images attendues après validation. Extension 0.11.1.13 inchangée. Détails dans `docs/NAVIGATEUR-CLOUD-INSTALLATION.md`.

Tests locaux : 299 contrôles API avec sources simulées et PostgreSQL 16, TypeScript API/Web, rendu du catalogue/navigateur et régressions design. Test Chromium réel ajouté à la CI (le téléchargement local du navigateur est bloqué par l'environnement) ; pas de validation de compte réel revendiquée. Statut final de publication à inscrire après CI. Conserver cette note jusqu'à autorisation explicite de production.

**Validation du lot cloud** : 299 contrôles API locaux verts sur PostgreSQL16 jetable, géocodage public désactivé uniquement en mode recette. Chromium réel vert sur pages locales : workflow [45823630830](https://github.com/LePubli/growthOS/actions/runs/45823630830). Les comptes et sites fournisseurs réels restent à recetter par le propriétaire. La publication préprod des quatre images est encore à suivre avant feu vert.

Dernière régression couverte : une panne du worker pendant une saisie de connexion renvoie une erreur neutre sans transmettre le corps au journal d'erreur générique. Les 299 contrôles API passent après ce correctif. Les fichiers de design restent inchangés.

## Lot design : fonds Harmony validés par le propriétaire (26/11/2026)

- Branche isolée `feat/atlas-orbit-harmony-backgrounds-20261126`, cible `fix/growthos-functional-redesign`. La référence visuelle est la **seconde maquette Soft Harmony**, plus contrastée, validée par le propriétaire après une première version jugée trop fade. Aucun changement API ni logique de contact/veille/enrichissement.
- `artifacts/growthos/src/atlas-prospect-colors.css` : remplace les traits supérieurs saturés par des **fonds de cartes en dégradés pastel visibles** et coordonnés sur les sept modules principaux (bleu glacier, aqua, lavande, vert d'eau, pervenche, sauge et sable), homogénéise les titres foncés et respecte les états vérifié/à contrôler. Les logos ajoutés dans le lot précédent sont conservés.
- Le dossier « Informations détaillées, édition et historique » reprend des fonds compatibles dans ses huit modules, y compris les écrans de surveillance, de sources et de collaboration, ainsi qu'une colonne droite adoucie. Les listes/formulaires gardent leurs contrastes et interactions existantes.
- Test `scripts/test-prospect-harmony.mjs` inclus dans la CI : contraste du texte (rapport minimal 8:1 sur les fonds), distinction visuelle des sept teintes, couverture des huit modules et absence d'anciens liserés épais.
- Ne pas fusionner une version antérieure de `atlas-prospect-colors.css` par-dessus ce lot. En cas de développement simultané, rebaser de façon ciblée. Conserver cette note jusqu'au lancement final en production, sur autorisation du propriétaire.

## Lot fonctionnel : imports en lot et nettoyage des recherches (26/11/2026)

- Demande du propriétaire : tout cocher/décocher pour importer un lot et effacer l'historique du navigateur cloud. Branche isolée `feat/cloud-bulk-import-history`, base PR50. L'autre agent conserve le design.
- Nouveau composant fonctionnel `components/cloud-browser/CloudJobHistory.tsx` pour les résultats/sélections et commandes d'historique. Dans `CloudBrowserPage.tsx`, conserver son branchement et les callbacks lors du redesign ; pas de modification de CSS global ou ATLAS dans ce lot.
- Contrat API ajouté : `POST /api/v1/browser/jobs/history/delete`, corps `{scope:"all"}` ou `{scope:"selected",ids:[UUID,...]}`. Réponse `{deleted:number,deletedIds:string[]}`. Seulement recherches completed/failed/cancelled du propriétaire et de son agence ; un lot sélectionné avec une tâche active ou un ID étranger est refusé atomiquement.
- Effacer une recherche supprime ses résultats non importés et sa ligne de tâche, **jamais les prospects importés, les activités CRM ou les profils/sessions**. Confirmation explicite dans l'interface. Les tâches en attente d'intervention/revue doivent d'abord être annulées pour être effacées.
- À préserver côté UX : sélection par lot, compteurs, import groupé, choix individuel/multiple/tout de l'historique, confirmation et relecture après suppression. Aucune action DockPanel par l'agent. Notes temporaires conservées jusqu'à autorisation explicite de production.

Précision ajoutée par le propriétaire : commandes Annuler / Reprendre / Supprimer dans les tâches du navigateur. L'API de reprise accepte maintenant `cancelled` et conserve le même identifiant/critères ; elle remet le résultat en attente pour ne pas importer une ancienne sélection. Le parent efface également la sélection de ce lot lors de la reprise. Ne pas perdre cette prise en charge lors du redesign.

Validation locale du lot PR51 : **314 contrôles API verts** sur PostgreSQL16 jetable (sources simulées), TypeScript API/Web et builds, tests des sélections React et régressions Harmony/logos. La suppression est limitée à la ligne de tâche ; aucune suppression de prospect, activité ou profil. Publication GHCR à attendre avant feu vert.
## Lot design : poste de travail « Navigateur cloud » (26/11/2026)

- Maquette **ATLAS × ORBIT / Soft Harmony** du navigateur cloud approuvée explicitement par le propriétaire avant codage. Branche design isolée `feat/atlas-cloud-browser-workspace-20261126`, cible `fix/growthos-functional-redesign` ; aucun contrat API ni service de collecte modifié.
- L'interface `artifacts/growthos/src/pages/CloudBrowserPage.tsx` et son CSS `src/cloud-browser.css` sont réorganisés en **barre de commande compacte**, **navigateur immersif à gauche**, **sélection et import des captures vérifiées à droite**, **tâches récentes condensées**. Les résultats et états sont ceux des vrais jobs, jamais des chiffres ou entités de démonstration.
- Les profils, le mode public/compte, la connexion dans la source, l'ouverture/reprise du contrôle, la vue de navigateur distante, ses commandes (clic, clavier, molette, retour), l'effacement de session sur confirmation, le lancement, la reprise/annulation des jobs, le suivi des données partielles et l'import vers Prospects utilisent leurs endpoints et contrôles existants. Aucun état « authentifié » n'est déduit d'une simple vue ouverte.
- Le panneau de résultats réutilise les `captures` du job sélectionné, conserve les choix des cases et n'envoie jamais les brouillons comme fiches vérifiées. Tous les jobs restent accessibles en dépliant l'historique ; le score, le stockage et les validations sont hors de ce lot design.
- `scripts/test-collection-tools.mjs` vérifie la présence et l'ordre du nouveau parcours sur rendu React, et la CI habituelle vérifie TypeScript, build, API et navigateur Chromium. Relire les changements fonctionnels de l'autre agent avant toute fusion et préserver ce relais jusqu'au lancement final explicitement autorisé.

**Fusion ciblée PR51 + PR52** : reprise du fichier `CloudBrowserPage.tsx` de la PR52 comme base visuelle ; ajout de `CaptureBatchControls` dans sa colonne droite et de `CloudJobHistory` autour de ses cartes compactes (rendu `jobCard` conservé). Le CSS de la PR52 est conservé intégralement. Les suppressions, `processedIds`, la reprise des tâches annulées et la protection contre les anciennes réponses de polling sont raccordées au nouveau layout. Les notes des deux agents restent présentes.

## Correctif fonctionnel : état persistant des imports cloud (27/11/2026)

Le propriétaire confirme l'import Google opérationnel, mais les fiches traitées restent sélectionnables et sans état CRM. Branche `fix/cloud-import-result-status`, base PR51/52. Ajouter un reçu par capture dans le résultat du job, un import serveur par IDs de captures et un affichage séparé des fiches traitées avec lien CRM. Les anciens imports sont récupérés seulement depuis les observations réellement stockées sur les prospects de l'agence. Ambiguïtés/échecs restent à traiter. Le thème, le navigateur immersif et les cartes compactes de l'agent design sont conservés ; aucun changement de CSS global. Ne supprimer ces notes qu'au lancement final autorisé.

Contrats du correctif : `POST /api/v1/browser/jobs/:id/import` reçoit `{captureIds:[...]}` et renvoie les compteurs `imported/enriched/alreadyPresent/needsReview/failed`, `processedIds` et le job actualisé. `GET /browser/jobs` et `GET /browser/jobs/:id` enrichissent `result.imports` avec les reçus et la preuve des anciens imports. Conserver `CloudImportFeedback`, `pendingCloudCaptures`, le lien vers la fiche CRM et le filtre des résultats traités lors des retouches visuelles. Les captures ne sont pas effacées : elles restent dans le job, hors de la sélection d'import. Validation locale : 330 contrôles API + tests React/TypeScript/builds ; publication à confirmer.

Revue du correctif d'import (PR53, 27/11) : un désaccord d'une autre capture de même source ne doit pas faire réapparaître une ancienne fiche déjà traitée. Correctif de suivi sur `fix/cloud-legacy-import-conflicts` : même comparaison champ / valeur entrante / valeur CRM pour l'import et la récupération des anciens reçus. Aucun changement de design. Régression ajoutée : deux anciennes captures du même prospect, une conforme et une avec téléphone contradictoire ; seule la seconde reste à vérifier.

Validation du suivi : 331 contrôles API PostgreSQL16 verts ; le cas conforme/contradictoire est couvert. Même helper de comparaison utilisé par les deux parcours.

## Lot design : navigateur immersif V2 validé (27/11/2026)

- Le propriétaire a validé une seconde maquette du navigateur cloud : fenêtre Google Maps dominante (~72 %), résultats à droite (~28 %), **panneaux de hauteur strictement égale**, séparateur redimensionnable, barre de navigation intégrée, historique repliable et import accessible en pied du panneau. Branche isolée `feat/atlas-cloud-browser-immersive-v2-20261127`, basée sur `fix/growthos-functional-redesign` à `2ff09511` avant modification.
- Fichiers design : `artifacts/growthos/src/pages/CloudBrowserPage.tsx`, `artifacts/growthos/src/cloud-browser.css`, assertions SSR `scripts/test-collection-tools.mjs`. Les captures affichées sont celles de la vraie session distante ; **aucune carte ou entreprise de démonstration n'a été codée**. Le rendu distant garde son rapport d'aspect et les coordonnées des clics, sans étirement ni recadrage.
- Les dernières fonctionnalités de l'autre agent sont conservées : `CloudImportFeedback`, `pendingCloudCaptures`, badges et liens CRM, import serveur par IDs, traitement séparé des fiches déjà importées, sélection globale, suppression/reprise/annulation des tâches. L'historique est seulement replié par défaut, pas supprimé : ses commandes restent accessibles en l'ouvrant.
- Le séparateur est pilotable par pointeur ou clavier avec `role="separator"` ; le mode agrandi et les points de rupture responsive conservent la navigation. La liste des captures a son propre défilement, l'import et son compteur restent en bas. Le statut « Coordonnées » signifie seulement adresse + téléphone disponibles, **pas une qualification commerciale ou une vérification officielle**.
- Ne pas écraser ces ajustements lors des correctifs fonctionnels ; ne supprimer ces notes qu'après autorisation explicite du propriétaire lors du lancement final en production.

## Retouche design : focus des champs cloud (27/11/2026)

- Le propriétaire signale un encart bleu trop vif à l'activation du champ de localisation (et des autres champs de commande). Branche `fix/atlas-cloud-fields-focus-20261127`, basée sur le design immersif V2 fusionné.
- Retirer **uniquement** la bordure `outline` intense des champs `input/select` de `cloud-browser.css` ; montrer un contour discret `#a5bedf` sur le conteneur `:focus-within`, avec ombre très légère. Les liens, boutons, contrôles du navigateur et le séparateur gardent leur repère `:focus-visible` accessible au clavier. Aucun comportement de saisie ni d'import modifié.
- Ajout d'une assertion CSS anti-régression dans `scripts/test-collection-tools.mjs`. Préserver cette convention lors des futures retouches ; garder les notes jusqu'à l'autorisation du lancement production.

## Lot fonctionnel : PagesJaunes cloud, collecte continue et enrichissement prospect (27/11/2026)

Branche `fix/cloud-sources-enrichment-unlimited`, base design PR55/56 (`dfa184a`). Demande du propriétaire : raccorder PagesJaunes au cloud, retirer le plafond total 10/25 des résultats, rebrancher/nettoyer les boutons d'enrichissement du prospect en conservant celui de l'IA. Le split immersif redimensionnable, le focus discret, les reçus d'import et l'historique restent préservés.

Prévoir des lots techniques persistants et enchaînés jusqu'à fin de source, sans quota total de résultats ; garder les reçus/identifiants lors des reprises et autoriser l'import des résultats déjà lus. PagesJaunes réutilise les lecteurs de l'extension sans modifier le ZIP. Les commandes prospect doivent toutes conduire au même parcours cloud ciblé ; supprimer ou renommer les anciens raccourcis trompeurs, sans supprimer le bouton IA. Ne pas supprimer ces notes avant l'autorisation finale de production. Aucun déploiement DockPanel par l'agent.

Validation en cours du lot continu : 342 contrôles API PostgreSQL16 verts, dont 38 résultats enchaînés et reçus conservés après annulation/reprise ; TypeScript et builds verts. Chromium réel vert : 35 détails Maps et pagination PagesJaunes (run 45967168729). Publication des quatre images encore à confirmer avant feu vert.
## Lot design : centre « Collecte et enrichissement » (27/11/2026)

- Le propriétaire valide explicitement la nouvelle maquette ATLAS × ORBIT de `/outils`. Branche isolée `feat/atlas-collection-hub-20261127`, basée sur `fix/growthos-functional-redesign` à `dfa184a` avant modification. Fichiers visuels : `artifacts/growthos/src/pages/CollectionToolsPage.tsx`, nouveau `src/collection-tools.css`, tests SSR du catalogue.
- Deux modes distincts « Trouver des prospects » et « Compléter un prospect », contexte du prospect réel (logo public ou initiales, nom/ville, retour fiche 360°), critères conservés et source mise en évidence. À droite : aide de parcours contextuelle sans prétendre à des recommandations IA calculées. À gauche : cartes de sources disponibles compactes et fonds de couleurs harmonisés ; sous elles : connecteurs assistés en préparation en version réduite.
- **Contrats existants conservés** : le mode `discover` expose l'Annuaire officiel via `/sourcing` et PagesJaunes via `/sourcing` ; `enrich` expose Societe.com avec prospect ciblé ; Google Maps/Search/Bing ouvrent le navigateur cloud avec la requête/zone et l'ID du prospect le cas échéant. Les connecteurs sociaux restent ouvrables dans le navigateur en **mode manuel** (pas de collecteur automatique prétendu). Secours Chrome `beginConnectorTask` accessible dans les options de carte uniquement quand pris en charge. Filtres des outils, état de sélection et retour connecteur préservés.
- Les libellés « Collecteur cloud », « Lecture de fiche », « Données officielles » sont dérivés des capacités existantes ; logos de sources via `SourceLogo`, entreprise via `CompanyLogo`. Aucun contenu de capture, enrichissement ou résultat d'import n'est inventé. Le panneau de droite lance le vrai parcours de la source sélectionnée.
- Tests `scripts/test-collection-tools.mjs` adaptés à la structure de la maquette tout en préservant les contrats de navigation. Ne pas écraser l'interface lors d'une modification fonctionnelle ; ne supprimer ces notes qu'à l'autorisation explicite du lancement final en production.

Synchronisation fonctionnelle PR57 avec design PR58 (`418b39d`) : catalogue redessiné conservé, PagesJaunes discovery/enrich ouvre désormais `/navigateur` avec prospect/critères ; badge Collecteur cloud. Les réseaux restent en consultation manuelle. Correctifs de revue : reprise Google/Bing sur la page choisie ; profil détaillé PagesJaunes validé, SIREN seul conservé, mise à jour versionnée et activité avant/après.

## Enrichissement automatique multisource depuis le prospect (27/11/2026)

Branche `fix/prospect-one-click-enrichment`, base PR57 `ce976aa`. Corriger le faux rapprochement Societe.com (deux SIREN absents ne sont jamais égaux). Le bouton Enrichir reste sur la fiche, crée une tâche persistante et consulte Annuaire/INSEE puis les cinq collecteurs cloud disponibles ; progression et bilan sur la fiche. Garder tous les CSS/design PR58, conserver Copilote IA. Navigateur uniquement pour les interventions, jamais le premier clic du parcours automatique. Notes à conserver jusqu’au lancement final explicitement autorisé. Aucun déploiement DockPanel par l’agent.

Validation locale du lot : 359 contrôles API PostgreSQL16 passent, dont le faux rapprochement Kevin Duville refusé, la résolution d’une enseigne par l’Annuaire, le double clic idempotent, la reprise du processus, les conflits entre sources et la pagination/import Annuaire native. L’archive conserve les anciennes recherches dans le même écran. Les CSS restent identiques à PR58. Contrôle Chromium et CI images à suivre avant feu vert.

Revue PR59 : un SIREN commun exige des coordonnées d’établissement concordantes quand le SIRET entrant manque ; zone géographique recontrôlée pour chaque établissement (siège hors zone exclu) ; portée APE conservée et repli unité légale proposé sans écraser le code ou remplir un libellé incohérent. API INSEE directe et conservation de 65 résultats historiques testées. Chromium réel vert sur fixtures ; relance du contrôle sur le dernier correctif avant fusion.

## Correctif sur sources réelles après PR59 (27/11/2026)

Branche isolée `fix/enrichment-live-source-parsers`, base `de8bd6c`. Retour du propriétaire : enrichissement Nord Artisan sans résultat. Diagnostic public : l’Annuaire trouve bien l’ancien établissement 97996550600012 (fermé le 14/03/2025), mais BUREAU 3 empêchait le rapprochement avec 38 Bd Carnot ; siège actif 00020 à une autre adresse. Societe.com utilise des liens superposés vides avec aria-label et des dirigeants sous /manager/. Google Maps peut afficher une fiche détaillée sans quitter /maps/search/. PagesJaunes renvoie un vrai contrôle Cloudflare, dont les ressources n’étaient pas autorisées.

Périmètre : lecteurs/validation API/rapprochement et tests réalistes, filtres des tâches par source dans le navigateur, sans CSS/design. Recherche Societe.com par nom seul puis sélection nom/ville ; comparaison finale avec les coordonnées. Détails légaux du même SIREN utilisables sans déplacer l’établissement CRM vers le nouveau siège. Google/Bing distinguent liens organiques sans nouveaux champs, page vide et intervention ; aucun résultat inventé. Autoriser uniquement l’hôte officiel challenges.cloudflare.com pour afficher le contrôle, sans contournement ni résolution automatique. Les autres sources continuent.

Fixture publique Annuaire et structure DOM observée documentées dans `workers/cloud-browser/fixtures/README.md`. Le lecteur Societe.com partagé est corrigé aussi pour le secours Chrome : la CI de publication du ZIP doit être vérifiée. Tests et publication des images encore en cours ; **pas encore prêt à redéployer**. Notes à conserver jusqu’à autorisation finale de production.

## Sources Pappers / BODACC et onglet Enrichissements (27/11/2026)

Demande supplémentaire du propriétaire pendant la correction PR60. Branche `feat/pappers-bodacc-public-sources`, basée sur PR60. Ajouter Pappers via le navigateur public maison (SIREN confirmé, informations visibles, dirigeants et finances datées ; données réservées laissées absentes). Ajouter le BODACC par son API publique officielle DILA, paginée et filtrée/recontrôlée sur le SIREN exact, sans abonnement ni intermédiaire commercial. Historique des annonces distinct du statut actuel ; relecture inchangée sans activité fictive et nouvelle annonce/version tracée.

La fiche reçoit un onglet Enrichissements reprenant progression, provenance, captures et activités réelles. Le lancement principal reste sur la fiche et ouvre cet onglet. Fichiers partagés `ProspectDetailPage.tsx`, `ProspectCompanyProfile.tsx`, `CloudBrowserPage.tsx`, catalogue : seulement raccordement de données/commandes ; conserver tous les CSS et le thème de l’agent design. Pappers et BODACC ne prétendent pas être pris en charge dans le secours Chrome ; aucun ajout d’autorisation Chrome. Publication et tests en cours. Aucun déploiement DockPanel. Notes à conserver jusqu’au lancement final explicitement autorisé.

PR60 fusionnée à `49892868e29564115295476bc2d84dac87234948` ; 361 contrôles API locaux verts et Chromium réel vert (run `45986575271`, head `7691976`). Le lot Pappers/BODACC/onglet suit sur sa propre branche, sans feu vert intermédiaire de redéploiement.

Validation locale du lot Pappers/BODACC/onglet : **369 contrôles API PostgreSQL 16**, TypeScript API/Web, compilation Web/API, sources/SSR/contacts verts. Le BODACC est testé sur 105 annonces en pagination, sur relecture stable sans activité dupliquée et correction réelle avec version précédente. Recette Chromium Pappers dans la PR61 ; aucun changement de CSS.

Revue PR61 : curseur BODACC et instantané enregistrés dans la même transaction, dernière page idempotente après interruption ; pagination liée au SIREN et remise à zéro après correction d’identité. **371 contrôles API** passent, dont les deux scénarios de reprise/correction. Chromium Pappers vert sur le premier head (run `45988161584`), aucune modification du lecteur dans ce complément ; nouvelle CI avant fusion.
