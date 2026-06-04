import { Router, Request, Response } from "express";
import multer from "multer";
import { requireAuth } from "../../middlewares/auth";
import { pluginUploaderService } from "../../lib/plugin-uploader/PluginUploaderService";
import { logger } from "../../lib/logger";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

function getUserInfo(req: Request): { userId?: string; email?: string } {
  const user = (req as any).user;
  return { userId: user?.userId, email: user?.email };
}

/**
 * GET /api/v1/plugin-marketplace
 * List all uploaded plugins.
 */
router.get("/", requireAuth, async (_req, res) => {
  try {
    const plugins = await pluginUploaderService.listPlugins();
    res.json({ plugins, count: plugins.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({ err }, "Failed to list plugins");
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/v1/plugin-marketplace/format-doc
 * Returns the expected ZIP structure and manifest schema documentation.
 */
router.get("/format-doc", requireAuth, (_req, res) => {
  res.json({
    description: "How to create an uploadable GrowthOS plugin",
    zipStructure: [
      "my-plugin.zip",
      "  └── manifest.json   (required — plugin metadata)",
      "  └── README.md       (optional — documentation)",
      "  └── server/         (optional — backend routes)",
      "  │   └── index.js    (must export: (router) => void)",
      "  └── client/         (optional — frontend assets)",
    ],
    manifestSchema: {
      id: "string — lowercase-alphanumeric with hyphens, e.g. 'my-plugin'",
      name: "string — display name, max 128 chars",
      version: "string — semver, e.g. '1.0.0'",
      description: "string (optional) — short description",
      author: "string (optional) — author name",
      permissions: "string[] — from the allowed list below",
      dependencies: "string[] — IDs of required plugins",
      routes: "{ path: string, label: string, icon?: string }[] — UI routes to inject in sidebar",
      extends: "string (optional) — slug of plugin to extend",
      uiSlots: "string[] (optional) — UI slot IDs to fill",
    },
    allowedPermissions: [
      "prospects:read","prospects:write","pipeline:read","pipeline:write",
      "sequences:read","sequences:write","signals:read","signals:write",
      "analytics:read","workflows:read","workflows:write","webhooks:send",
      "email:send","contacts:read","contacts:write","memory:read","memory:write",
      "meetings:read","meetings:write","accounts:read","accounts:write",
      "ai:generate","emails:write","deals:read","ai:analyze",
    ],
    example: pluginUploaderService.helloWorldExample(),
  });
});

/**
 * POST /api/v1/plugin-marketplace/upload
 * Upload a plugin ZIP. Field name: "file", query/body: slug.
 */
router.post("/upload", requireAuth, upload.single("file"), async (req, res) => {
  const { userId, email } = getUserInfo(req);
  const slug = (req.body?.slug ?? req.query["slug"] ?? "") as string;

  if (!req.file) return res.status(400).json({ error: "No file uploaded (field: 'file')" });
  if (!slug) return res.status(400).json({ error: "slug is required (body or query param)" });

  try {
    const result = await pluginUploaderService.uploadPlugin(req.file.buffer, slug);
    logger.info({ slug, userId, email }, "Plugin uploaded via API");
    res.status(201).json({ message: "Plugin uploaded successfully", slug, manifest: result.manifest, filesPath: result.filesPath });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({ err, slug, userId }, "Plugin upload failed");
    res.status(400).json({ error: message });
  }
});

/**
 * POST /api/v1/plugin-marketplace/install/:slug
 */
router.post("/install/:slug", requireAuth, async (req, res) => {
  const { slug } = req.params;
  const { userId, email } = getUserInfo(req);
  try {
    await pluginUploaderService.installPlugin(slug);
    logger.info({ slug, userId, email }, "Plugin installed via API");
    res.json({ message: `Plugin "${slug}" installed`, slug });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(400).json({ error: message });
  }
});

/**
 * POST /api/v1/plugin-marketplace/activate/:slug
 */
router.post("/activate/:slug", requireAuth, async (req, res) => {
  const { slug } = req.params;
  const { userId, email } = getUserInfo(req);
  try {
    await pluginUploaderService.activatePlugin(slug);
    logger.info({ slug, userId, email }, "Plugin activated via API");
    res.json({ message: `Plugin "${slug}" activated`, slug });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(400).json({ error: message });
  }
});

/**
 * POST /api/v1/plugin-marketplace/deactivate/:slug
 */
router.post("/deactivate/:slug", requireAuth, async (req, res) => {
  const { slug } = req.params;
  const { userId, email } = getUserInfo(req);
  try {
    await pluginUploaderService.deactivatePlugin(slug);
    logger.info({ slug, userId, email }, "Plugin deactivated via API");
    res.json({ message: `Plugin "${slug}" deactivated`, slug });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(400).json({ error: message });
  }
});

/**
 * DELETE /api/v1/plugin-marketplace/:slug
 */
router.delete("/:slug", requireAuth, async (req, res) => {
  const { slug } = req.params;
  const { userId, email } = getUserInfo(req);
  try {
    await pluginUploaderService.deletePlugin(slug);
    logger.info({ slug, userId, email }, "Plugin deleted via API");
    res.json({ message: `Plugin "${slug}" deleted`, slug });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(400).json({ error: message });
  }
});

export default router;
