# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Outils natifs (bcrypt, sharp, node-gyp)
RUN apk add --no-cache python3 make g++ curl

# Copie des fichiers de configuration racine pour les workspaces
COPY package.json ./
COPY package-lock.json ./
COPY turbo.json ./

# Copie des package.json de tous les apps et packages
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/sdk/package.json ./packages/sdk/

# Installation TOUTES les deps depuis la racine (workspaces)
RUN npm install --no-audit --no-fund --legacy-peer-deps

# Code source complet
COPY apps/api/ ./apps/api/
COPY packages/ ./packages/

# Génération client Prisma + compilation TS avec NestJS CLI
WORKDIR /app/apps/api
RUN npx prisma generate

# Compilation avec NestJS CLI — compile main.ts par défaut
RUN npx nest build

# Compilation manuelle de worker.ts (nest build ne gère pas multi-entry correctement)
RUN npx tsc -p tsconfig.json --outDir dist-worker --rootDir ./src && \
    mkdir -p dist && cp dist-worker/worker.js dist/worker.js && rm -rf dist-worker

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
