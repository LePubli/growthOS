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

## Lot design : dossier complémentaire et contacts (26/11/2026)

- Branche isolée : `feat/atlas-orbit-deep-details-20261126`, cible `fix/growthos-functional-redesign`. L'objectif est d'aligner **tous les blocs sous « Informations détaillées, édition et historique »** sur les cartes ATLAS × ORBIT, et non de les afficher avec l'ancienne charte.
- Fichiers UX : `src/atlas-prospect-details.css` (import dans `src/index.css`), `src/pages/ProspectDetailPage.tsx`, `src/components/ProspectCompanyProfile.tsx`, `src/components/atlas/Prospect360Dashboard.tsx`, `src/components/common/CommentsPanel.tsx` sous `artifacts/growthos/`.
- **Contacts harmonisés** : `src/lib/prospect-people.ts` lit les contacts dirigeants et leurs fonctions de la capture Societe.com, les dirigeants du relevé officiel de surveillance et le nom éventuel du CRM ; dédoublonne et ne présente comme « directes » que les coordonnées rattachées explicitement à une personne. La synthèse 360° et le répertoire détaillé lisent **la même liste**. Test régression : `scripts/test-prospect-people.mjs` (workflow préprod inclus).
- La colonne droite ancienne (Informations / 2e complétude / Actions rapides dupliquées) est remplacée par la **traçabilité** et l'outil d'enrichissement spécifique. L'enrichissement, la veille, la comparaison, les modifications, la localisation et le journal des changements restent utilisables. Les longues descriptions des activités `data_update` restent accessibles dans des détails repliables, tandis que ces événements ne sont plus répétés dans les commentaires d'équipe.
- **Points d'interface avec l'autre agent** : conserver les API `/prospects/:id/monitoring`, `/prospects/:id/verify-company`, `/activities` et `/enrich/:id`, les protections des activités automatiques, ainsi que les callbacks de rafraîchissement. Le lot design n'introduit aucun changement de schéma serveur et ne doit pas remplacer une correction fonctionnelle parallèle de `ProspectDetailPage.tsx` ou `ProspectCompanyProfile.tsx`. Synchroniser la base avant fusion.
- Cette note temporaire reste présente jusqu'à l'autorisation explicite de production finale. **Publication / CI : en attente de mise à jour à la fusion.**
