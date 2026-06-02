export const AI_DEAL_COACH_MANIFEST = {
  id: "ai-deal-coach",
  name: "AI Deal Coach",
  version: "1.0.0",
  description: "Coach IA pour le pipeline — Health Score, détection de risques et recommandations contextuelles basées sur Meetings, Memory et Signals",
  author: "GrowthOS",
  dependencies: ["growth-memory", "meeting-intelligence", "signal-intelligence"],
  permissions: ["deals:read", "ai:analyze", "memory:read", "meetings:read", "signals:read"],
  uiSlots: ["dashboard-widgets"],
  routes: [{ path: "/deal-coach", label: "Deal Coach", icon: "Target" }],
} as const;
