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
