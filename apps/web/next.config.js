/** @type {import('next').NextConfig} */
const nextConfig = {
  // OBLIGATOIRE pour le Dockerfile multi-stage (stage production copie .next/standalone)
  output: 'standalone',

  // Désactive la télémétrie Next.js
  telemetry: false,

  // Variables d'environnement exposées au client
  env: {
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'GrowthOS',
  },

  // Images depuis l'API
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '**',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  // Webpack — désactiver le cache en prod Docker pour éviter les stale builds
  webpack: (config, { isServer }) => {
    if (process.env.NODE_ENV === 'production') {
      config.cache = false;
    }
    return config;
  },
};

module.exports = nextConfig;
