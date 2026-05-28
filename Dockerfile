# ============================================================
# Stage 1 — Build
# ============================================================
# node:22-slim uses glibc (Debian Bookworm), matching the Replit environment.
# node:22-alpine uses musl which is excluded by the pnpm-workspace.yaml
# overrides for rollup, @tailwindcss/oxide, lightningcss native binaries.
FROM node:22-slim AS builder

# Install pnpm — exact version matching pnpm-lock.yaml (lockfileVersion 9.0)
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

WORKDIR /app

# ── Workspace manifests (cache layer) ────────────────────────
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy ALL workspace package.json so pnpm can resolve the full lockfile
COPY lib/api-client-react/package.json     ./lib/api-client-react/package.json
COPY lib/api-spec/package.json             ./lib/api-spec/package.json
COPY lib/api-zod/package.json              ./lib/api-zod/package.json
COPY lib/db/package.json                   ./lib/db/package.json
COPY artifacts/growthos/package.json       ./artifacts/growthos/package.json
COPY artifacts/api-server/package.json     ./artifacts/api-server/package.json
COPY artifacts/mockup-sandbox/package.json ./artifacts/mockup-sandbox/package.json

# Install with --frozen-lockfile so pnpm uses exactly what is in the lockfile.
# This also bypasses the minimumReleaseAge check (applies only during resolution).
RUN pnpm install --frozen-lockfile

# ── Full source copy ─────────────────────────────────────────
COPY lib/              ./lib/
COPY artifacts/growthos/ ./artifacts/growthos/

# ── Build arguments (set in Coolify → Build Variables) ───────
# VITE_API_URL : URL of your NestJS backend, e.g. https://api.yourdomain.com
# BASE_PATH    : URL prefix where the app is served (default /)
ARG VITE_API_URL=""
ARG BASE_PATH="/"

# ── Diagnostics — show env and key paths before the build ────
RUN echo "=== Build environment ===" && \
    node --version && \
    pnpm --version && \
    echo "BASE_PATH=${BASE_PATH:-/}" && \
    echo "VITE_API_URL=${VITE_API_URL}" && \
    echo "NODE_ENV=production" && \
    echo "=== Workspace packages ===" && \
    ls node_modules/@workspace/ 2>/dev/null || echo "(no @workspace symlinks)" && \
    echo "=== growthos src ===" && \
    ls artifacts/growthos/src/ && \
    echo "=== vite binary ===" && \
    ls artifacts/growthos/node_modules/.bin/vite 2>/dev/null || \
    ls node_modules/.bin/vite 2>/dev/null || echo "(vite not found!)"

# ── Vite production build ─────────────────────────────────────
# Run from the growthos directory to avoid pnpm filter workspace issues.
# Use ${VAR:-default} form so empty build-args from Coolify still work.
WORKDIR /app/artifacts/growthos
RUN PORT=3000 \
    BASE_PATH="${BASE_PATH:-/}" \
    VITE_API_URL="${VITE_API_URL}" \
    NODE_ENV=production \
    pnpm run build

# ============================================================
# Stage 2 — Serve with nginx (Alpine for small image)
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
