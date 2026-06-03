import type { Express } from "express";

export interface RouteEntry {
  method: string;
  path: string;
  auth: boolean;
}

/** Extract the path prefix stored in a compiled Express regexp layer */
function layerPath(layer: any): string {
  if (layer.path !== undefined) return layer.path as string;
  // Decode the regexp back to a path string
  const src: string = (layer.regexp?.source ?? "").replace(/\\\//g, "/");
  // Fast-path: plain prefix like ^\/foo\/?(?=\/|$) → /foo
  const m = src.match(/^\^\\?\/([^?$(\\]+)/);
  if (m) return "/" + m[1].replace(/\\/g, "");
  // Empty / root
  if (/^\^\\?\/\?(\(\?=|$)/.test(src) || src === "^/?(?=/|$)") return "";
  return "";
}

function walkStack(
  stack: any[],
  prefix: string,
  auth: boolean,
  out: RouteEntry[],
): void {
  for (const layer of stack) {
    const seg = layerPath(layer);
    const fullPath = prefix + seg;

    if (layer.route) {
      // Leaf route — emit one entry per method
      const methods: string[] = Object.keys(layer.route.methods ?? {}).filter(
        (m) => m !== "_all",
      );
      for (const method of methods) {
        out.push({
          method: method.toUpperCase(),
          path: fullPath + (layer.route.path || ""),
          auth,
        });
      }
    } else if (layer.name === "router" || layer.handle?.stack) {
      // Detect requireAuth anywhere in this layer's handle stack
      const innerAuth =
        auth ||
        (Array.isArray(layer.handle?.stack) &&
          layer.handle.stack.some(
            (l: any) => l.handle?.name === "requireAuth",
          )) ||
        layer.handle?.name === "requireAuth";
      walkStack(
        layer.handle?.stack ?? layer.stack ?? [],
        fullPath,
        innerAuth,
        out,
      );
    } else if (layer.handle?.name === "requireAuth") {
      // Inline requireAuth middleware — flag parent prefix
      // (handled by parent; nothing to emit)
    }
  }
}

export function listRoutes(app: Express): RouteEntry[] {
  const out: RouteEntry[] = [];
  const rootStack: any[] = (app as any)._router?.stack ?? [];
  walkStack(rootStack, "", false, out);
  // Deduplicate (same method+path can appear twice in dev)
  const seen = new Set<string>();
  return out.filter((r) => {
    const k = `${r.method}:${r.path}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
