# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Outils natifs (bcrypt, sharp, canvas, node-gyp)
RUN apk add --no-cache python3 make g++ curl

# Manifests — racine + api (contexte = racine du monorepo)
COPY package.json ./
COPY apps/api/package.json ./apps/api/

# Packages locaux partagés
COPY packages/ ./packages/

# Installation des dépendances depuis le dossier api
WORKDIR /app/apps/api
RUN npm install --no-audit --no-fund --legacy-peer-deps

# Code source complet de l'api
WORKDIR /app
COPY apps/api/ ./apps/api/

# Génération du client Prisma
WORKDIR /app/apps/api
RUN npx prisma generate

# Compilation TypeScript
RUN npm run build

# ─── Stage 2: Production (API server) ─────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache curl

# Manifests + packages locaux
COPY package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/ ./packages/

# Deps de production uniquement
WORKDIR /app/apps/api
RUN npm install --no-audit --no-fund --legacy-peer-deps --omit=dev

# Artefacts de build
WORKDIR /app
COPY --from=builder /app/apps/api/dist            ./apps/api/dist
COPY --from=builder /app/apps/api/node_modules/.prisma ./apps/api/node_modules/.prisma
COPY apps/api/prisma ./apps/api/prisma

WORKDIR /app/apps/api

EXPOSE 3001

CMD ["node", "dist/main.js"]

# ─── Stage 3: Worker BullMQ ───────────────────────────────────────────────────
# Hérite de production — même image, point d'entrée différent
FROM production AS production-worker

CMD ["node", "dist/worker.js"]
