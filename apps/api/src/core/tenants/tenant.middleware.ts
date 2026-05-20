import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../shared/database/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';

/**
 * Tenant Middleware — identifie le tenant depuis :
 * 1. Header X-Tenant-ID (UUID direct)
 * 2. Header X-Tenant-Slug (slug)
 * 3. Subdomain (acme.growthos.io)
 * 4. JWT payload (tenantId déjà dans le token)
 *
 * Injecte req.tenant avec les infos du tenant.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Routes publiques sans tenant
    const publicPaths = [
      '/api/v1/auth/register',
      '/api/v1/auth/login',
      '/api/v1/auth/refresh',
      '/api/v1/health',
      '/api/docs',
    ];

    if (publicPaths.some(p => req.path.startsWith(p))) {
      return next();
    }

    let tenantId: string | undefined;

    // 1. Header direct
    tenantId = req.headers['x-tenant-id'] as string;

    // 2. Slug header
    if (!tenantId) {
      const slug = req.headers['x-tenant-slug'] as string;
      if (slug) {
        const tenant = await this.getTenantBySlug(slug);
        tenantId = tenant?.id;
      }
    }

    // 3. Subdomain
    if (!tenantId) {
      const host = req.headers['host'] || '';
      const subdomain = this.extractSubdomain(host);
      if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
        const tenant = await this.getTenantBySlug(subdomain);
        tenantId = tenant?.id;
      }
    }

    // 4. Le tenantId viendra du JWT via JwtAuthGuard
    // Injecté dans req.user.tenantId après validation du token
    if (tenantId) {
      const tenant = await this.getTenantById(tenantId);
      if (tenant) {
        (req as any).tenant = tenant;
      }
    }

    next();
  }

  private extractSubdomain(host: string): string | null {
    const parts = host.split('.');
    if (parts.length >= 3) return parts[0];
    return null;
  }

  private async getTenantById(id: string) {
    const cacheKey = `tenant:id:${id}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id, deletedAt: null },
      select: { id: true, name: true, slug: true, schemaName: true, status: true, branding: true, settings: true },
    });

    if (tenant) await this.cache.set(cacheKey, tenant, 60_000);
    return tenant;
  }

  private async getTenantBySlug(slug: string) {
    const cacheKey = `tenant:slug:${slug}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug, deletedAt: null },
      select: { id: true, name: true, slug: true, schemaName: true, status: true, branding: true },
    });

    if (tenant) await this.cache.set(cacheKey, tenant, 60_000);
    return tenant;
  }
}
