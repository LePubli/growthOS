export const knowledgeBaseManifest = {
  id: "knowledge-base",
  name: "Base de Connaissances",
  version: "1.0.0",
  description: "Centralise Playbooks, Scripts de vente, Objections, Procédures — indexés automatiquement dans Growth Memory pour l'AI SDR et le Deal Coach",
  author: "GrowthOS",
  dependencies: ["growth-memory"],
  permissions: ["kb:read", "kb:write", "memory:write"],
  uiSlots: ["dashboard-widgets"],
  routes: [{ path: "/knowledge", label: "Base de Connaissances", icon: "BookOpen" }],
};
