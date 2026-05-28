import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../shared/database/prisma.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

export interface DomainEvent {
  name: string;       // ex: 'lead.created', 'email.sent'
  tenantId: string;
  payload: Record<string, any>;
  source?: string;    // plugin source
  userId?: string;
}

/**
 * Event Bus central.
 * 
 * Architecture :
 * 1. Émet l'événement en mémoire (EventEmitter2) → réaction immédiate
 * 2. Persiste en DB (SystemEvent) → auditabilité
 * 3. Publie dans la Queue Bull → traitement async (webhooks, workflows)
 * 
 * Conventions de nommage :
 * - lead.created / lead.updated / lead.deleted
 * - email.sent / email.opened / email.replied
 * - workflow.triggered / workflow.completed / workflow.failed
 * - plugin.installed / plugin.activated / plugin.deactivated
 * - theme.activated
 * - signal.detected
 * - ai.task.started / ai.task.completed
 */
@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  constructor(
    private readonly emitter: EventEmitter2,
    private readonly prisma: PrismaService,
    @InjectQueue('events') private readonly eventsQueue: Queue,
  ) {}

  /**
   * Publie un événement domain.
   */
  async publish(event: DomainEvent): Promise<void> {
    this.logger.debug(`[EventBus] ${event.name} → tenant:${event.tenantId}`);

    // 1. Émission synchrone in-memory
    this.emitter.emit(event.name, { ...event.payload, tenantId: event.tenantId, _event: event.name });

    // 2. Persistance async (ne bloque pas)
    this.persistEvent(event).catch(e => this.logger.warn(`[EventBus] Persist failed: ${e.message}`));

    // 3. Queue async pour workflows et webhooks
    await this.eventsQueue.add('process', event, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
  }

  /**
   * Publie multiple événements en batch.
   */
  async publishBatch(events: DomainEvent[]): Promise<void> {
    await Promise.all(events.map(e => this.publish(e)));
  }

  /**
   * S'abonne à un ou plusieurs événements.
   */
  subscribe(pattern: string, handler: (event: any) => void): void {
    this.emitter.on(pattern, handler);
  }

  /**
   * S'abonne avec wildcard (ex: 'lead.*').
   */
  subscribeWildcard(pattern: string, handler: (event: any) => void): void {
    this.emitter.on(pattern, handler);
  }

  private async persistEvent(event: DomainEvent): Promise<void> {
    await this.prisma.systemEvent.create({
      data: {
        tenantId: event.tenantId,
        name: event.name,
        payload: event.payload,
        source: event.source,
      },
    });
  }
}
