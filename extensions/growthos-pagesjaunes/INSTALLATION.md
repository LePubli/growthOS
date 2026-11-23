# Connecteur PagesJaunes GrowthOS — version 0.3.0

L'extension fonctionne dans **Chrome sur l'appareil de l'utilisateur** (ordinateur).
Les images Docker de GrowthOS sont construites par GitHub Actions, pas sur le VPS.

## Mise à jour manuelle

1. Récupérer les trois fichiers de ce dossier depuis la branche `fix/growthos-functional-redesign` : `manifest.json`, `background.js`, `bridge.js`.
2. Remplacer les trois fichiers de la copie locale de l'extension Chrome (sans changer le nom du dossier).
3. Ouvrir `chrome://extensions`, activer le mode développeur et cliquer sur **Actualiser** sur l'extension GrowthOS. La version doit être **0.3.0**.
4. Garder Chrome et l'onglet `https://agile.le-publicitaire.fr` ouverts.
5. Dans GrowthOS, ouvrir un prospect provenant de PagesJaunes et cliquer sur **Compléter depuis PagesJaunes**. Le bouton d'enrichissement générique ne relance pas l'extracteur local.

## Données traitées

Le navigateur parcourt les onglets de la fiche source : **Présentation, Horaires, Avis, Contact, INSEE**.
Il envoie uniquement les valeurs visibles et vérifiables : coordonnées, site web, éventuels SIREN/SIRET effectivement affichés, horaires structurés par jour, note et nombre d'avis, avis clients explicitement délimités et prestations.
Un champ non trouvé reste vide. Certains éléments PagesJaunes peuvent nécessiter une interaction manuelle ou ne pas être exposés au navigateur.

## VPS

Aucune installation de navigateur, aucune extension et aucun traitement de scraping à lancer sur le VPS.
La mise à jour des images `:preprod` dans DockPanel est distincte du rechargement de cette extension locale.
Le déploiement ne doit pas modifier les limites de ressources des autres conteneurs.
