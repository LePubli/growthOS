import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

// ─── Types ────────────────────────────────────────────────────────────────────
export type HookName =
  | 'prospect.created'
  | 'prospect.updated'
  | 'prospect.scored'
  | 'email.sent'
  | 'email.opened'
  | 'email.replied'
  | 'workflow.triggered'
  | 'workflow.completed'
  | 'plugin.activated'
  | 'plugin.deactivated'
  | 'tenant.created';

export interface PluginMeta {
  name:        string;
  displayName: string;
  version:     string;
  author:      string;
  description: string;
  hooks:       HookName[];  // Hooks que ce plugin écoute
  routes?:     string[];    // Routes API additionnelles
  isActive:    boolean;
}

export interface PluginHookHandler {
  pluginName: string;
  hook:       HookName;
  handler:    (payload: any) => Promise<void>;
  priority:   number; // 1-10, plus bas = priorité plus haute
}

// ─── Registry ─────────────────────────────────────────────────────────────────
@Injectable()
export class PluginRegistryService {
  private readonly logger = new Logger(PluginRegistryService.name);

  // Map pluginName → meta
  private readonly plugins = new Map<string, PluginMeta>();

  // Map hookName → handlers triés par priorité
  private readonly hookHandlers = new Map<HookName, PluginHookHandler[]>();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  // ── Enregistrer un plugin ──────────────────────────────────────────────────
  register(meta: PluginMeta): void {
    this.plugins.set(meta.name, meta);
    this.logger.log(`Plugin enregistré: ${meta.displayName} v${meta.version}`);
  }

  // ── Enregistrer un handler de hook ────────────────────────────────────────
  registerHook(handler: PluginHookHandler): void {
    const existing = this.hookHandlers.get(handler.hook) || [];
    existing.push(handler);
    existing.sort((a, b) => a.priority - b.priority);
    this.hookHandlers.set(handler.hook, existing);
    this.logger.debug(`Hook '${handler.hook}' enregistré par ${handler.pluginName}`);
  }

  // ── Émettre un hook vers tous les plugins qui l'écoutent ──────────────────
  async emit(hook: HookName, payload: any): Promise<void> {
    const handlers = this.hookHandlers.get(hook) || [];
    if (handlers.length === 0) return;

    this.logger.debug(`Hook '${hook}' → ${handlers.length} handler(s)`);

    for (const h of handlers) {
      const plugin = this.plugins.get(h.pluginName);
      if (!plugin?.isActive) continue;
      try {
        await h.handler(payload);
      } catch (err) {
        this.logger.error(`Erreur hook '${hook}' dans ${h.pluginName}: ${(err as Error).message}`);
      }
    }

    // Aussi émettre via EventEmitter2 pour les listeners NestJS natifs
    this.eventEmitter.emit(hook, payload);
  }

  // ── Activer / Désactiver un plugin ────────────────────────────────────────
  activate(name: string): void {
    const plugin = this.plugins.get(name);
    if (!plugin) throw new Error(`Plugin inconnu: ${name}`);
    plugin.isActive = true;
    this.logger.log(`Plugin activé: ${name}`);
    this.emit('plugin.activated', { pluginName: name });
  }

  deactivate(name: string): void {
    const plugin = this.plugins.get(name);
    if (!plugin) throw new Error(`Plugin inconnu: ${name}`);
    plugin.isActive = false;
    this.logger.log(`Plugin désactivé: ${name}`);
    this.emit('plugin.deactivated', { pluginName: name });
  }

  // ── Getters ───────────────────────────────────────────────────────────────
  getAll(): PluginMeta[] {
    return Array.from(this.plugins.values());
  }

  getActive(): PluginMeta[] {
    return this.getAll().filter(p => p.isActive);
  }

  get(name: string): PluginMeta | undefined {
    return this.plugins.get(name);
  }

  isActive(name: string): boolean {
    return this.plugins.get(name)?.isActive ?? false;
  }
}
