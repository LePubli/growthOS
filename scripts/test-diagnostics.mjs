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
  './logger': { logger: { warn: () => {},info:()=>{},error:()=>{} } },
});
const text = diagnostics.safeDiagnosticText('Bearer top-secret https://pappers.fr/?key=hidden contact@example.com 06 12 34 56 78');
assert(!text.includes('top-secret') && !text.includes('key=hidden') && !text.includes('contact@example.com'), 'Secrets and email should be scrubbed');
const details = diagnostics.safeDiagnosticDetails({ password: 'NEVER_PERSIST', source: 'pappers', payload: 'PRIVATE', nested: { cookie: 'PRIVATE', reason: 'https://host/?api_key=secret' } });
assert.equal(details.password, undefined);
assert.equal(details.payload, undefined);
assert.equal(details.nested.cookie, undefined);
assert(!JSON.stringify(details).includes('secret'));
assert.equal(details.source, 'pappers');
assert(!diagnostics.safeDiagnosticText('Failed query: UPDATE prospects set company=PRIVATE_COMPANY').includes('PRIVATE_COMPANY'));
assert(source('artifacts/api-server/src/routes/v1/cloud-browser.ts').includes('CONFIRMATION_SAVED'));
assert(source('artifacts/api-server/src/routes/v1/contacts.ts').includes('PRIMARY_COORDINATE_CONFLICT'));
assert(source('artifacts/api-server/src/services/website-enrichment.ts').includes('WEBSITE_CONTACTS_READ'));

const databaseError=diagnostics.errorDiagnosticDetails({name:'DrizzleQueryError',message:'Failed query: PRIVATE_VALUE',cause:{code:'23505',constraint:'idx_prospects_tenant_siret',detail:'PRIVATE_ROW',query:'PRIVATE_SQL',parameters:['PRIVATE_VALUE']}});
assert.equal(databaseError.databaseCode,'23505');assert.equal(databaseError.databaseConstraint,'idx_prospects_tenant_siret');
assert(!JSON.stringify(databaseError).includes('PRIVATE_'),'SQL, rows and parameters must never enter technical diagnostics');
assert.equal(diagnostics.errorDiagnosticDetails({cause:{code:'23503',constraint:'PRIVATE_CONSTRAINT'}}).databaseConstraint,null);
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
  [{ source: 'bing', status: 'awaiting_user', reason: 'La page n’a pas fourni de résultats lisibles.' }, 'SOURCE_UNREADABLE_RESULTS'],
  [{ source: 'pagesjaunes', status: 'awaiting_user', reason: 'Contrôle de sécurité Cloudflare' }, 'SOURCE_SECURITY_CHALLENGE'],
  [{ source: 'pappers', status: 'awaiting_user', reason: 'Pappers : SIREN affiché non confirmé' }, 'SOURCE_IDENTITY_REVIEW'],
  [{ source: 'pappers', status: 'awaiting_user', reason: 'Ouvrez une fiche entreprise Pappers publique.' }, 'SOURCE_MANUAL_SELECTION'],
  [{ source: 'societe_com', status: 'awaiting_user', reason: 'Aucune correspondance fiable dans les résultats par nom et ville.' }, 'SOURCE_IDENTITY_REVIEW'],
  [{ source: 'bodacc', status: 'skipped', reason: 'Un SIREN confirmé est nécessaire pour rattacher les annonces.' }, 'SOURCE_IDENTITY_REQUIRED'],
  [{ source: 'bodacc', status: 'empty', reason: '0 annonce(s) officielles rattachées au SIREN' }, 'SOURCE_EMPTY'],
  [{ source: 'website', status: 'skipped', reason: 'Aucun site web renseigné sur le prospect.' }, 'SOURCE_WEBSITE_MISSING'],
  [{ source: 'pappers', reason: 'Aucune fiche capturée. Ouvrez la bonne fiche source.' }, 'SOURCE_CAPTURE_REQUIRED'],
  [{ source: 'google_search', status: 'failed', reason: 'Le navigateur n’a pas pu effectuer cette opération.' }, 'SOURCE_WORKER_FAILURE'],
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
assert(routes.includes("j.result->>'message' AS result_message"), 'Archived browser results must retain their explanation');
assert(source('artifacts/api-server/src/services/prospect-enrichment.ts').includes('diagnoseSourceIssue'));
assert(source('artifacts/api-server/src/services/cloud-browser.ts').includes('diagnoseSourceIssue'));
assert(source('artifacts/api-server/src/routes/v1/cloud-browser.ts').includes('WORKER_UNAVAILABLE'));
assert(source('artifacts/api-server/src/routes/v1/cloud-browser.ts').includes("code:invalidInput?'INVALID_BROWSER_INPUT':captureRequired?'CAPTURE_REQUIRED'"), 'Missing captures must not be misclassified as worker failures');
assert(source('artifacts/growthos/src/components/cloud-browser/CloudCaptureReview.tsx').includes('if(!job.result?.captures?.[index])'), 'Only compare after a real persisted capture');
assert(source('artifacts/growthos/src/pages/DiagnosticsPage.tsx').includes('Pourquoi ?'));
assert(source('docs/DIAGNOSTICS-CONTRACT.md').includes('chaque développement futur'));
console.log('Diagnostic safety, source causes, tenant isolation and coverage contracts: OK');
