# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Outils natifs (bcrypt, sharp, node-gyp)
RUN apk add --no-cache python3 make g++ curl

# Manifests — racine + api (contexte = racine du monorepo)
COPY package.json ./
COPY apps/api/package.json ./apps/api/

# Packages locaux partagés
COPY packages/ ./packages/

# Installation TOUTES les deps (dev incluses — nécessaire pour tsc/prisma)
WORKDIR /app/apps/api
RUN npm install --no-audit --no-fund --legacy-peer-deps

# Code source
WORKDIR /app
COPY apps/api/ ./apps/api/

# Génération client Prisma + compilation TS
WORKDIR /app/apps/api
RUN npx prisma generate

# Compilation manuelle avec tsc — inclut main.ts ET worker.ts
RUN npx tsc --project tsconfig.json

# Prune des dev deps IN BUILDER — évite une réinstallation dans le stage production
RUN npm prune --omit=dev

# ─── Stage 2: Production (API server) ─────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache curl

# On copie directement depuis builder — PAS de npm install ici
COPY --from=builder /app/apps/api/dist            ./apps/api/dist
COPY --from=builder /app/apps/api/node_modules    ./apps/api/node_modules
COPY --from=builder /app/apps/api/package.json    ./apps/api/package.json
COPY --from=builder /app/packages                 ./packages

# Prisma : schéma + migrations (pour prisma migrate deploy dans le service migrate)
COPY apps/api/prisma ./apps/api/prisma

WORKDIR /app/apps/api

EXPOSE 3001

CMD ["node", "dist/main.js"]

# ─── Stage 3: Worker BullMQ ───────────────────────────────────────────────────
# Hérite de production — même image, point d'entrée différent
FROM production AS production-worker

CMD ["node", "dist/worker.js"]
