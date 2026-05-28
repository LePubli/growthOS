# ============================================================
# GrowthOS - Dockerfile Multi-Stage (Coolify Ready)
# Stack: pnpm workspaces + NestJS + Next.js Standalone
# ============================================================
ARG NODE_VERSION=20-alpine
ARG PNPM_VERSION=9.12.0

# ─── STAGE 1: BUILDER ──────────────────────────────────────
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

# 1. Cache layer: workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/plugin-sdk/package.json ./packages/plugin-sdk/

# 2. Install TOUTES les dépendances
RUN pnpm install --frozen-lockfile

# 3. Build
COPY . .
RUN pnpm --filter @growthos/plugin-sdk build || true
RUN pnpm --filter @growthos/api build
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @growthos/web build

# ─── STAGE 2: API RUNNER ──────────────────────────────────
FROM node:${NODE_VERSION} AS api-runner
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

# Deploy prod dependencies (méthode officielle pnpm Docker)
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages/plugin-sdk/package.json ./packages/plugin-sdk/
RUN pnpm deploy --filter=@growthos/api --prod /deployed/api

# Artefacts
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/plugin-sdk/dist ./packages/plugin-sdk/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma

# Déplacer les dépendances déployées
COPY --from=api-runner /deployed/api/node_modules ./node_modules

# Générer Prisma Client en prod
RUN cd apps/api && npx prisma generate

WORKDIR /app
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]

# ─── STAGE 3: WEB RUNNER (Next.js Standalone) ─────────────
FROM node:${NODE_VERSION} AS web-runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]

# ─── STAGE 4: WORKER RUNNER ───────────────────────────────
FROM node:${NODE_VERSION} AS worker-runner
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

# Le worker partage les dépendances de l'API
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages/plugin-sdk/package.json ./packages/plugin-sdk/
RUN pnpm deploy --filter=@growthos/api --prod /deployed/worker

# Artefacts worker
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/plugin-sdk/dist ./packages/plugin-sdk/dist

COPY --from=worker-runner /deployed/worker/node_modules ./node_modules

WORKDIR /app
CMD ["node", "apps/api/dist/worker.js"]
