import { Request, Response, NextFunction } from "express";
import { ProductAnalytics } from "../lib/analytics/ProductAnalytics";

const TRACKED_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const IGNORED_PATHS = ["/analytics", "/notifications", "/audit", "/auth/refresh", "/webhook"];

/**
 * Middleware : track automatiquement les appels API mutants vers analytics_events.
 * N'est appliqué que sur les routes derrière requireAuth (tenantId requis).
 */
export function analyticsTracker(req: Request, _res: Response, next: NextFunction): void {
  const tenantId = req.auth?.tenantId;
  const userId = req.auth?.userId;
  if (!tenantId || !TRACKED_METHODS.has(req.method)) { next(); return; }

  const path = req.path;
  if (IGNORED_PATHS.some((p) => path.startsWith(p))) { next(); return; }

  // Fire-and-forget — ne bloque pas la requête
  const segments = path.split("/").filter(Boolean);
  const entity = segments[0] ?? "unknown";
  const action =
    req.method === "POST" ? "created" :
    req.method === "PUT" || req.method === "PATCH" ? "updated" :
    req.method === "DELETE" ? "deleted" : "action";

  const eventName = `${entity}.${action}`;
  ProductAnalytics.trackEvent(tenantId, userId ?? null, eventName, {
    method: req.method,
    path,
  }).catch(() => undefined);

  next();
}
