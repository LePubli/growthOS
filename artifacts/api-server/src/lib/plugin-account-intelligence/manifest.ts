export const ACCOUNT_INTELLIGENCE_MANIFEST = {
  id: "account-intelligence",
  name: "Account Intelligence",
  version: "1.0.0",
  description: "Vue 360° des comptes avec Health Score dynamique basé sur l'activité, l'engagement et les signaux mémoire",
  author: "GrowthOS",
  dependencies: ["growth-memory", "meeting-intelligence"] as string[],
  permissions: ["accounts:read", "accounts:write", "memory:read", "meetings:read"] as string[],
  uiSlots: ["dashboard-widgets"] as string[],
  routes: [{ path: "/accounts", label: "Comptes", icon: "Building" }] as { path: string; label: string; icon: string }[],
} as const;
