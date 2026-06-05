import { Router } from "express";
import { requireAuth } from "../../middlewares/auth";

const router = Router();

const OPENAPI_SPEC = {
  openapi: "3.0.3",
  info: { title: "GrowthOS API", version: "1.0.0", description: "API REST multi-tenant pour la plateforme GrowthOS Sales Intelligence" },
  servers: [{ url: "/api/v1", description: "Production" }],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    schemas: {
      Prospect: { type: "object", properties: { id: { type: "string", format: "uuid" }, firstName: { type: "string" }, lastName: { type: "string" }, email: { type: "string", format: "email" }, company: { type: "string" }, status: { type: "string", enum: ["new","contacted","qualified","proposal","negotiation","won","lost"] }, score: { type: "integer", minimum: 0, maximum: 100 }, tenantId: { type: "string", format: "uuid" }, createdAt: { type: "string", format: "date-time" } } },
      Deal: { type: "object", properties: { id: { type: "string", format: "uuid" }, title: { type: "string" }, value: { type: "number" }, stage: { type: "string", enum: ["lead","qualified","proposal","negotiation","won","lost"] }, probability: { type: "integer" }, closeDate: { type: "string" } } },
      Signal: { type: "object", properties: { id: { type: "string", format: "uuid" }, title: { type: "string" }, type: { type: "string" }, companyName: { type: "string" }, isRead: { type: "boolean" }, isStarred: { type: "boolean" }, createdAt: { type: "string", format: "date-time" } } },
      Task: { type: "object", properties: { id: { type: "string", format: "uuid" }, title: { type: "string" }, status: { type: "string", enum: ["todo","in_progress","done","cancelled"] }, priority: { type: "string", enum: ["high","medium","low"] }, dueDate: { type: "string", format: "date-time" } } },
      Error: { type: "object", properties: { error: { type: "string" }, code: { type: "string" } } },
    },
  },
  paths: {
    "/auth/login": { post: { tags: ["Auth"], summary: "Connexion", requestBody: { content: { "application/json": { schema: { type: "object", required: ["email","password"], properties: { email: { type: "string" }, password: { type: "string" } } } } } }, responses: { "200": { description: "JWT token" }, "401": { description: "Identifiants invalides" } } } },
    "/auth/refresh": { post: { tags: ["Auth"], summary: "Rafraîchir le token JWT", responses: { "200": { description: "Nouveau token" } } } },
    "/prospects": { get: { tags: ["Prospects"], summary: "Lister les prospects", parameters: [{ name: "status", in: "query", schema: { type: "string" } }, { name: "limit", in: "query", schema: { type: "integer", default: 50 } }, { name: "offset", in: "query", schema: { type: "integer", default: 0 } }], responses: { "200": { description: "Liste de prospects" } } }, post: { tags: ["Prospects"], summary: "Créer un prospect", requestBody: { content: { "application/json": { schema: { "$ref": "#/components/schemas/Prospect" } } } }, responses: { "201": { description: "Prospect créé" } } } },
    "/prospects/{id}": { get: { tags: ["Prospects"], summary: "Détail d'un prospect", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Prospect" }, "404": { description: "Non trouvé" } } }, patch: { tags: ["Prospects"], summary: "Modifier un prospect", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Prospect modifié" } } }, delete: { tags: ["Prospects"], summary: "Supprimer un prospect", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "204": { description: "Supprimé" } } } },
    "/pipeline": { get: { tags: ["Pipeline"], summary: "Lister les deals", responses: { "200": { description: "Liste de deals" } } }, post: { tags: ["Pipeline"], summary: "Créer un deal", responses: { "201": { description: "Deal créé" } } } },
    "/pipeline/{id}": { get: { tags: ["Pipeline"], summary: "Détail d'un deal", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Deal" } } }, patch: { tags: ["Pipeline"], summary: "Modifier un deal", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Deal modifié" } } } },
    "/signals": { get: { tags: ["Signals"], summary: "Lister les signaux d'intention", parameters: [{ name: "type", in: "query", schema: { type: "string" } }, { name: "isRead", in: "query", schema: { type: "boolean" } }], responses: { "200": { description: "Signaux" } } } },
    "/tasks": { get: { tags: ["Tasks"], summary: "Lister les tâches", parameters: [{ name: "status", in: "query", schema: { type: "string" } }, { name: "priority", in: "query", schema: { type: "string" } }], responses: { "200": { description: "Tâches" } } }, post: { tags: ["Tasks"], summary: "Créer une tâche", requestBody: { content: { "application/json": { schema: { "$ref": "#/components/schemas/Task" } } } }, responses: { "201": { description: "Tâche créée" } } } },
    "/tasks/{id}/complete": { post: { tags: ["Tasks"], summary: "Marquer une tâche comme terminée", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Tâche complétée" } } } },
    "/activities": { get: { tags: ["Activities"], summary: "Lister les activités", parameters: [{ name: "prospectId", in: "query", schema: { type: "string" } }, { name: "type", in: "query", schema: { type: "string", enum: ["call","email","meeting","note","task"] } }], responses: { "200": { description: "Activités" } } }, post: { tags: ["Activities"], summary: "Créer une activité", responses: { "201": { description: "Activité créée" } } } },
    "/sequences": { get: { tags: ["Sequences"], summary: "Lister les séquences email", responses: { "200": { description: "Séquences" } } } },
    "/reporting/csv/{entity}": { get: { tags: ["Reporting"], summary: "Export CSV", parameters: [{ name: "entity", in: "path", required: true, schema: { type: "string", enum: ["prospects","deals","signals","activities"] } }], responses: { "200": { description: "Fichier CSV", content: { "text/csv": { schema: { type: "string" } } } } } } },
    "/reporting/pdf/{reportType}": { get: { tags: ["Reporting"], summary: "Export PDF", parameters: [{ name: "reportType", in: "path", required: true, schema: { type: "string", enum: ["pipeline","prospects","activity"] } }], responses: { "200": { description: "Fichier PDF (HTML)" } } } },
    "/api-keys": { get: { tags: ["API Keys"], summary: "Lister les clés API", responses: { "200": { description: "Clés API" } } }, post: { tags: ["API Keys"], summary: "Créer une clé API", responses: { "201": { description: "Clé créée" } } } },
    "/webhooks": { get: { tags: ["Webhooks"], summary: "Lister les webhooks", responses: { "200": { description: "Webhooks" } } }, post: { tags: ["Webhooks"], summary: "Créer un webhook", responses: { "201": { description: "Webhook créé" } } } },
    "/collaboration/audit-logs": { get: { tags: ["Compliance"], summary: "Audit trail", parameters: [{ name: "entityType", in: "query", schema: { type: "string" } }, { name: "entityId", in: "query", schema: { type: "string" } }], responses: { "200": { description: "Logs d'audit" } } } },
    "/compliance/export-data": { post: { tags: ["Compliance"], summary: "Export RGPD des données personnelles", responses: { "200": { description: "Données exportées en JSON" } } } },
    "/sso/config": { get: { tags: ["SSO"], summary: "Configurations SSO", responses: { "200": { description: "Configurations" } } }, post: { tags: ["SSO"], summary: "Configurer le SSO", responses: { "201": { description: "Config créée/mise à jour" } } } },
  },
};

router.get("/openapi.json", (_req, res) => {
  res.json(OPENAPI_SPEC);
});

router.get("/stats", requireAuth, async (req, res) => {
  res.json({
    endpoints: Object.keys(OPENAPI_SPEC.paths).length,
    tags: [...new Set(Object.values(OPENAPI_SPEC.paths).flatMap(p => Object.values(p as any).flatMap((m: any) => m.tags || [])))],
    version: OPENAPI_SPEC.info.version,
  });
});

export default router;
