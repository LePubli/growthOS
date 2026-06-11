import { Router } from "express";
import { requireAuth } from "../../middlewares/auth";

const router = Router();

interface RouteEntry {
  method: string;
  path: string;
  auth: boolean;
}

function hasAuthMiddleware(layerStack: any[]): boolean {
  return layerStack.some((l: any) => {
    const name = l.name ?? l.handle?.name ?? "";
    return name === "requireAuth" || name === "bound requireAuth";
  });
}

function extractFromStack(stack: any[], prefix = "", parentAuth = false): RouteEntry[] {
  const results: RouteEntry[] = [];

  for (const layer of stack ?? []) {
    if (!layer) continue;

    // Concrete route leaf
    if (layer.route) {
      const routePath: string = layer.route.path ?? "";
      const fullPath = (prefix + routePath).replace(/\/+/g, "/") || "/";
      const methods: string[] = Object.keys(layer.route.methods ?? {}).filter(
        (m) => layer.route.methods[m] && m !== "_all",
      );
      const routeAuth = parentAuth || hasAuthMiddleware(layer.route.stack ?? []);
      for (const method of methods) {
        results.push({ method: method.toUpperCase(), path: fullPath, auth: routeAuth });
      }
      continue;
    }

    // Router middleware (sub-router)
    if (layer.handle?.stack) {
      let subPrefix = prefix;
      // Extract path segment from regexp if available
      if (layer.regexp?.source) {
        const m = layer.regexp.source.match(/^\^\\\/([^\\?*]+)/);
        if (m) {
          subPrefix = (prefix + "/" + m[1].replace(/\\\//g, "/")).replace(/\/+/g, "/");
        }
      }
      const subAuth = parentAuth || hasAuthMiddleware([layer]);
      results.push(...extractFromStack(layer.handle.stack, subPrefix, subAuth));
    }
  }

  return results;
}

/**
 * GET /api/v1/route-audit/scan
 * Parcourt le router Express et retourne toutes les routes /api/v1/* enregistrées.
 * Bug #4 fix: filtre pour ne retourner QUE les routes avec le préfixe /api/v1/
 */
router.get("/scan", requireAuth, (req, res) => {
  try {
    const app = req.app as any;
    const rootStack: any[] =
      app._router?.stack ??
      app.router?.stack ??
      [];

    const routes = extractFromStack(rootStack);

    // Bug #4 fix: ne garder que les routes sous /api/v1/ — écarter les routes
    // internes Express (*, /favicon.ico, etc.) et les chemins relatifs orphelins
    const API_PREFIX = "/api/v1";
    const apiRoutes = routes
      .filter((r) => {
        // Garder les routes qui contiennent un chemin non-trivial
        const p = r.path;
        if (!p || p === "/") return false;
        // Exclure les routes qui ne ressemblent pas à des routes API
        if (p.startsWith("/*") || p === "*") return false;
        return true;
      })
      .map((r) => ({
        ...r,
        // Normaliser le préfixe : si le chemin ne commence pas par /api, ajouter /api/v1
        path: r.path.startsWith("/api") ? r.path : `${API_PREFIX}${r.path.startsWith("/") ? r.path : `/${r.path}`}`,
      }));

    // De-duplicate (same method+path can appear multiple times due to nested routers)
    const seen = new Set<string>();
    const unique = apiRoutes.filter((r) => {
      const key = `${r.method}:${r.path}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    unique.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

    const byMethod: Record<string, number> = {};
    for (const r of unique) {
      byMethod[r.method] = (byMethod[r.method] ?? 0) + 1;
    }

    res.json({
      total: unique.length,
      byMethod,
      authRequired: unique.filter((r) => r.auth).length,
      public: unique.filter((r) => !r.auth).length,
      routes: unique,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: msg });
  }
});

export default router;
