export const EREPUTATION_MANIFEST = {
  id: "ereputation-seo",
  name: "E-Réputation & SEO/GEO",
  version: "1.0.0",
  description: "Gestion complète de la réputation digitale et de la visibilité SEO/GEO — Campagnes B2B/B2C, suivi SERP, analyse de sentiment, calendrier social et gestion PBN.",
  author: "GrowthOS",
  dependencies: ["growth-memory", "ai-sdr"],
  permissions: ["ereputation:read", "ereputation:write", "content:generate"],
  uiSlots: ["dashboard-widgets"],
  routes: [{ path: "/ereputation", label: "E-Réputation", icon: "Shield" }],
} as const;
