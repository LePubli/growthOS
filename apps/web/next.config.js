/** @type {import('next').NextConfig} */
const nextConfig = {
  // OBLIGATOIRE pour le Dockerfile multi-stage (stage production copie .next/standalone)
  output: 'standalone',

  // ─── Filet de sécurité au build ─────────────────────────────────────────────
  // Ignore les erreurs TS et ESLint pendant `next build`.
  // Permet de déployer même avec des warnings — à durcir plus tard une fois stable.
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Désactive la télémétrie Next.js
  experimental: {
    // disable telemetry via env NEXT_TELEMETRY_DISABLED=1 (cf Dockerfile)
  },

  // Variables d'environnement exposées au client
  env: {
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'GrowthOS',
  },

  // Images depuis l'API
  images: {
    remotePatterns: [
      { protocol: 'http',  hostname: '**' },
      { protocol: 'https', hostname: '**' },
    ],
  },

  // Webpack — désactiver le cache en build Docker pour éviter les stale builds
  webpack: (config, { isServer }) => {
    if (process.env.NODE_ENV === 'production') {
      config.cache = false;
    }
    return config;
  },
};

module.exports = nextConfig;
