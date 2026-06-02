export const SIGNAL_INTELLIGENCE_MANIFEST = {
  id: "signal-intelligence",
  name: "Signal Intelligence",
  version: "1.0.0",
  description: "Radar de signaux business : financement, recrutement, actualités — détection automatique et alertes EventBus",
  author: "GrowthOS",
  dependencies: [] as string[],
  permissions: ["signals:read", "signals:write"] as string[],
  uiSlots: ["dashboard-widgets"] as string[],
  eventPublishers: ["signal.received"] as string[],
  routes: [{ path: "/signals", label: "Signaux", icon: "Radar" }] as { path: string; label: string; icon: string }[],
} as const;
