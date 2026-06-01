import { logger } from "../logger";

export type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;

interface HandlerEntry<T = unknown> {
  pluginId: string;
  handler: EventHandler<T>;
}

/**
 * Async EventBus with per-handler error isolation.
 * A crashing handler is caught and logged without affecting other subscribers.
 */
export class PluginEventBus {
  private readonly handlers = new Map<string, HandlerEntry[]>();

  /**
   * Subscribe a plugin's handler to an event type.
   * Returns an unsubscribe function.
   */
  on<T = unknown>(
    event: string,
    pluginId: string,
    handler: EventHandler<T>,
  ): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    const entry: HandlerEntry<T> = { pluginId, handler: handler as EventHandler };
    this.handlers.get(event)!.push(entry as HandlerEntry);

    logger.debug({ event, pluginId }, "Plugin subscribed to event");

    return () => {
      const entries = this.handlers.get(event);
      if (!entries) return;
      const idx = entries.indexOf(entry as HandlerEntry);
      if (idx !== -1) entries.splice(idx, 1);
      logger.debug({ event, pluginId }, "Plugin unsubscribed from event");
    };
  }

  /**
   * Emit an event to all subscribers concurrently.
   * Each handler runs independently; errors are caught and logged per handler.
   */
  async emit<T = unknown>(event: string, payload: T): Promise<void> {
    const entries = this.handlers.get(event) ?? [];
    if (entries.length === 0) return;

    logger.debug({ event, subscriberCount: entries.length }, "Plugin event emitted");

    await Promise.allSettled(
      entries.map(async ({ pluginId, handler }) => {
        try {
          await handler(payload);
        } catch (err) {
          logger.error(
            { event, pluginId, err },
            "Plugin event handler threw an error — isolated, other handlers unaffected",
          );
        }
      }),
    );
  }

  /** Remove all handlers registered by a specific plugin (called on disable). */
  removePlugin(pluginId: string): void {
    for (const [event, entries] of this.handlers) {
      const filtered = entries.filter((e) => e.pluginId !== pluginId);
      if (filtered.length === 0) {
        this.handlers.delete(event);
      } else {
        this.handlers.set(event, filtered);
      }
    }
    logger.debug({ pluginId }, "Removed all event handlers for plugin");
  }

  /** List all event types that have at least one subscriber. */
  registeredEvents(): string[] {
    return [...this.handlers.keys()];
  }
}

// Singleton instance shared across the server process
export const pluginEventBus = new PluginEventBus();
