# ============================================================
# Stage 1 — Build
# ============================================================
# node:24-slim matches the Replit environment (Node 24, Debian glibc).
# Do NOT use node:24-alpine: it uses musl which is excluded by
# pnpm-workspace.yaml overrides for rollup/@tailwindcss/oxide/lightningcss.
FROM node:24-slim AS builder

# Install pnpm — exact version matching pnpm-lock.yaml (lockfileVersion 9.0)
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

WORKDIR /app

# ── Workspace manifests (cache layer) ────────────────────────
# ALL packages listed under packages: in pnpm-workspace.yaml must be copied.
# pnpm --frozen-lockfile validates every importer in pnpm-lock.yaml;
# a missing package.json causes workspace resolution failure.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

COPY artifacts/growthos/package.json       ./artifacts/growthos/package.json
COPY artifacts/api-server/package.json     ./artifacts/api-server/package.json
COPY artifacts/mockup-sandbox/package.json ./artifacts/mockup-sandbox/package.json
COPY lib/api-client-react/package.json     ./lib/api-client-react/package.json
COPY lib/api-spec/package.json             ./lib/api-spec/package.json
COPY lib/api-zod/package.json              ./lib/api-zod/package.json
COPY lib/db/package.json                   ./lib/db/package.json
COPY scripts/package.json                  ./scripts/package.json

# Install with --frozen-lockfile: uses the lockfile exactly, bypasses
# minimumReleaseAge (applies only during resolution, not frozen installs).
RUN pnpm install --frozen-lockfile

# ── Full source copy ─────────────────────────────────────────
COPY lib/              ./lib/
COPY artifacts/growthos/ ./artifacts/growthos/

# ── Build arguments (set in Coolify → Build Variables) ───────
# VITE_API_URL : URL of your NestJS backend, e.g. https://api.yourdomain.com
# BASE_PATH    : URL prefix where the app is served (default /)
ARG VITE_API_URL=""
ARG BASE_PATH="/"

# ── Diagnostics — confirm env and binaries before build ──────
# pnpm installs vite inside each workspace package's own node_modules/.bin,
# not at the root level. Check the correct path.
RUN node --version && \
    pnpm --version && \
    echo "BASE_PATH=${BASE_PATH:-/}" && \
    echo "VITE_API_URL=${VITE_API_URL}" && \
    ls /app/artifacts/growthos/node_modules/.bin/vite && \
    echo "vite binary found OK" && \
    ls /app/artifacts/growthos/src/ | head -5

# ── Vite production build ─────────────────────────────────────
# Call vite directly using the package-local binary (pnpm installs per-package,
# not hoisted to root). Using the absolute path avoids relying on pnpm's
# PATH injection when running scripts from a subdirectory.
WORKDIR /app/artifacts/growthos
RUN PORT=3000 \
    BASE_PATH="${BASE_PATH:-/}" \
    VITE_API_URL="${VITE_API_URL}" \
    NODE_ENV=production \
    ./node_modules/.bin/vite build --config vite.config.ts

# ============================================================
# Stage 2 — Serve with nginx (Alpine for small final image)
# ============================================================
FROM nginx:1.27-alpine AS runner

RUN rm -rf /etc/nginx/conf.d/default.conf

COPY docker/nginx.conf /etc/nginx/conf.d/growthos.conf

COPY --from=builder /app/artifacts/growthos/dist/public /usr/share/nginx/html

COPY docker/entrypoint.sh /docker-entrypoint.d/40-inject-env.sh
RUN chmod +x /docker-entrypoint.d/40-inject-env.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1
