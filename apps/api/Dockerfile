# ── Stage 1: Builder ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

ENV NODE_OPTIONS="--max-old-space-size=4096"

RUN apk add --no-cache python3 make g++

# Copier le package.json racine pour les workspaces
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/*/package*.json ./packages/ 2>/dev/null || true

# Installation depuis la racine avec workspaces
# Copier UNIQUEMENT les fichiers de ce service
COPY package.json ./

# Installer sans workspace (pas de workspaces dans ce package.json)
RUN npm install --no-audit --no-fund --legacy-peer-deps

# Copier tout le code
COPY . .

# Générer Prisma et build spécifique à l'API
WORKDIR /app/apps/api
RUN npx prisma generate
RUN npm run build

# ── Stage 2: Production ────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app/apps/api

ENV NODE_ENV=production

RUN apk add --no-cache dumb-init curl

# Copier package.json racine et apps/api pour les deps de prod
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/*/package*.json ./packages/ 2>/dev/null || true

RUN npm install --no-audit --no-fund --omit=dev --legacy-peer-deps && npm cache clean --force
COPY package.json ./
RUN npm install --no-audit --no-fund --legacy-peer-deps --omit=dev && npm cache clean --force

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY apps/api/prisma ./prisma
COPY prisma ./prisma

RUN mkdir -p /app/plugins /app/logs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD curl -f http://localhost:3001/api/v1/health || exit 1

USER node

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]
