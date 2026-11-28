# Navigateur Web cloud — installation et recette

Lot PR 43, 26 novembre 2026. Windows et Android différés. Aucun abonnement à un moteur tiers : Chromium et les lecteurs tournent dans la stack GrowthOS. Les accès et limites propres aux sources continuent de s'appliquer.

## Dans DockPanel, après le feu vert des quatre images

1. Utiliser la version actualisée de `docker-compose.preprod.yml` en conservant le nom de stack, le volume PostgreSQL, les secrets existants, le domaine et les réglages locaux. Reporter le nouveau service `cloud-browser`, le volume `growthos-browser-profiles` et les deux variables API `CLOUD_BROWSER_URL` / `CLOUD_BROWSER_TOKEN`. Le port 3200 reste interne, sans publication Internet.
2. Ajouter **un nouveau secret indépendant** `CLOUD_BROWSER_TOKEN`, par exemple généré sur le serveur avec `openssl rand -hex 32`. Même valeur dans l'API et le worker. Ne pas remplacer JWT_SECRET, ENCRYPTION_KEY ou les autres secrets. La rotation de ce jeton peut imposer de reconnecter les sessions navigateur.
3. Enregistrer et redéployer avec récupération des images (`pull_policy: always`) ; un simple Restart ne met pas à jour les images. Attendre API et navigateur sains. Le navigateur est limité à 1,5 Gio, un cœur et une session active ; vérifier la capacité disponible du VPS avant d'augmenter la concurrence.

L'API crée les deux nouvelles tables au démarrage. Les profils survivent à la recréation du conteneur grâce au volume dédié ; ne pas supprimer ce volume pour une mise à jour courante. Ne jamais exposer ni partager son contenu. Les profils personnels ne sont consultables que par leur propriétaire GrowthOS. Les cookies de reprise de session sont chiffrés ; les autres fichiers du profil Chromium reposent sur les permissions du volume privé.

## Vérifications dans GrowthOS

1. Ouvrir **Navigateur cloud** dans le menu. L'état doit indiquer le service disponible. Depuis **Collecte et enrichissement**, choisir Google Maps et lancer une recherche « chauffagiste », zone « Roubaix », limite 5, sans extension. Un profil public est créé si nécessaire.
2. Suivre la tâche. Si le site demande une intervention, afficher le navigateur, cliquer/saisir directement dans la vue, puis reprendre la tâche. Le site et son URL réelle sont visibles. Le mode compte n'affirme jamais à lui seul qu'une connexion est réussie.
3. Examiner les résultats, sélectionner les bonnes entreprises puis importer. Vérifier le nom, la ville, le téléphone, les champs absents, la provenance et le réimport sans doublon.
4. Pour Societe.com, partir de **Collecte et enrichissement → enrichir un prospect**, choisir la source et le prospect existant. Tester un SIRET connu. Au même SIRET exact, l'identité/adresse autorisée peut être corrigée automatiquement ; relire la fiche et l'activité avant/après. Un homonyme ou un autre établissement doit rester en revue. Les coordonnées divergentes ne sont pas écrasées silencieusement.
5. Interrompre une collecte en cours, puis vérifier qu'elle ne modifie pas ultérieurement le prospect. Reprendre une tâche en attente, vérifier l'absence d'activité en double. Tester aussi la déconnexion du profil puis sa réouverture : l'ancienne session doit avoir disparu.
6. Créer un profil LinkedIn ou réseau social, ouvrir le site et vérifier sa navigation/connexion si acceptée. **Le collecteur automatique de ces sources reste à développer** : l'interface doit le dire explicitement. Une connexion ou un CAPTCHA peut nécessiter l'intervention du propriétaire ; la recette ne doit pas contourner un refus du fournisseur.

Le navigateur accepte clavier, clic, collage et défilement. Cliquer dans la vue pour lui donner le clavier ; Alt+Échap rend le focus à GrowthOS. Fermer l'affichage masque la vue ; « Déconnecter » efface la session. Une session inactive est fermée après cinq minutes mais son profil persiste. Le moteur continue les tâches côté serveur quand l'onglet GrowthOS est fermé.

## Preuves et limites

- Suite API : PostgreSQL 16 jetable, fournisseur navigateur simulé, séparation agences/utilisateurs, fusion et annulation transactionnelles, reprises et import sélectionné.
- Protocole : sources et actions bornées, navigation autorisée, refus des réseaux internes.
- CI Chromium : vrai processus Chromium sur pages HTML locales de recette, capture Societe.com, JPEG, saisie, profil persistant et déconnexion. Aucun identifiant ni compte fournisseur réel dans la CI.
- À valider en préproduction : sessions des vrais comptes, anti-robot/consentement, changements HTML des sources, qualité des résultats et charge VPS.

L'extension Chrome existante reste disponible en dépannage et n'a pas changé dans ce lot. Ce document n'est pas une validation de déploiement : attendre le feu vert CI des quatre images.
