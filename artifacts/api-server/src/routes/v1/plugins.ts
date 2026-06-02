import { Router, Request, Response } from "express";
import { requireAuth } from "../../middlewares/auth";
import { pluginManager } from "../../lib/plugin-runtime";
import { logger } from "../../lib/logger";
import { writeAuditLog, fetchAuditLogs } from "../../lib/plugin-runtime/audit";
import { savePluginState } from "../../lib/plugin-runtime/persistence";

const router = Router();

// Helper to safely extract user info from request
const getUserInfo = (req: Request) => ({
  userId: req.auth?.userId ?? req.user?.userId ?? "system",
  email: req.auth?.email ?? req.user?.email ?? "system@growthos.io",
});

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
    const { userId, email } = getUserInfo(req);
    const record = pluginManager.register(req.body);
    await pluginManager.activateAll();

    const latest = pluginManager.all().find((r) => r.manifest.id === record.manifest.id)!;
    const status = pluginManager.toStatusResponse(latest);

    logger.info({ pluginId: record.manifest.id, userId }, "Plugin registered via API");

    await writeAuditLog({
      pluginId: record.manifest.id,
      pluginName: record.manifest.name,
      action: latest.state === "ACTIVE" ? "REGISTERED" : "ACTIVATION_FAILED",
      actorUserId: userId,
      actorEmail: email,
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
    logger.warn({ err, userId: getUserInfo(req).userId }, "Plugin registration failed");
    res.status(400).json({ error: message });
  }
});

/**
 * POST /api/v1/plugins/:id/disable
 * Disable an active plugin.
 */
router.post("/:id/disable", requireAuth, async (req, res) => {
  const { id: pluginId } = req.params;
  const { userId, email } = getUserInfo(req);
  const record = pluginManager.all().find((r) => r.manifest.id === pluginId);

  if (!record) {
    return res.status(404).json({ error: `Plugin '${pluginId}' not found` });
  }

  try {
    await pluginManager.disable(pluginId);
    await savePluginState(pluginId, "DISABLED");

    await writeAuditLog({
      pluginId,
      pluginName: record.manifest.name,
      action: "DISABLED",
      actorUserId: userId,
      actorEmail: email,
      metadata: { version: record.manifest.version },
    });

    logger.info({ pluginId, userId }, "Plugin disabled successfully");
    res.json({ ok: true, message: `Plugin ${pluginId} disabled` });
  } catch (err) {
    // 🔍 LOG EXPLICITE POUR DEBUGUER LE 400
    logger.error({ err, pluginId, userId }, "Failed to disable plugin");
    const message = err instanceof Error ? err.message : "Invalid state or dependency conflict";
    res.status(400).json({ error: message });
  }
});

/**
 * POST /api/v1/plugins/:id/enable
 * Re-enable a previously disabled plugin.
 */
router.post("/:id/enable", requireAuth, async (req, res) => {
  const { id: pluginId } = req.params;
  const { userId, email } = getUserInfo(req);
  const record = pluginManager.all().find((r) => r.manifest.id === pluginId);

  if (!record) {
    return res.status(404).json({ error: `Plugin '${pluginId}' not found` });
  }

  try {
    await pluginManager.enable(pluginId);

    const after = pluginManager.all().find((r) => r.manifest.id === pluginId);
    const succeeded = after?.state === "ACTIVE";
    await savePluginState(pluginId, succeeded ? "ACTIVE" : "DISABLED");

    await writeAuditLog({
      pluginId,
      pluginName: record.manifest.name,
      action: succeeded ? "ENABLED" : "ACTIVATION_FAILED",
      actorUserId: userId,
      actorEmail: email,
      metadata: {
        version: record.manifest.version,
        state: after?.state,
        error: after?.error,
      },
    });

    logger.info({ pluginId, userId, succeeded }, "Plugin enable attempt completed");
    res.json({ ok: true, message: succeeded ? `Plugin ${pluginId} enabled` : `Plugin ${pluginId} failed to activate` });
  } catch (err) {
    // 🔍 LOG EXPLICITE POUR DEBUGUER LE 400
    logger.error({ err, pluginId, userId }, "Failed to enable plugin");
    const message = err instanceof Error ? err.message : "Dependency or configuration error";
    res.status(400).json({ error: message });
  }
});

export default router;
