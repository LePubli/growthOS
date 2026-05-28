# ============================================================
# GrowthOS Dockerfile - Multi-stage Build Optimisé
# ============================================================
# Sécurité: utilisateur non-root, couches minimales
# Performance: cache npm optimisé, Prisma pré-généré

# ── Stage 1: Dependencies ────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copie des manifests package
COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
COPY packages/*/package.json ./packages/

# Installation des dépendances
RUN npm ci --ignore-scripts

# ── Stage 2: Builder ─────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copie des dépendances
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Génération de Prisma Client
RUN npx prisma generate --schema=./apps/api/prisma/schema.prisma

# Build de l'application Next.js
WORKDIR /app/apps/web
ENV NEXT_TELEMETRY_DISABLED 1
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
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copie du dossier plugins (monté en volume en prod)
COPY --from=builder /app/apps/web/src/plugins ./apps/web/src/plugins

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
