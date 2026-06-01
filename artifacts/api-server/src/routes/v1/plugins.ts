import { Router } from "express";
import { requireAuth } from "../../middlewares/auth";
import { pluginManager } from "../../lib/plugin-runtime";
import { logger } from "../../lib/logger";
import { writeAuditLog, fetchAuditLogs } from "../../lib/plugin-runtime/audit";

const router = Router();

/**
 * GET /api/v1/plugins/status
 * Returns all registered plugins with their lifecycle state.
 */
router.get("/status", requireAuth, (_req, res) => {
  const all = pluginManager.all().map((r) => pluginManager.toStatusResponse(r));
  res.json({ plugins: all, total: all.length });
});

/**
 * GET /api/v1/plugins/active
 * Returns only ACTIVE plugins — used by the frontend SDK.
 */
router.get("/active", requireAuth, (_req, res) => {
  const active = pluginManager
    .active()
    .map((r) => pluginManager.toStatusResponse(r));
  res.json({ plugins: active, total: active.length });
});

/**
 * GET /api/v1/plugins/audit
 * Audit trail of all plugin lifecycle events (most recent first).
 * Query params: plugin_id, limit, offset
 */
router.get("/audit", requireAuth, async (req, res) => {
  try {
    const pluginId = typeof req.query.plugin_id === "string" ? req.query.plugin_id : undefined;
    const limit = parseInt(String(req.query.limit ?? "50"), 10);
    const offset = parseInt(String(req.query.offset ?? "0"), 10);
    const result = await fetchAuditLogs({ pluginId, limit, offset });
    res.json(result);
  } catch (err) {
    logger.error({ err }, "Failed to fetch audit logs");
    res.status(500).json({ error: "Erreur lors de la récupération des logs" });
  }
});

/**
 * POST /api/v1/plugins/register
 * Register a new plugin manifest at runtime.
 */
router.post("/register", requireAuth, async (req, res) => {
  try {
    const record = pluginManager.register(req.body);
    await pluginManager.activateAll();

    const latest = pluginManager.all().find((r) => r.manifest.id === record.manifest.id)!;
    const status = pluginManager.toStatusResponse(latest);

    logger.info({ pluginId: record.manifest.id, userId: req.auth!.userId }, "Plugin registered via API");

    await writeAuditLog({
      pluginId: record.manifest.id,
      pluginName: record.manifest.name,
      action: latest.state === "ACTIVE" ? "REGISTERED" : "ACTIVATION_FAILED",
      actorUserId: req.auth!.userId,
      actorEmail: req.auth!.email,
      metadata: {
        version: record.manifest.version,
        state: latest.state,
        permissions: record.manifest.permissions,
        error: latest.error,
      },
    });

    res.status(201).json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.warn({ err, userId: req.auth!.userId }, "Plugin registration failed");
    res.status(400).json({ error: message });
  }
});

/**
 * POST /api/v1/plugins/:id/disable
 * Disable an active plugin.
 */
router.post("/:id/disable", requireAuth, async (req, res) => {
  const pluginId = req.params.id;
  const record = pluginManager.all().find((r) => r.manifest.id === pluginId);
  try {
    await pluginManager.disable(pluginId);

    await writeAuditLog({
      pluginId,
      pluginName: record?.manifest.name ?? pluginId,
      action: "DISABLED",
      actorUserId: req.auth!.userId,
      actorEmail: req.auth!.email,
      metadata: { version: record?.manifest.version },
    });

    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(400).json({ error: message });
  }
});

/**
 * POST /api/v1/plugins/:id/enable
 * Re-enable a previously disabled plugin.
 */
router.post("/:id/enable", requireAuth, async (req, res) => {
  const pluginId = req.params.id;
  const record = pluginManager.all().find((r) => r.manifest.id === pluginId);
  try {
    await pluginManager.enable(pluginId);

    const after = pluginManager.all().find((r) => r.manifest.id === pluginId);
    const succeeded = after?.state === "ACTIVE";

    await writeAuditLog({
      pluginId,
      pluginName: record?.manifest.name ?? pluginId,
      action: succeeded ? "ENABLED" : "ACTIVATION_FAILED",
      actorUserId: req.auth!.userId,
      actorEmail: req.auth!.email,
      metadata: {
        version: record?.manifest.version,
        state: after?.state,
        error: after?.error,
      },
    });

    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(400).json({ error: message });
  }
});

export default router;
