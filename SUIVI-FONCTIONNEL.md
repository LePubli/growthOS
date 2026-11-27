# GrowthOS — suivi fonctionnel

Mis à jour le **27 novembre 2026**. Ce registre suit le parcours d’une agence qui cherche des entreprises, les qualifie, propose un site ou une prestation SEO, puis suit l’affaire dans le CRM.

**Coordination des agents** — un autre agent travaille uniquement sur le design. Voir les [notes temporaires de coordination](COORDINATION-AGENTS.md). Elles resteront jusqu’au lancement final en production autorisé par le propriétaire, puis seront supprimées lors de ce lancement.

**Dernier retour utilisateur** — le bouton Enrichir doit agir directement depuis le prospect, croiser les sources disponibles et rejeter les faux rapprochements. Supprimer les anciens parcours de recherche parallèles à `/navigateur`. **Windows et Android sont différés**, priorité au Web cloud.

**Lot en cours — [PR 57](https://github.com/LePubli/growthOS/pull/57)** — PagesJaunes rejoint le navigateur cloud, la collecte continue par lots persistants et les raccourcis prospect ouvrent l’enrichissement ciblé. Le design immersif PR55/56 et les reçus CRM sont conservés. Voir le point 46 ; publication des images à confirmer. [Installation et tests pas à pas](docs/NAVIGATEUR-CLOUD-INSTALLATION.md).

**Prochain contrôle en préproduction** — après feu vert des images, rechercher sur PagesJaunes puis collecter plus de 25 résultats Maps. Importer un lot pendant la collecte, vérifier les reçus CRM puis annuler/reprendre. Depuis un prospect, ouvrir l’enrichissement Societe.com et PagesJaunes, relire les valeurs modifiées et l’activité. LinkedIn et les réseaux doivent ensuite recevoir leurs collecteurs spécifiques avant d'être annoncés automatiques.

## Comment tenir ce fichier

À chaque changement fonctionnel, mettre à jour la ligne correspondante dans la même PR. Ajouter la date, la version ou le lien du test, son environnement, le résultat observé et le prochain contrôle. Si le contrôle échoue, inscrire le symptôme et rouvrir la ligne. Pour ajouter une source, tester une création, un réimport, un homonyme et une collecte vide. Utiliser des données de test pour les captures et les journaux.

| État | Preuve attendue |
|---|---|
| Validé en usage | Parcours exécuté en préproduction et résultat relu après actualisation. La validation porte sur le scénario nommé. |
| Testé en isolation | Contrôle reproductible sur une base ou un navigateur de test. Mentionner les fournisseurs simulés. |
| À vérifier | Code présent ou essai rapporté, recette réelle encore incomplète. |
| À développer | Fonction absente ou parcours bloqué. Mettre en œuvre le mécanisme manquant avant recette. |

## Sourcing et CRM

| Point | Fait et preuve | Reste à vérifier pour clôturer |
|---|---|---|
| 01 · Annuaire des Entreprises | Import essayé en usage. La suite vérifie la sélection, l’établissement local et le filtre géographique. | Comparer siège et établissement dans deux départements. Vérifier le choix explicite des résultats. |
| 02 · PagesJaunes | Collecte et détails essayés par l’utilisateur. En isolation, téléphone, horaires, provenance et réimport vérifiés. | Vérifier sur une fiche actuelle les données réellement présentes, puis le comportement si le site est indisponible. |
| 03 · Google Maps vers Prospects | **Validé en usage le 24/11** pour la capture, l’import et la relecture. La PR 28 inclut sélection par lots de 25, parcours continu et reprise des fiches restantes. | Chronométrer un vrai lot de plus de 25 avec interruption volontaire et vérifier le décompte final. |
| 04 · Google Search | Capture essayée. Le connecteur conserve en brouillon une adresse incomplète. | Comparer la fiche avant et après enrichissement et vérifier qu’une fiche traitée quitte la sélection. |
| 05 · Bing | Capture d’une carte simulée et import dans le CRM testés. | Ouvrir un résultat local réel, contrôler nom/adresse avant import, puis réimporter et essayer un homonyme. |
| 06 · LinkedIn | Saisie assistée d’une page entreprise. Prévisualisation et réimport testés avec une URL de test. Le champ LinkedIn est complété depuis une page entreprise conforme, y compris pour l’import d’une recherche enregistrée. Un lien différent crée un désaccord avec choix explicite. Une page partagée par plusieurs établissements ne suffit pas à les fusionner. | Depuis un compte Chrome, confirmer une page entreprise, contrôler la provenance sur le prospect et essayer un homonyme. |
| 07 · Societe.com | Capture dans Chrome du nom, de l’adresse, du SIRET, du code APE et des coordonnées visibles. Bouton sur chaque prospect pour lancer une recherche par nom ou SIRET/SIREN. Recherche Google par nom d’entreprise ou de dirigeant et ville, avec saisie modifiable. Adresse en recherche complémentaire. Liens directs SIREN/SIRET au format `/recherche?q=…&ftStatus=0`. Comparaison et confirmation avant enrichissement de ce prospect. Les données masquées restent absentes. | Sur une fiche réelle, essayer nom, SIRET et adresse ; contrôler la société et l’établissement capturés, puis confirmer l’enrichissement. Tester un champ absent et une valeur divergente. |
| 08 · Facebook Pages | Confirmation manuelle d’une page professionnelle et conservation de son URL dans l’historique. | Tester une page d’agence réelle, une page de même nom et un lien vers une publication. |
| 09 · Instagram professionnel | Confirmation manuelle du profil et import testés sur données fictives. | Vérifier dans Chrome le propriétaire du compte, la prévisualisation, le réimport et le rejet d’un lien de publication. |
| 10 · TikTok professionnel | Saisie assistée du profil professionnel dans Chrome, import et enrichissement du CRM testés en isolation. | Confirmer un profil réel, contrôler le réimport, un homonyme et le rejet des liens de vidéos. |
| 11 · Secteur APE / NAF | Référentiels Insee intégrés. Résolution du libellé dans les aperçus et le CRM, recalcul des fiches existantes. Tri et recherche par activité couverts côté API. | Sur une ancienne fiche puis sur un nouvel import, comparer le libellé à l’Insee. Vérifier le filtre par mots du libellé et le cas d’un code inconnu. |
| 12 · Doublons et conflits | Retour utilisateur positif sur le lot identité le 25/11. Tests de fusion de champs absents, conservation des valeurs en conflit et arbitrage. Index unique SIRET normalisé par agence, protection création/modification/CSV et écritures concurrentes. Même SIRET sous un autre nom dans le connecteur : confirmation requise depuis la fiche existante. Anciens doublons conservés avec alerte et liens de comparaison. | Vérifier les homonymes, les établissements d’un même SIREN, puis deux imports simultanés du même prospect. |
| 13 · Prospect et pipeline | **Validé en usage le 24/11** pour l’enregistrement d’une note et la persistance du changement d’étape. | Régression d’enregistrement corrigée le 25/11 pour les champs nuls des fiches importées. Refaire une modification puis relecture sur la préproduction. Élargir ensuite aux contacts, comptes et droits du second utilisateur. |
| 14 · Historique des notes | Test sur un prospect et deux deals. Note générale consultable depuis les deux affaires ; note d’affaire liée à son deal dans l’historique du prospect ; édition du même enregistrement. | Rejouer création et édition dans les écrans de préproduction, puis contrôler les deux affaires après actualisation. |
| 15 · Import CSV, carte et export | Cas de doublons CSV couverts dans le test d’installation. | Vérifier les colonnes, les accents, la pagination de l’export et les adresses sans coordonnées. |
| 16 · Ergonomie de sourcing | Sélection de sources, régions, départements et codes postaux présente. | Tester retour/reprise, absence de résultats, source indisponible et import direct sans perdre les autres sources du lot. |

## Autres fonctions à rendre opérationnelles

| Point | Situation actuelle | Critère de clôture |
|---|---|---|
| 17 · Installation, connexion, paramètres et équipe | Assistant et création du premier compte testés en isolation. | Refaire la première installation et la reconnexion depuis un navigateur, puis vérifier rôles, invitations et refus d’accès entre comptes. |
| 18 · Audit de site et SEO | Collecteur HTTPS et contrôles de lecture en place. | Comparer au HTML d’un vrai site son titre, H1, description, canonical et indexation. Tester aussi un échec réseau. |
| 19 · IA, assistant commercial, coach et mémoire | Tests fournisseurs simulés. Les clés de test réelles restent à utiliser. | Exécuter un cas reproductible pour Claude, OpenAI et DeepSeek, vérifier le contexte du bon prospect, les quotas et le traitement d’une erreur. |
| 20 · Enrichissement et intelligence contact | Adaptateurs présents, couverture fournisseur partielle. | Vérifier chaque fournisseur activé, sa clé, sa provenance et le coût. Afficher clairement les données manquantes. |
| 21 · Séquences, modèles, SMTP et réponses | Les brouillons sont disponibles. Moteur d’envoi à compléter. | Vérifier destinataire de test, planification, arrêt sur réponse ou opposition, désabonnement, quotas et absence de double envoi à la reprise. |
| 22 · Workflows, autopilot et webhooks | Brouillons et définitions présents. Exécution et relances à terminer ou à démontrer. | Un événement de test déclenche exactement l’action prévue. Simuler une panne, reprendre et consulter l’historique. |
| 23 · Activités, tâches, réunions et calendrier | Activités CRM partiellement testées. Transcription à implémenter. | Planifier, modifier et terminer une tâche, relire au calendrier ; produire une transcription d’essai avec gestion d’erreur. |
| 24 · E-réputation et portail client | Parcours partiels. Veille, collecte sociale et réseau de sites à raccorder ou à qualifier. | Suivre une campagne, tracer l’origine d’une mesure et vérifier validation et accès avec deux clients distincts. |
| 25 · Tableaux de bord, analytics, signaux, ABM, revenus, rapports et objectifs | Couverture métier à établir. | Retrouver dans les indicateurs une opération chiffrée connue ; vérifier période, compte, droits et état vide. |
| 26 · Acquisition entrante, propositions et parrainage | Plusieurs écrans indiquent une indisponibilité. | Enregistrer un lead de test, rattacher une proposition persistante au deal et tracer un parrainage de bout en bout. |
| 27 · Intégrations, CRM externes, API, plugins et marketplace | Connecteurs et configuration partiels. | Tester une connexion, un échange, la révocation et l’isolation de chaque intégration proposée. |
| 28 · Facturation, plans, quotas et administration | Parcours de paiement à vérifier. | Dans un environnement fournisseur de test, couvrir abonnement, facture, annulation et contrôle de quota avec les bons rôles. |
| 29 · Travail en équipe, base de connaissances et partage | Comptes, contacts, documents et tableaux partagés à vérifier par rôle. | Créer une ressource, la partager avec un utilisateur autorisé, révoquer l’accès et vérifier les droits. |
| 30 · Sécurité, SSO, conformité et journaux | Des tests techniques existent. La couverture complète reste ouverte. | Vérifier les accès entre agences, la révocation des clés, l’export/suppression des données et la traçabilité des mutations. |
| 31 · Exploitation et reprise | Images de préproduction déjà publiées pour la PR 28. | Restaurer une sauvegarde sur une base isolée, mesurer la reprise et vérifier la persistance et la version après relance. |
| 32 · Navigation, mobile et accessibilité | Recette visuelle incomplète. | Tester chaque parcours exposé sur ordinateur et mobile, au clavier, puis en état vide, lent et en erreur. |

## Fiche complète et veille des prospects

| Point | Fait et preuve | Reste à vérifier pour clôturer |
|---|---|---|
| 33 · Enregistrement des fiches importées | Correction de la validation des champs nuls par l’API. Le formulaire envoie les champs modifiés. Tests de sauvegarde puis relecture d’une ville et d’un code postal en conservant le statut converti. | Modifier la fiche qui affichait « Erreur lors de la mise à jour », enregistrer et recharger. |
| 34 · Informations détaillées Societe.com | Capture des renseignements visibles, notamment forme juridique, TVA, date de création, activité déclarée, effectif, convention collective, dirigeants, établissements et liens de documents. Les captures successives conservent jusqu’à dix versions précédentes. | Lot Societe.com confirmé comme fonctionnel par l’utilisateur le 25/11 avec l’extension 0.10.1.11. Pour clôturer tous les cas limites, recapturer aussi une fiche partiellement renseignée. Comparer les rubriques puis confirmer l’enrichissement et relire la fiche. Les rubriques absentes de la source restent non renseignées. |
| 35 · Contrôle du statut à la consultation | Contrôle à l’ouverture par SIREN/SIRET exact via l’Annuaire officiel. Entreprise et établissement ont chacun leur état. Dernière vérification et date de mise à jour de la source affichées. Cache d’une minute. | Ouvrir une entreprise active et une entreprise cessée. Vérifier aussi une entreprise active avec un établissement fermé. |
| 36 · Veille et changements | Activation par prospect et fréquence quotidienne par défaut, réglable à trois jours ou une semaine. Échéances, états et historique en PostgreSQL. Traitement en arrière-plan dans l’API. Notification GrowthOS lors d’un changement des données retournées, notamment statut, adresse, activité, dirigeants, effectif et finances publiées. | Activer la veille, vérifier la persistance après relance de l’API, puis consulter une notification et sa fiche liée. La veille utilise les données de l’Annuaire officiel ; les captures Societe.com restent effectuées dans Chrome. |
| 37 · Fiabilité de la veille | Tests de cessation et réactivation, erreur fournisseur, autre SIREN, établissement absent, contrôles concurrents, reprise du traitement, arrêt de la veille et isolation entre agences. | Refaire l’essai d’une source indisponible en préproduction et contrôler la mention du dernier statut connu. |

## Journal des preuves

- **22/11/2026** — audits initiaux et limites détaillées. [État de validation](AUDIT_STATUS.md) · [Remise en état de la préproduction](docs/PREPROD-REMISE-EN-ETAT.md).
- **24/11/2026** — PR 28 fusionnée. Images web/API et ZIP Chrome produits. L’utilisateur a confirmé capture Maps, import, note persistante et changement d’étape persistant. [PR 28](https://github.com/LePubli/growthOS/pull/28) · [CI des images](https://github.com/LePubli/growthOS/actions/runs/45359612117) · [Paquet Chrome](https://github.com/LePubli/growthOS/actions/runs/45359611980).
- **24/11/2026 · lot CRM et sources** — Compilation web et API, vérification TypeScript et tests du connecteur. Test d’intégration exécuté sur PostgreSQL 16.14 isolé avec sources externes simulées. Les contrôles ajoutés couvrent la nomenclature, les notes partagées et la répétition d’un import de chacune des cinq sources. [Suite API](scripts/smoke-wizard.mjs) · [Tests du connecteur](scripts/test-multisource-extension.mjs) · [Catalogue des activités](lib/db/src/naf.ts).
- **Prochaine revue** — après le retour positif sur Societe.com, vérifier LinkedIn puis Bing, Facebook, Instagram et TikTok source par source. Les cas limites des points 11 et 14 restent ouverts. Ajouter une preuve datée par résultat. La validation globale reste ouverte jusqu’à la recette des parcours et de la restauration.

- **24/11/2026 · lot sources et Societe.com** — choix utilisateur du connecteur Chrome sans abonnement API. Ajout du bouton « Enrichir via Societe.com » dans chaque fiche prospect, recherche par nom ou identifiant, recherche inverse par adresse/téléphone/domaine dans Bing limité à Societe.com, capture des données visibles, comparaison et confirmation avant fusion. Les contrôles API couvrent les identités et établissements contradictoires, la conservation du téléphone déjà renseigné et les conflits répétés. TikTok professionnel complète Facebook et Instagram. L’extension passe en 0.9.1 et le ZIP inclut le lecteur Societe.com.
- **Limite de recette de ce lot** — le navigateur Chromium de cet environnement ne démarre pas, car ses sockets sont interdits. Le rendu de la fenêtre, les boutons de recherche et la collecte sur les sites réels restent à vérifier dans Chrome. Les vérifications TypeScript, les builds et les simulations du lecteur et de l’API constituent les preuves techniques.

- **Résultat du lot sources et Societe.com** — 171 contrôles d’intégration réussis sur PostgreSQL 16.14 isolé. Pour Societe.com, LinkedIn, Bing, Facebook, Instagram et TikTok, les tests relisent les données enrichies, la provenance et le comportement face à un homonyme. Le lecteur Societe.com est testé sur une page simulée. TypeScript web/API et builds réussis. La recette Chrome réelle reste ouverte.

- **25/11/2026 · fiche complète, veille et sauvegarde** — 193 contrôles d’intégration réussis sur PostgreSQL 16.14 isolé. La régression d’enregistrement est reproduite avec une fiche importée contenant des champs nuls et corrigée. La veille est exécutée par le vrai traitement d’arrière-plan sur une source locale simulée. Les tests couvrent les notifications, l’absence de doublon d’alerte, une panne et les états distincts de l’entreprise et de l’établissement. TypeScript web/API, builds et tests du connecteur réussis. La recette visuelle sur la préproduction reste ouverte.

- **25/11/2026 · recherche inverse Societe.com** — préférence utilisateur appliquée. Les liens adresse, téléphone et domaine ouvrent Google avec le filtre `site:societe.com/societe/`. Le nom, le SIREN et le SIRET ouvrent directement Societe.com. Contrôle TypeScript web et build de l’interface effectués. Prochaine recette sur une fiche ayant une adresse, un téléphone et un site web.

## Correctifs du 25 novembre 2026 — enrichissement et identité des prospects

- Fenêtre Societe.com unique avec fond opaque. Le nom de l’entreprise et la ville sont proposés par défaut dans un champ modifiable. Un dirigeant déjà capturé peut être choisi. Aucun téléphone n’est proposé comme recherche principale.
- Web et extension utilisent la recherche Societe.com `q` avec `ftStatus=0`, y compris pour le SIRET et le SIREN.
- Le lecteur Chrome accepte les libellés sur la même ligne et les tableaux de libellés/valeurs. Il relève les dirigeants dans leur propre rubrique, leur fonction et leurs liens de contact professionnels visibles. Les données masquées et les recommandations d’autres sociétés sont exclues. Les contacts directs restent attachés au dirigeant, distincts du standard de l’entreprise.
- Les dirigeants et leurs coordonnées capturées sont visibles directement sur la fiche prospect. Refaire une capture puis confirmer l’enrichissement pour compléter une ancienne fiche. Les coordonnées non publiées sont indiquées comme absentes.
- Le contrôle du SIRET couvre les noms différents, les espaces, les créations simultanées, le CSV et les modifications. Les incohérences entre SIREN et SIRET sont refusées. La migration préserve les anciens doublons, les signale et permet une correction manuelle.
- Vérification locale effectuée sur PostgreSQL 16 jetable : **210 contrôles d’intégration réussis**, comprenant migration répétée avec anciens doublons, protection après suppression d’une fiche et correction d’un SIRET. Deux vraies requêtes HTTP concurrentes vérifient également la poursuite des lots connecteur et recherche enregistrée et le retour des captures déjà traitées. Tests du connecteur et contrôle de l’interface réelle dans un DOM isolé réussis. TypeScript et compilations web/API réussis. Les services externes des tests sont simulés.
- **Retour du 25/11 reçu après livraison** — « c’est bon ça fonctionne ». Le lot enrichissement Societe.com et identité est confirmé comme fonctionnel. La correction d’une ancienne paire en double et les cas limites de collecte restent à documenter séparément en usage. Aucune suppression automatique des doublons.

## Liens des sources professionnelles — lot du 25 novembre 2026

- La fiche prospect affiche les liens LinkedIn, Bing, Facebook, Instagram et TikTok collectés, avec leur provenance et leur date de capture quand elle est disponible. Les liens déjà relevés sur PagesJaunes et dans l’historique restent visibles. Un même profil n’est affiché qu’une fois par source malgré des variantes de paramètres de suivi.
- Les recherches proposées utilisent le nom de l’entreprise ou du contact et la ville. Les réseaux utilisent Google limité à leur site ; Bing garde sa recherche native. Une ville seule n’est pas présentée comme une recherche par nom.
- Une capture LinkedIn complète le champ LinkedIn vide. Un lien différent reste un désaccord à arbitrer et n’écrase pas la valeur actuelle. Les pages de publication et les profils personnels ne sont pas des pages entreprise importables.
- Une page LinkedIn peut représenter plusieurs établissements. Deux villes différentes ne sont pas fusionnées sur ce seul lien. Sans preuve d’établissement suffisante dans la même ville, la capture reste à vérifier et n’est pas retirée de la sélection.
- Recette utilisateur suivante : sur un prospect, utiliser le lien de recherche LinkedIn, confirmer la page entreprise via le connecteur, importer, recharger et vérifier le champ LinkedIn et le bloc « Sources et réseaux professionnels ». Réimporter puis vérifier le nombre de fiches. Répéter pour les quatre autres sources. L’extension 0.10.1.11 convient à ce lot web/API.

- **Preuves techniques de ce lot** — 226 contrôles d’intégration réussis sur PostgreSQL 16 jetable, avec sources externes simulées. Les scénarios LinkedIn couvrent import direct et recherche enregistrée, réimport, lien divergent, conservation/remplacement explicite, page « À propos », page partagée entre deux villes, cas ambigu, anciennes URL sans www/barre finale ou avec À propos et paramètres, et rejet d’un profil personnel ou d’une publication. Le test [des liens et du rendu React](scripts/test-professional-sources.mjs) vérifie les cinq sources, leurs provenances, les dates, les URL, les états vides et les recherches par nom. TypeScript web/API et compilation réussis. Le test de rendu porte sur le HTML des composants ; la recette dans Chrome reste ouverte.

## Catalogue et enrichissement ciblé — 26 novembre 2026

- **Codé et vérifié techniquement, recette Chrome à faire** : catalogue `/outils`, avec deux fonctions « nouveaux prospects » et « compléter un prospect ». Annuaire des entreprises, Maps, PagesJaunes, Google, Bing, Societe.com, LinkedIn Entreprises, Facebook, Instagram et TikTok sont décrits selon leurs capacités réelles. Les recherches officielles et PagesJaunes réutilisent le formulaire existant avec la source présélectionnée.
- La fiche prospect propose « Enrichir ». L’extension conserve le prospect cible et la source, propose la lecture d’une fiche visible ou la saisie assistée, demande la confirmation du bon établissement puis revient directement à sa fiche. Les profils personnels LinkedIn et publications ne sont pas des pages entreprise.
- **Enrichissement et import distincts** : les données partielles d’un prospect connu ne demandent pas une adresse et un CP inventés. Elles ne créent jamais un nouveau prospect et ne rejoignent pas la sélection d’import des listes. Une liste Maps ne peut pas être appliquée en bloc à un seul prospect.
- Les champs déjà renseignés sont conservés ; les divergences restent à arbitrer. La fusion cible le prospect de l’agence authentifiée, bloque les contradictions d’identité et de ville et s’exécute sous verrou PostgreSQL. Répéter le retour d’une tâche ne rejoue pas son enrichissement.
- Capture confirmée conservée localement pendant 24 h jusqu’à acquittement après succès. Un retour en échec propose une nouvelle tentative. Une capture erronée peut être abandonnée explicitement dans l’extension ; aucune donnée déjà enregistrée dans le CRM n’est supprimée.
- **Preuves** : 250 contrôles API/CRM sur PostgreSQL 16 jetable, sources externes simulées. Ils couvrent les neuf sources ciblées, données partielles, provenance, conflits, répétition, vrais appels HTTP concurrents, identité incohérente et isolation entre agences. Tests du connecteur et du rendu React du catalogue. Vérifications TypeScript et builds web/API réussis. Ces contrôles ne remplacent pas la recette réelle du nouveau parcours dans Chrome.
- **À valider après mise à jour manuelle** : ouvrir un prospect, cliquer « Enrichir », choisir Societe.com, ouvrir la bonne fiche et l’extension, lire, confirmer et vérifier le retour direct et les données. Recommencer sur une page entreprise LinkedIn sans adresse, puis Maps, PagesJaunes, Google, Bing et chaque réseau. Tester une erreur de session, réessayer et vérifier qu’aucun prospect n’est créé en plus. Vérifier qu’une collecte de nouveaux prospects reste sélectionnable et importable.
- **État produit** : LinkedIn et les réseaux restent assistés. Aucun moteur d’invitations, d’envoi ou de relance LinkedIn n’est livré dans ce lot. Aucun déploiement DockPanel automatique.

## Suite du plan — références Linked Helper reçues le 26 novembre 2026

Le [document de référence Linked Helper](docs/REFERENCE-LINKED-HELPER.md) conserve les fonctions visibles dans les captures, les correspondances GrowthOS et les étapes à développer. Priorités suivantes après recette du lot actuel : comptes connectés et compagnon, contacts liés aux entreprises, listes et qualification, moteur de campagnes persistant, première séquence puis boîte de réception. L’espace « Comptes connectés » et le navigateur intégré ne sont pas encore développés. La connexion actuelle se fait directement dans Chrome, sans transfert des identifiants vers GrowthOS.

## Correction après recette du 26 novembre — remplacement et veille

- Le bouton « Lire la fiche affichée » précède la comparaison, la confirmation puis le retour au prospect. Extension de base 0.11.1.
- Google/Maps/Bing ne déduisent plus une ville d’une ligne libre pouvant être une catégorie (« Chauffagiste »). Sans adresse postale ni libellé explicite de localité, la ville reste vide.
- Même SIRET exact : une différence de nom, de ville ou d’adresse ne bloque plus l’enrichissement ciblé. Les valeurs actuelles sont comparées aux nouvelles ; le remplacement explicite est proposé. Un autre SIRET ou une identité contradictoire reste refusé. Sans preuve d’établissement exacte, les contrôles de rapprochement restent actifs.
- Les résolutions sont transactionnelles et les modifications d’adresse invalident l’ancienne géolocalisation. Les activités de la fiche enregistrent les valeurs avant/après, la source, la date et l’auteur de la décision. Les enrichissements enregistrent aussi leurs ajouts et propositions. Réessayer ne crée pas d’activité en double.
- **Veille activée** : l’Annuaire officiel met à jour automatiquement dénomination, SIREN concordant, adresse/code postal/ville du SIRET exact et activité avec son libellé NAF. Les statuts, dirigeants et données économiques restent actualisés dans les rubriques officielles et leur historique. Une notification et une activité signalent les changements.
- Une donnée absente n’efface pas une valeur connue. Un établissement absent ne reprend ni l’adresse ni l’activité de son siège. Une réponse plus ancienne conserve les dernières données connues. Téléphone, email, site web, coordonnées sociales et statut commercial ne sont pas remplacés par l’Annuaire.
- **Veille désactivée** : contrôle et affichage du statut officiel conservés, sans remplacement automatique des champs CRM. Les modifications issues des captures demeurent proposées à l’utilisateur.
- La fiche et ses activités se rafraîchissent après une synchronisation détectée. Un formulaire en cours de modification est conservé ; sa sauvegarde envoie uniquement les champs modifiés depuis le début de l’édition. Les traces automatiques `data_update` sont en lecture seule dans l’API et l’interface.
- **Preuves** : 268 contrôles d’intégration réussis sur PostgreSQL 16 jetable, sources externes simulées. Ils incluent le cas Chauffagiste, trois résolutions concurrentes/successives, traçabilité relue dans `/activities`, absence de doublons, protection de l’historique, correction automatique par veille activée, maintien des coordonnées non publiées, dénomination et activité modifiées, réponse partielle, version ancienne et établissement absent. Tests Chrome simulés, rendu React, TypeScript et builds web/API vérifiés. Recette réelle du nouveau correctif à effectuer dans Chrome.
- **Travail design parallèle** : seules les modifications d’interface nécessaires au parcours, aux propositions et à la traçabilité ont été faites dans ce lot. Aucun déploiement DockPanel par l’agent.

### Complément de revue — dates officielles et identité corrigée

- La protection contre une réponse plus ancienne compare uniquement les snapshots du même SIREN et du même SIRET demandé. Corriger l’identité d’un prospect établit un nouveau contrôle, même si l’entreprise ou l’établissement corrigé a une date de source plus ancienne.
- Deux régressions testées : autre entreprise après changement du SIREN/SIRET ; autre établissement dans la même entreprise. **270 contrôles d’intégration réussis** sur PostgreSQL 16 jetable, fournisseurs simulés. L’extension reste en 0.11.1 pour ce complément API.
- Coordination renforcée à la demande du propriétaire : branches et PR séparées, contrôle des modifications locales et distantes avant commit/fusion, préservation des fichiers de l’autre agent. Voir `COORDINATION-AGENTS.md`, à supprimer au lancement final autorisé en production.


## Orientation précisée — navigateur intégré et clients Web/PC/Android

- Le propriétaire veut automatiser recherche, collecte et enrichissement dans GrowthOS. Connexion à ses comptes lorsque possible, navigation publique sans compte lorsque la source l'autorise. L'extension Chrome devient un secours externe ; la recopie manuelle ne valide pas cet objectif.
- Plateformes demandées : Web, application PC et application Android. Socle proposé : même API/CRM et moteur de tâches central sur VPS, avec progression et résultats partagés. L'exécution ne doit pas dépendre d'un PC ou téléphone laissé ouvert.
- Inventaire : navigateur serveur PagesJaunes sans session persistante ; collecteurs Chrome et fusion CRM réutilisables ; base mobile Expo existante mais non recettée pour ces parcours ; aucun client PC identifié. Les comptes persistants, le navigateur interactif et les collecteurs intégrés des réseaux restent à construire.
- [Cadrage et recette à suivre](docs/NAVIGATEUR-INTEGRE-AUTOMATISATION.md). Il distingue ce qui existe de ce qui reste à réaliser, les clients, la file, les états de session et le secours. Aucun nouveau fonctionnement n'est livré par cette note ; aucun redéploiement requis pour un changement documentaire.

## 43 · Premier navigateur Web cloud (26/11/2026)

- Implémenté : vue interactive dans GrowthOS, profils personnels séparés, stockage persistant, déconnexion, file de tâches, reprise/annulation, sélection avant import et enrichissement ciblé avec historique.
- Testé en isolation : 299 contrôles API sur PostgreSQL 16 (sources simulées), protocole navigateur, contrat UI et tests du thème ; TypeScript et builds API/Web. Chromium réel exécuté par la CI sur des pages locales de recette : statut à suivre dans la PR.
- À recetter : connexion réelle acceptée par chaque fournisseur depuis le VPS, Maps au-delà d'une première page, données Societe.com réelles, consommation VPS et reprise après arrêt du conteneur.
- À développer : collecteurs automatiques LinkedIn/FB/Instagram/TikTok, raccordement PagesJaunes au nouveau moteur ; Windows/Android différés. Les campagnes d'invitations/messages ne sont pas incluses.

## 44 · Imports en lot et commandes des tâches cloud (26/11/2026)

- **Recette Maps observée** : la capture utilisateur du 26/11 montre une recherche « plombier 59 » terminée avec 9 fiches proposées et 1 fiche partielle conservée. L'import Google est confirmé fonctionnel par le propriétaire le 27/11 ; l'affichage après import et le réimport restent à recetter avec le correctif ci-dessous.
- **Lot PR51** : tout cocher/décocher dans chaque lot, compteur de sélection, import groupé désactivé sans sélection. Après import, seules les captures effectivement traitées quittent la sélection ; les désaccords restent disponibles.
- **Tâches** : annuler, reprendre une tâche annulée avec ses critères et son identifiant conservés, supprimer une tâche terminée ; nouvelle lecture après chaque commande.
- **Historique** : suppression individuelle, par sélection ou nettoyage de toutes les recherches terminées/échouées/annulées, même au-delà des 30 affichées. Confirmation préalable pour la perte des résultats non importés. Les tâches actives/en attente, les prospects importés, les activités et les profils sont préservés.
- **Coordination design** : composant fonctionnel `components/cloud-browser/CloudJobHistory.tsx`, raccordé au nouveau poste de travail PR52 (sélection à droite, cartes de tâches compactes). CSS de la PR52 conservé intégralement. Notes partagées dans `COORDINATION-AGENTS.md`.
- **Validation locale** : 314 contrôles API passent sur PostgreSQL16 jetable (sources simulées), dont reprise après annulation, refus des suppressions actives/étrangères, conservation CRM et purge au-delà des 30 recherches affichées. TypeScript API/Web, builds et tests React des sélections passent. CI images à confirmer avant feu vert. Aucun déploiement DockPanel par l'agent.

## 45 · Statut CRM et suivi persistant des imports (27/11/2026)

- Symptôme utilisateur confirmé : import Google réussi, mais résultats toujours proposés à l'import et absence de statut par fiche.
- Import serveur par identifiants de captures du job ; création/enrichissement CRM et reçu sont enregistrés dans la même transaction, avec traitement unique des doubles clics. Statuts : importée, enrichie, déjà présente, à vérifier, échec ; réimport proposé si la fiche CRM a réellement été supprimée.
- Les fiches traitées quittent la sélection et rejoignent une rubrique repliable « Fiches traitées », avec leur statut et un lien CRM. Les compteurs et états restent après actualisation. Les échecs/désaccords restent disponibles. Les anciens imports sont reconnus uniquement par leurs traces existantes dans le CRM ; une ambiguïté n'est pas déclarée traitée.
- Validation : **331 contrôles API verts** sur PostgreSQL16 jetable (sources simulées), dont import concurrent, reçus après actualisation, anciennes captures, panne d'écriture du reçu avec annulation CRM, suppression/réimport réel, isolation agence/utilisateur et désaccord limité aux valeurs de la capture concernée. Tests React du retour d'import, historique et layout, TypeScript API/Web et builds verts. CI images à suivre avant feu vert.
- Thème et CSS de la PR52 conservés ; notes des agents conservées. Aucune modification Compose ni action DockPanel par l'agent.

## 46 · PagesJaunes cloud, collecte continue et enrichissement accessible (27/11/2026)

- PagesJaunes raccordé au navigateur cloud : recherche, lecture des détails et pagination avec les lecteurs canoniques déjà utilisés par Chrome. Les vérifications humaines restent visibles et les résultats déjà lus sont conservés. Extension inchangée.
- Le plafond total 10/25 est retiré : les lots techniques s'enchaînent jusqu'à la fin des résultats accessibles sur la source. Capture/identifiants/reçus sont conservés entre les lots et après annulation/reprise. L'import est possible pendant la suite de collecte ; une sélection supérieure à 25 est envoyée par groupes techniques successifs sans quota total affiché.
- Prospect : les raccourcis d'enrichissement par sources ouvrent le même navigateur cloud ciblé. Plus de dépendance obligatoire à Chrome pour le raccourci Societe.com/PagesJaunes ; recherche du SIREN/SIRET proposée lorsque le contrôle officiel n'est pas encore possible. Commandes IA et enrichissement complémentaire conservés.
- Une source sans collecteur automatique reste consultable avec un profil créé à l'ouverture ; aucune fausse action « enrichir automatiquement » n'est proposée pour les réseaux encore non raccordés.
- Design PR55/56, séparation redimensionnable et focus discret préservés. Validation locale : 342 contrôles API PostgreSQL16 verts (sources simulées), tests React des commandes/enrichissements et TypeScript/builds. Chromium réel vert sur pages de recette : 35 détails Maps et pagination PagesJaunes, [CI PR57](https://github.com/LePubli/growthOS/actions/runs/45967168729). Publication des quatre images à confirmer avant feu vert. Aucune action DockPanel ni changement de Compose.

- Complément de revue PR57 : le profil détaillé PagesJaunes traverse la validation jusqu’au CRM, y compris SIREN sans SIRET, horaires, prestations, réseaux et avis. Les détails actualisés conservent dix versions précédentes et génèrent une activité avant/après. Reprise Google/Bing : la page sélectionnée lors d’une intervention est conservée. Trois régressions API supplémentaires passent (342 au total).
- Synchronisation design PR58 : nouveau catalogue `/outils` conservé, seuls la destination PagesJaunes (cloud) et son badge de capacité changent. Les CSS du catalogue et du navigateur sont identiques à ceux livrés par l’agent design.

## 47 · Enrichissement automatique multisource et collecte unifiée (27/11/2026)

- Incident Nord Artisan / Kevin Duville : correction du rapprochement qui assimilait deux identifiants absents à une correspondance ; nom/ville seuls ou un résultat unique ne prouvent jamais l’identité. Enseignes officielles, adresse, téléphone et identifiants sont comparés, avec refus des établissements contradictoires et des ambiguïtés.
- Le bouton principal et les raccourcis d’enrichissement du prospect lancent une tâche persistante depuis la fiche : Annuaire officiel, Maps, PagesJaunes, INSEE direct si configuré, Societe.com, Google Search et Bing. Profils de navigation existants réutilisés ; reprise après redémarrage ; un double clic ne crée pas deux tâches. Progression et bilan par source sur la fiche, activités avant/après et divergences conservées. Le Copilote IA reste présent.
- L’Annuaire gratuit fournit notamment les données du répertoire INSEE ; cela n’est pas présenté comme une seconde vérification indépendante. L’API directe Sirene 3.11 exige une clé INSEE configurée et un SIRET confirmé. Les réseaux sans collecteur restent explicitement manuels.
- Toutes les nouvelles recherches utilisent `/navigateur`, y compris l’Annuaire natif sans navigateur ni extension, avec filtres régions/départements/codes postaux, pagination et mêmes reçus d’import. `/sourcing` et ses anciennes fiches redirigent vers cet espace ; l’historique et les résultats précédents restent consultables/importables dans une archive. Aucune suppression du CRM.
- Design PR58 et CSS conservés. Migration additive d’une file de tâches en base. 359 contrôles d’intégration PostgreSQL16 verts (fournisseurs simulés), tests TypeScript/React/identité verts. Contrôle Chromium réel sur fixtures et publication des images à confirmer. Aucun déploiement DockPanel par l’agent.

Revue PR59 : un SIREN commun exige des coordonnées d’établissement concordantes quand le SIRET entrant manque ; zone géographique recontrôlée pour chaque établissement (siège hors zone exclu) ; portée APE conservée et repli unité légale proposé sans écraser le code ou remplir un libellé incohérent. API INSEE directe et conservation de 65 résultats historiques testées. Chromium réel vert sur fixtures ; relance du contrôle sur le dernier correctif avant fusion.

## Correctif en cours — lecteurs réels d’enrichissement (27/11/2026)

- Societe.com : rechercher le nom seul, choisir dans les cartes par nom et ville ou SIREN exact, reconnaître les liens superposés sans texte et les dirigeants `/manager/`.
- Annuaire : tolérer les compléments explicites de bureau et les abréviations de voie sans ignorer numéro/bis/ter ni accepter plusieurs établissements. Conserver et signaler l’ancien établissement fermé, sans substitution silencieuse du siège.
- Societe.com, même SIREN et autre SIRET : reprendre uniquement les données légales et dirigeants ; conserver SIRET/adresse/coordonnées propres au prospect et la provenance du siège séparément.
- Maps : valider les détails réellement affichés sous `/maps/search/` avec preuve DOM titre/adresse, puis comparaison d’identité conservée.
- Google/Bing : distinguer résultats organiques sans nouveau champ et blocage ; conserver les liens repérés comme références non confirmées.
- PagesJaunes : blocage Cloudflare reconnu et contrôle affichable ; disponibilité automatique non garantie tant que la source le demande. Aucun contournement.
- Vérification manuelle : afficher la tâche et le profil de la source demandée, sans les tâches Bing des autres sources.

Validation et publication en cours ; aucun déploiement DockPanel effectué.

## Pappers, BODACC et onglet Enrichissements — validation en cours (27/11/2026)

- Pappers : fiche publique par SIREN, données légales, dirigeants et tableaux financiers visibles avec année ; API payante non requise, coordonnées réservées non inventées. Respect du même établissement dans le CRM quand le siège est différent.
- BODACC : API officielle DILA, pagination technique de 100 annonces poursuivie jusqu’à la fin, contrôle de chaque SIREN, événements datés et liens officiels dans le dossier. Changement versionné et tracé ; relecture identique sans fausse activité. L’historique des annonces ne remplace pas le statut actuel INSEE/Annuaire.
- Onglet Enrichissements sur la fiche : lancement automatique, progression/bilan par source, captures, provenance, modifications enregistrées et accès aux désaccords. Thème et CSS conservés.
- Les réseaux sociaux sans collecteur restent manuels ; PagesJaunes peut demander un contrôle Cloudflare. Les sources officielles directes continuent indépendamment.

Vérifications et publication des images en cours, aucun déploiement serveur effectué.

Lot Pappers/BODACC/onglet : code raccordé dans la PR61, 369 contrôles API locaux verts et tests interface/TypeScript/builds verts. Le statut des images et la validation Chromium sont consultables dans les workflows GitHub de cette PR et du dernier commit de `fix/growthos-functional-redesign`. Le redéploiement reste à effectuer par le propriétaire après le feu vert explicite.

Revue PR61 : curseur BODACC et instantané enregistrés dans la même transaction, dernière page idempotente après interruption ; pagination liée au SIREN et remise à zéro après correction d’identité. **371 contrôles API** passent, dont les deux scénarios de reprise/correction. Chromium Pappers vert sur le premier head (run `45988161584`), aucune modification du lecteur dans ce complément ; nouvelle CI avant fusion.

## Lot demandé : validation d’enrichissement, site web, cartographie et complétude (27/11/2026)

Branche isolée `fix/prospect-enrichment-validation-and-website`, base préprod PR61. Priorité au blocage réel signalé : « Vérifier cette source » puis « Reprendre » ne permet pas de confirmer la bonne identité, notamment enseigne différente du nom légal. Ajouter comparaison et confirmation explicite, protéger les identifiants contradictoires, enregistrer et actualiser le bilan parent ; tester le parcours complet, pas seulement la lecture.

Autres exigences du même lot : inclure le site déjà renseigné dans l’enrichissement (Contact, mentions légales, coordonnées/réseaux avec preuves), distinguer email publié et hypothèse sans prétendre valider une boîte sur la seule présence d’un MX ; priorité aux relations Societe.com, Pappers en repli si données absentes ; même calcul documentaire et mêmes données entre aperçu et fiche 360°, supprimer le calcul divergent par quart.

Réseau : l’IP d’un navigateur distant reste celle du serveur. Le mode local doit réellement exécuter la lecture sur l’appareil via l’extension autorisée, sans usurper le navigateur ou contourner un contrôle. Les comptes/sessions restent isolés. Pas de promesse de mode local Android par simple réglage Web ; documenter la capacité effective.

Conserver tous les CSS/thème et les notes de l’agent design. Le catalogue des 306 sources (PR62) reste différé après recette, hors de ce correctif. Aucun déploiement DockPanel par l’agent. Statut : en cours ; tests et images à vérifier avant feu vert.

Validation du lot (PR66) : **386 contrôles API avec PostgreSQL jetable**, dont confirmation d’une enseigne différente, remplacement choisi de ville/téléphone, refus d’identifiants contradictoires, changement concurrent, idempotence, isolation et réconciliation du bilan parent avec reprogrammation des sources dépendantes. Lecture Contact/mentions, email publié et preuve par champ, réseaux, hypothèses non confirmées, SSRF/DNS/redirections testés. TypeScript API/Web, builds API/Web et tests interface/extension verts. Chromium réel vert : run `46019713873` sur `85f1a37`. Dernier design ATLAS et panneau Chrome persistant (`cc78fa0`) intégrés sans modification de CSS. Publication des quatre images sur le head final restant à contrôler avant feu vert. Aucun déploiement DockPanel ; notes conservées, catalogue 306 sources différé.

## Correctif noms et validation simplifiée (27/11/2026)

Branche isolée `fix/prospect-names-and-conflict-validation`, base PR66 `b7dbe12`. Retours utilisateur : désaccord bloqué « La valeur CRM a changé » après une mise à jour officielle ; raison sociale écrase le nom commercial ; validation affiche une comparaison sans terminer ; secours IP PC ouvre seulement la source sans commandes visibles.

Travail : conserver `company` comme nom affiché, enregistrer raison sociale et enseignes dans `sourceDetails.identity` avec source/historique ; empêcher Societe.com et la veille de renommer automatiquement le prospect. Résoudre les désaccords sur la valeur actuelle réellement affichée, acquitter une proposition déjà appliquée et conserver la protection contre une véritable écriture concurrente. Comparaison et validation directement dans l’onglet Enrichissements, un seul clic explicite pour appliquer les champs vides et les remplacements visibles cochés ; changement du nom affiché facultatif et décoché par défaut.

Secours Chrome : ouvrir les commandes du panneau sur le geste initial, onglet de secours si Chrome refuse ; lecture de l’onglet source mémorisé ; permission optionnelle demandée seulement pour la source choisie (aucun hôte obligatoire supplémentaire), lecture et retour vers la comparaison CRM. Corriger la saisie assistée masquée par son conteneur. Garder le design ATLAS et tous les CSS ; aucune action DockPanel, aucun lancement production ni suppression de notes. Tests/publication en cours.

Validation locale finale du correctif : **394 contrôles PostgreSQL verts**, dont l’adresse reformattée de la capture utilisateur, acquittement d’une valeur déjà appliquée, double validation sans activité répétée, restauration explicite d’un nom affiché sans perte de raison sociale, protection concurrente et confirmation malgré une actualisation de métadonnées. Tests des noms (plusieurs enseignes / même SIRET / priorité Annuaire), TypeScript API/Web, build Web et tests interface/extension verts. Bouton de validation placé avant le tableau avec message de succès. Extension 0.11.2 : accès source optionnel, panneau ou onglet de commandes de secours, suivi du nouvel onglet source. PR67 ; Chromium et publication des images à vérifier avant feu vert. Notes à conserver ; aucun déploiement DockPanel.

Complément de livraison PR67 : la validation fonctionnelle finale est verte (394 contrôles, Chromium réel avec styles du panneau), mais la construction Docker Web a révélé un oubli de copie du nouveau module pur `lib/api-zod/src/prospect-names.ts`. Branche `fix/web-business-names-build` : ajouter ce seul fichier au contexte du builder, sans changement de dépendances ou de logique. Les images doivent être vérifiées sur le nouveau commit avant feu vert ; l’extension 0.11.2 déjà empaquetée reste identique. Aucun redéploiement DockPanel effectué.
