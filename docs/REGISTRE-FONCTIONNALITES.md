# GrowthOS — registre maître des fonctionnalités, preuves et recettes

> **Photographie documentaire du 28 novembre 2026** — dépôt [LePubli/growthOS](https://github.com/LePubli/growthOS), branche de livraison **fix/growthos-functional-redesign**, références examinées jusqu’à la [PR #82](https://github.com/LePubli/growthOS/pull/82) (head publié : **a888400**). Ce document est un **inventaire raisonné, pas une certification de production**. Les commits/PR prouvent du code et des tests décrits ; seul un essai réel sur le déploiement par le propriétaire confirme la recette en usage.

## 0. Comment lire et maintenir le registre

- **Implémentation :** **L** = fonction présente dans le code selon les preuves citées ; **P** = partielle ou limitée ; **C** = spécifiée/cadrée seulement ; **N** = non livrée au niveau de service attendu.
- **Validation :** **U** = usage confirmé par l’utilisateur pour le cas précis ; **T** = tests automatisés/isolés, souvent sur données simulées ; **R** = recette réelle encore requise ; **B** = bug/blocage effectivement rapporté ; **—** = aucune preuve de recette trouvée. Le format **L/T+R** signifie « codé et testé, mais pas encore accepté en conditions réelles ».
- **Responsable proposé :** **F** = agent fonctionnel (API, navigateur cloud, CRM) ; **D** = agent design (ATLAS × ORBIT) ; **E** = futur agent extension Chrome (attribution **proposée**, à confirmer avant développement) ; **T** = transversal et validation propriétaire. Le responsable désigne le périmètre principal, pas le droit de modifier seul tous les fichiers.
- **Priorités :** **P0** = blocage de parcours, identité, import, sécurité ou exploitation ; **P1** = essentiel pour préproduction utilisable ; **P2** = évolution ultérieure ; **P3** = étude ou vision produit. Les priorités proposées restent à arbitrer par le propriétaire.
- **Sources :** [suivi fonctionnel](../SUIVI-FONCTIONNEL.md), [coordination](../COORDINATION-AGENTS.md), [diagnostics](DIAGNOSTICS-CONTRACT.md), [navigateur intégré](NAVIGATEUR-INTEGRE-AUTOMATISATION.md), [parcours de vérification](design/PARCOURS-VALIDATION-SOURCES-ONE-CLICK.md), [référence Linked Helper](REFERENCE-LINKED-HELPER.md), [déploiement](DEPLOIEMENT-CONTINU-DOCKPANEL.md). Tous les liens de PR renvoient à une preuve de lot, **pas** à une acceptation utilisateur.
- **Évolution depuis le projet initial :** le suivi historique comporte déjà 47 points métier et plusieurs appendices, mais son en-tête renvoie encore à la PR #57. Ce registre le complète sans réécrire ni effacer les notes des autres agents. Le [CHANGELOG](../CHANGELOG.md) détaille surtout juin ; il ne remplace pas l’historique Git de mai à novembre.

### Règle obligatoire pour chaque PR future

1. Mettre à jour **uniquement les lignes affectées**, avec **date**, **PR/commit**, **preuve de test** et **scénario utilisateur** ; ajouter une ligne si une nouvelle fonctionnalité ou une nouvelle source apparaît. Une création d’écran ou un test de fixture ne vaut pas validation réelle.
2. Séparer **préproduction validée**, **CI avec fournisseurs simulés**, **code compilant**, **fonction manuelle**, **source indisponible** et **fonction seulement envisagée**. Ne pas transformer automatiquement **R** en **U** lors d’une fusion.
3. Documenter les anomalies dans le registre avec reproductibilité, navigateur/appareil, source, tâche/prospect non sensibles et diagnostic expurgé. Relier l’incident à la PR qui l’a corrigé puis à la **recette réelle** qui le clôt.
4. Respecter le [contrat de diagnostic transversal](DIAGNOSTICS-CONTRACT.md) : code incident, cause factuelle/probable, traces tenant-isolées, absence de PII/secrets, tests de l’échec dans la même PR.
5. Pour un changement commun à plusieurs agents, déclarer l’**ownership** dans [COORDINATION-AGENTS.md](../COORDINATION-AGENTS.md) et travailler en branche/PR dédiée. **Jamais** de force push ni de remplacement d’une copie ancienne ; ne pas supprimer les notes temporaires avant lancement final de production **expressément autorisé**.
6. Le propriétaire seul redéploie DockPanel. Une fusion documentaire **n’exige pas de redéploiement**. Un déploiement applicatif demande la vérification des **quatre images :preprod sur le même SHA** et un message explicite **PRÊT À REDÉPLOYER** de l’agent qui a livré.

## 1. Socle, identité, sécurité et exploitation

| ID / priorité | Capacité métier et état exact | État | Preuve | Critère de recette / lacune | Resp. |
|---|---|---|---|---|---|
| SOC-01 · P0 | Installation initiale, premier compte et wizard | L/T+R | [Suivi §17](../SUIVI-FONCTIONNEL.md) ; [audit initial](PREPROD-REMISE-EN-ETAT.md) | Instance vierge, création d’agence, reprise et connexion après refresh. Ne jamais tester sur DB réelle sans sauvegarde. | F |
| SOC-02 · P0 | Authentification, renouvellement du jeton et reconnexion | L/T+R | [CHANGELOG](../CHANGELOG.md) ; [Suivi §17](../SUIVI-FONCTIONNEL.md) | Session expirée, 401, deux navigateurs et reconnect sans boucle. | F |
| SOC-03 · P0 | Rôles, utilisateurs, équipes et isolation inter-agences | P/T+R | [Suivi §§17,29,30](../SUIVI-FONCTIONNEL.md) | Vérifier refus d’accès à une fiche d’une autre agence ; invitations, révocation et permissions du deuxième utilisateur. | F |
| SOC-04 · P1 | Paramètres utilisateur, intégrations, clés API et rôles admin | P/T+R | [Suivi §§17,27,28](../SUIVI-FONCTIONNEL.md) | Renseignement/révocation de chaque clé de test et retour d’erreur sans fuite de secret. | F |
| SOC-05 · P0 | Stockage PostgreSQL 16, schémas, transactions métier et migration | L/T+R | [PR #81](https://github.com/LePubli/growthOS/pull/81) ; [documentation déploiement](DEPLOIEMENT-CONTINU-DOCKPANEL.md) | Sauvegarde/restauration sur base isolée, migrations non destructives, idempotence. | F |
| SOC-06 · P0 | Docker/GHCR, quatre images Web/API/PagesJaunes/Navigateur et DockPanel | L/T+R | [PR #82](https://github.com/LePubli/growthOS/pull/82) ; [workflow images](https://github.com/LePubli/growthOS/actions/runs/46138455095) | Vérifier les quatre images du **même SHA**, sauvegarder DB, redéployer via Edit/Save et mesurer API/worker/UI. PR82 annonce leur publication ; **DockPanel non déployé par les agents**. | T |
| SOC-07 · P0 | Volumes persistants, secrets et retour arrière après déploiement | P/R | [Guide DockPanel](DEPLOIEMENT-CONTINU-DOCKPANEL.md) | Ne pas remplacer les volumes ni les secrets ; restaurer un test DB et revoir les migrations avant rollback. | T |
| SOC-08 · P1 | Navigation Web, recherche globale, paramètres et accessibilité | P/T+R | [Suivi §32](../SUIVI-FONCTIONNEL.md) ; [PR #44](https://github.com/LePubli/growthOS/pull/44) | Desktop/mobile, clavier, chargement, erreur/état vide sur les routes réellement exposées. | D/F |
| SOC-09 · P2 | Application PC Windows installable | N/— | [Architecture des clients](NAVIGATEUR-INTEGRE-AUTOMATISATION.md) | Installer/signature, connexion, mises à jour et exécuteur local explicitement vérifié. **Différée**. | F |
| SOC-10 · P2 | Application Android complète et signée | P/— | [Architecture des clients](NAVIGATEUR-INTEGRE-AUTOMATISATION.md) | Base Expo existante, mais APK signé, connexion réelle et navigateur/collecte non réceptionnés ; **différée**. | F |
| SOC-11 · P0 | Traçabilité, absence de secrets/PII dans les logs techniques | P/T+R | [PR #72](https://github.com/LePubli/growthOS/pull/72) ; [contrat diagnostic](DIAGNOSTICS-CONTRACT.md) | Captures, cookies, HTML, coordonnées privées et SQL brut absents des exports/logs ; contrôle avec deux agences. | F |
| SOC-12 · P1 | Maintenance, surveillance applicative, arrêt/reprise des jobs | P/T+R | [Suivi §§31,37](../SUIVI-FONCTIONNEL.md) | Arrêter puis redémarrer worker/API au milieu d’une tâche ; vérifier absence de duplication et reprise d’état. | F |

## 2. Recherche B2B, catalogue et collecte par source

| ID / priorité | Capacité métier et état exact | État | Preuve | Critère de recette / lacune | Resp. |
|---|---|---|---|---|---|
| SRC-01 · P1 | Catalogue des outils par source, capacités affichées et ouverture ciblée | L/T+R | [PR #38](https://github.com/LePubli/growthOS/pull/38), [PR #58](https://github.com/LePubli/growthOS/pull/58) | Chaque CTA ouvre le vrai collecteur et annonce honnêtement automatique/assisté/indisponible. | D/F |
| SRC-02 · P1 | Recherche par activité, texte, région, département, commune/code postal | L/T+R | [Suivi §§01,16,47](../SUIVI-FONCTIONNEL.md) | Plusieurs départements, exclusion géographique du siège hors zone, code postal et absence de résultat. | F |
| SRC-03 · P1 | Annuaire des Entreprises (SIREN/SIRET, statut et identité) | L/U limité | [Suivi §§01,35,47](../SUIVI-FONCTIONNEL.md) | Sélection explicite d’établissement et test siège ≠ établissement ; relecture après import. | F |
| SRC-04 · P0 | Google Maps, résultats puis lecture des fiches détaillées | L/T+R | [PR #28](https://github.com/LePubli/growthOS/pull/28), [PR #57](https://github.com/LePubli/growthOS/pull/57) | Lot réel supérieur à 25, détail de chaque fiche et arrêt/reprise sans 5 premières répétées. | F |
| SRC-05 · P0 | PagesJaunes, lecture détaillée et pagination dans le cloud | L/T+R | [PR #57](https://github.com/LePubli/growthOS/pull/57) | Collecte sur vraie page, détection du contrôle Cloudflare, reprise après intervention, données complètes. | F |
| SRC-06 · P1 | Google Search, cartes locales et résultats organiques | P/T+R | [PR #60](https://github.com/LePubli/growthOS/pull/60), [PR #74](https://github.com/LePubli/growthOS/pull/74) | Distinguer résultat absent, chargement lent, consentement et page réellement illisible ; aucune donnée inventée. | F |
| SRC-07 · P1 | Bing, recherche locale et lecture d’établissement | P/T+R | [Suivi §05](../SUIVI-FONCTIONNEL.md), [PR #74](https://github.com/LePubli/growthOS/pull/74) | Fiche réelle, nom/adresse concordants, homonyme, absence de résultats et reimport. | F |
| SRC-08 · P0 | Societe.com : raison sociale, établissement, APE, dirigeants et documents publics | L/U limité | [Suivi §§07,34](../SUIVI-FONCTIONNEL.md), [PR #60](https://github.com/LePubli/growthOS/pull/60) | Identifiant et établissement exact, homonymes, SIREN commun mais SIRET distinct ; données masquées non inventées. | F |
| SRC-09 · P1 | Pappers : fiche publique et dirigeants/finances publiés | P/T+R | [PR #61](https://github.com/LePubli/growthOS/pull/61) | Confirmer SIREN exact dans la page publique ; preuve de chaque champ ; accès premium non simulé. API commerciale payante **non branchée** par cette PR. | F |
| SRC-10 · P1 | BODACC : annonces officielles et historique paginé | L/T+R | [PR #61](https://github.com/LePubli/growthOS/pull/61) | Pagination complète, reprise au curseur, correction d’identité et absence d’annonce ; ne remplace pas le statut INSEE actuel. | F |
| SRC-11 · P1 | API Sirene/INSEE directe si configurée | P/T+R | [Suivi §§11,47](../SUIVI-FONCTIONNEL.md) | Clé valide, SIRET confirmé, 401/429, jamais une seconde source indépendante fictive si l’Annuaire retransmet l’INSEE. | F |
| SRC-12 · P1 | Référentiel APE/NAF, libellé officiel, recherche et filtres | L/T+R | [PR #29](https://github.com/LePubli/growthOS/pull/29) | Ancienne/nouvelle fiche, libellé absent, mots d’activité, code inconnu. | F |
| SRC-13 · P2 | LinkedIn page entreprise via navigateur/extension | P/T+R | [Suivi §06](../SUIVI-FONCTIONNEL.md), [PR #36](https://github.com/LePubli/growthOS/pull/36) | Capture d’une vraie page, URL entreprise, provenance et rejet d’un profil personnel comme page société. Automatisation générale **non livrée**. | E/F |
| SRC-14 · P2 | Facebook Pages : page professionnelle et liens publics | P/T+R | [Suivi §08](../SUIVI-FONCTIONNEL.md), [PR #82](https://github.com/LePubli/growthOS/pull/82) | Distinction page entreprise/profil personnel/publication ; format Facebook /people/ reconnu comme **référence**, pas dirigeant confirmé. | E/F |
| SRC-15 · P2 | Instagram professionnel, TikTok professionnel | P/T+R | [Suivi §§09,10](../SUIVI-FONCTIONNEL.md) | Compte public réel, lien de profil versus publication, propriétaire identifié, absence de connexion ; collecteurs automatiques non revendiqués. | E |
| SRC-16 · P2 | Exploration des pages Contact, mentions légales, site web et liens sociaux | L/T+R | [PR #66](https://github.com/LePubli/growthOS/pull/66), [PR #77](https://github.com/LePubli/growthOS/pull/77), [PR #82](https://github.com/LePubli/growthOS/pull/82) | Pages réelles, liens personnels avec nature/provenance, contacts publiés seulement, échecs par page visibles. | F |
| SRC-17 · P2 | Autres sources B2B françaises, répertoire extensible (306 entrées) | C/— | [PR #62 en brouillon](https://github.com/LePubli/growthOS/pull/62) | Inventaire préparatoire **non fusionné** et **non audité source par source** ; aucun connecteur déclaré opérationnel du seul fait de la liste. | T |
| SRC-18 · P2 | Vérification BAN/adresse et géocodage | P/R | [Suivi §15](../SUIVI-FONCTIONNEL.md), [PR #48](https://github.com/LePubli/growthOS/pull/48) | Adresse réellement existante, numéro absent, mismatch commune/code postal, zéro correspondance ; pas de SIRET inventé. | F |
| SRC-19 · P1 | Historique de source, provenance et date/heure d’observation | L/T+R | [PR #61](https://github.com/LePubli/growthOS/pull/61), [PR #75](https://github.com/LePubli/growthOS/pull/75) | Preuve consultable depuis CRM, source indisponible distinguée de « aucune donnée ». | F |

## 3. Navigateur cloud et parcours de collecte

| ID / priorité | Fonctionnement et promesse réelle | État | Preuve | Recette bloquante / cas limite | Resp. |
|---|---|---|---|---|---|
| NAV-01 · P0 | Worker Chromium sur VPS, API de tâches et profils isolés | L/T+R | [PR #43](https://github.com/LePubli/growthOS/pull/43) | Créer deux profils indépendants ; arrêt/redémarrage ; session fermée ; aucun mélange d’agences. | F |
| NAV-02 · P0 | Mode source public, profil avec compte et état de connexion | P/T+R | [Architecture navigateur](NAVIGATEUR-INTEGRE-AUTOMATISATION.md) | Reconnaissance réelle de connexion, expiration et déconnexion ; ne pas afficher « connecté » sur simple ouverture. | F |
| NAV-03 · P1 | Recherche par source, requête, localisation et limite de lot | L/T+R | [PR #52](https://github.com/LePubli/growthOS/pull/52), [PR #55](https://github.com/LePubli/growthOS/pull/55) | Valeurs persistantes, champs visibles sur panneau étroit et recherche réellement exécutée. | D/F |
| NAV-04 · P1 | Vue distante interactive : clic, molette, clavier, focus, plein écran | L/T+R | [PR #43](https://github.com/LePubli/growthOS/pull/43), [PR #55](https://github.com/LePubli/growthOS/pull/55) | Coordonnées fidèles, zoom et défilement, écran de consentement, reprise du contrôle. | F |
| NAV-05 · P1 | Colonnes navigateur/résultats immersives ~72/28 et séparateur ajustable | L/T+R | [PR #55](https://github.com/LePubli/growthOS/pull/55) | Hauteurs égales, redimensionnement au clavier, état vide, écran 1366 px et panneaux latéraux. | D |
| NAV-06 · P0 | Capture continue, pagination, reprise sans plafond total de 25 fiches | L/T+R | [PR #57](https://github.com/LePubli/growthOS/pull/57) | >25 fiches **distinctes** relues dans CRM, interruption volontaire et conservation du curseur. | F |
| NAV-07 · P0 | Cases de sélection et import volontaire vers Prospects | L/T+R | [PR #51](https://github.com/LePubli/growthOS/pull/51), [PR #53](https://github.com/LePubli/growthOS/pull/53) | Aucun import non sélectionné ; plusieurs lots ; dédoublonnage ; rejet explicite des fiches douteuses. | F |
| NAV-08 · P0 | Reçus d’import, « déjà présent », états persistants après rechargement | L/T+R | [PR #53](https://github.com/LePubli/growthOS/pull/53), [PR #54](https://github.com/LePubli/growthOS/pull/54) | Traité une seule fois, lien vers fiche CRM, erreurs et désaccords toujours visibles après refresh. | F |
| NAV-09 · P1 | Tâches récentes, pause, annulation, reprise, nettoyage de l’historique | L/T+R | [PR #51](https://github.com/LePubli/growthOS/pull/51), [PR #55](https://github.com/LePubli/growthOS/pull/55) | Annuler tâche active, préserver les imports ; supprimer uniquement résultats non importés ; recharger/reprendre. | F |
| NAV-10 · P0 | Enrichissement ciblé depuis le prospect sans recherche parallèle | L/T+R | [PR #57](https://github.com/LePubli/growthOS/pull/57), [PR #59](https://github.com/LePubli/growthOS/pull/59) | Un clic démarre **la bonne tâche pour le bon prospect**, avec progression/bilan et reprise. | F |
| NAV-11 · P0 | Comparaison identité/coordonnées, valeurs proposées et validation explicite | L/T+B historique | [PR #66](https://github.com/LePubli/growthOS/pull/66), [PR #67](https://github.com/LePubli/growthOS/pull/67), [PR #75](https://github.com/LePubli/growthOS/pull/75) | Homonyme, SIREN/SIRET contradictoires, champ déjà mis à jour, 409/423, capture absente et choix utilisateur sauvegardé. **Recette en ligne à refaire.** | F |
| NAV-12 · P0 | Retour automatique au même Prospect 360° après sauvegarde | L/T+B historique | [PR #77](https://github.com/LePubli/growthOS/pull/77), [PR #79](https://github.com/LePubli/growthOS/pull/79) | Reproduire Android après CI : validation entière, panne du bilan/activités/finish-review après sauvegarde, bon onglet Enrichissements. | F |
| NAV-13 · P0 | Vérification mobile avec source distante lisible et comparaison non tronquée | L/T+B historique | [PR #79](https://github.com/LePubli/growthOS/pull/79), [PR #80](https://github.com/LePubli/growthOS/pull/80) | Test Android réel à 360–390 px : zoom, déplacement, tous les champs, boutons « valider », sauvegarde puis retour ; correctif CI ≠ acceptation terrain. | F/D |
| NAV-14 · P0 | Sources bloquées, intervention Cloudflare/consentement, identité ambiguë | P/T+R | [PR #60](https://github.com/LePubli/growthOS/pull/60), [PR #74](https://github.com/LePubli/growthOS/pull/74) | Chaque source affiche pourquoi et comment reprendre ; pas de contournement de protections ni de confirmation sans preuve. | F |
| NAV-15 · P1 | Recherche unifiée /navigateur et archive de l’ancien sourcing | L/T+R | [PR #59](https://github.com/LePubli/growthOS/pull/59) | Anciens liens, recherches et résultats toujours consultables ; pas de retour forcé sur parcours obsolète. | F |
| NAV-16 · P1 | Un même lot multi-source produit un bilan honnête par source | L/T+R | [PR #59](https://github.com/LePubli/growthOS/pull/59), [PR #61](https://github.com/LePubli/growthOS/pull/61) | Voir terminé/partiel/contrôle requis/échec/aucun résultat et les champs vraiment appliqués. | F |

## 4. Extension Chrome, capture locale et synchronisation

| ID / priorité | Capacité de l’extension | État | Preuve | Recette / anomalie | Resp. |
|---|---|---|---|---|---|
| EXT-01 · P1 | Side Panel permanent, pleine hauteur, visible entre onglets, réduire/fermer | L/T+R | [PR #65](https://github.com/LePubli/growthOS/pull/65) | Chrome desktop réel, changer d’onglet puis revenir sans perdre sélection et formulaire. | E |
| EXT-02 · P1 | Parcours ATLAS × ORBIT Recherche → Collecte → Vérification → Import | L/T+R | [PR #64](https://github.com/LePubli/growthOS/pull/64) | Parcours complet depuis source choisie jusqu’à prospect relu ; états de chargement, absence de fiche, erreur. | E/D |
| EXT-03 · **P0** | **Autorisation hôte Google Maps lors de la capture** | **P/B** | **Capture propriétaire 28/11** ; [PR #67](https://github.com/LePubli/growthOS/pull/67) (permission optionnelle dans un autre parcours) | **Bug reproduit visuellement : « Cannot access contents of url… Extension manifest must request permission… ».** Le manifest déclare Google en hôte facultatif, mais les parcours de capture Maps ne garantissent pas sa demande avant injection. Demander l’accès depuis un geste utilisateur, gérer le refus et tester après changement d’onglet. **Aucune fiche importée tant que l’accès échoue.** | E |
| EXT-04 · P0 | Lecture séquentielle de chaque fiche Maps, pas les cinq premières en boucle | P/U limité | [PR #28](https://github.com/LePubli/growthOS/pull/28) | 30+ fiches distinctes réelles, scroll, détail automatique, stop/reprise sans double capture. | E |
| EXT-05 · P1 | Sélection locale puis import, suivi « fiches à compléter », « déjà importées » | P/T+R | [Suivi §§03,12](../SUIVI-FONCTIONNEL.md), [PR #64](https://github.com/LePubli/growthOS/pull/64) | Réimport, champs vides, doublons et changements d’identité sans données perdues ni import silencieux. | E/F |
| EXT-06 · P1 | Lecture Societe.com, PagesJaunes et sources professionnelles disponibles | P/T+R | [PR #30](https://github.com/LePubli/growthOS/pull/30), [PR #75](https://github.com/LePubli/growthOS/pull/75) | Vraies pages et formats actuels, identités, coordonnées multiples et contrôle de sécurité côté source. | E |
| EXT-07 · P0 | Liaison capture locale → tâche cloud ciblée → confirmation CRM | P/T+R | [PR #66](https://github.com/LePubli/growthOS/pull/66), [PR #75](https://github.com/LePubli/growthOS/pull/75) | Source/onglet/prospect conservés ; aucune réussite affichée avant persistance CRM ; panne locale distinguée d’une panne de source. | E/F |
| EXT-08 · P1 | Demandes de permissions facultatives minimales selon la source | P/T+R | [PR #67](https://github.com/LePubli/growthOS/pull/67) | Autorisation accordée/refusée/révoquée, source différente, nouvel onglet, side panel persistant ; ne pas élargir les hôtes obligatoires sans raison. | E |
| EXT-09 · P1 | Saisie assistée LinkedIn, Facebook, Instagram, TikTok | P/T+R | [Suivi §§06,08–10](../SUIVI-FONCTIONNEL.md) | Ni extraction derrière login sans droits ni fausse automatisation ; lien et provenance, homonyme et refus de publication. | E |
| EXT-10 · P1 | ZIP, installation locale et version effectivement chargée dans Chrome | L/T+R | [Guide connecteur](CONNECTEUR_APPAREIL.md), [PR #65](https://github.com/LePubli/growthOS/pull/65) | Télécharger le ZIP du workflow correspondant, recharger l’extension, confirmer version manifeste et reproduction sur Chrome propre. Ne pas confondre MAJ du Web avec MAJ manuelle de l’extension. | E/T |
| EXT-11 · P2 | Utiliser le réseau/IP du PC pour les lectures locales (secours et reprise automatisée en préparation) | P/T+R | [PR #66](https://github.com/LePubli/growthOS/pull/66), [guide navigateur](NAVIGATEUR-INTEGRE-AUTOMATISATION.md) | Vérifier que l’extension exécute bien localement, sans usurpation IP ; le navigateur cloud conserve l’IP du VPS. Aucun évitement de contrôle fournisseur garanti. | E |
| EXT-12 · P2 | Connexion, association et supervision de plusieurs comptes tiers | C/— | [Référence Linked Helper](REFERENCE-LINKED-HELPER.md) | Révocation, session expirée, profil par compte/agence, permission de chaque action ; **ne pas annoncer comme déjà fonctionnel**. | E/F |

| EXT-13 · P1 | Reprise automatique des tâches d’enrichissement dans Chrome utilisateur | P/T+R en cours | [Contrat local](COLLECTE-NAVIGATEUR-UTILISATEUR.md), branche feat/local-browser-enrichment (28/11) | Permissions avant lecture, file/reprise, contrôle sécurité humain, même tâche/prospect, reçu serveur, homonyme et arrêt ; recette Chrome réelle requise. F prend aussi l’extension sur demande explicite du propriétaire. | F |

## 5. Prospect 360°, identité, enrichissement et veille

| ID / priorité | Fonction et détail | État | Preuve | Recette et reste à faire | Resp. |
|---|---|---|---|---|---|
| PRO-01 · P1 | Liste Prospects → aperçu latéral → bouton ouverture de fiche 360° pleine page | L/U visuel limité | [PR #40](https://github.com/LePubli/growthOS/pull/40), [PR #44](https://github.com/LePubli/growthOS/pull/44) | Ouverture/retour, partage d’URL, navigation en petit écran ; ne pas revenir au plein écran forcé sans le bouton. | D |
| PRO-02 · P1 | Carte identité, raison sociale, nom affiché, SIREN/SIRET, APE et contact | L/T+R | [PR #44](https://github.com/LePubli/growthOS/pull/44), [PR #67](https://github.com/LePubli/growthOS/pull/67) | Nom commercial conservé en affichage ; nom légal distinct, SIREN absent clairement marqué ; identité vérifiée uniquement sur preuve. | F/D |
| PRO-03 · P1 | Complétude stricte sur neuf critères documentaires | L/T+R | [PR #48](https://github.com/LePubli/growthOS/pull/48) | Identifiants cohérents, contrôle officiel, APE/libellé, adresse, GPS, téléphone, email, site, dirigeant/role ; jamais 100 % si un critère manque. | D/F |
| PRO-04 · P1 | Fonds Soft Harmony harmonisés, information hiérarchisée et logos sources | L/U visuel limité | [PR #49](https://github.com/LePubli/growthOS/pull/49), [PR #50](https://github.com/LePubli/growthOS/pull/50) | Respecter la maquette approuvée ; logo seulement du domaine connu ; lisibilité, contraste et absence de répétition. | D |
| PRO-05 · P1 | Map de localisation sous l’adresse, zoom molette et accès CRM/Maps | L/T+R | [PR #48](https://github.com/LePubli/growthOS/pull/48) | Position exacte/approximative, échec GPS et géocodage, scroll page sans piège. | D/F |
| PRO-06 · P1 | Cartographie des relations sociétés/dirigeants, zoom, déplacement et mandats | P/T+R | [PR #40](https://github.com/LePubli/growthOS/pull/40), [handoff ATLAS](design/ATLAS-ORBIT-HANDOFF.md) | Relations vérifiables par source ; l’instantané documentaire **SOLUTION ENR** ne vaut pas API Pappers générique pour chaque société. | D/F |
| PRO-07 · P1 | Contacts nominatifs sourcés et coordonnées générales séparées | L/T+R | [PR #47](https://github.com/LePubli/growthOS/pull/47), [PR #75](https://github.com/LePubli/growthOS/pull/75) | Un téléphone générique n’est pas attribué automatiquement au dirigeant ; dédoublonnage, rôle et provenance ; annuaire Contacts cohérent. | F/D |
| PRO-08 · P1 | Édition de fiche, coordonnées multiples, source principale et conservation des alternatives | L/T+R | [PR #31](https://github.com/LePubli/growthOS/pull/31), [PR #75](https://github.com/LePubli/growthOS/pull/75) | Null, champ vide, concurrence, confirmation d’une nouvelle valeur et relecture après refresh. | F |
| PRO-09 · P1 | Onglet Enrichissements : matrice de sources, statuts, captures et modifications | L/T+R | [PR #61](https://github.com/LePubli/growthOS/pull/61), [PR #63](https://github.com/LePubli/growthOS/pull/63) | Données non dupliquées dans plusieurs blocs ; sources non disponibles explicites ; captures réellement consultables. | D/F |
| PRO-10 · P0 | Enrichissement automatique multisource depuis prospect | L/T+R | [PR #59](https://github.com/LePubli/growthOS/pull/59) | Statuts source par source, preuve des champs appliqués et des refus, double-clic sans double tâche. | F |
| PRO-11 · P0 | Concordance d’identité et conflits : homonymes, siège/établissement, même SIREN | L/T+R | [PR #59](https://github.com/LePubli/growthOS/pull/59), [PR #66](https://github.com/LePubli/growthOS/pull/66) | Ne jamais déclarer deux identifiants absents « égaux » ; pas de fusion sur simple nom/ville ; refus SIRET contradictoire. | F |
| PRO-12 · P0 | Comparaison et **fusion explicite de doublons CRM** avec archives et reçus | L/T+R | [PR #81](https://github.com/LePubli/growthOS/pull/81) | Tester cas réel **après** acceptation : choix du dossier conservé, transferts transactionnels, ancienne URL et annulation en cas d’erreur. Pas de fusion automatique des données réelles. | F |
| PRO-13 · P0 | Reprise des sources légales échouées après identification confirmée | L/T+R | [PR #81](https://github.com/LePubli/growthOS/pull/81) | Une reprise par identité, aucune boucle, aucun job annulé relancé, cause affichée. | F |
| PRO-14 · P1 | Veille légale : statut entreprise/établissement et historique officiel | L/T+R | [PR #31](https://github.com/LePubli/growthOS/pull/31), [PR #39](https://github.com/LePubli/growthOS/pull/39) | Établissement cessé avec société active, fermeture/réactivation, fréquence et cache, dernier statut connu en cas de panne. | F |
| PRO-15 · P1 | Notification lors de changement, avant/après, horodatage et source | L/T+R | [PR #39](https://github.com/LePubli/growthOS/pull/39), [Suivi §36](../SUIVI-FONCTIONNEL.md) | Deux contrôles sans changement ne doivent pas notifier deux fois ; relecture de l’activité et notification liée. | F |
| PRO-16 · P1 | Journal des activités et commentaires d’équipe sans faux événement | L/U limité | [Suivi §§13,14](../SUIVI-FONCTIONNEL.md), [PR #47](https://github.com/LePubli/growthOS/pull/47) | Note, appel, email, RDV ; aucun doublon entre mise à jour automatique et commentaire, historique lié au bon deal/prospect. | F/D |
| PRO-17 · P1 | Opportunité, deal, statut, potentiel et prochaine action | P/U limité | [Suivi §13](../SUIVI-FONCTIONNEL.md), [PR #44](https://github.com/LePubli/growthOS/pull/44) | Créer/relier un deal, changer l’étape, recharger, conserver la prochaine action et les droits utilisateur. | F |
| PRO-18 · P1 | Copilote IA compact à droite et recommandations contextuelles | P/U visuel limité | [PR #45](https://github.com/LePubli/growthOS/pull/45), [PR #44](https://github.com/LePubli/growthOS/pull/44) | Ne pas présenter une recommandation déterministe d’UX comme une analyse IA serveur autonome ; action réellement exécutable. | D/F |
| PRO-19 · P1 | Liens sociaux du site et profils personnels comme références sourcées | L/T+R (rapport 28/11 12:32 : 2 liens lus, affichage à recetter) | [PR #82](https://github.com/LePubli/growthOS/pull/82) | Profil Facebook /people/ et LinkedIn personnel visibles avec nature/provenance ; aucun dirigeant déduit sans preuve. Recapturer le site pour nouvelles découvertes. | F |
| PRO-20 · P0 | Cohérence des titres/valeurs sous panneau Chrome ouvert et mobile | **P/B historique** | [PR #69](https://github.com/LePubli/growthOS/pull/69), [PR #71](https://github.com/LePubli/growthOS/pull/71) | Les corrections responsive antérieures ont été **annulées à la demande du propriétaire** pour restaurer le design initial. Ne pas réintroduire une refonte ; toute correction future doit être validée visuellement. | D |

## 6. CRM, comptes, ventes et collaboration

| ID / priorité | Capacité | État | Preuve | Reste à éprouver | Resp. |
|---|---|---|---|---|---|
| CRM-01 · P0 | CRUD prospect, enregistrement, mise à jour et suppression | L/U limité | [Suivi §§13,33](../SUIVI-FONCTIONNEL.md), [PR #31](https://github.com/LePubli/growthOS/pull/31) | Tous champs nullables, relecture, suppression autorisée, contrainte de source/identité et deuxième utilisateur. | F |
| CRM-02 · P1 | Entreprises/comptes liés aux prospects | P/T+R | [Suivi §29](../SUIVI-FONCTIONNEL.md) | Établissement ≠ unité légale, contact/affaire partagés, permissions par rôle, doublons. | F |
| CRM-03 · P1 | Répertoire Contacts, personnes identifiées, rôles et canaux | L/T+R | [PR #75](https://github.com/LePubli/growthOS/pull/75) | Contact global vs contact d’un prospect ; coordonnées multiples sourcées ; recherche et édition. | F |
| CRM-04 · P1 | Pipeline Kanban, création et déplacement d’affaire | L/U limité | [Suivi §13](../SUIVI-FONCTIONNEL.md) | Déplacement sauvegardé après refresh, multi-pipelines, droits et mises à jour simultanées. | F |
| CRM-05 · P1 | Notes et commentaires liés au prospect ou à plusieurs affaires | L/T+R | [Suivi §14](../SUIVI-FONCTIONNEL.md) | Une note générale sur deux deals, une note exclusive au deal, édition sans recréer de doublon. | F |
| CRM-06 · P1 | Activités, appels, tâches, RDV, calendrier | P/T+R | [Suivi §23](../SUIVI-FONCTIONNEL.md) | Créer/modifier/terminer, relire calendrier ; transcription vocale **non livrée**. | F |
| CRM-07 · P1 | Import CSV, export et validation des doublons | P/T+R | [Suivi §15](../SUIVI-FONCTIONNEL.md) | Colonnes/accents/pagination, 1 000 fiches par lot demandé par le propriétaire, identifiants incohérents et réimport enrichissant. | F |
| CRM-08 · P0 | Dédoublonnage par SIRET normalisé et fusion des champs vides | L/T+R | [Suivi §12](../SUIVI-FONCTIONNEL.md), [PR #81](https://github.com/LePubli/growthOS/pull/81) | Deux imports simultanés, choix explicite pour données contradictoires et transfert sans perte de liens. | F |
| CRM-09 · P2 | Carte CRM des prospects et géolocalisation | P/T+R | [PR #48](https://github.com/LePubli/growthOS/pull/48) | Prospects sans GPS, adresses contradictoires, regroupement, liens vers fiche entière. | D/F |
| CRM-10 · P2 | Notifications collaboratives et responsabilités d’action | P/T+R | [Suivi §§23,29](../SUIVI-FONCTIONNEL.md) | Alerte au bon utilisateur, relecture, droits équipe et statut traité. | F |
| CRM-11 · P2 | Partage de documents, base de connaissances et travail multiutilisateur | P/R | [Suivi §29](../SUIVI-FONCTIONNEL.md) | Créer/partager/révoquer sur deux comptes ; aucune fuite entre agences. | F |

## 7. IA, audits, campagnes, analytics et modules avancés

| ID / priorité | Fonctionnalité | État | Preuve | Limite ou définition du « terminé » | Resp. |
|---|---|---|---|---|---|
| ADV-01 · P1 | Fournisseurs IA OpenAI, Claude/Anthropic, DeepSeek | P/T+R | [Suivi §19](../SUIVI-FONCTIONNEL.md), [remise en état](PREPROD-REMISE-EN-ETAT.md) | Vraies clés de test, mauvaise clé, quota, contexte du bon prospect et coûts ; les tests simulés ne prouvent pas l’appel réel. | F |
| ADV-02 · P1 | Assistant IA commercial, SDR et coaching | P/T+R | [Suivi §19](../SUIVI-FONCTIONNEL.md) | Réponse sourcée dans le CRM, disponibilité fournisseur, limites, aucun acte commercial implicite sans autorisation. | F |
| ADV-03 · P1 | Diagnostic de site/SEO : HTTPS, titre, H1, description, canonical, robots | P/T+R | [Suivi §18](../SUIVI-FONCTIONNEL.md), [audit initial](PREPROD-REMISE-EN-ETAT.md) | Comparaison au HTML d’un vrai site, DNS/SSRF, délai et code 403 ; pas de promesse de Lighthouse/classement. | F |
| ADV-04 · P2 | Audit approfondi de routes, sécurité et couverture | P/T+R | [AUDIT_STATUS](../AUDIT_STATUS.md), [CHANGELOG](../CHANGELOG.md) | L’inventaire de routes ne valide pas tous les POST/PUT/DELETE ni les fournisseurs ; produire rapport de couverture honnête. | F |
| ADV-05 · P2 | Signaux d’intention, ciblage ABM, score et veille marketing | P/T+R | [Suivi §25](../SUIVI-FONCTIONNEL.md) | Origine de chaque signal, horodatage, actualisation, compte, score calculable et absence d’événements fictifs. | F |
| ADV-06 · P1 | Séquences et modèles d’emails en brouillon | P/T+R | [Suivi §21](../SUIVI-FONCTIONNEL.md) | Enregistrement, prévisualisation, variables, liste des destinataires et droits. | F |
| ADV-07 · P0 avant activation | Envoi automatique SMTP, relances, désabonnement et arrêt sur réponse | **N/—** | [Remise en état](PREPROD-REMISE-EN-ETAT.md), [Suivi §21](../SUIVI-FONCTIONNEL.md) | Exécution commerciale volontairement désactivée ; consentement/opposition, quotas, double envoi, arrêt et boîte de test avant activation. | F |
| ADV-08 · P2 | Workflows, autopilot, webhooks et relances persistantes | P/T+R | [Suivi §22](../SUIVI-FONCTIONNEL.md) | Exécuter un événement une fois, reprendre après panne, retracer chaque action et vérifier permissions ; les brouillons ne sont pas un moteur opérationnel. | F |
| ADV-09 · P2 | Campagnes LinkedIn type Linked Helper : invitation → attente → message → réponse | **C/—** | [Référence Linked Helper](REFERENCE-LINKED-HELPER.md) | Enchaînement par contact, compte connecté, consentement, quotas, arrêt sur réponse. **Vision de référence, non implémentation GrowthOS.** | F/E |
| ADV-10 · P2 | Qualification ICP/IA, listes, exclusions et logique IF/THEN | C/— | [Référence Linked Helper](REFERENCE-LINKED-HELPER.md) | Listes persistantes, score explicable, conditions sur réponses et workflow testé. | F |
| ADV-11 · P2 | Messagerie/invitations LinkedIn, Sales Navigator, Recruiter | N/— | [Référence Linked Helper](REFERENCE-LINKED-HELPER.md) | Exiger capacités réelles du compte, autorisations et preuves avant tout envoi/collecte annoncé. | F/E |
| ADV-12 · P2 | Tableau de bord, analytics d’utilisation, rapports, revenus et objectifs | P/T+R | [Suivi §25](../SUIVI-FONCTIONNEL.md) | Même valeur dans transaction et KPI, dates, filtres d’équipe, états vides et pas de valeurs démo. | F |
| ADV-13 · P2 | E-réputation, campagnes, avis et portail client | P/T+R | [Suivi §24](../SUIVI-FONCTIONNEL.md) | Données réellement collectées et datées, deux clients isolés, accès partagé, validation d’une action concrète. | F |
| ADV-14 · P2 | Acquisition entrante, propositions, parrainage | P/R | [Suivi §26](../SUIVI-FONCTIONNEL.md) | Lead enregistré, proposition persistante, traçage d’un parrainage de bout en bout. | F |
| ADV-15 · P2 | Marketplace, plugins et intégrations CRM externes | P/T+R | [Suivi §27](../SUIVI-FONCTIONNEL.md) | Activation/révocation, échange réel et séparation agences ; la présence d’un écran/plugin ne prouve pas le fonctionnement. | F |
| ADV-16 · P2 | Abonnement SaaS, facturation, quotas et administration | P/T+R | [Suivi §28](../SUIVI-FONCTIONNEL.md), [CHANGELOG](../CHANGELOG.md) | Paiement avec fournisseur de test, facture, suspension, quota et rôles ; aucune facturation réelle sans validation. | F |
| ADV-17 · P2 | SSO, conformité et export/suppression de données | P/T+R | [Suivi §30](../SUIVI-FONCTIONNEL.md) | Tests d’accès, révocation, conservation, export et suppression sur compte de recette. | F |

## 8. Centre de diagnostic et traitement des causes

| ID / priorité | Couverture | État | Preuve | Scénario de recette obligatoire | Resp. |
|---|---|---|---|---|---|
| DIA-01 · P0 | Interface administrateur /admin/diagnostics, filtres, évènements et export | L/T+R | [PR #72](https://github.com/LePubli/growthOS/pull/72) | Erreur API connue puis filtre par composant/prospect/tâche/date ; exporter et réouvrir le JSON. | F |
| DIA-02 · P0 | Codes d’erreurs 4xx/5xx, latence >3 s, identifiant trace, exception | L/T+R | [Contrat diagnostic](DIAGNOSTICS-CONTRACT.md) | 409 métier ≠ 502 worker ; 500 reproductible, durée, trace cohérente avec logs Docker. | F |
| DIA-03 · P0 | Erreurs source : 403, Cloudflare, 429, timeout, DNS, page illisible, quota | L/T+R | [PR #72](https://github.com/LePubli/growthOS/pull/72), [PR #73](https://github.com/LePubli/growthOS/pull/73) | Afficher **fait observé**, **cause probable** et **action corrective**, sans certitude inventée ni contournement. | F |
| DIA-04 · P0 | États historiques d’enrichissements et tâches sans événement récent | L/T+R | [PR #73](https://github.com/LePubli/growthOS/pull/73) | Bilan sur ancienne tâche « awaiting_user » ou « needs_review » sans colonne error ; texte d’origine accessible. | F |
| DIA-05 · P0 | Erreur « capture absente » et 409 métier | L/T+R | [PR #74](https://github.com/LePubli/growthOS/pull/74) | L’UI conduit à la **lecture** de la source avant comparaison ; ne pas diagnostiquer « panne Chromium ». | F |
| DIA-06 · P0 | Conflit SIRET, sauvegarde locale, fusion, codes SQLSTATE expurgés | L/T+R | [PR #75](https://github.com/LePubli/growthOS/pull/75), [PR #81](https://github.com/LePubli/growthOS/pull/81) | Conflit de deux prospects, export de diagnostic, aucun SQL/donnée privée, autre erreur serveur distinguée. | F |
| DIA-07 · P1 | Worker hors ligne, navigateur occupé, session fermée, panne de lecture | L/T+R | [PR #81](https://github.com/LePubli/growthOS/pull/81) | Tâche conservée, message utile, trace et reprise ; absence de succès fictif. | F |
| DIA-08 · P1 | Logs Docker API/worker avec trace et rétention DB 90 jours | L/T+R | [Contrat diagnostic](DIAGNOSTICS-CONTRACT.md) | Log lisible sans PII ; moteur indisponible avant DB traité via DockPanel ; nettoyage en tâche de fond. | F |
| DIA-09 · **P0 transversal** | Instrumentation obligatoire de tout nouveau développement | **C (règle)** | [Contrat diagnostic](DIAGNOSTICS-CONTRACT.md) | Chaque PR nouvelle ajoute codes, transitions, tests d’échec et documentation du diagnostic ; revue de couverture obligatoire. | T |

## 9. Incidents ouverts, anciens bugs et critères de clôture

Le statut **ouvert** signifie ici « non encore accepté en usage après correctif », même si la PR correspondante est fusionnée. Un nouvel essai utilisateur peut prouver la clôture ; ne pas effacer la reproduction.

| Incident | Priorité | Constats datés / correction en code | Test réel de clôture | Owner |
|---|---|---|---|---|
| INC-001 · Permissions Maps Chrome | **P0** | **28/11 :** Side Panel sur Google Maps « Cannot access contents of url… Extension manifest must request permission to access this host » ; zéro fiche collectée. Malgré un hôte Google facultatif dans le manifest, le geste Capture doit demander/contrôler l’autorisation avant injection. | Nouvelle installation sur Chrome, permission absente/acquise/refusée, captures de plusieurs fiches puis import en CRM, changement d’onglet entre deux lectures. | E |
| INC-002 · Societe.com mobile illisible | **P0** | Captures Android du **28/11** : source distante affichée comme mini page desktop, comparaison tronquée, action de validation invisible. Correctifs [PR #79](https://github.com/LePubli/growthOS/pull/79) et [PR #80](https://github.com/LePubli/growthOS/pull/80) testés par Chromium mais acceptation mobile personnelle non enregistrée. | Téléphone réel, page longue, zoom/pan jusqu’au SIRET et à l’adresse, comparaison entièrement déroulante et validation accessible. | F/D |
| INC-003 · Validation sans retour au prospect | **P0** | Après PR77, le propriétaire a encore signalé l’absence de retour. PR79 dissocie sauvegarde CRM et relectures secondaires. | Même prospect et onglet Enrichissements après confirmation sauvegardée, y compris panne activités/bilan/finish-review ; aucune réussite sans persistance. | F |
| INC-004 · Mauvais rapprochement Plombeo / personne physique | **P0** | Cas CRM « Plombeo » versus un nom légal de personne physique différent ; confirmation interdite sans preuve du lien et de l’établissement. [PR #77](https://github.com/LePubli/growthOS/pull/77), [PR #81](https://github.com/LePubli/growthOS/pull/81). | Exiger cohérence enseigne officielle, téléphone du site et rôle démontré ; homonyme refusé ; ne pas écraser un identifiant différent. | F |
| INC-005 · Doublons CRM et étape légale en erreur | **P0** | Rapport 28/11 : SIRET officiel déjà utilisé, enrichissement échoue ; correction transactionnelle et reprise dans [PR #81](https://github.com/LePubli/growthOS/pull/81). | Deux dossiers de test puis comparaison/fusion explicite, historique et anciens liens, aucune perte, tâche reprise une fois. Sur base réelle : accord de fusion séparé. | F |
| INC-006 · Sources « en erreur » sans cause lisible | **P1** | Rapports 27/11 ; [PR #72](https://github.com/LePubli/growthOS/pull/72), [PR #73](https://github.com/LePubli/growthOS/pull/73), [PR #74](https://github.com/LePubli/growthOS/pull/74). | Un contrôle Cloudflare, un 429, une source vide et une identité inconnue montrent des actions distinctes dans le centre. | F |
| INC-007 · Google/Bing sans résultat malgré page présente | **P1** | Lecteurs/attente améliorés [PR #60](https://github.com/LePubli/growthOS/pull/60), [PR #74](https://github.com/LePubli/growthOS/pull/74) ; [PR #82](https://github.com/LePubli/growthOS/pull/82) signale encore ces sources comme illisibles sur le cas vérifié. | Réponses et états réellement observés en ligne, consentement/erreur affichés, aucune fausse donnée. | F |
| INC-008 · Contrôle sécurité PagesJaunes | **P1** | Cloudflare observé ; le navigateur doit proposer intervention/reprise sans garantir l’accès. | Utiliser le contrôle autorisé, reprendre à la bonne fiche ; source indisponible documentée si elle refuse. | F |
| INC-009 · Pappers non confirmé / établissement ambigu | **P1** | [PR #61](https://github.com/LePubli/growthOS/pull/61) lit la fiche publique ; PR82 note un cas non confirmé. | Comparer SIREN/SIRET exacts et distinguer siège/établissement ; si doute, aucune modification CRM. | F |
| INC-010 · Éléments 360° se chevauchent avec Side Panel | **P1 visuel** | Corrections PR69/70 **révoquées** volontairement par [PR #71](https://github.com/LePubli/growthOS/pull/71) ; propriétaire préfère le design restauré. | Avant tout nouveau CSS : maquette/validation du propriétaire ; conserver strictement apparence approuvée et faire une correction locale démontrée. | D |
| INC-011 · Suivi et documentation désynchronisés | **P1 transverse** | Au 28/11 : en-tête de SUIVI-FONCTIONNEL encore sur PR57, CHANGELOG daté de juin, alors que PR82 est fusionnée. | Mettre à jour ce registre à chaque PR ; réconcilier l’en-tête de SUIVI uniquement via une petite PR de coordination approuvée. | T |

## 10. Recette propriétaire : scénarios à exécuter dans l’ordre

**Ne pas confondre « code prêt » et « déployé »** : suivre [déploiement continu](DEPLOIEMENT-CONTINU-DOCKPANEL.md), attendre quatre manifests du même SHA, préserver la base et laisser le redéploiement au propriétaire.

### Gate A — Préproduction de base (P0)

- [ ] **A1 · Version** — confirmer le SHA effectivement en ligne (Web/API/worker/extension séparés) et la santé des quatre services. Une image GHCR publiée ne prouve pas son utilisation dans DockPanel.
- [ ] **A2 · Connexion** — connexion/reconnexion, compte autorisé/interdit et isolation entre deux agences de test.
- [ ] **A3 · Création CRM** — créer un prospect incomplet, l’éditer, enregistrer, recharger et confirmer qu’aucune donnée n’a disparu.
- [ ] **A4 · Google Maps** — capturer 30 fiches distinctes en cloud ; import volontaire de 10, reprise et import du reste ; aucun doublon.
- [ ] **A5 · PagesJaunes** — saisir activité/zone, naviguer tous les résultats disponibles, lire la fiche, traiter intervention source et relire données importées.
- [ ] **A6 · Enrichissement** — depuis le Prospect 360°, lancer une tâche multisource, lire les états par source, appliquer les valeurs sûres et relire après refresh.
- [ ] **A7 · Identité** — essayer homonyme, même SIREN/autre SIRET, SIRET déjà utilisé et absence d’identifiant ; vérifier que le logiciel n’invente jamais l’identité.
- [ ] **A8 · Fusion** — sur données de recette, sélectionner la fiche conservée, valider les remplacements, relire contacts/deals/historique/anciennes URL ; simuler échec transaction.
- [ ] **A9 · Source Societe.com mobile** — voir toutes les données, comparer et confirmer, attendre la sauvegarde, retour au **même** Prospect 360° même si la relecture d’activité échoue.
- [ ] **A10 · Extension Chrome** — installer ZIP de la bonne version, démarrer sur Maps sans permission préalable, accorder/refuser, capturer, changer d’onglet, importer, relire la fiche.
- [ ] **A11 · Diagnostic** — exporter un JSON après capture refusée, 409 identité, source sécurisée et erreur API ; confirmer messages compréhensibles, pas de PII/secrets.

### Gate B — Fonctionnel renforcé (P1)

- [ ] **B1 · Veille** — entreprise active/établissement fermé, changement réel simulé, notification unique et dernier contrôle connu après panne.
- [ ] **B2 · Contacts** — dirigeant, commercial et coordonnées générales ; vérifier rôle/provenance ; changer le numéro principal et conserver les autres.
- [ ] **B3 · CRM** — deal/pipeline, note, activité et calendrier ; enregistrer, recharger, vérifier second utilisateur.
- [ ] **B4 · CSV** — import de 1 000 lignes de test, accents/colonnes/APE/doublons ; export puis comparaison des données.
- [ ] **B5 · Sources** — vrai résultat Bing/Google Search, Pappers exact, BODACC paginé, accès INSEE direct avec et sans clé ; statut honnête si refus.
- [ ] **B6 · UX** — menus/sidebar/Side Panel ouverts, 1366 px, petits écrans et smartphone réel ; préserver le visuel explicitement approuvé.
- [ ] **B7 · Restauration** — sauvegarde PostgreSQL, restauration sur instance isolée, tâches/veilles et fiches intactes.

### Gate C — Fonctions avancées (P2 / P3)

- [ ] **C1** — comptes externes et collecteurs LinkedIn/social réellement compatibles, sans prétention de connexion universelle.
- [ ] **C2** — campagne Linked Helper-like à construire, avec conditions de réponse, exclusions, quotas et aucune séquence de test envoyée à de vrais destinataires.
- [ ] **C3** — clés IA réelles en bac de test, réponse contextualisée et contrôle de quota.
- [ ] **C4** — emails automatiques, workflows, facturation et portail client uniquement après consentement et validation séparés.
- [ ] **C5** — Windows/Android installables après validation du socle Web.

## 11. Fiche de mise à jour à copier dans une PR

| Champ | Renseignement obligatoire |
|---|---|
| ID et nom | Exemple : EXT-03 · Autorisation Google Maps |
| Décision de périmètre | Fonctionnalité, correction, régression ou report ; owner et fichiers partagés |
| Implémentation | L / P / C / N, date et commit/PR |
| Vérifications automatiques | Commande, nombre/nom de scénarios, fixtures/simulation ou fournisseur réellement joint |
| Recette réelle | U / R / B / — ; navigateur/appareil, version déployée, date, résultat observé |
| Identité/données | Politique source, identifiant vérifié, erreurs, valeurs conservées et provenance |
| Diagnostic | Code, composant/source, trace expurgée et action proposée |
| Déploiement | SHA des quatre images, workflow vert, extension ZIP si modifiée, DockPanel fait par propriétaire |
| Résultat / suite | Validé **pour le cas testé** ou bloqué avec prochaine étape et personne responsable |

### Surfaces et tests à ne pas oublier

- **API/DB** : [smoke-wizard](../scripts/smoke-wizard.mjs), tests PostgreSQL 16, contrats d’identité et transactions, routes métier.
- **Extensions et sources** : [test-multisource-extension](../scripts/test-multisource-extension.mjs), [test-collection-tools](../scripts/test-collection-tools.mjs) et pages réelles de test.
- **Navigateur et UI** : [test-cloud-browser](../scripts/test-cloud-browser.mjs), [review-ui-test](../workers/cloud-browser/review-ui-test.mjs), [test-cloud-import-feedback](../scripts/test-cloud-import-feedback.mjs), [test-prospect-enrichments](../scripts/test-prospect-enrichments.mjs), vérification **Chrome/Android réelle**.
- **Design** : [test-prospect-harmony](../scripts/test-prospect-harmony.mjs), [test-prospect-people](../scripts/test-prospect-people.mjs), [test-prospect-completeness](../scripts/test-prospect-completeness.mjs) et [test-prospect-logos](../scripts/test-prospect-logos.mjs).
- **Observabilité** : [test-diagnostics](../scripts/test-diagnostics.mjs) et [contrat diagnostic](DIAGNOSTICS-CONTRACT.md).
- Les chemins listés sont des **points d’entrée existants du dépôt** ; exécuter les commandes prévues par le package/workflow actif. La présence d’un script n’est pas une preuve de son succès sur un nouveau SHA.

## 12. Attribution des trois agents et règle d’arbitrage

| Périmètre | Responsable | Interventions autorisées | Validation croisée |
|---|---|---|---|
| Charte ATLAS × ORBIT, Prospect 360°, CSS et maquettes | **D (agent design)** | Rendu, ergonomie, responsive après accord visuel. Pas de nouveau comportement métier implicite. | F valide que les contrats de données/callbacks survivent. |
| Serveur API, Postgres, moteur Web cloud, veille, IA, CRM | **F (agent fonctionnel)** | Métier, migration, transactions, services, tests ; modifications de design uniquement limitées au parcours requis. | D vérifie les écarts visuels ; E vérifie le contrat du connecteur local. |
| Extension Chrome, Side Panel, permissions et capture locale | **F pour le pilote local 0.12.0 ; E proposé pour la suite** | Sous-répertoire extensions/growthos-pagesjaunes et tests de capture/ZIP, uniquement après acceptation de son périmètre. | F valide API/import/identité ; D valide l’apparence de l’extension. |
| Diagnostics transversaux, CI, recette et déploiement | **T partagé** | Chaque agent instrumente son lot et fournit preuves ; **DockPanel réservé au propriétaire**. | Agent auteur contrôle CI, propriétaire accepte la recette réelle. |

**Important :** E n’est pas présumé opérationnel ni autorisé à intervenir sur les fichiers de F/D par la simple présence de ce tableau. Chaque agent doit consulter les PR ouvertes et [COORDINATION-AGENTS.md](../COORDINATION-AGENTS.md) avant de commencer. **PR #62 reste un brouillon de catalogue**, à intégrer seulement après la recette prévue. **PR #27 reste ouverte** comme branche de travail de préproduction ; ne pas confondre une PR interne fusionnée avec la mise en production sur main.

---

**Dernier contrôle documentaire : 28/11/2026, après PR #82.** Source de vérité pour le code : commit/PR ; source de vérité pour le fonctionnement réel : recette horodatée sur version effectivement déployée. Ce registre conserve les décisions mais doit être **mis à jour continuellement** ; aucune complétude globale ni autorisation de lancement en production n’est déclarée ici.
