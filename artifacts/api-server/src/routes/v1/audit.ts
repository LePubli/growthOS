import { Router } from "express";
import { requireAuth } from "../../middlewares/auth";
import { requirePlatformAdmin } from "../../middlewares/platformAdmin";
import { runDeepAudit, runAutoFix } from "../../lib/audit/deep-audit";
import { logger } from "../../lib/logger";

const router = Router();

let lastReport: unknown = null;
let auditRunning = false;

/**
 * GET /api/v1/audit/deep
 * Run a full deep audit (routes, DB, plugins) and return the report.
 * Cached for 60s — use ?force=true to bypass.
 */
router.get("/deep", requireAuth, requirePlatformAdmin, async (req, res) => {
  const app = req.app;
  const port = Number(process.env["PORT"] ?? 8080);

  if (auditRunning) {
    res.status(429).json({ error: "Audit already running, please wait" });
    return;
  }

  if (lastReport && req.query["force"] !== "true") {
    res.json({ cached: true, report: lastReport });
    return;
  }

  auditRunning = true;
  try {
    const report = await runDeepAudit(app, port);
    lastReport = report;
    res.json({ cached: false, report });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({ err }, "Deep audit failed");
    res.status(500).json({ error: message });
  } finally {
    auditRunning = false;
  }
});

/**
 * POST /api/v1/audit/auto-fix
 * Re-run DB migrations, re-enable ERROR plugins, clean orphaned data.
 */
router.post("/auto-fix", requireAuth, requirePlatformAdmin, async (_req, res) => {
  try {
    lastReport = null;
    const result = await runAutoFix();
    logger.info(result, "Auto-fix completed");
    res.json({ message: "Auto-fix completed", ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({ err }, "Auto-fix failed");
    res.status(500).json({ error: message });
  }
});

export default router;
