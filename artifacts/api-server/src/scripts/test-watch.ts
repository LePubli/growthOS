/**
 * test-watch.ts
 * Mode watch pour les tests E2E — relance les suites affectées
 * quand un fichier de routes ou de tests change.
 *
 * Usage : pnpm --filter @workspace/api-server run test:watch
 * Usage ciblé : pnpm --filter @workspace/api-server run test:watch -- prospects pipeline
 */

import { watch } from "node:fs";
import { resolve, basename } from "node:path";
import { execSync, spawn } from "node:child_process";

const RESET  = "\x1b[0m";
const GREEN  = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN   = "\x1b[36m";
const BOLD   = "\x1b[1m";
const DIM    = "\x1b[2m";
const RED    = "\x1b[31m";

const ROOT = resolve(process.cwd(), "src");
const TESTS_DIR   = resolve(ROOT, "tests");
const ROUTES_DIR  = resolve(ROOT, "routes");
const PLUGINS_DIR = resolve(ROOT, "routes", "v1", "plugins");
const LIB_DIR     = resolve(ROOT, "lib");

const args = process.argv.slice(2);
const pinnedSuites = args.filter((a) => !a.startsWith("--"));
const DEBOUNCE_MS = 800;

/** Map route-file → suite name(s) */
const ROUTE_TO_SUITE: Record<string, string[]> = {
  "prospects.ts":          ["prospects"],
  "accounts.ts":           ["accounts"],
  "activities.ts":         ["activities"],
  "tasks.ts":              ["tasks"],
  "meetings.ts":           ["meetings"],
  "sequences.ts":          ["sequences"],
  "templates.ts":          ["templates"],
  "signals.ts":            ["signals", "signal-intelligence"],
  "sourcing.ts":           ["sourcing"],
  "notifications.ts":      ["notifications"],
  "workflows.ts":          ["workflows"],
  "webhooks.ts":           ["webhooks"],
  "reporting.ts":          ["reporting"],
  "auth.ts":               ["auth"],
  "admin-users.ts":        ["admin-users"],
  "admin-plans.ts":        ["admin-plans"],
  "admin-api-keys.ts":     ["admin-api-keys"],
  "route-audit.ts":        ["audit-routes"],
  "audit.ts":              ["deep-audit"],
  "ai-sdr.ts":             ["ai-sdr"],
  "deal-coach.ts":         ["deal-coach"],
  "revenue.ts":            ["revenue"],
  "executive.ts":          ["executive"],
  "ereputation.ts":        ["ereputation", "client-portal"],
  "billing.ts":            ["billing"],
  "integration.ts":        ["integration"],
  "api-public.ts":         ["api-public"],
};

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let runningProcess: ReturnType<typeof spawn> | null = null;
let pendingSuites = new Set<string>();

function suitesForFile(filename: string): string[] {
  // Fichier de test directement modifié
  if (filename.endsWith(".test.ts")) {
    const name = filename.replace(".test.ts", "");
    return [name];
  }
  // Fichier de route → mapper vers suites
  return ROUTE_TO_SUITE[filename] ?? [];
}

function runSuites(suites: string[]) {
  if (runningProcess) {
    runningProcess.kill("SIGTERM");
    runningProcess = null;
  }

  const toRun = pinnedSuites.length > 0 ? pinnedSuites : suites;

  console.log(`\n${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
  console.log(`${CYAN}  🔁 Relance : ${toRun.join(", ")}${RESET}`);
  console.log(`${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n`);

  const child = spawn(
    "tsx",
    ["src/tests/run-all-tests.ts", ...toRun],
    { stdio: "inherit", cwd: process.cwd() },
  );

  runningProcess = child;

  child.on("close", (code) => {
    runningProcess = null;
    const color = code === 0 ? GREEN : RED;
    const icon  = code === 0 ? "✓" : "✗";
    console.log(`\n${color}${BOLD}${icon} Tests terminés (code ${code})${RESET}`);
    console.log(`${DIM}  En attente de modifications…${RESET}\n`);
  });
}

function scheduleRun(filename: string) {
  const suites = suitesForFile(filename);
  if (suites.length > 0) {
    suites.forEach((s) => pendingSuites.add(s));
  } else {
    // Fichier non mappé → relancer toutes les suites
    pendingSuites.add("*");
  }

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const all = pendingSuites.has("*");
    const toRun = all ? [] : [...pendingSuites];
    pendingSuites.clear();
    runSuites(toRun);
  }, DEBOUNCE_MS);
}

function watchDir(dir: string, label: string) {
  try {
    watch(dir, { recursive: true }, (_event, filename) => {
      if (!filename) return;
      const name = basename(String(filename));
      if (!name.endsWith(".ts") || name.endsWith(".d.ts")) return;
      console.log(`${YELLOW}  ⚡ ${label} modifié : ${name}${RESET}`);
      scheduleRun(name);
    });
    console.log(`${DIM}  👁  ${label} : ${dir}${RESET}`);
  } catch {
    // Répertoire inexistant — silencieux
  }
}

async function main() {
  console.log(`\n${BOLD}${CYAN}╔══════════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}${CYAN}║   GrowthOS — Tests E2E en mode Watch         ║${RESET}`);
  console.log(`${BOLD}${CYAN}╚══════════════════════════════════════════════╝${RESET}`);
  console.log(`${DIM}  Debounce  : ${DEBOUNCE_MS}ms${RESET}`);
  if (pinnedSuites.length > 0) {
    console.log(`${DIM}  Suites    : ${pinnedSuites.join(", ")} (épinglées)${RESET}`);
  } else {
    console.log(`${DIM}  Suites    : auto-détectées selon les fichiers modifiés${RESET}`);
  }
  console.log(`${DIM}  Ctrl+C    : quitter${RESET}\n`);

  watchDir(TESTS_DIR,   "Tests");
  watchDir(ROUTES_DIR,  "Routes");
  watchDir(PLUGINS_DIR, "Plugins");
  watchDir(LIB_DIR,     "Lib");

  console.log(`\n${GREEN}✓ Watch actif — modifiez un fichier pour lancer les tests${RESET}`);
  console.log(`${DIM}  En attente de modifications…${RESET}\n`);

  // Run initial si des suites sont pinnées
  if (pinnedSuites.length > 0) {
    console.log(`${DIM}  Lancement initial des suites épinglées…${RESET}`);
    runSuites(pinnedSuites);
  }

  // Garder le process en vie
  process.stdin.resume();

  process.on("SIGINT", () => {
    if (runningProcess) runningProcess.kill("SIGTERM");
    console.log(`\n${YELLOW}  Watch arrêté.${RESET}\n`);
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
