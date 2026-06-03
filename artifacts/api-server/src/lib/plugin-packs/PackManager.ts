import { pluginManager } from "../plugin-runtime";
import { logger } from "../logger";

export interface PluginPack {
  id: string;
  name: string;
  description: string;
  plugins: string[];
  price: string;
  icon: string;
  category: string;
  savings?: string;
}

export interface PackInstallResult {
  packId: string;
  packName: string;
  results: {
    pluginId: string;
    success: boolean;
    state: string;
    error?: string;
  }[];
  installedCount: number;
  failedCount: number;
  alreadyActiveCount: number;
}

export const PLUGIN_PACKS: Record<string, PluginPack> = {
  "sales-intelligence": {
    id: "sales-intelligence",
    name: "Pack Intelligence Commerciale",
    description: "Suite complète pour les équipes sales",
    plugins: ["growth-memory", "meeting-intelligence", "account-intelligence", "ai-deal-coach"],
    price: "299€/mois",
    icon: "🧠",
    category: "sales",
    savings: "Économisez 20%",
  },
  "automation-pro": {
    id: "automation-pro",
    name: "Pack Automatisation",
    description: "Workflows AI et SDR automatique",
    plugins: ["ai-sdr", "signal-intelligence"],
    price: "199€/mois",
    icon: "⚡",
    category: "automation",
    savings: "Économisez 15%",
  },
  "executive-suite": {
    id: "executive-suite",
    name: "Pack Direction",
    description: "Pilotage et analytics avancés",
    plugins: ["revenue-intelligence", "executive-command", "ai-deal-coach"],
    price: "399€/mois",
    icon: "👑",
    category: "executive",
    savings: "Économisez 25%",
  },
};

export class PackManager {
  getPacks(): PluginPack[] {
    return Object.values(PLUGIN_PACKS);
  }

  getPack(packId: string): PluginPack | undefined {
    return PLUGIN_PACKS[packId];
  }

  /**
   * Install a pack: enables all DISABLED plugins in the pack,
   * skips already ACTIVE ones, returns per-plugin results.
   */
  async installPack(packId: string): Promise<PackInstallResult> {
    const pack = this.getPack(packId);
    if (!pack) throw new Error(`Pack "${packId}" not found`);

    const results: PackInstallResult["results"] = [];
    let installedCount = 0;
    let failedCount = 0;
    let alreadyActiveCount = 0;

    for (const pluginId of pack.plugins) {
      const record = pluginManager.all().find((r) => r.manifest.id === pluginId);

      if (!record) {
        results.push({ pluginId, success: false, state: "NOT_FOUND", error: "Plugin not registered" });
        failedCount++;
        continue;
      }

      if (record.state === "ACTIVE") {
        results.push({ pluginId, success: true, state: "ACTIVE" });
        alreadyActiveCount++;
        continue;
      }

      try {
        await pluginManager.enable(pluginId);
        const after = pluginManager.all().find((r) => r.manifest.id === pluginId);
        const succeeded = after?.state === "ACTIVE";
        results.push({
          pluginId,
          success: succeeded,
          state: after?.state ?? "UNKNOWN",
          error: succeeded ? undefined : after?.error,
        });
        if (succeeded) installedCount++;
        else failedCount++;
      } catch (err) {
        const error = err instanceof Error ? err.message : "Unknown error";
        logger.error({ packId, pluginId, err }, "Failed to enable plugin during pack install");
        results.push({ pluginId, success: false, state: "ERROR", error });
        failedCount++;
      }
    }

    logger.info({ packId, installedCount, failedCount, alreadyActiveCount }, "Pack install completed");

    return {
      packId,
      packName: pack.name,
      results,
      installedCount,
      failedCount,
      alreadyActiveCount,
    };
  }

  /**
   * Returns each pack enriched with the live state of its plugins.
   */
  getPacksWithStatus() {
    return this.getPacks().map((pack) => {
      const pluginStatuses = pack.plugins.map((pluginId) => {
        const record = pluginManager.all().find((r) => r.manifest.id === pluginId);
        return {
          pluginId,
          state: record?.state ?? "NOT_FOUND",
          name: record?.manifest.name ?? pluginId,
        };
      });
      const allActive = pluginStatuses.every((p) => p.state === "ACTIVE");
      const someActive = pluginStatuses.some((p) => p.state === "ACTIVE");
      return { ...pack, pluginStatuses, allActive, someActive };
    });
  }
}

export const packManager = new PackManager();
