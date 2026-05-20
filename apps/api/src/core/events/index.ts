// ── events.module.ts ──────────────────────────────────────────
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { EventBusService } from './event-bus.service';
import { EventsProcessor } from './events.processor';
import { EventsController } from './events.controller';

@Module({
  imports: [BullModule.registerQueue({ name: 'events' })],
  controllers: [EventsController],
  providers: [EventBusService, EventsProcessor],
  exports: [EventBusService],
})
export class EventsModule {}

// ── events.processor.ts (BullMQ) ──────────────────────────────
import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../shared/database/prisma.service';

@Processor('events')
export class EventsProcessor {
  private readonly logger = new Logger(EventsProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  @Process('process')
  async processEvent(job: Job) {
    const event = job.data;

    this.logger.debug(`[EventBus] Processing: ${event.name}`);

    // 1. Déclencher les workflows liés à cet événement
    await this.triggerWorkflows(event);

    // 2. Appeler les webhooks configurés
    await this.notifyWebhooks(event);

    // Marquer comme traité
    await this.prisma.systemEvent.updateMany({
      where: { name: event.name, tenantId: event.tenantId, processed: false },
      data: { processed: true, processedAt: new Date() },
    });
  }

  private async triggerWorkflows(event: any) {
    try {
      const workflows = await this.prisma.$queryRaw<any[]>`
        SELECT id, name, steps, trigger_config
        FROM (SELECT 1 as dummy) d
        WHERE false
      `;
      // TODO: charger depuis le schema tenant et exécuter les workflows
    } catch (e) {
      this.logger.debug(`[EventBus] Workflow trigger: ${e.message}`);
    }
  }

  private async notifyWebhooks(event: any) {
    try {
      // TODO: charger les webhooks configurés pour ce tenant + event
      // et faire les appels HTTP
    } catch (e) {
      this.logger.debug(`[EventBus] Webhook notify: ${e.message}`);
    }
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(`[EventBus] Job ${job.id} failed: ${error.message}`);
  }
}

// ── events.controller.ts ──────────────────────────────────────
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators';

@ApiTags('Events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @CurrentUser() user: any,
    @Query('name') name?: string,
    @Query('limit') limit: number = 50,
  ) {
    const where: any = { tenantId: user.tenantId };
    if (name) where.name = { contains: name };

    return this.prisma.systemEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
  }
}
