# GrowthOS — SaaS B2B Growth Platform

> Plateforme SaaS multi-tenant enterprise-grade pour agences marketing, SDR et commerciaux B2B.  
> Architecture inspirée d'Odoo Community — modulaire, extensible, marketplace-ready.

---

## 🏗️ Architecture

```
GrowthOS
├── apps/
│   ├── api/          NestJS 10 — Backend API + Plugin Engine
│   └── web/          Next.js 14 — Frontend (design Odoo)
├── packages/
│   ├── ui/           Composants partagés
│   ├── types/        Types TypeScript partagés
│   └── sdk/          Developer SDK pour plugins tiers
├── infrastructure/
│   ├── docker/       Dockerfiles
│   ├── nginx/        Config reverse proxy
│   └── scripts/      Scripts utilitaires
└── docs/             Documentation
```

## 🧩 Plugin System

Chaque plugin est un ZIP contenant :
```
my-plugin.zip
├── plugin.yaml        # Manifest (requis)
├── dist/
│   ├── routes/        # NestJS routes
│   ├── hooks/         # Event hooks
│   └── widgets/       # React widgets
├── migrations/        # SQL migrations tenant
└── README.md
```

### Cycle de vie d'un plugin
```
Upload ZIP → Validation manifest → Extraction → Migration DB tenant
     → Registry in-memory → Routes actives → Menu items injectés
```

### Toggle hot-reload
```
Toggle ON/OFF → DB update + Registry in-memory → Instantané (0 restart)
```

## 🎨 Design System Odoo

Police : **Noto Sans** (Google Fonts)
Couleur primaire : **#017E84** (vert-bleu Odoo)
Sidebar : **#2C3E50** (sombre, signature Odoo)
Body bg : **#F9F9F9**

## 🚀 Démarrage rapide

```bash
# 1. Cloner et configurer
cp .env.example .env
# Remplir .env avec vos valeurs

# 2. Démarrer (dev)
docker-compose -f docker-compose.dev.yml up -d

# 3. Migrations
npm run db:migrate

# 4. Démarrer l'app
npm run dev
```

## 📦 Stack technique

| Composant | Technologie |
|-----------|-------------|
| Frontend  | Next.js 14 + TypeScript + shadcn/ui |
| Backend   | NestJS 10 + TypeScript |
| ORM       | Prisma 5 |
| DB        | PostgreSQL 16 (schema-per-tenant) |
| Cache     | Redis 7 |
| Queue     | BullMQ |
| Storage   | MinIO |
| Auth      | JWT + Refresh tokens |
| IA        | Anthropic Claude + OpenAI |

## 🌐 Multi-tenant

Stratégie : **schema-per-tenant PostgreSQL**
- Chaque tenant = schema dédié (`tenant_{slug}`)
- Isolation totale des données
- Migrations indépendantes par tenant

## 🛒 Marketplace plugins

```
Plugin ZIP → Upload UI → Validation → Installation automatique
→ Activation → Hot-reload → En production
```

## 📖 Documentation plugin

Voir `docs/plugin-manifest-example.yaml` pour le format complet.
