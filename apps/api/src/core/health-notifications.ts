// ── health.module.ts ──────────────────────────────────────────
import { Module } from '@nestjs/common';
import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../shared/database/prisma.service';
import { Public } from '../../common/decorators';

@ApiTags('Health')
@Controller('health')
class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Public()
  async check() {
    let dbOk = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {}

    return {
      status: dbOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: { database: dbOk ? 'ok' : 'error' },
    };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}

// ── notifications.module.ts ───────────────────────────────────
import { Module as NestModule } from '@nestjs/common';
import { Controller as NestController, Get, Post, Body, Param, Patch, UseGuards } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators';

@Injectable()
class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, userId: string) {
    return this.prisma.notification.findMany({
      where: { tenantId, userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(tenantId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { tenantId, userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async create(tenantId: string, userId: string, data: { type: string; title: string; message?: string; link?: string }) {
    return this.prisma.notification.create({
      data: { tenantId, userId, ...data },
    });
  }

  async unreadCount(tenantId: string, userId: string) {
    return this.prisma.notification.count({
      where: { tenantId, userId, isRead: false },
    });
  }
}

@ApiTags('Notifications')
@NestController('notifications')
@UseGuards(JwtAuthGuard)
class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: any) {
    return this.service.list(user.tenantId, user.id);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: any) {
    return this.service.unreadCount(user.tenantId, user.id);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.markRead(id, user.id);
  }

  @Post('mark-all-read')
  markAllRead(@CurrentUser() user: any) {
    return this.service.markAllRead(user.tenantId, user.id);
  }
}

@NestModule({ controllers: [NotificationsController], providers: [NotificationsService], exports: [NotificationsService] })
export class NotificationsModule {}
