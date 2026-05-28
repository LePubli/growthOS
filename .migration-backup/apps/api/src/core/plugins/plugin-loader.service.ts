import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
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

  // ← Lire PLUGINS_DIR depuis l'env (défini dans docker-compose: /app/plugins)
  private readonly pluginsDir: string;
  private readonly dynamicRoutes = new Map<string, { method: string; handler: Function }>();

  // Flag pour éviter la boucle infinie
  private _dispatching = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: PluginRegistryService,
    private readonly sandbox: PluginSandboxService,
    private readonly emitter: EventEmitter2,
    private readonly config: ConfigService,
  ) {
    // Utilise PLUGINS_DIR de l'env, fallback sur process.cwd()/plugins
    this.pluginsDir = this.config.get<string>('PLUGINS_DIR', path.join(process.cwd(), 'plugins'));
    this.logger.log(`[PluginLoader] Dossier plugins: ${this.pluginsDir}`);
  }

  async onModuleInit() {
    await fs.mkdir(this.pluginsDir, { recursive: true });
    this.registerBuiltInPlugins();
    await this.loadInstalledPlugins();
    this.logger.log(`✅ PluginLoader — ${this.registry.getActive().length} actifs, ${this.sandbox.getLoaded().length} avec code JS`);
  }

  // ── Écouter les événements et dispatcher aux plugins ────────────────
  // Guard _dispatching pour éviter la boucle infinie
  @OnEvent('prospect.created', { async: true })
  async onProspectCreated(payload: { tenantId: string; prospect: any }) {
    if (this._dispatching) return;
    this._dispatching = true;
    try {
      this.logger.debug(`[PluginLoader] prospect.created → ${this.sandbox.getLoaded().length} plugins JS`);
      // Plugins built-in (ne réémettent PAS via EventEmitter)
      await this.callBuiltInHooks('prospect.created', payload);
      // Plugins JS sandbox
      const ctx = this.createContext('system', payload.tenantId);
      await this.sandbox.callHook('onProspectCreated', ctx, payload.prospect);
    } finally {
      this._dispatching = false;
    }
  }

  @OnEvent('prospect.updated', { async: true })
  async onProspectUpdated(payload: { tenantId: string; prospect: any }) {
    if (this._dispatching) return;
    this._dispatching = true;
    try {
      const ctx = this.createContext('system', payload.tenantId);
      await this.sandbox.callHook('onProspectUpdated', ctx, payload.prospect);
    } finally {
      this._dispatching = false;
    }
  }

  @OnEvent('email.sent', { async: true })
  async onEmailSent(payload: any) {
    await this.callBuiltInHooks('email.sent', payload);
  }

  @OnEvent('workflow.triggered', { async: true })
  async onWorkflowTriggered(payload: any) {
    await this.callBuiltInHooks('workflow.triggered', payload);
  }

  // Appelle les hooks built-in SANS passer par EventEmitter (évite la boucle)
  private async callBuiltInHooks(hookName: string, payload: any) {
    const handlers = this.registry.getHandlers(hookName as HookName);
    for (const handler of handlers) {
      try {
        await handler(payload);
      } catch (e) {
        this.logger.error(`[BuiltIn:${hookName}] ${(e as Error).message}`);
      }
    }
  }

  // ── Plugins built-in ─────────────────────────────────────────────────
  private registerBuiltInPlugins() {
    const builtIns = [
      {
        meta: { name:'prospect-scorer', displayName:'Prospect Scorer', version:'1.0.0', author:'GrowthOS', description:'Score auto', hooks:['prospect.created'] as HookName[], isActive:true },
        hooks: {
          'prospect.created': async (p: any) => this.logger.debug(`[ProspectScorer] +pts pour ${p?.prospect?.email}`),
        },
      },
      {
        meta: { name:'activity-logger', displayName:'Activity Logger', version:'1.0.0', author:'GrowthOS', description:'Journal audit', hooks:['prospect.created','email.sent','workflow.triggered','plugin.activated'] as HookName[], isActive:true },
        hooks: {
          'prospect.created': async (p: any) => this.logger.debug(`[ActivityLogger] Prospect: ${p?.prospect?.email}`),
          'email.sent': async (p: any) => this.logger.debug(`[ActivityLogger] Email: ${p?.subject}`),
          'workflow.triggered': async (p: any) => this.logger.debug(`[ActivityLogger] Workflow: ${p?.workflowId}`),
          'plugin.activated': async (p: any) => this.logger.debug(`[ActivityLogger] Plugin: ${p?.pluginName}`),
        },
      },
    ];

    for (const { meta, hooks } of builtIns) {
      this.registry.register(meta);
      for (const [hookName, handler] of Object.entries(hooks)) {
        this.registry.registerHook({
          pluginName: meta.name,
          hook: hookName as HookName,
          handler,
          priority: 5,
        });
      }
    }
  }

  // ── Charger les plugins depuis filesystem ─────────────────────────────
  private async loadInstalledPlugins() {
    try {
      this.logger.log(`[PluginLoader] Scan de ${this.pluginsDir}`);
      const entries = await fs.readdir(this.pluginsDir, { withFileTypes: true });
      this.logger.log(`[PluginLoader] ${entries.filter(e=>e.isDirectory()).length} dossiers trouvés`);
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
        await this.loadPluginFromDir(entry.name, path.join(this.pluginsDir, entry.name))
          .catch(e => this.logger.warn(`Erreur ${entry.name}: ${e.message}`));
      }
    } catch (e) {
      this.logger.warn(`Plugins dir inaccessible: ${(e as Error).message}`);
    }
  }

  private async loadPluginFromDir(pluginName: string, pluginDir: string) {
    let manifest: any = null;
    for (const f of ['plugin.yaml','plugin.yml','plugin.json']) {
      try {
        const c = await fs.readFile(path.join(pluginDir, f), 'utf-8');
        manifest = f.endsWith('.json') ? JSON.parse(c) : yaml.parse(c);
        break;
      } catch { continue; }
    }
    if (!manifest) return;

    this.registry.register({
      name: manifest.name,
      displayName: manifest.displayName,
      version: manifest.version,
      author: manifest.author || 'Custom',
      description: manifest.description || '',
      hooks: manifest.hooks?.map((h: any) => h.event || h) || [],
      isActive: true,
    });

    await this.sandbox.load(manifest.name, pluginDir);

    if (this.sandbox.isLoaded(manifest.name)) {
      const ctx = this.createContext(manifest.name, 'system');
      await this.sandbox.callPluginHook(manifest.name, 'onActivate', ctx, {});
    }
  }

  // ── Install ZIP ────────────────────────────────────────────────────────
  async installFromZip(tenantId: string, userId: string, buffer: Buffer, filename: string) {
    const tmpDir = path.join(this.pluginsDir, `.tmp-${randomUUID()}`);
    await fs.mkdir(tmpDir, { recursive: true });
    try {
      await new Promise<void>((resolve, reject) => {
        const readable = require('stream').Readable.from(buffer);
        readable.pipe(unzipper.Extract({ path: tmpDir }))
          .on('close', resolve)
          .on('error', reject);
      });

      let manifest: any = null;
      for (const f of ['plugin.yaml','plugin.yml','plugin.json']) {
        try {
          const c = await fs.readFile(path.join(tmpDir, f), 'utf-8');
          manifest = f.endsWith('.json') ? JSON.parse(c) : yaml.parse(c);
          break;
        } catch { continue; }
      }
      if (!manifest?.name) throw new Error('plugin.yaml introuvable à la racine du ZIP');

      const pluginDir = path.join(this.pluginsDir, manifest.name);
      await fs.rm(pluginDir, { recursive: true, force: true });
      await fs.rename(tmpDir, pluginDir);

      await this.prisma.plugin.upsert({
        where: { name: manifest.name },
        create: {
          name: manifest.name, displayName: manifest.displayName,
          description: manifest.description, version: manifest.version,
          author: manifest.author || 'Custom',
          category: (manifest.category?.toUpperCase() || 'TOOLS') as any,
          isPublic: true, dependencies: [], permissions: [], manifest,
        },
        update: { displayName: manifest.displayName, version: manifest.version, manifest },
      });

      const plugin = await this.prisma.plugin.findUnique({ where: { name: manifest.name } });
      if (plugin) {
        await this.prisma.tenantPlugin.upsert({
          where: { tenantId_pluginId: { tenantId, pluginId: plugin.id } },
          create: { tenantId, pluginId: plugin.id, isActive: true, version: manifest.version, installedBy: userId },
          update: { isActive: true },
        });
      }

      await this.loadPluginFromDir(manifest.name, pluginDir);
      this.logger.log(`✅ Plugin "${manifest.name}" v${manifest.version} installé — JS: ${this.sandbox.isLoaded(manifest.name)}`);
      return { pluginName: manifest.name, version: manifest.version, hasCode: this.sandbox.isLoaded(manifest.name) };
    } catch (err) {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      throw err;
    }
  }

  createContext(pluginName: string, tenantId: string): PluginContext {
    return new PluginContext(tenantId, pluginName, this.prisma, this.emitter, {}, this.dynamicRoutes);
  }

  getDynamicRoutes() { return this.dynamicRoutes; }
  getLoadedPlugins() { return this.registry.getAll(); }
  getActivePlugins() { return this.registry.getActive(); }
  getSandboxedPlugins() { return this.sandbox.getLoaded(); }
}
