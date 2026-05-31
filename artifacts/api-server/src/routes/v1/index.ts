import { Router } from "express";
import { requireAuth } from "../../middlewares/auth";
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

const router = Router();

router.use("/auth", authRouter);
router.use("/prospects", requireAuth, prospectsRouter);
router.use("/pipeline", requireAuth, pipelineRouter);
router.use("/sequences", requireAuth, sequencesRouter);
router.use("/signals", requireAuth, signalsRouter);
router.use("/dashboard", requireAuth, dashboardRouter);
router.use("/activities", requireAuth, activitiesRouter);
router.use("/workflows", requireAuth, workflowsRouter);
router.use("/templates", requireAuth, templatesRouter);
router.use("/webhooks", requireAuth, webhooksRouter);
router.use("/accounts", requireAuth, accountsRouter);
router.use("/email", requireAuth, emailRouter);
router.use("/search", requireAuth, searchRouter);
router.use("/users", requireAuth, usersRouter);
router.use("/team", requireAuth, teamRouter);
router.use("/api-keys", requireAuth, apiKeysRouter);

export default router;
