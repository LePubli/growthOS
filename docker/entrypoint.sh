#!/bin/sh
# ---------------------------------------------------------------
# Runtime environment variable injection for the Vite SPA.
#
# Vite bakes import.meta.env.* into JS at build time, so to allow
# changing VITE_API_URL at container start (without a rebuild),
# we inject a <script> tag with window.__ENV__ into index.html.
#
# Usage in the app: (import.meta.env.VITE_API_URL || window.__ENV__?.VITE_API_URL)
# ---------------------------------------------------------------

set -e

INDEX=/usr/share/nginx/html/index.html

if [ ! -f "$INDEX" ]; then
  echo "[entrypoint] index.html not found at $INDEX, skipping env injection"
  exit 0
fi

# Build the runtime env JSON
RUNTIME_API_URL="${VITE_API_URL:-}"

ENV_SCRIPT="<script>window.__ENV__={\"VITE_API_URL\":\"${RUNTIME_API_URL}\"};</script>"

# Inject before </head> (idempotent — only inject once)
if grep -q 'window.__ENV__' "$INDEX"; then
  echo "[entrypoint] Runtime env already injected, skipping"
else
  sed -i "s|</head>|${ENV_SCRIPT}</head>|" "$INDEX"
  echo "[entrypoint] Injected runtime env: VITE_API_URL=${RUNTIME_API_URL}"
fi
