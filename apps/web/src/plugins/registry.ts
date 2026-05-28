/**
 * ============================================================
 * GrowthOS Plugin Registry (Client-Side)
 * ============================================================
 * Charge, valide et gère l'état des plugins côté client Next.js
 * 
 * Architecture:
 * 1. Fetch des plugins actifs depuis API au démarrage
 * 2. Validation des manifests avec Zod
 * 3. Injection dynamique des composants UI via slots
 * 4. Gestion activation/désactivation avec invalidation cache
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { PluginManifest, PluginRegistryEntry } from '@growthos/plugin-sdk/src/index';

// ── Types ────────────────────────────────────────────────────────

interface PluginState {
  registry: PluginRegistryEntry[];
  activePlugins: Set<string>;
  isLoading: boolean;
  error: string | null;
}

// ── Registry Singleton (in-memory cache) ─────────────────────────

class PluginRegistry {
  private static instance: PluginRegistry;
  private state: PluginState = {
    registry: [],
    activePlugins: new Set(),
    isLoading: true,
    error: null,
  };
  private listeners: Set<(state: PluginState) => void> = new Set();

  private constructor() {}

  static getInstance(): PluginRegistry {
    if (!PluginRegistry.instance) {
      PluginRegistry.instance = new PluginRegistry();
    }
    return PluginRegistry.instance;
  }

  getState(): PluginState {
    return this.state;
  }

  subscribe(listener: (state: PluginState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(listener => listener(this.state));
  }

  async load(apiUrl: string, tenantId: string): Promise<void> {
    this.state.isLoading = true;
    this.notify();

    try {
      const res = await fetch(`${apiUrl}/plugins`, {
        headers: {
          'Authorization': `Bearer ${this.getAccessToken()}`,
          'X-Tenant-ID': tenantId,
        },
      });

      if (!res.ok) throw new Error('Failed to load plugins');

      const plugins = await res.json();
      
      // Valider chaque manifest
      const validated = plugins.filter((p: any) => {
        if (!p.manifest || !p.manifest.name || !p.manifest.version) {
          console.warn(`[PluginRegistry] Invalid manifest for ${p.name}`);
          return false;
        }
        return true;
      });

      this.state.registry = validated;
      this.state.activePlugins = new Set(
        validated.filter((p: any) => p.isActive).map((p: any) => p.name)
      );
      this.state.error = null;
    } catch (e: any) {
      this.state.error = e.message;
      console.error('[PluginRegistry] Load error:', e);
    } finally {
      this.state.isLoading = false;
      this.notify();
    }
  }

  async activate(apiUrl: string, tenantId: string, pluginName: string): Promise<void> {
    try {
      const res = await fetch(`${apiUrl}/plugins/${pluginName}/activate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAccessToken()}`,
          'X-Tenant-ID': tenantId,
        },
      });

      if (!res.ok) throw new Error('Activation failed');

      this.state.activePlugins.add(pluginName);
      this.state.registry = this.state.registry.map(p => 
        p.name === pluginName ? { ...p, isActive: true } : p
      );
      this.notify();
    } catch (e: any) {
      console.error(`[PluginRegistry] Activate ${pluginName}:`, e);
      throw e;
    }
  }

  async deactivate(apiUrl: string, tenantId: string, pluginName: string): Promise<void> {
    try {
      const res = await fetch(`${apiUrl}/plugins/${pluginName}/deactivate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAccessToken()}`,
          'X-Tenant-ID': tenantId,
        },
      });

      if (!res.ok) throw new Error('Deactivation failed');

      this.state.activePlugins.delete(pluginName);
      this.state.registry = this.state.registry.map(p => 
        p.name === pluginName ? { ...p, isActive: false } : p
      );
      this.notify();
    } catch (e: any) {
      console.error(`[PluginRegistry] Deactivate ${pluginName}:`, e);
      throw e;
    }
  }

  isPluginActive(pluginName: string): boolean {
    return this.state.activePlugins.has(pluginName);
  }

  getActivePlugins(): PluginRegistryEntry[] {
    return this.state.registry.filter(p => p.isActive);
  }

  getPluginByName(name: string): PluginRegistryEntry | undefined {
    return this.state.registry.find(p => p.name === name);
  }

  private getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('access_token');
  }
}

// ── React Hook ───────────────────────────────────────────────────

export function usePluginRegistry() {
  const registry = PluginRegistry.getInstance();
  const [state, setState] = useState<PluginState>(registry.getState());

  useEffect(() => {
    return registry.subscribe(setState);
  }, [registry]);

  const load = useCallback((apiUrl: string, tenantId: string) => {
    return registry.load(apiUrl, tenantId);
  }, []);

  const activate = useCallback((apiUrl: string, tenantId: string, pluginName: string) => {
    return registry.activate(apiUrl, tenantId, pluginName);
  }, []);

  const deactivate = useCallback((apiUrl: string, tenantId: string, pluginName: string) => {
    return registry.deactivate(apiUrl, tenantId, pluginName);
  }, []);

  return {
    ...state,
    load,
    activate,
    deactivate,
    isPluginActive: (name: string) => registry.isPluginActive(name),
    getActivePlugins: () => registry.getActivePlugins(),
    getPluginByName: (name: string) => registry.getPluginByName(name),
  };
}

// ── Export singleton ─────────────────────────────────────────────

export const pluginRegistry = PluginRegistry.getInstance();

export default PluginRegistry;
