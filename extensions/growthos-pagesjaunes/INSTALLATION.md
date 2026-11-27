# Connecteur multisource GrowthOS — panneau latéral Chrome

L'extension fonctionne dans **Chrome 141 ou plus récent** sur l'appareil de l'utilisateur (ordinateur).
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
3. Ouvrir `chrome://extensions`, activer le mode développeur et cliquer sur **Actualiser** sur l'extension GrowthOS. La version du dossier source est **0.11.2** (le ZIP GitHub Actions peut porter un quatrième numéro de version incrémental). Gardez le même dossier local et évitez une deuxième installation : chaque extension Chrome possède ses propres captures locales.
4. Garder Chrome et l'onglet `https://agile.le-publicitaire.fr` ouverts.
5. Dans GrowthOS, ouvrir **Trouver des entreprises**, cliquer sur **Connecter cet appareil** si nécessaire, puis choisir les sources. Pour Google et Bing, le nouvel onglet doit être ouvert manuellement depuis le panneau de l'extension.
6. Pour les fiches déjà importées depuis PagesJaunes, **Compléter depuis PagesJaunes** reste opérationnel.

### Utiliser le panneau latéral permanent

- Cliquez sur l'icône **GrowthOS** dans la barre d'outils de Chrome : elle ouvre le panneau latéral sur toute la hauteur. Le panneau global reste ouvert au changement d'onglet et pendant la recherche et la capture ; il ne dépend plus d'un popup qui disparaît.
- La commande **−** réduit le contenu du panneau en mode compact avec un bouton **Réafficher**. Chrome conserve la largeur de sa barre latérale pendant ce mode (elle ne peut pas être réglée par l'extension).
- La commande **×** ferme réellement le panneau et libère toute sa largeur. Cliquez de nouveau sur l'icône GrowthOS pour le rouvrir. Chrome propose également sa propre croix de fermeture.
- Si vous préférez le panneau à gauche du navigateur, changez son emplacement dans les paramètres Chrome de la barre latérale. La largeur peut se régler en glissant la bordure dans Chrome.
- Les fiches capturées et les tâches restent conservées en cas de fermeture ; à la réouverture, la liste est rechargée et les fiches importables sont présélectionnées. Les captures conservent leur expiration de sécurité habituelle de 24 heures.

### Secours d’un enrichissement bloqué dans le cloud

Depuis la fiche prospect, l’onglet **Enrichissements** propose **Comparer** directement sur la source. Les remplacements sont visibles et cochés par défaut, sauf le nom affiché. Cliquez sur **Valider et mettre à jour** pour enregistrer. Il n’y a plus de case de confirmation supplémentaire ni de retour obligatoire au navigateur cloud. Les identifiants incompatibles restent protégés.

Si le navigateur serveur reste bloqué, **Lire avec Chrome sur cet appareil** ouvre la source **et les commandes du connecteur**. Chrome ouvre le panneau latéral ou, s’il refuse, un onglet du connecteur de secours. **Ouvrir la source** permet de choisir la bonne fiche ; **Lire et comparer dans GrowthOS** ramène sa capture dans la fiche prospect pour validation. Au premier usage d’une source, Chrome peut demander l’autorisation de lecture de ce site uniquement. Les accès Google, Bing et Societe.com sont optionnels et ne sont pas accordés à l’installation.

La lecture utilise la connexion et la session du PC. Elle ne change pas l’IP du serveur et ne garantit pas la disparition des contrôles des sites. Le mode local Android n’est pas encore développé. Les données restent locales jusqu’au retour et à la comparaison dans GrowthOS ; la seule lecture n’applique aucune mise à jour CRM.

### Quand Google affiche le nom et le téléphone mais pas l'adresse

#### Lecture par lot des fiches Maps

Dans la liste des résultats Google Maps, cliquez sur **Capturer les fiches** dans le panneau latéral. Le connecteur fait défiler la liste jusqu’à ce que Maps cesse de charger des résultats, puis ouvre chaque nouvelle fiche dans l’onglet. Laissez cet onglet sur la recherche pendant la lecture. Le bilan se met à jour dans le panneau sans le rouvrir. Un nouveau passage permet de reprendre les fiches qui ont échoué.

#### Enrichissement et prospects provisoires

- Pour les cartes sans adresse complète, l'extension conserve le nom, le téléphone et la rue partielle réellement affichés dans **Fiches à vérifier**.
- Saisissez un code postal unique dans le champ **Ville, département ou code postal** du popup, puis cliquez sur **Vérifier les adresses (BAN + annuaire officiel)**. L'extension recherche les fiches en attente et essaie deux vérifications distinctes :
  1. Si Google fournit **une rue et un numéro**, la Géoplateforme confirme leur correspondance avec une adresse de la Base Adresse Nationale (BAN). Cette méthode ne prouve pas l'identité légale et ne fournit pas de SIRET.
  2. Sinon, l'Annuaire des entreprises doit confirmer **une unique entreprise au nom correspondant exactement** et une adresse dans la zone indiquée. Ici le SIRET peut être récupéré.
  Les fiches confirmées passent dans **Sélection locale** ; aucun prospect n'est importé automatiquement. Pour les autres, ouvrez **Pourquoi certaines fiches restent à vérifier ?** afin de voir les blocages.
- Si la liste Google n'affiche **ni numéro ni rue**, cliquez sur **Maps** devant une fiche à vérifier pour rechercher directement cette entreprise, puis ouvrez son panneau détaillé et capturez à nouveau. Aucune API officielle ne garantit de retrouver une adresse commerciale depuis le seul nom et le téléphone.
- Si l'adresse reste introuvable, lancez la recherche GrowthOS pour créer un *job* de sourcing. Ouvrez ses résultats, relancez si besoin **Enrichir automatiquement mes fiches**, puis dans **Prospects incomplets · import sur décision**, cochez uniquement les entreprises à conserver et cliquez sur **Importer les prospects à compléter**. Les fiches ne sont jamais importées automatiquement. Il faut au moins un téléphone, un site ou une adresse partielle réellement recueilli ; SIREN/SIRET et code postal restent vides.
- Dans GrowthOS, lancez la recherche multisource avec cette source : l'application rapproche les brouillons de l'Annuaire des entreprises ou des fiches locales vérifiées. Vous pouvez aussi cliquer sur **Enrichir automatiquement mes fiches** dans les résultats d'une recherche existante.
- Les fiches identifiées de manière unique passent dans les résultats à sélectionner ; les autres restent **à vérifier**. Pour ces dernières, cliquez sur **Compléter** dans l'extension et ouvrez si besoin la fiche détaillée du professionnel sur le site source afin de vérifier sa rue, son code postal et sa ville.
- Validez seulement après avoir indiqué une adresse complète contenant le code postal réel. Le simple texte de recherche « plombier 59100 » ne prouve pas que chaque entreprise a ce code postal.
- Les brouillons restent sur l'appareil jusqu'à un enrichissement explicite depuis l'extension, une recherche ou un enrichissement depuis GrowthOS. Les brouillons envoyés au serveur ne sont pas des prospects CRM ; les entrées non confirmées sont seulement affichées avec une raison de non-identification. Les captures locales expirent au bout de 24 heures.

## Données traitées

**Import direct (0.8.0) :** Après la collecte, cliquez sur **Sélectionner et importer dans Prospects** dans l'extension. La page `/prospects/connecteur` lit les captures locales de cet appareil, affiche les adresses vérifiées et les fiches incomplètes, puis vous laisse confirmer toute la sélection en un clic. Les champs absents restent vides, les doublons confirmés complètent les champs vides du CRM, et les captures confirmées sont retirées de la file locale. Le module « Trouver des entreprises » reste disponible séparément pour les recherches multisources avec l'annuaire public.

**Lecture Maps :** Cliquez sur **Capturer les fiches** ; le connecteur mémorise les liens Maps déjà examinés pour la recherche courante et défile les résultats. S'il n'existe plus de nouveau lien chargé, il l'indique ; le bouton « Repartir du premier résultat Maps » permet une relecture volontaire. Il ne peut pas garantir que Google chargera toutes les entreprises ni obtenir un code postal absent de la fiche.

Le navigateur parcourt les onglets de la fiche source : **Présentation, Horaires, Avis, Contact, INSEE**.
Il envoie uniquement les valeurs visibles et vérifiables : coordonnées, site web, éventuels SIREN/SIRET effectivement affichés, horaires structurés par jour, note et nombre d'avis, avis clients explicitement délimités et prestations.
Un champ non trouvé reste vide. Certains éléments PagesJaunes peuvent nécessiter une interaction manuelle ou ne pas être exposés au navigateur.

## VPS

Aucune installation de navigateur, aucune extension et aucun traitement de scraping à lancer sur le VPS.
**Nouveau :** l'import des prospects provisoires nécessite un déploiement des images GrowthOS API et web `:preprod` après GitHub Actions, en plus de l'actualisation de l'extension Chrome.
Le déploiement ne doit pas modifier les limites de ressources des autres conteneurs.
