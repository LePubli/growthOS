import fs from "node:fs";
import path from "node:path";

const ROUTES_DIR = path.join(import.meta.dirname, "..", "routes", "v1");
const INDEX_FILE = path.join(ROUTES_DIR, "index.ts");

interface RouteAudit {
  file: string;
  mountPath: string;
  hasRequireAuthAtMount: boolean;
  hasRequireAuthInternal: boolean;
  hasRequireTenantAtMount: boolean;
  hasRequireTenantInternal: boolean;
  hastenantIdUsage: boolean;
  isPublicByDesign: boolean;
  protected: boolean;
  tenantIsolated: boolean;
  issues: string[];
}

const PUBLIC_BY_DESIGN = new Set(["/auth", "/public", "/api-docs"]);

function readFile(p: string): string {
  try { return fs.readFileSync(p, "utf8"); } catch { return ""; }
}

function collectRouteFiles(dir: string, prefix = ""): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      files.push(...collectRouteFiles(path.join(dir, entry.name), prefix + "/" + entry.name));
    } else if (entry.name.endsWith(".ts") && entry.name !== "index.ts") {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

function analyzeRouteFile(filePath: string): {
  hasRequireAuthInternal: boolean;
  hasRequireTenantInternal: boolean;
  hastenantIdUsage: boolean;
} {
  const content = readFile(filePath);
  return {
    hasRequireAuthInternal: content.includes("requireAuth"),
    hasRequireTenantInternal: content.includes("requireTenant"),
    hastenantIdUsage: content.includes("tenantId") || content.includes("tenant_id"),
  };
}

function parseIndexMounts(indexContent: string): Map<string, { auth: boolean; tenant: boolean }> {
  const mounts = new Map<string, { auth: boolean; tenant: boolean }>();
  const lines = indexContent.split("\n");
  for (const line of lines) {
    const m = line.match(/router\.use\("([^"]+)"(.*?)\)/);
    if (!m) continue;
    const mountPath = m[1]!;
    const args = m[2]!;
    mounts.set(mountPath, {
      auth: args.includes("requireAuth"),
      tenant: args.includes("requireTenant"),
    });
  }
  return mounts;
}

function buildFileToMountMap(indexContent: string, routeFiles: string[]): Map<string, string> {
  const map = new Map<string, string>();
  const importLines = indexContent.split("\n").filter((l) => l.startsWith("import"));
  for (const routeFile of routeFiles) {
    const base = path.basename(routeFile, ".ts");
    const rel = path.relative(ROUTES_DIR, routeFile).replace(/\\/g, "/").replace(".ts", "");
    // Find mount path by matching import alias to router.use call
    for (const imp of importLines) {
      if (imp.includes(`"./${rel}"`) || imp.includes(`"./${base}"`)) {
        const alias = imp.match(/import\s+(\w+)\s+from/)?.[1];
        if (alias) {
          const useLine = indexContent.split("\n").find(
            (l) => l.includes("router.use(") && l.includes(alias),
          );
          const mp = useLine?.match(/router\.use\("([^"]+)"/)?.[1];
          if (mp) {
            map.set(routeFile, mp);
          }
        }
      }
    }
  }
  return map;
}

async function main() {
  const indexContent = readFile(INDEX_FILE);
  const mounts = parseIndexMounts(indexContent);
  const routeFiles = collectRouteFiles(ROUTES_DIR);
  const fileToMount = buildFileToMountMap(indexContent, routeFiles);

  const results: RouteAudit[] = [];

  for (const [mountPath, mountInfo] of mounts.entries()) {
    const isPublicByDesign = PUBLIC_BY_DESIGN.has(mountPath);
    const relFile = Array.from(fileToMount.entries()).find(([, mp]) => mp === mountPath)?.[0] ?? null;
    const internal = relFile ? analyzeRouteFile(relFile) : {
      hasRequireAuthInternal: false,
      hasRequireTenantInternal: false,
      hastenantIdUsage: false,
    };

    const issues: string[] = [];
    const protected_ = isPublicByDesign || mountInfo.auth || internal.hasRequireAuthInternal;
    const tenantIsolated = isPublicByDesign || mountInfo.tenant || internal.hastenantIdUsage || internal.hasRequireTenantInternal;

    if (!isPublicByDesign) {
      if (!mountInfo.auth && !internal.hasRequireAuthInternal) {
        issues.push("❌ requireAuth manquant (mount + interne)");
      } else if (!mountInfo.auth) {
        issues.push("⚠️  requireAuth absent au niveau mount (présent en interne)");
      }
      if (!mountInfo.tenant) {
        issues.push("⚠️  requireTenant absent au niveau mount");
      }
      if (!internal.hastenantIdUsage) {
        issues.push("⚠️  Aucune utilisation de tenantId détectée");
      }
    }

    results.push({
      file: relFile ? path.relative(ROUTES_DIR, relFile) : "(inconnu)",
      mountPath,
      hasRequireAuthAtMount: mountInfo.auth,
      hasRequireAuthInternal: internal.hasRequireAuthInternal,
      hasRequireTenantAtMount: mountInfo.tenant,
      hasRequireTenantInternal: internal.hasRequireTenantInternal,
      hastenantIdUsage: internal.hastenantIdUsage,
      isPublicByDesign,
      protected: protected_,
      tenantIsolated,
      issues,
    });
  }

  // ── AFFICHAGE RAPPORT ──────────────────────────────────────────────────────
  const ok = results.filter((r) => r.isPublicByDesign || (r.hasRequireAuthAtMount && r.hasRequireTenantAtMount));
  const warn = results.filter((r) => !r.isPublicByDesign && (!r.hasRequireAuthAtMount || !r.hasRequireTenantAtMount));
  const err = results.filter((r) => !r.isPublicByDesign && !r.protected);

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║        AUDIT MULTI-TENANCY — ROUTES GrowthOS             ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  console.log(`📊 Résumé : ${results.length} routes analysées`);
  console.log(`  ✅ Entièrement protégées (auth + tenant au mount) : ${ok.length}`);
  console.log(`  ⚠️  Auth OK mais requireTenant absent au mount    : ${warn.filter((r) => r.hasRequireAuthAtMount).length}`);
  console.log(`  ⚠️  Auth interne seulement (pas au mount)         : ${warn.filter((r) => !r.hasRequireAuthAtMount && r.protected).length}`);
  console.log(`  ❌ Non protégées                                  : ${err.length}`);
  console.log(`  🌐 Publiques par conception                       : ${results.filter((r) => r.isPublicByDesign).length}`);

  console.log("\n──────────────────── DÉTAIL PAR ROUTE ────────────────────");
  for (const r of results) {
    const authIcon = r.isPublicByDesign ? "🌐" : r.hasRequireAuthAtMount ? "🔐" : r.protected ? "🔑" : "❌";
    const tenantIcon = r.isPublicByDesign ? " " : r.hasRequireTenantAtMount ? "🏢" : r.hastenantIdUsage ? "📦" : "⚠️ ";
    console.log(`  ${authIcon} ${tenantIcon} ${r.mountPath.padEnd(22)} ${r.file}`);
    for (const issue of r.issues) {
      console.log(`       ${issue}`);
    }
  }

  // ── ROUTES CRITIQUES À CORRIGER ───────────────────────────────────────────
  const toFix = results.filter((r) => !r.isPublicByDesign && (!r.hasRequireAuthAtMount || !r.hasRequireTenantAtMount));
  if (toFix.length > 0) {
    console.log("\n──────── ROUTES À CORRIGER DANS index.ts ────────────────────");
    console.log("Remplacer :");
    for (const r of toFix) {
      const currentArgs = r.hasRequireAuthAtMount ? "requireAuth, " : "";
      const fixedArgs = "requireAuth, requireTenant, ";
      console.log(`  router.use("${r.mountPath}", ${currentArgs}router) → router.use("${r.mountPath}", ${fixedArgs}router)`);
    }
  }

  console.log("\n══════════════════════════════════════════════════════════\n");

  // ── SORTIE JSON ────────────────────────────────────────────────────────────
  const reportPath = path.join(import.meta.dirname, "..", "..", "tenant-audit-report.json");
  fs.writeFileSync(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), summary: { total: results.length, fullyProtected: ok.length, warnings: warn.length, errors: err.length, public: results.filter((r) => r.isPublicByDesign).length }, routes: results }, null, 2));
  console.log(`📄 Rapport JSON : ${reportPath}\n`);
}

main().catch(console.error);
