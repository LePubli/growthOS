/**
 * ============================================================
 * GrowthOS Plugin SDK - Types & Interfaces
 * ============================================================
 */

import { z } from 'zod';

// ── Manifest Schema (validation Zod) ────────────────────────────

export const PluginManifestSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/, "Le nom du plugin doit contenir uniquement des minuscules, chiffres et tirets"),
  displayName: z.string().min(1).max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Version doit être au format semver (ex: 1.0.0)"),
  description: z.string().max(500).optional(),
  author: z.string().max(100).optional(),
  authorEmail: z.string().email().optional(),
  category: z.enum(['CRM', 'MARKETING', 'ANALYTICS', 'PROSPECTING', 'AI', 'SECURITY', 'AUTOMATION', 'TOOLS']).optional(),
  icon: z.string().max(50).optional(),
  dependencies: z.array(z.string()).default([]),
  permissions: z.array(z.string()).default([]),
  routes: z.array(z.object({
    prefix: z.string(),
    file: z.string(),
  })).optional(),
  migrations: z.array(z.string()).optional(),
  hooks: z.array(z.object({
    event: z.string(),
    handler: z.string(),
  })).optional(),
  menuItems: z.array(z.object({
    id: z.string(),
    label: z.string(),
    icon: z.string(),
    href: z.string(),
    section: z.string(),
    order: z.number().int().positive(),
  })).optional(),
  settings: z.array(z.object({
    key: z.string(),
    label: z.string(),
    type: z.enum(['boolean', 'number', 'string', 'array', 'object']),
    default: z.any().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
  })).optional(),
});

export type PluginManifest = z.infer<typeof PluginManifestSchema>;

// ── Plugin Context (API disponible pour les plugins) ─────────────

export interface PluginContext {
  tenantId: string;
  pluginName: string;
  
  // Database (Prisma scoped to tenant)
  db: {
    prospects: {
      findMany: (args?: any) => Promise<any[]>;
      findFirst: (args?: any) => Promise<any>;
      create: (args: any) => Promise<any>;
      update: (args: any) => Promise<any>;
      count: (args?: any) => Promise<number>;
    };
    deals: {
      findMany: (args?: any) => Promise<any[]>;
      create: (args: any) => Promise<any>;
      update: (args: any) => Promise<any>;
    };
    signals: {
      findMany: (args?: any) => Promise<any[]>;
      create: (args: any) => Promise<any>;
    };
    raw: (sql: string, ...args: any[]) => Promise<any>;
  };

  // Events
  events: {
    emit: (event: string, payload: any) => void;
    on: (event: string, handler: (payload: any) => void) => void;
  };

  // HTTP client for external calls
  http: {
    get: (url: string, options?: RequestInit) => Promise<any>;
    post: (url: string, body: any, options?: RequestInit) => Promise<any>;
  };

  // Plugin config (stored in DB)
  config: {
    get: (key: string, defaultValue?: any) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
    getAll: () => Promise<Record<string, any>>;
  };

  // Logger
  log: (message: string, level?: 'log' | 'warn' | 'error') => void;
}

// ── Plugin Definition Interface ──────────────────────────────────

export interface PluginDefinition {
  /**
   * Initialisation du plugin (appelé à l'activation)
   */
  onActivate?: (ctx: PluginContext) => Promise<void>;
  
  /**
   * Nettoyage du plugin (appelé à la désactivation)
   */
  onDeactivate?: (ctx: PluginContext) => Promise<void>;
  
  /**
   * Installation du plugin (appelé une fois à l'installation)
   */
  onInstall?: (ctx: PluginContext) => Promise<void>;
  
  /**
   * Désinstallation du plugin
   */
  onUninstall?: (ctx: PluginContext) => Promise<void>;
  
  /**
   * Hooks événementiels que le plugin écoute
   * Ex: { 'prospect:created': handler, 'pipeline:stageChanged': handler }
   */
  hooks?: Record<string, (payload: any, ctx: PluginContext) => Promise<void>>;
}

// ── Event Types (Core → Plugins) ─────────────────────────────────

export type DomainEvent = 
  | { name: 'prospect:created'; payload: { id: string; tenantId: string; data: any } }
  | { name: 'prospect:updated'; payload: { id: string; tenantId: string; data: any } }
  | { name: 'prospect:deleted'; payload: { id: string; tenantId: string } }
  | { name: 'pipeline:stageChanged'; payload: { dealId: string; tenantId: string; fromStage: string; toStage: string } }
  | { name: 'deal:created'; payload: { id: string; tenantId: string; data: any } }
  | { name: 'sequence:enrolled'; payload: { prospectId: string; tenantId: string; sequenceId: string } }
  | { name: 'sequence:completed'; payload: { prospectId: string; tenantId: string; sequenceId: string } }
  | { name: 'email:sent'; payload: { prospectId: string; tenantId: string; sequenceId: string; step: number } }
  | { name: 'signal:detected'; payload: { id: string; tenantId: string; type: string; companyId: string } }
  | { name: 'tenant:created'; payload: { tenantId: string; userId: string } }
  | { name: 'plugin:installed'; payload: { pluginName: string; tenantId: string; userId: string } }
  | { name: 'plugin:activated'; payload: { pluginName: string; tenantId: string; userId: string } }
  | { name: 'plugin:deactivated'; payload: { pluginName: string; tenantId: string } };

// ── UI Slot Props (pour injection de composants) ─────────────────

export interface DashboardSlotProps {
  tenantId: string;
  userId: string;
}

export interface ProspectActionsSlotProps {
  prospectId: string;
  tenantId: string;
  prospect: any;
}

export interface PipelineExtensionSlotProps {
  dealId: string;
  tenantId: string;
  stage: string;
}

export interface SequenceExtensionSlotProps {
  sequenceId: string;
  tenantId: string;
}

// ── Plugin Registry Entry (DB model) ─────────────────────────────

export interface PluginRegistryEntry {
  id: string;
  slug: string;
  version: string;
  manifest: PluginManifest;
  isActive: boolean;
  isInstalled: boolean;
  config: Record<string, any>;
  installedAt: Date;
  updatedAt: Date;
}

// ── Hook Handler Type ────────────────────────────────────────────

export type HookHandler = (payload: any, ctx: PluginContext) => Promise<void>;

// ── Export principal ─────────────────────────────────────────────

export const PluginSDK = {
  validateManifest: (manifest: unknown): { success: boolean; data?: PluginManifest; error?: string } => {
    const result = PluginManifestSchema.safeParse(manifest);
    if (!result.success) {
      return { success: false, error: result.error.errors.map(e => e.message).join(', ') };
    }
    return { success: true, data: result.data };
  },
};

export default PluginSDK;
