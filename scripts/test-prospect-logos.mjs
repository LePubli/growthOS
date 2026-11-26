import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { publicCompanyOrigin, publicCompanyLogoCandidates } from '../artifacts/growthos/src/lib/prospect-logo.ts';

assert.equal(publicCompanyOrigin('https://www.example.org/activite?mode=test'), 'https://www.example.org');
assert.equal(publicCompanyOrigin('www.example.org'), 'https://www.example.org');
for (const unsafe of ['javascript:alert(1)', 'https://localhost', 'http://127.0.0.1:3000',
  'https://192.168.1.12', 'https://intranet.local', 'https://user:pass@example.org',
  'http://example.org:8080', 'https://service.internal', 'https://example.test']) {
  assert.equal(publicCompanyOrigin(unsafe), null, `Domaine refusé : ${unsafe}`);
}
assert.deepEqual(publicCompanyLogoCandidates('https://example.org'), [
  'https://example.org/favicon.ico', 'https://example.org/apple-touch-icon.png',
]);
assert.deepEqual(publicCompanyLogoCandidates('https://example.org', 'javascript:alert(1)'), [
  'https://example.org/favicon.ico', 'https://example.org/apple-touch-icon.png',
]);
assert.deepEqual(publicCompanyLogoCandidates('https://example.org', 'https://another.example.com/logo.png'), [
  'https://example.org/favicon.ico', 'https://example.org/apple-touch-icon.png',
]);
assert.equal(publicCompanyLogoCandidates('https://example.org', '/images/logo.svg')[0], 'https://example.org/images/logo.svg');

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../artifacts/api-server/build.mjs', import.meta.url));
const { build } = require('esbuild');
const directory = await mkdtemp(join(tmpdir(), 'growthos-logos-'));
try {
  await build({stdin:{resolveDir:join(root, 'artifacts/growthos'),loader:'tsx',contents:`
    import assert from 'node:assert/strict';
    import {createElement} from 'react';
    import {renderToStaticMarkup} from 'react-dom/server';
    import {SourceLogo,CompanyLogo} from './src/components/atlas/ProspectLogos';
    const source=renderToStaticMarkup(createElement(SourceLogo,{source:'linkedin'}));
    assert.ok(source.includes('https://www.linkedin.com/favicon.ico'));
    assert.ok(source.includes('referrerPolicy="no-referrer"')||source.includes('referrerpolicy="no-referrer"'));
    const company=renderToStaticMarkup(createElement(CompanyLogo,{name:'ENTREPRISE DEMO',website:'https://example.org'}));
    assert.ok(company.includes('https://example.org/favicon.ico'));
    const fallback=renderToStaticMarkup(createElement(CompanyLogo,{name:'ENTREPRISE DEMO'}));
    assert.ok(fallback.includes('ED'));
    assert.ok(!fallback.includes('src='));
  `},outfile:join(directory,'test.mjs'),platform:'node',format:'esm',bundle:true,jsx:'automatic',
    tsconfig:join(root,'artifacts/growthos/tsconfig.json'),
    banner:{js:"import {createRequire} from 'node:module'; const require=createRequire(import.meta.url);"},logLevel:'warning'});
  await import(pathToFileURL(join(directory,'test.mjs')).href);
} finally {
  await rm(directory,{recursive:true,force:true});
}
console.log('✓ Logos : sources officielles, repli monogramme, chargement sans référent et URL publique sécurisée');
