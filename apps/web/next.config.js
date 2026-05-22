const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // OBLIGATOIRE pour le Dockerfile multi-stage
  output: 'standalone',

  // ⭐ CRITIQUE pour MONOREPO ⭐
  // Indique à Next.js de tracer les dépendances depuis la racine du monorepo
  // Sans ça, le standalone output place server.js dans /app/ au lieu de /app/apps/web/
  outputFileTracingRoot: path.join(__dirname, '../../'),

  // Filet de sécurité au build
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  env: {
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'GrowthOS',
  },

  images: {
    remotePatterns: [
      { protocol: 'http',  hostname: '**' },
      { protocol: 'https', hostname: '**' },
    ],
  },

  webpack: (config) => {
    if (process.env.NODE_ENV === 'production') {
      config.cache = false;
    }
    return config;
  },
};

module.exports = nextConfig;
