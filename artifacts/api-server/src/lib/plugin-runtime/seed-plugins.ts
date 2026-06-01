import { pluginManager } from "./plugin-manager";
import { logger } from "../logger";

/**
 * Built-in demo plugins that ship with GrowthOS.
 * In production these would be loaded from a database or plugin registry.
 * This module seeds the runtime on every server start.
 */
const BUILT_IN_PLUGINS = [
  {
    id: "crm-sync",
    name: "CRM Sync",
    version: "1.0.0",
    description: "Bi-directional sync with Salesforce, HubSpot, and Pipedrive",
    author: "GrowthOS",
    dependencies: [],
    permissions: ["prospects:read", "prospects:write", "pipeline:read", "pipeline:write"],
    uiSlots: ["sidebar-bottom", "prospect-detail-actions"],
    routes: [{ path: "/crm-sync", label: "CRM Sync", icon: "RefreshCw" }],
  },
  {
    id: "email-outreach",
    name: "Email Outreach",
    version: "2.1.0",
    description: "Automated multi-step email sequences with A/B testing",
    author: "GrowthOS",
    dependencies: [],
    permissions: ["sequences:read", "sequences:write", "email:send", "prospects:read"],
    uiSlots: ["sequence-detail-header", "prospect-detail-actions"],
    routes: [],
  },
  {
    id: "ai-signals",
    name: "AI Signals",
    version: "1.3.0",
    description: "Intent data and buying signals powered by AI",
    author: "GrowthOS",
    dependencies: ["crm-sync"],
    permissions: ["signals:read", "signals:write", "analytics:read"],
    uiSlots: ["dashboard-widgets", "prospect-detail-sidebar"],
    routes: [{ path: "/signals", label: "AI Signals", icon: "Zap" }],
  },
  {
    id: "webhooks-relay",
    name: "Webhooks Relay",
    version: "1.0.2",
    description: "Forward GrowthOS events to external services",
    author: "GrowthOS",
    dependencies: [],
    permissions: ["webhooks:send"],
    uiSlots: [],
    routes: [],
  },
] as const;

export async function seedBuiltInPlugins(): Promise<void> {
  logger.info("Seeding built-in plugins...");

  for (const manifest of BUILT_IN_PLUGINS) {
    try {
      pluginManager.register(manifest);
    } catch (err) {
      logger.error({ pluginId: manifest.id, err }, "Failed to register built-in plugin");
    }
  }

  await pluginManager.activateAll();

  const active = pluginManager.active();
  logger.info(
    { count: active.length, ids: active.map((r) => r.manifest.id) },
    "Plugin runtime ready",
  );
}
