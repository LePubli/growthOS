import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { PluginEngineService } from './plugin-engine.service';
import { EventBusService } from '../events/event-bus.service';

const CORE_PLUGINS = new Set(['auth', 'tenants', 'plugins', 'themes', 'notifications', 'health']);

@Injectable()
export class PluginsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: PluginEngineService,
    private readonly events: EventBusService,
  ) {}

  async listMarketplace(filters: { category?: string; search?: string; page?: number }) {
    const { category, search, page = 1 } = filters;
    const limit = 20;

    const where: any = { isPublic: true };
    if (category) where.category = category.toUpperCase();
    if (search) where.OR = [
      { displayName: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { tags: { has: search.toLowerCase() } },
    ];

    const [items, total] = await Promise.all([
      this.prisma.plugin.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ isVerified: 'desc' }, { installCount: 'desc' }],
      }),
      this.prisma.plugin.count({ where }),
    ]);

    return { items, total, page, pages: Math.ceil(total / limit) };
  }

  async listForTenant(tenantId: string) {
    const [allPlugins, tenantPlugins] = await Promise.all([
      this.prisma.plugin.findMany({ orderBy: { category: 'asc' } }),
      this.prisma.tenantPlugin.findMany({
        where: { tenantId },
        include: { plugin: true },
      }),
    ]);

    const tpMap = new Map(tenantPlugins.map(tp => [tp.plugin.name, tp]));
    const manifests = this.engine.getManifests();

    return allPlugins.map(plugin => {
      const tp = tpMap.get(plugin.name);
      const manifest = manifests.get(plugin.name) || {};
      return {
        ...plugin,
        isInstalled: !!tp,
        isActive: this.engine.isPluginActive(tenantId, plugin.name),
        isCore: CORE_PLUGINS.has(plugin.name),
        installedVersion: tp?.version,
        config: tp?.config || {},
        manifest,
      };
    });
  }

  async getPlugin(name: string, tenantId: string) {
    const plugin = await this.prisma.plugin.findUnique({ where: { name } });
    if (!plugin) throw new NotFoundException(`Plugin '${name}' introuvable`);

    const tp = await this.prisma.tenantPlugin.findFirst({
      where: { tenantId, plugin: { name } },
    });

    const manifest = this.engine.getManifests().get(name) || {};

    return {
      ...plugin,
      isInstalled: !!tp,
      isActive: this.engine.isPluginActive(tenantId, name),
      isCore: CORE_PLUGINS.has(name),
      config: tp?.config || {},
      manifest,
    };
  }

  async installFromZip(tenantId: string, userId: string, buffer: Buffer, filename: string) {
    return this.engine.installFromZip(tenantId, userId, buffer, filename);
  }

  async activate(tenantId: string, name: string, userId: string) {
    if (CORE_PLUGINS.has(name)) throw new BadRequestException('Plugin core toujours actif');
    await this.engine.activatePlugin(tenantId, name, userId);
    await this.events.publish({ name: 'plugin.activated', tenantId, payload: { pluginName: name }, source: 'system' });
  }

  async deactivate(tenantId: string, name: string) {
    if (CORE_PLUGINS.has(name)) throw new BadRequestException('Impossible de désactiver un plugin core');
    await this.engine.deactivatePlugin(tenantId, name);
    await this.events.publish({ name: 'plugin.deactivated', tenantId, payload: { pluginName: name }, source: 'system' });
  }

  async toggle(tenantId: string, name: string, userId: string) {
    const isActive = this.engine.isPluginActive(tenantId, name);
    if (isActive) {
      await this.deactivate(tenantId, name);
      return { plugin: name, status: 'inactive', hotReload: true };
    } else {
      await this.activate(tenantId, name, userId);
      return { plugin: name, status: 'active', hotReload: true };
    }
  }

  async getConfig(tenantId: string, name: string) {
    return this.engine.getPluginConfig(tenantId, name);
  }

  async updateConfig(tenantId: string, name: string, config: Record<string, any>) {
    return this.engine.updatePluginConfig(tenantId, name, config);
  }

  async getMenuItems(tenantId: string) {
    return this.engine.getActiveMenuItems(tenantId);
  }

  async uninstall(tenantId: string, name: string) {
    if (CORE_PLUGINS.has(name)) throw new BadRequestException('Impossible de désinstaller un plugin core');

    // Désactiver d'abord
    await this.engine.deactivatePlugin(tenantId, name).catch(() => {});

    // Supprimer la relation tenant-plugin
    const plugin = await this.prisma.plugin.findUnique({ where: { name } });
    if (plugin) {
      await this.prisma.tenantPlugin.deleteMany({ where: { tenantId, pluginId: plugin.id } });
    }

    await this.events.publish({ name: 'plugin.uninstalled', tenantId, payload: { pluginName: name } });
  }
}
