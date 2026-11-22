# GrowthOS — déploiement isolé sur le VPS de production

**État : préparation uniquement. Ne rien lancer sur le VPS avant la fin du
build GitHub et la vérification des images.** Les applications Mejliss TV,
TriMaint, Miel & Compagnie et DockPanel ne doivent être ni arrêtées, ni
modifiées ni redémarrées.

## 1. Images construites sur GitHub, jamais sur le VPS

Le dépôt dispose de `.github/workflows/growthos-preprod-images.yml`.
Le workflow se lance uniquement sur la branche `growthos-preprod` (ou par
déclenchement manuel quand GitHub l'autorise). Il construit deux images :

- `ghcr.io/lepubli/growthos-api:<SHA_DU_COMMIT>`
- `ghcr.io/lepubli/growthos-web:<SHA_DU_COMMIT>`

Vérifier que **le job de validation et les deux jobs Docker sont verts** dans
GitHub → Actions → « GrowthOS preproduction images ». Le job de validation
vérifie TypeScript, le wizard, le CRM et les sondes IA hors ligne avant toute
publication d'image. Noter le SHA complet (40 caractères) du
commit construit. Les deux images doivent avoir **le même SHA**.

Si les packages GHCR sont privés (cas fréquent au premier build), il faudra
authentifier Docker sur le VPS avec un jeton GitHub personnel limité à
`read:packages`. Ne jamais envoyer ce jeton par messagerie ou l'inclure dans
le fichier `.env` de l'application. Sur un registre public, aucun jeton n'est
nécessaire. Les permissions de publication côté GitHub Actions utilisent le
`GITHUB_TOKEN` du dépôt, pas un secret de production.

## 2. Vérifications sans modification sur le VPS

```bash
uname -m
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
free -h
df -h /
ss -ltn | grep ':13000 ' || true
docker compose ls
```

Les images du workflow sont construites pour **`linux/amd64`** ; le VPS doit
indiquer `x86_64`. Si le résultat est `aarch64`, ne pas continuer : construire
une image ARM64 avant installation.

Le port `13000` ne doit pas être occupé. Si c'est le cas, choisir un autre
`GROWTHOS_HOST_PORT` non utilisé. Garder suffisamment de marge pour la RAM,
le disque et les services en production.

## 3. Fichiers isolés

Les seuls fichiers requis sur le VPS pour l'installation sont :

- `docker-compose.preprod.yml` ;
- `.env` créé depuis `.env.dockpanel.example` (sur le VPS uniquement).

Préparer un nouveau dossier, par exemple `/root/apps/growthos-preprod`, après
avoir vérifié qu'il n'existe pas déjà. **Ne pas utiliser le dossier d'une
autre stack.** Ne pas copier les variables, volumes ni mots de passe de
Mejliss TV ou de DockPanel.

Dans le fichier `.env`, remplir les clés suivantes avec de nouvelles valeurs
indépendantes : `POSTGRES_PASSWORD`, `JWT_SECRET`, `JWT_REFRESH_SECRET`,
`ENCRYPTION_KEY` (64 caractères hexadécimaux) et `SETUP_TOKEN` (64 caractères
hexadécimaux). Utiliser `openssl rand -hex 24`, `openssl rand -hex 64` et
`openssl rand -hex 32` selon le paramètre. Les deux secrets JWT doivent être
différents. Définir :

```dotenv
GROWTHOS_IMAGE_PREFIX=ghcr.io/lepubli
GROWTHOS_IMAGE_TAG=SHA_COMPLET_DES_DEUX_IMAGES
GROWTHOS_HOST_PORT=13000
```

Protéger le fichier `.env` avec `chmod 600 .env`. Ne jamais l'ajouter à Git.

## 4. Démarrer uniquement GrowthOS

Dans le dossier isolé, **après validation du bon SHA et de l'accès aux images** :

```bash
docker compose -p growthos-preprod -f docker-compose.preprod.yml config --quiet
docker compose -p growthos-preprod -f docker-compose.preprod.yml pull
docker compose -p growthos-preprod -f docker-compose.preprod.yml up -d --no-build
docker compose -p growthos-preprod -f docker-compose.preprod.yml ps
curl -fsS http://127.0.0.1:13000/health
curl -fsS http://127.0.0.1:13000/api/healthz
```

Le Compose ne contient aucun `build:` et borne l'ensemble à environ 2 Gio de
RAM et 1,75 vCPU. Ces plafonds protègent les autres services mais peuvent
nécessiter des ajustements après tests. Aucun port PostgreSQL ni API n'est
publié sur l'hôte ; seule l'interface est liée à `127.0.0.1:13000`.

## 5. Ouvrir le wizard sans exposer le site

Depuis **le PC** utilisé pour se connecter au VPS :

```bash
ssh -L 13000:127.0.0.1:13000 utilisateur@vps.le-publicitaire.fr
```

Ouvrir ensuite `http://127.0.0.1:13000/setup` sur le PC, renseigner le code
`SETUP_TOKEN` et suivre l'assistant. Les connexions SMTP, Claude, OpenAI et
DeepSeek sont facultatives pendant la première installation. Les boutons de
test IA consultent seulement la liste des modèles disponibles, sans générer
de texte. Ollama reste en veille.

**Ne pas ajouter de sous-domaine public tant que les tests et l'audit de
sécurité ne sont pas terminés.** Nginx sur les ports 80/443 est géré par le
DockPanel existant ; ne jamais démarrer un autre serveur sur ces ports.

## 6. Arrêt réversible limité à GrowthOS

```bash
docker compose -p growthos-preprod -f docker-compose.preprod.yml stop
```

Cette commande arrête seulement les services de `growthos-preprod`, sans
supprimer la base ni les volumes. **Ne pas utiliser `down -v`, `system prune`,
`volume prune`, `--remove-orphans` ni redémarrer Docker globalement.**

L'arrêt du transcripteur Mejliss TV se gère à part : une commande Docker
`pause` interrompt le CPU mais n'efface pas sa RAM. Ne pas effacer ses jobs ou
ses volumes.

## 7. Limites connues

- Les contrôles de construction et d'intégration ont été validés localement,
  mais **aucun vrai Docker Engine du VPS** n'a été utilisé ici.
- Les clés API et SMTP réelles restent à tester sur la préproduction.
- Les campagnes externes sont bloquées par `ENABLE_OUTBOUND_EMAIL=false`.
- Les autres modules encore partiellement simulés doivent être audités avant
  une ouverture publique.
