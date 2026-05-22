# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Deps système + outils de debug
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    python3 \
    make \
    g++ \
    curl \
    procps \
    && rm -rf /var/lib/apt/lists/*

# ─── 1. Manifests ─────────────────────────────────────────────────────────────
COPY package.json ./
COPY apps/api/package.json ./apps/api/

# ─── 2. Packages locaux partagés ──────────────────────────────────────────────
COPY packages/ ./packages/

# ─── 3. Code source COMPLET de l'API ──────────────────────────────────────────
COPY apps/api/ ./apps/api/

# ─── 4. DIAGNOSTIC — voir ce qu'on a copié ────────────────────────────────────
RUN echo "═══════════════════════════════════════════════════════" && \
    echo "📁 Arborescence /app/apps/api :" && \
    ls -la /app/apps/api/ && \
    echo "═══════════════════════════════════════════════════════" && \
    echo "📁 Dossier prisma :" && \
    ls -la /app/apps/api/prisma/ && \
    echo "═══════════════════════════════════════════════════════" && \
    echo "📄 schema.prisma (bloc generator+datasource) :" && \
    head -30 /app/apps/api/prisma/schema.prisma && \
    echo "═══════════════════════════════════════════════════════" && \
    echo "📦 dependencies dans apps/api/package.json :" && \
    grep -A 1 '"prisma"\|"@prisma/client"' /app/apps/api/package.json || echo "❌ AUCUN prisma trouvé dans package.json" && \
    echo "═══════════════════════════════════════════════════════"

# ─── 5. Auto-patch binaryTargets si absent (compatibilité Debian/Alpine) ──────
RUN if ! grep -q "binaryTargets" /app/apps/api/prisma/schema.prisma; then \
      echo "⚠️  binaryTargets absent — injection automatique..." && \
      sed -i '/generator client {/a\  binaryTargets = ["native", "debian-openssl-3.0.x", "linux-musl-openssl-3.0.x"]' /app/apps/api/prisma/schema.prisma && \
      echo "✓ binaryTargets injecté :" && \
      head -10 /app/apps/api/prisma/schema.prisma; \
    else \
      echo "✓ binaryTargets déjà présent"; \
    fi

# ─── 6. Installation des dépendances ─────────────────────────────────────────
WORKDIR /app/apps/api
RUN npm install --no-audit --no-fund --legacy-peer-deps 2>&1 | tail -50

# ─── 7. Installation prisma CLI globalement (filet de sécurité) ───────────────
# Si prisma n'est pas dans devDependencies de l'api, npx tenterait de le DL à
# l'exécution depuis npm registry — ce qui échoue en BuildKit isolé.
RUN npm install -g prisma@latest --no-audit --no-fund

# ─── 8. Vérifier que prisma est trouvable ─────────────────────────────────────
RUN which prisma && prisma --version

# ─── 9. Génération client Prisma — VERBOSE pour voir l'erreur exacte ─────────
# DATABASE_URL dummy : Prisma 5+ exige une URL pour `generate` dans certains cas
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=public"
RUN DEBUG="prisma:*" prisma generate --schema=/app/apps/api/prisma/schema.prisma 2>&1 | tee /tmp/prisma.log || \
    (echo "═══ ÉCHEC PRISMA GENERATE ═══" && cat /tmp/prisma.log && exit 1)

# ─── 10. Compilation TypeScript ───────────────────────────────────────────────
RUN npm run build 2>&1 | tail -100

# ─── 11. Prune des dev deps ───────────────────────────────────────────────────
RUN npm prune --omit=dev

# ─── Stage 2: Production (API server) ─────────────────────────────────────────
FROM node:20-slim AS production

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    curl \
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
