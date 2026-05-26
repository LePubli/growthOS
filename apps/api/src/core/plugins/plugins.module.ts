import { Module } from '@nestjs/common';
import { PluginsController } from './plugins.controller';
import { PluginsService } from './plugins.service';
import { PluginRegistryService } from './plugin-registry.service';
import { PluginLoaderService } from './plugin-loader.service';
import { PluginEngineService } from './plugin-engine.service';
import { PluginSandboxService } from './plugin-sandbox.service';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [EventsModule],
  controllers: [PluginsController],
  providers: [
    PluginsService,
    PluginEngineService,
    PluginRegistryService,
    PluginLoaderService,
    PluginSandboxService,
  ],
  exports: [
    PluginsService,
    PluginEngineService,
    PluginRegistryService,
    PluginLoaderService,
    PluginSandboxService,
  ],
})
export class PluginsModule {}
