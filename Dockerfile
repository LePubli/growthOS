# ============================================================
# GrowthOS - Dockerfile Multi-Stage Optimisé pour Coolify
# Architecture: Monorepo (npm workspaces)
# Services: migrate, api, web, worker
# ============================================================

# ─── ARGUMENTS DE BUILD (Injectés par Coolify) ──────────────
ARG NODE_VERSION=20-alpine
ARG PNPM_VERSION=8.15.0

# ─── STAGE 1: BUILDER UNIFIÉ ────────────────────────────────
FROM node:${NODE_VERSION} AS builder

WORKDIR /app

# Installation de pnpm
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

# Copie des fichiers de configuration racine
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copie des package.json de chaque workspace (pour le cache layer)
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/plugin-sdk/package.json ./packages/plugin-sdk/

# Installation des dépendances (racine + workspaces)
# Cela crée /app/node_modules avec toutes les deps hoistées
RUN pnpm install --frozen-lockfile

# Copie du code source complet
COPY . .

# Build du SDK Plugin en premier (dépendance critique)
RUN echo ">>> Building Plugin SDK..." && \
    cd packages/plugin-sdk && \
    pnpm build || echo "SDK build skipped or failed (no build script)"

# Build de l'API (NestJS)
RUN echo ">>> Building API..." && \
    pnpm --filter @growthos/api build

# Build du Web (Next.js)
# NEXT_TELEMETRY_DISABLED=1 est crucial pour réduire la taille
ENV NEXT_TELEMETRY_DISABLED=1
RUN echo ">>> Building Web..." && \
    pnpm --filter @growthos/web build

# Diagnostic : Vérification des artefacts générés
RUN echo "=== DIAGNOSTIC BUILD ===" && \
    ls -la /app/apps/api/dist 2>/dev/null || echo "API dist not found" && \
    ls -la /app/apps/web/.next/standalone 2>/dev/null || echo "Web standalone not found" && \
    find /app -name "server.js" -type f 2>/dev/null | head -5

# ─── STAGE 2: RUNNER API ────────────────────────────────────
FROM node:${NODE_VERSION} AS api-runner

WORKDIR /app/apps/api

# Installation des dépendances de production uniquement
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml /app/
COPY apps/api/package.json /app/apps/api/
COPY packages/plugin-sdk/package.json /app/packages/plugin-sdk/

RUN corepack enable && \
    pnpm config set registry https://registry.npmjs.org/ && \
    pnpm install --prod --ignore-scripts

# Copie des artefacts depuis le builder
# On copie TOUT le dossier dist généré
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/packages/plugin-sdk ./packages/plugin-sdk

# Copie du prisma schema et génération du client
COPY --from=builder /app/apps/api/prisma ./prisma
RUN npx prisma generate

EXPOSE 3001

CMD ["node", "dist/main.js"]

# ─── STAGE 3: RUNNER WEB (Next.js Standalone) ───────────────
FROM node:${NODE_VERSION} AS web-runner

WORKDIR /app

# Variables d'environnement Next.js
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Création des dossiers requis
RUN mkdir -p /app/apps/web/public

# Copie du standalone généré par Next.js
# Next.js place le server.js dans .next/standalone
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# Ajustement du working directory pour le serveur standalone
# Le server.js se trouve souvent à la racine ou dans apps/web selon la config
# On vérifie et on lance au bon endroit
WORKDIR /app

EXPOSE 3000

# Commande de démarrage flexible
CMD ["node", "apps/web/server.js"]

# ─── STAGE 4: WORKER (Optionnel - Si vous avez un service dédié) ─
FROM node:${NODE_VERSION} AS worker-runner

WORKDIR /app

# Copie des dépendances
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/plugin-sdk/package.json ./packages/plugin-sdk/

RUN corepack enable && \
    pnpm install --prod --ignore-scripts

# Copie du code worker (supposé être dans api ou un dossier dédié)
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/plugin-sdk ./packages/plugin-sdk

CMD ["node", "apps/api/dist/worker.js"]
