import assert from "node:assert";

export { assert };

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

export interface SuiteResult {
  suiteName: string;
  results: TestResult[];
  passed: number;
  failed: number;
  duration: number;
}

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout de ${ms}ms dépassé`)), ms),
  );
}

const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";

export class TestSuite {
  private results: TestResult[] = [];
  private suiteStart = Date.now();

  constructor(public readonly suiteName: string) {
    console.log(`\n${BOLD}${CYAN}▶ ${suiteName}${RESET}`);
  }

  async test(name: string, fn: () => Promise<void>): Promise<void> {
    const start = Date.now();
    try {
      await Promise.race([fn(), timeout(10_000)]);
      const dur = Date.now() - start;
      this.results.push({ name, passed: true, duration: dur });
      console.log(`  ${GREEN}✓${RESET} ${name} ${YELLOW}(${dur}ms)${RESET}`);
    } catch (err: unknown) {
      const dur = Date.now() - start;
      const error = err instanceof Error ? err.message : String(err);
      this.results.push({ name, passed: false, error, duration: dur });
      console.log(`  ${RED}✗${RESET} ${name}${RESET}`);
      console.log(`    ${RED}→ ${error}${RESET}`);
    }
  }

  getResults(): SuiteResult {
    const passed = this.results.filter((r) => r.passed).length;
    const failed = this.results.filter((r) => !r.passed).length;
    const duration = Date.now() - this.suiteStart;
    const color = failed === 0 ? GREEN : RED;
    console.log(
      `  ${color}${BOLD}${passed}/${this.results.length} tests passés${RESET} ${YELLOW}(${duration}ms)${RESET}`,
    );
    return { suiteName: this.suiteName, results: this.results, passed, failed, duration };
  }
}
