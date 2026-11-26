/**
 * Disposable integration smoke test for GrowthOS first-run setup.
 *
 * Requirements: Node.js 24, API dependencies installed, API dist built.
 * Run: node scripts/smoke-wizard.mjs
 *
 * Uses an ephemeral PGlite PostgreSQL-compatible adapter plus local directory
 * and Ollama stubs. No remote service, user database or email is touched.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, randomUUID, createHmac } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

const root = resolve(fileURLToPath(import.meta.url), "../..");
const processes = [];
let apiErrorLog = "";
const ephemeralDbDir = await mkdtemp(join(tmpdir(), "growthos-smoke-"));
const setupToken = randomBytes(32).toString("hex");
// CI runs against a disposable PostgreSQL 16 service, which supports the
// parallel queries issued inside several dashboard routes. Local development
// can retain PGlite for fast, low-dependency wizard smoke tests.
const realPostgresUrl = process.env.SMOKE_POSTGRES_URL;

async function availablePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

const [dbPort, apiPort, companiesPort, ollamaPort, pagesJaunesPort, browserPort] = await Promise.all([
  availablePort(), availablePort(), availablePort(), availablePort(), availablePort(), availablePort(),
]);
const base = `http://127.0.0.1:${apiPort}/api/v1`;
const testEnv = {
  ...process.env,
  DATABASE_URL: realPostgresUrl ?? `postgresql://postgres:postgres@127.0.0.1:${dbPort}/postgres`,
  JWT_SECRET: randomBytes(48).toString("hex"),
  JWT_REFRESH_SECRET: randomBytes(48).toString("hex"),
  ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  SETUP_TOKEN: setupToken,
  COMPANY_DIRECTORY_API_URL: `http://127.0.0.1:${companiesPort}/search`,
  GROWTHOS_SMOKE_TEST: "true",
  PAGESJAUNES_TEST_ORIGIN: `http://127.0.0.1:${pagesJaunesPort}`,
  PAGESJAUNES_BROWSER_URL: `http://127.0.0.1:${browserPort}`,
  ENABLE_OUTBOUND_EMAIL: "false",
  ALLOW_PUBLIC_REGISTRATION: "false",
  PLATFORM_ADMIN_EMAILS: "admin@wizard.invalid",
  NODE_ENV: "production",
  PORT: String(apiPort),
};

function check(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`  ✓ ${message}`);
}

function startProcess(command, args) {
  const child = spawn(command, args, {
    cwd: root,
    env: testEnv,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  processes.push(child);
  let stderr = "";
  child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-1200); });
  if (args[0] === "artifacts/api-server/dist/index.mjs") {
    child.stdout.on("data", chunk => {
      const lines = String(chunk).split("\n").filter(line => /"level":50|Unhandled error/.test(line));
      apiErrorLog = (apiErrorLog + lines.join("\n") + "\n").slice(-12000);
    });
  }
  child.on("exit", (code) => {
    if (code && code !== 0) console.error(`  ${command} stopped (${code}): ${stderr}`);
  });
  return child;
}

async function request(method, path, data, token) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
    signal: AbortSignal.timeout(12000),
  });
  return { status: response.status, body: await response.json() };
}

async function awaitSourcingJob(id, token, timeoutMs = 40000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await request('GET', `/sourcing/jobs/${id}`, undefined, token);
    if (result.body.status === 'completed' || result.body.status === 'error') return result.body;
    await delay(400);
  }
  throw new Error('La recherche multisource n’a pas terminé dans le délai imparti');
}

async function monitoringMaintenance(action,id) {
  const code = `import {pool} from '@workspace/db';
    import {runProspectWatch} from './src/services/prospect-monitoring.ts';
    const [action,id]=process.argv.slice(1);
    if(action==='expire') await pool.query("UPDATE prospect_monitoring SET last_attempt_at=NOW()-INTERVAL '2 minutes',checked_at=NOW()-INTERVAL '2 minutes',next_check_at=NOW()-INTERVAL '1 second' WHERE prospect_id=$1",[id]);
    if(action==='cron') await runProspectWatch();
    if(action==='legacy-identity') {
      await pool.query("BEGIN; DROP INDEX idx_prospects_tenant_siret; ALTER TABLE prospects DISABLE TRIGGER growthos_prospect_identity;");
      await pool.query("INSERT INTO prospects (company,tenant_id,siret) SELECT 'Ancien doublon',tenant_id,siret FROM prospects WHERE id=$1",[id]);
      await pool.query("ALTER TABLE prospects ENABLE TRIGGER growthos_prospect_identity; COMMIT;");
      const {runMigrations}=await import('../../lib/db/src/migrate.ts');
      await runMigrations(1); await runMigrations(1);
    }
    await pool.end();`;
  await new Promise((resolve,reject)=>{
    const child=spawn('node',['--import','tsx','--input-type=module','-e',code,action,id],{cwd:join(root,'artifacts/api-server'),env:testEnv,stdio:['ignore','pipe','pipe']});
    let errors='';child.stderr.on('data',chunk=>{errors+=String(chunk);});
    child.on('error',reject);child.on('exit',status=>status===0?resolve():reject(new Error('Maintenance de test : '+errors.slice(-1000))));
  });
}

// Hold the import just before the production identity trigger. A second HTTP
// request then creates the same SIRET, reproducing a real lookup/insert race.
async function importIdentityRace(kind,token,example) {
  const code = String.raw`import {pool} from '@workspace/db';
    const [base,token,kind,raw]=process.argv.slice(1);
    const example=JSON.parse(raw),tenantId=JSON.parse(Buffer.from(token.split('.')[1],'base64url')).tenantId;
    const prefix=kind==='device'?'9847001':'9847002';
    const records=[1,2,3].map((n)=>({...example,id:'race_'+kind+'_'+n,company:'Course '+kind+' '+n,
      siret:prefix+String(n).padStart(2,'0')+'00016',sourceUrl:'https://www.societe.com/societe/course-'+prefix+String(n).padStart(2,'0')+'.html'}));
    const raced=records[1],client=await pool.connect();let locked=false;
    const request=async(path,body)=>{const response=await fetch(base+path,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});return{status:response.status,body:await response.json()};};
    try {
      await client.query('SELECT pg_advisory_lock(885102)');locked=true;
      await pool.query("CREATE OR REPLACE FUNCTION smoke_identity_race() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.siret='"+raced.siret+"' AND NEW.company='"+raced.company+"' THEN PERFORM pg_advisory_xact_lock(885102); END IF; RETURN NEW; END $$; CREATE TRIGGER aaa_smoke_identity_race BEFORE INSERT ON prospects FOR EACH ROW EXECUTE FUNCTION smoke_identity_race();");
      let path='/sourcing/device/import-prospects',payload={verified:records};
      if(kind==='job') {
        const results=records.map(record=>({...record,siren:record.siret.slice(0,9),source:'entreprises'}));
        const job=await pool.query("INSERT INTO sourcing_jobs (type,name,status,params,tenant_id) VALUES ('entreprises','Course import','completed',$1,$2) RETURNING id",[JSON.stringify({results}),tenantId]);
        path='/sourcing/jobs/'+job.rows[0].id+'/import';payload={ids:records.map(record=>record.id)};
      }
      const pending=request(path,payload);
      let waiting=false;
      for(let attempt=0;attempt<250;attempt++) {
        const state=await pool.query("SELECT 1 FROM pg_locks WHERE locktype='advisory' AND objid=885102 AND NOT granted");
        if(state.rows.length){waiting=true;break;}
        await new Promise(resolve=>setTimeout(resolve,20));
      }
      if(!waiting)throw new Error('Import non bloqué avant le contrôle SIRET');
      const simultaneous=await request('/prospects',{company:'Nom concurrent '+kind,siret:raced.siret});
      if(simultaneous.status!==201)throw new Error('Création concurrente non réussie : '+JSON.stringify(simultaneous));
      await client.query('SELECT pg_advisory_unlock(885102)');locked=false;
      const result=await pending;
      const rows=await pool.query('SELECT siret FROM prospects WHERE tenant_id=$1 AND siret=ANY($2::text[])',[tenantId,records.map(record=>record.siret)]);
      console.log(JSON.stringify({...result,rows:rows.rows,records}));
    } finally {
      if(locked)await client.query('SELECT pg_advisory_unlock(885102)');
      await pool.query('DROP TRIGGER IF EXISTS aaa_smoke_identity_race ON prospects; DROP FUNCTION IF EXISTS smoke_identity_race();');
      client.release();await pool.end();
    }`;
  return await new Promise((resolve,reject)=>{
    const child=spawn('node',['--import','tsx','--input-type=module','-e',code,base,token,kind,JSON.stringify(example)],{cwd:join(root,'artifacts/api-server'),env:testEnv,stdio:['ignore','pipe','pipe']});
    let output='',errors='';child.stdout.on('data',chunk=>{output+=String(chunk);});child.stderr.on('data',chunk=>{errors+=String(chunk);});
    child.on('error',reject);child.on('exit',status=>{
      if(status!==0){reject(new Error('Course import : '+errors.slice(-1400)));return;}
      try{resolve(JSON.parse(output.trim().split('\n').at(-1)));}catch(error){reject(error);}
    });
  });
}

async function storeLegacyLinkedinProfiles(prospectId) {
  const code=String.raw`import {pool} from '@workspace/db';
    const [id]=process.argv.slice(1),result=[];
    for(const [name,sourceUrl,linkedinUrl] of [
      ['Ancienne enseigne source','https://linkedin.com/company/ancienne-source',null],
      ['Ancienne enseigne champ',null,'https://linkedin.com/company/ancien-champ/about/?trk=old'],
    ]) {
      const saved=await pool.query("INSERT INTO prospects (company,tenant_id,source,source_url,linkedin_url,city,address) SELECT $1,tenant_id,'linkedin',$2,$3,'Roubaix','8 rue du Test 59100 Roubaix' FROM prospects WHERE id=$4 RETURNING id",[name,sourceUrl,linkedinUrl,id]);
      result.push(saved.rows[0].id);
    }
    console.log(JSON.stringify(result));await pool.end();`;
  return await new Promise((resolve,reject)=>{
    const child=spawn('node',['--import','tsx','--input-type=module','-e',code,prospectId],{cwd:join(root,'artifacts/api-server'),env:testEnv,stdio:['ignore','pipe','pipe']});
    let output='',errors='';child.stdout.on('data',chunk=>{output+=String(chunk);});child.stderr.on('data',chunk=>{errors+=String(chunk);});
    child.on('error',reject);child.on('exit',status=>{
      if(status!==0){reject(new Error('Anciennes fiches de test : '+errors.slice(-1000)));return;}
      try{resolve(JSON.parse(output.trim().split('\n').at(-1)));}catch(error){reject(error);}
    });
  });
}

async function storeTestSourcingJob(prospectId,candidates) {
  const code=String.raw`import {pool} from '@workspace/db';
    const [id,raw]=process.argv.slice(1);
    const result=await pool.query("INSERT INTO sourcing_jobs (type,name,status,params,tenant_id) SELECT 'multi','Recette liens professionnels','completed',$1,tenant_id FROM prospects WHERE id=$2 RETURNING id",[JSON.stringify({results:JSON.parse(raw)}),id]);
    console.log(result.rows[0].id);await pool.end();`;
  return await new Promise((resolve,reject)=>{
    const child=spawn('node',['--import','tsx','--input-type=module','-e',code,prospectId,JSON.stringify(candidates)],{cwd:join(root,'artifacts/api-server'),env:testEnv,stdio:['ignore','pipe','pipe']});
    let output='',errors='';child.stdout.on('data',chunk=>{output+=String(chunk);});child.stderr.on('data',chunk=>{errors+=String(chunk);});
    child.on('error',reject);child.on('exit',status=>status===0?resolve(output.trim().split('\n').at(-1)):reject(new Error('Recherche de test : '+errors.slice(-1000))));
  });
}

async function awaitApi(timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await request("GET", "/setup/status");
      if (response.status === 200) return response.body;
    } catch { /* waiting on PostgreSQL migrations and HTTP listener */ }
    await delay(500);
  }
  throw new Error("API did not start (check database migrations and startup logs)");
}

let watchVersion=0,watchDown=false,watchWrongIdentity=false,watchRequests=0,watchEmptyAddress=false,watchStale=false;
const companies = createServer((req, res) => {
  if (!req.url?.startsWith("/search?")) { res.writeHead(404).end(); return; }
  const directoryQuery = new URL(req.url, 'http://localhost').searchParams.get("q");
  if (directoryQuery?.startsWith('777000001')) {
    watchRequests++;
    if(watchDown){res.writeHead(503).end();return;}
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify({results:[{siren:watchWrongIdentity?'777000002':'777000001',nom_complet:watchVersion===3?'Entreprise de veille renommée':'Entreprise de veille',
      etat_administratif:watchVersion===1?'C':'A',nature_juridique:'1000',date_creation:'2013-10-14',
      date_fermeture:watchVersion===1?'2026-11-01':null,date_mise_a_jour:watchStale?'2020-01-01':'2026-11-25',nombre_etablissements:1,
      nombre_etablissements_ouverts:watchVersion===1?0:1,activite_principale:'43.22A',
      tranche_effectif_salarie:'01',annee_tranche_effectif_salarie:'2024',categorie_entreprise:'PME',
      dirigeants:[{nom:'Test',prenoms:watchVersion===0?'Alice':'Basma',qualite:'Gérante'}],
      finances:{2025:{ca:100000,resultat_net:0}},
      siege:{siret:'77700000100019',etat_administratif:watchVersion===1?'F':'A',activite_principale:watchVersion===3?'43.21A':'43.22A',
        adresse:watchEmptyAddress?null:watchVersion===0?'8 rue du Test 59100 Roubaix':'10 rue du Test 59100 Roubaix',code_postal:watchEmptyAddress?null:'59100',libelle_commune:watchEmptyAddress?null:'Roubaix'},
    }]}));return;
  }
  if (directoryQuery === "official-down") {
    res.writeHead(503).end(); return;
  }
  if (directoryQuery === "alias-check") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ results: [
      { siren:"200000001",nom_complet:"OULAID BEN BOUDINA (BEN PLOMBIER)",
        siege:{siret:"20000000100012",adresse:"21 RUE DE CASSEL 59100 ROUBAIX",code_postal:"59100",libelle_commune:"Roubaix"} },
      { siren:"200000002",nom_complet:"HASSAN AMJOUN (NORD PLOMBIER - NORD BRILLANCE)",
        siege:{siret:"20000000200015",adresse:"MAISON 10 95 RUE DE L'EPEULE 59100 ROUBAIX",code_postal:"59100",libelle_commune:"Roubaix"} },
    ] })); return;
  }
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ results: [
    { siren: "100000001", nom_complet: "Entreprise test A", activite_principale:"43.22A",libelle_activite_principale:"Travaux d'installation d'eau et de gaz", nomenclature_activite_principale:"NAFRev2",
      siege: { siret: "10000000100012", adresse: "10 rue Nationale, 59000 Lille", code_postal: "59000", libelle_commune: "Lille",activite_principale:"43.22A",libelle_activite_principale:"Travaux d'installation d'eau et de gaz",nomenclature_activite_principale:"NAFRev2" } },
    { siren: "100000002", nom_complet: "Entreprise test B", activite_principale:"70.10Z",libelle_activite_principale:"Activités des sièges sociaux",siege: { adresse: "Paris, France", code_postal: "75001", libelle_commune: "Paris" },
      matching_etablissements: [{ siret: "10000000200015", adresse: "20 rue du Molinel, 59000 Lille", code_postal: "59000", libelle_commune: "Lille",activite_principale:"43.21A",libelle_activite_principale:"Travaux d'installation électrique",nomenclature_activite_principale:"NAFRev2" }] },
    { siren: "100000003", nom_complet: "Entreprise hors zone", siege: { adresse: "Paris, France", code_postal: "75001", libelle_commune: "Paris" } },
    { siren: "100000004", nom_complet: "Entreprise Roubaix", siege: { siret: "10000000400018", adresse: "4 rue de Roubaix, 59100 Roubaix", code_postal: "59100", libelle_commune: "Roubaix" } },
  ] }));
});
const pagesJaunes = createServer((req, res) => {
  if (!req.url?.startsWith("/annuaire/chercherlespros?")) { res.writeHead(404).end(); return; }
  if (new URL(req.url, 'http://localhost').searchParams.get('quoiqui') === 'blocked') { res.writeHead(403).end(); return; }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<html><section id="listResults"><ul class="bi-list">
    <li class="bi bi-generic" id="epj-123"><div class="bi-content"><a class="bi-denomination" href="/pros/123"><h3>Plomberie Lille</h3></a><div class="bi-address"><a>12 rue Nationale 59000 Lille</a></div><a href="tel:0320123456">Appeler</a></div></li>
    <li class="bi bi-generic" id="epj-456"><div class="bi-content"><a class="bi-denomination" href="/pros/456"><h3>Electricité Nord</h3></a><div class="bi-address"><a>5 avenue Faidherbe 59000 Lille</a></div></div></li>
  </ul></section></html>`);
});
let browserCalls = 0;
const browserStub = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/healthz") { res.writeHead(200).end("OK"); return; }
  if (req.method !== "POST" || req.url !== "/extract") { res.writeHead(404).end(); return; }
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const params = JSON.parse(raw);
  if (typeof params.query !== "string" || typeof params.location !== "string" ||
      "url" in params) { res.writeHead(400).end(); return; }
  browserCalls++;
  if (params.query === "blocked") {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "PagesJaunes a renvoyé HTTP 403 au navigateur" }));
    return;
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<ul class="bi-list">
    <li class="bi"><a class="bi-denomination" href="/pros/123"><h3>Plomberie Lille</h3></a><div class="bi-address">12 rue Nationale 59000 Lille</div><a href="tel:0320123456">Appeler</a></li>
    <li class="bi"><a class="bi-denomination" href="/pros/456"><h3>Electricité Nord</h3></a><div class="bi-address">5 avenue Faidherbe 59000 Lille</div></li>
  </ul>`);
});
const ollama = createServer((req, res) => {
  if (req.url !== "/api/tags") { res.writeHead(404).end(); return; }
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ models: [{ name: "llama3.1:8b" }] }));
});

try {
  console.log("\nGrowthOS — tests d'installation isolés");
  await Promise.all([
    new Promise(resolve => companies.listen(companiesPort, "127.0.0.1", resolve)),
    new Promise(resolve => ollama.listen(ollamaPort, "127.0.0.1", resolve)),
    new Promise(resolve => pagesJaunes.listen(pagesJaunesPort, "127.0.0.1", resolve)),
    new Promise(resolve => browserStub.listen(browserPort, "127.0.0.1", resolve)),
  ]);
  if (!realPostgresUrl) {
    startProcess("npx", ["--yes", "@electric-sql/pglite-socket", `--db=${ephemeralDbDir}`, `--port=${dbPort}`, "--host=127.0.0.1"]);
    await delay(3000);
  }
  startProcess("node", ["artifacts/api-server/dist/index.mjs"]);

  const initial = await awaitApi();
  check(initial.needsBootstrap, "Installation vierge détectée");
  const password = "LocalOnlyPassword#123456";
  const setup = { setupToken, companyName: "Agence de test", email: "admin@wizard.invalid", password };
  check((await request("POST", "/setup/bootstrap", { ...setup, setupToken: "bad" })).status === 403,
    "Code d'installation invalide refusé");
  const admin = await request("POST", "/setup/bootstrap", setup);
  check(admin.status === 201 && !!admin.body.accessToken, "Premier administrateur créé");
  const token = admin.body.accessToken;
  const browserStatus = await request("GET", "/sourcing/sources/status", undefined, token);
  check(browserStatus.status === 200 && browserStatus.body.pagesjaunes.mode === "browser" &&
    browserStatus.body.pagesjaunes.browserReady === true,
    "L’interface peut vérifier que le navigateur local est connecté");
  check((await request("POST", "/setup/bootstrap", setup)).status === 409,
    "Seconde initialisation refusée");
  check((await request("GET", "/setup/configuration")).status === 401,
    "Configuration privée protégée");
  const configured = await request("PATCH", "/setup/configuration", {
    companyName: "Agence de test SEO", targetRegion: "Hauts-de-France",
    website: "https://example.com", dailyEmailLimit: 10,
    email: { mode: "disabled" },
  }, token);
  check(configured.status === 200, "Paramètres de l'agence enregistrés");
  check((await request("POST", "/setup/smtp/verify", {}, token)).status === 422,
    "SMTP non configuré correctement refusé");

  const defaults = await request("GET", "/setup/configuration", undefined, token);
  check(defaults.body.aiProvider === "disabled", "Aucun fournisseur IA activé par défaut");
  check((await request("PATCH", "/setup/configuration", {
    companyName: "Agence de test SEO", aiProvider: "deepseek",
  }, token)).status === 422, "Impossible d'activer une IA sans clé enregistrée");

  for (const provider of ["anthropic", "openai", "deepseek"]) {
    const saved = await request("POST", "/admin/api-keys", {
      provider, apiKey: `test-${provider}-not-for-production`,
    }, token);
    check(saved.status === 201 && !saved.body.apiKey && saved.body.apiKeyMasked.includes("…"),
      `Clé ${provider} enregistrée sans exposer son contenu`);
  }
  const cloudConfiguration = await request("GET", "/setup/configuration", undefined, token);
  check(["anthropic", "openai", "deepseek"].every(provider => cloudConfiguration.body.aiProviders.includes(provider)),
    "Trois fournisseurs IA disponibles simultanément");
  const primaryCloud = await request("PATCH", "/setup/configuration", {
    companyName: "Agence de test SEO", aiProvider: "deepseek",
  }, token);
  check(primaryCloud.status === 200, `DeepSeek défini comme fournisseur principal (HTTP ${primaryCloud.status})`);
  const effective = await request("GET", "/ai-sdr/provider-settings", undefined, token);
  check(effective.status === 200 && effective.body.activeProvider === "deepseek" &&
    effective.body.configuredProviders.includes("anthropic") && effective.body.configuredProviders.includes("openai"),
    `AI SDR lit le fournisseur principal et les connecteurs disponibles (HTTP ${effective.status}, ${JSON.stringify(effective.body)})`);

  const ollamaUrl = `http://127.0.0.1:${ollamaPort}`;
  const savedKey = await request("POST", "/admin/api-keys", {
    provider: "ollama", apiKey: "local", endpointUrl: ollamaUrl,
  }, token);
  check(savedKey.status === 201 && savedKey.body.apiKeyMasked === "****" && !savedKey.body.apiKey,
    "Identifiants IA sauvegardés sans exposer le secret");
  const testedAI = await request("POST", "/admin/api-keys/ollama/test", {
    apiKey: "local", endpointUrl: ollamaUrl,
  }, token);
  check(testedAI.status === 200 && testedAI.body.ok, "Connexion IA locale testée");
  check((await request("POST", "/setup/finish", {}, token)).status === 200,
    "Wizard finalisé");
  check((await request("GET", "/setup/configuration", undefined, token)).body.onboardingComplete,
    "État du wizard conservé en base");
  check((await request("POST", "/auth/login", {
    email: setup.email, password,
  })).status === 200, "Reconnexion administrateur réussie");
  check((await request("POST", "/auth/register", {
    email: "other@wizard.invalid", password,
  })).status === 403, "Inscription publique fermée");

  check((await request("POST", "/sourcing/jobs", {
    type: "linkedin", name: "Connecteur indisponible", params: { query: "CEO" },
  }, token)).status === 400, "Faux connecteur LinkedIn désactivé");
  const invalidGeo = await request("POST", "/sourcing/jobs", {
    type: "entreprises", name: "Zone vide", params: { query: "plombier", regions: [], departements: [], codesPostaux: [], limit: 5 },
  }, token);
  check(invalidGeo.status === 400, "Une zone géographique est obligatoire");
  const source = await request("POST", "/sourcing/jobs", {
    type: "entreprises", name: "Test Lille", params: { query: "plombier", regions: [], departements: [], codesPostaux: ["59000"], limit: 5 },
  }, token);
  check(source.status === 201 && source.body.count === 2 && source.body.status === "completed",
    "Annuaire officiel simulé : seulement 2 établissements locaux trouvés");
  const results = await request("GET", `/sourcing/jobs/${source.body.id}/results`, undefined, token);
  check(results.status === 200 && results.body.total === 2 &&
    results.body.data.every(r => r.codePostal === "59000" && !r.address.includes("Paris")),
    "Géographie stricte : le siège parisien est remplacé par son établissement lillois");
  check(results.body.data.find(r => r.siren === '100000002')?.apeCode === '43.21A' &&
    results.body.data.find(r => r.siren === '100000001')?.nafLabel?.includes('eau et de gaz'),
    'Annuaire : code APE et libellé NAF de l’établissement local transmis au sourcing');
  const multipleZones = await request("POST", "/sourcing/jobs", {
    type: "entreprises", name: "Lille et Roubaix", params: {
      query: "plombier", regions: ["32"], departements: ["59", "62"], codesPostaux: ["59000", "59100"], limit: 5,
    },
  }, token);
  check(multipleZones.status === 201 && multipleZones.body.count === 3,
    "Multi-zones : régions, départements et codes postaux acceptent plusieurs valeurs");
  const byRegion = await request("POST", "/sourcing/jobs", {
    type: "entreprises", name: "Région HDF", params: {
      query: "plombier", regions: ["32"], departements: [], codesPostaux: [], limit: 5,
    },
  }, token);
  check(byRegion.status === 201 && byRegion.body.count === 3,
    "Recherche par région sans code postal");
  const byDepartment = await request("POST", "/sourcing/jobs", {
    type: "entreprises", name: "Deux départements", params: {
      query: "plombier", regions: [], departements: ["59", "62"], codesPostaux: [], limit: 5,
    },
  }, token);
  check(byDepartment.status === 201 && byDepartment.body.count === 3,
    "Recherche par plusieurs départements sans code postal");
  const crmBeforeImport = await request("GET", "/prospects", undefined, token);
  check(crmBeforeImport.status === 200 && crmBeforeImport.body.total === 0,
    "Une recherche n'insère aucun prospect sans sélection");
  const invalidSelection = await request("POST", `/sourcing/jobs/${source.body.id}/import`,
    { sirens: ["999999999"] }, token);
  check(invalidSelection.status === 400, "Impossible d'importer une entreprise absente de la recherche");
  const selectedImport = await request("POST", `/sourcing/jobs/${source.body.id}/import`,
    { sirens: ["100000001"] }, token);
  check(selectedImport.status === 200 && selectedImport.body.imported === 1,
    "Import explicite : une seule entreprise sélectionnée est ajoutée");
  const repeatedSelection = await request("POST", `/sourcing/jobs/${source.body.id}/import`,
    { sirens: ["100000001"] }, token);
  check(repeatedSelection.status === 200 && repeatedSelection.body.imported === 0 &&
    repeatedSelection.body.skipped === 1, "SIREN déjà importé : doublon ignoré");
  const importSecond = await request("POST", `/sourcing/jobs/${source.body.id}/import`,
    { sirens: ["100000002"] }, token);
  check(importSecond.status === 200 && importSecond.body.imported === 1,
    "La seconde entreprise est importée uniquement à la demande");
  const crm = await request("GET", "/prospects", undefined, token);
  check(crm.status === 200 && crm.body.total === 2 &&
    crm.body.data.some(p => p.siren === "100000001" && p.siret === "10000000100012" && p.postalCode === "59000" && p.city === "Lille"),
    "Les prospects importés conservent leur SIREN, SIRET, code postal et ville");
  check(crm.body.data.some(p=>p.siren==='100000001' && p.apeCode==='43.22A' && p.nafLabel?.includes('eau et de gaz')) &&
    crm.body.data.some(p=>p.siren==='100000002' && p.apeCode==='43.21A' && p.nafLabel?.includes('électrique')),
    'APE et libellé NAF enregistrés sur chaque prospect, sans confondre siège et établissement');
  const filteredActivity = await request('GET','/prospects?apeCode=43.21&sortBy=apeCode&sortDir=asc',undefined,token);
  const activityLabel = await request('GET','/prospects?activitySearch=%C3%A9lectrique',undefined,token);
  check(filteredActivity.status===200 && filteredActivity.body.total===1 && filteredActivity.body.data[0].siren==='100000002' &&
    activityLabel.status===200 && activityLabel.body.total===1,
    'Filtrage serveur des prospects par code APE partiel et libellé d’activité');
  const orderedActivities = await request('GET','/prospects?apeCode=43&sortBy=apeCode&sortDir=asc',undefined,token);
  check(orderedActivities.status===200 && orderedActivities.body.total===2 &&
    orderedActivities.body.data.map(p=>p.apeCode).join(',')==='43.21A,43.22A',
    'Tri croissant des codes APE réellement effectué en base');
  const legacyActivityId = crm.body.data.find(p=>p.siren==='100000001').id;
  const clearedActivity = await request('PATCH',`/prospects/${legacyActivityId}`,{
    apeCode:'',nafLabel:'',nafVersion:''},token);
  const refreshedActivity = await request('POST',`/prospects/${legacyActivityId}/activity-enrich`,{},token);
  check(clearedActivity.status===200 && refreshedActivity.status===200 &&
    refreshedActivity.body.apeCode==='43.22A' && refreshedActivity.body.nafLabel?.includes('eau et de gaz') &&
    refreshedActivity.body.sourceDetails?.annuaire?.apeScope==='etablissement',
    'Une ancienne fiche sans APE peut récupérer le code et le libellé de son établissement officiel');
  check((await request('PATCH',`/prospects/${legacyActivityId}`,{apeCode:'code inventé'},token)).status===400,
    'Un faux code APE est refusé par la validation serveur');
  const noMockActivity = await request("GET", `/activities?prospectId=${crm.body.data[0].id}`, undefined, token);
  check(noMockActivity.status === 200 && noMockActivity.body.length === 0,
    "Une fiche prospect importée démarre sans activités ni commentaires");
  // Le navigateur local remet des fiches réelles à la page authentifiée :
  // le serveur refuse les faux domaines, les mauvais codes postaux et les doublons.
  const localParams = {sources:["pagesjaunes","entreprises"],query:"plombier",
    regions:[],departements:[],codesPostaux:["59000"],limit:5};
  const localCandidate = {id:"pj_local_testing",company:"Plomberie Locale",
    address:"12 rue de la Paix 59000 Lille Voir le plan",codePostal:"59000",city:"Lille Voir le plan",
    phone:null,website:null,sourceUrl:"https://www.pagesjaunes.fr/pros/12345678",siret:null};
  const sameNameNoPhone=await request('POST','/sourcing/device/jobs',{
    name:'Homonyme sans numéro',params:{...localParams,sources:['pagesjaunes','google_search']},
    candidates:[localCandidate],drafts:[{id:'draft_same_name_no_phone',source:'google_search',
      company:'Plomberie Locale',address:null,city:'Lille',phone:null,website:null,
      sourceUrl:'https://www.google.com/search?q=Plomberie+Locale',capturedAt:Date.now()}],
  },token);
  check(sameNameNoPhone.status===201 && sameNameNoPhone.body.count===1 &&
    sameNameNoPhone.body.params.draftEnrichment.matched===0,
    'Un nom et une ville identiques ne fusionnent pas deux fiches sans téléphone commun');
  const localMatched = {
    ...localCandidate, id:"pj_local_same_legal", company:"Entreprise test A",
    address:"10 r Nationale 59000 Lille Voir le plan",
    sourceUrl:"https://www.pagesjaunes.fr/pros/12345679",
  };
  const invalidLocal = await request("POST", "/sourcing/device/jobs", {
    name:"Rejet domaine frauduleux",params:localParams,
    candidates:[{...localCandidate,sourceUrl:"https://evilpagesjaunes.fr/pros/123"}],
  },token);
  check(invalidLocal.status === 400,"Connecteur appareil : domaine tiers rejeté");
  const allSourcesParams={...localParams,sources:['entreprises','pagesjaunes','google_maps','google_search','bing','linkedin']};
  const mapRecord={id:'local_maps_001',source:'google_maps',company:'Atelier Multi',
    address:'14 rue des Tests 59000 Lille',codePostal:'59000',city:'Lille',phone:null,
    website:'https://atelier.example.org',sourceUrl:'https://www.google.com/maps/place/Atelier+Multi',siret:null,
    collectionMode:'visible'};
  const bingRecord={...mapRecord,id:'local_bing_001',source:'bing',
    sourceUrl:'https://www.bing.com/search?q=Atelier+Multi'};
  const searchRecord={...mapRecord,id:'local_search_001',source:'google_search',
    company:'Boulangerie Recherche',address:'8 avenue des Artisans 59000 Lille',
    sourceUrl:'https://www.google.com/search?q=Boulangerie+Recherche'};
  const linkedRecord={...mapRecord,id:'local_linked_001',source:'linkedin',collectionMode:'manual',
    company:'Entreprise LinkedIn',address:'31 avenue du Parc 59000 Lille',
    sourceUrl:'https://www.linkedin.com/company/entreprise-linkedin/'};
  const forgedGoogle=await request('POST','/sourcing/device/jobs',{
    name:'Google falsifié',params:allSourcesParams,
    candidates:[{...mapRecord,sourceUrl:'https://google.com.evil.example/maps/place/123'}],
  },token);
  check(forgedGoogle.status===400,'Le serveur refuse les faux domaines Google Maps');
  const scrapedLinkedIn=await request('POST','/sourcing/device/jobs',{
    name:'LinkedIn automatique',params:allSourcesParams,
    candidates:[{...linkedRecord,collectionMode:'visible'}],
  },token);
  check(scrapedLinkedIn.status===400,'Le serveur refuse un profil LinkedIn extrait automatiquement');
  const googleDraft={id:'draft_google_001',source:'google_search',company:'Entreprise test A',
    address:null,city:'Lille',phone:'03 20 00 00 01',website:null,
    sourceUrl:'https://www.google.com/search?q=Entreprise+test+A',capturedAt:Date.now()};
  const genericDraft={...googleDraft,id:'draft_google_generic',company:'Plombier',phone:null};
  const unverifiedDraftJob=await request('POST','/sourcing/device/jobs',{
    name:'Identification Google sans adresse',
    params:{...localParams,sources:['google_search']},candidates:[],drafts:[googleDraft,genericDraft],
  },token);
  check(unverifiedDraftJob.status===201 && unverifiedDraftJob.body.count===1 &&
    unverifiedDraftJob.body.params.draftEnrichment.matched===1 &&
    unverifiedDraftJob.body.params.draftEnrichment.pending===1,
    'Les brouillons Google sont rapprochés de l’annuaire officiel sans inventer d’adresse');
  const unverifiedDraftPreview=await request('GET',`/sourcing/jobs/${unverifiedDraftJob.body.id}/results`,undefined,token);
  check(unverifiedDraftPreview.body.data.length===1 &&
    unverifiedDraftPreview.body.data[0].siren==='100000001' &&
    unverifiedDraftPreview.body.data[0].sources.includes('google_search') &&
    unverifiedDraftPreview.body.data[0].imported &&
    unverifiedDraftPreview.body.data[0].prospectId,
    'La fiche Google vérifiée retrouve le prospect déjà importé sans le recréer');
  const crmAfterDraft=await request('GET','/prospects',undefined,token);
  check(crmAfterDraft.body.total===2,'Le rapprochement automatique ne crée aucun prospect dans le CRM');
  const recheckDrafts=await request('POST',`/sourcing/device/jobs/${unverifiedDraftJob.body.id}/enrich-drafts`,{
    drafts:[googleDraft,genericDraft],
  },token);
  check(recheckDrafts.status===200 && recheckDrafts.body.job.count===1 &&
    recheckDrafts.body.enrichment.matched===1 && recheckDrafts.body.enrichment.pending===1,
    'Le nouvel enrichissement de fiches Google ne crée aucun doublon');
  const forgedDraft=await request('POST','/sourcing/device/jobs',{
    name:'Brouillon frauduleux',params:{...localParams,sources:['google_search']},
    candidates:[],drafts:[{...googleDraft,sourceUrl:'https://google.com.evil.example/fiche'}],
  },token);
  check(forgedDraft.status===400,'Le serveur refuse les brouillons dont la source ne correspond pas au domaine');
  const wrongCityDraft=await request('POST','/sourcing/device/jobs',{
    name:'Brouillon hors ville',params:{...localParams,sources:['google_search']},candidates:[],
    drafts:[{...googleDraft,id:'draft_wrong_city',city:'Paris'}],
  },token);
  check(wrongCityDraft.status===201 && wrongCityDraft.body.count===0 &&
    wrongCityDraft.body.params.draftEnrichment.pending===1,
    'Une entreprise de Paris ne peut pas être rapprochée d’une homonyme de Lille');
  const multiDevice=await request('POST','/sourcing/device/jobs',{
    name:'Multisource Chrome local',params:allSourcesParams,
    candidates:[localCandidate,mapRecord,bingRecord,searchRecord,linkedRecord],
  },token);
  check(multiDevice.status===201 && multiDevice.body.count>=5 &&
    ['pagesjaunes','google_maps','google_search','bing','linkedin','entreprises']
      .every(s=>multiDevice.body.params.sourceStatuses[s]?.status==='completed'),
    'Six sources acceptées indépendamment, sans import automatique');
  const multiDevicePreview=await request('GET',`/sourcing/jobs/${multiDevice.body.id}/results`,undefined,token);
  const atelier=multiDevicePreview.body.data.find(item=>item.company==='Atelier Multi');
  check(atelier?.sources?.includes('google_maps') && atelier?.sources?.includes('bing') &&
    !atelier.imported && multiDevicePreview.body.data.filter(item=>item.company==='Atelier Multi').length===1,
    'Google Maps et Bing fusionnent le même établissement sans doublon');
  const missingLinkedin=await request('POST','/sourcing/device/jobs',{
    name:'LinkedIn pas encore saisi',params:allSourcesParams,candidates:[mapRecord],
  },token);
  check(missingLinkedin.status===201 && missingLinkedin.body.params.sourceStatuses.linkedin.status==='pending',
    'Une source non collectée est présentée comme à collecter, et non comme réussie');
  const partialDevice=await request('POST','/sourcing/device/jobs',{
    name:'PagesJaunes bloqué mais Google capturé',params:allSourcesParams,
    candidates:[mapRecord],sourceErrors:{pagesjaunes:'Vérification manuelle nécessaire'},
  },token);
  check(partialDevice.status===201 && partialDevice.body.params.sourceStatuses.pagesjaunes.status==='error' &&
    partialDevice.body.params.sourceStatuses.google_maps.status==='completed' &&
    partialDevice.body.error.includes('Vérification manuelle'),
    'Un blocage PagesJaunes ne dissimule pas l’échec et ne supprime pas les autres sources');
  const localJob = await request("POST", "/sourcing/device/jobs", {
    name:"Recherche Chrome locale",params:localParams,
    candidates:[localCandidate,localCandidate,localMatched,{...localCandidate,id:"pj_local_far",company:"Hors zone",address:"Paris 75001",codePostal:"75001"}],
  },token);
  check(localJob.status === 201 && localJob.body.status === "completed" && localJob.body.count === 3,
    "Connecteur appareil : fusion Annuaire + PagesJaunes sans doublon ni entreprise hors zone");
  const localPreview = await request("GET", `/sourcing/jobs/${localJob.body.id}/results`,undefined,token);
  check(localPreview.status === 200 && localPreview.body.total === 3 &&
    localPreview.body.data.some(row=>row.source === "pagesjaunes" && row.company === "Plomberie Locale"),
    "Connecteur appareil : résultats visibles avant import CRM");
  const mergedLegal = localPreview.body.data.find(row => row.company === "Entreprise test A");
  check(mergedLegal?.id === localMatched.id && mergedLegal.siren === "100000001" &&
    mergedLegal.siret === "10000000100012" &&
    mergedLegal.sourceUrl === localMatched.sourceUrl &&
    mergedLegal.sources.includes("pagesjaunes") && mergedLegal.sources.includes("entreprises") &&
    localPreview.body.data.filter(row => row.company === "Entreprise test A").length === 1,
    "Même société sans SIREN PagesJaunes : fusion vérifiée par nom, rue et code postal et identifiants officiels conservés");

  const conflictingIdentity = await request("POST", "/sourcing/device/jobs", {
    name:"Numéros contradictoires", params:localParams,
    candidates:[{...localMatched,id:"pj_local_conflict",siret:"90000000900010"}],
  }, token);
  check(conflictingIdentity.status === 201 && conflictingIdentity.body.count === 3,
    "Deux SIREN contradictoires ne sont jamais fusionnés sur le seul nom et la seule adresse");

  const aliasParams = {...localParams,query:"alias-check",codesPostaux:["59100"]};
  const benPlombier = {...localCandidate,id:"pj_local_ben",company:"Ben Plombier",
    address:"21 rue Cassel 59100 Roubaix",city:"Roubaix",codePostal:"59100",
    sourceUrl:"https://www.pagesjaunes.fr/pros/22000001"};
  const nordBrillance = {...localCandidate,id:"pj_local_nord",company:"Nord Plombier - Nord Brillance",
    address:"95 rue Epeule 59100 Roubaix",city:"Roubaix",codePostal:"59100",
    sourceUrl:"https://www.pagesjaunes.fr/pros/22000002"};
  const aliasJob = await request("POST", "/sourcing/device/jobs", {
    name:"Enseignes locales et noms juridiques",params:aliasParams,
    candidates:[benPlombier,nordBrillance],
  },token);
  check(aliasJob.status === 201 && aliasJob.body.count === 2 &&
    aliasJob.body.params.sourceStatuses.pagesjaunes.count === 2 &&
    aliasJob.body.params.sourceStatuses.entreprises.count === 2,
    "Deux enseignes rapprochées à deux identités légales par alias exact et rue malgré variations d'adresse");
  const aliasResults = await request("GET", `/sourcing/jobs/${aliasJob.body.id}/results`,undefined,token);
  const mergedBen = aliasResults.body.data?.find(row => row.company === "Ben Plombier");
  const mergedNord = aliasResults.body.data?.find(row => row.company === "Nord Plombier - Nord Brillance");
  check(aliasResults.body.total === 2 &&
    mergedBen?.id === benPlombier.id && mergedBen.siren === "200000001" &&
    mergedBen.siret === "20000000100012" && mergedBen.sourceUrl === benPlombier.sourceUrl &&
    mergedNord?.id === nordBrillance.id && mergedNord.siren === "200000002" &&
    mergedNord.siret === "20000000200015" &&
    [mergedBen,mergedNord].every(row =>
      row?.sources?.includes("pagesjaunes") && row?.sources?.includes("entreprises") && !row.imported),
    "Enseignes PagesJaunes conservées, SIREN/SIRET officiels ajoutés, provenance double et aucun import automatique");

  const noStreetMatch = await request("POST", "/sourcing/device/jobs", {
    name:"Adresse différente : ne pas fusionner",params:aliasParams,
    candidates:[{...benPlombier,id:"pj_local_wrongstreet",address:"21 avenue Cassel 59100 Roubaix"}],
  },token);
  check(noStreetMatch.status === 201 && noStreetMatch.body.count === 3,
    "Nom commercial exact mais voie différente : aucun rapprochement hasardeux");

  const noAliasMatch = await request("POST", "/sourcing/device/jobs", {
    name:"Nom approximatif : ne pas fusionner",params:aliasParams,
    candidates:[{...benPlombier,id:"pj_local_wrongname",company:"Ben Plomberie"}],
  },token);
  check(noAliasMatch.status === 201 && noAliasMatch.body.count === 3,
    "Nom ressemblant mais non identique à l'enseigne juridique : aucun rapprochement approximatif");

  const unavailableOfficial = await request("POST", "/sourcing/device/jobs", {
    name:"Annuaire temporairement indisponible",
    params:{...localParams,query:"official-down"},candidates:[localCandidate],
  },token);
  check(unavailableOfficial.status === 201 && unavailableOfficial.body.status === "completed" &&
    unavailableOfficial.body.count === 1 &&
    unavailableOfficial.body.params.sourceStatuses.pagesjaunes.status === "completed" &&
    unavailableOfficial.body.params.sourceStatuses.entreprises.status === "error" &&
    unavailableOfficial.body.error.includes("503"),
    "Une erreur de l'Annuaire ne supprime pas les résultats PagesJaunes collectés sur l'appareil");

  const detailedCandidate = {sourceUrl:"https://www.pagesjaunes.fr/pros/12345678",
    name:"Plomberie Locale",address:"12 rue de la Paix 59000 Lille",codePostal:"59000",city:"Lille",
    phone:"0320123456",email:null,website:"https://example.org",
    siret:null,siren:null,description:"Plomberie et dépannage de proximité",
    openingHours:"Lundi au vendredi 9h-18h",services:"Dépannage, entretien",
    legal:null,socials:{facebook:"https://www.facebook.com/exampleorg"},
    rating:4.7,reviewCount:12,reviews:[{
      author:"Avis de test",date:"2026-11-20",
      text:"Intervention soignée et prestation réalisée dans les délais annoncés.",
    }],capturedAt:new Date().toISOString()};
  const mismatchedDetailed = await request("POST", `/sourcing/device/jobs/${localJob.body.id}/enrich`, {
    candidateId:localCandidate.id,profile:{...detailedCandidate,sourceUrl:"https://www.pagesjaunes.fr/pros/88888888"},
  },token);
  check(mismatchedDetailed.status===409,"Fiche détaillée étrangère rejetée avant import");
  const updatedDetail = await request("POST", `/sourcing/device/jobs/${localJob.body.id}/enrich`, {
    candidateId:localCandidate.id,profile:detailedCandidate,
  },token);
  check(updatedDetail.status===200 && updatedDetail.body.phone==="0320123456" &&
    updatedDetail.body.sourceDetails.pagesjaunes.rating===4.7 &&
    updatedDetail.body.sourceDetails.pagesjaunes.reviews.length===1,
    "Note et avis structurés enregistrés avant sélection");
  const selectedDetailed = await request("POST", `/sourcing/jobs/${localJob.body.id}/import`, {
    ids:[localCandidate.id],
  },token);
  check(selectedDetailed.status===200 && selectedDetailed.body.imported===1,
    "Une fiche détaillée n'est importée dans le CRM qu'après confirmation");
  const enrichedRows = await request("GET","/prospects?search=Plomberie%20Locale",undefined,token);
  const enrichedProspect = enrichedRows.body.data?.find(p=>p.company==="Plomberie Locale");
  check(enrichedProspect?.phone==="0320123456" &&
    enrichedProspect?.sourceDetails?.pagesjaunes?.openingHours?.includes("9h-18h") && enrichedProspect.city === "Lille",
    "Téléphone et horaires source conservés dans le CRM");
  const revisited = await request("POST", `/sourcing/device/prospects/${enrichedProspect.id}/enrich`, {
    profile:{...detailedCandidate,phone:"0320999999",description:"Fiche actualisée"},
  },token);
  check(revisited.status===200 && revisited.body.phone==="0320123456" &&
    revisited.body.sourceDetails.pagesjaunes.description==="Fiche actualisée" &&
    revisited.body.sourceDetails.pagesjaunes.reviews.length===1,
    "Actualisation d'une fiche existante sans écraser un téléphone déjà renseigné");

  const pjSearch = await request("POST", "/sourcing/jobs", {
    type: "pagesjaunes", name: "Plombiers Lille via HTML", params: { query: "plombier", location: "Lille", limit: 10 },
  }, token);
  check(pjSearch.status === 201 && pjSearch.body.count === 2,
    "PagesJaunes HTML : deux fiches détectées sur une page simulée");
  const pjResults = await request("GET", `/sourcing/jobs/${pjSearch.body.id}/results`, undefined, token);
  check(pjResults.status === 200 && pjResults.body.data.length === 2 &&
    pjResults.body.data[0].id.startsWith("pj_") && pjResults.body.data[0].phone === "0320123456",
    "PagesJaunes : résultat vérifiable, téléphone réellement présent et identifiant source");
  const pjImport = await request("POST", `/sourcing/jobs/${pjSearch.body.id}/import`,
    { ids: [pjResults.body.data[0].id] }, token);
  check(pjImport.status === 200 && pjImport.body.imported === 1,
    "PagesJaunes : choix explicite, une seule fiche importée sans SIREN inventé");
  const pjRepeat = await request("POST", `/sourcing/jobs/${pjSearch.body.id}/import`,
    { ids: [pjResults.body.data[0].id] }, token);
  check(pjRepeat.status === 200 && pjRepeat.body.imported === 0 && pjRepeat.body.skipped === 1,
    "PagesJaunes : un deuxième import est reconnu comme doublon");
  const pjCrm = await request("GET", "/prospects?search=Plomberie", undefined, token);
  const legacyPj = pjCrm.body.data?.find(row => row.company === "Plomberie Lille" &&
    String(row.sourceUrl||'').endsWith('/pros/123'));
  check(legacyPj?.source?.split(',').includes('pagesjaunes') && legacyPj.siren === null &&
    legacyPj.sourceUrl.endsWith("/pros/123"),
    "CRM : provenance conservée et aucun identifiant légal fictif");
  const multi = await request("POST", "/sourcing/jobs", {
    type: "multi", name: "Deux sources", params: {
      sources: ["entreprises", "pagesjaunes"], query: "plombier",
      regions: [], departements: [], codesPostaux: ["59000"], limit: 5,
    },
  }, token);
  check(multi.status === 202 && multi.body.status === "running",
    "Recherche multisource créée sans bloquer la requête HTTP");
  const multiDone = await awaitSourcingJob(multi.body.id, token);
  check(multiDone.status === "completed" && multiDone.params.sourceStatuses.entreprises.status === "completed" &&
    multiDone.params.sourceStatuses.pagesjaunes.status === "completed" && multiDone.count >= 3,
    "Deux fournisseurs traités indépendamment avec résultats regroupés");
  const multiPreview = await request("GET", `/sourcing/jobs/${multi.body.id}/results`, undefined, token);
  check(multiPreview.body.data.some(p => p.sources?.includes("pagesjaunes")) &&
    multiPreview.body.data.some(p => p.sources?.includes("entreprises")),
    "Prévisualisation conserve l'origine de chaque résultat");
  const partial = await request("POST", "/sourcing/jobs", {
    type: "multi", name: "Tolérance aux erreurs", params: {
      sources: ["entreprises", "pagesjaunes"], query: "blocked",
      regions: [], departements: [], codesPostaux: ["59000"], limit: 5,
    },
  }, token);
  const partialDone = await awaitSourcingJob(partial.body.id, token);
  check(partialDone.status === "completed" && partialDone.count === 2 &&
    partialDone.params.sourceStatuses.pagesjaunes.status === "error" &&
    partialDone.params.sourceStatuses.pagesjaunes.error.includes("403"),
    "Un refus PagesJaunes HTTP 403 n'efface pas les résultats de l'annuaire");
  check(browserCalls >= 3,
    "La recherche PagesJaunes passe par le navigateur autonome sur le réseau Docker");
  const browserSearch = await request("POST", "/sourcing/jobs", {
    type: "multi", name: "Navigateur maison", params: {
      sources: ["entreprises", "pagesjaunes"], query: "browser-ok",
      regions: [], departements: [], codesPostaux: ["59000"], limit: 5,
    },
  }, token);
  const browserDone = await awaitSourcingJob(browserSearch.body.id, token);
  check(browserSearch.status === 202 && browserDone.status === "completed" &&
    browserDone.params.sourceStatuses.pagesjaunes.status === "completed" &&
    browserDone.count >= 3,
    "Le navigateur privé renvoie des entreprises sans service cloud externe");
  const realComment = await request("POST", "/activities", {
    prospectId: crm.body.data[0].id, type: "comment",
    title: "Commentaire", description: "Message réel de suivi", status: "done",
  }, token);
  const actualHistory = await request("GET", `/activities?prospectId=${crm.body.data[0].id}`, undefined, token);
  check(realComment.status === 201 && actualHistory.body.length === 1 &&
    actualHistory.body[0].description === "Message réel de suivi",
    "Un commentaire enregistré est réellement relu depuis la base");
  const csvRows = [
    { firstName: "Alice", lastName: "Import", email: "alice.csv@example.com", status: "new" },
    { firstName: "Alice", lastName: "Bis", email: "ALICE.CSV@example.com", status: "new" },
    { firstName: "Bob", lastName: "Import", email: "bob.csv@example.com", status: "contacted" },
  ];
  const firstImport = await request("POST", "/prospects/bulk",
    { prospects: csvRows, duplicateMode: "skip" }, token);
  check(firstImport.status === 201 && firstImport.body.imported === 2 &&
    firstImport.body.duplicates === 1 && firstImport.body.skipped === 1,
    "Import CSV : doublon dans le fichier ignoré");
  const repeatImport = await request("POST", "/prospects/bulk",
    { prospects: [csvRows[0], csvRows[2]], duplicateMode: "skip" }, token);
  check(repeatImport.status === 201 && repeatImport.body.imported === 0 &&
    repeatImport.body.duplicates === 2 && repeatImport.body.skipped === 2,
    "Import CSV : doublons déjà présents en base ignorés");
  const updateImport = await request("POST", "/prospects/bulk", {
    prospects: [{ ...csvRows[0], company: "Entreprise mise à jour" }],
    duplicateMode: "update",
  }, token);
  const changedProspect = await request("GET", "/prospects?search=alice.csv%40example.com", undefined, token);
  check(updateImport.status === 201 && updateImport.body.updated === 1 &&
    updateImport.body.imported === 0 && changedProspect.body.data?.[0]?.company === "Entreprise mise à jour",
    "Import CSV : mise à jour d'un doublon réellement persistée");
  const invalidImport = await request("POST", "/prospects/bulk", {
    prospects: [{ firstName: "Invalid", email: "not-an-email", status: "new" }],
  }, token);
  check(invalidImport.status === 400, "Import CSV : email invalide refusé sans insertion");

  // Le pipeline contient des opportunités commerciales liées au CRM,
  // pas automatiquement tous les prospects dont le statut est "qualified".
  const importedId = changedProspect.body.data?.[0]?.id;
  check(Boolean(importedId), "Un prospect importé possède un identifiant CRM");
  const qualifiedProspect = await request("PATCH", `/prospects/${importedId}`, { status: "qualified" }, token);
  check(qualifiedProspect.status === 200 && qualifiedProspect.body.status === "qualified",
    "Qualification du prospect conservée");
  const pipelineBefore = await request("GET", "/pipeline", undefined, token);
  check(pipelineBefore.status === 200 && pipelineBefore.body.length === 0,
    "Le pipeline est vide tant qu'aucun deal n'a été créé");

  const linkedDeal = await request("POST", "/pipeline", {
    prospectId: importedId, title: "Refonte site + SEO", value: 1800,
    stage: "qualified", probability: 40, priority: "high",
    notes: "Prospect issu de l'import CSV",
  }, token);
  check(linkedDeal.status === 201 && linkedDeal.body.prospectId === importedId &&
    linkedDeal.body.company === "Entreprise mise à jour" &&
    linkedDeal.body.prospect === "Alice Import" &&
    linkedDeal.body.priority === "high" && linkedDeal.body.notes === "Prospect issu de l'import CSV",
    "Création d'un deal : lien CRM, contact, entreprise, priorité et notes persistés");
  const linkedList = await request("GET", `/pipeline?prospectId=${importedId}`, undefined, token);
  check(linkedList.status === 200 && linkedList.body.length === 1 &&
    linkedList.body[0].id === linkedDeal.body.id,
    "La fiche prospect retrouve uniquement ses deals liés");
  const updatedDeal = await request("PATCH", `/pipeline/${linkedDeal.body.id}`, {
    stage: "proposal", priority: "low", notes: "Devis envoyé",
  }, token);
  check(updatedDeal.status === 200 && updatedDeal.body.prospectId === importedId &&
    updatedDeal.body.stage === "proposal" && updatedDeal.body.priority === "low" &&
    updatedDeal.body.notes === "Devis envoyé",
    "Mise à jour d'un deal sans perte du lien prospect");
  const missingProspectDeal = await request("POST", "/pipeline", {
    prospectId: "00000000-0000-4000-8000-000000000001",
    title: "Prospect inexistant", value: 100,
  }, token);
  check(missingProspectDeal.status === 404, "Un deal ne peut pas être lié à un prospect inexistant");

  const convertedDeal = await request("POST", "/pipeline/from-prospect", {
    prospectId: importedId, title: "Audit SEO", value: 300, priority: "medium",
  }, token);
  const convertedProspect = await request("GET", `/prospects/${importedId}`, undefined, token);
  check(convertedDeal.status === 201 && convertedDeal.body.prospectId === importedId &&
    convertedProspect.body.status === "converted",
    "Conversion depuis la fiche prospect : deal lié et statut converti");



  const enrichmentSources = await request("GET", "/enrich/sources", undefined, token);
  check(enrichmentSources.status === 200 && enrichmentSources.body.some(s => s.id === "google_news" && s.implemented) &&
    enrichmentSources.body.some(s => s.id === "linkedin" && !s.implemented && !s.isActive),
    "Enrichissement : connecteurs réels distingués des sources non implémentées");
  check((await request("PUT", "/enrich/api-config/hunter", { apiKey: "secret" }, token)).status === 410,
    "Ancienne configuration globale des clés désactivée");
  check((await request("POST", "/enrich/test-connection/hunter", {}, token)).status === 501,
    "Aucun faux test de connexion réussi");
  check((await request("POST", "/enrich/batch", { prospectIds: [crm.body.data[0].id] }, token)).status === 501,
    "Enrichissement asynchrone sans file persistante désactivé");
  check((await request("POST", "/seo-audit/check", { url: "https://127.0.0.1/admin" }, token)).status === 400,
    "Inspection SEO : accès aux adresses internes refusé");
  check((await request("POST", "/seo-audit/check", { url: "https://example.org" })).status === 401,
    "Inspection SEO réservée aux utilisateurs authentifiés");
  check((await request("POST", "/meetings", { title: "Réunion sans audio" }, token)).status === 501,
    "Aucune transcription de réunion inventée");

  const sequence = await request("POST", "/sequences", {
    name: "Brouillon de test", status: "draft", steps: [],
  }, token);
  check(sequence.status === 201, "Brouillon de séquence enregistré");
  check((await request("POST", `/sequences/${sequence.body.id}/toggle`, {}, token)).status === 409,
    "Activation prématurée de séquence refusée");
  check((await request("POST", `/sequences/${sequence.body.id}/events`, { type: "reply" }, token)).status === 501,
    "Aucune fausse réponse email injectée par une API non vérifiée");
  check((await request("POST", `/email/sequences/${sequence.body.id}/launch`, {}, token)).status === 409,
    "Envoi sans gestion du désabonnement bloqué");
  check((await request("POST", "/email/send", {
    to: "receiver@wizard.invalid", subject: "Test", html: "<p>Test</p>",
  }, token)).status === 409, "Aucun email externe envoyé par défaut");

  const audit = await request("GET", "/audit/deep?force=true", undefined, token);
  check(audit.status === 202 && audit.body.status === "running" &&
    typeof audit.body.progress?.completed === "number",
    "Audit profond lancé sans bloquer la requête HTTP");
  const running = await request("GET", "/audit/deep", undefined, token);
  check(["running", "complete"].includes(running.body.status),
    "Statut de l'audit consultable sans relancer de scan");

  let audited = running.body;
  const auditDeadline = Date.now() + 30000;
  while (audited.status === "running" && Date.now() < auditDeadline) {
    await delay(300);
    audited = (await request("GET", "/audit/deep", undefined, token)).body;
  }
  check(audited.status === "complete", "Audit profond terminé avec un rapport structuré");
  check(audited.report.backend.routesDiscovered >= 250 &&
    audited.report.backend.routesTested >= 10,
    "Inventaire de routes Express 5 complet, distinct des lectures réellement vérifiées");
  check(audited.report.backend.routesTested + audited.report.backend.routesSkipped ===
    audited.report.backend.routesDiscovered,
    "Compteurs de couverture cohérents : vérifiées + non testées = recensées");
  check(audited.report.assessment === "partial" && audited.report.healthScore === null &&
    audited.report.backend.coveragePct < 100,
    "Un audit partiel ne se présente jamais comme un faux 100/100");
  check(audited.report.backend.routesByMethod.POST >= 80 &&
    audited.report.backend.moduleCoverage.some(m => m.module === "prospects" && m.tested > 0) &&
    audited.report.backend.untestedRoutes.some(r => r.method === "POST" && r.route === "/api/v1/prospects"),
    "Inventaire par méthode et module, écritures explicitement non testées");
  const verified = audited.report.backend;
  console.log(`  Couverture réelle : ${verified.routesTested}/${verified.routesDiscovered} (${verified.coveragePct}%), ${verified.routesOk} contrôles OK`);
  for (const route of verified.brokenRoutes) {
    console.log(`  ⚠ ${route.method} ${route.route}: HTTP ${route.status} — ${route.error ?? "validation échouée"}`);
  }
  check(verified.routesTested >= 35, "Modules CRM, tâches, mémoire, autopilot, IA et revenus inclus dans les sondes");
  if (realPostgresUrl) {
    check(verified.routes5xx === 0 && verified.contractErrors === 0 && verified.routes4xx === 0,
      "Aucun code d'erreur ou contrat de réponse invalide sur PostgreSQL 16");
  } else if (verified.brokenRoutes.length > 0) {
    console.log("  Note : le simulateur PGlite ne supporte pas toutes les lectures SQL concurrentes ; les erreurs sont vérifiées séparément dans la CI PostgreSQL 16.");
  }
  const prospectProbe = audited.report.backend.allRoutes.find(r => r.route === "/api/v1/prospects");
  check(prospectProbe?.status === 200 && prospectProbe.passed,
    `Route CRM avec tenant administrateur : HTTP ${prospectProbe?.status ?? 'absent'} (${prospectProbe?.error ?? 'aucun détail'})`);

  const incompleteDraft={id:'draft_incomplete_persisted',source:'google_search',
    company:'Enseigne Locale Provisoire',address:null,city:'Lille',phone:'03 20 55 44 33',website:null,
    sourceUrl:'https://www.google.com/search?q=Enseigne+Locale+Provisoire',capturedAt:Date.now()};
  const provisional=await request('POST','/sourcing/device/jobs',{
    name:'Piste commerciale sans adresse',
    params:{...localParams,sources:['google_search']},candidates:[],drafts:[incompleteDraft],
  },token);
  check(provisional.status===201 && provisional.body.params.deviceDrafts?.length===1 &&
    provisional.body.params.draftEnrichment?.pending===1,
    'Les pistes incomplètes sont conservées hors CRM, disponibles après validation');
  const forgedImport=await request('POST',`/sourcing/device/jobs/${provisional.body.id}/import-drafts`,
    {ids:['draft_foreign_company']},token);
  check(forgedImport.status===400,'Une fiche non issue de la recherche ne peut pas être importée');
  const provisionalImport=await request('POST',`/sourcing/device/jobs/${provisional.body.id}/import-drafts`,
    {ids:[incompleteDraft.id]},token);
  check(provisionalImport.status===200&&provisionalImport.body.imported===1,
    'Import provisoire seulement sur sélection explicite');
  const savedProvisional=await request('GET',`/sourcing/jobs/${provisional.body.id}`,undefined,token);
  const provisionalId=savedProvisional.body.params.draftImports?.[incompleteDraft.id];
  const provisionalProspect=await request('GET',`/prospects/${provisionalId}`,undefined,token);
  check(provisionalProspect.status===200 && provisionalProspect.body.company===incompleteDraft.company &&
    provisionalProspect.body.phone===incompleteDraft.phone &&
    !provisionalProspect.body.postalCode && !provisionalProspect.body.siret &&
    !provisionalProspect.body.siren && !provisionalProspect.body.sourceUrl &&
    provisionalProspect.body.sourceDetails?.browserDraft?.incomplete===true,
    'L’import provisoire ne crée aucun identifiant, code postal ou lien de fiche fictif');
  const repeatedProvisional=await request('POST',`/sourcing/device/jobs/${provisional.body.id}/import-drafts`,
    {ids:[incompleteDraft.id]},token);
  check(repeatedProvisional.status===200&&repeatedProvisional.body.imported===0&&
    repeatedProvisional.body.skipped===1,'Import provisoire répété : aucun doublon');

  const directCapture={id:'local_direct_verified_01',source:'google_maps',
    company:'Atelier Direct Roubaix',address:'22 Rue du Test 59100 Roubaix',codePostal:'59100',
    city:'Roubaix',phone:'03 20 12 34 99',website:null,siret:null,
    sourceUrl:'https://www.google.com/maps/place/Atelier-Direct-Roubaix',
    capturedAt:Date.now(),collectionMode:'visible'};
  const directDraft={id:'draft_direct_incomplete_01',source:'google_search',
    company:'Service Direct Incomplet',address:null,city:'Lille',phone:'03 20 90 89 88',website:null,
    sourceUrl:'https://www.google.com/search?q=Service+Direct+Incomplet',capturedAt:Date.now()};
  const directImport=await request('POST','/sourcing/device/import-prospects',{
    verified:[directCapture],drafts:[directDraft],
  },token);
  check(directImport.status===200 && directImport.body.imported===2 &&
    directImport.body.processedIds.includes(directCapture.id) &&
    directImport.body.processedIds.includes(directDraft.id),
  'L’extension importe directement deux fiches dans Prospects, même sans sourcing');
  const directRepeated=await request('POST','/sourcing/device/import-prospects',{
    verified:[directCapture],drafts:[directDraft],
  },token);
  check(directRepeated.status===200 && directRepeated.body.imported===0 && directRepeated.body.skipped===2,
    'Import direct répété : pas de doublons dans le CRM');
  const siteAddition={...directCapture,id:'local_website_enrichment_02',source:'google_search',
    sourceUrl:'https://www.google.com/search?q=Atelier+Direct+Roubaix',
    website:'https://atelier-direct-roubaix.fr'};
  const mergedDirect=await request('POST','/sourcing/device/import-prospects',{
    verified:[siteAddition],drafts:[],
  },token);
  check(mergedDirect.status===200&&mergedDirect.body.imported===0&&mergedDirect.body.enriched===1,
    'Le doublon enrichit le site web absent sans créer un deuxième prospect');
  const conflictAddition={...siteAddition,id:'local_conflict_bing_03',source:'bing',
    sourceUrl:'https://www.bing.com/search?q=Atelier+Direct+Roubaix',
    phone:'03 20 99 88 77',website:'https://autre-atelier.fr'};
  const conflictingDirect=await request('POST','/sourcing/device/import-prospects',{
    verified:[conflictAddition],drafts:[],
  },token);
  check(conflictingDirect.status===200&&conflictingDirect.body.imported===0&&
    conflictingDirect.body.conflicts===2&&conflictingDirect.body.reviews?.length===1,
    'Des coordonnées contradictoires sont signalées, sans écraser les données CRM');
  const matchedDirect=await request('GET','/prospects?search=Atelier%20Direct%20Roubaix',undefined,token);
  const joinedProspects=(matchedDirect.body.data||[]).filter(p=>p.company===directCapture.company);
  check(joinedProspects.length===1&&joinedProspects[0].phone===directCapture.phone&&
    joinedProspects[0].website===siteAddition.website&&
    joinedProspects[0].sourceDetails?.crossSource?.conflicts?.length===2&&
    joinedProspects[0].sourceDetails?.crossSource?.observations?.length===3,
    'Fiche CRM unique, sources historisées et conflits préservés');
  const prospectId=joinedProspects[0].id;
  const [phoneConflict,websiteConflict]=joinedProspects[0].sourceDetails.crossSource.conflicts;
  const useOther=await request('POST',`/sourcing/device/prospects/${prospectId}/resolve-conflict`,{
    conflictId:phoneConflict.id,decision:'use_incoming',
  },token);
  check(useOther.status===200&&useOther.body.prospect.phone===conflictAddition.phone,
    'La décision humaine peut remplacer seulement le téléphone choisi');
  const keepOld=await request('POST',`/sourcing/device/prospects/${prospectId}/resolve-conflict`,{
    conflictId:websiteConflict.id,decision:'keep_existing',
  },token);
  check(keepOld.status===200&&keepOld.body.prospect.website===siteAddition.website&&
    keepOld.body.prospect.sourceDetails?.crossSource?.conflicts?.length===0&&
    keepOld.body.prospect.sourceDetails?.crossSource?.resolutions?.length===2,
    'La décision humaine conserve la valeur voulue et archive le choix');
  const forgedChoice=await request('POST',`/sourcing/device/prospects/${prospectId}/resolve-conflict`,{
    conflictId:phoneConflict.id,decision:'use_incoming',
  },token);
  check(forgedChoice.status===404,'Une résolution de conflit ne peut pas être rejouée');
  const directInvalid=await request('POST','/sourcing/device/import-prospects',{
    verified:[],drafts:[{...directDraft,id:'draft_empty_01',address:null,phone:null,website:null}],
  },token);
  check(directInvalid.status===200 && directInvalid.body.imported===0 && directInvalid.body.processedIds.length===0,
    'Une fiche sans coordonnées utiles ne peut pas entrer dans le CRM');

  const generalNote = await request('POST','/activities',{type:'note',title:'Appeler le matin',prospectId:importedId},token);
  const dealNote = await request('POST','/activities',{type:'note',title:'Devis envoyé',dealId:linkedDeal.body.id},token);
  const historyPath = `/activities?prospectId=${importedId}&scope=history`;
  const history = await request('GET',historyPath,undefined,token);
  check(history.status === 200 && history.body.filter(a=>a.id===dealNote.body.id).length === 1 &&
    history.body.find(a=>a.id===dealNote.body.id)?.dealTitle===linkedDeal.body.title &&
    history.body.some(a=>a.id===generalNote.body.id),'Notes du prospect et du deal visibles une seule fois avec leur origine');
  const secondHistory = await request('GET',`/activities?dealId=${convertedDeal.body.id}`,undefined,token);
  const generalPath = `/activities?dealId=${convertedDeal.body.id}&scope=prospect-notes`;
  const sharedNotes = await request('GET',generalPath,undefined,token);
  check(secondHistory.status===200 && !secondHistory.body.some(a=>a.id===dealNote.body.id) &&
    sharedNotes.body.some(a=>a.id===generalNote.body.id) && !sharedNotes.body.some(a=>a.id===dealNote.body.id),
    'Deux affaires du même prospect gardent des historiques distincts');
  await request('PATCH',`/activities/${generalNote.body.id}`,{description:'À partir de 9 h'},token);
  for (const path of [historyPath,generalPath]) {
    const edited = await request('GET',path,undefined,token);
    check(edited.body.find(a=>a.id===generalNote.body.id)?.description==='À partir de 9 h','Édition de la même note relue sur '+path.split('?')[0]);
  }
  const byEdition = await request('POST','/prospects',{company:'Test secteur 2025',apeCode:'43.22G',nafVersion:'NAF 2025'},token);
  check(byEdition.status===201 && byEdition.body.nafLabel?.includes('eau et de gaz'),'Intitulé NAF 2025 résolu à partir du seul code');
  const wrongEdition = await request('PATCH',`/prospects/${byEdition.body.id}`,{nafVersion:'NAFRev2'},token);
  check(wrongEdition.status===200 && !wrongEdition.body.nafLabel,'Changement de nomenclature sans correspondance : ancien libellé effacé');
  const sources = {
    linkedin:'https://www.linkedin.com/company/atelier-recette/',
    societe_com:'https://www.societe.com/societe/atelier-recette-999000001.html',
    facebook:'https://www.facebook.com/atelier.recette/',
    instagram:'https://www.instagram.com/atelier.recette/',
    tiktok:'https://www.tiktok.com/@atelier.recette/',
    bing:'https://www.bing.com/search?q=atelier+recette',
  };
  for (const [source,sourceUrl] of Object.entries(sources)) {
    const record = {...directCapture,id:'recette_'+source,company:'Recette '+source,source,sourceUrl,
      collectionMode:source==='bing'?'visible':'manual'};
    const payload={verified:[record]};
    const first=await request('POST','/sourcing/device/import-prospects',payload,token);
    const replay=await request('POST','/sourcing/device/import-prospects',payload,token);
    check(first.status===200 && first.body.imported===1 && replay.body.imported===0 && replay.body.skipped===1,
      source+' : création puis réimport sans doublon');
    if (source==='tiktok') {
      for (const invalid of [
        {...record,sourceUrl:sourceUrl+'video/123'},
        {...record,sourceUrl:'https://www.tiktok.com.evil.example/@atelier'},
        {...record,collectionMode:'visible'},
      ]) {
        const rejected=await request('POST','/sourcing/device/import-prospects',{verified:[invalid]},token);
        check(rejected.status===400,'TikTok : lien de profil et confirmation manuelle exigés');
      }
    }
    const newWebsite='https://atelier-'+source.replaceAll('_','-')+'.example.org';
    const merged=await request('POST','/sourcing/device/import-prospects',{verified:[{
      ...record,id:'enriched_'+source,website:newWebsite,
    }]},token);
    check(merged.status===200 && merged.body.imported===0 && merged.body.enriched===1,
      source+' : le réimport complète un champ absent');
    const saved=await request('GET','/prospects?search='+encodeURIComponent(record.company),undefined,token);
    check(saved.body.data.length===1 && saved.body.data[0].website===newWebsite &&
      saved.body.data[0].sourceDetails.crossSource.observations.some(item=>item.sourceUrl===sourceUrl),
      source+' : données enrichies et provenance relues dans le CRM');
    if(source==='linkedin') {
      const target=saved.body.data[0];
      check(target.linkedinUrl===sourceUrl && target.sourceDetails.crossSource.fieldSources.linkedinUrl.source==='linkedin',
        'LinkedIn : lien entreprise enregistré dans le champ CRM avec provenance');
      const alternate='https://www.linkedin.com/company/atelier-recette-autre/';
      const alternative={...record,id:'linkedin_conflict_profile',sourceUrl:alternate};
      const disputed=await request('POST','/sourcing/device/import-prospects',{verified:[alternative]},token);
      const current=await request('GET',`/prospects/${target.id}`,undefined,token);
      const conflict=current.body.sourceDetails.crossSource.conflicts.find(c=>c.field==='linkedinUrl');
      check(disputed.body.imported===0 && disputed.body.conflicts===1 && current.body.linkedinUrl===sourceUrl && conflict?.incoming===alternate,
        'LinkedIn : autre lien signalé sans remplacement du profil CRM');
      const kept=await request('POST',`/sourcing/device/prospects/${target.id}/resolve-conflict`,{conflictId:conflict.id,decision:'keep_existing'},token);
      check(kept.status===200 && kept.body.prospect.linkedinUrl===sourceUrl,
        'LinkedIn : conserver le profil CRM résout le désaccord');
      const repeated=await request('POST','/sourcing/device/import-prospects',{verified:[{...alternative,id:'linkedin_conflict_replay'}]},token);
      check(repeated.body.conflicts===0,'LinkedIn : désaccord déjà tranché non recréé au réimport');
      const chosen='https://www.linkedin.com/company/atelier-recette-confirme/';
      await request('POST','/sourcing/device/import-prospects',{verified:[{...record,id:'linkedin_chosen_profile',sourceUrl:chosen}]},token);
      const toChoose=await request('GET',`/prospects/${target.id}`,undefined,token);
      const chosenConflict=toChoose.body.sourceDetails.crossSource.conflicts.find(c=>c.field==='linkedinUrl');
      const accepted=await request('POST',`/sourcing/device/prospects/${target.id}/resolve-conflict`,{conflictId:chosenConflict.id,decision:'use_incoming'},token);
      check(accepted.status===200 && accepted.body.prospect.linkedinUrl===chosen && accepted.body.prospect.sourceDetails.crossSource.fieldSources.linkedinUrl.sourceUrl===chosen,
        'LinkedIn : profil choisi enregistré avec sa provenance après décision');
      const equivalent=await request('POST','/sourcing/device/import-prospects',{verified:[{...record,id:'linkedin_about_equivalent',sourceUrl:chosen+'about/?trk=test'}]},token);
      check(equivalent.status===200 && equivalent.body.imported===0 && equivalent.body.conflicts===0,
        'LinkedIn : page À propos et paramètres de suivi ne créent pas un faux conflit');
      const sharedPage=await request('POST','/sourcing/device/import-prospects',{verified:[{...record,
        id:'linkedin_shared_company_page',sourceUrl:chosen,address:'24 rue des Ateliers 59000 Lille',codePostal:'59000',city:'Lille',phone:null}]},token);
      check(sharedPage.status===200 && sharedPage.body.imported===1 && sharedPage.body.enriched===0,
        'LinkedIn : même page entreprise dans deux villes, établissements conservés distincts');
      const uncertainPage=await request('POST','/sourcing/device/import-prospects',{verified:[{...record,
        id:'linkedin_ambiguous_same_city',sourceUrl:chosen,address:'12 rue des Autres Ateliers 59100 Roubaix',phone:null}]},token);
      check(uncertainPage.status===200 && uncertainPage.body.imported===0 && uncertainPage.body.enriched===0 && uncertainPage.body.reviews[0]?.type==='ambiguous' && uncertainPage.body.reviews[0]?.prospectId===target.id && !uncertainPage.body.processedIds.length,
        'LinkedIn : même page sans preuve d’établissement suffisante, sélection conservée pour vérification');
      const renamedPage=await request('POST','/sourcing/device/import-prospects',{verified:[{...record,
        id:'linkedin_changed_company_name',company:'Nouvelle dénomination LinkedIn',sourceUrl:chosen,phone:null}]},token);
      check(renamedPage.status===200 && renamedPage.body.imported===0 && renamedPage.body.reviews[0]?.type==='ambiguous' && renamedPage.body.reviews[0]?.prospectId===target.id,
        'LinkedIn : nom différent sur le profil déjà enregistré, vérification demandée sans nouvelle fiche');
      const jobRecord={...record,id:'linkedin_job_profile',company:'Entreprise LinkedIn du sourcing',siren:'',siret:null,source:'linkedin',sourceUrl:'https://www.linkedin.com/company/atelier-sourcing/'};
      const jobId=await storeTestSourcingJob(target.id,[jobRecord]);
      const jobImported=await request('POST',`/sourcing/jobs/${jobId}/import`,{ids:[jobRecord.id]},token);
      const jobSaved=await request('GET','/prospects?search='+encodeURIComponent(jobRecord.company),undefined,token);
      check(jobImported.status===200 && jobImported.body.imported===1 && jobSaved.body.data.length===1 && jobSaved.body.data[0].linkedinUrl===jobRecord.sourceUrl && jobSaved.body.data[0].source==='linkedin',
        'LinkedIn : import d’une recherche conserve le lien et la vraie source LinkedIn');
      const jobReplay=await request('POST',`/sourcing/jobs/${jobId}/import`,{ids:[jobRecord.id]},token);
      check(jobReplay.status===200 && jobReplay.body.imported===0 && jobReplay.body.skipped===1,
        'LinkedIn : réimport de la recherche sans création supplémentaire');
      const legacyLinks=await storeLegacyLinkedinProfiles(target.id);
      const legacyDevice=await request('POST','/sourcing/device/import-prospects',{verified:[{...record,
        id:'legacy_linkedin_device',company:'Nouvelle enseigne source',sourceUrl:'https://www.linkedin.com/company/ancienne-source/'}]},token);
      check(legacyDevice.status===200 && legacyDevice.body.imported===0 && legacyDevice.body.reviews[0]?.type==='ambiguous' && legacyDevice.body.reviews[0]?.prospectId===legacyLinks[0] && !legacyDevice.body.processedIds.length,
        'LinkedIn historique : URL sans www ni barre finale retrouvée malgré un nouveau nom');
      const legacyJobRecord={...jobRecord,id:'legacy_linkedin_job',company:'Nouvelle enseigne champ',sourceUrl:'https://www.linkedin.com/company/ancien-champ/'};
      const legacyJobId=await storeTestSourcingJob(target.id,[legacyJobRecord]);
      const legacyJob=await request('POST',`/sourcing/jobs/${legacyJobId}/import`,{ids:[legacyJobRecord.id]},token);
      const legacyUnchanged=await request('GET',`/prospects/${legacyLinks[1]}`,undefined,token);
      check(legacyJob.status===200 && legacyJob.body.imported===0 && legacyJob.body.skipped===1 && legacyUnchanged.body.linkedinUrl==='https://linkedin.com/company/ancien-champ/about/?trk=old',
        'Recherche LinkedIn historique : ancien champ avec À propos et paramètres reconnu sans réécriture ni nouvelle fiche');
      for(const sourceUrl of ['https://www.linkedin.com/company/atelier-recette/posts/123','https://www.linkedin.com/in/dirigeant-test/','https://www.linkedin.com.evil.example/company/atelier/']) {
        const rejected=await request('POST','/sourcing/device/import-prospects',{verified:[{...record,sourceUrl}]},token);
        check(rejected.status===400,'LinkedIn : seule une page entreprise conforme est importable');
      }
    }
    if (source!=='societe_com') {
      const otherCity=await request('POST','/sourcing/device/import-prospects',{verified:[{...record,
        id:'homonym_'+source,sourceUrl:source==='bing'?sourceUrl+'+Lille':sourceUrl.replace(/\/$/,'')+(source==='linkedin'?'-lille/':'.lille/'),
        address:'8 rue des Fleurs 59000 Lille',codePostal:'59000',city:'Lille',phone:null}]},token);
      check(otherCity.status===200 && otherCity.body.imported===1 && otherCity.body.enriched===0,
        source+' : un homonyme dans une autre ville reste distinct');
    }
    if (source==='societe_com') {
      const forged=await request('POST','/sourcing/device/import-prospects',{verified:[{...record,siret:'88800000100012',sourceUrl:sourceUrl+'?fake=-888000001.html'}]},token);
      const homonym = await request('POST','/sourcing/device/import-prospects',{verified:[{...record,
        id:'second_site_same_company',address:'8 rue des Fleurs 59000 Lille',codePostal:'59000',city:'Lille',phone:null}]},token);
      check(homonym.status===200 && homonym.body.imported===0 && homonym.body.enriched===0 &&
        homonym.body.reviews[0]?.type==='ambiguous' && !homonym.body.processedIds.length,
        'Deux établissements possibles pour une société : aucune fusion et sélection conservée');
      check(forged.status===400,'SIRET et SIREN de la fiche Societe.com doivent correspondre');
    }
  }

  const societeTarget = await request('POST','/prospects',{
    company:'Atelier Enrichissement',siren:'999000002',phone:'03 20 11 22 33',city:'Roubaix',
  },token);
  const societeCapture = {id:'societe_enrich_01',source:'societe_com',company:'Atelier Enrichissement',
    sourceUrl:'https://www.societe.com/societe/atelier-enrichissement-999000002.html',
    siret:'99900000200017',address:'8 rue du Test 59100 Roubaix',codePostal:'59100',city:'Roubaix',
    phone:'03 20 44 55 66',email:'contact@atelier-enrichissement.example.org',website:'https://atelier-enrichissement.example.org',apeCode:'43.22A',
    collectionMode:'visible',capturedAt:Date.now(),companyDetails:{fields:{'Forme juridique':'Entrepreneur individuel','Capital social':'1000 €'},managers:['Alice Test'],establishments:[],links:[]}};
  societeCapture.companyDetails.managerContacts=[{name:'Denis LIQUARD',role:'Gérant',phone:null,email:'denis@atelier-recette.example.org',profileUrl:'https://www.societe.com/dirigeant/denis-liquard.html'}];
  const enrichPath = `/sourcing/device/prospects/${societeTarget.body.id}/societe-enrich`;
  const noConfirm = await request('POST',enrichPath,{capture:societeCapture,confirmed:false},token);
  check(noConfirm.status===400,'Societe.com : confirmation exigée avant enrichissement');
  const enrich = await request('POST',enrichPath,{capture:societeCapture,confirmed:true},token);
  check(enrich.status===200 && enrich.body.enriched && enrich.body.conflicts===1,
    'Societe.com : champs absents complétés et téléphone divergent signalé');
  const reread = await request('GET',`/prospects/${societeTarget.body.id}`,undefined,token);
  check(reread.body.siret===societeCapture.siret && reread.body.website===societeCapture.website &&
    reread.body.phone==='03 20 11 22 33' && reread.body.email===societeCapture.email && reread.body.nafLabel?.includes('eau et de gaz') &&
    reread.body.sourceDetails.crossSource.observations.some(o=>o.sourceUrl===societeCapture.sourceUrl),
    'Societe.com : enrichissement relu avec libellé, provenance et téléphone initial conservé');
  const repeatedEnrich = await request('POST',enrichPath,{capture:societeCapture,confirmed:true},token);
  check(repeatedEnrich.status===200 && !repeatedEnrich.body.enriched && repeatedEnrich.body.conflicts===0,
    'Societe.com : répéter l’enrichissement ne duplique pas les conflits');
  check(reread.body.sourceDetails.societe_com.companyDetails.managerContacts[0].email==='denis@atelier-recette.example.org','Coordonnées du dirigeant conservées et relues après enrichissement');
  check(reread.body.sourceDetails.societe_com.companyDetails.fields['Forme juridique']==='Entrepreneur individuel',
    'Societe.com : les informations détaillées sont relues sur la fiche prospect');
  await request('POST',enrichPath,{confirmed:true,capture:{...societeCapture,capturedAt:societeCapture.capturedAt+1000,
    companyDetails:{...societeCapture.companyDetails,fields:{...societeCapture.companyDetails.fields,'Capital social':'2000 €'}}}},token);
  await request('POST',enrichPath,{confirmed:true,capture:societeCapture},token);
  const metadataUpdated=await request('GET',`/prospects/${societeTarget.body.id}`,undefined,token);
  check(metadataUpdated.body.sourceDetails.societe_com.companyDetails.fields['Capital social']==='2000 €' &&
    metadataUpdated.body.sourceDetails.societe_com.history.length===1,
    'Societe.com : une nouvelle capture conserve l’historique, une ancienne capture ne remplace pas la nouvelle');
  const differentSiren = await request('POST',enrichPath,{confirmed:true,capture:{...societeCapture,
    sourceUrl:'https://www.societe.com/societe/autre-entreprise-999000003.html',siret:'99900000300017'}},token);
  check(differentSiren.status===409,'Societe.com : une identité juridique différente est refusée');
  const differentSite = await request('POST',enrichPath,{confirmed:true,capture:{...societeCapture,siret:'99900000200025'}},token);
  check(differentSite.status===409,'Societe.com : un autre établissement ne remplace pas celui du prospect');
  const wrongSource = await request('POST',enrichPath,{confirmed:true,capture:directCapture},token);
  check(wrongSource.status===400,'Societe.com : la route refuse une capture d’une autre source');

  {
    const target=await request('POST','/prospects',{company:'Atelier Ciblé',city:'Roubaix',phone:'03 20 11 22 33'},token);
    const path=`/sourcing/device/prospects/${target.body.id}/enrich-capture`;
    const taskId=randomUUID(),capture={id:'task_'+taskId,source:'linkedin',company:'Atelier Ciblé',
      sourceUrl:'https://www.linkedin.com/company/atelier-cible/',collectionMode:'manual',capturedAt:Date.now(),
      phone:'03 20 99 88 77',website:'https://atelier-cible.example.org'};
    const payload={taskId,capture,confirmed:true};
    check((await request('POST',path,{...payload,confirmed:false},token)).status===400,'Ciblage : confirmation obligatoire');
    check((await request('POST',path,{...payload,taskId:randomUUID()},token)).status===400,'Ciblage : capture liée à sa tâche');
    const two=await Promise.all([request('POST',path,payload,token),request('POST',path,payload,token)]);
    check(two.every(r=>r.status===200) && two.filter(r=>r.body.alreadyApplied).length===1,'Ciblage : deux retours concurrents appliquent une seule fois la capture');
    const read=await request('GET','/prospects/'+target.body.id,undefined,token);
    check(read.body.website===capture.website && read.body.linkedinUrl===capture.sourceUrl && !read.body.address && !read.body.postalCode,
      'LinkedIn ciblé : données partielles enregistrées sans inventer adresse ni CP');
    check(read.body.phone==='03 20 11 22 33' && read.body.sourceDetails.crossSource.conflicts.length===1 &&
      read.body.sourceDetails.crossSource.observations.filter(o=>o.captureId===capture.id).length===1,
      'Ciblage : téléphone conservé, un conflit et une seule observation');
    const distinct=()=>{const taskId=randomUUID();return {...payload,taskId,capture:{...capture,id:'task_'+taskId}};};
    for(const changes of [{company:'Autre société'},{city:'Lille'},{sourceUrl:'https://www.linkedin.com/in/personne/'},
      {capturedAt:Date.now()-86400001},{sourceUrl:'https://www.linkedin.com/company/atelier/posts/123'},
      {sourceUrl:'URL invalide'},{website:'site invalide'}]){
      const p=distinct();p.capture={...p.capture,...changes};
      const result=await request('POST',path,p,token);
      check([400,409].includes(result.status),'Ciblage : fiche incompatible ou expirée refusée '+Object.keys(changes)[0]);
    }
    const pendingEmail=distinct(),pendingAddress=distinct();
    pendingEmail.capture.email='contact@atelier-cible.example.org';
    pendingAddress.capture.address='8 rue du Test 59100 Roubaix';pendingAddress.capture.codePostal='59100';
    const concurrent=await Promise.all([request('POST',path,pendingEmail,token),request('POST',path,pendingAddress,token)]);
    const combined=await request('GET','/prospects/'+target.body.id,undefined,token);
    check(concurrent.every(r=>r.status===200) && combined.body.email===pendingEmail.capture.email && combined.body.address===pendingAddress.capture.address &&
      combined.body.sourceDetails.crossSource.observations.length===3,'Ciblage : deux captures différentes concurrentes conservent leurs champs et provenances');
    for(const [source,url] of Object.entries({facebook:'https://www.facebook.com/atelier.cible/',instagram:'https://www.instagram.com/atelier.cible/',
      tiktok:'https://www.tiktok.com/@atelier.cible/',bing:'https://www.bing.com/search?q=Atelier+Cible',
      google_search:'https://www.google.com/search?q=Atelier+Cible',google_maps:'https://www.google.com/maps/place/Atelier/',
      pagesjaunes:'https://www.pagesjaunes.fr/pros/12345678',societe_com:'https://www.societe.com/societe/atelier-cible-998000008.html'})){
      const p=distinct();p.capture={id:p.capture.id,company:'Atelier Ciblé',source,sourceUrl:url,collectionMode:'manual',capturedAt:Date.now()};
      const result=await request('POST',path,p,token);
      const profile=await request('GET','/prospects/'+target.body.id,undefined,token);
      check(result.status===200 && profile.body.sourceDetails.crossSource.observations.some(o=>o.captureId===p.capture.id && o.sourceUrl===url),
        'Ciblage : source '+source+' relue avec sa provenance sans adresse obligatoire');
    }
    const legalMismatch=distinct();legalMismatch.capture.siret='99900000200017';
    check((await request('POST',path,legalMismatch,token)).status===409,'Ciblage : autre identité juridique refusée');
    const tokenPayload=JSON.parse(Buffer.from(token.split('.')[1],'base64url'));
    const foreignPayload=Buffer.from(JSON.stringify({...tokenPayload,tenantId:'00000000-0000-4000-8000-000000000099'})).toString('base64url');
    const foreignUnsigned=token.split('.')[0]+'.'+foreignPayload;
    const foreignToken=foreignUnsigned+'.'+createHmac('sha256',testEnv.JWT_SECRET).update(foreignUnsigned).digest('base64url');
    check((await request('POST',path,distinct(),foreignToken)).status===404,'Ciblage : prospect d’une autre agence inaccessible');
    check((await request('POST','/sourcing/device/prospects/'+randomUUID()+'/enrich-capture',distinct(),token)).status===404,
      'Ciblage : une cible absente ne crée jamais de prospect');
  }

  {
    const target=await request('POST','/prospects',{company:'Ancien nom',siret:'96677700100019',city:'Chauffagiste',address:'Ancienne rue',lat:50.7,lng:3.1},token);
    const id=target.body.id,taskId=randomUUID();
    const capture={id:'task_'+taskId,source:'societe_com',company:'SOLUTION ENR',siret:'96677700100019',
      city:'Roubaix',address:'8 rue du Test 59100 Roubaix',codePostal:'59100',
      sourceUrl:'https://www.societe.com/societe/solution-enr-966777001.html',collectionMode:'visible',capturedAt:Date.now()};
    const path='/sourcing/device/prospects/'+id;
    const enriched=await request('POST',path+'/enrich-capture',{taskId,capture,confirmed:true},token);
    check(enriched.status===200 && enriched.body.conflicts===3,'Régression Chauffagiste : même SIRET, nom/ville/adresse différents proposés sans bloquer la capture');
    const before=await request('GET','/prospects/'+id,undefined,token);
    const conflicts=before.body.sourceDetails.crossSource.conflicts;
    check(before.body.city==='Chauffagiste' && before.body.company==='Ancien nom' && before.body.postalCode==='59100',
      'Enrichissement : valeurs divergentes conservées avant validation, champs absents complétés');
    const city=conflicts.find(c=>c.field==='city');
    const apply=await request('POST',path+'/resolve-conflict',{conflictId:city.id,decision:'use_incoming'},token);
    check(apply.status===200 && apply.body.prospect.city==='Roubaix' && apply.body.prospect.lat===null && apply.body.prospect.lng===null,
      'Ville erronée remplacée explicitement et ancienne géolocalisation invalidée');
    const changes=await Promise.all(conflicts.filter(c=>c.field!=='city').map(c=>request('POST',path+'/resolve-conflict',{conflictId:c.id,decision:'use_incoming'},token)));
    const after=await request('GET','/prospects/'+id,undefined,token);
    check(changes.every(r=>r.status===200) && after.body.company==='SOLUTION ENR' && after.body.address===capture.address && after.body.sourceDetails.crossSource.conflicts.length===0,
      'Résolutions concurrentes : nom et adresse appliqués sans perdre les décisions');
    const activities=await request('GET','/activities?prospectId='+id+'&scope=history',undefined,token);
    const cityHistory=activities.body.find(a=>a.type==='data_update' && a.description.includes('Chauffagiste → Roubaix'));
    check(activities.body.length===4 && cityHistory?.description.includes(capture.sourceUrl) && cityHistory.createdBy,
      'Historique réel de la fiche : enrichissement et trois corrections, auteur, source et valeurs avant/après');
    await request('POST',path+'/enrich-capture',{taskId,capture,confirmed:true},token);
    await request('POST',path+'/resolve-conflict',{conflictId:city.id,decision:'use_incoming'},token);
    check((await request('GET','/activities?prospectId='+id,undefined,token)).body.length===4,
      'Réessayer une capture ou une décision ne duplique pas les activités');
    check((await request('PATCH','/activities/'+cityHistory.id,{description:'Effacer la trace'},token)).status===404 &&
      (await request('DELETE','/activities/'+cityHistory.id,undefined,token)).status===404,
      'Historique des données : activité automatique protégée contre modification et suppression');
  }

  const legacyEdit=await request('POST','/prospects',{company:'Fiche importée sans identité',status:'converted'},token);
  const fullRecordEdit=await request('PATCH',`/prospects/${legacyEdit.body.id}`,{
    ...legacyEdit.body,postalCode:'59100',city:'Roubaix',firstName:null,lat:null,lng:null,
  },token);
  const editedRecord=await request('GET',`/prospects/${legacyEdit.body.id}`,undefined,token);
  check(fullRecordEdit.status===200 && editedRecord.body.postalCode==='59100' && editedRecord.body.city==='Roubaix' &&
    editedRecord.body.status==='converted' && editedRecord.body.siren===null,
    'Régression corrigée : enregistrer une fiche importée avec champs nuls, puis relire code postal et ville');
  const partialEdit=await request('PATCH',`/prospects/${legacyEdit.body.id}`,{phone:'03 20 11 22 33'},token);
  check(partialEdit.status===200 && partialEdit.body.status==='converted' && partialEdit.body.postalCode==='59100',
    'Modification partielle : statut et autres champs conservés');
  const missingIdentity=await request('POST',`/prospects/${legacyEdit.body.id}/verify-company`,{},token);
  check(missingIdentity.status===422,'Une entreprise sans SIREN ou SIRET reste non vérifiée');
  const watched=await request('POST','/prospects',{company:'Entreprise de veille',siren:'777000001',siret:'77700000100019',
    city:'Chauffagiste',address:'Ancienne adresse',phone:'03 20 11 22 33',website:'https://veille.example.org',lat:50.7,lng:3.1},token);
  const watchId=watched.body.id,watchPath=`/prospects/${watchId}`;
  const initialWatch=await request('POST',watchPath+'/verify-company',{},token);
  check(initialWatch.status===200 && initialWatch.body.snapshot.fields['État de l’entreprise']==='Active' &&
    initialWatch.body.snapshot.fields['État de l’établissement']==='Active' && initialWatch.body.changes.length===0,
    'À la consultation : état officiel de l’entreprise et de son établissement, premier état sans fausse alerte');
  check(initialWatch.body.snapshot.managers[0].includes('Alice') && initialWatch.body.snapshot.financials[0].includes('0 €') &&
    initialWatch.body.snapshot.fields['Activité de l’entreprise'].includes('eau et de gaz'),
    'Fiche complète : dirigeants, résultat nul et activité issus de la source');
  const beforeCached=watchRequests;
  const beforeEnabled=await request('GET',watchPath,undefined,token);
  check(beforeEnabled.body.city==='Chauffagiste' && beforeEnabled.body.address==='Ancienne adresse','Veille désactivée : le contrôle à l’ouverture ne remplace pas les coordonnées CRM');
  await request('POST',watchPath+'/verify-company',{},token);
  check(watchRequests===beforeCached,'Réouverture immédiate : contrôle récent réutilisé sans appel fournisseur supplémentaire');
  const enabledWatch=await request('PATCH',watchPath+'/monitoring',{enabled:true,intervalHours:24},token);
  check(enabledWatch.status===200 && enabledWatch.body.enabled && enabledWatch.body.nextCheckAt,
    'Veille activée et prochaine échéance persistée');
  const rescheduled=await request('PATCH',watchPath+'/monitoring',{enabled:true,intervalHours:72},token);
  check(rescheduled.body.intervalHours===72 && new Date(rescheduled.body.nextCheckAt)-new Date(rescheduled.body.checkedAt)===72*3600000,
    'Changer la fréquence recalcule la prochaine échéance depuis le dernier contrôle');
  await monitoringMaintenance('expire',watchId);watchVersion=1;
  await monitoringMaintenance('cron',watchId);
  const closedWatch=await request('GET',watchPath+'/monitoring',undefined,token);
  check(closedWatch.body.snapshot.fields['État de l’entreprise']==='Cessée' &&
    closedWatch.body.snapshot.fields['État de l’établissement']==='Fermé' && closedWatch.body.changes.length===1,
    'Veille en arrière-plan : cessation, fermeture et changement de dirigeant historisés');
  const notices=await request('GET','/notifications',undefined,token);
  check(notices.body.some(item=>item.payload?.prospectId===watchId),
    'Le changement du prospect déclenche une notification GrowthOS');
  const syncedWatch=await request('GET',watchPath,undefined,token);
  const syncActivities=await request('GET','/activities?prospectId='+watchId+'&scope=history',undefined,token);
  check(syncedWatch.body.city==='Roubaix' && syncedWatch.body.postalCode==='59100' && syncedWatch.body.address==='10 rue du Test 59100 Roubaix' && syncedWatch.body.lat===null && syncedWatch.body.lng===null,
    'Veille activée : adresse, code postal et ville réels remplacent les coordonnées erronées du même établissement et invalident la carte');
  check(syncedWatch.body.phone==='03 20 11 22 33' && syncedWatch.body.website==='https://veille.example.org',
    'Veille : les coordonnées commerciales absentes de la source sont conservées');
  check(syncActivities.body.some(a=>a.type==='data_update' && a.description.includes('Chauffagiste → Roubaix') && a.description.includes('Annuaire des entreprises') && a.description.includes('Ancienne adresse → 10 rue du Test')),
    'Veille : activité datée avec source et anciennes/nouvelles valeurs relue dans la fiche');
  const afterCronRequests=watchRequests;
  await monitoringMaintenance('cron',watchId);
  const sameWatch=await request('GET',watchPath+'/monitoring',undefined,token);
  check(sameWatch.body.changes.length===1 && watchRequests===afterCronRequests,
    'Redémarrage du traitement : échéance conservée et aucune alerte en double');
  check((await request('GET','/activities?prospectId='+watchId,undefined,token)).body.length===syncActivities.body.length,
    'Veille : aucune activité de mise à jour répétée sans changement');
  await monitoringMaintenance('expire',watchId);watchDown=true;
  const failedWatch=await request('POST',watchPath+'/verify-company',{force:true},token);
  check(failedWatch.status===200 && failedWatch.body.error && failedWatch.body.snapshot.fields['État de l’entreprise']==='Cessée' &&
    failedWatch.body.changes.length===1,'Source indisponible : dernier état et historique conservés, erreur visible');
  watchDown=false;watchWrongIdentity=true;
  await monitoringMaintenance('expire',watchId);
  const wrongIdentity=await request('POST',watchPath+'/verify-company',{force:true},token);
  check(wrongIdentity.body.error && wrongIdentity.body.snapshot.siren==='777000001',
    'Une réponse portant un autre SIREN ne remplace jamais le prospect');
  watchWrongIdentity=false;watchVersion=2;
  await monitoringMaintenance('expire',watchId);
  const beforeConcurrent=watchRequests;
  await Promise.all([request('POST',watchPath+'/verify-company',{force:true},token),request('POST',watchPath+'/verify-company',{force:true},token)]);
  const openAgain=await request('GET',watchPath+'/monitoring',undefined,token);
  check(watchRequests===beforeConcurrent+1,'Vérifications concurrentes : un seul appel fournisseur et un seul changement');
  check(!openAgain.body.error && openAgain.body.snapshot.fields['État de l’entreprise']==='Active' && openAgain.body.changes.length===2,
    'Reprise après erreur : retour au statut actif détecté et historisé');
  await request('PATCH',watchPath+'/monitoring',{enabled:false,intervalHours:72},token);
  await monitoringMaintenance('expire',watchId);
  const beforeStopped=watchRequests;await monitoringMaintenance('cron',watchId);
  check(watchRequests===beforeStopped,'Veille désactivée : aucun appel automatique supplémentaire');
  const tokenPayload=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());
  const foreignPayload=Buffer.from(JSON.stringify({...tokenPayload,tenantId:'00000000-0000-4000-8000-000000000099'})).toString('base64url');
  const foreignUnsigned=token.split('.')[0]+'.'+foreignPayload;
  const foreignToken=foreignUnsigned+'.'+createHmac('sha256',testEnv.JWT_SECRET).update(foreignUnsigned).digest('base64url');
  for(const [method,path,body] of [['GET','/monitoring',undefined],['POST','/verify-company',{force:true}],['PATCH','/monitoring',{enabled:true}]]) {
    const foreign=await request(method,watchPath+path,body,foreignToken);
    check(foreign.status===404,'Isolation agence : '+method+' '+path+' refuse le prospect d’une autre agence');
  }
  const absentSite=await request('POST','/prospects',{company:'Autre établissement',siret:'77700000100027',city:'Lille',address:'Adresse locale conservée',apeCode:'62.01Z'},token);
  const siteStatus=await request('POST',`/prospects/${absentSite.body.id}/verify-company`,{},token);
  check(siteStatus.body.snapshot.fields['État de l’entreprise']==='Active' && siteStatus.body.snapshot.fields['État de l’établissement']===null,
    'Établissement absent de la réponse : état non vérifié, aucune activité déduite du siège');
  await request('PATCH',watchPath+'/monitoring',{enabled:true,intervalHours:24},token);
  await monitoringMaintenance('expire',watchId);watchVersion=3;
  await monitoringMaintenance('cron',watchId);
  const renamed=await request('GET',watchPath,undefined,token);
  check(renamed.body.company==='Entreprise de veille renommée' && renamed.body.apeCode==='43.21A' && renamed.body.nafLabel?.includes('électrique'),
    'Veille : changement de dénomination et activité locale appliqués avec le libellé du secteur');
  const renamedHistory=await request('GET','/activities?prospectId='+watchId,undefined,token);
  check(renamedHistory.body.some(a=>a.description.includes('Entreprise de veille → Entreprise de veille renommée') && a.description.includes('43.22A → 43.21A')),
    'Veille : nouvelles identité et activité tracées avec leurs anciennes valeurs');
  const countBeforeBlank=renamedHistory.body.length;
  await monitoringMaintenance('expire',watchId);watchEmptyAddress=true;
  await request('POST',watchPath+'/verify-company',{force:true},token);
  const absentFields=await request('GET',watchPath,undefined,token);
  check(absentFields.body.address==='10 rue du Test 59100 Roubaix' && absentFields.body.city==='Roubaix' && absentFields.body.postalCode==='59100',
    'Veille : coordonnées absentes de la réponse n’effacent pas les valeurs connues');
  check((await request('GET','/activities?prospectId='+watchId,undefined,token)).body.length===countBeforeBlank,
    'Réponse partielle sans nouvelle valeur : aucune fausse mise à jour dans les activités');
  await monitoringMaintenance('expire',watchId);watchEmptyAddress=false;watchStale=true;
  const stale=await request('POST',watchPath+'/verify-company',{force:true},token);
  check(stale.body.error?.includes('plus ancienne') && (await request('GET',watchPath,undefined,token)).body.company===renamed.body.company,
    'Veille : une version officielle plus ancienne ne remplace pas les dernières données');
  watchStale=false;
  await request('PATCH',`/prospects/${absentSite.body.id}/monitoring`,{enabled:true,intervalHours:24},token);
  await monitoringMaintenance('expire',absentSite.body.id);await monitoringMaintenance('cron',absentSite.body.id);
  const absentSiteAgain=await request('GET','/prospects/'+absentSite.body.id,undefined,token);
  check(absentSiteAgain.body.city==='Lille' && absentSiteAgain.body.address==='Adresse locale conservée' && absentSiteAgain.body.apeCode==='62.01Z',
    'Veille : le siège ne remplace ni les coordonnées ni l’activité d’un établissement absent de la réponse');
  await request('PATCH',watchPath+'/monitoring',{enabled:false,intervalHours:24},token);
  await request('PATCH',`/prospects/${absentSite.body.id}/monitoring`,{enabled:false,intervalHours:24},token);

  const identity=await request('POST','/prospects',{company:'Identité principale',siret:'981 075 252 00016'},token);
  check(identity.status===201 && identity.body.siret==='98107525200016','SIRET avec espaces normalisé à la création');
  const duplicateIdentity=await request('POST','/prospects',{company:'Autre nom et entité',siret:'98107525200016'},token);
  check(duplicateIdentity.status===409 && duplicateIdentity.body.message.includes('SIRET'),'Même SIRET et nom différent : création refusée avec message explicite');
  const otherIdentity=await request('POST','/prospects',{company:'Autre prospect'},token);
  const patchIdentity=await request('PATCH',`/prospects/${otherIdentity.body.id}`,{siret:'98107525200016'},token);
  check(patchIdentity.status===409,'Modification vers un SIRET existant refusée');
  const mismatchIdentity=await request('POST','/prospects',{company:'Identifiants incohérents',siren:'981075253',siret:'98107525200024'},token);
  check(mismatchIdentity.status===409,'SIREN et SIRET de sociétés différentes refusés');
  const concurrentIdentity=await Promise.all(['Nom A','Nom B'].map(company=>request('POST','/prospects',{company,siret:'98107525400012'},token)));
  check(concurrentIdentity.map(r=>r.status).sort().join(',')==='201,409','Deux créations simultanées : une seule fiche autorisée par SIRET');
  const bulkIdentity=await request('POST','/prospects/bulk',{duplicateMode:'create',prospects:[{firstName:'Test',email:'doublon-siret@example.org',company:'Autre entité CSV',siret:'98107525200016'}]},token);
  check(bulkIdentity.status===409,'CSV en mode créer : le même SIRET reste bloqué');
  const differentEstablishment=await request('POST','/prospects',{company:'Autre établissement',siret:'98107525200024'},token);
  check(differentEstablishment.status===201,'Deux SIRET distincts du même SIREN restent possibles');
  const identityCapture={...societeCapture,id:'identity_capture',company:'Autre nom de société',siret:'98107525200016',sourceUrl:'https://www.societe.com/societe/identite-981075252.html'};
  const importIdentity=await request('POST','/sourcing/device/import-prospects',{verified:[identityCapture]},token);
  check(importIdentity.status===200 && importIdentity.body.imported===0 && importIdentity.body.enriched===0 && importIdentity.body.reviews.some(r=>r.type==='identity' && r.prospectId===identity.body.id) && !importIdentity.body.processedIds.includes(identityCapture.id),'Import : même SIRET sous autre nom signalé pour confirmation, capture conservée');
  await monitoringMaintenance('legacy-identity',identity.body.id);
  const legacyIdentity=await request('GET',`/prospects/${identity.body.id}`,undefined,token);
  check(legacyIdentity.body.identityConflicts.length===1 && legacyIdentity.body.identityConflicts[0].company==='Ancien doublon','Migration répétable : anciennes fiches conservées et doublon signalé');
  const legacyIdentityEdit=await request('PATCH',`/prospects/${identity.body.id}`,{phone:'03 20 11 22 33'},token);
  check(legacyIdentityEdit.status===200 && legacyIdentityEdit.body.identityConflicts.length===1,'Ancien doublon : modification hors identité possible et alerte conservée');
  const legacyId=legacyIdentity.body.identityConflicts[0].id;
  await request('DELETE',`/prospects/${identity.body.id}`,undefined,token);
  check((await request('POST','/prospects',{company:'Encore un doublon',siret:'98107525200016'},token)).status===409,'Protection maintenue quand seule une ancienne fiche en double subsiste');
  const repaired=await request('PATCH',`/prospects/${legacyId}`,{siret:'98107525200032'},token);
  check(repaired.status===200 && repaired.body.identityConflicts.length===0,'Correction manuelle du SIRET : alerte levée sans supprimer de fiche');
  check((await request('POST','/prospects',{company:'SIRET corrigé déjà utilisé',siret:'98107525200032'},token)).status===409,'Fiche ancienne corrigée : unicité active sur son nouveau SIRET');

  if(realPostgresUrl) for(const kind of ['device','job']) {
    const race=await importIdentityRace(kind,token,societeCapture);
    check(race.status===200 && race.body.imported===2 && race.body.skipped===1 && race.rows.length===3,
      'Course import '+kind+' : doublon sauté, fiches avant/après importées sans interruption');
    if(kind==='device')check(race.body.processedIds.includes(race.records[0].id) && race.body.processedIds.includes(race.records[2].id) && !race.body.processedIds.includes(race.records[1].id),
      'Course connecteur : identifiants déjà traités renvoyés, capture en conflit conservée');
  }

  console.log("\nPASS — installation, CRM, IA, audit de lecture isolé et sécurité validés\n");
} catch (error) {
  process.exitCode = 1;
  console.error("\nFAIL —", error.message, "\n");
  if (apiErrorLog.trim()) console.error("Diagnostic API isolée (erreurs uniquement) :", apiErrorLog.slice(-3800));
} finally {
  for (const child of processes.reverse()) {
    if (child.pid) { try { process.kill(-child.pid, "SIGTERM"); } catch { /* already stopped */ } }
  }
  await Promise.all([
    new Promise(resolve => companies.close(resolve)),
    new Promise(resolve => ollama.close(resolve)),
    new Promise(resolve => pagesJaunes.close(resolve)),
    new Promise(resolve => browserStub.close(resolve)),
  ]);
  await rm(ephemeralDbDir, { recursive: true, force: true });
}
