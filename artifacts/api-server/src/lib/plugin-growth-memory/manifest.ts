export const GROWTH_MEMORY_MANIFEST = {
  id: "growth-memory",
  name: "Growth Memory",
  version: "1.0.0",
  description: "Second Brain : indexation sémantique et recherche dans vos données métier",
  author: "GrowthOS",
  dependencies: [] as string[],
  permissions: ["memory:read", "memory:write"] as string[],
  uiSlots: ["dashboard-widgets"] as string[],
  routes: [{ path: "/memory", label: "Mémoire", icon: "Brain" }] as { path: string; label: string; icon: string }[],
} as const;
