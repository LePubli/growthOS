# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app
# Forcer bash comme shell (évite les bugs /bin/sh avec pipefail, PIPESTATUS etc.)
SHELL ["/bin/bash", "-c"]
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
# 4. Diagnostic système
RUN echo "Node: $(node -v) | npm: $(npm -v) | OpenSSL: $(openssl version) | Arch: $(uname -m)"
# 5. Force binaryTargets si absent
RUN grep -q "binaryTargets" /app/apps/api/prisma/schema.prisma || \
    sed -i '/generator client {/a\  binaryTargets = ["native", "debian-openssl-3.0.x"]' /app/apps/api/prisma/schema.prisma
# 6. Install des dépendances
WORKDIR /app/apps/api
RUN npm install --no-audit --no-fund --legacy-peer-deps 2>&1 | tail -5
# 7. Force versions identiques prisma 5.22 + @prisma/client 5.22
RUN npm install prisma@5.22.0 @prisma/client@5.22.0 \
    --no-audit --no-fund --legacy-peer-deps --save-exact 2>&1 | tail -3
# 8. Vérification que le binaire prisma existe
RUN echo "Prisma binary: $(node_modules/.bin/prisma --version 2>&1)"
# 9. Prisma generate — BASH + pipefail pour capturer l'erreur
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=public"
RUN set -o pipefail; \
    node_modules/.bin/prisma generate \
      --schema=/app/apps/api/prisma/schema.prisma 2>&1 | cat; \
    echo "EXIT:${PIPESTATUS[0]}"
# 10. Vérification que le client généré existe
RUN ls -la node_modules/.prisma/client/ | head -5 && echo "✓ Prisma client généré"
# 11. tsx pour le seed + build TS
RUN npm install -g tsx@4.19.2
RUN npm run build 2>&1 | tail -30
# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:20-slim AS production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
# Copie depuis builder - structure complète préservée
COPY --from=builder /app/apps/api/dist         ./apps/api/dist
COPY --from=builder /app/node_modules          ./node_modules
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/prisma       ./apps/api/prisma
COPY --from=builder /app/packages              ./packages
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/main.js"]
# ─── Stage 3: Worker ──────────────────────────────────────────────────────────
FROM production AS production-worker
CMD ["node", "dist/worker.js"]
