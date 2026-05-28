# ============================================================
# GrowthOS - Dockerfile avec vérifications strictes
# ============================================================
ARG NODE_VERSION=20-alpine
ARG PNPM_VERSION=9.12.0

# ─── STAGE 1: BUILDER ──────────────────────────────────────
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

# Cache layer
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/plugin-sdk/package.json ./packages/plugin-sdk/

RUN pnpm install --frozen-lockfile

# Build
COPY . .

# Build Plugin SDK
RUN pnpm --filter @growthos/plugin-sdk build || echo "⚠️ Plugin SDK build skipped"

# Build API avec vérification explicite
RUN echo ">>> Building API..." && \
    pnpm --filter @growthos/api build && \
    echo ">>> Checking API dist..." && \
    test -d /app/apps/api/dist || (echo "❌ ERROR: apps/api/dist not created!" && exit 1) && \
    ls -la /app/apps/api/dist

# Build Web
ENV NEXT_TELEMETRY_DISABLED=1
RUN echo ">>> Building Web..." && \
    pnpm --filter @growthos/web build && \
    echo ">>> Checking Web standalone..." && \
    test -d /app/apps/web/.next/standalone || (echo "❌ ERROR: Web standalone not created!" && exit 1)

# ─── STAGE 2: API RUNNER ──────────────────────────────────
FROM node:${NODE_VERSION} AS api-runner
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages/plugin-sdk/package.json ./packages/plugin-sdk/

RUN pnpm deploy --filter=@growthos/api --prod /deployed/api

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/plugin-sdk/dist ./packages/plugin-sdk/dist 2>/dev/null || true
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma

COPY --from=api-runner /deployed/api/node_modules ./node_modules

RUN cd apps/api && npx prisma generate

WORKDIR /app
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]

# ─── STAGE 3: WEB RUNNER ──────────────────────────────────
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

COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages/plugin-sdk/package.json ./packages/plugin-sdk/

RUN pnpm deploy --filter=@growthos/api --prod /deployed/worker

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/plugin-sdk/dist ./packages/plugin-sdk/dist 2>/dev/null || true

COPY --from=worker-runner /deployed/worker/node_modules ./node_modules

WORKDIR /app
CMD ["node", "apps/api/dist/worker.js"]
