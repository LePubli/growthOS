---
name: Coolify VPS setup
description: Architecture, réseaux, Traefik et gotchas du VPS Coolify pour le projet GrowthOS
---

## Infrastructure

- **VPS IP** : `82.22.77.159`
- **Coolify** : panel à `vps.le-publicitaire.fr`
- **Proxy** : container `coolify-proxy` (Traefik), géré par Coolify
- **DNS dynamique** : domaines `sslip.io` auto-générés par Coolify

## Application GrowthOS — Coolify

- **Type** : Docker Compose (Build Pack = "Docker Compose")
- **Coolify app ID** : `qg3u7f72d9lin10gl2ixlp7x` (visible dans les noms de containers)
- **Réseau Docker** : `qg3u7f72d9lin10gl2ixlp7x` (créé automatiquement par Coolify pour ce compose)
- **Domaine frontend (growthos)** : `igs6f5ezyix8l2my3u3tuxbl.82.22.77.159.sslip.io`
- **Domaine API (api-server)** : `vit6buuz2vmqaleuh0z5autx.82.22.77.159.sslip.io`

## Services docker-compose

| Service | Port interne | Expose |
|---------|-------------|--------|
| growthos (nginx) | 3000 | 3000 |
| api-server (Express) | 3001 | 3001 |

**Pourquoi port 3000 pour nginx (pas 80) ?**  
Coolify/Traefik utilise le port 80 comme entrypoint HTTP. Utiliser le port 80 aussi comme backend provoquait un conflit — Traefik ne routait pas vers le container. Port 3000 fonctionne correctement.

## GOTCHA CRITIQUE — Réseaux Docker et accès postgres

- Le postgres Coolify est le container **`coolify-db`** (image `postgres:15-alpine`)
- Il est sur le réseau **`coolify`** avec IP `10.0.1.8` et aliases `[coolify-db postgres]`
- **`helium` n'est PAS un alias Docker** — c'est le nom Coolify de la ressource, mais Docker ne le connaît pas
- Le DATABASE_URL correct : `postgresql://postgres:password@coolify-db/heliumdb?sslmode=disable`
  - hostname = `coolify-db` (le vrai alias Docker, pas le nom Coolify)
  - base de données = `heliumdb` (à vérifier avec `docker exec coolify-db psql -U postgres -l`)
- Pour accéder à `coolify-db`, l'api-server doit être sur le réseau `coolify` :

```yaml
services:
  api-server:
    networks:
      - default        # réseau isolé de l'app
      - coolify        # réseau partagé Coolify (pour accéder à coolify-db)

networks:
  coolify:
    external: true     # réseau existant, géré par Coolify
```

- `growthos` (nginx) n'a pas besoin d'accéder à postgres → reste sur `default` uniquement
- **Leçon** : Coolify génère un DATABASE_URL avec son nom interne de ressource (ex: `helium`) qui ne correspond PAS forcément au container/alias Docker réel — toujours vérifier avec `docker inspect <container>`

## Traefik — fonctionnement

- Coolify gère Traefik via labels Docker **et** un fichier statique `/data/coolify/proxy/dynamic/coolify.yaml` (uniquement pour le panel Coolify lui-même)
- Pour les services applicatifs : **labels Docker uniquement**
- Coolify génère automatiquement un router `http-0-{app_id}-{service}` avec `Host(...) && PathPrefix(/)`
- Les labels manuels dans docker-compose doivent utiliser le format `{service}-{app_id}` pour le nom du router
- **Traefik ne route PAS vers les containers `(unhealthy)`** — c'est critique

## Gotcha critique : healthcheck IPv6

- Alpine Linux résout `localhost` en `::1` (IPv6) dans les healthchecks
- nginx/app qui écoute uniquement IPv4 → healthcheck échoue → container `(unhealthy)` → Traefik ignore le container → **404**
- **Fix** : toujours utiliser `127.0.0.1` dans les healthchecks, pas `localhost`
- Ajouter `listen [::]:PORT;` dans nginx.conf pour supporter IPv6 aussi

## Gotcha critique : VITE_API_URL

- Ne jamais mettre `VITE_API_URL` dans les env vars Coolify
- Vite bake cette valeur au BUILD TIME → si `http://localhost:3001` est mis, le browser essaie de se connecter à la machine de l'utilisateur → Network Error
- **Solution** : laisser vide → le frontend utilise `/api/v1` (URL relative) → nginx proxifie vers api-server

## Architecture API dans nginx

```nginx
resolver 127.0.0.11 valid=30s ipv6=off;  # DNS Docker interne

location /api/ {
    set $api_upstream api-server:3001;
    proxy_pass http://$api_upstream;  # variable sur host:port UNIQUEMENT, sans chemin
}
```

**Pourquoi resolver + variable ?**  
Avec `proxy_pass http://api-server:3001` statique, nginx résout `api-server` au DÉMARRAGE. Si api-server n'est pas encore ready → nginx crashe → restart loop. La variable force la résolution par requête.

**GOTCHA CRITIQUE — double /api/ avec variable + chemin :**  
`proxy_pass $var/api/` où `$var = http://api-server:3001` → nginx ne fait PAS la substitution d'URI quand une variable est utilisée → l'api-server reçoit `/api/api/v1/...` → 404.  
**Règle** : la variable doit contenir UNIQUEMENT `host:port` (pas de schéma, pas de chemin), et le `http://` est un préfixe littéral : `proxy_pass http://$upstream;`  
Sans chemin dans proxy_pass, nginx passe l'URI originale telle quelle → `/api/v1/auth/register` arrive intact.

## Fichiers Coolify proxy

- `/data/coolify/proxy/dynamic/coolify.yaml` — config statique Traefik pour le panel
- `/data/coolify/proxy/dynamic/default_redirect_503.yaml` — page d503 par défaut
- Pas de fichiers dynamiques pour les apps utilisateur — tout passe par les labels Docker

## Commandes de debug utiles (sur le VPS)

```bash
# Statut containers avec santé
docker ps --format "{{.Names}}\t{{.Status}}"

# Labels Traefik d'un container
docker inspect $(docker ps -q --filter name=growthos) \
  --format='{{range $k,$v := .Config.Labels}}{{$k}}={{$v}}{{"\n"}}{{end}}' | grep traefik

# Réseaux d'un container
docker inspect $(docker ps -q --filter name=growthos) \
  --format='{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}'

# Test nginx direct (bypass Traefik)
GROWTHOS_IP=$(docker inspect $(docker ps -q --filter name=growthos) \
  --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')
curl http://$GROWTHOS_IP:3000/health

# Test routing Traefik avec host header
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Host: igs6f5ezyix8l2my3u3tuxbl.82.22.77.159.sslip.io" http://localhost
```
