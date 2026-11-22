import type { Application } from "express";

export interface RouteEntry {
  method: string;
  path: string;
  auth: boolean;
}

// Express 5 keeps mounted router paths in matcher closures. Reconstructing
// them from layer.regexp silently drops prefixes and merges unrelated routes.
// Instead, capture each mount's actual path at registration time.
const mountedRoutes = new Map<string, RouteEntry>();

function normalize(path: string): string {
  const result = path.replace(/\/+/g, "/");
  return result.length > 1 ? result.replace(/\/$/, "") : result;
}

function visitRouter(stack: any[], prefix: string, inheritedAuth: boolean): void {
  let activeAuth = inheritedAuth;
  for (const layer of stack) {
    if (layer.handle?.name === "requireAuth") {
      // A router.use(requireAuth) protects routes registered after the mount.
      activeAuth = true;
    }
    if (layer.route) {
      const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
      for (const path of paths) {
        if (typeof path !== "string") continue;
        const fullPath = normalize(`${prefix}/${path}`);
        const auth = activeAuth || (layer.route.stack ?? []).some(
          (item: any) => item.handle?.name === "requireAuth",
        );
        for (const [method, enabled] of Object.entries(layer.route.methods ?? {})) {
          if (!enabled || method === "_all") continue;
          const entry: RouteEntry = { method: method.toUpperCase(), path: fullPath, auth };
          const key = `${entry.method}:${entry.path}`;
          const existing = mountedRoutes.get(key);
          mountedRoutes.set(key, { ...entry, auth: entry.auth || Boolean(existing?.auth) });
        }
      }
    } else if (layer.handle?.stack) {
      visitRouter(layer.handle.stack, prefix, activeAuth);
    }
  }
}

export function registerV1Mount(path: string, handlers: unknown[]): void {
  const target = handlers[handlers.length - 1] as { stack?: any[] } | undefined;
  if (!Array.isArray(target?.stack)) return;
  const auth = handlers.some((handler: any) => handler?.name === "requireAuth");
  visitRouter(target.stack, `/api/v1${path}`, auth);
}

export function listRoutes(_app: Application): RouteEntry[] {
  return [...mountedRoutes.values()].sort(
    (a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method),
  );
}
