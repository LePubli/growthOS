# GrowthOS — recherche, collecte et enrichissement intégrés

Demande précisée par le propriétaire le 26 novembre 2026, après validation du lot correctif : l'automatisation dans GrowthOS est le parcours principal. L'extension Chrome sert de secours externe. La saisie manuelle de coordonnées et les allers-retours vers l'extension ne constituent pas le parcours cible.

**Priorité confirmée : version Web cloud uniquement pour ce lot. Windows et Android sont différés à la demande du propriétaire.** Le premier moteur est implémenté dans la PR 43 : navigateur Chromium sur le VPS, profils persistants privés, vue interactive authentifiée, file PostgreSQL et collecte intégrée. Publication CI et recette sur les sites réels restent nécessaires avant validation en usage. L'extension externe reste un secours.

## Premier lot Web cloud

Entrée **Navigateur cloud** (`/navigateur`), également accessible depuis **Collecte et enrichissement**. Les recherches publiques créent leur profil au lancement. Les profils personnels peuvent ouvrir une connexion fournisseur dans la vue GrowthOS ; leur authentification reste affichée « non vérifiée » tant qu'elle n'a pas été constatée sur le site. Le logiciel ne promet pas qu'un fournisseur acceptera une connexion depuis le VPS.

| Source | Capacité de ce lot | Recette restante |
|---|---|---|
| Google Maps | Recherche, défilement du lot et lecture de fiches, maximum 25 par tâche | Vrai lot, consentement, résultats incomplets et reprise |
| Google Search et Bing | Recherche et lecture des cartes locales prises en charge par les lecteurs existants | Résultats actuels, absence de carte et homonymes |
| Societe.com | Recherche ciblée du prospect, ouverture de la fiche unique puis enrichissement tracé | Même SIRET réel, corrections d'adresse et données absentes |
| PagesJaunes | Navigation dans le nouveau moteur ; collecteur historique conservé | Adaptateur automatique du moteur commun à développer |
| LinkedIn, Facebook, Instagram et TikTok | Navigation publique ou connexion dans un profil dédié | Collecteurs automatiques spécifiques à développer et tester |

Un établissement Societe.com au **SIRET strictement identique** peut mettre à jour automatiquement le nom et les données légales/adresse autorisées, avec activité avant/après. Les coordonnées contradictoires restent en arbitrage. Une identité incertaine met la tâche en revue. Les recherches de nouveaux prospects produisent une sélection avant import. Annulation et écriture CRM sont coordonnées transactionnellement ; une reprise ne rejoue pas une activité déjà enregistrée.

Une seule session active et une seule opération navigateur à la fois pour ce pilote. Fermeture à cinq minutes d'inactivité ; profils conservés dans un volume privé. Les cookies de session sauvegardés pour reprise sont chiffrés ; l'ensemble du profil Chromium ne constitue pas un volume chiffré. Aucune saisie de connexion ni vue navigateur n'est enregistrée dans la file CRM.

Installation et recette : [NAVIGATEUR-CLOUD-INSTALLATION.md](NAVIGATEUR-CLOUD-INSTALLATION.md). Tests : suite API sur PostgreSQL 16 avec fournisseur simulé, protocole réseau et rendu React ; workflow dédié exécutant Chromium réel sur des pages de recette locales. Ces tests ne remplacent pas la recette des fournisseurs et comptes réels.

## Parcours attendu

1. Choisir un connecteur : LinkedIn, Google/Maps, Facebook, Instagram, Bing, Societe.com, PagesJaunes ou une source officielle.
2. Relier son compte si la source et l'action le nécessitent. Présenter la page de connexion du fournisseur et conserver ensuite une session propre à ce compte. Une source publique doit rester accessible en mode sans compte lorsque le site le permet.
3. Depuis GrowthOS, saisir une activité/zone pour une nouvelle recherche, ou choisir « Enrichir » sur un prospect existant. Le nom, le dirigeant, le SIREN/SIRET et l'adresse peuvent alimenter les recherches pertinentes selon la source.
4. Le moteur ouvre les recherches, parcourt les résultats et fiches détaillées, extrait les données, normalise, dédoublonne et rapproche les identités. L'utilisateur suit la progression dans GrowthOS ; il ne recopie pas les fiches.
5. Les résultats d'une recherche restent sélectionnables avant création, conformément au parcours existant. Un éventuel import sans sélection nécessite un réglage explicite du lot. L'enrichissement ciblé rejoint directement la bonne fiche.
6. Appliquer automatiquement les valeurs autorisées par la politique de confiance et l'identité vérifiée. Les ambiguïtés, identités contradictoires et désaccords non tranchables passent en revue, au lieu de bloquer tous les autres résultats.
7. Historiser source, date, anciennes/nouvelles valeurs, décision et tâche. Un nouvel essai ne doit pas créer de doublon ni rejouer une mise à jour.
8. En cas de difficulté, proposer d'abord d'afficher/reprendre le navigateur intégré. L'extension externe est un recours explicite, rattaché à la même tâche et au même prospect.

## Trois capacités à distinguer

| Capacité | Usage | Ce qu'elle ne garantit pas à elle seule |
|---|---|---|
| Compte autorisé par API/OAuth | Fonctionnalités effectivement accordées par le fournisseur | Une session de navigation connectée ni l'accès à toutes ses recherches |
| Session dans un navigateur dédié | Consulter les pages accessibles à ce compte et exécuter les collecteurs pris en charge | Toutes les actions de tous les réseaux ni une session permanente sans reconnexion |
| Navigation publique sans compte | Recherches et données librement accessibles | L'accès aux résultats derrière une connexion obligatoire |

Une source n'est déclarée « automatique » que pour une action testée. Connexion, recherche, extraction, enrichissement, invitations et messagerie sont des capacités distinctes. Les campagnes d'envoi ne sont pas incluses dans le premier lot navigateur.

## Inventaire initial avant le lot cloud (conservé pour suivi)

| Élément | Disponible | À construire pour ce parcours |
|---|---|---|
| Annuaire officiel | Recherche et contrôle par identité, veille avec mise à jour et activités | Réutilisation dans l'orchestration automatique |
| Navigateur PagesJaunes | `workers/pagesjaunes-browser/server.mjs` : Chromium serveur, recherche et HTML | Vue interactive, comptes, sessions persistantes, reprise et lecture détaillée |
| Profil navigateur | Nouveau contexte créé puis fermé à chaque extraction PagesJaunes | Profil isolé, compte nommé, connexion vérifiée, reconnexion/déconnexion |
| Extension | Lecteurs Maps/Google/Bing/Societe.com et enrichissement lié au prospect | Adaptateurs réutilisables dans le navigateur intégré ; extension gardée pour dépannage |
| LinkedIn et réseaux sociaux | Pages entreprise en saisie assistée | Collecteurs automatiques source par source, avec recette authentifiée et publique |
| Catalogue | Deux modes, sources décrites selon leurs capacités actuelles | Lancer une tâche intégrée par défaut, présenter compte/mode public et état réel |
| Traçabilité | Provenance, conflits, activités `data_update`, transaction et protection de l'historique | Conserver le contrat dans tous les nouveaux exécutants |
| Déploiement préproduction | Web/API/PostgreSQL ; image Chromium dédiée existante | Service navigateur connecté et stockage associé à ajouter explicitement, sans redéploiement par l'agent |

## Trois clients, un moteur central

| Client | Interface attendue | Exécution et données |
|---|---|---|
| Web | GrowthOS existant, recherche et navigateur intégré | API, comptes autorisés, tâches et CRM sur le VPS |
| PC Windows | Application installable, même espace de travail et navigateur intégré | Même API et même file serveur ; un exécuteur local peut être ajouté ensuite pour les sources qui le nécessitent |
| Android | Application installable, lancer/suivre les lots, consulter et enrichir les fiches, intervenir sur une session | Même API et même file serveur ; pas de dépendance à une extension Chrome Android |

L'exécution principale sur le VPS doit continuer lorsque le PC ou l'application Android est fermé. Les sessions du navigateur serveur appartiennent à l'agence et au compte autorisé, pas à un appareil donné. L'accès depuis un nouvel appareil ne doit pas copier des cookies dans le client. Un seul opérateur contrôle une session interactive à la fois ; l'observation et le contrôle doivent être distingués.

**État mobile vérifié** : `artifacts/growthos-mobile` contient une base Expo/React Native, une connexion et des écrans CRM. Ce n'est pas une application Android recettée pour le parcours demandé : URL d'API configurable, renouvellement de session, stockage approprié des jetons, retrait du mode démo du parcours réel, fonctionnalités navigateur et compilation d'un APK signé restent à vérifier/compléter. Le script `scripts/build.js` existant ne constitue pas une preuve de production d'un APK. Aucun projet PC Electron/Tauri identifié dans l'inventaire consulté.

Pour les livraisons, prévoir un installateur Windows et un APK Android testables, construits avec les outils du projet sans abonnement à un moteur d'enrichissement tiers. Les clés de signature et identifiants restent hors du dépôt. Le pilote Web du moteur commun précède les deux distributions installables, sans créer trois versions du métier.

Ne pas utiliser une simple iframe des sites comme navigateur universel. Les sites peuvent refuser leur intégration. Les parcours d'autorisation OAuth doivent respecter les mécanismes du fournisseur ; Google interdit notamment un user-agent intégré contrôlé par l'application pour ses autorisations OAuth. Une redirection de connexion peut donc rester nécessaire sans rendre les recherches elles-mêmes manuelles.

## Socle commun à prévoir

- **Comptes** : agence, propriétaire, fournisseur, libellé, identité vérifiée du compte, capacités, état et dernière vérification. Prévoir plusieurs comptes sans mélange de sessions.
- **Sessions** : profils dédiés, stockage protégé, aucun cookie/mot de passe/jeton dans Git ou les journaux ; séparation entre agences et comptes ; déconnexion effective et révocation des vues ouvertes.
- **Navigation intégrée** : afficher la source et l'URL réelle, permettre connexion/reconnexion et reprise ; ne jamais exposer directement le port de pilotage du navigateur sur Internet.
- **File PostgreSQL** : source, compte ou mode public, critères, prospect cible éventuel, état, progression, résultats, erreurs, échéance et verrou d'exécution. Reprise après arrêt, annulation et traitement unique des résultats.
- **États visibles** : prêt, en file, recherche, lecture des fiches, enrichissement, revue nécessaire, connexion requise, vérification humaine, pause, terminé, échec et annulé. Une vérification humaine demandée par un site suspend le lot concerné ; la reprise est explicite.
- **Adaptateurs** : URL de recherche, reconnaissance des pages, pagination, lecture des fiches, champs et preuves spécifiques à chaque source. Réutiliser les lecteurs existants après extraction de leurs dépendances Chrome.
- **Identité et mises à jour** : même SIRET pour l'établissement ; ne pas prendre le siège pour un établissement absent ; pas de ville déduite d'une catégorie. Priorité des sources officielles pour l'identité et l'activité. Conserver les données absentes et les désaccords incertains ; enregistrer toute modification effective.
- **Réseau et ressources** : domaines et actions autorisés par adaptateur, blocage des adresses internes, redirections et téléchargements contrôlés, concurrence initialement limitée, fermeture à l'inactivité et mesure de la consommation réelle.
- **Secours extension** : même identifiant de tâche et même cible ; une capture de secours ne crée pas un lot parallèle ni un autre prospect.

## Lots et critères de validation

- [x] Demande du propriétaire consignée : Web + application PC + application Android.
- [ ] Moteur VPS commun, file persistante et contrat API des trois clients implémentés et testés.
- [ ] Premier navigateur intégré : ouvrir une source, effectuer une navigation, fermer/réouvrir, conserver correctement la session, puis se déconnecter. Tester séparation des agences et comptes.
- [ ] Première recherche publique automatique complète : critères → résultats → fiches détaillées → sélection → prospects, sans extension ni recopie.
- [ ] Premier enrichissement ciblé automatique : rechercher l'identité, lire une fiche, mettre à jour les champs autorisés et relire l'activité dans le CRM. Tester reprise et répétition.
- [ ] Première source connectée : connexion du propriétaire, recherche et extraction réelles, session expirée, intervention requise et reprise. Ne déclarer la capacité disponible qu'après recette.
- [ ] Étendre et vérifier Maps/Google, PagesJaunes, Societe.com, Bing, LinkedIn, puis chaque réseau, selon les accès réellement disponibles.
- [ ] Conserver une recherche utilisable sans compte lorsqu'elle existe et un secours externe explicite en cas de difficulté.
- [ ] Application PC : installation, connexion, recherche, résultat partagé avec le Web et reprise après fermeture.
- [ ] Android : APK installé sur appareil réel, authentification, lancement/suivi des recherches, navigateur interactif tactile, reprise et consultation des résultats du même CRM.
- [ ] Recette croisée : lancer depuis Android, suivre depuis le Web, consulter depuis le PC ; une seule tâche, aucun mélange de comptes ni doublon de prospect.

## Références techniques consultées

- [Playwright — profils persistants](https://playwright.dev/docs/api/class-browsertype#browser-type-launch-persistent-context) : stockage de session dans un répertoire dédié ; ne pas réutiliser le profil Chrome personnel par défaut.
- [noVNC — intégration](https://novnc.com/noVNC/docs/EMBEDDING.html) : option d'affichage distant d'un navigateur serveur, sans service commercial d'exécution.
- [Expo — APK Android](https://docs.expo.dev/build-reference/apk/) : format installable pour la recette ; la chaîne de compilation du projet reste à configurer.
- [Android — navigation dans une application](https://developer.android.com/develop/ui/views/layout/webapps) : navigation et authentification à distinguer.
- [Electron — WebContentsView](https://www.electronjs.org/docs/latest/api/web-contents-view) : option de vue navigateur pour l'application Windows.
- [MDN — X-Frame-Options](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Frame-Options) : restrictions d'intégration en iframe.
- [Google — autorisation OAuth et navigateurs](https://developers.google.com/identity/protocols/oauth2/policies#use_secure_browsers) : le mode de connexion doit être choisi séparément de la navigation et de la collecte.

Aucun déploiement DockPanel n'est effectué par l'agent. La livraison suit le protocole commun de notification et préserve le thème ainsi que les composants de l'agent design. Les cases de recette fournisseur restent ouvertes jusqu'au test réel.
