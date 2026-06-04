import { pluginManager } from "./plugin-manager";
import { logger } from "../logger";
import { loadDisabledPluginIds } from "./persistence";
import { runPluginStateMigration, runGrowthMemoryMigration, runMeetingIntelligenceMigration, runAccountIntelligenceMigration, runSignalIntelligenceMigration, runDealCoachMigration, runKnowledgeBaseMigration, runEreputationMigration } from "@workspace/db";

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
  {
    id: "growth-memory",
    name: "Growth Memory",
    version: "1.0.0",
    description: "Second Brain : indexation sémantique et recherche dans vos données métier",
    author: "GrowthOS",
    dependencies: [],
    permissions: ["memory:read", "memory:write"],
    uiSlots: ["dashboard-widgets"],
    routes: [{ path: "/memory", label: "Mémoire", icon: "Brain" }],
  },
  {
    id: "meeting-intelligence",
    name: "Meeting Intelligence",
    version: "1.0.0",
    description: "Transcription IA et extraction d'insights depuis vos enregistrements de réunions",
    author: "GrowthOS",
    dependencies: ["growth-memory"],
    permissions: ["meetings:read", "meetings:write", "memory:write"],
    uiSlots: ["dashboard-widgets"],
    routes: [{ path: "/meetings", label: "Réunions", icon: "Video" }],
  },
  {
    id: "revenue-intelligence",
    name: "Revenue Intelligence",
    version: "1.0.0",
    description: "Dashboards analytiques haute-fréquence — KPIs Win Rate, Conversion, Velocity, ARR/MRR, Forecast IA basé sur le pipeline pondéré",
    author: "GrowthOS",
    dependencies: ["ai-deal-coach", "account-intelligence"],
    permissions: ["analytics:read", "deals:read"],
    uiSlots: ["dashboard-widgets"],
    routes: [{ path: "/revenue", label: "Revenus & KPIs", icon: "TrendingUp" }],
  },
  {
    id: "ai-deal-coach",
    name: "AI Deal Coach",
    version: "1.0.0",
    description: "Coach IA pour le pipeline — Health Score, détection de risques et recommandations contextuelles basées sur Meetings, Memory et Signals",
    author: "GrowthOS",
    dependencies: ["growth-memory", "meeting-intelligence", "signal-intelligence"],
    permissions: ["deals:read", "ai:analyze", "memory:read", "meetings:read", "signals:read"],
    uiSlots: ["dashboard-widgets"],
    routes: [{ path: "/deal-coach", label: "Deal Coach", icon: "Target" }],
  },
  {
    id: "ai-sdr",
    name: "AI SDR",
    version: "1.0.0",
    description: "SDR semi-autonome propulsé par IA — rédige emails hyper-personnalisés et séquences multi-touch en synthétisant Memory, Account Intelligence et Signals",
    author: "GrowthOS",
    dependencies: ["growth-memory", "account-intelligence", "signal-intelligence"],
    permissions: ["ai:generate", "emails:write", "signals:read", "memory:read", "accounts:read"],
    uiSlots: ["dashboard-widgets"],
    routes: [{ path: "/ai-sdr", label: "AI Assistant", icon: "Bot" }],
  },
  {
    id: "signal-intelligence",
    name: "Signal Intelligence",
    version: "1.0.0",
    description: "Radar de signaux business : financement, recrutement, actualités — détection automatique et alertes EventBus",
    author: "GrowthOS",
    dependencies: [],
    permissions: ["signals:read", "signals:write"],
    uiSlots: ["dashboard-widgets"],
    routes: [{ path: "/signals", label: "Signaux", icon: "Radar" }],
  },
  {
    id: "account-intelligence",
    name: "Account Intelligence",
    version: "1.0.0",
    description: "Vue 360° des comptes avec Health Score dynamique basé sur l'activité, l'engagement et les signaux mémoire",
    author: "GrowthOS",
    dependencies: ["growth-memory", "meeting-intelligence"],
    permissions: ["accounts:read", "accounts:write", "memory:read", "meetings:read"],
    uiSlots: ["dashboard-widgets"],
    routes: [{ path: "/accounts", label: "Comptes", icon: "Building" }],
  },
  {
    id: "knowledge-base",
    name: "Base de Connaissances",
    version: "1.0.0",
    description: "Centralise Playbooks, Scripts, Objections, Procédures — indexés automatiquement dans Growth Memory pour l'AI SDR et le Deal Coach",
    author: "GrowthOS",
    dependencies: ["growth-memory"],
    permissions: ["memory:read", "memory:write"],
    uiSlots: ["dashboard-widgets"],
    routes: [{ path: "/knowledge", label: "Base de Connaissances", icon: "BookOpen" }],
  },
  {
    id: "executive-command",
    name: "Command Center",
    version: "1.0.0",
    description: "Cockpit exécutif — agrège tous les plugins en un seul tableau de bord stratégique avec un Assistant IA conversationnel",
    author: "GrowthOS",
    dependencies: ["revenue-intelligence", "ai-deal-coach", "signal-intelligence"],
    permissions: ["analytics:read", "deals:read", "signals:read"],
    uiSlots: ["dashboard-widgets"],
    routes: [{ path: "/executive", label: "Command Center", icon: "Crown" }],
  },
  {
    id: "ereputation-seo",
    name: "E-Réputation & SEO/GEO",
    version: "1.0.0",
    description: "Gestion complète de la réputation digitale et de la visibilité SEO/GEO — Campagnes B2B/B2C, suivi SERP, analyse de sentiment, calendrier social et gestion PBN",
    author: "GrowthOS",
    dependencies: ["growth-memory", "ai-sdr"],
    permissions: ["ereputation:read", "ereputation:write", "content:generate"],
    uiSlots: ["dashboard-widgets"],
    routes: [{ path: "/ereputation", label: "E-Réputation", icon: "Shield" }],
  },
];

export async function seedBuiltInPlugins(): Promise<void> {
  logger.info("Seeding built-in plugins...");

  // Ensure plugin_states and growth-memory tables exist
  try {
    await runPluginStateMigration();
  } catch (err) {
    logger.warn({ err }, "plugin_states migration failed — state persistence unavailable");
  }
  try {
    await runGrowthMemoryMigration();
  } catch (err) {
    logger.warn({ err }, "growth-memory migration failed — memory plugin may not work");
  }
  try {
    await runMeetingIntelligenceMigration();
  } catch (err) {
    logger.warn({ err }, "meeting-intelligence migration failed — meetings plugin may not work");
  }
  try {
    await runAccountIntelligenceMigration();
  } catch (err) {
    logger.warn({ err }, "account-intelligence migration failed — account metrics may not work");
  }
  try {
    await runSignalIntelligenceMigration();
  } catch (err) {
    logger.warn({ err }, "signal-intelligence migration failed — signal status column may not exist");
  }
  try {
    await runDealCoachMigration();
  } catch (err) {
    logger.warn({ err }, "deal-coach migration failed — health_score fields may not exist on deals");
  }
  try {
    await runKnowledgeBaseMigration();
  } catch (err) {
    logger.warn({ err }, "knowledge-base migration failed — knowledge_articles table may not exist");
  }
  try {
    await runEreputationMigration();
  } catch (err) {
    logger.warn({ err }, "ereputation migration failed — erep_* tables may not exist");
  }

  for (const manifest of BUILT_IN_PLUGINS) {
    try {
      pluginManager.register(manifest);
    } catch (err) {
      logger.error({ pluginId: manifest.id, err }, "Failed to register built-in plugin");
    }
  }

  // Activate all plugins following DAG order
  await pluginManager.activateAll();

  // Restore previously-disabled states from DB
  const disabledIds = await loadDisabledPluginIds();
  for (const id of disabledIds) {
    try {
      await pluginManager.disable(id);
      logger.info({ pluginId: id }, "Plugin disabled state restored from DB");
    } catch (err) {
      logger.warn({ pluginId: id, err }, "Could not restore disabled state for plugin");
    }
  }

  const active = pluginManager.active();
  logger.info(
    { count: active.length, ids: active.map((r) => r.manifest.id) },
    "Plugin runtime ready",
  );
}
