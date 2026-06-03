export const REVENUE_INTELLIGENCE_MANIFEST = {
  id: "revenue-intelligence",
  name: "Revenue Intelligence",
  version: "1.0.0",
  description: "Dashboards analytiques haute-fréquence — KPIs Win Rate, Conversion, Velocity, ARR/MRR, Forecast IA basé sur le pipeline pondéré",
  author: "GrowthOS",
  dependencies: ["ai-deal-coach", "account-intelligence"],
  permissions: ["analytics:read", "deals:read"],
  uiSlots: ["dashboard-widgets"],
  routes: [{ path: "/revenue", label: "Revenus & KPIs", icon: "TrendingUp" }],
} as const;
