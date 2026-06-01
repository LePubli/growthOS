import { logger } from "../logger";
import { resolveLoadOrder, DependencyResolutionError } from "./dependency-resolver";
import { pluginEventBus } from "./event-bus";
import type { PluginManifest, PluginRecord, PluginStatusResponse } from "./types";
import { PluginManifest as PluginManifestSchema } from "./types";

/**
 * PluginManager — singleton that owns the full plugin lifecycle.
 *
 * Lifecycle:  DISCOVERED → RESOLVING → ACTIVE
 *                                   → ERROR (on activation failure)
 *             ACTIVE → DISABLED (on explicit disable)
 *
 * Consumers should use `pluginManager` (the exported singleton).
 */
class PluginManager {
  private readonly plugins = new Map<string, PluginRecord>();

  /**
   * Register a plugin manifest.
   * The plugin starts in DISCOVERED state until `activateAll()` is called.
   * Safe to call multiple times with the same id — re-registration updates the manifest.
   */
  register(rawManifest: unknown): PluginRecord {
    const parse = PluginManifestSchema.safeParse(rawManifest);
    if (!parse.success) {
      throw new Error(
        `Invalid plugin manifest: ${parse.error.issues.map((i) => i.message).join("; ")}`,
      );
    }
    const manifest = parse.data;

    const existing = this.plugins.get(manifest.id);
    const record: PluginRecord = {
      manifest,
      state: existing?.state === "ACTIVE" ? "ACTIVE" : "DISCOVERED",
    };
    this.plugins.set(manifest.id, record);

    logger.info(
      { pluginId: manifest.id, version: manifest.version },
      "Plugin registered",
    );

    return record;
  }

  /**
   * Resolve dependency order and activate all DISCOVERED plugins in sequence.
   * Already ACTIVE plugins are skipped; ERROR/DISABLED plugins are not retried.
   */
  async activateAll(): Promise<void> {
    const discovered = [...this.plugins.values()].filter(
      (r) => r.state === "DISCOVERED",
    );
    if (discovered.length === 0) return;

    // Mark all as resolving before we do the DAG pass
    for (const record of discovered) {
      record.state = "RESOLVING";
    }

    let ordered: PluginManifest[];
    try {
      const allManifests = [...this.plugins.values()].map((r) => r.manifest);
      ordered = resolveLoadOrder(allManifests).filter(
        (m) => this.plugins.get(m.id)?.state === "RESOLVING",
      );
    } catch (err) {
      const msg =
        err instanceof DependencyResolutionError
          ? err.message
          : "Unknown resolution error";

      // Mark all RESOLVING plugins as ERROR
      for (const record of discovered) {
        record.state = "ERROR";
        record.error = msg;
      }
      logger.error({ err }, "Plugin dependency resolution failed");
      return;
    }

    for (const manifest of ordered) {
      await this.activate(manifest.id);
    }
  }

  /** Activate a single plugin by id. */
  private async activate(pluginId: string): Promise<void> {
    const record = this.plugins.get(pluginId);
    if (!record || record.state === "ACTIVE") return;

    try {
      // Ensure all declared dependencies are already active
      for (const depId of record.manifest.dependencies) {
        const dep = this.plugins.get(depId);
        if (dep?.state !== "ACTIVE") {
          throw new Error(
            `Dependency "${depId}" is not active (state: ${dep?.state ?? "not registered"})`,
          );
        }
      }

      record.state = "ACTIVE";
      record.activatedAt = new Date();
      delete record.error;

      logger.info(
        {
          pluginId,
          version: record.manifest.version,
          permissions: record.manifest.permissions,
        },
        "Plugin activated",
      );

      await pluginEventBus.emit("plugin:activated", {
        pluginId,
        manifest: record.manifest,
      });
    } catch (err) {
      record.state = "ERROR";
      record.error = err instanceof Error ? err.message : String(err);
      logger.error({ pluginId, err }, "Plugin activation failed");

      await pluginEventBus.emit("plugin:error", {
        pluginId,
        error: record.error,
      });
    }
  }

  /** Disable an active plugin. Removes its event handlers. */
  async disable(pluginId: string): Promise<void> {
    const record = this.plugins.get(pluginId);
    if (!record) throw new Error(`Plugin "${pluginId}" not found`);
    if (record.state === "DISABLED") return;

    // Check if any active plugin depends on this one
    const dependents = [...this.plugins.values()].filter(
      (r) =>
        r.state === "ACTIVE" && r.manifest.dependencies.includes(pluginId),
    );
    if (dependents.length > 0) {
      throw new Error(
        `Cannot disable "${pluginId}": active plugins depend on it: ${dependents.map((r) => r.manifest.id).join(", ")}`,
      );
    }

    record.state = "DISABLED";
    record.disabledAt = new Date();
    pluginEventBus.removePlugin(pluginId);

    logger.info({ pluginId }, "Plugin disabled");
    await pluginEventBus.emit("plugin:disabled", { pluginId });
  }

  /** Re-enable a previously disabled plugin. */
  async enable(pluginId: string): Promise<void> {
    const record = this.plugins.get(pluginId);
    if (!record) throw new Error(`Plugin "${pluginId}" not found`);
    if (record.state !== "DISABLED") return;
    record.state = "DISCOVERED";
    await this.activateAll();
  }

  /** Return all plugin records. */
  all(): PluginRecord[] {
    return [...this.plugins.values()];
  }

  /** Return active plugins only. */
  active(): PluginRecord[] {
    return [...this.plugins.values()].filter((r) => r.state === "ACTIVE");
  }

  /** Check whether a plugin has a specific permission (throws if plugin not active). */
  hasPermission(pluginId: string, permission: string): boolean {
    const record = this.plugins.get(pluginId);
    if (!record || record.state !== "ACTIVE") return false;
    return (record.manifest.permissions as string[]).includes(permission);
  }

  /** Serialize a record to the API response shape. */
  toStatusResponse(record: PluginRecord): PluginStatusResponse {
    return {
      id: record.manifest.id,
      name: record.manifest.name,
      version: record.manifest.version,
      state: record.state,
      permissions: record.manifest.permissions,
      uiSlots: record.manifest.uiSlots,
      routes: record.manifest.routes,
      error: record.error,
      activatedAt: record.activatedAt?.toISOString(),
    };
  }
}

// Singleton — the entire server process shares one manager instance
export const pluginManager = new PluginManager();
