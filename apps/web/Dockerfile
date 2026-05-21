FROM node:20-alpine AS builder

WORKDIR /app

ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_APP_NAME=GrowthOS

ENV NODE_OPTIONS="--max-old-space-size=4096" \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache python3 make g++

# Copier le package.json racine pour les workspaces
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY packages/*/package*.json ./packages/ 2>/dev/null || true

# Installation depuis la racine avec workspaces
RUN npm install --no-audit --no-fund --legacy-peer-deps

# Copier tout le code
COPY . .

# Build spécifique au web
WORKDIR /app/apps/web
RUN npm run build

# ── Production ─────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache dumb-init curl

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000 || exit 1

USER node

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
