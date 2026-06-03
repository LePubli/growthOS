export const executiveCommandManifest = {
  id: "executive-command",
  name: "Command Center",
  version: "1.0.0",
  description: "Cockpit exécutif — agrège tous les plugins en un seul tableau de bord stratégique avec un Assistant IA conversationnel pour interroger vos données business",
  author: "GrowthOS",
  dependencies: ["revenue-intelligence", "ai-deal-coach", "signal-intelligence"],
  permissions: ["admin:read", "analytics:read"],
  uiSlots: ["dashboard-widgets"],
  routes: [{ path: "/executive", label: "Command Center", icon: "Crown" }],
};
