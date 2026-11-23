# Connecteur multisource GrowthOS — version 0.4.0

L'extension fonctionne dans **Chrome sur l'appareil de l'utilisateur** (ordinateur).
Les images Docker de GrowthOS sont construites par GitHub Actions, pas sur le VPS.

## Mise à jour manuelle

1. Récupérer **le dossier complet** `extensions/growthos-pagesjaunes` depuis la branche `fix/growthos-functional-redesign`, y compris `capture.js`, `popup.html`, `popup.css` et `popup.js`.
2. Remplacer le contenu de votre dossier d'extension Chrome local (sans changer le chemin du dossier chargé dans Chrome).
3. Ouvrir `chrome://extensions`, activer le mode développeur et cliquer sur **Actualiser** sur l'extension GrowthOS. La version doit être **0.4.0**.
4. Garder Chrome et l'onglet `https://agile.le-publicitaire.fr` ouverts.
5. Dans GrowthOS, ouvrir **Trouver des entreprises**, cliquer sur **Connecter cet appareil** si nécessaire, puis choisir les sources. Pour Google et Bing, le nouvel onglet doit être ouvert manuellement depuis le panneau de l'extension.
6. Pour les fiches déjà importées depuis PagesJaunes, **Compléter depuis PagesJaunes** reste opérationnel.

## Données traitées

Le navigateur parcourt les onglets de la fiche source : **Présentation, Horaires, Avis, Contact, INSEE**.
Il envoie uniquement les valeurs visibles et vérifiables : coordonnées, site web, éventuels SIREN/SIRET effectivement affichés, horaires structurés par jour, note et nombre d'avis, avis clients explicitement délimités et prestations.
Un champ non trouvé reste vide. Certains éléments PagesJaunes peuvent nécessiter une interaction manuelle ou ne pas être exposés au navigateur.

## VPS

Aucune installation de navigateur, aucune extension et aucun traitement de scraping à lancer sur le VPS.
La mise à jour des images `:preprod` dans DockPanel est distincte du rechargement de cette extension locale.
Le déploiement ne doit pas modifier les limites de ressources des autres conteneurs.
