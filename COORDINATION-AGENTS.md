# Coordination temporaire des agents — GrowthOS

Notes de travail demandées par le propriétaire le 26 novembre 2026. À lire avant de modifier des fichiers partagés. Chaque agent peut compléter son périmètre et son état sans effacer les notes de l’autre.

**Suppression : conserver ce fichier et les autres notes temporaires de coordination jusqu’au lancement final en production. Les supprimer lors de ce lancement, sur autorisation explicite du propriétaire. Ne pas considérer une mise à jour de préproduction comme ce lancement.** Le suivi fonctionnel durable reste dans `SUIVI-FONCTIONNEL.md`.

## Répartition annoncée par le propriétaire

| Agent | Périmètre | Coordination |
|---|---|---|
| Agent design, dans une autre conversation | Design du logiciel GrowthOS uniquement | Préserver les contrôles, validations, états de chargement et liaisons de données. Ajouter ici sa branche et ses fichiers lorsqu’ils sont connus. |
| Agent de cette branche `fix/prospect-updates-and-watch-history` | Fonctionnement : enrichissement, veille, mise à jour et traçabilité | Modifications d’interface limitées au parcours demandé et à l’affichage des données. Aucune refonte de la charte, de la navigation générale ou du style. |

## État du travail fonctionnel

- Base livrée : PR 38, fusion `c9110a99d9ee33a8085c44085b8c146d7e57f453`, catalogue `/outils`, enrichissement lié au prospect et Chrome `0.11.0.12`.
- Correction en cours après recette utilisateur : « Lire la fiche » avant la confirmation/retour ; catégorie « Chauffagiste » exclue de l’inférence d’une ville ; même SIRET autorise la comparaison malgré un nom ou une ville erronés ; remplacement explicite des valeurs divergentes.
- Veille activée : appliquer les données officielles d’identité, d’adresse et d’activité pour l’établissement exact, conserver les champs absents, notifier et historiser les valeurs avant/après. Les coordonnées commerciales non fournies par l’Annuaire restent conservées.
- Traçabilité dans les activités de la fiche, avec source, date et valeurs. Les activités automatiques utilisent le type `data_update` et restent en lecture seule.

## Fichiers d’interface partagés à intégrer avec précaution

- `artifacts/growthos/src/pages/ProspectDetailPage.tsx` : rafraîchissement des données et activités après enrichissement/veille, comparaison de valeurs, protection des modifications en cours et affichage de l’historique.
- `artifacts/growthos/src/components/ProspectCompanyProfile.tsx` : dernier résultat de synchronisation et rafraîchissement de la fiche après veille.
- `artifacts/growthos/src/components/ConnectorEnrichmentReturn.tsx` : lien vers la comparaison des données proposées après capture.
- `extensions/growthos-pagesjaunes/popup.html` : ordre fonctionnel lecture → comparaison → confirmation → retour. Préserver les identifiants utilisés par `popup.js`.
- Autres fichiers du lot : API sourcing, service de veille, protection des activités automatiques et tests. Aucun changement de thème global.

## Règles de synchronisation

- Travailler sur des branches distinctes, publier des PR ciblées et relire les modifications de la branche de préproduction avant chaque fusion.
- En cas de fichier commun, intégrer les changements des deux agents : conserver le design de l’agent design et le comportement validé de l’agent fonctionnel.
- Ne pas remplacer un fichier entier par une ancienne copie pour résoudre un conflit.
- Inscrire ici les changements de périmètre, points bloquants et résultats utiles. Ne jamais inscrire de secrets, mots de passe ou cookies.
- Déploiement DockPanel laissé au propriétaire. Le lancement final en production reste soumis à son autorisation.

## Relais design

Branche, PR et fichiers de l’agent design : à compléter par cet agent ou par le propriétaire. L’absence de branche renseignée ne signifie pas que le travail de design est arrêté.
