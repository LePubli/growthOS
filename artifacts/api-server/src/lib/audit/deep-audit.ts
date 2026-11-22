import type { Application } from "express";
import { pool } from "@workspace/db";
import { pluginManager } from "../plugin-runtime";
import { listRoutes } from "../list-routes";
import { logger } from "../logger";
import { signAccessToken, type AuthPayload } from "../../middlewares/auth";

export interface RouteAuditResult {
  plugin: string;
  method: string;
  route: string;
  status: number;
  latencyMs: number;
  error?: string;
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
  healthScore: number;
  backend: {
    routesDiscovered: number;
    routesTested: number;
    routesSkipped: number;
    routesOk: number;
    routes4xx: number;
    routes5xx: number;
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
] as const;

async function auditRoutes(
  app: Application,
  baseUrl: string,
  token: string,
  onProgress?: (completed: number, total: number) => void,
): Promise<{ results: RouteAuditResult[]; discovered: number; skipped: number }> {
  const discovered = listRoutes(app).filter(r => r.method === "GET" && r.path.startsWith("/api/v1/"));
  const paths = new Set<string>(SAFE_READ_PATHS);
  const skipped = discovered.filter(r => !paths.has(r.path)).length;

  // A deep audit is a background job. Still limit both the request rate and
  // the per-route wait so the audit cannot monopolise a small VPS.
  const routes = SAFE_READ_PATHS;
  const results: RouteAuditResult[] = new Array(routes.length);
  let next = 0;
  let completed = 0;
  onProgress?.(0, routes.length);
  async function worker(): Promise<void> {
    while (next < routes.length) {
      const index = next++;
      const path = routes[index];
      if (!path) continue;
      const start = Date.now();
      let status = 0;
      let error: string | undefined;
      try {
        const res = await fetch(`${baseUrl}${path}`, {
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
        auth: path !== "/api/v1/setup/status",
      };
      onProgress?.(++completed, routes.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(2, routes.length) }, () => worker()));
  return { results, discovered: discovered.length, skipped };
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

  const [routeAudit, dbResults] = await Promise.all([
    auditRoutes(app, `http://localhost:${port}`, token, onProgress).catch(err => {
      logger.error({ err }, "Route audit failed");
      throw err;
    }),
    auditDatabase(),
  ]);
  const routeResults = routeAudit.results;

  const routesOk    = routeResults.filter(r => r.status >= 200 && r.status < 400).length;
  const routes4xx   = routeResults.filter(r => r.status >= 400 && r.status < 500).length;
  const routes5xx   = routeResults.filter(r => r.status >= 500 || r.status === 0).length;
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

  // Score of *checked* operations; do not count unprobed endpoints as passed.
  // Plugin readiness is an activation check, not a functional plugin test.
  const routeScore  = routeResults.length > 0 ? (routesOk / routeResults.length) * 60 : 0;
  const dbScore     = KNOWN_TABLES.length > 0 ? (tablesOk / KNOWN_TABLES.length) * 30 : 30;
  const pluginScore = allPlugins.length > 0
    ? (allPlugins.filter(r => r.state === "ACTIVE").length / allPlugins.length) * 10 : 0;

  return {
    timestamp: new Date().toISOString(),
    healthScore: Math.round(routeScore + dbScore + pluginScore),
    backend: {
      routesDiscovered: routeAudit.discovered, routesTested: routeResults.length,
      routesSkipped: routeAudit.skipped, routesOk, routes4xx, routes5xx, avgLatencyMs,
      brokenRoutes: routeResults.filter(r => r.status >= 500 || r.status === 0),
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
