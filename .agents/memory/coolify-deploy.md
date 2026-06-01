---
name: Coolify Deployment
description: Config Docker/Coolify pour GrowthOS — pièges et fixes confirmés
---

## Règles critiques

**Labels Traefik** — NE PAS supprimer les labels Traefik du docker-compose.yml.
Coolify les utilise pour router le trafic. Sans eux → bad gateway.
Les hash dans les noms de router (`qg3u7f72d9lin10gl2ixlp7x`) sont l'ID interne Coolify.

**pnpm dans Dockerfile.api** — utiliser `npm install -g pnpm@10.26.1 --quiet`, PAS `corepack`.
corepack peut échouer silencieusement dans certains builds Coolify.

**VITE_API_URL** — doit être défini comme variable d'ENVIRONNEMENT (runtime) dans Coolify,
PAS seulement comme build arg. Le `docker/entrypoint.sh` l'injecte dans window.__ENV__.
api-client.ts lit `window.__ENV__?.VITE_API_URL` en priorité.
Valeur: `https://<api-domain>/api/v1` (avec /api/v1 en suffixe).

**proxy_method dans nginx** — NE PAS utiliser `proxy_method $request_method` dans nginx.conf.
Cette directive n'accepte que des valeurs fixes, PAS de variables. Avec une variable,
nginx envoie la chaîne littérale "$request_method" comme méthode HTTP → 405 sur tous les POST
(login, register, etc.). Sans cette directive, nginx passe automatiquement la méthode originale.

**Erreur 405 login/register** — cause confirmée: `proxy_method $request_method` dans la location
/api/ de nginx.conf. Fix: supprimer entièrement la ligne. Rebuild frontend requis pour appliquer.

**growthos-mobile** — doit être inclus dans les COPY package.json des Dockerfiles
(frontend et api) pour que pnpm --frozen-lockfile valide tous les importers du lockfile.
