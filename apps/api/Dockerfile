# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates python3 make g++ curl \
    && rm -rf /var/lib/apt/lists/*

# 1. Manifests
COPY package.json ./
COPY apps/api/package.json ./apps/api/

# 2. Packages partagés
COPY packages/ ./packages/

# 3. Code source COMPLET API
COPY apps/api/ ./apps/api/

# 4. Auto-patch binaryTargets Prisma si absent
RUN if ! grep -q "binaryTargets" /app/apps/api/prisma/schema.prisma; then \
      sed -i '/generator client {/a\  binaryTargets = ["native", "debian-openssl-3.0.x", "linux-musl-openssl-3.0.x"]' /app/apps/api/prisma/schema.prisma; \
    fi

# 5. Installation deps
WORKDIR /app/apps/api
RUN npm install --no-audit --no-fund --legacy-peer-deps

# 6. ⭐ Installer tsx globalement (pour le seed — bypass les erreurs tsconfig)
RUN npm install -g tsx prisma

# 7. Generate Prisma client
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=public"
RUN npx prisma generate

# 8. Build TypeScript
RUN npm run build

# 9. Prune dev deps
RUN npm prune --omit=dev

# ─── Stage 2: Production (API server) ─────────────────────────────────────────
FROM node:20-slim AS production

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

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
