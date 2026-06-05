import type { Express } from "express";
import jwt from "jsonwebtoken";
import { pool } from "@workspace/db";
import { pluginManager } from "../plugin-runtime";
import { listRoutes } from "../list-routes";
import { logger } from "../logger";

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
    routesTested: number;
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

function makeTestToken(): string {
  const secret = process.env["JWT_SECRET"];
  if (!secret) throw new Error("JWT_SECRET not set");
  return jwt.sign(
    { userId: "audit-bot", email: "audit@growthos.internal", role: "admin", tenantId: "audit" },
    secret,
    { expiresIn: "5m" },
  );
}

async function fetchSampleIds(): Promise<Record<string, string>> {
  const mapping: Array<[string, string]> = [
    ["prospects",         "prospectId"],
    ["deals",             "dealId"],
    ["signals",           "signalId"],
    ["sequences",         "sequenceId"],
    ["activities",        "activityId"],
    ["knowledge_articles","articleId"],
    ["meetings",          "meetingId"],
    ["workflows",         "workflowId"],
    ["templates",         "templateId"],
    ["memory_documents",  "docId"],
    ["webhooks",          "webhookId"],
  ];
  const result: Record<string, string> = {};
  await Promise.all(mapping.map(async ([table, key]) => {
    try {
      const r = await pool.query(`SELECT id FROM ${table} LIMIT 1`);
      if (r.rows[0]?.id) result[key] = r.rows[0].id as string;
    } catch {}
  }));
  return result;
}

function resolveParamPath(path: string, ids: Record<string, string>): string {
  const genericId = ids.prospectId ?? ids.dealId ?? ids.signalId ?? "00000000-0000-0000-0000-000000000001";
  const paramMap: Record<string, string | undefined> = {
    ":prospectId": ids.prospectId,
    ":dealId":     ids.dealId,
    ":signalId":   ids.signalId,
    ":sequenceId": ids.sequenceId,
    ":activityId": ids.activityId,
    ":articleId":  ids.articleId,
    ":meetingId":  ids.meetingId,
    ":workflowId": ids.workflowId,
    ":templateId": ids.templateId,
    ":docId":      ids.docId,
    ":webhookId":  ids.webhookId,
    ":id":         genericId,
    ":pluginId":   "crm-sync",
    ":jobId":      "test-job-id",
    ":slug":       "growthos-demo",
  };
  let resolved = path;
  for (const [param, val] of Object.entries(paramMap)) {
    if (val) resolved = resolved.replace(param, val);
  }
  // Any remaining :param → use generic ID
  resolved = resolved.replace(/:[\w]+/g, genericId);
  return resolved;
}

async function auditRoutes(app: Express, baseUrl: string, token: string): Promise<RouteAuditResult[]> {
  const SKIP_METHODS = ["POST", "PUT", "PATCH", "DELETE"];
  const SKIP_PREFIXES = ["/api/v1/auth", "/api/v1/audit"];

  const allRoutes = listRoutes(app).filter(
    r => !SKIP_METHODS.includes(r.method)
      && !SKIP_PREFIXES.some(p => r.path.startsWith(p))
  );

  const ids = await fetchSampleIds();

  const results: RouteAuditResult[] = [];
  for (const route of allRoutes.slice(0, 100)) {
    const resolvedPath = resolveParamPath(route.path, ids);
    const start = Date.now();
    let status = 0;
    let error: string | undefined;
    try {
      const res = await fetch(`${baseUrl}${resolvedPath}`, {
        method: route.method,
        headers: route.auth
          ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
          : { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(5000),
      });
      status = res.status;
      if (status >= 500) {
        try {
          const b = await res.json() as any;
          error = b?.error ?? b?.message ?? `HTTP ${status}`;
        } catch { error = `HTTP ${status}`; }
      }
    } catch (err) {
      status = 0;
      error = err instanceof Error ? err.message : "Network error";
    }
    results.push({
      plugin: route.path.split("/")[3] ?? "core",
      method: route.method,
      route: route.path,
      status,
      latencyMs: Date.now() - start,
      error,
      auth: route.auth,
    });
  }
  return results;
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
        exists: !msg.includes("does not exist"),
        rowCount: null,
        error: msg.includes("does not exist") ? undefined : msg,
      });
    }
  }
  return results;
}

export async function runDeepAudit(app: Express, port: number): Promise<DeepAuditReport> {
  const start = Date.now();
  let token = "";
  try { token = makeTestToken(); }
  catch (err) { logger.warn({ err }, "No test token — auth routes may return 401"); }

  const [routeResults, dbResults] = await Promise.all([
    auditRoutes(app, `http://localhost:${port}`, token).catch(err => {
      logger.error({ err }, "Route audit failed");
      return [] as RouteAuditResult[];
    }),
    auditDatabase(),
  ]);

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

  const routeScore  = routeResults.length > 0 ? (routesOk / routeResults.length) * 40 : 40;
  const dbScore     = KNOWN_TABLES.length > 0 ? (tablesOk / KNOWN_TABLES.length) * 30 : 30;
  const pluginScore = allPlugins.length > 0
    ? (allPlugins.filter(r => r.state === "ACTIVE").length / allPlugins.length) * 30 : 30;

  return {
    timestamp: new Date().toISOString(),
    healthScore: Math.round(routeScore + dbScore + pluginScore),
    backend: {
      routesTested: routeResults.length, routesOk, routes4xx, routes5xx, avgLatencyMs,
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
