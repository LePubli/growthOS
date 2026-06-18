import { Router } from "express";
import { requireAuth } from "../../middlewares/auth";
import { triggerSignalCron } from "../../lib/cron/SignalCron";
import { logger } from "../../lib/logger";

const router = Router();

router.post("/signal-cron/trigger", requireAuth, async (req, res) => {
  if ((req.auth as any)?.role !== "admin") {
    res.status(403).json({ error: "Accès refusé — rôle admin requis" });
    return;
  }
  try {
    logger.info({ triggeredBy: req.auth?.userId }, "Admin: manual signal-cron trigger");
    const result = await triggerSignalCron();
    res.json({ ok: true, ...result, message: "Cron de signaux déclenché manuellement" });
  } catch (err) {
    logger.error({ err }, "Admin: signal-cron trigger failed");
    res.status(500).json({ error: "Erreur lors du déclenchement du cron" });
  }
});

export default router;
