import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

const ROLE_HIERARCHY: Record<string, number> = {
  owner:   100,
  admin:   80,
  manager: 60,
  member:  40,
  viewer:  20,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredPerms = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length && !requiredPerms?.length) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('Non authentifié');

    // Check rôle
    if (requiredRoles?.length) {
      const userLevel = ROLE_HIERARCHY[user.role] || 0;
      const minRequired = Math.min(...requiredRoles.map(r => ROLE_HIERARCHY[r] || 0));
      if (userLevel < minRequired) {
        throw new ForbiddenException(`Rôle requis: ${requiredRoles.join(' ou ')}`);
      }
    }

    // Check permissions granulaires
    if (requiredPerms?.length) {
      const userPerms: string[] = user.permissions || [];
      const hasAll = requiredPerms.every(p => userPerms.includes(p) || user.role === 'owner' || user.role === 'admin');
      if (!hasAll) throw new ForbiddenException('Permission insuffisante');
    }

    return true;
  }
}
