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

# 4. ─── DIAGNOSTIC AVANT INSTALL ─────────────────────────────────────────────
RUN echo "" && \
    echo "════════════════════════ DIAG ENV ════════════════════════" && \
    echo "Node : $(node --version)" && \
    echo "npm  : $(npm --version)" && \
    echo "OpenSSL : $(openssl version)" && \
    echo "Arch : $(uname -m)" && \
    echo "OS   : $(cat /etc/os-release | grep PRETTY_NAME)" && \
    echo "" && \
    echo "════════════════════ schema.prisma ════════════════════" && \
    head -30 /app/apps/api/prisma/schema.prisma && \
    echo "" && \
    echo "════════════════════ package.json (deps Prisma) ═══════" && \
    grep -E '"(prisma|@prisma)' /app/apps/api/package.json || echo "❌ Aucune dep prisma dans package.json" && \
    echo "════════════════════════════════════════════════════════"

# 5. Force binaryTargets DEBIAN si absent (sans le linux-musl qui pose pb)
RUN if ! grep -q "binaryTargets" /app/apps/api/prisma/schema.prisma; then \
      sed -i '/generator client {/a\  binaryTargets = ["native", "debian-openssl-3.0.x"]' /app/apps/api/prisma/schema.prisma; \
      echo "✓ binaryTargets injecté"; \
    fi

# 6. Install
WORKDIR /app/apps/api
RUN npm install --no-audit --no-fund --legacy-peer-deps 2>&1 | tail -10

# 7. Force versions exactes prisma + @prisma/client en 5.22.0
RUN npm install prisma@5.22.0 @prisma/client@5.22.0 --no-audit --no-fund --legacy-peer-deps --save-exact 2>&1 | tail -5

# 8. ─── DIAG APRÈS INSTALL ───────────────────────────────────────────────────
RUN echo "" && \
    echo "════════════════════ POST INSTALL ════════════════════" && \
    echo "prisma binary : $(ls -la node_modules/.bin/prisma 2>&1 || echo ABSENT)" && \
    echo "prisma version : $(node_modules/.bin/prisma --version 2>&1 || echo ÉCHEC)" && \
    echo "@prisma/client : $(cat node_modules/@prisma/client/package.json 2>/dev/null | grep version | head -1 || echo ABSENT)" && \
    echo "════════════════════════════════════════════════════════"

# 9. ⭐ PRISMA GENERATE — log forcé dans le build, exit code préservé
#    Le trick : on redirige TOUT vers stdout (build log), même les erreurs,
#    et on garde l'exit code via PIPESTATUS
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=public"
ENV DEBUG="prisma:engine,prisma:client,prisma:cli"
RUN set -o pipefail; \
    echo "════════════════════ PRISMA GENERATE START ════════════════════"; \
    node_modules/.bin/prisma generate --schema=/app/apps/api/prisma/schema.prisma 2>&1 | tee /tmp/prisma.log; \
    PRISMA_EXIT=${PIPESTATUS[0]}; \
    echo "════════════════════ PRISMA EXIT CODE: $PRISMA_EXIT ════════════════════"; \
    if [ $PRISMA_EXIT -ne 0 ]; then \
      echo ""; \
      echo "══════════════════════════════════════════════════════════════"; \
      echo "❌❌❌ PRISMA GENERATE A ÉCHOUÉ ❌❌❌"; \
      echo "Voir ci-dessus pour le message d'erreur exact."; \
      echo "══════════════════════════════════════════════════════════════"; \
      exit $PRISMA_EXIT; \
    fi; \
    echo "✓✓✓ PRISMA GENERATE RÉUSSI ✓✓✓"

# 10. Vérification que le client peut être chargé
RUN node -e "try { const { PrismaClient } = require('@prisma/client'); new PrismaClient(); console.log('✓ PrismaClient peut être instancié'); } catch(e) { console.error('❌ ERREUR:', e.message); process.exit(1); }"

ENV DEBUG=""

# 11. Installer tsx pour le seed
RUN npm install -g tsx@4.19.2

# 12. Build TypeScript
RUN npm run build 2>&1 | tail -50

# ─── Stage 2: Production ──────────────────────────────────────────────────────
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

# ─── Stage 3: Worker ──────────────────────────────────────────────────────────
FROM production AS production-worker

CMD ["node", "dist/worker.js"]
