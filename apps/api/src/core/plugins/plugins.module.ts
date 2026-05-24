import { Module } from '@nestjs/common';
import { PluginsController } from './plugins.controller';
import { PluginsService } from './plugins.service';
import { PluginRegistryService } from './plugin-registry.service';
import { PluginLoaderService } from './plugin-loader.service';
import { PluginEngineService } from './plugin-engine.service';

@Module({
  controllers: [PluginsController],
  providers: [
    PluginsService,
    PluginEngineService,
    PluginRegistryService,
    PluginLoaderService,
  ],
  exports: [
    PluginsService,
    PluginEngineService,
    PluginRegistryService,
    PluginLoaderService,
  ],
})
export class PluginsModule {}
