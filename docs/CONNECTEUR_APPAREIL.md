# Connecter son ordinateur à GrowthOS pour PagesJaunes

Cette première version fonctionne avec **Chrome ou Edge sur ordinateur**. Elle utilise le navigateur de l’ordinateur qui accède déjà normalement à PagesJaunes. Elle ne modifie ni DockerPanel ni les autres conteneurs.

## Installation unique (Chrome / Edge)

1. Ouvrir le dépôt [GrowthOS sur GitHub](https://github.com/LePubli/growthOS/tree/fix/growthos-functional-redesign).
2. Menu **Code → Download ZIP**. Décompresser l'archive dans un dossier permanent.
3. Dans Chrome : saisir `chrome://extensions` ; dans Edge : `edge://extensions`.
4. Activer **Mode développeur**, puis **Charger l'extension non empaquetée**.
5. Sélectionner précisément le dossier `extensions/growthos-pagesjaunes` extrait du ZIP, celui qui contient `manifest.json`.
6. Ouvrir [GrowthOS – Trouver des entreprises](https://agile.le-publicitaire.fr/sourcing), **actualiser la page**.
7. Cliquer sur **Connecter cet appareil**. L'indicateur devient **Connecté** si l'extension répond.

### Utilisation

- Choisir PagesJaunes, seul ou avec Annuaire des entreprises, et sélectionner les zones.
- **Maximum huit localités** par recherche locale ; chaque demande passe successivement par le Chrome de l'utilisateur.
- Garder GrowthOS ouvert pendant la collecte. Un onglet PagesJaunes se charge discrètement pour chaque zone, puis est fermé.
- Les résultats sont affichés **avant import** et n'entrent dans le CRM qu'après validation manuelle.
- Un blocage, un CAPTCHA ou un changement de HTML est signalé : le connecteur ne promet pas de résultat si le site refuse l'accès.

### Confidentialité et limites

- L'extension n'a pas accès aux jetons de connexion GrowthOS ni aux identifiants du compte.
- Son script de liaison s'exécute seulement sur `https://agile.le-publicitaire.fr`. Ses permissions de navigation sont limitées à `pagesjaunes.fr`.
- L'extension lit les coordonnées visibles dans les cartes de résultats. Un numéro masqué derrière « Afficher le N° » **n'est pas récupéré**.
- Les données passent de l'extension à la page GrowthOS, puis sont enregistrées dans la préproduction GrowthOS avec la connexion de l'utilisateur.
- L'application sur **Android n'est pas encore livrée** : Chrome Android ne charge pas une extension Chrome de bureau. La page indique cette limite explicitement. Pas de transfert automatique PC → téléphone.
- Cette version est expérimentale jusqu'à un test réel sur le Chrome de l'utilisateur ; valider les coordonnées et les conditions d'utilisation avant prospection.

### Dépannage

- « Connecteur non détecté » : vérifier l'extension activée, le bon profil Chrome, puis actualiser GrowthOS.
- « Aucun bloc entreprise détecté » : ouvrir PagesJaunes directement, vérifier que les résultats sont visibles et qu'aucun CAPTCHA ne les masque. Les sélecteurs HTML devront peut-être être adaptés.
- N'installez pas l'extension dans un dossier temporaire : Chrome doit pouvoir retrouver les fichiers au redémarrage.

## Compléter une fiche PagesJaunes

Le connecteur lit d'abord les entreprises depuis la liste de résultats. Les données détaillées demandent d'ouvrir chaque **fiche /pros/...** dans Chrome.

- **Avant import** : cochez les entreprises dans les résultats GrowthOS puis cliquez sur **Compléter les fiches sélectionnées**. Le traitement est séquentiel, espacé de 5 secondes. Vérifiez les champs puis importez.
- **Après import** : ouvrez un prospect dont la source est PagesJaunes, puis cliquez sur **Compléter depuis PagesJaunes**. Les informations réellement visibles sont ajoutées sans écraser les coordonnées déjà saisies.
- Informations capturées si présentes : téléphone visible après « Afficher le numéro », email `mailto:` réel, site web, réseaux sociaux, horaires, description, prestations, note et avis, SIREN/SIRET affichés après ouverture des sections légales.
- Un bouton « Email » qui ouvre un formulaire de contact ne donne **pas** accès à une adresse email.
- Si le site refuse l'accès ou modifie sa structure, certains champs restent vides. Vérifiez toujours la fiche source.

Lorsqu'une nouvelle version de l'extension est publiée, **remplacez les fichiers de votre dossier d'extension** par ceux de la branche actuelle, cliquez sur Actualiser dans `chrome://extensions` puis actualisez l'onglet GrowthOS.
