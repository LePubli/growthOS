# Connecteur multisource GrowthOS — version 0.4.1

L'extension fonctionne dans **Chrome sur l'appareil de l'utilisateur** (ordinateur).
Les images Docker de GrowthOS sont construites par GitHub Actions, pas sur le VPS.

## Mise à jour manuelle

1. Récupérer **le dossier complet** `extensions/growthos-pagesjaunes` depuis la branche `fix/growthos-functional-redesign`, y compris `capture.js`, `popup.html`, `popup.css` et `popup.js`.
2. Remplacer le contenu de votre dossier d'extension Chrome local (sans changer le chemin du dossier chargé dans Chrome).
3. Ouvrir `chrome://extensions`, activer le mode développeur et cliquer sur **Actualiser** sur l'extension GrowthOS. La version doit être **0.4.1**.
4. Garder Chrome et l'onglet `https://agile.le-publicitaire.fr` ouverts.
5. Dans GrowthOS, ouvrir **Trouver des entreprises**, cliquer sur **Connecter cet appareil** si nécessaire, puis choisir les sources. Pour Google et Bing, le nouvel onglet doit être ouvert manuellement depuis le panneau de l'extension.
6. Pour les fiches déjà importées depuis PagesJaunes, **Compléter depuis PagesJaunes** reste opérationnel.

### Quand Google affiche le nom et le téléphone mais pas l'adresse

- Sur la page des résultats locaux Google, cliquez sur **Capturer les fiches visibles**.
- L'extension conserve le nom et le téléphone réellement affichés dans une liste **Fiches à vérifier**.
- Cliquez sur **Compléter** pour ouvrir le formulaire déjà prérempli. Ouvrez si besoin la fiche détaillée du professionnel sur le site source afin de vérifier sa rue, son code postal et sa ville.
- Validez seulement après avoir indiqué une adresse complète contenant le code postal réel. Le simple texte de recherche « plombier 59100 » ne prouve pas que chaque entreprise a ce code postal.
- Les brouillons restent uniquement sur l'appareil ; seuls les résultats validés peuvent être synchronisés avec GrowthOS. Ils expirent au bout de 24 heures.

## Données traitées

Le navigateur parcourt les onglets de la fiche source : **Présentation, Horaires, Avis, Contact, INSEE**.
Il envoie uniquement les valeurs visibles et vérifiables : coordonnées, site web, éventuels SIREN/SIRET effectivement affichés, horaires structurés par jour, note et nombre d'avis, avis clients explicitement délimités et prestations.
Un champ non trouvé reste vide. Certains éléments PagesJaunes peuvent nécessiter une interaction manuelle ou ne pas être exposés au navigateur.

## VPS

Aucune installation de navigateur, aucune extension et aucun traitement de scraping à lancer sur le VPS.
La mise à jour des images `:preprod` dans DockPanel est distincte du rechargement de cette extension locale.
Le déploiement ne doit pas modifier les limites de ressources des autres conteneurs.
