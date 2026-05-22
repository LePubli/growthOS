import { SetMetadata } from '@nestjs/common';

/**
 * Clé de métadonnée pour marquer une route comme publique (sans auth).
 * Le JwtAuthGuard lit cette clé pour bypass l'authentification.
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Décorateur @Public() — marque un controller ou une route comme accessible
 * sans token JWT. Utilisé typiquement sur :
 *  - POST /auth/register
 *  - POST /auth/login
 *  - POST /auth/refresh
 *  - GET  /health
 *
 * Exemple :
 *   @Public()
 *   @Post('login')
 *   async login(...) { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
