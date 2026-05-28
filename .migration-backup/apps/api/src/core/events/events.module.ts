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
