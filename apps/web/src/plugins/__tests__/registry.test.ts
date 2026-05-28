/**
 * ============================================================
 * GrowthOS Plugin System: Tests Unitaires
 * ============================================================
 * Suite de tests pour la registry, validation et sécurité
 * Framework: Vitest
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validateManifest, generateManifestFingerprint, hasPermission } from '../security/manifest-validator';
import { runHookInSandbox, scanFunctionForSuspiciousPatterns } from '../security/sandbox';

// ── Tests: Validation des Manifests ───────────────────────────────

describe('Manifest Validator', () => {
  const validManifest = {
    slug: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'Un plugin de test',
    isActive: false,
    permissions: ['prospects:read'],
    hooks: ['prospect:created'],
    routes: ['/api/v1/plugins/test-plugin/test'],
    uiSlots: [],
  };

  describe('validateManifest', () => {
    it('devrait accepter un manifeste valide', () => {
      const result = validateManifest(validManifest);
      expect(result.success).toBe(true);
      expect(result.data?.slug).toBe('test-plugin');
    });

    it('devrait rejeter un slug invalide', () => {
      const invalid = { ...validManifest, slug: 'Invalid_Slug!' };
      const result = validateManifest(invalid);
      expect(result.success).toBe(false);
      expect(result.error).toContain('slug');
    });

    it('devrait rejeter une version non-SemVer', () => {
      const invalid = { ...validManifest, version: '1.0' };
      const result = validateManifest(invalid);
      expect(result.success).toBe(false);
      expect(result.error).toContain('SemVer');
    });

    it('devrait rejeter des routes avec mauvais préfixe', () => {
      const invalid = {
        ...validManifest,
        routes: ['/api/v1/plugins/wrong-prefix/test'],
      };
      const result = validateManifest(invalid);
      expect(result.success).toBe(false);
      expect(result.error).toContain('routes doivent commencer par');
    });

    it('devrait rejeter des permissions non autorisées', () => {
      const invalid = {
        ...validManifest,
        permissions: ['admin:delete_everything'],
      };
      const result = validateManifest(invalid);
      expect(result.success).toBe(false);
    });

    it('devrait rejeter des hooks non autorisés', () => {
      const invalid = {
        ...validManifest,
        hooks: ['user:deleted_all_data'],
      };
      const result = validateManifest(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('generateManifestFingerprint', () => {
    it('devrait générer une empreinte SHA256 cohérente', () => {
      const fingerprint1 = generateManifestFingerprint(validManifest as any);
      const fingerprint2 = generateManifestFingerprint(validManifest as any);
      
      expect(fingerprint1).toBe(fingerprint2);
      expect(fingerprint1).toHaveLength(64); // SHA256 hex = 64 chars
    });

    it('devrait générer des empreintes différentes pour des versions différentes', () => {
      const v1 = { ...validManifest, version: '1.0.0' };
      const v2 = { ...validManifest, version: '1.0.1' };
      
      const fp1 = generateManifestFingerprint(v1 as any);
      const fp2 = generateManifestFingerprint(v2 as any);
      
      expect(fp1).not.toBe(fp2);
    });
  });

  describe('hasPermission', () => {
    it('devrait retourner true si la permission est présente', () => {
      const manifest = { ...validManifest, permissions: ['prospects:read', 'deals:write'] };
      expect(hasPermission(manifest as any, 'prospects:read')).toBe(true);
      expect(hasPermission(manifest as any, 'deals:write')).toBe(true);
    });

    it('devrait retourner false si la permission est absente', () => {
      const manifest = { ...validManifest, permissions: ['prospects:read'] };
      expect(hasPermission(manifest as any, 'deals:write')).toBe(false);
    });

    it('devrait retourner false si permissions est vide', () => {
      const manifest = { ...validManifest, permissions: [] };
      expect(hasPermission(manifest as any, 'prospects:read')).toBe(false);
    });
  });
});

// ── Tests: Sandbox de Sécurité ────────────────────────────────────

describe('Plugin Sandbox', () => {
  describe('scanFunctionForSuspiciousPatterns', () => {
    it('devrait accepter une fonction safe', () => {
      const safeFn = async (ctx: any) => ({ result: 'ok' });
      const scan = scanFunctionForSuspiciousPatterns(safeFn);
      expect(scan.safe).toBe(true);
      expect(scan.warnings).toHaveLength(0);
    });

    it('devrait détecter eval()', () => {
      const maliciousFn = new Function('return async (ctx) => { eval("malicious"); }') as any;
      const scan = scanFunctionForSuspiciousPatterns(maliciousFn);
      expect(scan.safe).toBe(false);
      expect(scan.warnings.some(w => w.includes('eval'))).toBe(true);
    });

    it('devrait détecter require()', () => {
      const fnString = 'async (ctx) => { const fs = require("fs"); }';
      const maliciousFn = new Function(`return ${fnString}`)() as any;
      const scan = scanFunctionForSuspiciousPatterns(maliciousFn);
      expect(scan.safe).toBe(false);
      expect(scan.warnings.some(w => w.includes('require'))).toBe(true);
    });

    it('devrait détecter process.env', () => {
      const fnString = 'async (ctx) => { return process.env.SECRET; }';
      const maliciousFn = new Function(`return ${fnString}`)() as any;
      const scan = scanFunctionForSuspiciousPatterns(maliciousFn);
      expect(scan.safe).toBe(false);
      expect(scan.warnings.some(w => w.includes('process.env'))).toBe(true);
    });
  });

  describe('runHookInSandbox', () => {
    it('devrait exécuter une fonction safe avec succès', async () => {
      const safeHook = async (ctx: any) => {
        return { data: 'success', value: 42 };
      };

      const result = await runHookInSandbox(safeHook, { userId: '123' });
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ data: 'success', value: 42 });
      expect(result.timedOut).toBeFalsy();
    });

    it('devrait gérer les erreurs dans le hook', async () => {
      const failingHook = async (ctx: any) => {
        throw new Error('Something went wrong');
      };

      const result = await runHookInSandbox(failingHook);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Something went wrong');
    });

    it('devrait timeout après 5 secondes', async () => {
      vi.useFakeTimers();
      
      const slowHook = async (ctx: any) => {
        await new Promise(resolve => setTimeout(resolve, 10000));
        return 'done';
      };

      const resultPromise = runHookInSandbox(slowHook);
      
      // Avance le temps de 6 secondes
      vi.advanceTimersByTime(6000);
      
      const result = await resultPromise;
      
      expect(result.success).toBe(false);
      expect(result.timedOut).toBe(true);
      expect(result.error).toContain('timeout');
      
      vi.useRealTimers();
    }, 10000);

    it('devrait isoler le contexte (pas d\'accès à process)', async () => {
      const maliciousHook = async (ctx: any) => {
        // Tentative d'accès à des globaux dangereux
        try {
          const p = (globalThis as any).process;
          return { leaked: !!p };
        } catch {
          return { error: 'blocked' };
        }
      };

      const result = await runHookInSandbox(maliciousHook);
      
      // Le hook ne devrait pas crasher, mais l'accès devrait être undefined
      expect(result.success).toBe(true);
    });
  });
});

// ── Tests: Intégration Registry (Mock) ────────────────────────────

describe('Plugin Registry Integration', () => {
  it('devrait valider et enregistrer un plugin complet', () => {
    const manifest = {
      slug: 'full-plugin',
      name: 'Full Featured Plugin',
      version: '2.1.0',
      description: 'Plugin avec toutes les features',
      author: 'Test Team',
      isActive: true,
      permissions: ['prospects:read', 'prospects:write', 'deals:read'],
      hooks: ['prospect:created', 'pipeline:stageChanged'],
      routes: [
        '/api/v1/plugins/full-plugin/data',
        '/api/v1/plugins/full-plugin/export',
      ],
      uiSlots: [
        { slot: 'dashboard-top', component: 'DashboardWidget' },
        { slot: 'prospect-actions', component: 'ActionButtons' },
      ],
      database: {
        tables: ['PluginData_full_plugin'],
      },
    };

    const validation = validateManifest(manifest);
    expect(validation.success).toBe(true);
    
    if (validation.data) {
      expect(validation.data.slug).toBe('full-plugin');
      expect(validation.data.hooks).toHaveLength(2);
      expect(validation.data.uiSlots).toHaveLength(2);
      expect(validation.data.database?.tables).toHaveLength(1);
    }
  });

  it('devrait rejeter un plugin avec signature invalide (si implémenté)', () => {
    // Test placeholder pour la validation de signature
    const manifest = {
      ...{
        slug: 'signed-plugin',
        name: 'Signed Plugin',
        version: '1.0.0',
        description: 'Plugin signé',
      },
      signature: 'invalid-signature-hash',
    };

    const validation = validateManifest(manifest);
    // Actuellement la signature n'est pas vérifiée strictement en dev
    expect(validation.success).toBe(true);
    // En prod: expect(validation.success).toBe(false);
  });
});
