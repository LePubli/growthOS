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

**Erreur 405 login/register** — cause: nginx try_files retourne 405 pour POST quand
api-server:3001 n'est pas joignable par le container frontend. Fix: error_page 405 =200 /index.html
dans nginx.conf + VITE_API_URL pour bypasser le proxy nginx.

**growthos-mobile** — doit être inclus dans les COPY package.json des Dockerfiles
(frontend et api) pour que pnpm --frozen-lockfile valide tous les importers du lockfile.
