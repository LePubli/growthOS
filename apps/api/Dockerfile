# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
# Debian slim au lieu d'Alpine : Prisma fonctionne nativement sans hack OpenSSL/musl
FROM node:20-slim AS builder

WORKDIR /app

# Dépendances système pour Prisma + node-gyp (bcrypt, sharp, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 1. Manifests d'abord (cache Docker layer)
COPY package.json ./
COPY apps/api/package.json ./apps/api/

# 2. Packages locaux partagés
COPY packages/ ./packages/

# 3. Code source COMPLET de l'API (INCLUT prisma/schema.prisma)
# CRITIQUE : doit être fait AVANT prisma generate
COPY apps/api/ ./apps/api/

# 4. Installation des dépendances (toutes, dev incluses pour le build)
WORKDIR /app/apps/api
RUN npm install --no-audit --no-fund --legacy-peer-deps

# 5. Génération client Prisma (schema.prisma est maintenant là)
RUN npx prisma generate

# 6. Compilation TypeScript
RUN npm run build

# 7. Prune des dev deps après le build
RUN npm prune --omit=dev

# ─── Stage 2: Production (API server) ─────────────────────────────────────────
FROM node:20-slim AS production

WORKDIR /app

# OpenSSL requis au runtime pour le client Prisma
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copier les artefacts depuis builder — PAS de npm install ici
COPY --from=builder /app/apps/api/dist            ./apps/api/dist
COPY --from=builder /app/apps/api/node_modules    ./apps/api/node_modules
COPY --from=builder /app/apps/api/package.json    ./apps/api/package.json
COPY --from=builder /app/apps/api/prisma          ./apps/api/prisma
COPY --from=builder /app/packages                 ./packages

WORKDIR /app/apps/api

EXPOSE 3001

CMD ["node", "dist/main.js"]

# ─── Stage 3: Worker BullMQ ───────────────────────────────────────────────────
FROM production AS production-worker

CMD ["node", "dist/worker.js"]
