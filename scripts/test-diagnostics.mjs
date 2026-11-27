import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
function loadTs(path, dependencies = {}) {
  const code = ts.transpileModule(source(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(id => dependencies[id] || require(id), module, module.exports);
  return module.exports;
}

const diagnostics = loadTs('artifacts/api-server/src/lib/diagnostics.ts', {
  '@workspace/db': { pool: { query: async () => ({ rows: [] }) } },
  './logger': { logger: { warn: () => {} } },
});
const text = diagnostics.safeDiagnosticText('Bearer top-secret https://pappers.fr/?key=hidden contact@example.com 06 12 34 56 78');
assert(!text.includes('top-secret') && !text.includes('key=hidden') && !text.includes('contact@example.com'), 'Secrets and email should be scrubbed');
const details = diagnostics.safeDiagnosticDetails({ password: 'NEVER_PERSIST', source: 'pappers', payload: 'PRIVATE', nested: { cookie: 'PRIVATE', reason: 'https://host/?api_key=secret' } });
assert.equal(details.password, undefined);
assert.equal(details.payload, undefined);
assert.equal(details.nested.cookie, undefined);
assert(!JSON.stringify(details).includes('secret'));
assert.equal(details.source, 'pappers');

const { diagnoseSourceIssue } = loadTs('artifacts/api-server/src/lib/source-diagnosis.ts');
for (const [sample, expected] of [
  [{ source: 'bing', httpStatus: 429 }, 'SOURCE_RATE_LIMIT'],
  [{ source: 'pagesjaunes', reason: 'Cloudflare challenge' }, 'SOURCE_SECURITY_CHALLENGE'],
  [{ source: 'insee', reason: 'Accès direct non configuré' }, 'SOURCE_UNCONFIGURED'],
  [{ source: 'google_maps', reason: 'Timeout 12000ms' }, 'SOURCE_TIMEOUT'],
  [{ source: 'pappers', status: 'needs_review' }, 'SOURCE_IDENTITY_REVIEW'],
  [{ source: 'google_search', status: 'empty' }, 'SOURCE_EMPTY'],
  [{ source: 'societe_com', httpStatus: 502 }, 'SOURCE_UNAVAILABLE'],
  [{ source: 'pappers', reason: 'fetch failed' }, 'SOURCE_NETWORK'],
  [{ source: 'google_search', reason: 'Réponse navigateur invalide' }, 'SOURCE_INVALID_RESPONSE'],
]) assert.equal(diagnoseSourceIssue(sample).causeCode, expected, `Cause for ${JSON.stringify(sample)}`);

// Structural regressions: new routes automatically recorded, read endpoints
// admin-only, source failures connected, no raw HTTP bodies in error logs.
const requestLogger = source('artifacts/api-server/src/middlewares/requestLogger.ts');
assert(requestLogger.includes('res.statusCode >= 400') && requestLogger.includes('recordDiagnosticEvent'));
assert(!source('artifacts/api-server/src/middlewares/errorHandler.ts').includes('body: req.body'));
const routes = source('artifacts/api-server/src/routes/v1/diagnostics.ts');
assert(routes.includes("router.use(requireRole('admin'))"));
assert(routes.includes('tenant_id=$1'));
assert(routes.includes("router.post('/client-events'"));
assert(routes.includes("router.get('/sources'"));
assert(source('artifacts/api-server/src/services/prospect-enrichment.ts').includes('diagnoseSourceIssue'));
assert(source('artifacts/api-server/src/services/cloud-browser.ts').includes('diagnoseSourceIssue'));
assert(source('artifacts/api-server/src/routes/v1/cloud-browser.ts').includes('WORKER_UNAVAILABLE'));
assert(source('artifacts/growthos/src/pages/DiagnosticsPage.tsx').includes('Pourquoi ?'));
assert(source('docs/DIAGNOSTICS-CONTRACT.md').includes('chaque développement futur'));
console.log('Diagnostic safety, source causes, tenant isolation and coverage contracts: OK');
