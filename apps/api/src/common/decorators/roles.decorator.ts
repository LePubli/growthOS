import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Décorateur @Roles('admin', 'manager') — restreint l'accès à certains rôles.
 * Le RolesGuard lit cette métadonnée pour autoriser/refuser.
 *
 * Exemple :
 *   @Roles('admin')
 *   @Delete(':id')
 *   async delete(...) { ... }
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
