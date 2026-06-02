export const MEETING_INTELLIGENCE_MANIFEST = {
  id: "meeting-intelligence",
  name: "Meeting Intelligence",
  version: "1.0.0",
  description: "Transcription, résumé et extraction d'insights depuis vos enregistrements de réunions",
  author: "GrowthOS",
  dependencies: ["growth-memory"] as string[],
  permissions: ["meetings:read", "meetings:write", "memory:write"] as string[],
  uiSlots: ["dashboard-widgets"] as string[],
  routes: [{ path: "/meetings", label: "Réunions", icon: "Video" }] as { path: string; label: string; icon: string }[],
} as const;
