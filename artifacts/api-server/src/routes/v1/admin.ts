import { Router, type Request, type Response } from "express";
import { requireAuth } from "../../middlewares/auth";
import { listRoutes } from "../../lib/list-routes";

const router = Router();

/**
 * GET /api/v1/admin/route-audit
 * Returns all registered routes with method, path, and auth flag.
 * Protected: requires valid JWT.
 */
router.get("/route-audit", requireAuth, (req: Request, res: Response) => {
  // Access the root Express app via req.app
  const routes = listRoutes(req.app as any);

  const byMethod: Record<string, number> = {};
  for (const r of routes) {
    byMethod[r.method] = (byMethod[r.method] ?? 0) + 1;
  }

  res.json({
    total: routes.length,
    byMethod,
    authRequired: routes.filter((r) => r.auth).length,
    public: routes.filter((r) => !r.auth).length,
    routes,
    generatedAt: new Date().toISOString(),
  });
});

export default router;
