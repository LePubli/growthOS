import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middlewares/auth";
import { pluginManager } from "../../lib/plugin-runtime";
import { PluginManifest } from "../../lib/plugin-runtime/types";
import { logger } from "../../lib/logger";

const router = Router();

/**
 * GET /api/v1/plugins/status
 * Returns all registered plugins with their lifecycle state.
 * Public fields are safe to expose to authenticated users.
 */
router.get("/status", requireAuth, (_req, res) => {
  const all = pluginManager.all().map((r) => pluginManager.toStatusResponse(r));
  res.json({ plugins: all, total: all.length });
});

/**
 * GET /api/v1/plugins/active
 * Returns only ACTIVE plugins — used by the frontend SDK to know
 * which slots and routes to inject.
 */
router.get("/active", requireAuth, (_req, res) => {
  const active = pluginManager
    .active()
    .map((r) => pluginManager.toStatusResponse(r));
  res.json({ plugins: active, total: active.length });
});

/**
 * POST /api/v1/plugins/register
 * Register a new plugin manifest at runtime (admin use / dev tooling).
 * Validates the manifest with Zod before accepting it.
 */
router.post("/register", requireAuth, async (req, res) => {
  try {
    const record = pluginManager.register(req.body);
    await pluginManager.activateAll();
    logger.info(
      { pluginId: record.manifest.id, userId: req.auth!.userId },
      "Plugin registered via API",
    );
    res.status(201).json(pluginManager.toStatusResponse(pluginManager.all().find((r) => r.manifest.id === record.manifest.id)!));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.warn({ err, userId: req.auth!.userId }, "Plugin registration failed");
    res.status(400).json({ error: message });
  }
});

/**
 * POST /api/v1/plugins/:id/disable
 * Disable an active plugin. Fails if other plugins depend on it.
 */
router.post("/:id/disable", requireAuth, async (req, res) => {
  try {
    await pluginManager.disable(req.params.id);
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
  try {
    await pluginManager.enable(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(400).json({ error: message });
  }
});

export default router;
