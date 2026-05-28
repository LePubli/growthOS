# ============================================================
# GrowthOS Dockerfile - Multi-stage Build Optimisé
# ============================================================
# Sécurité: utilisateur non-root, couches minimales
# Performance: cache npm optimisé, Prisma pré-généré

# ── Arguments de build (injectés par Coolify) ────────────────────
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_NAME=GrowthOS

# ── Stage 1: Dependencies ────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copie des manifests package
COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
COPY packages/plugin-sdk/package.json ./packages/plugin-sdk/

# Installation des dépendances avec cleanup
RUN npm ci --ignore-scripts || npm install --ignore-scripts || true

# ── Stage 2: Builder ─────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copie des dépendances
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/plugin-sdk/node_modules ./packages/plugin-sdk/node_modules || true

# Copie complète du code source
COPY . .

# Build du SDK plugin en premier
RUN cd packages/plugin-sdk && npm run build || echo "SDK build skipped"

# Génération de Prisma Client
RUN cd apps/api && npx prisma generate --schema=./prisma/schema.prisma || true

# Build de l'application Next.js avec variables d'environnement
WORKDIR /app/apps/web
ENV NEXT_TELEMETRY_DISABLED 1
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:4000}
ENV NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME:-GrowthOS}
RUN npm run build

# ── Stage 3: Runner (Production) ─────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache curl

WORKDIR /app

# Création d'un utilisateur non-root pour la sécurité
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copie des fichiers nécessaires
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
