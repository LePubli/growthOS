# GrowthOS: installation avec DockPanel et assistant de configuration

La base PostgreSQL et les secrets d'authentification doivent exister **avant**
que l'application web démarre. Le reste se configure à l'écran dans le wizard.

## Prérequis

- Docker Engine et Docker Compose v2 sur le VPS.
- Un domaine ou sous-domaine géré par DockPanel / le proxy existant.
- Le port `13000` libre sur l'hôte (ou modifier `GROWTHOS_HOST_PORT`).
- Prévoir plusieurs Go de RAM libres pour la compilation des images Node 24.

**Sur un VPS qui héberge déjà des services de production : ne lancez pas
`docker compose up --build` directement tant que les images n'ont pas été
construites sur une autre machine (ou dans une CI) et publiées dans un registre.
Le fichier Compose actuel utilise `build:` ; une variante `image:` avec les
images effectivement publiées doit d'abord être préparée.** Les limites
`mem_limit` et `cpus` du Compose protègent les conteneurs en fonctionnement,
mais ne plafonnent pas la phase de compilation Docker.

Le fichier proposé limite les conteneurs GrowthOS à environ **2 Gio de RAM
cumulée** et **1,75 vCPU cumulés** ; ce sont des plafonds de test, à valider
avec les véritables charges applicatives.

Si Traefik utilise déjà les ports 80/443, ne lancez pas un deuxième reverse
proxy sur les mêmes ports. Conservez un point d'entrée HTTPS unique.

## 1. Préparer les paramètres minimaux

```bash
git clone https://github.com/LePubli/growthOS.git
cd growthOS
cp .env.dockpanel.example .env
openssl rand -hex 24  # mot de passe PostgreSQL
openssl rand -hex 64  # JWT_SECRET
openssl rand -hex 64  # JWT_REFRESH_SECRET (différent du précédent)
openssl rand -hex 32  # ENCRYPTION_KEY (64 caractères hexadécimaux)
openssl rand -hex 32  # SETUP_TOKEN (code à saisir une fois dans le wizard)
nano .env
chmod 600 .env
```

Remplacer **tous** les `CHANGE_ME`. Le code `SETUP_TOKEN` est à garder privé.
Le compte utilisateur se créera **dans le navigateur** lors du premier accès.

## 2. Construire et démarrer (uniquement hors VPS partagé de production)

```bash
docker compose -f docker-compose.dockpanel.yml config --quiet
docker compose -f docker-compose.dockpanel.yml up -d --build
docker compose -f docker-compose.dockpanel.yml ps
curl -fsS http://127.0.0.1:13000/health
curl -fsS http://127.0.0.1:13000/api/healthz
```

Il faut que l'API soit saine : les migrations sont appliquées au démarrage.
En cas d'erreur, examiner `docker compose -f docker-compose.dockpanel.yml logs api-server`.

## 3. Première configuration à l'écran

Tant que la plateforme n'est pas durcie, préférez un tunnel SSH :

```bash
ssh -L 13000:127.0.0.1:13000 utilisateur@IP_DU_VPS
```

Ouvrez `http://127.0.0.1:13000/setup` dans votre navigateur. Le wizard permet :

1. De confirmer le code d'installation et créer le premier administrateur.
2. De configurer votre agence, son site, la région et les offres de prospection.
3. De configurer et **vérifier** vos identifiants SMTP professionnels.
4. D'enregistrer et de tester séparément les clés **Claude (Anthropic)**,
   **OpenAI** et **DeepSeek**, puis de choisir le fournisseur IA principal.
5. De valider les étapes en connaissance des fonctions encore incomplètes.

Le wizard est accessible à nouveau via `/setup` pour un administrateur déjà
connecté. Les modifications y sont enregistrées en base ; les mots de passe
SMTP et les clés IA ne sont jamais renvoyés en clair au navigateur.

Le premier compte est créé atomiquement avec le rôle `platform_admin` ; une
deuxième tentative de bootstrap sera refusée. Les inscriptions publiques
normales sont désactivées par défaut.

**Ollama reste facultatif et en veille** : aucun service Ollama n'est nécessaire
pour installer GrowthOS. Un administrateur peut le configurer plus tard depuis
la page de gestion des clés API. Les trois clés cloud sont chiffrées en base.
Le bouton « Tester » consulte uniquement `/models` chez chaque fournisseur :
il ne déclenche aucune génération facturée. Une génération de brouillon dans
AI SDR peut en revanche engager des frais d'API. Aucun fournisseur n'est
activé automatiquement lors d'une installation vierge.

## 4. DockPanel, domaine et HTTPS

Pour un domaine tel que `crm.exemple.fr`, pointer l'entrée DNS A vers le VPS,
puis créer dans DockPanel un site de type *Reverse Proxy* vers le port hôte
`13000` avec HTTPS. Attention : l'application est toujours en mode préproduction
tant que la revue de sécurité et les fonctions métiers manquantes ne sont pas
terminées. Protégez l'accès par VPN, liste d'IP ou contrôle d'accès externe.

## 5. Maintenance et sauvegardes

```bash
docker compose -f docker-compose.dockpanel.yml logs --tail=100
docker compose -f docker-compose.dockpanel.yml exec -T growthos-db pg_dump -U growthos growthos | gzip > growthos-backup.sql.gz
```

Copiez vos sauvegardes hors du VPS. Testez une restauration sur une base
isolée. Ne lancez pas les tests E2E (ils créent et suppriment des données) sur
votre base de production.

## Test local reproductible avant installation

Sur une machine de développement disposant de Node.js 24, après installation
des dépendances et construction de l'API :

```bash
pnpm install --frozen-lockfile
pnpm --filter @workspace/api-server build
pnpm --filter @workspace/growthos typecheck
pnpm --filter @workspace/api-server typecheck
node scripts/smoke-wizard.mjs
pnpm --filter @workspace/api-server exec node --import tsx src/tests/ai-connector-probes.test.ts
```

Ce script crée une base de test **temporaire**, des serveurs factices Annuaire
et Ollama, déroule le bootstrap, sauvegarde les paramètres et vérifie les
contrôles d'accès. Les serveurs de test sont arrêtés et la base temporaire
supprimée automatiquement. Il ne doit jamais servir à vérifier les vrais
identifiants email ni à envoyer une campagne.

## Notes sur l'état actuel

- Le wizard configure réellement les paramètres et enregistre les secrets
  SMTP via le stockage des clés fournisseurs. Ce n'est pas un installateur
  du moteur Docker depuis un navigateur.
- Les services Docker ne sont pas accessibles directement depuis Internet.
- Les séquences et la collecte automatique doivent encore être validées avant
  le premier envoi à de vrais prospects.
- L'envoi externe est **bloqué** avec `ENABLE_OUTBOUND_EMAIL=false` dans la
  configuration Docker. L'activer exigerait d'abord un vrai système de gestion
  des oppositions/désabonnements, d'espacement et de suivi des réponses.
- L'écran Sourcing dispose d'une source réelle : **Annuaire des entreprises**
  (recherche de 1 à 25 sociétés par requête). Elle importe des entreprises
  sans inventer d'email, de téléphone ou de site web. Les connecteurs
  LinkedIn, Google Maps, X et les scrapers personnalisés ne sont pas actifs.
- Les tests automatiques peuvent utiliser une fausse API d'annuaire et un faux
  serveur Ollama ainsi que des réponses simulées pour les trois fournisseurs
  cloud ; ils ne remplacent pas les essais sur les vrais fournisseurs.
- Le service DockPanel « Git Deploy » ne convient pas directement à cette
  stack : son mode Compose refuse les services `build:` depuis un dépôt Git.
  Construisez d'abord avec `docker compose` sur le VPS, puis configurez la
  route HTTPS dans DockPanel. Ne supposez pas que la seule présence du fichier
  Compose dans GitHub déclenche un déploiement complet.
- Le démarrage Docker complet et l'interface Chromium n'ont pas pu être
  exécutés dans l'environnement de test : aucun démon Docker n'est disponible
  et Chromium ne peut pas créer ses sockets dans ce bac à sable.
