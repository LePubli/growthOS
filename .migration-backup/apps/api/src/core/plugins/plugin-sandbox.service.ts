import { Injectable, Logger } from '@nestjs/common';
import * as vm from 'vm';
import * as path from 'path';
import * as fs from 'fs/promises';
import { IPluginContext } from './plugin-context';

export interface ILoadedPlugin {
  name: string;
  instance: any;
  // Hooks supportés
  hooks: Set<string>;
}

/**
 * PluginSandboxService — charge et exécute le code JS des plugins
 * dans un contexte VM isolé (comme require() mais sandboxé).
 *
 * Le plugin reçoit un `ctx` (IPluginContext) et ne peut pas accéder
 * au reste de l'application directement.
 */
@Injectable()
export class PluginSandboxService {
  private readonly logger = new Logger(PluginSandboxService.name);

  // pluginName → instance chargée
  private readonly loaded = new Map<string, ILoadedPlugin>();

  /**
   * Charge un plugin depuis son dossier.
   * Le plugin doit avoir un dist/index.js qui exporte une classe.
   */
  async load(pluginName: string, pluginDir: string): Promise<boolean> {
    const entryPoints = [
      path.join(pluginDir, 'dist', 'index.js'),
      path.join(pluginDir, 'index.js'),
      path.join(pluginDir, 'plugin.js'),
    ];

    let code: string | null = null;
    let entryFile: string | null = null;

    for (const entry of entryPoints) {
      try {
        code = await fs.readFile(entry, 'utf-8');
        entryFile = entry;
        break;
      } catch { continue; }
    }

    if (!code) {
      this.logger.debug(`[${pluginName}] Pas de code JS trouvé — plugin manifest-only`);
      return false;
    }

    try {
      // Sandbox VM — donne accès à console, setTimeout, fetch mais PAS à process, require natif
      const sandbox = vm.createContext({
        console: {
          log: (...a: any[]) => this.logger.log(`[Plugin:${pluginName}] ${a.join(' ')}`),
          warn: (...a: any[]) => this.logger.warn(`[Plugin:${pluginName}] ${a.join(' ')}`),
          error: (...a: any[]) => this.logger.error(`[Plugin:${pluginName}] ${a.join(' ')}`),
        },
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        fetch: globalThis.fetch,
        Promise,
        module: { exports: {} },
        exports: {},
        __pluginName: pluginName,
        __dirname: path.dirname(entryFile!),
      });

      // Exécuter le code dans le sandbox
      const script = new vm.Script(code, { filename: entryFile! });
      script.runInContext(sandbox);

      // Récupérer l'export (class ou objet)
      const exported = sandbox.module.exports || sandbox.exports;
      const PluginClass = exported.default || exported;

      if (typeof PluginClass !== 'function' && typeof PluginClass !== 'object') {
        this.logger.warn(`[${pluginName}] Export invalide — doit être une classe ou un objet`);
        return false;
      }

      // Instancier le plugin
      const instance = typeof PluginClass === 'function' ? new PluginClass() : PluginClass;

      // Détecter les hooks disponibles
      const hooks = new Set<string>();
      const hookMethods = [
        'onActivate', 'onDeactivate', 'onProspectCreated', 'onProspectUpdated',
        'onProspectScored', 'onEmailSent', 'onEmailOpened', 'onEmailReplied',
        'onWorkflowTriggered', 'onDealCreated', 'onDealStageChanged',
        'getMenuItems', 'getRoutes', 'getWidgets', 'getDashboardCards',
      ];
      hookMethods.forEach(m => { if (typeof instance[m] === 'function') hooks.add(m); });

      this.loaded.set(pluginName, { name: pluginName, instance, hooks });
      this.logger.log(`✓ Plugin "${pluginName}" chargé — hooks: [${[...hooks].join(', ')}]`);
      return true;
    } catch (err) {
      this.logger.error(`[${pluginName}] Erreur chargement: ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * Décharge un plugin (hot-unload)
   */
  unload(pluginName: string): void {
    this.loaded.delete(pluginName);
    this.logger.log(`Plugin "${pluginName}" déchargé`);
  }

  /**
   * Appelle un hook sur tous les plugins chargés qui le supportent
   */
  async callHook(hookName: string, ctx: IPluginContext, payload: any): Promise<void> {
    for (const [name, plugin] of this.loaded) {
      if (!plugin.hooks.has(hookName)) continue;
      try {
        await plugin.instance[hookName](ctx, payload);
      } catch (err) {
        this.logger.error(`[${name}] Erreur hook "${hookName}": ${(err as Error).message}`);
      }
    }
  }

  /**
   * Appelle un hook sur un plugin spécifique
   */
  async callPluginHook(pluginName: string, hookName: string, ctx: IPluginContext, payload: any): Promise<any> {
    const plugin = this.loaded.get(pluginName);
    if (!plugin || !plugin.hooks.has(hookName)) return null;
    try {
      return await plugin.instance[hookName](ctx, payload);
    } catch (err) {
      this.logger.error(`[${pluginName}] Erreur "${hookName}": ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Collecte les menu items de tous les plugins chargés
   */
  async getMenuItems(ctx: IPluginContext): Promise<any[]> {
    const items: any[] = [];
    for (const [, plugin] of this.loaded) {
      if (!plugin.hooks.has('getMenuItems')) continue;
      try {
        const pluginItems = await plugin.instance.getMenuItems(ctx);
        if (Array.isArray(pluginItems)) items.push(...pluginItems);
      } catch { continue; }
    }
    return items;
  }

  /**
   * Collecte les dashboard cards de tous les plugins
   */
  async getDashboardCards(ctx: IPluginContext): Promise<any[]> {
    const cards: any[] = [];
    for (const [, plugin] of this.loaded) {
      if (!plugin.hooks.has('getDashboardCards')) continue;
      try {
        const pluginCards = await plugin.instance.getDashboardCards(ctx);
        if (Array.isArray(pluginCards)) cards.push(...pluginCards);
      } catch { continue; }
    }
    return cards;
  }

  isLoaded(pluginName: string): boolean { return this.loaded.has(pluginName); }
  getLoaded(): string[] { return [...this.loaded.keys()]; }
}
