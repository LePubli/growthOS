import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PluginRegistryService, PluginMeta, HookName } from './plugin-registry.service';

@Injectable()
export class PluginLoaderService implements OnModuleInit {
  private readonly logger = new Logger(PluginLoaderService.name);

  constructor(private readonly registry: PluginRegistryService) {}

  async onModuleInit() {
    this.registerBuiltInPlugins();
    this.logger.log(`✅ PluginLoader initialisé — ${this.registry.getActive().length} plugins actifs`);
  }

  private registerBuiltInPlugins() {
    const builtIns: Array<{ meta: PluginMeta; hooks: Partial<Record<HookName, (payload: any) => Promise<void>>> }> = [
      {
        meta: {
          name: 'prospect-scorer',
          displayName: 'Prospect Scorer',
          version: '1.0.0',
          author: 'GrowthOS',
          description: 'Score automatiquement les prospects',
          hooks: ['prospect.created', 'email.opened', 'email.replied'],
          isActive: true,
        },
        hooks: {
          'prospect.created': async (payload) => {
            this.logger.debug(`[ProspectScorer] Nouveau prospect: ${payload?.email}`);
          },
          'email.opened': async (payload) => {
            this.logger.debug(`[ProspectScorer] Email ouvert → +5pts pour ${payload?.prospectId}`);
          },
          'email.replied': async (payload) => {
            this.logger.debug(`[ProspectScorer] Réponse → +20pts pour ${payload?.prospectId}`);
          },
        },
      },
      {
        meta: {
          name: 'activity-logger',
          displayName: 'Activity Logger',
          version: '1.0.0',
          author: 'GrowthOS',
          description: 'Journal d\'audit des activités',
          hooks: ['prospect.created', 'email.sent', 'workflow.triggered', 'plugin.activated'],
          isActive: true,
        },
        hooks: {
          'prospect.created': async (p) => this.logger.debug(`[ActivityLogger] Prospect créé: ${p?.email}`),
          'email.sent':       async (p) => this.logger.debug(`[ActivityLogger] Email envoyé: ${p?.subject}`),
          'workflow.triggered': async (p) => this.logger.debug(`[ActivityLogger] Workflow: ${p?.workflowId}`),
          'plugin.activated': async (p) => this.logger.debug(`[ActivityLogger] Plugin activé: ${p?.pluginName}`),
        },
      },
    ];

    for (const { meta, hooks } of builtIns) {
      this.registry.register(meta);
      for (const [hookName, handler] of Object.entries(hooks)) {
        this.registry.registerHook({
          pluginName: meta.name,
          hook: hookName as HookName,
          handler: handler!,
          priority: 5,
        });
      }
    }
    this.logger.log(`${builtIns.length} plugins built-in enregistrés`);
  }

  getLoadedPlugins() { return this.registry.getAll(); }
  getActivePlugins() { return this.registry.getActive(); }
}
