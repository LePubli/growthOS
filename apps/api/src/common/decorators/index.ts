import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

// ── @CurrentUser() ──────────────────────────────────────────
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);

// ── @CurrentTenant() ────────────────────────────────────────
export const CurrentTenant = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return {
      id: request.user?.tenantId,
      schema: request.user?.tenantSchema,
    };
  },
);

// ── @Public() ───────────────────────────────────────────────
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// ── @Roles() ────────────────────────────────────────────────
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

// ── @RequirePermissions() ────────────────────────────────────
export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...perms: string[]) => SetMetadata(PERMISSIONS_KEY, perms);

// ── @Plugin() ───────────────────────────────────────────────
export const PLUGIN_KEY = 'plugin';
export const Plugin = (name: string) => SetMetadata(PLUGIN_KEY, name);
