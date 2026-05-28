import {
  Injectable, Logger, BadRequestException,
  NotFoundException, ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../shared/database/prisma.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as unzipper from 'unzipper';
import * as yaml from 'yaml';
import { randomUUID } from 'crypto';

export interface PluginManifest {
  name: string;
  displayName: string;
  version: string;
  description?: string;
  author?: string;
  authorEmail?: string;
  category?: string;
  icon?: string;
  dependencies?: string[];
  permissions?: string[];
  routes?: { prefix: string; file: string }[];
  migrations?: string[];
  hooks?: { event: string; handler: string }[];
  menuItems?: {
    id: string;
    label: string;
    icon: string;
    href: string;
    section: string;
    order: number;
  }[];
}

@Injectable()
export class PluginEngineService {
  private readonly logger = new Logger(PluginEngineService.name);
  private readonly pluginsDir: string;

  // Registry in-memory par tenant : tenantId → Set<pluginName>
  private readonly activePlugins = new Map<string, Set<string>>();

  // Manifests chargés : pluginName → manifest
  private readonly manifests = new Map<string, PluginManifest>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
  ) {
    this.pluginsDir = this.config.get<string>('PLUGINS_DIR', path.join(process.cwd(), 'plugins'));
  }

  /**
   * Initialise le registry depuis la DB pour tous les tenants actifs.
   */
  async initializeRegistry(): Promise<void> {
    await this.loadAllManifests();

    const tenantPlugins = await this.prisma.tenantPlugin.findMany({
      where: { isActive: true },
      include: { plugin: true },
    });

    for (const tp of tenantPlugins) {
      if (!this.activePlugins.has(tp.tenantId)) {
        this.activePlugins.set(tp.tenantId, new Set());
      }
      this.activePlugins.get(tp.tenantId)!.add(tp.plugin.name);
    }

    this.logger.log(`✓ Plugin registry initialisé: ${tenantPlugins.length} relations chargées`);
  }

  /**
   * Charge tous les manifests depuis le filesystem.
   */
  async loadAllManifests(): Promise<void> {
    try {
      await fs.mkdir(this.pluginsDir, { recursive: true });
      const entries = await fs.readdir(this.pluginsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        await this.loadManifest(entry.name).catch(e => {
          this.logger.debug(`Manifest ${entry.name}: ${e.message}`);
        });
      }
    } catch (e) {
      this.logger.warn(`[PluginEngine] Dossier plugins inaccessible: ${e.message}`);
    }
  }

  /**
   * Vérifie si un plugin est actif pour un tenant.
   * O(1) — lookup set in-memory.
   */
  isPluginActive(tenantId: string, pluginName: string): boolean {
    return this.activePlugins.get(tenantId)?.has(pluginName) ?? false;
  }

  /**
   * Active un plugin pour un tenant — hot-reload instantané.
   */
  async activatePlugin(tenantId: string, pluginName: string, userId: string): Promise<void> {
    const plugin = await this.prisma.plugin.findUnique({ where: { name: pluginName } });
    if (!plugin) throw new NotFoundException(`Plugin '${pluginName}' introuvable`);

    // Vérif dépendances
    for (const dep of plugin.dependencies) {
      if (!this.isPluginActive(tenantId, dep)) {
        throw new BadRequestException(`Dépendance manquante: '${dep}' doit être activé d'abord`);
      }
    }

    // Upsert DB
    await this.prisma.tenantPlugin.upsert({
      where: { tenantId_pluginId: { tenantId, pluginId: plugin.id } },
      create: { tenantId, pluginId: plugin.id, isActive: true, version: plugin.version, installedBy: userId },
      update: { isActive: true },
    });

    // Registry in-memory
    if (!this.activePlugins.has(tenantId)) {
      this.activePlugins.set(tenantId, new Set());
    }
    this.activePlugins.get(tenantId)!.add(pluginName);

    this.events.emit('plugin.activated', { tenantId, pluginName, userId });
    this.logger.log(`[Tenant:${tenantId}] Plugin '${pluginName}' activé`);
  }

  /**
   * Désactive un plugin — hot-reload instantané.
   */
  async deactivatePlugin(tenantId: string, pluginName: string): Promise<void> {
    const plugin = await this.prisma.plugin.findUnique({ where: { name: pluginName } });
    if (!plugin) throw new NotFoundException(`Plugin '${pluginName}' introuvable`);
    if (plugin.isCore) throw new BadRequestException('Les plugins core ne peuvent pas être désactivés');

    await this.prisma.tenantPlugin.update({
      where: { tenantId_pluginId: { tenantId, pluginId: plugin.id } },
      data: { isActive: false },
    });

    this.activePlugins.get(tenantId)?.delete(pluginName);
    this.events.emit('plugin.deactivated', { tenantId, pluginName });
    this.logger.log(`[Tenant:${tenantId}] Plugin '${pluginName}' désactivé`);
  }

  /**
   * Installe un plugin depuis un fichier ZIP.
   */
  async installFromZip(
    tenantId: string,
    userId: string,
    zipBuffer: Buffer,
    filename: string,
  ): Promise<{ pluginName: string; version: string }> {
    const tmpDir = path.join(this.pluginsDir, `.tmp-${randomUUID()}`);

    try {
      // 1. Extraire le ZIP
      await fs.mkdir(tmpDir, { recursive: true });
      await this.extractZip(zipBuffer, tmpDir);

      // 2. Lire le manifest
      const manifest = await this.readManifestFromDir(tmpDir);
      this.validateManifest(manifest);

      // 3. Vérifier version existante
      const existing = await this.prisma.plugin.findUnique({ where: { name: manifest.name } });
      if (existing && this.compareVersions(manifest.version, existing.version) <= 0) {
        throw new ConflictException(`Version ${manifest.version} inférieure ou égale à la version installée ${existing.version}`);
      }

      // 4. Copier dans le dossier plugins
      const pluginDir = path.join(this.pluginsDir, manifest.name);
      await fs.rm(pluginDir, { recursive: true, force: true });
      await fs.rename(tmpDir, pluginDir);

      // 5. Persister en DB
      const plugin = await this.prisma.plugin.upsert({
        where: { name: manifest.name },
        create: {
          name: manifest.name,
          displayName: manifest.displayName,
          description: manifest.description,
          version: manifest.version,
          author: manifest.author || 'Custom',
          authorEmail: manifest.authorEmail,
          category: (manifest.category?.toUpperCase() as any) || 'TOOLS',
          icon: manifest.icon,
          dependencies: manifest.dependencies || [],
          permissions: manifest.permissions || [],
          manifest: manifest as any,
        },
        update: {
          displayName: manifest.displayName,
          description: manifest.description,
          version: manifest.version,
          manifest: manifest as any,
        },
      });

      // 6. Enregistrer le manifest en mémoire
      this.manifests.set(manifest.name, manifest);

      // 7. Auto-activer
      await this.activatePlugin(tenantId, manifest.name, userId);

      this.events.emit('plugin.installed', { tenantId, pluginName: manifest.name, version: manifest.version });
      this.logger.log(`[Tenant:${tenantId}] Plugin '${manifest.name}' v${manifest.version} installé`);

      return { pluginName: manifest.name, version: manifest.version };
    } catch (err) {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      throw err;
    }
  }

  /**
   * Récupère les éléments de menu de tous les plugins actifs d'un tenant.
   */
  getActiveMenuItems(tenantId: string): any[] {
    const active = this.activePlugins.get(tenantId) || new Set();
    const items: any[] = [];

    for (const pluginName of active) {
      const manifest = this.manifests.get(pluginName);
      if (manifest?.menuItems) {
        items.push(...manifest.menuItems);
      }
    }

    return items.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  /**
   * Récupère la config d'un plugin pour un tenant.
   */
  async getPluginConfig(tenantId: string, pluginName: string): Promise<Record<string, any>> {
    const plugin = await this.prisma.plugin.findUnique({ where: { name: pluginName } });
    if (!plugin) return {};

    const tp = await this.prisma.tenantPlugin.findUnique({
      where: { tenantId_pluginId: { tenantId, pluginId: plugin.id } },
    });

    return (tp?.config as Record<string, any>) || {};
  }

  /**
   * Met à jour la config d'un plugin pour un tenant.
   */
  async updatePluginConfig(tenantId: string, pluginName: string, config: Record<string, any>): Promise<void> {
    const plugin = await this.prisma.plugin.findUnique({ where: { name: pluginName } });
    if (!plugin) throw new NotFoundException(`Plugin '${pluginName}' introuvable`);

    await this.prisma.tenantPlugin.update({
      where: { tenantId_pluginId: { tenantId, pluginId: plugin.id } },
      data: { config },
    });
  }

  // ── Helpers privés ──────────────────────────────────────────

  private async extractZip(buffer: Buffer, destDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const { Writable } = require('stream');
      const readable = require('stream').Readable.from(buffer);
      readable
        .pipe(unzipper.Extract({ path: destDir }))
        .on('close', resolve)
        .on('error', reject);
    });
  }

  private async readManifestFromDir(dir: string): Promise<PluginManifest> {
    // Cherche plugin.yaml ou plugin.json
    for (const filename of ['plugin.yaml', 'plugin.yml', 'plugin.json', 'manifest.yaml', 'manifest.json']) {
      const filepath = path.join(dir, filename);
      try {
        const content = await fs.readFile(filepath, 'utf-8');
        return filename.endsWith('.json') ? JSON.parse(content) : yaml.parse(content);
      } catch { continue; }
    }
    throw new BadRequestException('plugin.yaml ou plugin.json introuvable dans le ZIP');
  }

  private validateManifest(manifest: PluginManifest): void {
    if (!manifest.name) throw new BadRequestException('Champ "name" requis dans le manifest');
    if (!manifest.version) throw new BadRequestException('Champ "version" requis dans le manifest');
    if (!manifest.displayName) throw new BadRequestException('Champ "displayName" requis dans le manifest');
    if (!/^[a-z0-9-]+$/.test(manifest.name)) {
      throw new BadRequestException('Le "name" ne doit contenir que des lettres minuscules, chiffres et tirets');
    }
  }

  private async loadManifest(pluginName: string): Promise<void> {
    const manifest = await this.readManifestFromDir(path.join(this.pluginsDir, pluginName));
    this.manifests.set(pluginName, manifest);
  }

  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      const diff = (parts1[i] || 0) - (parts2[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  }

  getManifests(): Map<string, PluginManifest> {
    return this.manifests;
  }

  getActivePluginsForTenant(tenantId: string): string[] {
    return Array.from(this.activePlugins.get(tenantId) || []);
  }
}
