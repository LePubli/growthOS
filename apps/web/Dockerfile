# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++ curl

# Manifests — racine + web (contexte = racine du monorepo)
COPY package.json ./
COPY apps/web/package.json ./apps/web/

# Packages locaux partagés
COPY packages/ ./packages/

# Installation des dépendances depuis le dossier web
WORKDIR /app/apps/web
RUN npm install --no-audit --no-fund --legacy-peer-deps

# Code source complet du frontend
WORKDIR /app
COPY apps/web/ ./apps/web/

# Variables de build injectées (NEXT_PUBLIC_* doivent être connues au build)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_NAME=GrowthOS
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME

# Build Next.js — output standalone (requis pour le stage production)
WORKDIR /app/apps/web
RUN npm run build

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache curl

# Standalone output: tout ce qu'il faut pour faire tourner Next.js
# (node_modules minimalistes inclus par Next dans .next/standalone)
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static     ./.next/static
COPY --from=builder /app/apps/web/public           ./public

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# server.js est généré par Next.js output: standalone à la racine du standalone/
CMD ["node", "server.js"]
