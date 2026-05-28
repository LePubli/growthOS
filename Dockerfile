# ============================================================
# Stage 1 — Build
# ============================================================
FROM node:22-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# ── Workspace manifests (cached layer) ──────────────────────
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy ALL workspace package.json files so pnpm can resolve the full lockfile
COPY lib/api-client-react/package.json   ./lib/api-client-react/package.json
COPY lib/api-spec/package.json           ./lib/api-spec/package.json
COPY lib/api-zod/package.json            ./lib/api-zod/package.json
COPY lib/db/package.json                 ./lib/db/package.json
COPY artifacts/growthos/package.json     ./artifacts/growthos/package.json
COPY artifacts/api-server/package.json   ./artifacts/api-server/package.json
COPY artifacts/mockup-sandbox/package.json ./artifacts/mockup-sandbox/package.json

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile

# ── Full source copy ─────────────────────────────────────────
COPY lib/              ./lib/
COPY artifacts/growthos/ ./artifacts/growthos/

# ── Build arguments (set in Coolify → Build Variables) ───────
# VITE_API_URL   : URL of your NestJS backend, e.g. https://api.yourdomain.com
# BASE_PATH      : URL prefix where the app is served, default /
ARG VITE_API_URL=""
ARG BASE_PATH="/"

# Build the Vite SPA
# PORT is required by vite.config.ts at load time (only used for dev server)
RUN PORT=3000 \
    BASE_PATH=${BASE_PATH} \
    VITE_API_URL=${VITE_API_URL} \
    NODE_ENV=production \
    pnpm --filter @workspace/growthos run build

# ============================================================
# Stage 2 — Serve with nginx
# ============================================================
FROM nginx:1.27-alpine AS runner

# Remove default site
RUN rm -rf /etc/nginx/conf.d/default.conf

# nginx config
COPY docker/nginx.conf /etc/nginx/conf.d/growthos.conf

# Static assets from build stage
COPY --from=builder /app/artifacts/growthos/dist/public /usr/share/nginx/html

# Runtime env injection script (runs before nginx starts)
COPY docker/entrypoint.sh /docker-entrypoint.d/40-inject-env.sh
RUN chmod +x /docker-entrypoint.d/40-inject-env.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1
