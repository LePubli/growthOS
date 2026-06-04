import { Request, Response, NextFunction } from "express";

function inferAction(method: string, path: string): string {
  if (method === "DELETE") return "DELETE";
  if (method === "POST") {
    if (path.includes("/toggle")) return "TOGGLE_STATUS";
    if (path.includes("/read"))   return "MARK_READ";
    if (path.includes("/events")) return "SEQUENCE_EVENT";
    if (path.includes("/audit"))  return "RUN_AUDIT";
    if (path.includes("/enrich")) return "ENRICH";
    return "CREATE";
  }
  if (method === "PATCH") {
    if (path.includes("/status")) return "UPDATE_STATUS";
    if (path.includes("/stage"))  return "UPDATE_STAGE";
    return "UPDATE";
  }
  if (method === "PUT") return "REPLACE";
  return "MUTATE";
}

function inferImpact(body: unknown): string {
  if (body === null || body === undefined) return "0 rows affected";
  if (Array.isArray(body)) return `${body.length} rows`;
  if (typeof body === "object") {
    const b = body as Record<string, unknown>;
    if ("ok" in b) return b.ok ? "1 row affected" : "0 rows affected";
    if ("id" in b) return "1 row updated/inserted";
    if ("generated" in b) return `${b.generated} rows inserted`;
    if ("count" in b) return `${b.count} rows`;
  }
  return "1 row affected";
}

function truncate(s: string, max = 160): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

export function actionLogger(req: Request, res: Response, next: NextFunction): void {
  const method = req.method;
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    next();
    return;
  }

  const origJson = res.json.bind(res);
  (res as any).json = function (body: unknown) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const action  = inferAction(method, req.path);
      const user    = (req as any).auth?.email ?? "anonymous";
      const impact  = inferImpact(body);
      const payload = truncate(JSON.stringify(req.body ?? {}));
      const routeKey = `${method} ${req.baseUrl}${req.path}`;
      console.log(
        `[ACTION SUCCESS] Route: ${routeKey} | Action: ${action} | User: ${user} | DB Impact: ${impact} | Payload: ${payload}`,
      );
    }
    return origJson(body);
  };

  next();
}
