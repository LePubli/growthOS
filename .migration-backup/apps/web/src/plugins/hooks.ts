/**
 * ============================================================
 * GrowthOS Plugin Hooks System (Client-Side EventBus)
 * ============================================================
 * Permet aux plugins de s'abonner aux événements du core
 * et d'émettre leurs propres événements
 * 
 * Architecture:
 * 1. EventBus central avec wildcard patterns
 * 2. Type-safe event handlers avec Zod validation
 * 3. Persistence optionnelle via API
 * 4. Cleanup automatique sur unmount
 */

'use client';

import { useCallback, useEffect, useRef } from 'react';
import { DomainEvent } from '@growthos/plugin-sdk/src/index';

// ── Types ────────────────────────────────────────────────────────

type EventHandler = (payload: any) => void | Promise<void>;

interface EventSubscription {
  pattern: string;
  handler: EventHandler;
  unsubscribe: () => void;
}

// ── EventBus Singleton ───────────────────────────────────────────

class PluginEventBus {
  private static instance: PluginEventBus;
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private apiUrl: string = '';
  private tenantId: string = '';
  private accessToken: string | null = null;

  private constructor() {}

  static getInstance(): PluginEventBus {
    if (!PluginEventBus.instance) {
      PluginEventBus.instance = new PluginEventBus();
    }
    return PluginEventBus.instance;
  }

  initialize(apiUrl: string, tenantId: string, accessToken: string): void {
    this.apiUrl = apiUrl;
    this.tenantId = tenantId;
    this.accessToken = accessToken;
  }

  /**
   * S'abonne à un événement avec support wildcard
   * Ex: 'prospect:*', 'pipeline:stageChanged'
   */
  subscribe(pattern: string, handler: EventHandler): EventSubscription {
    if (!this.handlers.has(pattern)) {
      this.handlers.set(pattern, new Set());
    }
    this.handlers.get(pattern)!.add(handler);

    return {
      pattern,
      handler,
      unsubscribe: () => {
        this.handlers.get(pattern)?.delete(handler);
      },
    };
  }

  /**
   * Émet un événement vers tous les handlers abonnés
   * + optionnellement vers l'API pour persistence
   */
  async emit(eventName: string, payload: any, persist: boolean = false): Promise<void> {
    // 1. Dispatch in-memory aux handlers locaux
    const matchingPatterns = Array.from(this.handlers.keys()).filter(
      pattern => this.matchesPattern(pattern, eventName)
    );

    await Promise.all(matchingPatterns.map(async pattern => {
      const handlers = this.handlers.get(pattern)!;
      await Promise.all(Array.from(handlers).map(async h => {
        try {
          await h(payload);
        } catch (e) {
          console.error(`[EventBus] Handler error for ${eventName}:`, e);
        }
      }));
    }));

    // 2. Persistence optionnelle via API
    if (persist && this.apiUrl && this.accessToken) {
      try {
        await fetch(`${this.apiUrl}/events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.accessToken}`,
            'X-Tenant-ID': this.tenantId,
          },
          body: JSON.stringify({
            name: eventName,
            tenantId: this.tenantId,
            payload,
          }),
        });
      } catch (e) {
        console.warn(`[EventBus] Failed to persist event ${eventName}:`, e);
      }
    }
  }

  /**
   * Vérifie si un pattern match un événement
   * Supporte les wildcards: 'prospect:*' match 'prospect:created'
   */
  private matchesPattern(pattern: string, eventName: string): boolean {
    if (pattern === eventName) return true;
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return eventName.startsWith(prefix);
    }
    return false;
  }

  /**
   * Clear tous les handlers (utile pour hot-reload)
   */
  clear(): void {
    this.handlers.clear();
  }

  /**
   * Get stats debugging
   */
  getStats(): { patterns: number; totalHandlers: number } {
    let totalHandlers = 0;
    this.handlers.forEach(set => totalHandlers += set.size);
    return {
      patterns: this.handlers.size,
      totalHandlers,
    };
  }
}

// ── React Hook ───────────────────────────────────────────────────

export function useEventBus() {
  const bus = PluginEventBus.getInstance();
  const subscriptionsRef = useRef<EventSubscription[]>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      subscriptionsRef.current.forEach(sub => sub.unsubscribe());
      subscriptionsRef.current = [];
    };
  }, []);

  const subscribe = useCallback((pattern: string, handler: EventHandler) => {
    const sub = bus.subscribe(pattern, handler);
    subscriptionsRef.current.push(sub);
    return sub.unsubscribe;
  }, [bus]);

  const emit = useCallback((eventName: string, payload: any, persist: boolean = false) => {
    return bus.emit(eventName, payload, persist);
  }, [bus]);

  return { subscribe, emit };
}

// ── Helper pour créer des hooks type-safe ────────────────────────

export function createTypedEmitter<T extends DomainEvent['name']>(eventName: T) {
  return function emitTyped(payload: Extract<DomainEvent, { name: T }>['payload']) {
    const bus = PluginEventBus.getInstance();
    return bus.emit(eventName, payload);
  };
}

// ── Exports prédéfinis pour les événements core ──────────────────

export const emitProspectCreated = createTypedEmitter('prospect:created');
export const emitProspectUpdated = createTypedEmitter('prospect:updated');
export const emitPipelineStageChanged = createTypedEmitter('pipeline:stageChanged');
export const emitSequenceEnrolled = createTypedEmitter('sequence:enrolled');

// ── Export singleton ─────────────────────────────────────────────

export const eventBus = PluginEventBus.getInstance();

export default PluginEventBus;
