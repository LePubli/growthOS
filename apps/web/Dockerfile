# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

WORKDIR /app/apps/web
RUN npm install --no-audit --no-fund --legacy-peer-deps

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_NAME=GrowthOS
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ─── DIAGNOSTIC — détecter la structure du standalone ─────────────────────────
RUN echo "═══ STRUCTURE STANDALONE ═══" && \
    find /app/apps/web/.next/standalone -maxdepth 3 -name "server.js" 2>/dev/null && \
    echo "═══ FIN ═══"

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:20-slim AS production

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copie complète du standalone — peu importe la structure interne
COPY --from=builder /app/apps/web/.next/standalone ./
# Static + public : copier aux deux endroits possibles pour gérer les 2 structures
COPY --from=builder /app/apps/web/.next/static     ./apps/web/.next/static
COPY --from=builder /app/apps/web/.next/static     ./.next/static
COPY --from=builder /app/apps/web/public           ./apps/web/public
COPY --from=builder /app/apps/web/public           ./public

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# ⭐ Auto-détection : server.js peut être à 2 endroits selon outputFileTracingRoot
CMD ["sh", "-c", "\
  if [ -f /app/apps/web/server.js ]; then \
    echo '→ Lancement: /app/apps/web/server.js (monorepo standalone)' && \
    node /app/apps/web/server.js; \
  elif [ -f /app/server.js ]; then \
    echo '→ Lancement: /app/server.js (flat standalone)' && \
    node /app/server.js; \
  else \
    echo '❌ ERREUR: server.js introuvable. Contenu de /app :' && \
    ls -la /app/ && \
    echo '─── /app/apps/web (si existe) ───' && \
    ls -la /app/apps/web/ 2>/dev/null || echo 'inexistant' && \
    exit 1; \
  fi"]
