/**
 * Dashboard de couverture API — généré après chaque run E2E.
 * Compare les routes définies dans l'API vs les routes testées dans la suite E2E.
 * Usage : pnpm tsx src/scripts/api-coverage-dashboard.ts
 */
import fs from "node:fs";
import path from "node:path";

const ROUTES_DIR = path.join(import.meta.dirname, "..", "routes", "v1");
const TESTS_DIR = path.join(import.meta.dirname, "..", "tests");
const INDEX_FILE = path.join(ROUTES_DIR, "index.ts");

// ── EXTRACTION DES ROUTES MONTÉES ──────────────────────────────────────────
function extractMountedPaths(): string[] {
  const content = fs.readFileSync(INDEX_FILE, "utf8");
  const paths: string[] = [];
  for (const line of content.split("\n")) {
    const m = line.match(/router\.use\("([^"]+)"/);
    if (m) paths.push(m[1]!);
  }
  return paths;
}

// ── EXTRACTION DES ENDPOINTS DEPUIS UN FICHIER ROUTE ──────────────────────
function extractEndpoints(filePath: string, mountPath: string): Array<{ method: string; path: string }> {
  const content = fs.readFileSync(filePath, "utf8");
  const endpoints: Array<{ method: string; path: string }> = [];
  const methodRegex = /router\.(get|post|patch|put|delete|use)\(["']([^"']+)["']/g;
  let m;
  while ((m = methodRegex.exec(content)) !== null) {
    const method = m[1]!.toUpperCase();
    const subPath = m[2]!;
    if (method === "USE" && subPath === mountPath) continue;
    const full = `${mountPath}${subPath === "/" ? "" : subPath}`;
    endpoints.push({ method: method === "USE" ? "USE" : method, path: full });
  }
  return endpoints.filter((e) => e.method !== "USE");
}

// ── EXTRACTION DES ROUTES TESTÉES DEPUIS LES TESTS ──────────────────────
function extractTestedPaths(): Set<string> {
  const tested = new Set<string>();
  const testFiles = fs.readdirSync(TESTS_DIR)
    .filter((f) => f.endsWith(".test.ts"))
    .map((f) => path.join(TESTS_DIR, f));

  for (const file of testFiles) {
    const content = fs.readFileSync(file, "utf8");
    // Capture api.get/post/patch/delete("/path") or api.get(`/path`)
    const regex = /api\.(get|post|patch|delete|put)\(["'`]([^"'`]+)["'`]/g;
    let m;
    while ((m = regex.exec(content)) !== null) {
      // Strip dynamic segments: /prospects/:id → /prospects
      const rawPath = m[2]!.split("?")[0]!;
      const normalized = rawPath.replace(/\/[a-f0-9-]{36}|\/:\w+/g, "/:id");
      tested.add(normalized);
      // Also add the base path
      const base = "/" + rawPath.split("/").slice(1, 2).join("/");
      tested.add(base);
    }
  }
  return tested;
}

// ── MAPPING FICHIER → MOUNT PATH ──────────────────────────────────────────
function buildFileMap(): Map<string, string> {
  const indexContent = fs.readFileSync(INDEX_FILE, "utf8");
  const map = new Map<string, string>();

  const imports = indexContent.split("\n").filter((l) => l.startsWith("import"));
  const uses = indexContent.split("\n").filter((l) => l.includes("router.use("));

  for (const imp of imports) {
    const match = imp.match(/import\s+(\w+)\s+from\s+"\.\/([^"]+)"/);
    if (!match) continue;
    const [, alias, rel] = match;
    const use = uses.find((l) => l.includes(alias!));
    if (!use) continue;
    const mp = use.match(/router\.use\("([^"]+)"/)?.[1];
    if (!mp) continue;

    // Try direct file
    const candidates = [
      path.join(ROUTES_DIR, `${rel}.ts`),
      path.join(ROUTES_DIR, `${rel}/index.ts`),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        map.set(c, mp);
        break;
      }
    }
  }
  return map;
}

interface CoverageEntry {
  mountPath: string;
  endpoints: Array<{ method: string; path: string; tested: boolean }>;
  coveragePercent: number;
}

async function main() {
  const mountedPaths = extractMountedPaths();
  const testedPaths = extractTestedPaths();
  const fileMap = buildFileMap();

  const PUBLIC_MOUNTS = new Set(["/auth", "/public", "/api-docs"]);

  const coverage: CoverageEntry[] = [];
  let totalEndpoints = 0;
  let totalTested = 0;

  // Group by mount path
  for (const [file, mountPath] of fileMap.entries()) {
    if (!mountedPaths.includes(mountPath)) continue;
    const isPublic = PUBLIC_MOUNTS.has(mountPath);

    try {
      const endpoints = extractEndpoints(file, mountPath);
      if (endpoints.length === 0) continue;

      const enriched = endpoints.map((e) => {
        const pathNorm = e.path.replace(/\/:[\w]+/g, "/:id");
        const basePath = "/" + e.path.split("/").slice(1, 2).join("/");
        const tested = testedPaths.has(pathNorm)
          || testedPaths.has(e.path)
          || testedPaths.has(basePath)
          || Array.from(testedPaths).some((tp) => pathNorm.startsWith(tp));
        return { ...e, tested };
      });

      const testedCount = enriched.filter((e) => e.tested).length;
      coverage.push({
        mountPath,
        endpoints: enriched,
        coveragePercent: Math.round((testedCount / enriched.length) * 100),
      });

      if (!isPublic) {
        totalEndpoints += enriched.length;
        totalTested += testedCount;
      }
    } catch {
      // skip unreadable files
    }
  }

  coverage.sort((a, b) => a.coveragePercent - b.coveragePercent);

  // ── AFFICHAGE ────────────────────────────────────────────────────────────
  const globalPercent = totalEndpoints > 0 ? Math.round((totalTested / totalEndpoints) * 100) : 0;

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║           DASHBOARD DE COUVERTURE API — GrowthOS           ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");
  console.log(`📊 Couverture globale : ${totalTested}/${totalEndpoints} endpoints testés (${globalPercent}%)\n`);

  const barWidth = 30;
  const bar = (pct: number) => {
    const filled = Math.round((pct / 100) * barWidth);
    return "█".repeat(filled) + "░".repeat(barWidth - filled);
  };
  const colorPct = (pct: number) => pct >= 80 ? `✅ ${pct}%` : pct >= 50 ? `🟡 ${pct}%` : `❌ ${pct}%`;

  for (const entry of coverage) {
    const isPublic = PUBLIC_MOUNTS.has(entry.mountPath);
    const label = isPublic ? "🌐 public" : colorPct(entry.coveragePercent);
    console.log(`  ${entry.mountPath.padEnd(28)} [${bar(entry.coveragePercent)}] ${label}`);
    if (entry.coveragePercent < 100 && !isPublic) {
      const untested = entry.endpoints.filter((e) => !e.tested);
      for (const u of untested.slice(0, 3)) {
        console.log(`    ↳ ⚠️  NON TESTÉ : ${u.method} ${u.path}`);
      }
      if (untested.length > 3) {
        console.log(`    ↳ … et ${untested.length - 3} autres endpoints non testés`);
      }
    }
  }

  // ── ROUTES SANS COUVERTURE ─────────────────────────────────────────────
  const unmapped = mountedPaths.filter(
    (mp) => !PUBLIC_MOUNTS.has(mp) && !coverage.find((c) => c.mountPath === mp),
  );
  if (unmapped.length > 0) {
    console.log("\n⚠️  Routes montées sans analyse (fichier non trouvé) :");
    for (const mp of unmapped) {
      const tested = Array.from(testedPaths).some((tp) => tp.startsWith(mp));
      console.log(`  ${tested ? "🟡" : "❌"} ${mp} ${tested ? "(testée via API client)" : "(non testée)"}`);
    }
  }

  console.log(`\n══════════════════════════════════════════════════════════`);
  console.log(`  Couverture globale : ${globalPercent}% (${totalTested}/${totalEndpoints} endpoints)`);
  console.log(`  Timestamp          : ${new Date().toISOString()}`);
  console.log(`══════════════════════════════════════════════════════════\n`);

  // ── RAPPORT JSON ──────────────────────────────────────────────────────────
  const report = {
    generatedAt: new Date().toISOString(),
    globalCoverage: { percent: globalPercent, tested: totalTested, total: totalEndpoints },
    routes: coverage.map((c) => ({
      mountPath: c.mountPath,
      coveragePercent: c.coveragePercent,
      endpoints: c.endpoints,
    })),
    untestedMounts: unmapped,
  };
  const outPath = path.join(import.meta.dirname, "..", "..", "api-coverage-report.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`📄 Rapport JSON : ${outPath}\n`);
}

main().catch(console.error);
