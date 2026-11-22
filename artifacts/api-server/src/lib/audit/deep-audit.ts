import type { Application } from "express";
import { pool } from "@workspace/db";
import { pluginManager } from "../plugin-runtime";
import { listRoutes, type RouteEntry } from "../list-routes";
import { logger } from "../logger";
import { signAccessToken, type AuthPayload } from "../../middlewares/auth";

export interface RouteAuditResult {
  plugin: string;
  method: string;
  route: string;
  status: number;
  latencyMs: number;
  error?: string;
  passed: boolean;
  auth: boolean;
}

export interface TableAuditResult {
  table: string;
  exists: boolean;
  rowCount: number | null;
  error?: string;
}

export interface DeepAuditReport {
  timestamp: string;
  // No full-system score unless every registered route is functionally tested.
  // A few successful GETs must never be presented as 100% platform health.
  healthScore: number | null;
  assessment: "partial" | "complete";
  backend: {
    routesDiscovered: number;
    routesTested: number;
    routesSkipped: number;
    coveragePct: number;
    routesByMethod: Record<string, number>;
    untestedRoutes: { method: string; route: string; reason: string }[];
    moduleCoverage: { module: string; total: number; tested: number; errors: number }[];
    routesOk: number;
    routes4xx: number;
    routes5xx: number;
    contractErrors: number;
    avgLatencyMs: number;
    brokenRoutes: RouteAuditResult[];
    allRoutes: RouteAuditResult[];
  };
  database: {
    tablesOk: number;
    tablesMissing: string[];
    tables: TableAuditResult[];
    totalRows: number;
  };
  plugins: {
    active: number;
    disabled: number;
    error: number;
    uploaded: number;
    list: { id: string; name: string; state: string; error?: string }[];
  };
  durationMs: number;
}

const KNOWN_TABLES = [
  "tenants","users","prospects","deals","sequences","signals",
  "activities","workflows","templates","webhooks","plugin_audit_logs",
  "plugin_states","memory_documents","meetings","account_metrics",
  "knowledge_articles","sourcing_jobs","notifications","uploaded_plugins",
];

// Explicitly audited, read-only, local endpoints. Scanning every GET route is
// unsafe: some endpoints stream indefinitely or trigger external services;
// fake resource IDs also generate misleading 404/500 results.
const SAFE_READ_PATHS = [
  "/api/v1/setup/status",
  "/api/v1/setup/configuration",
  "/api/v1/prospects",
  "/api/v1/prospects/map",
  "/api/v1/dashboard/stats",
  "/api/v1/pipeline",
  "/api/v1/sequences",
  "/api/v1/signals",
  "/api/v1/activities",
  "/api/v1/workflows",
  "/api/v1/templates",
  "/api/v1/accounts",
  "/api/v1/meetings",
  "/api/v1/notifications",
  "/api/v1/team",
  "/api/v1/users/me",
  "/api/v1/sourcing/jobs",
  "/api/v1/plugins/status",
  "/api/v1/plugins/active",
  "/api/v1/plugins/marketplace",
  "/api/v1/plugins/audit",
  "/api/v1/tasks",
  "/api/v1/autopilot/rules",
  "/api/v1/autopilot/logs",
  "/api/v1/autopilot/meta",
  "/api/v1/memory/stats",
  "/api/v1/memory/recent",
  "/api/v1/knowledge/stats",
  "/api/v1/revenue/kpis",
  "/api/v1/revenue/funnel",
  "/api/v1/revenue/forecast",
  "/api/v1/revenue/trends",
  "/api/v1/deal-coach/pipeline/health",
  "/api/v1/deal-coach/risks",
  "/api/v1/ai-sdr/provider-settings",
  "/api/v1/ai-sdr/templates",
  "/api/v1/ereputation/score-global",
  "/api/v1/analytics/stats",
  "/api/v1/analytics/overview",
  "/api/v1/compliance/data-retention",
  "/api/v1/billing/subscription",
  "/api/v1/billing/usage",
  "/api/v1/sso/providers",
] as const;

// Validate the response structure of a few essential modules rather than
// calling HTTP 200 "functional" without reading the response. The prospect
// list is limited to one record for predictable memory / network usage.
function contractError(path: string, data: unknown): string | undefined {
  const object = data && typeof data === "object" ? data as Record<string, unknown> : {};
  switch (path) {
    case "/api/v1/setup/status":
      return typeof object.needsBootstrap === "boolean" ? undefined : "Contrat invalide : needsBootstrap absent";
    case "/api/v1/prospects":
      return Array.isArray(object.data) && typeof object.total === "number"
        ? undefined : "Contrat CRM invalide : data[] / total attendus";
    case "/api/v1/dashboard/stats":
      return typeof (object.overview as Record<string, unknown> | undefined)?.total_prospects === "number"
        ? undefined : "Contrat dashboard invalide : overview.total_prospects attendu";
    case "/api/v1/plugins/status":
      return Array.isArray(object.plugins) && typeof object.total === "number"
        ? undefined : "Contrat plugins invalide : plugins[] / total attendus";
    default:
      return undefined;
  }
}

const CONTRACT_PATHS = new Set([
  "/api/v1/setup/status", "/api/v1/prospects",
  "/api/v1/dashboard/stats", "/api/v1/plugins/status",
]);

function untestedReason(route: RouteEntry): string {
  if (route.method !== "GET") return "Écriture / action : nécessite un environnement de test isolé";
  if (/\/(stream|events)(?:\/|$)/.test(route.path)) return "Flux continu : ne peut pas être interrogé comme une lecture ordinaire";
  if (route.path.includes(":")) return "Identifiant métier réel requis pour un test fiable";
  if (/\/(pdf|csv|export)(?:\/|$)/.test(route.path)) return "Export : vérification dédiée nécessaire";
  return "Lecture non qualifiée : effets de bord / dépendances à vérifier avant exécution";
}

async function auditRoutes(
  app: Application,
  baseUrl: string,
  token: string,
  onProgress?: (completed: number, total: number) => void,
): Promise<{
  results: RouteAuditResult[];
  discovered: number;
  skipped: number;
  coveragePct: number;
  routesByMethod: Record<string, number>;
  untestedRoutes: { method: string; route: string; reason: string }[];
  moduleCoverage: { module: string; total: number; tested: number; errors: number }[];
}> {
  const discovered = listRoutes(app).filter(r => r.path.startsWith("/api/v1/"));
  const allowed = new Set<string>(SAFE_READ_PATHS);
  const routes = discovered.filter(r => r.method === "GET" && allowed.has(r.path));
  const testedKeys = new Set(routes.map(r => `GET:${r.path}`));
  const untestedRoutes = discovered
    .filter(r => !testedKeys.has(`${r.method}:${r.path}`))
    .map(r => ({ method: r.method, route: r.path, reason: untestedReason(r) }));
  const routesByMethod: Record<string, number> = {};
  for (const route of discovered) routesByMethod[route.method] = (routesByMethod[route.method] ?? 0) + 1;

  // A deep audit is a background job. Still limit both the request rate and
  // the per-route wait so the audit cannot monopolise a small VPS.
  const results: RouteAuditResult[] = new Array(routes.length);
  let next = 0;
  let completed = 0;
  onProgress?.(0, routes.length);
  async function worker(): Promise<void> {
    while (next < routes.length) {
      const index = next++;
      const entry = routes[index];
      if (!entry) continue;
      const path = entry.path;
      const start = Date.now();
      let status = 0;
      let error: string | undefined;
      try {
        const query = path === "/api/v1/prospects" ? "?limit=1" : "";
        const res = await fetch(`${baseUrl}${path}${query}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          signal: AbortSignal.timeout(3000),
        });
        status = res.status;
        if (status >= 500) {
          try {
            const b = await res.json() as any;
            error = b?.error ?? b?.message ?? `HTTP ${status}`;
          } catch { error = `HTTP ${status}`; }
        } else if (status >= 200 && status < 400 && CONTRACT_PATHS.has(path)) {
          if (!(res.headers.get("content-type") ?? "").includes("application/json")) {
            error = "Contrat invalide : réponse JSON attendue";
            await res.body?.cancel();
          } else {
            const data = await res.json() as unknown;
            error = contractError(path, data);
          }
        } else {
          // Do not buffer arbitrary endpoint responses just for a status check.
          await res.body?.cancel();
        }
      } catch (err) {
        status = 0;
        error = err instanceof Error ? err.message : "Network error";
      }
      results[index] = {
        plugin: path.split("/")[3] ?? "core",
        method: "GET",
        route: path,
        status,
        latencyMs: Date.now() - start,
        error,
        passed: status >= 200 && status < 400 && !error,
        auth: entry.auth,
      };
      onProgress?.(++completed, routes.length);
    }
  }
  // Sequential probes avoid concurrent reads against lightweight test backends
  // and keep CPU/DB pressure minimal on the shared production VPS.
  await worker();
  const byModule = new Map<string, { module: string; total: number; tested: number; errors: number }>();
  const statusByPath = new Map(results.map(r => [r.route, r.status]));
  for (const route of discovered) {
    const module = route.path.split("/")[3] ?? "core";
    const stat = byModule.get(module) ?? { module, total: 0, tested: 0, errors: 0 };
    stat.total++;
    if (testedKeys.has(`${route.method}:${route.path}`)) {
      stat.tested++;
      const status = statusByPath.get(route.path) ?? 0;
      if (status === 0 || status >= 400 || results.some(r => r.route === route.path && !r.passed)) stat.errors++;
    }
    byModule.set(module, stat);
  }
  return {
    results,
    discovered: discovered.length,
    skipped: untestedRoutes.length,
    coveragePct: discovered.length > 0 ? Math.round((results.length / discovered.length) * 1000) / 10 : 0,
    routesByMethod,
    untestedRoutes,
    moduleCoverage: [...byModule.values()].sort((a, b) => a.module.localeCompare(b.module)),
  };
}

async function auditDatabase(): Promise<TableAuditResult[]> {
  const results: TableAuditResult[] = [];
  for (const table of KNOWN_TABLES) {
    try {
      const r = await pool.query(`SELECT COUNT(*)::int AS cnt FROM ${table}`);
      results.push({ table, exists: true, rowCount: r.rows[0]?.cnt ?? 0 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      results.push({
        table,
        // A table that cannot be queried is not a passing database check,
        // even if it exists physically (permissions/schema/connection errors).
        exists: false,
        rowCount: null,
        error: msg || "Table query failed",
      });
    }
  }
  return results;
}

export async function runDeepAudit(
  app: Application,
  port: number,
  admin: AuthPayload,
  onProgress?: (completed: number, total: number) => void,
): Promise<DeepAuditReport> {
  const start = Date.now();
  // The caller is already authenticated and platform-admin allowlisted.
  // Use their real tenant context, not a fabricated non-UUID tenant ID.
  const { userId, tenantId, email, role } = admin;
  const token = signAccessToken({ userId, tenantId, email, role });

  // Do not compete with our own DB probes: this is a diagnostic, not a load test.
  const dbResults = await auditDatabase();
  const routeAudit = await auditRoutes(app, `http://localhost:${port}`, token, onProgress);
  const routeResults = routeAudit.results;

  const routesOk    = routeResults.filter(r => r.passed).length;
  const routes4xx   = routeResults.filter(r => r.status >= 400 && r.status < 500).length;
  const routes5xx   = routeResults.filter(r => r.status >= 500 || r.status === 0).length;
  const contractErrors = routeResults.filter(r => r.status >= 200 && r.status < 400 && !r.passed).length;
  const avgLatencyMs = routeResults.length > 0
    ? Math.round(routeResults.reduce((s, r) => s + r.latencyMs, 0) / routeResults.length) : 0;

  const tablesOk     = dbResults.filter(t => t.exists).length;
  const tablesMissing = dbResults.filter(t => !t.exists).map(t => t.table);
  const totalRows    = dbResults.reduce((s, t) => s + (t.rowCount ?? 0), 0);

  const allPlugins = pluginManager.all();
  let uploadedCount = 0;
  try {
    const r = await pool.query(`SELECT COUNT(*)::int AS cnt FROM uploaded_plugins`);
    uploadedCount = r.rows[0]?.cnt ?? 0;
  } catch {}

  return {
    timestamp: new Date().toISOString(),
    // Even 100% passing GETs would not validate writes, workers, mail delivery
    // or paid external integrations. Only full functional E2E tests can issue
    // a platform-wide score; this diagnostic intentionally cannot.
    healthScore: null,
    assessment: "partial",
    backend: {
      routesDiscovered: routeAudit.discovered, routesTested: routeResults.length,
      routesSkipped: routeAudit.skipped, coveragePct: routeAudit.coveragePct,
      routesByMethod: routeAudit.routesByMethod, untestedRoutes: routeAudit.untestedRoutes,
      moduleCoverage: routeAudit.moduleCoverage,
      routesOk, routes4xx, routes5xx, contractErrors, avgLatencyMs,
      brokenRoutes: routeResults.filter(r => !r.passed),
      allRoutes: routeResults,
    },
    database: { tablesOk, tablesMissing, tables: dbResults, totalRows },
    plugins: {
      active:   allPlugins.filter(r => r.state === "ACTIVE").length,
      disabled: allPlugins.filter(r => r.state === "DISABLED").length,
      error:    allPlugins.filter(r => r.state === "ERROR").length,
      uploaded: uploadedCount,
      list: allPlugins.map(r => ({ id: r.manifest.id, name: r.manifest.name, state: r.state, error: r.error })),
    },
    durationMs: Date.now() - start,
  };
}

export async function runAutoFix(): Promise<{ fixed: string[]; failed: string[] }> {
  const fixed: string[] = [];
  const failed: string[] = [];

  try {
    const { runMigrations, runSourcingMigration, runNotificationsMigration } = await import("@workspace/db");
    await runMigrations();
    await Promise.all([runSourcingMigration(), runNotificationsMigration()]);
    fixed.push("DB migrations re-applied (all tables idempotent)");
  } catch (err) { failed.push(`DB migrations: ${err instanceof Error ? err.message : "Unknown"}`); }

  for (const p of pluginManager.all().filter(r => r.state === "ERROR")) {
    try {
      pluginManager.register(p.manifest);
      await pluginManager.enable(p.manifest.id);
      fixed.push(`Re-enabled plugin: ${p.manifest.id}`);
    } catch (err) {
      failed.push(`Plugin ${p.manifest.id}: ${err instanceof Error ? err.message : "Unknown"}`);
    }
  }

  try {
    const allIds = pluginManager.all().map(r => r.manifest.id);
    if (allIds.length > 0) {
      const ph = allIds.map((_, i) => `$${i + 1}`).join(",");
      const res = await pool.query(
        `DELETE FROM plugin_audit_logs WHERE plugin_id NOT LIKE 'pack:%' AND plugin_id NOT IN (${ph}) RETURNING id`,
        allIds,
      );
      if (res.rowCount && res.rowCount > 0) fixed.push(`Cleaned ${res.rowCount} orphaned audit log entries`);
    }
  } catch (err) { failed.push(`Audit log cleanup: ${err instanceof Error ? err.message : "Unknown"}`); }

  return { fixed, failed };
}
