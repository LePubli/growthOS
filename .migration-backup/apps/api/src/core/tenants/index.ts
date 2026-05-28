// ── tenants.module.ts ─────────────────────────────────────────
import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { TenantMiddleware } from './tenant.middleware';

@Module({
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}

// ── tenants.service.ts ────────────────────────────────────────
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { TenantPrismaService } from '../../shared/database/tenant-prisma.service';

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
  ) {}

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id, deletedAt: null },
      include: { plan: true },
    });
    if (!tenant) throw new NotFoundException('Tenant introuvable');
    return tenant;
  }

  async getMembers(tenantId: string) {
    return this.prisma.tenantUser.findMany({
      where: { tenantId, isActive: true },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true, lastLoginAt: true } } },
    });
  }

  async inviteUser(tenantId: string, email: string, role: string = 'member') {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // TODO: envoyer email d'invitation
      return { status: 'invited', email };
    }

    const existing = await this.prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId, userId: user.id } },
    });
    if (existing) return { status: 'already_member', email };

    await this.prisma.tenantUser.create({
      data: { tenantId, userId: user.id, role, invitedAt: new Date() },
    });

    return { status: 'added', email, role };
  }

  async updateBranding(tenantId: string, branding: Record<string, any>) {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { branding },
    });
  }

  async updateSettings(tenantId: string, settings: Record<string, any>) {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { settings },
    });
  }

  async getUsageStats(tenantId: string, schemaName: string) {
    const [prospectCount] = await this.tenantPrisma.executeOnTenant<[{ count: string }]>(
      schemaName,
      `SELECT COUNT(*)::text as count FROM "${schemaName}".prospects`,
    );

    return {
      prospects: parseInt(prospectCount?.count || '0'),
      // autres stats
    };
  }
}

// ── tenants.controller.ts ─────────────────────────────────────
import { Controller, Get, Patch, Post, Body, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, CurrentTenant, Roles } from '../../common/decorators';
import { TenantsService } from './tenants.service';

@ApiTags('Tenants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get('current')
  async getCurrent(@CurrentUser() user: any) {
    return this.tenants.findById(user.tenantId);
  }

  @Get('members')
  async getMembers(@CurrentUser() user: any) {
    return this.tenants.getMembers(user.tenantId);
  }

  @Post('invite')
  @Roles('admin', 'owner')
  async invite(
    @CurrentUser() user: any,
    @Body() body: { email: string; role?: string },
  ) {
    return this.tenants.inviteUser(user.tenantId, body.email, body.role);
  }

  @Patch('branding')
  @Roles('admin', 'owner')
  async updateBranding(
    @CurrentUser() user: any,
    @Body() branding: Record<string, any>,
  ) {
    return this.tenants.updateBranding(user.tenantId, branding);
  }

  @Patch('settings')
  @Roles('admin', 'owner')
  async updateSettings(
    @CurrentUser() user: any,
    @Body() settings: Record<string, any>,
  ) {
    return this.tenants.updateSettings(user.tenantId, settings);
  }

  @Get('usage')
  async getUsage(@CurrentUser() user: any) {
    return this.tenants.getUsageStats(user.tenantId, user.tenantSchema);
  }
}
