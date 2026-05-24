import { Module } from '@nestjs/common';
import { PluginsController } from './plugins.controller';
import { PluginsService } from './plugins.service';
import { PluginRegistryService } from './plugin-registry.service';
import { PluginLoaderService } from './plugin-loader.service';

@Module({
  controllers: [PluginsController],
  providers: [
    PluginsService,
    PluginRegistryService,
    PluginLoaderService,
  ],
  exports: [
    PluginsService,
    PluginRegistryService,  // ← Exporté pour être injecté partout dans l'app
    PluginLoaderService,
  ],
})
export class PluginsModule {}
