// ── tenants.module.ts ─────────────────────────────────────────
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { TenantMiddleware } from './tenant.middleware';

@Module({})
export class TenantsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}

// ── health.module.ts ──────────────────────────────────────────
import { Module as HModule } from '@nestjs/common';
import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators';
import { PrismaService } from '../../shared/database/prisma.service';

@Controller('health')
class HealthController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() @Public()
  async check() {
    let db = false;
    try { await this.prisma.$queryRaw`SELECT 1`; db = true; } catch {}
    return { status: db ? 'ok' : 'degraded', timestamp: new Date().toISOString(), services: { database: db ? 'ok' : 'error' } };
  }
}

@HModule({ controllers: [HealthController] })
export class HealthModule {}

// ── themes.module.ts ──────────────────────────────────────────
import { Module as TModule } from '@nestjs/common';
import { ThemeEngineService } from './theme-engine.service';
import { ThemesController } from './themes.controller';
import { ThemesService } from './themes.service';

@TModule({
  controllers: [ThemesController],
  providers: [ThemeEngineService, ThemesService],
  exports: [ThemeEngineService],
})
export class ThemesModule {}

// ── workflows.module.ts ───────────────────────────────────────
import { Module as WModule } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsProcessor } from './workflows.processor';

@WModule({
  imports: [BullModule.registerQueue({ name: 'workflows' })],
  controllers: [WorkflowsController],
  providers: [WorkflowEngineService, WorkflowsProcessor],
  exports: [WorkflowEngineService],
})
export class WorkflowsModule {}

// ── events.module.ts ──────────────────────────────────────────
import { Module as EModule } from '@nestjs/common';
import { BullModule as BModule } from '@nestjs/bull';
import { EventBusService } from './event-bus.service';
import { EventsProcessor } from './events.processor';

@EModule({
  imports: [BModule.registerQueue({ name: 'events' })],
  providers: [EventBusService, EventsProcessor],
  exports: [EventBusService],
})
export class EventsModule {}

// ── notifications.module.ts ───────────────────────────────────
import { Module as NModule } from '@nestjs/common';

@NModule({})
export class NotificationsModule {}
