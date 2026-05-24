import { SetMetadata } from '@nestjs/common';
import { HookName } from './plugin-registry.service';

export const PLUGIN_HOOK_KEY = 'pluginHook';

/**
 * Décorateur @PluginHook('prospect.created')
 * À utiliser sur les méthodes d'un service pour qu'elles soient
 * automatiquement appelées quand le hook est émis.
 *
 * Exemple :
 * @PluginHook('prospect.created')
 * async onProspectCreated(payload: { email: string; id: string }) {
 *   // logique
 * }
 */
export function PluginHook(hook: HookName, priority = 5) {
  return SetMetadata(PLUGIN_HOOK_KEY, { hook, priority });
}

/**
 * Helper pour émettre un hook depuis n'importe quel service.
 * Injectez PluginRegistryService et appelez emit().
 *
 * Exemple :
 * constructor(private readonly registry: PluginRegistryService) {}
 *
 * async createProspect(data: CreateProspectDto) {
 *   const prospect = await this.prisma.prospect.create({ data });
 *   await this.registry.emit('prospect.created', prospect);
 *   return prospect;
 * }
 */
export { PluginRegistryService } from './plugin-registry.service';
