# GrowthOS — Guide de déploiement Coolify

## Prérequis

- Coolify v4 installé sur votre serveur Ubuntu 24
- Serveur : 82.22.77.159 (ou votre IP)
- RAM recommandée : 4 GB minimum (8 GB pour Ollama avec llama3.2)
- Disque : 20 GB minimum (40 GB avec modèles Ollama)

---

## Étape 1 — Pousser le code sur GitHub

```bash
# Sur votre machine locale
cd /chemin/vers/growthos
git init
git add -A
git commit -m "Initial commit — GrowthOS v1.0.0"
git remote add origin https://github.com/LePubli/growthos.git
git push -u origin main
```

---

## Étape 2 — Créer l'application dans Coolify

1. Ouvrir Coolify → **New Resource** → **Docker Compose**
2. Source : **GitHub** → sélectionner `LePubli/growthos`
3. Branch : `main`
4. Docker Compose file : `docker-compose.coolify.yml`
5. Cliquer **Save**

---

## Étape 3 — Variables d'environnement dans Coolify

Dans **Settings** → **Environment Variables**, ajouter :

### Obligatoires

```
POSTGRES_USER=growthos
POSTGRES_PASSWORD=CHANGER_MOT_DE_PASSE_FORT
DATABASE_URL=postgresql://growthos:CHANGER_MOT_DE_PASSE_FORT@postgres:5432/growthos
REDIS_PASSWORD=CHANGER_MOT_DE_PASSE_REDIS
JWT_SECRET=GENERER_64_CHARS_ALEATOIRES
ADMIN_EMAIL=admin@le-publicitaire.fr
ADMIN_PASSWORD=CHANGER_MOT_DE_PASSE_ADMIN
ADMIN_COMPANY=Le Publicitaire
```

### URLs (adapter à votre domaine Coolify)

```
NEXT_PUBLIC_API_URL=https://api.votre-domaine.fr
CORS_ORIGINS=https://app.votre-domaine.fr,https://api.votre-domaine.fr
```

**OU avec IP directement :**
```
NEXT_PUBLIC_API_URL=http://82.22.77.159:3001
CORS_ORIGINS=http://82.22.77.159:3000,http://82.22.77.159:3001
```

### Ollama (IA locale)

```
OLLAMA_DEFAULT_MODEL=llama3.2
```

### SMTP

```
SMTP_HOST=mail.le-publicitaire.fr
SMTP_PORT=587
SMTP_USER=votre@email.fr
SMTP_PASSWORD=votre_mot_de_passe
SMTP_FROM_EMAIL=noreply@le-publicitaire.fr
SMTP_FROM_NAME=GrowthOS
```

### IA Cloud (optionnel)

```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
MISTRAL_API_KEY=...
```

---

## Étape 4 — Générer JWT_SECRET

Sur le serveur :

```bash
openssl rand -hex 32
# Copier la valeur dans JWT_SECRET
```

---

## Étape 5 — Configurer les ports dans Coolify

Pour chaque service, configurer les ports exposés :

| Service | Port interne | Port exposé |
|---------|-------------|-------------|
| `web`   | 3000        | 3000        |
| `api`   | 3001        | 3001        |
| `ollama`| 11434       | 11434       |

Les services `postgres`, `redis`, `worker`, `migrate` **ne doivent PAS** être exposés.

---

## Étape 6 — Premier déploiement

1. Cliquer **Deploy** dans Coolify
2. Suivre les logs — durée estimée : 5-10 minutes (build + migrations)
3. Vérifier que `migrate` termine avec succès
4. Vérifier `api` et `web` sont `healthy`

---

## Étape 7 — Setup Ollama (après déploiement)

Se connecter au serveur et installer un modèle IA :

```bash
# Sur le serveur Ubuntu 24
docker exec growthos-ollama ollama pull llama3.2

# Vérifier les modèles installés
docker exec growthos-ollama ollama list

# Tester
docker exec growthos-ollama ollama run llama3.2 "Bonjour !"
```

---

## Étape 8 — Créer le schema PostgreSQL admin

Après le premier déploiement, créer manuellement le schema tenant :

```bash
# Récupérer le schemaName depuis les logs du service migrate
docker compose -p growthos logs migrate | grep "schema:"

# Créer le schema (remplacer SCHEMA_NAME par la valeur réelle)
docker exec growthos-postgres psql -U growthos -d growthos \
  -c "CREATE SCHEMA IF NOT EXISTS \"tenant_le_publicitaire_abc123\";"

# Créer les tables du plugin crm-prospecting
docker exec growthos-postgres psql -U growthos -d growthos \
  -f /path/to/migrations/001_prospects.sql
```

---

## Vérification

```bash
# Health check API
curl http://82.22.77.159:3001/api/v1/health

# Test connexion
curl -X POST http://82.22.77.159:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@le-publicitaire.fr","password":"VOTRE_PASSWORD"}'

# Test Ollama
curl http://82.22.77.159:11434/api/tags
```

---

## Accès

| Service | URL |
|---------|-----|
| Frontend | `http://82.22.77.159:3000` |
| API | `http://82.22.77.159:3001/api/v1` |
| Swagger | `http://82.22.77.159:3001/api/docs` |
| Ollama | `http://82.22.77.159:11434` |

---

## Troubleshooting

### Le service `migrate` échoue

```bash
docker compose -p growthos logs migrate
# Vérifier que postgres est healthy d'abord
```

### L'API ne démarre pas

```bash
docker compose -p growthos logs api
# Vérifier DATABASE_URL et REDIS_PASSWORD
```

### Ollama timeout

```bash
# Augmenter la RAM ou choisir un modèle plus léger
docker exec growthos-ollama ollama pull phi4   # 2.4GB au lieu de 3.8GB
```

### Rebuild forcé

```bash
# Dans Coolify : Settings → Redeploy → Force rebuild
# OU sur le serveur :
docker compose -p growthos up -d --build --force-recreate api web
```
