# GrowthOS — mises à jour GitHub → DockPanel

## Principe

- GitHub Actions valide le TypeScript, le wizard/CRM sur PostgreSQL 16, les connecteurs IA simulés et les contrôles de sécurité SEO.
- Seulement si `validate` réussit, GitHub construit et publie `growthos-api` et `growthos-web` sur GHCR.
- Chaque image reçoit un tag immuable correspondant au SHA du commit. Seule la branche de livraison désignée publie aussi le tag mobile `preprod`.
- **Aucun déploiement du VPS n'est déclenché par GitHub.** L'administrateur choisit le moment dans DockPanel.
- Aucune clé API du VPS ni aucun mot de passe PostgreSQL ne doit être ajouté au dépôt ou au workflow.

Branche de livraison actuelle : `fix/growthos-functional-redesign`. Plus tard, pour passer sur `growthos-preprod`, définir la variable de dépôt GitHub `GROWTHOS_PREPROD_SOURCE_BRANCH=growthos-preprod`. Il ne faut qu'une seule branche autorisée à actualiser `preprod` à un instant donné.

## Configuration unique de la stack existante dans DockPanel

Ouvrir **Docker Apps → growthos-preprod → Edit**. **Ne pas importer une nouvelle stack** et ne pas remplacer le YAML existant par le fichier Compose du dépôt, car le nom du volume PostgreSQL pourrait changer.

Dans le service `api-server`, utiliser :

```yaml
image: ghcr.io/lepubli/growthos-api:preprod
pull_policy: always
mem_limit: 1g
cpus: 1.00
pids_limit: 200
```

Dans le service `growthos`, utiliser :

```yaml
image: ghcr.io/lepubli/growthos-web:preprod
pull_policy: always
mem_limit: 256m
cpus: 0.25
pids_limit: 100
```

Dans le service `growthos-db`, conserver `postgres:16-alpine`, toutes ses variables et surtout **le volume existant**, en ajoutant éventuellement :

```yaml
mem_limit: 768m
cpus: 0.50
pids_limit: 200
```

Ce sont des **extraits de services**, à intégrer à leur niveau d'indentation existant, pas un fichier Compose complet. Préserver les noms de services, `ports`, `depends_on`, `environment`, `volumes`, les secrets et le proxy HTTPS `agile.le-publicitaire.fr`. Conserver `ENABLE_OUTBOUND_EMAIL=false` pendant la recette.

Vérifier que le YAML est validé par DockPanel avant l'enregistrement. Les limites intégrées au Compose persistent lors des recréations des conteneurs ; vérifier leur effet réel après le déploiement.

## Routine de publication

1. Développement sur GitHub, push sur la branche de livraison.
2. Attendre **GitHub → Actions → GrowthOS preproduction images** : `validate`, `build-and-publish (api)` et `build-and-publish (web)` tous **success**.
3. Dans DockPanel, ouvrir **Docker Apps → growthos-preprod → Edit**, puis enregistrer à nouveau la même configuration. L'édition d'une stack entraîne son redéploiement ; les deux `pull_policy: always` demandent la récupération des images actuelles.
4. Confirmer **3/3 running** et vérifier `https://agile.le-publicitaire.fr/api/healthz` (réponse `{"status":"ok"}`), puis ouvrir l'interface et effectuer un test métier.
5. Vérifier CPU/RAM et les logs des trois conteneurs. **Ne pas redémarrer Docker ou Nginx globalement.**

Important : **Restart** redémarre les conteneurs existants et ne garantit pas le téléchargement d'une nouvelle image. Si DockPanel n'applique pas le pull sur un simple Edit/Save, ne pas forcer de déploiement : vérifier sa version et utiliser la voie de mise à jour Compose de l'instance.

## Retour arrière

Les images du dernier build vert restent également publiées avec le SHA complet du commit. Pour revenir à une version précise, remplacer temporairement `:preprod` par `:<SHA_DU_COMMIT_PRECEDENT>` sur **les deux images** (même SHA), puis redéployer la stack existante. Ne jamais supprimer les volumes. Les modifications de schéma DB peuvent nécessiter une procédure de rollback spécifique ; conserver une sauvegarde PostgreSQL avant une migration importante.

## Limitations

- Le tag mobile garantit une **référence d'image stable**, pas un déploiement zéro interruption. Une courte indisponibilité peut survenir lors du remplacement des conteneurs.
- Les images peuvent être publiées à quelques secondes d'écart ; attendre que **les deux** jobs GHCR soient verts avant de déployer.
- Les tests GitHub ne prouvent pas le fonctionnement de chaque écran ; conserver la recette fonctionnelle réelle.
- L'exécution de campagnes e-mail et de workflows automatiques reste volontairement désactivée.
