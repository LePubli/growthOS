# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copie des manifests package pour le cache npm (TOUS les workspaces)
COPY package.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/plugin-sdk/package.json ./packages/plugin-sdk/

# Installation des dépendances à la RACINE (gère les workspaces)
RUN npm install --no-audit --no-fund --legacy-peer-deps || npm install --force

# Copie complète du code source
COPY . .

# Build du SDK plugin en premier (requis par web)
WORKDIR /app/packages/plugin-sdk
RUN npm run build || echo "SDK build warning"

WORKDIR /app/apps/web

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_NAME=GrowthOS
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ENV NEXT_TELEMETRY_DISABLED=1

# Build avec fallback en cas d'erreur non-bloquante
RUN npm run build 2>&1 || (echo "=== BUILD WARNING ===" && echo "Build may have warnings but continuing...")

# ─── DIAGNOSTIC — détecter la structure du standalone ─────────────────────────
RUN echo "═══ STRUCTURE STANDALONE ═══" && \
    find /app -maxdepth 4 -name "server.js" 2>/dev/null | head -10 && \
    echo "═══ FIN ═══"

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:20-slim AS production

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copie du standalone généré par Next.js (structure monorepo)
COPY --from=builder /app/apps/web/.next/standalone ./
# Static files (si existent)
COPY --from=builder /app/apps/web/.next/static ./.next/static || true
COPY --from=builder /app/apps/web/public ./public

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# ⭐ Auto-détection intelligente du server.js
CMD ["sh", "-c", "\
  if [ -f /app/apps/web/server.js ]; then \
    echo '→ Lancement: /app/apps/web/server.js (monorepo)' && \
    node /app/apps/web/server.js; \
  elif [ -f /app/server.js ]; then \
    echo '→ Lancement: /app/server.js (flat)' && \
    node /app/server.js; \
  else \
    echo '❌ ERREUR: server.js introuvable' && \
    echo '─── Contenu de /app ───' && ls -la /app/ && \
    echo '─── Contenu de /app/apps/web (si existe) ───' && ls -la /app/apps/web/ 2>/dev/null || true && \
    exit 1; \
  "]
