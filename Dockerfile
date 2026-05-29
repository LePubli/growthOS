# ============================================================
# Stage 1 — Build
# ============================================================
# node:24-slim: Debian glibc, matches Replit runtime exactly.
# Do NOT use Alpine: musl libc breaks rollup/@tailwindcss/oxide/lightningcss
# native binaries excluded by pnpm-workspace.yaml overrides.
FROM node:24-slim AS builder

# Install pnpm — exact version matching pnpm-lock.yaml (lockfileVersion 9.0)
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

WORKDIR /app

# ── Workspace manifests only (cache layer) ───────────────────
# All package.json files must be present so pnpm --frozen-lockfile can
# validate every importer listed in pnpm-lock.yaml. We do NOT copy source
# here — that comes after the install step.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./

COPY artifacts/growthos/package.json       ./artifacts/growthos/package.json
COPY artifacts/api-server/package.json     ./artifacts/api-server/package.json
COPY artifacts/mockup-sandbox/package.json ./artifacts/mockup-sandbox/package.json
COPY lib/api-client-react/package.json     ./lib/api-client-react/package.json
COPY lib/api-client-react/tsconfig.json    ./lib/api-client-react/tsconfig.json
COPY lib/api-spec/package.json             ./lib/api-spec/package.json
COPY lib/api-zod/package.json              ./lib/api-zod/package.json
COPY lib/db/package.json                   ./lib/db/package.json
COPY scripts/package.json                  ./scripts/package.json

# ── Install ONLY growthos + its direct workspace deps ────────
# --filter @workspace/growthos... installs growthos and its recursive
# workspace dependencies (api-client-react) but skips api-server,
# mockup-sandbox, api-spec, api-zod, db, scripts — saving ~500MB of disk.
# --frozen-lockfile: deterministic, bypasses minimumReleaseAge.
RUN pnpm install --frozen-lockfile --filter @workspace/growthos...

# Free the pnpm content-addressable store immediately after install.
# The packages are already linked into node_modules; the store is no longer needed.
RUN pnpm store prune 2>/dev/null || true

# ── Source files (only what the frontend build needs) ────────
COPY artifacts/growthos/ ./artifacts/growthos/
# api-client-react source is a workspace dep; pnpm already created the symlink.
# The package.json was copied above; source not needed (growthos only uses types).
COPY lib/api-client-react/src/ ./lib/api-client-react/src/

# ── Build arguments (configure in Coolify → Build Variables) ─
# VITE_API_URL : URL of your NestJS backend, e.g. https://api.yourdomain.com
# BASE_PATH    : URL prefix where the app is served (default /)
ARG VITE_API_URL=""
ARG BASE_PATH="/"

# ── Pre-build diagnostics ─────────────────────────────────────
RUN node --version && \
    pnpm --version && \
    echo "BASE_PATH=${BASE_PATH:-/} VITE_API_URL=${VITE_API_URL} NODE_ENV=production" && \
    echo "Disk after install:" && df -h /app && \
    ls /app/artifacts/growthos/node_modules/.bin/vite && \
    echo "vite OK"

# ── Vite production build ─────────────────────────────────────
# Call vite via the package-local binary: pnpm (non-hoisted) installs binaries
# inside each workspace package's own node_modules/.bin/, not at the root.
WORKDIR /app/artifacts/growthos
RUN PORT=3000 \
    BASE_PATH="${BASE_PATH:-/}" \
    VITE_API_URL="${VITE_API_URL}" \
    NODE_ENV=production \
    ./node_modules/.bin/vite build --config vite.config.ts

# ── Free build artefacts that are no longer needed ───────────
RUN rm -rf /app/artifacts/growthos/node_modules \
           /app/lib \
           /app/node_modules

# ============================================================
# Stage 2 — Serve with nginx (Alpine for minimal final image)
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
