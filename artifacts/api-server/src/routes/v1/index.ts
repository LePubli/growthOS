import prospectMonitoringRouter from './prospect-monitoring';
import { Router } from "express";
import { requireAuth } from "../../middlewares/auth";
import { requireTenant } from "../../middlewares/tenantIsolation";
import { registerV1Mount } from "../../lib/list-routes";
import authRouter from "./auth";
import prospectsRouter from "./prospects";
import pipelineRouter from "./pipeline";
import sequencesRouter from "./sequences";
import signalsRouter from "./signals";
import dashboardRouter from "./dashboard";
import activitiesRouter from "./activities";
import workflowsRouter from "./workflows-api";
import templatesRouter from "./templates-api";
import webhooksRouter from "./webhooks-api";
import accountsRouter from "./accounts";
import emailRouter from "./email";
import searchRouter from "./search";
import usersRouter from "./users";
import teamRouter from "./team";
import apiKeysRouter from "./api-keys";
import analyticsRouter from "./analytics";
import pluginsRouter from "./plugins";
import memoryRouter from "./memory";
import meetingsRouter from "./meetings";
import aiSdrRouter from "./plugins/ai-sdr";
import dealCoachRouter from "./plugins/deal-coach";
import revenueRouter from "./plugins/revenue";
import knowledgeRouter from "./plugins/knowledge";
import executiveRouter from "./plugins/executive";
import sourcingRouter from "./sourcing";
import cloudBrowserRouter from './cloud-browser';
import notificationsRouter from "./notifications";
import adminRouter from "./admin";
import pluginMarketplaceRouter from "./plugin-marketplace";
import auditRouter from "./audit";
import enrichmentRouter from "./plugins/enrichment";
import ereputationRouter from "./plugins/ereputation";
import tasksRouter from "./tasks";
import reportingRouter from "./reporting";
import collaborationRouter from "./collaboration";
import complianceRouter from "./compliance";
import ssoRouter from "./sso";
import apiDocsRouter from "./api-docs";
import billingRouter from "./billing";
import billingWebhookRouter from "./billing-webhook";
import integrationsRouter from "./integrations";
import publicApiRouter from "./public-api";
import clientEreputationRouter from "./client-ereputation";
import adminUsersRouter from "./admin-users";
import adminPlansRouter from "./admin-plans";
import adminAuditRouter from "./admin-audit";
import adminApiKeysRouter from "./admin-api-keys";
import adminQuotasRouter from "./admin-quotas";
import routeAuditRouter from "./route-audit";
import authPublicRouter from "./auth-public";
import plansPublicRouter from "./plans-public";
import autopilotRouter from "./autopilot";
import adminCronRouter from "./admin-cron";
import setupRouter from "./setup";
import assistantRouter from "./assistant";
import seoAuditRouter from "./seo-audit";

const router = Router();

function mount(path: string, ...handlers: any[]): void {
  router.use(path, ...handlers);
  registerV1Mount(path, handlers);
}

// ── ROUTES PUBLIQUES (pas d'auth requise) ────────────────────────────────
mount("/auth",            authRouter);
mount("/auth",            authPublicRouter);
mount("/api-docs",        apiDocsRouter);
mount("/public",          publicApiRouter);
mount("/billing/webhook", billingWebhookRouter);
mount("/plans",           plansPublicRouter);
mount("/setup",           setupRouter);

// ── ROUTES PROTÉGÉES (requireAuth + requireTenant au niveau mount) ────────
mount("/prospects",          requireAuth, requireTenant, prospectMonitoringRouter, prospectsRouter);
mount("/assistant",          requireAuth, requireTenant, assistantRouter);
mount("/seo-audit",          requireAuth, requireTenant, seoAuditRouter);
mount("/pipeline",           requireAuth, requireTenant, pipelineRouter);
mount("/sequences",          requireAuth, requireTenant, sequencesRouter);
mount("/signals",            requireAuth, requireTenant, signalsRouter);
mount("/dashboard",          requireAuth, requireTenant, dashboardRouter);
mount("/activities",         requireAuth, requireTenant, activitiesRouter);
mount("/workflows",          requireAuth, requireTenant, workflowsRouter);
mount("/templates",          requireAuth, requireTenant, templatesRouter);
mount("/webhooks",           requireAuth, requireTenant, webhooksRouter);
mount("/accounts",           requireAuth, requireTenant, accountsRouter);
mount("/email",              requireAuth, requireTenant, emailRouter);
mount("/search",             requireAuth, requireTenant, searchRouter);
mount("/users",              requireAuth, requireTenant, usersRouter);
mount("/team",               requireAuth, requireTenant, teamRouter);
mount("/api-keys",           requireAuth, requireTenant, apiKeysRouter);
mount("/analytics",          requireAuth, requireTenant, analyticsRouter);
mount("/plugins",            requireAuth, requireTenant, pluginsRouter);
mount("/memory",             requireAuth, requireTenant, memoryRouter);
mount("/meetings",           requireAuth, requireTenant, meetingsRouter);
mount("/ai-sdr",             requireAuth, requireTenant, aiSdrRouter);
mount("/deal-coach",         requireAuth, requireTenant, dealCoachRouter);
mount("/revenue",            requireAuth, requireTenant, revenueRouter);
mount("/knowledge",          requireAuth, requireTenant, knowledgeRouter);
mount("/executive",          requireAuth, requireTenant, executiveRouter);
mount("/sourcing",           requireAuth, requireTenant, sourcingRouter);
mount('/browser',requireAuth,requireTenant,cloudBrowserRouter);
mount("/notifications",      requireAuth, requireTenant, notificationsRouter);
mount("/admin",              requireAuth, requireTenant, adminRouter);
mount("/plugin-marketplace", requireAuth, requireTenant, pluginMarketplaceRouter);
mount("/audit",              requireAuth, requireTenant, auditRouter);
mount("/enrich",             requireAuth, requireTenant, enrichmentRouter);
mount("/ereputation",        requireAuth, requireTenant, ereputationRouter);
mount("/tasks",              requireAuth, requireTenant, tasksRouter);
mount("/reporting",          requireAuth, requireTenant, reportingRouter);
mount("/collaboration",      requireAuth, requireTenant, collaborationRouter);
mount("/compliance",         requireAuth, requireTenant, complianceRouter);
mount("/sso",                requireAuth, requireTenant, ssoRouter);
mount("/billing",            requireAuth, requireTenant, billingRouter);
mount("/integrations",       requireAuth, requireTenant, integrationsRouter);

// ── PORTAIL CLIENT — E-Réputation ────────────────────────────────────────────
// Auth is handled inside the router (requireAuth + requireRole)
// No requireTenant here: client tokens are tenant-scoped via JWT
mount("/client/ereputation", clientEreputationRouter);

// ── Admin Users & Roles ───────────────────────────────────────────────────────
mount("/admin", adminUsersRouter);

// ── Admin Plans & Subscriptions ───────────────────────────────────────────────
mount("/admin", adminPlansRouter);

// ── Admin Audit Logs ──────────────────────────────────────────────────────────
mount("/admin", adminAuditRouter);

// ── Admin Provider API Keys ───────────────────────────────────────────────────
mount("/admin", adminApiKeysRouter);

// ── Admin Quota Monitoring ────────────────────────────────────────────────────
mount("/admin", adminQuotasRouter);

// ── Route Audit ───────────────────────────────────────────────────────────────
mount("/route-audit", requireAuth, routeAuditRouter);

// ── Autopilot — Agents IA autonomes ──────────────────────────────────────────
mount("/autopilot", requireAuth, requireTenant, autopilotRouter);

// ── Admin — Signal Cron ───────────────────────────────────────────────────────
mount("/admin/cron", adminCronRouter);

export default router;
