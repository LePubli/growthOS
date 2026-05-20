import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PluginsController } from './plugins.controller';
import { PluginsService } from './plugins.service';
import { PluginEngineService } from './plugin-engine.service';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'plugins' }),
    EventsModule,
  ],
  controllers: [PluginsController],
  providers: [PluginsService, PluginEngineService],
  exports: [PluginsService, PluginEngineService],
})
export class PluginsModule {}
