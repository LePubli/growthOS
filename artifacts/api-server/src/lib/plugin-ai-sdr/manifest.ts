export const AI_SDR_MANIFEST = {
  id: "ai-sdr",
  name: "AI SDR",
  version: "1.0.0",
  description: "SDR semi-autonome propulsé par IA — rédige des emails hyper-personnalisés et des séquences multi-touch en synthétisant Memory, Account Intelligence et Signals",
  author: "GrowthOS",
  dependencies: ["growth-memory", "account-intelligence", "signal-intelligence"],
  permissions: ["ai:generate", "emails:write", "signals:read", "memory:read", "accounts:read"],
  uiSlots: ["dashboard-widgets"],
  routes: [{ path: "/ai-sdr", label: "AI Assistant", icon: "Bot" }],
} as const;
