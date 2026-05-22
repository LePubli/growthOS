# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 1. Manifests
COPY package.json ./
COPY apps/web/package.json ./apps/web/

# 2. Packages locaux partagés
COPY packages/ ./packages/

# 3. Code source COMPLET du frontend
COPY apps/web/ ./apps/web/

# 4. Installation
WORKDIR /app/apps/web
RUN npm install --no-audit --no-fund --legacy-peer-deps

# 5. Variables de build NEXT_PUBLIC_* (injectées par docker-compose build args)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_NAME=GrowthOS
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME

# Désactive la télémétrie Next.js au build
ENV NEXT_TELEMETRY_DISABLED=1

# 6. Build Next.js (output: 'standalone' requis dans next.config.js)
RUN npm run build

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:20-slim AS production

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Standalone output Next.js
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static     ./apps/web/.next/static
COPY --from=builder /app/apps/web/public           ./apps/web/public

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# server.js généré par Next.js standalone, placé à apps/web/server.js
CMD ["node", "apps/web/server.js"]
