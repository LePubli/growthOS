import { type SuiteResult } from "./runner.ts";

const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

interface SuiteModule { run: () => Promise<SuiteResult> }

const SUITES: Array<{ name: string; file: string }> = [
  { name: "auth",              file: "./auth.test.ts" },
  { name: "prospects",         file: "./prospects.test.ts" },
  { name: "accounts",          file: "./accounts.test.ts" },
  { name: "pipeline",          file: "./pipeline.test.ts" },
  { name: "ai-sdr",            file: "./ai-sdr.test.ts" },
  { name: "deal-coach",        file: "./deal-coach.test.ts" },
  { name: "signals",           file: "./signals.test.ts" },
  { name: "memory",            file: "./memory.test.ts" },
  { name: "sequences",         file: "./sequences.test.ts" },
  { name: "sourcing",          file: "./sourcing.test.ts" },
  { name: "workflows",         file: "./workflows.test.ts" },
  { name: "webhooks",          file: "./webhooks.test.ts" },
  { name: "ereputation",       file: "./ereputation.test.ts" },
  { name: "tenant-isolation",      file: "./tenant-isolation.test.ts" },
  { name: "tenant-isolation-real", file: "./tenant-isolation-real.test.ts" },
  { name: "billing",               file: "./billing.test.ts" },
  { name: "compliance",        file: "./compliance.test.ts" },
  { name: "api-public",        file: "./api-public.test.ts" },
  { name: "integration",       file: "./integration.test.ts" },
  { name: "performance",       file: "./performance.test.ts" },
];

const args = process.argv.slice(2);
const onlySuites = args.filter((a) => !a.startsWith("--"));
const withCoverage = args.includes("--coverage");
const outputJson = args.includes("--json");

async function runSuite(entry: { name: string; file: string }): Promise<SuiteResult | null> {
  try {
    const mod = (await import(entry.file)) as SuiteModule;
    return await mod.run();
  } catch (err) {
    console.error(`${RED}✗ Impossible de charger la suite "${entry.name}": ${err}${RESET}`);
    return null;
  }
}

async function main() {
  const startTotal = Date.now();

  console.log(`\n${BOLD}${CYAN}╔══════════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}${CYAN}║     GrowthOS — Suite de Tests E2E            ║${RESET}`);
  console.log(`${BOLD}${CYAN}╚══════════════════════════════════════════════╝${RESET}`);
  console.log(`${DIM}  Serveur API : ${process.env.API_BASE ?? "http://localhost:8080/api/v1"}${RESET}`);
  console.log(`${DIM}  Démarré     : ${new Date().toLocaleString("fr-FR")}${RESET}\n`);

  const suitesToRun = onlySuites.length > 0
    ? SUITES.filter((s) => onlySuites.includes(s.name))
    : SUITES;

  if (suitesToRun.length === 0) {
    console.error(`${RED}Aucune suite trouvée. Suites disponibles: ${SUITES.map((s) => s.name).join(", ")}${RESET}`);
    process.exit(1);
  }

  const allResults: SuiteResult[] = [];

  for (const suite of suitesToRun) {
    const result = await runSuite(suite);
    if (result) allResults.push(result);
  }

  // ── Résumé global
  const totalDuration = Date.now() - startTotal;
  const totalPassed = allResults.reduce((s, r) => s + r.passed, 0);
  const totalFailed = allResults.reduce((s, r) => s + r.failed, 0);
  const totalTests = totalPassed + totalFailed;
  const passRate = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;

  console.log(`\n${BOLD}${CYAN}══════════════ RÉSUMÉ ══════════════${RESET}`);
  for (const r of allResults) {
    const icon = r.failed === 0 ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    const pct = r.passed + r.failed > 0
      ? Math.round((r.passed / (r.passed + r.failed)) * 100)
      : 100;
    console.log(
      `  ${icon} ${r.suiteName.padEnd(28)} ${String(r.passed).padStart(3)}/${r.passed + r.failed} tests  ${DIM}(${r.duration}ms)${RESET}`,
    );
  }

  console.log(`\n${BOLD}══════════════════════════════════════${RESET}`);
  const rateColor = passRate >= 80 ? GREEN : passRate >= 60 ? YELLOW : RED;
  console.log(
    `  ${BOLD}Total : ${rateColor}${totalPassed}/${totalTests} tests passés (${passRate}%)${RESET}  ${DIM}durée: ${totalDuration}ms${RESET}`,
  );

  if (totalFailed > 0) {
    console.log(`\n${RED}${BOLD}Tests échoués :${RESET}`);
    for (const suite of allResults) {
      for (const test of suite.results) {
        if (!test.passed) {
          console.log(`  ${RED}✗ [${suite.suiteName}] ${test.name}${RESET}`);
          if (test.error) console.log(`      ${RED}→ ${test.error}${RESET}`);
        }
      }
    }
  }

  // ── Export JSON pour le rapport HTML
  if (outputJson || withCoverage) {
    const jsonPath = "/tmp/growthos-test-results.json";
    const { writeFileSync } = await import("node:fs");
    writeFileSync(jsonPath, JSON.stringify({ suites: allResults, totalPassed, totalFailed, totalTests, passRate, duration: totalDuration, runAt: new Date().toISOString() }, null, 2));
    console.log(`\n${DIM}Résultats JSON exportés → ${jsonPath}${RESET}`);
  }

  console.log();
  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`${RED}Erreur fatale: ${err}${RESET}`);
  process.exit(2);
});
