import { Router } from "express";
import { requireAuth } from "../../middlewares/auth";
import { requireTenant } from "../../middlewares/tenantIsolation";
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

const router = Router();

// ── ROUTES PUBLIQUES (pas d'auth requise) ────────────────────────────────
router.use("/auth",            authRouter);
router.use("/api-docs",        apiDocsRouter);
router.use("/public",          publicApiRouter);
router.use("/billing/webhook", billingWebhookRouter);

// ── ROUTES PROTÉGÉES (requireAuth + requireTenant au niveau mount) ────────
router.use("/prospects",          requireAuth, requireTenant, prospectsRouter);
router.use("/pipeline",           requireAuth, requireTenant, pipelineRouter);
router.use("/sequences",          requireAuth, requireTenant, sequencesRouter);
router.use("/signals",            requireAuth, requireTenant, signalsRouter);
router.use("/dashboard",          requireAuth, requireTenant, dashboardRouter);
router.use("/activities",         requireAuth, requireTenant, activitiesRouter);
router.use("/workflows",          requireAuth, requireTenant, workflowsRouter);
router.use("/templates",          requireAuth, requireTenant, templatesRouter);
router.use("/webhooks",           requireAuth, requireTenant, webhooksRouter);
router.use("/accounts",           requireAuth, requireTenant, accountsRouter);
router.use("/email",              requireAuth, requireTenant, emailRouter);
router.use("/search",             requireAuth, requireTenant, searchRouter);
router.use("/users",              requireAuth, requireTenant, usersRouter);
router.use("/team",               requireAuth, requireTenant, teamRouter);
router.use("/api-keys",           requireAuth, requireTenant, apiKeysRouter);
router.use("/analytics",          requireAuth, requireTenant, analyticsRouter);
router.use("/plugins",            requireAuth, requireTenant, pluginsRouter);
router.use("/memory",             requireAuth, requireTenant, memoryRouter);
router.use("/meetings",           requireAuth, requireTenant, meetingsRouter);
router.use("/ai-sdr",             requireAuth, requireTenant, aiSdrRouter);
router.use("/deal-coach",         requireAuth, requireTenant, dealCoachRouter);
router.use("/revenue",            requireAuth, requireTenant, revenueRouter);
router.use("/knowledge",          requireAuth, requireTenant, knowledgeRouter);
router.use("/executive",          requireAuth, requireTenant, executiveRouter);
router.use("/sourcing",           requireAuth, requireTenant, sourcingRouter);
router.use("/notifications",      requireAuth, requireTenant, notificationsRouter);
router.use("/admin",              requireAuth, requireTenant, adminRouter);
router.use("/plugin-marketplace", requireAuth, requireTenant, pluginMarketplaceRouter);
router.use("/audit",              requireAuth, requireTenant, auditRouter);
router.use("/enrich",             requireAuth, requireTenant, enrichmentRouter);
router.use("/ereputation",        requireAuth, requireTenant, ereputationRouter);
router.use("/tasks",              requireAuth, requireTenant, tasksRouter);
router.use("/reporting",          requireAuth, requireTenant, reportingRouter);
router.use("/collaboration",      requireAuth, requireTenant, collaborationRouter);
router.use("/compliance",         requireAuth, requireTenant, complianceRouter);
router.use("/sso",                requireAuth, requireTenant, ssoRouter);
router.use("/billing",            requireAuth, requireTenant, billingRouter);
router.use("/integrations",       requireAuth, requireTenant, integrationsRouter);

// ── PORTAIL CLIENT — E-Réputation ────────────────────────────────────────────
// Auth is handled inside the router (requireAuth + requireRole)
// No requireTenant here: client tokens are tenant-scoped via JWT
router.use("/client/ereputation", clientEreputationRouter);

export default router;
