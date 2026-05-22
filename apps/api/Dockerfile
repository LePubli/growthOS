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

# 4. Auto-patch binaryTargets Prisma (idempotent)
RUN if ! grep -q "binaryTargets" /app/apps/api/prisma/schema.prisma; then \
      sed -i '/generator client {/a\  binaryTargets = ["native", "debian-openssl-3.0.x"]' /app/apps/api/prisma/schema.prisma; \
      echo "✓ binaryTargets injecté"; \
    fi

# 5. Install
WORKDIR /app/apps/api
RUN npm install --no-audit --no-fund --legacy-peer-deps 2>&1 | tail -20

# 6. ⭐ DIAGNOSTIC PRISMA — affiche TOUT avant le generate
RUN echo "═══════════════════════════════════════════════════════" && \
    echo "📦 Versions installées :" && \
    node --version && \
    npm --version && \
    echo "─── Prisma :" && \
    (ls -la node_modules/.bin/prisma 2>/dev/null || echo "❌ prisma binary absent du node_modules") && \
    (ls -la node_modules/prisma/package.json 2>/dev/null && cat node_modules/prisma/package.json | grep version || echo "❌ prisma package absent") && \
    (ls -la node_modules/@prisma/client/package.json 2>/dev/null && cat node_modules/@prisma/client/package.json | grep version || echo "❌ @prisma/client absent") && \
    echo "═══════════════════════════════════════════════════════" && \
    echo "📄 schema.prisma (50 premières lignes) :" && \
    head -50 prisma/schema.prisma && \
    echo "═══════════════════════════════════════════════════════"

# 7. Force install prisma globalement comme filet de sécurité
RUN npm install -g prisma@5.22.0 tsx --no-audit --no-fund 2>&1 | tail -10

# 8. Prisma generate avec output verbose
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=public"
ENV DEBUG="prisma:*"
RUN prisma generate --schema=/app/apps/api/prisma/schema.prisma 2>&1 | tee /tmp/prisma-gen.log; \
    EXIT_CODE=$?; \
    if [ $EXIT_CODE -ne 0 ]; then \
      echo "═══════════════════════════════════════════════════════"; \
      echo "❌ PRISMA GENERATE ÉCHEC — LOG COMPLET :"; \
      echo "═══════════════════════════════════════════════════════"; \
      cat /tmp/prisma-gen.log; \
      echo "═══════════════════════════════════════════════════════"; \
      exit $EXIT_CODE; \
    fi

# 9. Désactive DEBUG pour la suite
ENV DEBUG=""

# 10. Build TypeScript
RUN npm run build 2>&1 | tail -50

# 11. Prune dev deps
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
