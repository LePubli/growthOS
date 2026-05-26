import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PluginRegistryService, PluginMeta, HookName } from './plugin-registry.service';
import { PluginSandboxService } from './plugin-sandbox.service';
import { PluginContext } from './plugin-context';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as unzipper from 'unzipper';
import * as yaml from 'yaml';
import { randomUUID } from 'crypto';

@Injectable()
export class PluginLoaderService implements OnModuleInit {
  private readonly logger = new Logger(PluginLoaderService.name);
  private readonly pluginsDir = path.join(process.cwd(), 'plugins');
  // Routes dynamiques enregistrées par les plugins
  private readonly dynamicRoutes = new Map<string, { method: string; handler: Function }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: PluginRegistryService,
    private readonly sandbox: PluginSandboxService,
    private readonly emitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    await fs.mkdir(this.pluginsDir, { recursive: true });
    this.registerBuiltInPlugins();
    await this.loadInstalledPlugins();
    this.logger.log(`✅ PluginLoader — ${this.registry.getActive().length} actifs, ${this.sandbox.getLoaded().length} avec code JS`);
  }

  // ── Plugins built-in (pas de code externe, juste des hooks NestJS) ────
  private registerBuiltInPlugins() {
    const builtIns: Array<{ meta: PluginMeta; hooks: Partial<Record<HookName, (payload: any) => Promise<void>>> }> = [
      {
        meta: { name: 'prospect-scorer', displayName: 'Prospect Scorer', version: '1.0.0', author: 'GrowthOS', description: 'Score automatiquement les prospects', hooks: ['prospect.created', 'email.opened', 'email.replied'], isActive: true },
        hooks: {
          'prospect.created': async (p) => this.logger.debug(`[ProspectScorer] +50pts pour ${p?.email}`),
          'email.opened': async (p) => this.logger.debug(`[ProspectScorer] +5pts pour ${p?.prospectId}`),
          'email.replied': async (p) => this.logger.debug(`[ProspectScorer] +20pts pour ${p?.prospectId}`),
        },
      },
      {
        meta: { name: 'activity-logger', displayName: 'Activity Logger', version: '1.0.0', author: 'GrowthOS', description: "Journal d'audit", hooks: ['prospect.created', 'email.sent', 'workflow.triggered', 'plugin.activated'], isActive: true },
        hooks: {
          'prospect.created': async (p) => this.logger.debug(`[ActivityLogger] Prospect: ${p?.email}`),
          'email.sent': async (p) => this.logger.debug(`[ActivityLogger] Email: ${p?.subject}`),
          'workflow.triggered': async (p) => this.logger.debug(`[ActivityLogger] Workflow: ${p?.workflowId}`),
          'plugin.activated': async (p) => this.logger.debug(`[ActivityLogger] Plugin activé: ${p?.pluginName}`),
        },
      },
    ];

    for (const { meta, hooks } of builtIns) {
      this.registry.register(meta);
      for (const [hookName, handler] of Object.entries(hooks)) {
        this.registry.registerHook({ pluginName: meta.name, hook: hookName as HookName, handler: handler!, priority: 5 });
      }
    }
  }

  // ── Charger les plugins installés depuis le filesystem ────────────────
  private async loadInstalledPlugins() {
    try {
      const entries = await fs.readdir(this.pluginsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
        const pluginDir = path.join(this.pluginsDir, entry.name);
        await this.loadPluginFromDir(entry.name, pluginDir).catch(e =>
          this.logger.warn(`Erreur chargement ${entry.name}: ${e.message}`)
        );
      }
    } catch (e) {
      this.logger.warn(`Dossier plugins: ${(e as Error).message}`);
    }
  }

  private async loadPluginFromDir(pluginName: string, pluginDir: string) {
    // 1. Lire manifest
    let manifest: any = null;
    for (const f of ['plugin.yaml', 'plugin.yml', 'plugin.json']) {
      try {
        const content = await fs.readFile(path.join(pluginDir, f), 'utf-8');
        manifest = f.endsWith('.json') ? JSON.parse(content) : yaml.parse(content);
        break;
      } catch { continue; }
    }
    if (!manifest) return;

    // 2. Enregistrer dans le registry
    this.registry.register({
      name: manifest.name,
      displayName: manifest.displayName,
      version: manifest.version,
      author: manifest.author || 'Custom',
      description: manifest.description || '',
      hooks: manifest.hooks?.map((h: any) => h.event || h) || [],
      isActive: true,
    });

    // 3. Charger le code JS dans le sandbox
    await this.sandbox.load(manifest.name, pluginDir);

    // 4. Appeler onActivate si disponible
    if (this.sandbox.isLoaded(manifest.name)) {
      const ctx = this.createContext(manifest.name, 'system');
      await this.sandbox.callPluginHook(manifest.name, 'onActivate', ctx, {});
    }
  }

  // ── Installer depuis ZIP ───────────────────────────────────────────────
  async installFromZip(tenantId: string, userId: string, buffer: Buffer, filename: string) {
    const tmpDir = path.join(this.pluginsDir, `.tmp-${randomUUID()}`);
    await fs.mkdir(tmpDir, { recursive: true });

    try {
      // Extraire le ZIP
      await new Promise<void>((resolve, reject) => {
        const readable = require('stream').Readable.from(buffer);
        readable.pipe(unzipper.Extract({ path: tmpDir }))
          .on('close', resolve)
          .on('error', reject);
      });

      // Lire manifest
      let manifest: any = null;
      for (const f of ['plugin.yaml', 'plugin.yml', 'plugin.json']) {
        try {
          const content = await fs.readFile(path.join(tmpDir, f), 'utf-8');
          manifest = f.endsWith('.json') ? JSON.parse(content) : yaml.parse(content);
          break;
        } catch { continue; }
      }
      if (!manifest?.name) throw new Error('plugin.yaml ou plugin.json introuvable');

      const pluginDir = path.join(this.pluginsDir, manifest.name);
      await fs.rm(pluginDir, { recursive: true, force: true });
      await fs.rename(tmpDir, pluginDir);

      // Persister en DB
      await this.prisma.plugin.upsert({
        where: { name: manifest.name },
        create: {
          name: manifest.name,
          displayName: manifest.displayName,
          description: manifest.description,
          version: manifest.version,
          author: manifest.author || 'Custom',
          category: (manifest.category?.toUpperCase() || 'TOOLS') as any,
          isPublic: true,
          dependencies: manifest.dependencies || [],
          permissions: manifest.permissions || [],
          manifest: manifest,
        },
        update: { displayName: manifest.displayName, version: manifest.version, manifest },
      });

      // Activer pour le tenant
      const plugin = await this.prisma.plugin.findUnique({ where: { name: manifest.name } });
      if (plugin) {
        await this.prisma.tenantPlugin.upsert({
          where: { tenantId_pluginId: { tenantId, pluginId: plugin.id } },
          create: { tenantId, pluginId: plugin.id, isActive: true, version: manifest.version, installedBy: userId },
          update: { isActive: true },
        });
      }

      // Charger dans le sandbox
      await this.loadPluginFromDir(manifest.name, pluginDir);

      this.logger.log(`✅ Plugin "${manifest.name}" v${manifest.version} installé et chargé`);
      return { pluginName: manifest.name, version: manifest.version, hasCode: this.sandbox.isLoaded(manifest.name) };
    } catch (err) {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      throw err;
    }
  }

  // ── Émettre un hook vers tous les plugins (registry + sandbox) ────────
  async emit(hookName: HookName | string, tenantId: string, payload: any) {
    // 1. Plugins built-in via registry
    await this.registry.emit(hookName as HookName, payload);

    // 2. Plugins avec code JS via sandbox
    const ctx = this.createContext('system', tenantId);
    await this.sandbox.callHook(hookName, ctx, payload);
  }

  // ── Créer un contexte plugin ──────────────────────────────────────────
  createContext(pluginName: string, tenantId: string): PluginContext {
    return new PluginContext(
      tenantId,
      pluginName,
      this.prisma,
      this.emitter,
      {},
      this.dynamicRoutes,
    );
  }

  getDynamicRoutes() { return this.dynamicRoutes; }
  getLoadedPlugins() { return this.registry.getAll(); }
  getActivePlugins() { return this.registry.getActive(); }
  getSandboxedPlugins() { return this.sandbox.getLoaded(); }
}
