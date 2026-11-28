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

## Lot demandé : validation d’enrichissement, site web, cartographie et complétude (27/11/2026)

Branche isolée `fix/prospect-enrichment-validation-and-website`, base préprod PR61. Priorité au blocage réel signalé : « Vérifier cette source » puis « Reprendre » ne permet pas de confirmer la bonne identité, notamment enseigne différente du nom légal. Ajouter comparaison et confirmation explicite, protéger les identifiants contradictoires, enregistrer et actualiser le bilan parent ; tester le parcours complet, pas seulement la lecture.

Autres exigences du même lot : inclure le site déjà renseigné dans l’enrichissement (Contact, mentions légales, coordonnées/réseaux avec preuves), distinguer email publié et hypothèse sans prétendre valider une boîte sur la seule présence d’un MX ; priorité aux relations Societe.com, Pappers en repli si données absentes ; même calcul documentaire et mêmes données entre aperçu et fiche 360°, supprimer le calcul divergent par quart.

Réseau : l’IP d’un navigateur distant reste celle du serveur. Le mode local doit réellement exécuter la lecture sur l’appareil via l’extension autorisée, sans usurper le navigateur ou contourner un contrôle. Les comptes/sessions restent isolés. Pas de promesse de mode local Android par simple réglage Web ; documenter la capacité effective.

Conserver tous les CSS/thème et les notes de l’agent design. Le catalogue des 306 sources (PR62) reste différé après recette, hors de ce correctif. Aucun déploiement DockPanel par l’agent. Statut : en cours ; tests et images à vérifier avant feu vert.
## Lot design : tableau de suivi Enrichissements (27/11/2026)

- Maquette ATLAS × ORBIT validée (« parfait ») par le propriétaire et remarque sur les titres insuffisamment gras. Branche isolée `feat/atlas-enrichment-tab-20261127`, base `fix/growthos-functional-redesign` à `a1083fe` après fusion PR61.
- Redesign strictement visuel de `components/ProspectEnrichmentsTab.tsx`, styles isolés `src/prospect-enrichments.css`. Bilan chiffré issu des **vrais** `run.steps`, états filtrables, logo source, actions de reprise uniquement si `jobId` présent, panneau des trois priorités, derniers champs réellement remplis et captures compactes (les autres restent accessibles), modifications tracées et données publiques Pappers/BODACC préservées dans des sections dépliables.
- Correction des graisses de police globales : `index.html` charge Inter 800 et 900, précédemment demandés par les composants mais absents du chargement ; monogramme Annuaire pour la clé fonctionnelle `entreprises` ajouté. Aucun changement serveur, au processus d'enrichissement, à la fusion des données ni aux contrôles d'identité.
- Tests SSR `scripts/test-prospect-enrichments.mjs` ajoutés et assertion SSR ancienne `scripts/test-prospect-enrichment-actions.mjs` alignée sur les nouveaux libellés. TypeScript Web, build Vite, tests Harmony/logos/collecte/enrichissement vérifiés localement. Publication GHCR et fusion à confirmer avant annonce de redéploiement. **Ne pas retirer les notes au prochain déploiement.**

## Lot design : extension Chrome ATLAS × ORBIT (27/11/2026)

- Propriétaire : maquettes de l'extension « Recherche » et « Collecte » explicitement validées (« parfait »). Branche isolée `feat/atlas-chrome-popup-20261127`, base `fix/growthos-functional-redesign` à `cb9fa77` (après PR63). L'autre agent peut continuer les tâches cloud, Pappers/BODACC et CRM sur sa branche ; ne pas réécrire ce lot visuel sans coordination.
- Fichiers : `extensions/growthos-pagesjaunes/popup.html`, `popup.css`, `popup.js` (écrans compacts, sources, KPIs, états, sélection réelle, validation assistée), `background.js` (pause Maps entre deux fiches, reprise sur les chemins non vus) ; `artifacts/growthos/src/pages/ConnectorImportPage.tsx` (présélection des IDs du popup via fragment d'URL, recoupés strictement avec les captures locales importables) ; `scripts/test-multisource-extension.mjs` (régression).
- **Contrat fonctionnel à conserver** : aucune création/import CRM depuis l'extension ; clic final ouvre GrowthOS pour confirmation et import. Les brouillons avec au moins téléphone, site ou adresse peuvent être importés sans SIREN/SIRET/CP inventé. Pas de permission Chrome supplémentaire ; pas de changement du pont ou de l'API. `#taskRead`, `#taskPreview`, `#taskFinish` et tous les contrôles manuels restent opérationnels.
- Notes à conserver jusqu'au lancement final expressément autorisé. Fusion, CI et ZIP Chrome à signaler une fois vérifiés ; aucun redéploiement DockPanel par cet agent.

## Lot extension : panneau latéral permanent (27/11/2026)

- Demande du propriétaire : remplacer le popup qui disparaît au changement d'onglet par un **Side Panel Chrome global**, pleine hauteur, avec **réduire** (mode compact du contenu) et **×** (fermeture native), réouvert par l'icône épinglée.
- Branche design isolée `feat/atlas-persistent-sidepanel-20261127`, basée sur le merge PR64 `05449cfd`. Modifie exclusivement `extensions/growthos-pagesjaunes/{manifest.json,background.js,popup.html,popup.css,popup.js,INSTALLATION.md}` et le test `scripts/test-multisource-extension.mjs`.
- Manifest : `sidePanel` et `side_panel.default_path=popup.html`, suppression de `action.default_popup`, Chrome minimum 141 pour `sidePanel.close`. Panneau **global** (pas de `tabId` spécifique) pour rester ouvert entre sites ; aucun accès hôte supplémentaire.
- Un changement d'onglet synchronise la source sans vider la recherche ou la sélection ; les tâches d'enrichissement contextuel se synchronisent sur changement de stockage. Les anciennes fermetures automatiques après ouverture de source, lecture ou confirmation sont supprimées. `sidePanel.setPanelBehavior({openPanelOnActionClick:true})` ouvre/ferme via icône Chrome.
- Important pour l'autre agent : ne pas réintroduire `default_popup`, `window.close()` après les actions ni `sidePanel.setOptions({tabId:...})`, qui casseraient la persistance. La largeur Chrome ne peut pas être réduite par programme ; « − » replie les commandes, « × » ferme entièrement.
- Garder ce chapitre et les autres notes jusqu'à autorisation de lancement production ; publication du ZIP et annonce seulement après CI de l'extension vérifiée.

## Correctif design : fiche 360° avec panneau latéral Chrome ouvert (27/11/2026)

- Retour propriétaire sur captures : en réduisant l'espace horizontal avec le panneau Chrome et le menu GrowthOS, la fiche 360° conserve ses trois puis quatre colonnes ; la quatrième carte déborde, les titres et boutons se chevauchent et « Nom commercial / nom affiché » empiète sur sa valeur.
- Branche design isolée `fix/atlas-prospect-sidepanel-responsive-20261127`, basée sur `fix/growthos-functional-redesign` après PR68. Périmètre limité à `artifacts/growthos/src/atlas-prospect-360.css` et aux assertions `scripts/test-prospect-harmony.mjs` ; **aucune logique de collecte, statut, source ou contact modifiée**.
- Le conteneur de la fiche réagit à sa largeur réelle (`@container prospect-360`), indépendamment de `window.innerWidth` et de l'état du panneau Chrome. Grille 3/2/1 colonnes en haut, 4/2/1 en bas ; Copilote IA à droite tant que deux colonnes sont praticables, sinon sous les données. Titres et CTA reviennent à la ligne, et la grille des données légales ne totalise plus 100 % plus son espacement.
- Conserver ces règles lors des changements fonctionnels sur `Prospect360Dashboard.tsx` ou `ProspectDetailPage.tsx`. Conserver toutes les notes de coordination jusqu'à l'autorisation explicite de mise en production finale par le propriétaire.

**Rectification demandée par le propriétaire après PR69** : la grille responsive à conteneur a trop bouleversé le design validé. Branche isolée `fix/atlas-prospect-wrap-only-20261127` : **supprimer `container:prospect-360`, ses quatre `@container` et l'ajustement du `main`**, pour rétablir exactement les proportions et positions des cartes d'origine. Conserver seulement `flex-wrap` et `white-space:normal` sur les en-têtes/boutons et les libellés légaux ; conserver les **36 %** d'origine pour la colonne des intitulés en retranchant correctement le `gap` du total. Ne pas réintroduire de reconfiguration des colonnes sans nouvelle validation visuelle. Aucun code métier modifié ; notes à garder jusqu'au lancement production autorisé.

**Retour arrière final demandé par le propriétaire (PR après #70)** : toutes les retouches CSS Prospect 360° des PR69 et PR70 sont annulées ; rétablissement **à l'octet près** de `artifacts/growthos/src/atlas-prospect-360.css` et `scripts/test-prospect-harmony.mjs` tels qu'au merge `cc773a5` (avant PR69). Ne modifier à nouveau ni la grille ni les retours à la ligne sans maquette validée. Les autres apports et les notes des agents restent inchangés jusqu'à l'autorisation explicite de production.

## Contrat permanent pour le centre de diagnostic (27/11/2026)

- Demande explicite du propriétaire : **chaque nouveau développement doit aussi étendre la couverture du diagnostic** ; les deux agents doivent appliquer ce contrat dans chaque PR.
- Branche isolée du centre : `feat/growthos-diagnostic-center-20261127`, base `fix/growthos-functional-redesign` après PR71. Ne touche pas au CSS de la fiche Prospect 360° ; ajoute `/admin/diagnostics`, la table `diagnostic_events` isolée par tenant, les erreurs/latences de toutes les routes API, les erreurs navigateur/React et les phases des tâches cloud/enrichissement. Rapport JSON filtrable pour échanges inter-agents.
- **Référence obligatoire :** [docs/DIAGNOSTICS-CONTRACT.md](docs/DIAGNOSTICS-CONTRACT.md). Toute nouvelle fonctionnalité doit émettre des événements métier détaillés via `recordDiagnosticEvent` en complément du suivi HTTP automatique, faire tester ses erreurs et mettre à jour les codes/causes remédiations documentés. Aucun mot de passe, cookie, HTML, capture, corps de requête ni donnée personnelle dans les diagnostics.
- Ce centre complète la page « Santé technique » actuelle, il ne la supprime pas. Les incidents d'infrastructure sans connexion API/DB restent visibles dans DockPanel. Notes de coordination **à conserver** jusqu'à l'autorisation finale de production par le propriétaire.
- Ajout express : **diagnostic des erreurs par source ET de leur cause**. Chaque nouveau collecteur doit déclarer un code, le motif brut expurgé, le diagnostic qualifié (`observed`/`likely`/`unknown`) et l'action corrective, dans `lib/source-diagnosis.ts` ou un adaptateur équivalent. Les blocages Cloudflare, HTTP 429, délais, accès, identité incertaine et résultats vides sont déjà distingués. Le moteur ne doit jamais prétendre connaître une cause non démontrée.

### Retour de recette du rapport exporté (27/11/2026)

- Le propriétaire a transmis `growthos-diagnostic-2026-11-27.json` (export généré à 19:17:58 UTC). Résumé sur les tâches historiques : 120 collectes cloud, dont **88 `awaiting_user`, 14 `needs_review`, 3 `failed`** et 15 terminées ; 19 enrichissements, dont 16 partiels et 3 à revoir. Le rapport ne contient encore aucun événement technique récent : les tâches remontent majoritairement à avant la pose des nouvelles sondes.
- Les motifs historiques confirment principalement **PagesJaunes : challenge Cloudflare**, **Bing/Google Search : aucune fiche ou résultat lisible**, **Pappers : SIREN non confirmé / fiche publique à ouvrir**, **Societe.com et Maps : rapprochement d'identité incertain**, **INSEE direct : option non configurée**. Les trois erreurs worker `502` anciennes conservent une cause exacte inconnue ; ne pas prétendre la déduire de leur message générique.
- Correctif isolé `fix/diagnostics-source-reasons-20261127` : le centre lit désormais `cloud_browser_jobs.result->>'message'` en complément de `error`, tant dans le rapport de tâches que la synthèse des sources. Classification explicite des résultats illisibles, du prérequis SIREN, du site absent, des fiches publiques à ouvrir et des erreurs génériques worker. **Aucune logique de collecte ou de validation d'identité modifiée.** Ces points métier restent à corriger séparément par l'agent fonctionnel, en conservant le design validé.

Validation du lot (PR66) : **386 contrôles API avec PostgreSQL jetable**, dont confirmation d’une enseigne différente, remplacement choisi de ville/téléphone, refus d’identifiants contradictoires, changement concurrent, idempotence, isolation et réconciliation du bilan parent avec reprogrammation des sources dépendantes. Lecture Contact/mentions, email publié et preuve par champ, réseaux, hypothèses non confirmées, SSRF/DNS/redirections testés. TypeScript API/Web, builds API/Web et tests interface/extension verts. Chromium réel vert : run `46019713873` sur `85f1a37`. Dernier design ATLAS et panneau Chrome persistant (`cc78fa0`) intégrés sans modification de CSS. Publication des quatre images sur le head final restant à contrôler avant feu vert. Aucun déploiement DockPanel ; notes conservées, catalogue 306 sources différé.

## Correctif noms et validation simplifiée (27/11/2026)

Branche isolée `fix/prospect-names-and-conflict-validation`, base PR66 `b7dbe12`. Retours utilisateur : désaccord bloqué « La valeur CRM a changé » après une mise à jour officielle ; raison sociale écrase le nom commercial ; validation affiche une comparaison sans terminer ; secours IP PC ouvre seulement la source sans commandes visibles.

Travail : conserver `company` comme nom affiché, enregistrer raison sociale et enseignes dans `sourceDetails.identity` avec source/historique ; empêcher Societe.com et la veille de renommer automatiquement le prospect. Résoudre les désaccords sur la valeur actuelle réellement affichée, acquitter une proposition déjà appliquée et conserver la protection contre une véritable écriture concurrente. Comparaison et validation directement dans l’onglet Enrichissements, un seul clic explicite pour appliquer les champs vides et les remplacements visibles cochés ; changement du nom affiché facultatif et décoché par défaut.

Secours Chrome : ouvrir les commandes du panneau sur le geste initial, onglet de secours si Chrome refuse ; lecture de l’onglet source mémorisé ; permission optionnelle demandée seulement pour la source choisie (aucun hôte obligatoire supplémentaire), lecture et retour vers la comparaison CRM. Corriger la saisie assistée masquée par son conteneur. Garder le design ATLAS et tous les CSS ; aucune action DockPanel, aucun lancement production ni suppression de notes. Tests/publication en cours.

Validation locale finale du correctif : **394 contrôles PostgreSQL verts**, dont l’adresse reformattée de la capture utilisateur, acquittement d’une valeur déjà appliquée, double validation sans activité répétée, restauration explicite d’un nom affiché sans perte de raison sociale, protection concurrente et confirmation malgré une actualisation de métadonnées. Tests des noms (plusieurs enseignes / même SIRET / priorité Annuaire), TypeScript API/Web, build Web et tests interface/extension verts. Bouton de validation placé avant le tableau avec message de succès. Extension 0.11.2 : accès source optionnel, panneau ou onglet de commandes de secours, suivi du nouvel onglet source. PR67 ; Chromium et publication des images à vérifier avant feu vert. Notes à conserver ; aucun déploiement DockPanel.

Complément de livraison PR67 : la validation fonctionnelle finale est verte (394 contrôles, Chromium réel avec styles du panneau), mais la construction Docker Web a révélé un oubli de copie du nouveau module pur `lib/api-zod/src/prospect-names.ts`. Branche `fix/web-business-names-build` : ajouter ce seul fichier au contexte du builder, sans changement de dépendances ou de logique. Les images doivent être vérifiées sur le nouveau commit avant feu vert ; l’extension 0.11.2 déjà empaquetée reste identique. Aucun redéploiement DockPanel effectué.

## Correctif de recette diagnostic 3 : comparaison prématurée et sources (27/11/2026)

- Retour propriétaire : le troisième export contient enfin 40 événements, dont une fausse erreur technique `BROWSER_OPERATION_FAILED` associée au GET `/jobs/:id/review` (409 « Aucune fiche capturée »). Un écran « Comparer » peut être ouvert depuis une source `awaiting_user` même si aucun résultat n'existe. Branche isolée `fix/diagnostics-review-preflight-20261127`, sur la branche préproduction après PR73.
- Correction UX ciblée : dans l'onglet Enrichissements, les sources `awaiting_user` conduisent au navigateur cloud et les `needs_review` à la comparaison. Le composant de comparaison vérifie l'existence d'une capture persistée avant d'appeler `/review`, et affiche une consigne sans erreur dans le cas contraire. Aucun style ou maillage Prospect 360° changé.
- Diagnostic : un HTTP 409 attendu lors de la vérification devient `CAPTURE_REQUIRED`, niveau `warn`, cause `SOURCE_CAPTURE_REQUIRED` ; autres erreurs métier 4xx restent des avertissements et les vraies pannes 5xx conservent le niveau `error`. Les traces API restent disponibles. Le correctif PR73 `result.message` doit être redéployé pour que les exports historiques n'affichent plus des messages cloud vides.
- Sources : Google/Bing attendent brièvement l'apparition de vrais liens organiques si seule la structure de page est chargée ; Pappers lit aussi les libellés visibles imbriqués, **sans jamais accepter un SIREN différent de l'URL**. Cloudflare PagesJaunes nécessite toujours l'intervention humaine autorisée : aucun contournement. Recette Chromium sur fixtures attendue en CI, navigateur Chromium non installé localement.
- **À reprendre par l'agent fonctionnel** : investiguer les résultats réels Google/Bing toujours illisibles et les pages Pappers qui ne montrent pas le SIREN ; une récupération automatique sans preuve ne doit pas être introduite. Ces notes sont temporaires et ne seront retirées qu'avec l'autorisation explicite du propriétaire au lancement final production.

## Lot fonctionnel : preuves, coordonnées multiples et validation locale (27/11/2026)

Branche isolée `fix/enrichment-evidence-contacts-and-local-confirmation`, base PR74 `ceb71b4`. Investiguer les confirmations locales qui renvoient à tort une indisponibilité navigateur ; étendre les diagnostics corrélés et expurgés. Conserver toutes les coordonnées publiées avec preuve, lire l'éditeur des mentions légales et présenter les contacts nominatifs issus des sources dans le répertoire réel. Aucun CSS/thème ni style Prospect 360° modifié. Précontrôle de capture PR74 conservé. Ne pas supprimer les notes ; aucun déploiement DockPanel par l'agent. Validation et publication à suivre.

Complément de recette de ce lot : erreur de validation 409 conservée à l'écran (l'ancien rechargement l'effaçait), doublon SIRET classé `CRM_IDENTITY_DUPLICATE` avec trace et SQLSTATE expurgé, validation Chrome locale testée sans worker disponible. Les coordonnées multiples sont persistées dans `sourceDetails.contactPoints` avec source/preuve/personne/établissement ; la principale reste un choix distinct, protégé contre les écritures concurrentes. `GET /contacts` lit les personnes réellement enregistrées dans les sources/veille, sans créer de prospect supplémentaire ni attribuer le standard à un dirigeant. Mentions légales : éditeur et identité distingués de l'hébergeur ; le titre commercial reste intact. Tests TypeScript, Vite, lecteurs, extension, diagnostic et Harmony verts ; recette PostgreSQL complète et images encore à confirmer avant annonce.

Recette locale complète du lot : **417 contrôles PostgreSQL verts**, dont enchaînement site → Annuaire → répertoire Contacts, raison sociale distincte du nom commercial. Chromium réel CI PR75 vert (`46063946850`), lecteurs Societe/Pappers/Maps et panneau Chrome. Complément de compatibilité : conserver une entrée « Coordonnées générales de l’entreprise » distincte des dirigeants dans Contacts, y compris les contacts CRM sans nom ; recherche dans tous les emails/téléphones. Deux assertions d'intégration ajoutées pour vérifier cette séparation ; recette finale et publication GHCR à vérifier sur le commit partagé avant annonce. Aucun CSS modifié, notes conservées.

Relecture PR75 : deux cas supplémentaires corrigés avant fusion. Le choix d'une principale persiste atomiquement toutes les coordonnées précédentes, y compris une saisie manuelle absente des anciens snapshots. Les libellés d'hébergeur en paragraphes ou texte gras sont exclus comme les titres HTML ; un nouveau bloc Éditeur peut ensuite être lu normalement. Tests de régression ajoutés (réutilisation de l'ancienne principale et identifiants/mail de l'hébergeur absents). Garder les messages d'erreur de comparaison et les styles inchangés. Recette et publication finales en cours.

## Relais urgent de l'utilisateur : parcours de vérification cloud en un clic (27/11/2026)

**NOUVELLE PRIORITÉ PRODUIT pour l'agent fonctionnel.** Le propriétaire signale que « vérifier → valider » sur le navigateur cloud est trop compliqué, que la validation ne s'enregistre pas toujours et qu'il doit retourner manuellement chercher la fiche prospect. La correction actuelle des cas `409` et de la confirmation locale en PR74/75 ne règle pas ce parcours de bout en bout.

**Spécification détaillée : [`docs/design/PARCOURS-VALIDATION-SOURCES-ONE-CLICK.md`](docs/design/PARCOURS-VALIDATION-SOURCES-ONE-CLICK.md).** À lire avant tout nouveau lot cloud/CRM. Elle exige : ouverture contextualisée depuis la fiche ; lecture/reprise sans boutons redondants ; comparaison dans le flux dès qu'une capture existe ; un seul « Valider et enregistrer » ; succès réel et mise à jour du bilan parent ; **retour automatique au même prospect, onglet Enrichissements actif** ; gestion claire des sessions `409/423`, des doublons et des échecs sans perte de capture. Recette E2E obligatoire jusqu'au retour à l'onglet, pas seulement un POST 200.

Le futur relais réseau via IP du PC est **un chantier distinct et non un prérequis** pour ce parcours. Éviter que le travail sur le proxy/extension ralentisse la réparation UX. Ce lot est **documentaire uniquement** : aucune API, aucun collecteur ni CSS modifiés. L'agent fonctionnel reste propriétaire de l'implémentation après PR75 (`30f98d5`). Ne retirer cette note et les autres que sur autorisation explicite du propriétaire au lancement final production.

## Lot Plombeo : enquête depuis le site et retour de validation (27/11/2026)

Branche fonctionnelle isolée `fix/website-investigation-and-source-review`, base PR76 `17cf2f9`. Lecture faite de la spécification `docs/design/PARCOURS-VALIDATION-SOURCES-ONE-CLICK.md` : réaliser le retour automatique dans le même prospect/onglet après sauvegarde réelle, ouvrir la comparaison à l'arrivée d'une capture, conserver contexte et erreurs 409/423. Aucun CSS/thème modifié.

Cas fourni : le rapport de Plombeo lit une seule page, repère email/téléphone mais n'applique rien et perd le LinkedIn personnel (validateur réservé aux pages `/company/`). Site à reproduire : `https://plombier-chauffagiste-lille.fr/`. Étendre la lecture à l'accueil, aux blocs de contact, pages utiles et réseaux publiés ; conserver des pistes nominatives sourcées et les recouper avec enseigne/identité officielle. Un intitulé LinkedIn « plombier chez … » n'est pas une preuve de gérance ; un nom dans l'URL est une piste, pas un contact confirmé. Diagnostics expurgés pour les pages refusées/illisibles et décisions de rapprochement. Proxy/IP locale et catalogue des nouvelles sources restent distincts. Notes conservées jusqu'à autorisation de production ; aucun déploiement DockPanel par l'agent.

Recette PR77 : **430 contrôles PostgreSQL locaux** verts, dont site → nom public → Annuaire → identité/dirigeant avec conservation de l'enseigne, et refus d'un retour de succès avant sauvegarde. Tests de lecteurs, contacts, diagnostics, TypeScript API/Web et builds verts. Nouveau test Chromium sur les vraies pages React : cinq scénarios (lecture nécessaire, capture prête, déjà enregistré, session 409, profil 423) jusqu'au bon prospect/onglet et rechargement. Le premier head passe ces cinq scénarios en CI ; tests des lecteurs et images du head final à contrôler avant feu vert. Aucun CSS modifié ; extension inchangée.

Relecture PR77 : bloquer aussi les identifiants du site contradictoires avec le candidat d'enquête, sans se limiter aux identifiants déjà dans le CRM. Séparer strictement recherche d'entreprises et vérification ciblée ; retour depuis l'historique contrôlé sur la tâche effectivement enregistrée. Régressions ajoutées : SIREN/SIRET publiés divergents, validation depuis l'historique global et deux recherches successives après consultation de résultats terminés.

Complément de recette : conservation des remplacements choisis après un conflit CRM et actualisation de la comparaison, sans retour prématuré. Suite Chromium portée à huit scénarios ; ouverture explicite du tiroir d'historique dans les tests (la charte le garde fermé par défaut). Aucun changement CSS.

## Blocages constatés par le propriétaire après PR77 — navigateur cloud mobile (28/11/2026)

**Priorité haute pour l'agent fonctionnel à son retour.** Trois captures d'écran Android/Chrome fournies par le propriétaire montrent que la CI verte et la publication des images du merge PR77 `e93d99b` **n'ont pas résolu le parcours réellement utilisé**. Ne pas déclarer cette fonctionnalité terminée sans recette sur le logiciel déployé. L'agent design ne modifie ni le navigateur ni le moteur durant cette reprise : l'agent fonctionnel reste responsable des corrections et des tests associés.

### Reproduction remontée

- Fiche CRM **Plombeo**, navigation cloud vers Societe.com avec recherche **Slimane Ladjal** ; la source visible affiche « MONSIEUR SLIMANE LADJAL » et le SIRET `90746221200024`, tandis que le CRM annonce « Identifiant absent ». La tâche indique « À vérifier » et « Le rapprochement n'est pas certain ».
- Sur téléphone (capture Android/Chrome, environ 360–400 px CSS), l'aperçu distant de Societe.com est réduit à une toute petite page desktop : les coordonnées et mentions ne sont pas lisibles, malgré « Session active » et « Reprendre le contrôle ».
- La section « Vérification de Plombeo » puis le panneau « Comparer et valider cette fiche » débordent ou sont **coupés avant la fin des explications, des champs et de l'action de confirmation**. Le tiroir « Tâches récentes » s'affiche ensuite ; l'utilisateur ne peut pas prendre connaissance de l'intégralité des données ni atteindre une validation utilisable.
- Le parcours comporte encore plusieurs actions et une descente pénible dans la page. Le propriétaire signale explicitement **aucune amélioration perceptible** par rapport aux problèmes de validation précédemment signalés.

### Critères obligatoires de correction et de recette

1. **Lisibilité mobile :** rendre la lecture de la source réellement utilisable sur 360–400 px (agrandissement/pan/plein écran du flux distant si nécessaire, sans prétendre modifier le site tiers), avec texte et contrôles consultables. Conserver aussi le rendu desktop ATLAS × ORBIT validé.
2. **Comparaison intégrale :** aucun parent `overflow`, `max-height` ou conteneur ne doit tronquer le panneau ; toutes les informations, preuves, valeurs avant/après, cases de choix, erreurs et le bouton « Valider et enregistrer » doivent être accessibles au clavier, à la souris et au toucher. Prévoir le défilement et le retour du focus ; tester avec des textes longs et plusieurs champs divergents.
3. **Identité non certaine :** ne jamais assimiler automatiquement Plombeo à Slimane Ladjal sur le seul nom ou le seul SIRET présenté par la source. Expliquer clairement pourquoi le rapprochement est bloqué, afficher les preuves nécessaires et permettre de revenir/rechercher la bonne entreprise sans écraser le prospect.
4. **Retour garanti après sauvegarde :** une fois la sauvegarde CRM effectivement confirmée, **aucun rafraîchissement secondaire** (`/activities`, `/prospects/:id/enrichment`, etc.) ni panne transitoire ne doit empêcher le retour vers la même fiche Prospect 360° → Enrichissements. Vérifier également le serveur `finish-review` : une lecture de bilan échouée ne doit pas transformer une sauvegarde réussie en navigation bloquée. Afficher un avertissement de rafraîchissement si nécessaire, sans annoncer une fausse réussite et sans doublons à la reprise.
5. **Recette réelle et tests de non-régression :** mobile Android/Chrome avec une tâche Societe.com existante, fenêtre étroite sur PC, source sans correspondance, capture longue, échec d'une requête juste après confirmation, retour automatique au bon prospect, puis rechargement. Compléter les tests React/Chromium sur viewport mobile ; conserver diagnostics par source/tâche/prospect/trace. Les fixtures vertes seules ne constituent pas l'acceptation utilisateur.

**Remise :** conserver les notes et les choix UX déjà validés ; annoncer explicitement les commits, le statut CI/GHCR et la disponibilité pour DockPanel seulement après ces vérifications. Aucune suppression de `COORDINATION-AGENTS.md` avant le lancement final en production autorisé par le propriétaire.

## Reprise fonctionnelle mobile et retour après sauvegarde (28/11/2026)

Branche isolée `fix/mobile-source-review-and-save-return`, base partagée `d4832d8`. Prise en charge du retour réel Android relayé par l'agent design : panneau coupé par la hauteur fixe/overflow du conteneur de résultats, image distante desktop illisible, rafraîchissements secondaires bloquant le retour après une sauvegarde valide. Conserver ATLAS × ORBIT ; seules adaptations fonctionnelles de débordement, accès tactile/zoom et comparaison responsive. Ajouter recette Chromium 360/390 px avec les vrais CSS, textes longs et pannes après confirmation. Ne pas annoncer une recette utilisateur réelle sur le déploiement avant qu'elle ait eu lieu. Aucune action DockPanel, notes conservées.

Recette locale PR79 : **432 contrôles API/PostgreSQL verts**, dont bilan volontairement indisponible pendant `finish-review` après sauvegarde, avec retour autorisé et incident diagnostic corrélé. TypeScript API/Web, builds et tests Harmony/enrichissements/diagnostics verts. La recette Chromium charge maintenant les CSS réels et couvre 13 scénarios, dont 360/390 px, longue comparaison, refus d'identité et pannes de suivi/retour. Une première passe a détecté la largeur intrinsèque de l'image agrandie : panneaux désormais contraints au viewport. Publication/CI finales à contrôler. L'acceptation réelle Android sur le déploiement reste à faire ; pas de promesse de fonctionnement universel des sources bloquées.

## Lot doublons, reprise d'enrichissement et causes diagnostic (28/11/2026)

Propriétaire fonctionnel, branche `fix/prospect-duplicates-enrichment-recovery`, base `221ffd2`. Accord « Go » pour les points 1 à 3 du rapport du 28/11 : identifier la fiche portant déjà le SIRET, comparer/fusionner explicitement sans perdre contacts, sources et historique ; reprendre les étapes échouées après identification ; séparer doublon SQL, occupation du navigateur, panne et page illisible. Conserver les styles ATLAS, le travail design et les notes ; pas de modification des collecteurs Google/Bing dans ce lot, ni déploiement DockPanel. Fusion contrôlée, transactionnelle, avec versions, preuve source, archivage des deux états et reçus idempotents ; aucun changement de données du CRM déployé par l'agent.

Recette et relecture PR81 : 454 contrôles PostgreSQL verts sur le premier lot, parcours Chromium source/fusion desktop et mobile vert sur le premier head. Compléments en cours : preuve de provenance mise à jour avec chaque valeur reprise du donneur, commentaires d'équipe et reçus d'import retargetés, archives avant/après avec changements lisibles, secours Chrome conservé sur les anciens liens fusionnés. Le diagnostic doit prendre la dernière tentative de la source (pas le dernier événement SQL ancien) pour éviter d'attribuer une nouvelle panne réseau à un doublon déjà résolu. Nouvelle recette complète et CI finales à vérifier ; aucun déploiement DockPanel.

Livraison PR81 : commit partagé `1532e2f`, CI et quatre images `:preprod` vertes (run `46102702796`), 464 contrôles PostgreSQL et 15 parcours React/Chromium. Le propriétaire avait déjà supprimé le doublon ; la recette CRM réelle de fusion est reportée au prochain cas.

## Réseaux sociaux trouvés sur le site mais absents de la fiche (28/11/2026)

Branche fonctionnelle `fix/prospect-social-source-links`, base `1532e2f`. Le rapport de 12:03 Paris confirme l'Annuaire et Societe.com, sans nouveau conflit SQL. Deux causes reproduites sur Plombeo : LinkedIn personnel lu mais exclu de l'encart par le validateur réservé aux pages entreprise ; Facebook `/people/nom/identifiant` refusé à la lecture. Afficher ces références avec leur nature, provenance et preuve, sans les promouvoir en page officielle ni déduire un rôle de dirigeant. La prochaine lecture récupérera le Facebook auparavant ignoré ; les LinkedIn personnels déjà conservés doivent apparaître sans nouvelle collecte. Aucun CSS/thème modifié, aucune fusion réelle ni action DockPanel. Google/Bing illisibles, Pappers non confirmé et contrôle PagesJaunes restent distincts. Notes conservées jusqu'à autorisation finale production.

## Registre maître de fonctionnalités et troisième agent proposé (28/11/2026)

Le propriétaire a demandé un **registre détaillé et durable** pour synchroniser jusqu'à trois agents. Lire et tenir à jour [docs/REGISTRE-FONCTIONNALITES.md](docs/REGISTRE-FONCTIONNALITES.md) **avant tout nouveau lot**, en complément de ce fichier et de SUIVI-FONCTIONNEL.md : 116 capacités référencées, état code versus recette réelle, incidents et scénarios de test. Chaque PR qui change une fonction doit actualiser sa ligne, la preuve et la couverture du centre de diagnostic ; ne jamais marquer « validé en usage » par la seule réussite de la CI.

**Troisième agent Extension Chrome (E)** : proposition de répartition, **non encore confirmée comme prise en charge**. Son périmètre recommandé est extensions/growthos-pagesjaunes et les tests/ZIP associés, avec accord explicite en cas de modification des contrats CRM/API du développeur fonctionnel ou du design. Priorité de recette rapportée : permission Google Maps facultative non acquise avant capture dans le Side Panel, notification Chrome « Extension manifest must request permission to access this host » (28/11). Ne modifier ni les CSS Prospect 360° ni les services d'enrichissement d'un autre agent sans coordination.

Cette note et les autres notes temporaires restent conservées jusqu'à l'autorisation explicite du propriétaire pour la mise en production finale. **Le présent lot est purement documentaire : pas de redéploiement DockPanel nécessaire.**

## Prise en charge navigateur utilisateur et extension — 28/11/2026

**Arbitrage explicite du propriétaire dans ce chat : « développe toi l’extension » puis « comme ça tu peux le faire en même temps que ce que tu fais ».** L’agent fonctionnel prend donc aussi le lot extension local sur `feat/local-browser-enrichment`, base partagée `6164eff`. Ne pas modifier en parallèle `extensions/growthos-pagesjaunes`, les nouveaux contrats `/browser/device-*`, ni `LocalBrowserEnrichment.tsx` sans synchronisation. Aucun troisième agent n’est lancé/presumé actif. Le design ATLAS reste au propriétaire design ; aucun CSS existant modifié.

Rapport de 12:32 Paris : deux liens sociaux lus sur Plombeo, Annuaire/Societe.com confirmés, aucun nouvel événement niveau error depuis 12:12 ; 0 champ rempli lors de ces nouveaux passages ne prouve pas une panne (champs déjà présents). Google/Bing illisibles, Pappers non confirmé, PagesJaunes sous contrôle de sécurité. Le réseau local est un exécuteur de lecture, pas un proxy ouvert ni une garantie d’accès.

Premier périmètre : reprendre les sources navigateur du dernier bilan d’un prospect, dans des onglets locaux dédiés et après permissions Chrome explicites ; conserver leurs résultats localement jusqu’au reçu serveur ; réutiliser les tâches source, le contrôle d’identité, les preuves et la comparaison CRM. Lecteur Pappers canonique partagé, aucun rôle ni coordonnée inventé. La file locale continue avec Chrome disponible ; GrowthOS doit être ouvert pour synchroniser. Annuaire/INSEE/BODACC restent sur leurs accès serveur. Chrome Android n’est pas annoncé compatible avec cette extension ordinateur. Une nouvelle version d’extension est nécessaire, distincte du redéploiement Web/API. Recette et publication à suivre ; aucun DockPanel ni changement de données réelles par l’agent. Notes à conserver jusqu’à autorisation finale production.

Recette locale du pilote navigateur utilisateur : **486 contrôles PostgreSQL verts**, TypeScript API/Web et tests des lecteurs, de l’extension, des diagnostics et Harmony verts. La suite Chromium est étendue à 18 parcours React (collecte locale, panne de réception et réponse de préparation perdue), plus l’écran réel de permissions ; exécution CI à confirmer. Les résultats concordants sont appliqués via la politique existante ; preuves alternatives et coordonnées multiples conservées. Aucun CSS historique ni DockPanel modifié. Version extension 0.12.0 à empaqueter avec les quatre images du même SHA avant annonce.

Relecture PR84 : recréer un onglet de source qui a été fermé avant un nouveau lot ; remonter le widget local par identifiant prospect pour ne pas garder les commandes d’un autre dossier. Ajouter une recette React de navigation entre fiches et un test de réouverture d’onglet. Conserver la date de lecture locale lors d’une synchronisation différée (date de réception séparée), et garder les commandes du lot accessibles même depuis une autre fiche. CI à vérifier sur le nouveau head ; aucun DockPanel.

Complément de fiabilité PR84 : arrêt API et arrêt Chrome indépendants, pour que Chrome indisponible ne bloque pas la libération serveur ni ne réactive son ancien état affiché. Une consultation de progression réveille aussi une file locale interrompue. Recette React dédiée à l’arrêt avec Chrome inaccessible ajoutée (20 scénarios au total). Date de lecture locale et date de réception serveur conservées séparément ; 487 contrôles PostgreSQL locaux verts sur la version précédente de ce même contrat API.
