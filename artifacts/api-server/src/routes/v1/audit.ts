import { Router } from "express";
import { requireAuth } from "../../middlewares/auth";
import { requirePlatformAdmin } from "../../middlewares/platformAdmin";
import { runDeepAudit, runAutoFix, type DeepAuditReport } from "../../lib/audit/deep-audit";
import type { AuthPayload } from "../../middlewares/auth";
import { logger } from "../../lib/logger";

const router = Router();

let lastReport: DeepAuditReport | null = null;
let auditPromise: Promise<void> | null = null;
let lastFailure: string | null = null;
let startedAt = 0;
let progress = { completed: 0, total: 0 };

function startAudit(app: Parameters<typeof runDeepAudit>[0], port: number, admin: AuthPayload): void {
  lastReport = null;
  lastFailure = null;
  startedAt = Date.now();
  progress = { completed: 0, total: 0 };
  // Do not hold the HTTP request open for the full route scan. The UI polls
  // this endpoint for status; only one scan can run at once.
  auditPromise = runDeepAudit(app, port, admin, (completed, total) => {
    progress = { completed, total };
  }).then(report => {
    lastReport = report;
  }).catch(err => {
    lastFailure = err instanceof Error ? err.message : "Unknown error";
    logger.error({ err }, "Deep audit failed");
  }).finally(() => {
    auditPromise = null;
  });
}

/**
 * GET /api/v1/audit/deep
 * Start a deep audit with ?force=true, or poll the current run with no query.
 * Return immediately so the browser's 30-second request timeout never aborts
 * a legitimate background scan. Force does not start duplicate scans.
 */
router.get("/deep", requireAuth, requirePlatformAdmin, async (req, res) => {
  const app = req.app;
  const port = Number(process.env["PORT"] ?? 8080);

  if (req.query["force"] === "true" && !auditPromise) startAudit(app, port, req.auth!);

  if (auditPromise) {
    res.status(202).json({ status: "running", startedAt, progress });
  } else if (lastFailure) {
    res.json({ status: "failed", error: lastFailure });
  } else if (lastReport) {
    res.json({ status: "complete", cached: true, report: lastReport });
  } else {
    res.json({ status: "idle" });
  }
});

/**
 * POST /api/v1/audit/auto-fix
 * Re-run DB migrations, re-enable ERROR plugins, clean orphaned data.
 */
router.post("/auto-fix", requireAuth, requirePlatformAdmin, async (_req, res) => {
  if (auditPromise) {
    res.status(409).json({ error: "Wait for the running audit before using auto-fix" });
    return;
  }
  try {
    lastReport = null;
    lastFailure = null;
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
