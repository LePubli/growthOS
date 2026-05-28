#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# install-common-pack.sh
# Crée tous les fichiers communs NestJS manquants dans apps/api/src/common/
# À exécuter À LA RACINE du repo growthOS
# ─────────────────────────────────────────────────────────────────────────────

set -e
echo "→ Installation du pack commun NestJS..."

BASE="apps/api/src/common"
mkdir -p "$BASE"/{decorators,guards,filters,interceptors,interfaces,types}

# ═══ DECORATORS ═══════════════════════════════════════════════════════════════
cat > "$BASE/decorators/public.decorator.ts" << 'TS_EOF'
import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
TS_EOF

cat > "$BASE/decorators/current-user.decorator.ts" << 'TS_EOF'
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return data ? req.user?.[data] : req.user;
  },
);
TS_EOF

cat > "$BASE/decorators/tenant.decorator.ts" << 'TS_EOF'
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
export const CurrentTenant = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return data ? req.tenant?.[data] : req.tenant;
  },
);
export const Tenant = CurrentTenant;
TS_EOF

cat > "$BASE/decorators/roles.decorator.ts" << 'TS_EOF'
import { SetMetadata } from '@nestjs/common';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
TS_EOF

cat > "$BASE/decorators/api-key.decorator.ts" << 'TS_EOF'
import { SetMetadata } from '@nestjs/common';
export const API_KEY_REQUIRED = 'apiKeyRequired';
export const RequireApiKey = () => SetMetadata(API_KEY_REQUIRED, true);
TS_EOF

cat > "$BASE/decorators/skip-auth.decorator.ts" << 'TS_EOF'
import { SetMetadata } from '@nestjs/common';
export const SKIP_AUTH_KEY = 'skipAuth';
export const SkipAuth = () => SetMetadata(SKIP_AUTH_KEY, true);
TS_EOF

# ═══ GUARDS ═══════════════════════════════════════════════════════════════════
cat > "$BASE/guards/jwt-auth.guard.ts" << 'TS_EOF'
import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }
  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
TS_EOF

cat > "$BASE/guards/roles.guard.ts" << 'TS_EOF'
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('Non authentifié');
    const userRoles: string[] = Array.isArray(user.roles) ? user.roles : user.role ? [user.role] : [];
    if (!required.some((r) => userRoles.includes(r))) {
      throw new ForbiddenException(`Rôles requis : ${required.join(', ')}`);
    }
    return true;
  }
}
TS_EOF

cat > "$BASE/guards/api-key.guard.ts" << 'TS_EOF'
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { API_KEY_REQUIRED } from '../decorators/api-key.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(API_KEY_REQUIRED, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;
    const req = context.switchToHttp().getRequest();
    if (!req.headers['x-api-key']) throw new UnauthorizedException('API key manquante');
    return true;
  }
}
TS_EOF

cat > "$BASE/guards/tenant.guard.ts" << 'TS_EOF'
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    if (!req.tenant) throw new ForbiddenException('Tenant non résolu');
    return true;
  }
}
TS_EOF

# ═══ FILTERS ══════════════════════════════════════════════════════════════════
cat > "$BASE/filters/all-exceptions.filter.ts" << 'TS_EOF'
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = exception instanceof HttpException ? exception.getResponse() : (exception as Error)?.message || 'Erreur interne';

    this.logger.error(`${request.method} ${request.url} → ${status}`, (exception as Error)?.stack);
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}
TS_EOF

# ═══ INTERCEPTORS ═════════════════════════════════════════════════════════════
cat > "$BASE/interceptors/logging.interceptor.ts" << 'TS_EOF'
import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, url } = req;
    const start = Date.now();
    return next.handle().pipe(tap(() => this.logger.log(`${method} ${url} → ${Date.now() - start}ms`)));
  }
}
TS_EOF

cat > "$BASE/interceptors/transform.interceptor.ts" << 'TS_EOF'
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> { success: boolean; data: T; timestamp: string; }

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    return next.handle().pipe(map((data) => ({ success: true, data, timestamp: new Date().toISOString() })));
  }
}
TS_EOF

# ═══ INTERFACES ═══════════════════════════════════════════════════════════════
cat > "$BASE/interfaces/user-payload.interface.ts" << 'TS_EOF'
export interface UserPayload {
  id: string;
  email: string;
  tenantId?: string;
  role?: string;
  roles?: string[];
}
TS_EOF

cat > "$BASE/interfaces/tenant-context.interface.ts" << 'TS_EOF'
export interface TenantContext {
  id: string;
  slug: string;
  schemaName: string;
  planId?: string;
}
TS_EOF

# ═══ TYPES ════════════════════════════════════════════════════════════════════
cat > "$BASE/types/express-request.d.ts" << 'TS_EOF'
import 'express';
import { UserPayload } from '../interfaces/user-payload.interface';
import { TenantContext } from '../interfaces/tenant-context.interface';

declare module 'express' {
  interface Request {
    user?: UserPayload;
    tenant?: TenantContext;
  }
}
TS_EOF

echo "✓ Pack commun installé :"
find "$BASE" -type f | sort
echo ""
echo "─────────────────────────────────────────────────────────────"
echo "Prochaines étapes :"
echo "  git add apps/api/src/common/"
echo "  git commit -m 'feat: add NestJS common pack (decorators, guards, filters)'"
echo "  git push"
echo "─────────────────────────────────────────────────────────────"
