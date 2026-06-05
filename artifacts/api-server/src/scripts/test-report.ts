import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

interface TestResult { name: string; passed: boolean; error?: string; duration: number }
interface SuiteResult { suiteName: string; results: TestResult[]; passed: number; failed: number; duration: number }
interface RunSummary {
  suites: SuiteResult[];
  totalPassed: number;
  totalFailed: number;
  totalTests: number;
  passRate: number;
  duration: number;
  runAt: string;
}

const JSON_PATH = "/tmp/growthos-test-results.json";
const HTML_OUT = resolve(process.cwd(), "test-report.html");

function color(rate: number) {
  if (rate >= 80) return "#22c55e";
  if (rate >= 60) return "#f59e0b";
  return "#ef4444";
}

function badge(passed: boolean) {
  return passed
    ? `<span class="badge pass">✓ Passé</span>`
    : `<span class="badge fail">✗ Échoué</span>`;
}

function buildHtml(data: RunSummary): string {
  const suiteRows = data.suites
    .map((s) => {
      const rate = s.passed + s.failed > 0 ? Math.round((s.passed / (s.passed + s.failed)) * 100) : 100;
      const testRows = s.results
        .map(
          (t) => `
          <tr class="${t.passed ? "pass-row" : "fail-row"}">
            <td class="test-name">${t.passed ? "✓" : "✗"} ${t.name}</td>
            <td>${badge(t.passed)}</td>
            <td>${t.duration}ms</td>
            <td class="error-msg">${t.error ? `<code>${t.error.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code>` : "—"}</td>
          </tr>`,
        )
        .join("");

      return `
      <div class="suite-card ${s.failed > 0 ? "has-failures" : "all-pass"}">
        <div class="suite-header">
          <h3>${s.suiteName}</h3>
          <div class="suite-meta">
            <span class="rate" style="color:${color(rate)}">${rate}%</span>
            <span>${s.passed}/${s.passed + s.failed} tests</span>
            <span>${s.duration}ms</span>
          </div>
        </div>
        <table class="test-table">
          <thead><tr><th>Test</th><th>Statut</th><th>Durée</th><th>Erreur</th></tr></thead>
          <tbody>${testRows}</tbody>
        </table>
      </div>`;
    })
    .join("\n");

  const failedTests = data.suites.flatMap((s) =>
    s.results
      .filter((t) => !t.passed)
      .map((t) => `<li><b>[${s.suiteName}]</b> ${t.name}${t.error ? ` — <code>${t.error.slice(0, 100)}</code>` : ""}</li>`),
  );

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GrowthOS — Rapport de Tests E2E</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; line-height: 1.5; }
    header { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 2rem; border-bottom: 1px solid #334155; }
    header h1 { font-size: 1.75rem; color: #fff; }
    header .subtitle { color: #94a3b8; font-size: 0.9rem; margin-top: 0.25rem; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; padding: 1.5rem 2rem; }
    .kpi { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 1.25rem; text-align: center; }
    .kpi .val { font-size: 2rem; font-weight: 700; }
    .kpi .lbl { font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 0.25rem; }
    .progress-bar { margin: 0 2rem 1.5rem; height: 8px; background: #334155; border-radius: 99px; overflow: hidden; }
    .progress-fill { height: 100%; border-radius: 99px; transition: width 0.3s; }
    .failures-section { margin: 0 2rem 1.5rem; background: #1e293b; border: 1px solid #ef4444; border-radius: 12px; padding: 1.25rem; }
    .failures-section h2 { color: #ef4444; font-size: 1rem; margin-bottom: 0.75rem; }
    .failures-section ul { list-style: none; display: flex; flex-direction: column; gap: 0.4rem; }
    .failures-section li { font-size: 0.875rem; color: #fca5a5; }
    .failures-section code { background: #0f172a; padding: 0.1rem 0.3rem; border-radius: 4px; font-size: 0.8rem; }
    .suites { padding: 0 2rem 2rem; display: flex; flex-direction: column; gap: 1.25rem; }
    .suite-card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; overflow: hidden; }
    .suite-card.has-failures { border-color: #7f1d1d; }
    .suite-card.all-pass { border-color: #14532d; }
    .suite-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem; border-bottom: 1px solid #334155; }
    .suite-header h3 { font-size: 1rem; color: #f1f5f9; }
    .suite-meta { display: flex; gap: 1rem; font-size: 0.85rem; color: #94a3b8; align-items: center; }
    .suite-meta .rate { font-size: 1.1rem; font-weight: 700; }
    .test-table { width: 100%; border-collapse: collapse; }
    .test-table th { text-align: left; padding: 0.6rem 1.25rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; background: #0f172a; }
    .test-table td { padding: 0.5rem 1.25rem; font-size: 0.875rem; border-top: 1px solid #1e293b; }
    .test-name { color: #e2e8f0; }
    .pass-row td { background: rgba(34,197,94,0.03); }
    .fail-row td { background: rgba(239,68,68,0.05); }
    .error-msg code { background: #0f172a; color: #fca5a5; padding: 0.2rem 0.4rem; border-radius: 4px; font-size: 0.8rem; word-break: break-all; }
    .badge { display: inline-block; padding: 0.15rem 0.6rem; border-radius: 99px; font-size: 0.75rem; font-weight: 600; }
    .badge.pass { background: rgba(34,197,94,0.15); color: #4ade80; }
    .badge.fail { background: rgba(239,68,68,0.15); color: #f87171; }
    footer { text-align: center; padding: 1.5rem; color: #475569; font-size: 0.8rem; border-top: 1px solid #1e293b; }
  </style>
</head>
<body>
  <header>
    <h1>GrowthOS — Rapport de Tests E2E</h1>
    <div class="subtitle">Généré le ${new Date(data.runAt).toLocaleString("fr-FR")} · ${data.suites.length} suites · ${data.duration}ms</div>
  </header>

  <div class="summary">
    <div class="kpi"><div class="val" style="color:${color(data.passRate)}">${data.passRate}%</div><div class="lbl">Taux de réussite</div></div>
    <div class="kpi"><div class="val" style="color:#22c55e">${data.totalPassed}</div><div class="lbl">Tests passés</div></div>
    <div class="kpi"><div class="val" style="color:#ef4444">${data.totalFailed}</div><div class="lbl">Tests échoués</div></div>
    <div class="kpi"><div class="val" style="color:#94a3b8">${data.totalTests}</div><div class="lbl">Total tests</div></div>
    <div class="kpi"><div class="val" style="color:#94a3b8">${data.suites.length}</div><div class="lbl">Suites</div></div>
    <div class="kpi"><div class="val" style="color:#94a3b8">${data.duration}ms</div><div class="lbl">Durée totale</div></div>
  </div>

  <div class="progress-bar">
    <div class="progress-fill" style="width:${data.passRate}%;background:${color(data.passRate)}"></div>
  </div>

  ${failedTests.length > 0 ? `
  <div class="failures-section">
    <h2>⚠ Tests échoués (${failedTests.length})</h2>
    <ul>${failedTests.join("")}</ul>
  </div>` : ""}

  <div class="suites">
    ${suiteRows}
  </div>

  <footer>GrowthOS E2E Test Report · ${data.totalPassed}/${data.totalTests} tests passés</footer>
</body>
</html>`;
}

async function main() {
  console.log("📊 Génération du rapport de tests GrowthOS...\n");

  // Exécuter les tests si le fichier JSON n'existe pas
  if (!existsSync(JSON_PATH)) {
    console.log("Exécution des tests (--json)...");
    try {
      execSync("tsx src/tests/run-all-tests.ts --json", {
        stdio: "inherit",
        cwd: process.cwd(),
      });
    } catch {
      // Les tests peuvent retourner exit code 1 si des tests échouent
    }
  }

  if (!existsSync(JSON_PATH)) {
    console.error(`❌ Fichier de résultats non trouvé: ${JSON_PATH}`);
    console.error("Lancez d'abord: pnpm run test:e2e:coverage");
    process.exit(1);
  }

  const data: RunSummary = JSON.parse(readFileSync(JSON_PATH, "utf-8"));
  const html = buildHtml(data);
  writeFileSync(HTML_OUT, html, "utf-8");

  console.log(`✅ Rapport généré: ${HTML_OUT}`);
  console.log(`\n📈 Résumé:`);
  console.log(`   Taux de réussite : ${data.passRate}%`);
  console.log(`   Tests passés     : ${data.totalPassed}/${data.totalTests}`);
  console.log(`   Durée            : ${data.duration}ms`);
  console.log(`   Suites           : ${data.suites.length}`);

  if (data.totalFailed > 0) {
    console.log(`\n⚠️  ${data.totalFailed} test(s) échoué(s) :`);
    for (const suite of data.suites) {
      for (const test of suite.results) {
        if (!test.passed) {
          console.log(`   ✗ [${suite.suiteName}] ${test.name}`);
        }
      }
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
