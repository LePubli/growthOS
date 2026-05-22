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

# ─── DIAGNOSTIC — voir ce qu'on a copié ───────────────────────────────────────
RUN echo "═══════════════════════════════════════════════════════" && \
    echo "📁 Arborescence /app/apps/web :" && \
    ls -la /app/apps/web/ && \
    echo "═══════════════════════════════════════════════════════" && \
    echo "📄 next.config.* :" && \
    (ls /app/apps/web/next.config.* 2>/dev/null && cat /app/apps/web/next.config.*) || echo "❌ AUCUN next.config trouvé" && \
    echo "═══════════════════════════════════════════════════════" && \
    echo "📦 Imports @growthos/* dans le code source :" && \
    grep -r "@growthos" /app/apps/web/src/ 2>/dev/null | head -20 || echo "✓ Pas d'import @growthos" && \
    echo "═══════════════════════════════════════════════════════"

# 4. Installation
WORKDIR /app/apps/web
RUN npm install --no-audit --no-fund --legacy-peer-deps 2>&1 | tail -30

# 5. Variables de build NEXT_PUBLIC_*
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_NAME=GrowthOS
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ENV NEXT_TELEMETRY_DISABLED=1

# 6. Build Next.js — VERBOSE pour voir l'erreur exacte
# Si ça plante, on dump le log complet
RUN npm run build 2>&1 | tee /tmp/build.log || \
    (echo "═════ ÉCHEC NEXT BUILD — LOG COMPLET ═════" && \
     cat /tmp/build.log && \
     echo "═════ FIN LOG ═════" && \
     exit 1)

# Vérification que le standalone a bien été généré
RUN ls -la /app/apps/web/.next/standalone/ || \
    (echo "❌ .next/standalone introuvable — output: 'standalone' manquant dans next.config.js" && exit 1)

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

CMD ["node", "apps/web/server.js"]
