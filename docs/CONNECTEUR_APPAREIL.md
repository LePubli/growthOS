# Connecter GrowthOS à son navigateur — connecteur multisource 0.10.0

Ce connecteur fonctionne avec **Chrome ou Edge sur ordinateur**. Il garde les recherches et les éventuelles sessions des sites consultés **dans votre propre navigateur**, sans transmettre de mot de passe ni de cookie à GrowthOS. Il ne modifie ni DockPanel ni les autres conteneurs.

## Import direct et fusion des sources

Depuis le connecteur Chrome, ouvrez **Sélectionner et importer dans Prospects** (page `/prospects/connecteur`). Après confirmation explicite, GrowthOS compare les fiches au CRM : une entreprise nouvelle est créée, tandis qu'un doublon confirmé enrichit uniquement les champs vides du prospect existant. Le téléphone, le site, l'adresse, les identifiants légaux et la provenance sont conservés par source. Si une source contredit une valeur CRM non vide, aucun remplacement automatique n'a lieu : la fiche prospect affiche une comparaison avec les actions **Conserver le CRM** et **Utiliser la nouvelle valeur**. Chaque source et décision est historisée. Les fiches sans adresse exacte peuvent être importées comme incomplètes sans code postal fictif.

Cette fusion fonctionne également lorsqu'une recherche multisource est importée depuis « Trouver des entreprises ». La même entreprise doit être identifiée par un élément fiable (SIRET identique, lien de fiche propre, ou nom + rue / numéro de téléphone et ville). Un simple site web partagé par plusieurs agences ne suffit pas.

## Mise à jour automatique : Chrome Web Store

**Objectif : plus aucun fichier ZIP à retélécharger à chaque évolution.** Une extension installée depuis le Chrome Web Store reçoit automatiquement les versions que Google publie. Le dépôt contient désormais une action GitHub qui prépare le ZIP et peut soumettre les mises à jour automatiquement après une configuration unique du compte éditeur Google. Voir [les étapes d'activation](../extensions/growthos-pagesjaunes/INSTALLATION.md).

**La première publication est nécessaire :** Google impose un compte développeur, une fiche dans le Chrome Web Store, la vérification en deux étapes et, pour l'automatisation, les identifiants du compte de service. La publication n'est pas encore activée par défaut. Jusqu'à la première installation depuis le Store, l'extension chargée localement doit être actualisée manuellement.

## Installation locale de dépannage (Chrome / Edge)

1. Ouvrir le dépôt [GrowthOS sur GitHub](https://github.com/LePubli/growthOS/tree/fix/growthos-functional-redesign).
2. Menu **Code → Download ZIP**. Décompresser l'archive dans un dossier permanent.
3. Dans Chrome : saisir `chrome://extensions` ; dans Edge : `edge://extensions`.
4. Activer **Mode développeur**, puis **Charger l'extension non empaquetée**.
5. Sélectionner précisément le dossier `extensions/growthos-pagesjaunes` extrait du ZIP, celui qui contient `manifest.json`.
6. Ouvrir [GrowthOS – Trouver des entreprises](https://agile.le-publicitaire.fr/sourcing), **actualiser la page**.
7. Cliquer sur **Connecter cet appareil**. L'indicateur devient **Connecté** si l'extension répond.

> Pour notre installation locale actuelle : remplacez tous les fichiers du dossier de l'extension, cliquez sur **Actualiser** sous l’extension dans `chrome://extensions`, vérifiez la version **0.8.0**, puis actualisez GrowthOS. Le Chrome Web Store reste une option ultérieure.

### Utilisation multisource

| Source | Collecte dans l'extension | Conditions |
| --- | --- | --- |
| Annuaire des entreprises | API publique GrowthOS | Recherche directe par zone, sans extension |
| PagesJaunes.fr | Lecture automatique depuis le navigateur local | Maximum 8 zones ; enrichissement des fiches existant |
| Google Maps | **Capturer les fiches** depuis la liste | Parcours automatique des fiches détaillées disponibles |
| Google Search | **Clic de capture** sur une fiche locale visible | Les liens et extraits génériques ne constituent pas des fiches vérifiées |
| Bing Search | **Clic de capture** sur une fiche locale visible | Les liens et extraits génériques ne constituent pas des fiches vérifiées |
| LinkedIn | **Saisie manuelle uniquement** | Il faut vérifier l’entreprise, ses coordonnées et son URL LinkedIn ; pas de scraping LinkedIn |

1. Dans GrowthOS, **Trouver des entreprises → Nouvelle recherche**, sélectionnez autant de sources que souhaité et vos régions/départements/codes postaux.
2. Pour Google Maps, Google Search ou Bing : cliquez sur l'icône **GrowthOS** dans les extensions Chrome, choisissez le moteur, indiquez **activité et localisation**, cliquez sur **Ouvrir une recherche**.
3. Sur Maps, laissez la liste de résultats ouverte. Cliquez à nouveau sur l'icône GrowthOS puis sur **Capturer les fiches**. Les cartes avec nom et téléphone, mais sans adresse complète, sont enregistrées comme **brouillons à enrichir**. GrowthOS tente ensuite un rapprochement automatique avec les établissements officiels et les autres sources vérifiées. Les fiches restant ambiguës peuvent être complétées manuellement depuis l'extension. N'inventez aucune donnée.
4. Pour LinkedIn, connectez-vous à votre compte sur le site si besoin, ouvrez manuellement la fiche entreprise, puis renseignez les informations vérifiées dans le formulaire de l'extension. L'extension ne lit pas automatiquement LinkedIn.
5. Revenez dans le formulaire GrowthOS et cliquez sur **Vérifier mes captures**. Lancez la recherche : les fiches vérifiées et les brouillons récupérés depuis votre navigateur sont rapprochés des sources officielles. Dans la page de résultats, le bouton **Enrichir automatiquement mes fiches** permet de réessayer le lot. Les fiches sans identité unique vérifiable restent non importables, avec une explication.
6. Sélectionnez explicitement les entreprises désirées dans les résultats avant l'import CRM. Les doublons compatibles sont rapprochés, les identifiants légaux ne sont jamais inventés.

La sélection locale reste sur votre appareil **24 heures**. Le menu de l'extension permet de retirer une fiche ou de vider la sélection. Elle ne lance pas de collecte ni d'import en arrière-plan.

### PagesJaunes et enrichissement existants

- Choisir PagesJaunes, seul ou avec Annuaire des entreprises, et sélectionner les zones.
- **Maximum huit localités** par recherche locale ; chaque demande passe successivement par le Chrome de l'utilisateur.
- Garder GrowthOS ouvert pendant la collecte. Un onglet PagesJaunes se charge discrètement pour chaque zone, puis est fermé.
- Les résultats sont affichés **avant import** et n'entrent dans le CRM qu'après validation manuelle.
- Un blocage, un CAPTCHA ou un changement de HTML est signalé : le connecteur ne promet pas de résultat si le site refuse l'accès.

### Confidentialité et limites

- L'extension n'a pas accès aux jetons de connexion GrowthOS ni aux identifiants du compte.
- Son script de liaison s'exécute seulement sur `https://agile.le-publicitaire.fr`. Pour Google et Bing, la permission temporaire `activeTab` n'est utilisée qu'après un clic explicite sur l’extension ; pas de permission permanente pour ces sites.
- LinkedIn interdit, dans ses conditions, les extensions qui extraient ou automatisent ses données. **Aucune extraction de LinkedIn n'est implémentée**. La connexion à un compte ne change pas cette restriction.
- Les pages Google/Bing évoluent souvent ; une capture peut renvoyer zéro résultat. Aucune récupération de fichiers privés, de résultats masqués, de captcha ou de compte tiers n'est tentée.
- L'extension lit les coordonnées visibles dans les cartes de résultats. Un numéro masqué derrière « Afficher le N° » **n'est pas récupéré**.
- Les données passent de l'extension à la page GrowthOS, puis sont enregistrées dans la préproduction GrowthOS avec la connexion de l'utilisateur.
- L'application sur **Android n'est pas encore livrée** : Chrome Android ne charge pas une extension Chrome de bureau. La page indique cette limite explicitement. Pas de transfert automatique PC → téléphone.
- Cette version doit être testée sur les pages réellement utilisées dans votre Chrome ; les tests automatiques vérifient le protocole et la validation mais ne garantissent pas les sélecteurs de Google ou Bing.

### Dépannage

- « Connecteur non détecté » : vérifier l'extension activée, le bon profil Chrome, puis actualiser GrowthOS.
- « Aucun bloc entreprise détecté » : ouvrir PagesJaunes directement, vérifier que les résultats sont visibles et qu'aucun CAPTCHA ne les masque. Les sélecteurs HTML devront peut-être être adaptés.
- « Aucune fiche avec adresse postale complète » : ouvrez le panneau détaillé de l'établissement puis réessayez la capture. Une page de liens de recherche sans adresse vérifiée ne peut pas être importée comme entreprise.
- « 0 capture » sur GrowthOS : vérifiez que vous avez bien l'extension en version **0.6.0** (ou une version Store plus récente) et que les sources sont cochées. La commande **Ouvrir et lire 5 fiches Maps automatiquement** tente de visiter les fiches dans l'onglet Google où l'extension a été activée ; réouvrez l'extension pour voir le bilan. Les brouillons sont comptés séparément et ne deviennent importables en tant qu'entreprises vérifiées qu'après une adresse confirmée. L'extension propose aussi **Vérifier les adresses (BAN + annuaire officiel)** ; consultez son diagnostic par fiche si aucun rapprochement n'aboutit.
- Un brouillon sans adresse peut désormais être **importé volontairement en tant que prospect incomplet** depuis la page de résultats GrowthOS : au moins une coordonnée ou rue réellement visible est nécessaire. Les champs absents ne sont jamais inventés, et la fiche CRM affiche un avertissement de complétude. Pour cette fonctionnalité web/API, il faut aussi redéployer les images Docker de préproduction.
- N'installez pas l'extension dans un dossier temporaire : Chrome doit pouvoir retrouver les fichiers au redémarrage.

## Compléter une fiche PagesJaunes

Le connecteur lit d'abord les entreprises depuis la liste de résultats. Les données détaillées demandent d'ouvrir chaque **fiche /pros/...** dans Chrome.

- **Avant import** : cochez les entreprises dans les résultats GrowthOS puis cliquez sur **Compléter les fiches sélectionnées**. Le traitement est séquentiel, espacé de 5 secondes. Vérifiez les champs puis importez.
- **Après import** : ouvrez un prospect dont la source est PagesJaunes, puis cliquez sur **Compléter depuis PagesJaunes**. Les informations réellement visibles sont ajoutées sans écraser les coordonnées déjà saisies.
- Informations capturées si présentes : téléphone visible après « Afficher le numéro », email `mailto:` réel, site web, réseaux sociaux, horaires, description, prestations, note et avis, SIREN/SIRET affichés après ouverture des sections légales.
- Un bouton « Email » qui ouvre un formulaire de contact ne donne **pas** accès à une adresse email.
- Si le site refuse l'accès ou modifie sa structure, certains champs restent vides. Vérifiez toujours la fiche source.

Pour les installations Chrome Web Store, **Chrome récupère la nouvelle version publiée automatiquement**. La mise à jour manuelle des fichiers ne concerne que l'ancienne extension locale non empaquetée.


## Sources professionnelles et enrichissement Societe.com

La sélection couvre Societe.com, LinkedIn, Bing, Facebook Pages, Instagram professionnel et TikTok professionnel. Bing conserve sa capture de résultats visibles. LinkedIn et les réseaux sociaux proposent la saisie assistée de la page entreprise vérifiée dans Chrome.

Sur une fiche prospect, le bouton **Enrichir via Societe.com** propose les recherches disponibles selon les données connues.

1. Utiliser le nom ou le SIRET/SIREN pour ouvrir Societe.com. Pour l’adresse, le téléphone ou le domaine, le lien ouvre Bing avec un filtre sur les fiches Societe.com. Vérifier ensuite le résultat sur Societe.com.
2. Sur la fiche société, cliquer sur l’extension puis sur **Capturer la fiche Societe.com**. Le nom, l’adresse, le SIRET et le code APE sont lus dans les champs affichés. Le téléphone et le site restent absents s’ils sont masqués ou manquants.
3. Revenir dans GrowthOS et charger les fiches Societe.com du connecteur. Choisir celle à comparer au prospect courant.
4. Lire les deux colonnes, confirmer l’entreprise et l’établissement, puis confirmer l’enrichissement. Les champs vides sont complétés. Les divergences apparaissent dans les désaccords de la fiche, où une décision peut être prise.

Un SIREN différent ou un autre SIRET déjà connu déclenche un refus de fusion. La provenance et la date de capture sont conservées. L’installation de cette version du connecteur et la version web/API correspondante sont nécessaires pour ce parcours.


## Fiche complète et veille

La capture Societe.com 0.10.0 conserve les rubriques professionnelles affichées sur la page. Les informations supplémentaires apparaissent dans la comparaison avant enrichissement puis dans la fiche prospect. Refaire une capture permet de compléter une ancienne fiche. Les versions précédentes sont consultables dans les informations détaillées Societe.com.

À l’ouverture d’un prospect identifié par SIREN/SIRET, GrowthOS contrôle ses données auprès de l’Annuaire des Entreprises. Le résultat indique l’état de l’entreprise et, lorsque la source retourne le SIRET exact, celui de l’établissement. Un résultat récent est réutilisé pendant une minute. L’heure du contrôle et la date des données de la source permettent d’en apprécier la fraîcheur.

Cocher **Surveiller les changements de ce prospect** active un contrôle automatique quotidien. La fréquence peut être réglée à trois jours ou une semaine. Le serveur conserve la prochaine échéance et l’historique, et ajoute une notification GrowthOS lorsque les données observées changent. Cette veille fonctionne pendant que l’API est en service, y compris lorsque Chrome est fermé.

En cas d’indisponibilité de la source, la fiche conserve son dernier résultat et affiche l’erreur de vérification. Le traitement automatique réessaie après quinze minutes. Les informations de l’Annuaire et les captures Societe.com affichent chacune leur provenance.
