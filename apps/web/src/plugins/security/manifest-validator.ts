/**
 * ============================================================
 * GrowthOS Plugin Security: Manifest Validator
 * ============================================================
 * Validation stricte des manifests plugins avec Zod
 * - Vérification SemVer
 * - Whitelist des permissions
 * - Validation des routes et hooks
 * - Génération d'empreinte SHA256
 */

import { z } from 'zod';
import { createHash } from 'crypto';

// ── Constantes de Sécurité ───────────────────────────────────────

const ALLOWED_PERMISSIONS = [
  'accounts:read', 'accounts:write',
  'contacts:read', 'contacts:write',
  'deals:read', 'deals:write',
  'activities:read', 'activities:write',
  'products:read', 'products:write',
  'prospects:read', 'prospects:write',
  'sequences:read', 'sequences:write',
  'files:read', 'files:write',
  'settings:read', 'settings:write',
];

const ALLOWED_HOOKS = [
  'prospect:created',
  'prospect:updated',
  'prospect:deleted',
  'pipeline:stageChanged',
  'sequence:enrolled',
  'sequence:completed',
  'deal:created',
  'deal:updated',
  'deal:closed',
];

const SEMVER_REGEX = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

// ── Schémas de Validation ────────────────────────────────────────

const PluginRouteSchema = z.string().regex(/^\/api\/v1\/plugins\/[a-z0-9-]+\//, {
  message: "Les routes doivent commencer par /api/v1/plugins/{slug}/",
});

const PluginUISlotSchema = z.object({
  slot: z.enum(['dashboard-top', 'dashboard-sidebar', 'prospect-actions', 'prospect-list-toolbar', 'pipeline-extension', 'sequence-extension']),
  component: z.string().min(1),
});

export const PluginManifestSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, { message: "Le slug doit contenir uniquement des minuscules, chiffres et tirets" }).max(50),
  name: z.string().min(1).max(100),
  version: z.string().regex(SEMVER_REGEX, { message: "Version doit être au format SemVer (ex: 1.0.0)" }),
  description: z.string().max(500),
  author: z.string().optional(),
  isActive: z.boolean().default(false),
  permissions: z.array(z.enum(ALLOWED_PERMISSIONS as [string, ...string[]])).optional().default([]),
  hooks: z.array(z.enum(ALLOWED_HOOKS as [string, ...string[]])).optional().default([]),
  routes: z.array(PluginRouteSchema).optional().default([]),
  uiSlots: z.array(PluginUISlotSchema).optional().default([]),
  database: z.object({
    tables: z.array(z.string()).optional(),
  }).optional(),
  signature: z.string().optional(), // Signature cryptographique optionnelle
});

export type PluginManifest = z.infer<typeof PluginManifestSchema>;

// ── Fonctions de Validation ──────────────────────────────────────

/**
 * Valide un manifeste plugin brut
 */
export function validateManifest(raw: unknown): { success: boolean; data?: PluginManifest; error?: string } {
  const result = PluginManifestSchema.safeParse(raw);

  if (!result.success) {
    return {
      success: false,
      error: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '),
    };
  }

  const manifest = result.data;

  // Vérification supplémentaire: cohérence slug/routes
  const expectedRoutePrefix = `/api/v1/plugins/${manifest.slug}/`;
  const invalidRoutes = manifest.routes?.filter(r => !r.startsWith(expectedRoutePrefix));

  if (invalidRoutes && invalidRoutes.length > 0) {
    return {
      success: false,
      error: `Les routes doivent commencer par ${expectedRoutePrefix}. Routes invalides: ${invalidRoutes.join(', ')}`,
    };
  }

  // Vérification de la signature si présente (optionnel pour le dev, obligatoire prod)
  if (manifest.signature) {
    // Ici on pourrait vérifier la signature cryptographique
    // const isValid = verifySignature(manifest, manifest.signature);
    // if (!isValid) return { success: false, error: 'Signature invalide' };
  }

  return { success: true, data: manifest };
}

/**
 * Génère une empreinte SHA256 du manifeste (pour vérification d'intégrité)
 */
export function generateManifestFingerprint(manifest: PluginManifest): string {
  const content = JSON.stringify({
    slug: manifest.slug,
    name: manifest.name,
    version: manifest.version,
    permissions: manifest.permissions,
    hooks: manifest.hooks,
    routes: manifest.routes,
  }, Object.keys(manifest).sort());

  return createHash('sha256').update(content).digest('hex');
}

/**
 * Vérifie les permissions d'un plugin pour une action donnée
 */
export function hasPermission(manifest: PluginManifest, permission: string): boolean {
  return manifest.permissions?.includes(permission as any) ?? false;
}

/**
 * Sanitize les données du manifeste avant stockage
 */
export function sanitizeManifest(manifest: PluginManifest): PluginManifest {
  return {
    ...manifest,
    // On retire la signature du stockage si on veut la recalculer à la volée
    // ou on la garde pour vérification future
  };
}

// ── Exports ──────────────────────────────────────────────────────

export const ManifestValidator = {
  validate: validateManifest,
  fingerprint: generateManifestFingerprint,
  hasPermission,
  sanitize: sanitizeManifest,
  ALLOWED_PERMISSIONS,
  ALLOWED_HOOKS,
};

export default ManifestValidator;
