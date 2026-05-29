import { Router } from "express";
import { requireAuth } from "../../middlewares/auth";
import authRouter from "./auth";
import prospectsRouter from "./prospects";
import pipelineRouter from "./pipeline";
import sequencesRouter from "./sequences";
import signalsRouter from "./signals";
import dashboardRouter from "./dashboard";

const router = Router();

router.use("/auth", authRouter);
router.use("/prospects", requireAuth, prospectsRouter);
router.use("/pipeline", requireAuth, pipelineRouter);
router.use("/sequences", requireAuth, sequencesRouter);
router.use("/signals", requireAuth, signalsRouter);
router.use("/dashboard", requireAuth, dashboardRouter);

export default router;
