import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../shared/database/prisma.service';
import { PluginRegistryService, PluginMeta, HookName } from './plugin-registry.service';

/**
 * PluginLoaderService — charge les plugins actifs depuis la base au démarrage
 * et expose l'API d'enregistrement pour les plugins natifs (built-in).
 *
 * Architecture :
 * 1. Built-in plugins  → enregistrés au démarrage via registerBuiltIn()
 * 2. External plugins  → chargés depuis /app/plugins/{name}/index.js (à venir)
 * 3. API plugins       → activés/désactivés via l'API, état stocké en DB
 */
@Injectable()
export class PluginLoaderService implements OnModuleInit {
  private readonly logger = new Logger(PluginLoaderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: PluginRegistryService,
  ) {}

  async onModuleInit() {
    this.registerBuiltInPlugins();
    await this.syncWithDatabase();
    this.logger.log(`✅ PluginLoader initialisé — ${this.registry.getActive().length} plugins actifs`);
  }

  // ── 1. Plugins natifs intégrés à GrowthOS ─────────────────────────────────
  private registerBuiltInPlugins() {
    const builtIns: Array<{ meta: PluginMeta; hooks: Partial<Record<HookName, (payload: any) => Promise<void>>> }> = [
      {
        meta: {
          name: 'prospect-scorer',
          displayName: 'Prospect Scorer',
          version: '1.0.0',
          author: 'GrowthOS',
          description: 'Score automatiquement les prospects basé sur leur comportement',
          hooks: ['prospect.created', 'email.opened', 'email.replied'],
          isActive: true,
        },
        hooks: {
          'prospect.created': async (payload) => {
            this.logger.debug(`[ProspectScorer] Nouveau prospect: ${payload.email} → score initial 50`);
            // Ici : mettre à jour le score en DB
          },
          'email.opened': async (payload) => {
            this.logger.debug(`[ProspectScorer] Email ouvert → +5 points pour ${payload.prospectId}`);
          },
          'email.replied': async (payload) => {
            this.logger.debug(`[ProspectScorer] Réponse reçue → +20 points pour ${payload.prospectId}`);
          },
        },
      },
      {
        meta: {
          name: 'activity-logger',
          displayName: 'Activity Logger',
          version: '1.0.0',
          author: 'GrowthOS',
          description: 'Enregistre toutes les activités dans le journal d\'audit',
          hooks: ['prospect.created', 'email.sent', 'workflow.triggered', 'plugin.activated'],
          isActive: true,
        },
        hooks: {
          'prospect.created': async (payload) => {
            this.logger.debug(`[ActivityLogger] Prospect créé: ${JSON.stringify(payload)}`);
          },
          'email.sent': async (payload) => {
            this.logger.debug(`[ActivityLogger] Email envoyé: ${payload.subject}`);
          },
          'workflow.triggered': async (payload) => {
            this.logger.debug(`[ActivityLogger] Workflow déclenché: ${payload.workflowId}`);
          },
          'plugin.activated': async (payload) => {
            this.logger.debug(`[ActivityLogger] Plugin activé: ${payload.pluginName}`);
          },
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

  // ── 2. Sync avec la base de données ──────────────────────────────────────
  private async syncWithDatabase() {
    try {
      // Récupérer les plugins actifs en base
      const dbPlugins = await this.prisma.plugin.findMany({
        where: { isActive: true },
      });

      for (const dbPlugin of dbPlugins) {
        const registered = this.registry.get(dbPlugin.name);
        if (registered && !registered.isActive) {
          this.registry.activate(dbPlugin.name);
        }
      }

      this.logger.log(`Sync DB: ${dbPlugins.length} plugins actifs en base`);
    } catch (err) {
      // La table plugins peut ne pas exister encore
      this.logger.warn(`Sync DB plugins ignorée: ${(err as Error).message}`);
    }
  }

  // ── 3. API publique pour les controllers ──────────────────────────────────
  async activatePlugin(name: string, tenantId?: string): Promise<void> {
    this.registry.activate(name);
    // Persister en DB si le plugin est connu
    try {
      await this.prisma.plugin.updateMany({
        where: { name },
        data: { isActive: true },
      });
    } catch { /* plugin pas encore en DB */ }
  }

  async deactivatePlugin(name: string, tenantId?: string): Promise<void> {
    this.registry.deactivate(name);
    try {
      await this.prisma.plugin.updateMany({
        where: { name },
        data: { isActive: false },
      });
    } catch { /* plugin pas encore en DB */ }
  }

  getLoadedPlugins() {
    return this.registry.getAll();
  }

  getActivePlugins() {
    return this.registry.getActive();
  }
}
