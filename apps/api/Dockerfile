# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates python3 make g++ curl \
    && rm -rf /var/lib/apt/lists/*

# 1. Manifests
COPY package.json ./
COPY apps/api/package.json ./apps/api/

# 2. Packages locaux
COPY packages/ ./packages/

# 3. Code source COMPLET
COPY apps/api/ ./apps/api/

# 4. Auto-patch binaryTargets si absent
RUN if ! grep -q "binaryTargets" /app/apps/api/prisma/schema.prisma; then \
      sed -i '/generator client {/a\  binaryTargets = ["native", "debian-openssl-3.0.x"]' /app/apps/api/prisma/schema.prisma; \
    fi

# 5. Install
WORKDIR /app/apps/api
RUN npm install --no-audit --no-fund --legacy-peer-deps 2>&1 | tail -10

# 6. ⭐ FORCE versions identiques prisma + @prisma/client (root cause du bug)
RUN npm install prisma@5.22.0 @prisma/client@5.22.0 --no-audit --no-fund --legacy-peer-deps --save-exact

# 7. Generate Prisma client
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=public"
RUN npx prisma generate --schema=/app/apps/api/prisma/schema.prisma

# 8. ⭐ VÉRIFICATION que le client est vraiment initialisé
RUN node -e "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); console.log('✓ Prisma client OK:', typeof p);" && \
    echo "✓ Prisma client validé"

# 9. Installer tsx pour le seed
RUN npm install -g tsx@4.19.2

# 10. Build TypeScript
RUN npm run build 2>&1 | tail -50

# ─── Stage 2: Production (API server) ─────────────────────────────────────────
FROM node:20-slim AS production

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# Copier les artefacts du builder (avec node_modules COMPLET incluant Prisma client généré)
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
