# GrowthOS — Guide de Déploiement

## Prérequis

| Outil | Version minimale | Rôle |
|-------|-----------------|------|
| Docker | 24+ | Conteneurisation |
| Docker Compose v2 | inclus Docker Desktop | Orchestration locale |
| [Coolify](https://coolify.io) | v4+ | Hébergement production (auto-SSL, Traefik) |
| Domaine DNS | — | Pointer `A` vers l'IP du serveur Coolify |
| PostgreSQL | 16+ | Base de données (peut être fournie par Coolify) |

---

## 1. Configuration de l'environnement

```bash
# Copier le template de variables
cp .env.example .env

# Éditer avec vos vraies valeurs
nano .env
```

Variables **obligatoires** à changer avant tout déploiement :

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Connexion PostgreSQL complète |
| `JWT_SECRET` | Secret JWT — générer via `openssl rand -hex 64` |
| `JWT_REFRESH_SECRET` | Secret JWT refresh — idem |
| `VITE_API_URL` | URL publique de l'API (ex : `https://api.mondomaine.com`) |

---

## 2. Déploiement via Coolify

### 2.1 Créer les deux applications dans Coolify

GrowthOS est composé de **deux services** à déployer séparément :

| Service | Dockerfile | Port exposé |
|---------|------------|-------------|
| Frontend (Nginx) | `Dockerfile` | 3000 |
| API (Node.js) | `Dockerfile.api` | 3001 |

#### Service Frontend
1. Nouveau projet → **Docker Compose** ou **Dockerfile** → pointer sur `Dockerfile`
2. **Build Variables** (onglet Build) :
   - `VITE_API_URL` = `https://api.mondomaine.com`
   - `BASE_PATH` = `/`
3. Domaine : `app.mondomaine.com`

#### Service API
1. Nouveau projet → **Dockerfile** → pointer sur `Dockerfile.api`
2. **Environment Variables** (onglet Env) : coller le contenu de votre `.env`
3. Domaine : `api.mondomaine.com`

> **Base de données** : utiliser le service PostgreSQL intégré de Coolify ou une instance externe. Récupérer la `DATABASE_URL` depuis l'onglet "Database" de Coolify.

### 2.2 Via docker-compose (auto-hébergé sans Coolify)

```bash
# Construire et démarrer
docker compose up -d --build

# Voir les logs
docker compose logs -f

# Stopper
docker compose down
```

> Les labels Traefik dans `docker-compose.yml` sont pré-configurés pour Coolify. En déploiement standalone, supprimer la section `labels` et ajouter un mapping de ports explicite.

---

## 3. Migrations de base de données

Les migrations s'appliquent **automatiquement au démarrage** de l'API via des fonctions `runXxxMigration()`. Aucune commande manuelle requise en production.

Pour pousser le schéma manuellement (dev uniquement) :
```bash
pnpm --filter @workspace/db run push
```

---

## 4. Backups et restauration

### Lancer un backup manuel
```bash
./scripts/backup-db.sh ./backups
# → Crée ./backups/growthos_YYYYMMDD_HHMMSS.sql.gz
```

### Restaurer un backup
```bash
./scripts/restore-db.sh ./backups/growthos_20260618_030000.sql.gz
```

### Automatiser avec Cron
```bash
# Installer le cron (adapter les chemins)
crontab -e
# Coller le contenu de scripts/crontab.example
```

Le script de backup garde automatiquement les **30 derniers backups** et supprime les plus anciens.

---

## 5. Mises à jour

```bash
# 1. Tirer les nouvelles sources
git pull origin main

# 2. Rebuilder et redéployer (Coolify le fait automatiquement via webhook Git)
docker compose up -d --build

# Les migrations de DB s'appliquent automatiquement au redémarrage de l'API.
```

---

## 6. Santé des services

| Endpoint | Service | Réponse attendue |
|----------|---------|-----------------|
| `GET /health` | Frontend Nginx | `200 OK` |
| `GET /api/healthz` | API Node.js | `200 { status: "ok" }` |

Les deux Dockerfiles incluent un `HEALTHCHECK` Docker natif sur ces endpoints.
