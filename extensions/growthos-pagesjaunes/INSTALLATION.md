# Connecteur multisource GrowthOS — version 0.5.2

L'extension fonctionne dans **Chrome sur l'appareil de l'utilisateur** (ordinateur).
Les images Docker de GrowthOS sont construites par GitHub Actions, pas sur le VPS.

## Mises à jour automatiques — Chrome Web Store (option non activée)

**Choix actuel du projet : mise à jour manuelle** du dossier de l'extension dans Chrome. La procédure prioritaire figure plus bas. Le Chrome Web Store n'est pas nécessaire pour continuer les tests.

Une extension ouverte via **« Charger l'extension non empaquetée »** dans Chrome ne se met **pas** à jour depuis GitHub avec le bouton « Mettre à jour ». Chrome ne distribue automatiquement que les versions publiées via le Chrome Web Store sur les navigateurs classiques Windows/macOS.

Configuration **une seule fois** par le propriétaire de GrowthOS :

1. Créer un compte éditeur sur [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) et activer la validation en deux étapes.
2. Dans GitHub Actions, lancer **GrowthOS Chrome extension package and updates** : un ZIP prêt à publier est joint à l'exécution (artefact `growthos-connecteur-chrome-...`).
3. Créer l'extension dans le Developer Dashboard avec ce ZIP, renseigner les onglets de présentation et confidentialité, puis publier la première version. Choisir une visibilité restreinte appropriée. La vérification Google peut prendre du temps ; l'extension ne peut pas être distribuée automatiquement avant sa validation.
4. Sur Google Cloud, activer **Chrome Web Store API (v2)** et créer un **compte de service** ; l'ajouter dans la section **Account** du Developer Dashboard. Ne jamais insérer ses identifiants dans le code source ou dans la conversation.
5. Ajouter à la configuration du dépôt GitHub :
   - **Variables** `CWS_PUBLISHER_ID` et `CWS_EXTENSION_ID` (identifiants obtenus dans le tableau de bord Chrome Web Store) ;
   - **Secret** `CWS_SERVICE_ACCOUNT_JSON` (clé JSON du compte de service, conservée uniquement dans GitHub Actions).
6. Remplacer **une seule fois** l'extension de développement chargée localement par la version installée depuis le Chrome Web Store. **Attention :** terminer l'import des captures en attente avant de la remplacer ; les données conservées par une extension avec un autre identifiant ne sont pas transférées automatiquement.

Ensuite, quand un changement touche `extensions/growthos-pagesjaunes/` sur la branche de préproduction, GitHub prépare automatiquement le ZIP, attribue une version croissante, l'envoie à Google et demande sa publication. Après validation de Google, **Chrome distribue la mise à jour** aux utilisateurs de l'extension du Store, sans téléchargement manuel. Il n'y a aucune modification Docker ou VPS à réaliser pour la seule extension.

La publication automatique ne démarre **pas** tant que ces éléments ne sont pas configurés. Ne fournissez pas votre mot de passe Google.

## Installation locale — procédure actuelle

1. Récupérer **le dossier complet** `extensions/growthos-pagesjaunes` depuis la branche `fix/growthos-functional-redesign`, y compris `capture.js`, `popup.html`, `popup.css` et `popup.js`.
2. Remplacer le contenu de votre dossier d'extension Chrome local (sans changer le chemin du dossier chargé dans Chrome).
3. Ouvrir `chrome://extensions`, activer le mode développeur et cliquer sur **Actualiser** sur l'extension GrowthOS. La version du dossier source doit être **0.5.2** (le ZIP GitHub Actions peut porter un quatrième numéro de version incrémental). Cette mise à jour demande aussi l'autorisation limitée au géocodeur officiel `data.geopf.fr` et à l'annuaire `recherche-entreprises.api.gouv.fr`.
4. Garder Chrome et l'onglet `https://agile.le-publicitaire.fr` ouverts.
5. Dans GrowthOS, ouvrir **Trouver des entreprises**, cliquer sur **Connecter cet appareil** si nécessaire, puis choisir les sources. Pour Google et Bing, le nouvel onglet doit être ouvert manuellement depuis le panneau de l'extension.
6. Pour les fiches déjà importées depuis PagesJaunes, **Compléter depuis PagesJaunes** reste opérationnel.

### Quand Google affiche le nom et le téléphone mais pas l'adresse

- Dans Google Maps, **ouvrez d'abord une fiche entreprise précise** dans la liste : le panneau détaillé expose souvent l'adresse postale complète. Cliquez ensuite sur **Capturer les fiches visibles**.
- Pour les cartes sans adresse complète, l'extension conserve le nom, le téléphone et la rue partielle réellement affichés dans **Fiches à vérifier**.
- Saisissez un code postal unique dans le champ **Ville, département ou code postal** du popup, puis cliquez sur **Vérifier les adresses (BAN + annuaire officiel)**. L'extension recherche au plus 12 fiches par clic et essaie deux vérifications distinctes :
  1. Si Google fournit **une rue et un numéro**, la Géoplateforme confirme leur correspondance avec une adresse de la Base Adresse Nationale (BAN). Cette méthode ne prouve pas l'identité légale et ne fournit pas de SIRET.
  2. Sinon, l'Annuaire des entreprises doit confirmer **une unique entreprise au nom correspondant exactement** et une adresse dans la zone indiquée. Ici le SIRET peut être récupéré.
  Les fiches confirmées passent dans **Sélection locale** ; aucun prospect n'est importé automatiquement. Pour les autres, ouvrez **Pourquoi certaines fiches restent à vérifier ?** afin de voir les blocages.
- Si la liste Google n'affiche **ni numéro ni rue**, cliquez sur **Maps** devant une fiche à vérifier pour rechercher directement cette entreprise, puis ouvrez son panneau détaillé et capturez à nouveau. Aucune API officielle ne garantit de retrouver une adresse commerciale depuis le seul nom et le téléphone.
- Dans GrowthOS, lancez la recherche multisource avec cette source : l'application rapproche les brouillons de l'Annuaire des entreprises ou des fiches locales vérifiées. Vous pouvez aussi cliquer sur **Enrichir automatiquement mes fiches** dans les résultats d'une recherche existante.
- Les fiches identifiées de manière unique passent dans les résultats à sélectionner ; les autres restent **à vérifier**. Pour ces dernières, cliquez sur **Compléter** dans l'extension et ouvrez si besoin la fiche détaillée du professionnel sur le site source afin de vérifier sa rue, son code postal et sa ville.
- Validez seulement après avoir indiqué une adresse complète contenant le code postal réel. Le simple texte de recherche « plombier 59100 » ne prouve pas que chaque entreprise a ce code postal.
- Les brouillons restent sur l'appareil jusqu'à un enrichissement explicite depuis l'extension, une recherche ou un enrichissement depuis GrowthOS. Les brouillons envoyés au serveur ne sont pas des prospects CRM ; les entrées non confirmées sont seulement affichées avec une raison de non-identification. Les captures locales expirent au bout de 24 heures.

## Données traitées

Le navigateur parcourt les onglets de la fiche source : **Présentation, Horaires, Avis, Contact, INSEE**.
Il envoie uniquement les valeurs visibles et vérifiables : coordonnées, site web, éventuels SIREN/SIRET effectivement affichés, horaires structurés par jour, note et nombre d'avis, avis clients explicitement délimités et prestations.
Un champ non trouvé reste vide. Certains éléments PagesJaunes peuvent nécessiter une interaction manuelle ou ne pas être exposés au navigateur.

## VPS

Aucune installation de navigateur, aucune extension et aucun traitement de scraping à lancer sur le VPS.
La mise à jour des images `:preprod` dans DockPanel est distincte du rechargement de cette extension locale.
Le déploiement ne doit pas modifier les limites de ressources des autres conteneurs.
