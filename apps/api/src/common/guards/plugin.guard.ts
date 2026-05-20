import {
  Injectable, CanActivate, ExecutionContext,
  NotFoundException, Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PLUGIN_KEY } from '../decorators/plugin.decorator';

@Injectable()
export class PluginGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const pluginName = this.reflector.getAllAndOverride<string>(PLUGIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!pluginName) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user?.tenantId) return false;

    // Le PluginEngineService est injecté via le middleware
    // Ici on vérifie via le registry global
    const { registry } = require('../../core/plugins/plugin-registry');
    if (!registry.isActive(user.tenantId, pluginName)) {
      throw new NotFoundException({
        message: `Plugin '${pluginName}' non activé pour ce tenant`,
        code: 'PLUGIN_INACTIVE',
        plugin: pluginName,
      });
    }

    return true;
  }
}
