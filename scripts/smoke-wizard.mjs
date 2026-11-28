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
import { mkdtemp, rm, readFile } from "node:fs/promises";
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

const [dbPort, apiPort, companiesPort, ollamaPort, pagesJaunesPort, browserPort,cloudPort] = await Promise.all([
  availablePort(), availablePort(), availablePort(), availablePort(), availablePort(), availablePort(),availablePort(),
]);
const base = `http://127.0.0.1:${apiPort}/api/v1`;
const testEnv = {
  ...process.env,
  DATABASE_URL: realPostgresUrl ?? `postgresql://postgres:postgres@127.0.0.1:${dbPort}/postgres`,
  JWT_SECRET: randomBytes(48).toString("hex"),
  JWT_REFRESH_SECRET: randomBytes(48).toString("hex"),
  ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  SETUP_TOKEN: setupToken,
  WEBSITE_TEST_URL: `http://127.0.0.1:${companiesPort}/website`,
  BODACC_TEST_URL: `http://127.0.0.1:${companiesPort}/bodacc`,
  COMPANY_DIRECTORY_API_URL: `http://127.0.0.1:${companiesPort}/search`,
  GROWTHOS_SMOKE_TEST: "true",
  PAGESJAUNES_TEST_ORIGIN: `http://127.0.0.1:${pagesJaunesPort}`,
  PAGESJAUNES_BROWSER_URL: `http://127.0.0.1:${browserPort}`,
  CLOUD_BROWSER_URL:`http://127.0.0.1:${cloudPort}`,
  CLOUD_BROWSER_TOKEN:randomBytes(32).toString('hex'),
  INSEE_TEST_URL:`http://127.0.0.1:${cloudPort}/insee`,
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
    if(action==='legacy-empty-label')await pool.query('UPDATE prospects SET naf_label=NULL WHERE id=$1',[id]);
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
async function runCloudMaintenance(id){
  const code=`import {pool} from '@workspace/db';import {runCloudJob} from './src/services/cloud-browser.ts';await runCloudJob(process.argv[1]);await pool.end();`;
  await new Promise((resolve,reject)=>{
    const child=spawn('node',['--import','tsx','--input-type=module','-e',code,id],{cwd:join(root,'artifacts/api-server'),env:testEnv,stdio:['ignore','pipe','pipe']});
    let errors='';child.stderr.on('data',chunk=>errors+=String(chunk));child.on('error',reject);child.on('exit',status=>status===0?resolve():reject(new Error('Tâche cloud : '+errors.slice(-1600))));
  });
}

async function runEnrichmentMaintenance(id,count=25){
  const code=`import {pool} from '@workspace/db';import {runProspectEnrichment} from './src/services/prospect-enrichment.ts';import {runCloudJob} from './src/services/cloud-browser.ts';
    for(let n=0;n<Number(process.argv[2]);n++){
      await runProspectEnrichment(process.argv[1]);
      const q=await pool.query("SELECT id FROM cloud_browser_jobs WHERE result->>'enrichmentRunId'=$1 AND status='queued'",[process.argv[1]]);
      for(const job of q.rows)await runCloudJob(job.id);
    }await pool.end();`;
  await new Promise((resolve,reject)=>{
    const child=spawn('node',['--import','tsx','--input-type=module','-e',code,id,String(count)],{cwd:join(root,'artifacts/api-server'),env:testEnv,stdio:['ignore','pipe','pipe']});
    let errors='';child.stderr.on('data',c=>errors+=String(c));child.on('error',reject);child.on('exit',s=>s===0?resolve():reject(Error('Enrichissement isolé : '+errors.slice(-1200))));
  });
}

async function mergeFixtureSql(command,args=[]){
  const code=`import {pool} from '@workspace/db';const r=await pool.query(process.argv[1],JSON.parse(process.argv[2]));console.log(JSON.stringify(r.rows));await pool.end();`;
  return new Promise((resolve,reject)=>{
    const child=spawn('node',['--import','tsx','--input-type=module','-e',code,command,JSON.stringify(args)],{cwd:join(root,'artifacts/api-server'),env:testEnv,stdio:['ignore','pipe','pipe']});
    let output='',errors='';child.stdout.on('data',c=>output+=String(c));child.stderr.on('data',c=>errors+=String(c));child.on('error',reject);child.on('exit',status=>status===0?resolve(JSON.parse(output.trim())):reject(Error('Recette fusion : '+errors.slice(-1500))));
  });
}

async function enrichmentReadFailure(install){
  const command=install?'ALTER TABLE prospect_enrichment_jobs RENAME TO growthos_test_unavailable_enrichment':'ALTER TABLE growthos_test_unavailable_enrichment RENAME TO prospect_enrichment_jobs';
  const code=`import {pool} from '@workspace/db';await pool.query(process.argv[1]);await pool.end();`;
  await new Promise((resolve,reject)=>{
    const child=spawn('node',['--import','tsx','--input-type=module','-e',code,command],{cwd:join(root,'artifacts/api-server'),env:testEnv,stdio:['ignore','pipe','pipe']});
    let errors='';child.stderr.on('data',chunk=>errors+=String(chunk));child.on('error',reject);child.on('exit',status=>status===0?resolve():reject(Error('Recette indisponibilité bilan : '+errors.slice(-1000))));
  });
}

async function cloudReceiptFailure(action){
  const code=`import {pool} from '@workspace/db';
    if(process.argv[1]==='install')await pool.query(\`CREATE FUNCTION growthos_test_receipt_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.query='receipt-rollback' AND NEW.result ? 'imports' THEN RAISE EXCEPTION 'isolated receipt failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER growthos_test_receipt_failure BEFORE UPDATE ON cloud_browser_jobs FOR EACH ROW EXECUTE FUNCTION growthos_test_receipt_failure();\`);
    else await pool.query('DROP TRIGGER IF EXISTS growthos_test_receipt_failure ON cloud_browser_jobs; DROP FUNCTION IF EXISTS growthos_test_receipt_failure();');
    await pool.end();`;
  await new Promise((resolve,reject)=>{
    const child=spawn('node',['--import','tsx','--input-type=module','-e',code,action],{cwd:join(root,'artifacts/api-server'),env:testEnv,stdio:['ignore','pipe','pipe']});
    let errors='';child.stderr.on('data',chunk=>errors+=String(chunk));child.on('error',reject);child.on('exit',status=>status===0?resolve():reject(new Error('Recette transaction : '+errors.slice(-1200))));
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

async function bodaccCheckpoint(prospectId,jobId,phase){
  const code=String.raw`import {pool} from '@workspace/db';import {randomUUID} from 'node:crypto';import {fetchBodaccPage,saveBodaccPage} from './src/services/bodacc.ts';import {runProspectEnrichment} from './src/services/prospect-enrichment.ts';
    const [prospectId,id,phase]=process.argv.slice(1),lease=randomUUID();
    const p=(await pool.query('SELECT * FROM prospects WHERE id=$1',[prospectId])).rows[0],siren=p.siren;
    let job=(await pool.query("UPDATE prospect_enrichment_jobs SET status='running',lease=$2,lease_until=NOW()+INTERVAL '2 minutes',steps=$3 WHERE id=$1 RETURNING *",[id,lease,JSON.stringify({bodacc:{label:'BODACC',status:'pending'}})])).rows[0];
    await saveBodaccPage(job,siren,await fetchBodaccPage(siren,0),job.steps.bodacc);
    job=(await pool.query('SELECT * FROM prospect_enrichment_jobs WHERE id=$1',[id])).rows[0];
    if(phase==='replay'){
      const final=await fetchBodaccPage(siren,job.steps.bodacc.offset);
      await saveBodaccPage(job,siren,final,job.steps.bodacc);
      await saveBodaccPage(job,siren,final,job.steps.bodacc);
    }
    const saved=(await pool.query('SELECT steps FROM prospect_enrichment_jobs WHERE id=$1',[id])).rows[0];
    await pool.query("UPDATE prospect_enrichment_jobs SET status='queued',lease=NULL,lease_until=NULL WHERE id=$1",[id]);
    if(phase==='replay')await runProspectEnrichment(id);
    const result=(await pool.query('SELECT source_details FROM prospects WHERE id=$1',[prospectId])).rows[0];
    const activity=(await pool.query("SELECT count(*)::int AS n FROM activities WHERE prospect_id=$1 AND title='Enrichissement · BODACC'",[prospectId])).rows[0];
    console.log(JSON.stringify({checkpoint:saved.steps.bodacc,announcements:result.source_details.bodacc.announcements.length,activities:activity.n}));await pool.end();`;
  return new Promise((resolve,reject)=>{
    const child=spawn('node',['--import','tsx','--input-type=module','-e',code,prospectId,jobId,phase],{cwd:join(root,'artifacts/api-server'),env:testEnv,stdio:['ignore','pipe','pipe']});
    let output='',errors='';child.stdout.on('data',s=>output+=s);child.stderr.on('data',s=>errors+=s);child.on('error',reject);child.on('exit',status=>{if(status!==0)return reject(Error(errors.slice(-2000)));try{resolve(JSON.parse(output.trim().split('\n').at(-1)));}catch(e){reject(e);}});
  });
}

async function seedManualParent(prospectId,jobId){
  const code=String.raw`import {pool} from '@workspace/db';
    const [id,child]=process.argv.slice(1),steps={societe_com:{label:'Societe.com',status:'needs_review',jobId:child},entreprises:{label:'Annuaire',status:'empty'},insee:{label:'INSEE',status:'skipped'},bodacc:{label:'BODACC',status:'skipped'},pappers:{label:'Pappers',status:'awaiting_user'}};
    await pool.query("INSERT INTO prospect_enrichment_jobs(tenant_id,created_by,prospect_id,status,steps) SELECT tenant_id,created_by,prospect_id,'partial',$2 FROM cloud_browser_jobs WHERE id=$1",[child,JSON.stringify(steps)]);await pool.end();`;
  await new Promise((resolve,reject)=>{const child=spawn('node',['--import','tsx','--input-type=module','-e',code,prospectId,jobId],{cwd:join(root,'artifacts/api-server'),env:testEnv,stdio:['ignore','pipe','pipe']});let errors='';child.stderr.on('data',s=>errors+=s);child.on('error',reject);child.on('exit',status=>status===0?resolve():reject(Error(errors.slice(-1000))));});
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

const liveNord=JSON.parse(await readFile(join(root,'workers/cloud-browser/fixtures/annuaire-nord-artisan.json'),'utf8'));
const liveBodacc=JSON.parse(await readFile(join(root,'workers/cloud-browser/fixtures/bodacc-nord-artisan.json'),'utf8'));
let bodaccVersion=0;const bodaccCalls=[];
let watchVersion=0,watchDown=false,watchWrongIdentity=false,watchRequests=0,watchEmptyAddress=false,watchStale=false;
const companies = createServer((req, res) => {
  if(req.url?.startsWith('/website?')){
    const url=new URL(new URL(req.url,'http://localhost').searchParams.get('url'));
    const multiSite='<h1>Mentions légales</h1><p>Le site est édité par :</p><p><strong>ATELIER EDITEUR</strong></p><p>Siège social : 18 rue du Test, 59100 Roubaix</p><p>SIREN : <strong>966 777 093</strong></p><p>SIRET : <span>966 777 093 00019</span></p><p>Code APE/NAF : <b>43.22A</b></p><p>Téléphone : 03 20 11 22 33</p><p>Téléphone dépannage : 06 11 22 33 44</p><p>Email : contact.atelier@gmail.com</p><p>Email : devis@atelier-multiple.fr</p><p>Agence : 19 rue du Test, 59100 Roubaix</p><h2>Hébergeur</h2><p>SIRET : 96688888800019</p><p>Email : support@host.example</p>';
    const investigation='<h1>Expert plombier chauffagiste métropole</h1><p>Hydreo intervient dans la métropole.</p><a href="/plomberie">Plomberie</a><a href="/contact">Contact</a><footer><p>hydreo59@gmail.com</p><p>03 20 11 22 33</p><p>Du lundi au samedi de 9h à 19h</p><a href="https://www.linkedin.com/in/alice-martin-12ab34cd"><svg><title>LinkedIn</title></svg></a><a href="https://www.facebook.com/people/Hydreo-59/100083348056733"><svg>Facebook</svg></a></footer>';
    const publicPerson='<h1>Alice Martin</h1><p>Plombier chauffagiste chez Hydreo</p>';
    const html=url.hostname==='www.linkedin.com'?publicPerson:url.hostname==='hydreo-site.fr'?investigation:url.hostname==='atelier-multiple.fr'?multiSite:url.hostname==='atelier-site.fr'?'<h1>Atelier Site</h1><a href="/contact">Contact</a><p>SIRET : 96677709200019</p><p>8 rue du Test 59100 Roubaix</p><a href="tel:0320112233">Téléphone</a>'+(url.pathname==='/contact'?'<a href="mailto:contact@atelier-site.fr">Email</a><a href="https://www.linkedin.com/company/atelier-site">LinkedIn</a>':''):'';
    res.setHeader('Content-Type','text/html');res.end(html);return;
  }
  if(req.url?.startsWith('/bodacc?')){
    const u=new URL(req.url,'http://localhost'),siren=u.searchParams.get('where')?.match(/\d{9}/)?.[0],offset=Number(u.searchParams.get('offset')||0);
    bodaccCalls.push({siren,offset});
    const records=siren==='979965506'?[...liveBodacc.results,{...liveBodacc.results[0],id:'C202699999999',registre:['123456789']}]:Array.from({length:105},(_,i)=>({id:'C'+String(2026000000+i),dateparution:'2026-11-25',familleavis_lib:'Modifications diverses',commercant:'Entreprise recette',registre:[siren],modificationsgenerales:JSON.stringify({descriptif:i===0&&bodaccVersion?'Modification corrigée':'Modification publiée'})}));
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({total_count:records.length,results:records.slice(offset,offset+100)}));return;
  }
  if (!req.url?.startsWith("/search?")) { res.writeHead(404).end(); return; }
  const directoryQuery = new URL(req.url, 'http://localhost').searchParams.get("q");
  if(directoryQuery==='Nord Artisan Lille'||directoryQuery==='97996550600012'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({results:[liveNord]}));return;}
  if(directoryQuery?.startsWith('Nord Artisan Recette')||directoryQuery==='96677705500019'){
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({results:[{siren:'966777055',nom_complet:'ATELIER OFFICIEL NORD',activite_principale:'43.22A',etat_administratif:'A',
      dirigeants:[{nom:'Recette',prenoms:'Alice',qualite:'Gérante'}],siege:{siret:'96677705500019',adresse:'8 rue du Test 59100 Roubaix',code_postal:'59100',libelle_commune:'Roubaix',noms_commerciaux:['Nord Artisan Recette'],activite_principale:'43.22A'}}]}));return;
  }
  if(directoryQuery==='96677705600019'){
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({results:[{siren:'966777056',nom_complet:'Activité locale conservée',activite_principale:'70.10Z',siege:{siret:'96677705600019',adresse:'9 rue Scope 59100 Roubaix',code_postal:'59100',libelle_commune:'Roubaix'}}]}));return;
  }
  if(directoryQuery==='96677709200019'||directoryQuery==='966777092'){
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({results:[{siren:'966777092',nom_complet:'Atelier Site',siege:{siret:'96677709200019',adresse:'8 rue du Test 59100 Roubaix',code_postal:'59100',libelle_commune:'Roubaix'}}]}));return;
  }
  if(directoryQuery==='96677709300019'||directoryQuery==='966777093'){
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({results:[{siren:'966777093',nom_complet:'ATELIER EDITEUR',activite_principale:'43.22A',dirigeants:[{nom:'Editeur',prenoms:'Chloé',qualite:'Gérante'}],siege:{siret:'96677709300019',adresse:'18 rue du Test 59100 Roubaix',code_postal:'59100',libelle_commune:'Roubaix'}}]}));return;
  }
  if(directoryQuery==='Hydreo'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({results:[]}));return;}
  if(directoryQuery==='Alice Martin'){
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({results:[{siren:'966777094',nom_complet:'ALICE MARTIN',etat_administratif:'A',activite_principale:'43.22A',dirigeants:[{nom:'Martin',prenoms:'Alice',qualite:'Gérante'}],siege:{siret:'96677709400019',etat_administratif:'A',adresse:'28 rue de la Source 59100 Roubaix',code_postal:'59100',libelle_commune:'Roubaix',noms_commerciaux:['Hydreo']}}]}));return;
  }
  if(directoryQuery==='cloud-official-area'){
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({results:[{siren:'966777058',nom_complet:'Agence Lille et siège Paris',siege:{siret:'96677705800019',adresse:'1 rue Paris 75001 Paris',code_postal:'75001',libelle_commune:'Paris'},matching_etablissements:[{siret:'96677705800027',adresse:'1 rue Lille 59000 Lille',code_postal:'59000',libelle_commune:'Lille'}]}]}));return;
  }
  if(directoryQuery==='cloud-official-many'){
    const page=Number(new URL(req.url,'http://localhost').searchParams.get('page')||1),start=page===1?0:25,end=page===1?25:35;
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({total_pages:2,results:Array.from({length:end-start},(_,n)=>{const i=start+n,siren=String(966778000+i);return {siren,nom_complet:'Annuaire continu '+i,siege:{siret:siren+'00019',adresse:(i+1)+' rue Officielle 59100 Roubaix',code_postal:'59100',libelle_commune:'Roubaix'}};})}));return;
  }
  if(directoryQuery?.startsWith('777000003')){
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify({results:[{siren:'777000003',nom_complet:'Entreprise identité corrigée',etat_administratif:'A',
      date_mise_a_jour:directoryQuery.endsWith('00027')?'2019-01-01':'2020-01-01',activite_principale:'43.22A',
      siege:{siret:'77700000300019',etat_administratif:'A',adresse:'1 rue du Test 59100 Roubaix',code_postal:'59100',libelle_commune:'Roubaix',activite_principale:'43.22A'},
      matching_etablissements:[{siret:'77700000300027',etat_administratif:'A',adresse:'2 rue du Test 59000 Lille',code_postal:'59000',libelle_commune:'Lille',activite_principale:'43.21A'}],
    }]}));return;
  }
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
const cloudCalls=[];let cloudDelay=0,inseeCalls=0,cloudUnavailable=false;
const cloudStub=createServer(async(req,res)=>{
  if(cloudUnavailable){req.socket.destroy();return;}
  res.setHeader('Content-Type','application/json');
  if(req.url==='/insee'){
    if(req.headers['x-insee-api-key-integration']!=='isolated-insee-key'){res.writeHead(401).end('{}');return;}
    inseeCalls++;res.end(JSON.stringify({etablissement:{siren:'966777055',siret:'96677705500019',adresseEtablissement:{numeroVoieEtablissement:'8',typeVoieEtablissement:'rue',libelleVoieEtablissement:'du Test',codePostalEtablissement:'59100',libelleCommuneEtablissement:'Roubaix'},periodesEtablissement:[{dateFin:null,etatAdministratifEtablissement:'A',activitePrincipaleEtablissement:'43.22A',nomenclatureActivitePrincipaleEtablissement:'NAFRev2'}]}}));return;
  }
  if(req.headers['x-worker-token']!==testEnv.CLOUD_BROWSER_TOKEN){res.writeHead(401).end(JSON.stringify({error:'Token requis'}));return;}
  if(req.method==='GET'&&req.url==='/healthz'){res.end(JSON.stringify({ok:true}));return;}
  let raw='';for await(const chunk of req)raw+=chunk;
  const p=JSON.parse(raw);
  cloudCalls.push({action:req.url,tenantId:p.tenantId,profileId:p.profileId,source:p.source});
  if(req.url==='/open'){res.end(JSON.stringify({ok:true,controlId:'10000000-0000-4000-8000-000000000001',url:'https://www.societe.com/'}));return;}
  if(req.url==='/view'){res.end(JSON.stringify({ok:true,image:'data:image/jpeg;base64,ZmFrZQ==',url:'https://www.societe.com/',width:1280,height:800}));return;}
  if(req.url==='/action'&&p.event?.text==='RECETTE_ERREUR_SECRETE_NON_STOCKEE'){req.socket.destroy();return;}
  if(['/action','/erase','/stop'].includes(req.url)){res.end(JSON.stringify({ok:true}));return;}
  if(req.url==='/collect'){
    if(cloudDelay)await delay(cloudDelay);
    if(p.query==='cloud-wait'){res.end(JSON.stringify({status:'awaiting_user',message:'Connexion à vérifier',results:[]}));return;}
    if(p.query==='cloud-fail'){res.writeHead(503).end(JSON.stringify({error:'Source indisponible'}));return;}
    if(p.source==='pappers'){
      const siren=p.target?.siren||p.target?.siret?.slice(0,9)||'966777055',siret=siren==='979965506'?'97996550600020':p.target?.siret;
      res.end(JSON.stringify({status:'completed',results:[{source:'pappers',company:p.target?.company||'Entreprise recette',siren,siret,address:'34 place du Général de Gaulle 59800 Lille',city:'Lille',codePostal:'59800',sourceUrl:'https://www.pappers.fr/entreprise/entreprise-'+siren,companyDetails:{fields:{'Capital social':'500 €'},managers:['Paul PAPPERS'],managerContacts:[{name:'Paul PAPPERS',role:'Président',phone:null,email:null,profileUrl:'https://www.pappers.fr/dirigeant/paul_pappers_1970-01'}],establishments:[],links:[]}}]}));return;
    }
    if(p.target?.company==='Nord Artisan Recette'){
      if(p.source==='societe_com'){res.end(JSON.stringify({status:'completed',results:[{source:'societe_com',company:'MONSIEUR KEVIN DUVILLE',siret:'79313784500019',city:'Roubaix',address:'8 rue du Test 59100 Roubaix',codePostal:'59100',sourceUrl:'https://www.societe.com/societe/monsieur-kevin-duville-793137845.html'}]}));return;}
      res.end(JSON.stringify({status:'completed',results:[{source:p.source,company:p.target.company,address:'8 rue du Test 59100 Roubaix',codePostal:'59100',city:'Roubaix',
        phone:p.source==='bing'?'03 20 55 66 99':'03 20 55 66 77',email:'contact@nord-recette.invalid',website:'https://nord-recette.invalid',
        sourceUrl:p.source==='pagesjaunes'?'https://www.pagesjaunes.fr/pros/96677755':p.source==='google_maps'?'https://www.google.com/maps/place/Nord-Artisan-Recette/':p.source==='bing'?'https://www.bing.com/search?q=Nord':'https://www.google.com/search?q=Nord'}]}));return;
    }
    if(p.query==='live-maps-detail'){
      const address='38 Bd Carnot, 59800 Lille';
      res.end(JSON.stringify({status:'completed',results:[{source:'google_maps',company:'Nord Artisan',address,city:'Lille',codePostal:'59800',phone:'07 80 99 59 59',sourceUrl:'https://www.google.com/maps/search/Nord+Artisan+Lille',mapsDetail:{title:'Nord Artisan',address}}]}));return;
    }
    if(p.query==='live-societe-hq'){
      res.end(JSON.stringify({status:'completed',results:[{source:'societe_com',company:'NORD ARTISAN',siret:'97996550600020',address:'34 PLACE DU GENERAL DE GAULLE BUREAU 3, 59800 LILLE',city:'LILLE',codePostal:'59800',phone:null,sourceUrl:'https://www.societe.com/societe/nord-artisan-979965506.html',companyDetails:{fields:{'Forme juridique':'SAS'},managers:['Alice RECETTE'],managerContacts:[{name:'Alice RECETTE',role:'Présidente',phone:null,email:null,profileUrl:'https://www.societe.com/manager/Alice.RECETTE.123.html'}],establishments:[{siret:'97996550600020',address:'34 PLACE DU GENERAL DE GAULLE BUREAU 3, 59800 LILLE'}],links:[]}}]}));return;
    }
    if(p.query==='organic-only'){res.end(JSON.stringify({status:'completed',results:[],references:[{url:'https://nordartisan.fr/',label:'Nord Artisan'}],message:'Résultats Web consultés : aucun nouveau champ confirmé.'}));return;}
    if(p.query==='cloud-siren-only'){
      res.end(JSON.stringify({status:'completed',results:[{source:p.source,company:'Établissement ciblé',siren:'966777057',siret:null,city:'Roubaix',address:'99 rue Autre 59100 Roubaix',codePostal:'59100',phone:'03 20 55 00 99',email:'autre@recette.invalid',sourceUrl:'https://www.pagesjaunes.fr/pros/96677757'}]}));return;
    }
    if(p.query==='cloud-many'){
      const start=p.cursor?.step===1?25:0,end=start?38:25;
      const results=Array.from({length:end-start},(_,n)=>{const i=start+n;return {source:p.source,company:'Collecte continue '+i,address:(i+1)+' rue du Flux 59100 Roubaix',codePostal:'59100',city:'Roubaix',phone:'03'+String(50000000+i),sourceUrl:'https://www.google.com/maps/place/Collecte-'+i+'/'};});
      res.end(JSON.stringify({status:'completed',results,drafts:[],hasMore:start===0,cursor:{source:p.source,step:1}}));return;
    }
    if(['receipt-mixed','receipt-legacy','receipt-legacy-conflict','receipt-rollback'].includes(p.query)){
      const row=(company,number,phone)=>({source:'google_maps',company,address:number+' rue du Test 59100 Roubaix',codePostal:'59100',city:'Roubaix',phone,sourceUrl:'https://www.google.com/maps/place/'+encodeURIComponent(company)+'/'});
      const values=p.query==='receipt-mixed'?[row('Import cloud neuf',10,'03 00 41 01 01'),row('CRM cloud existant',20,'03 00 41 01 02'),row('CRM cloud contradictoire',30,'03 00 41 01 03'),{...row('Import cloud incomplet',35,null),codePostal:null}]
        :[row(p.query.startsWith('receipt-legacy')?'Ancien import cloud':'Import cloud transaction',40,p.query==='receipt-legacy-conflict'?'03 00 41 09 99':'03 00 41 01 04')];
      res.end(JSON.stringify({status:'completed',results:values,drafts:[]}));return;
    }
    const siret=p.query==='cloud-wrong'?'96677700900019':p.target?.siret||'96677700200019';
    res.end(JSON.stringify({status:'completed',results:[{source:p.source,company:p.source==='pagesjaunes'&&p.target?p.target.company:p.target?'ATELIER CLOUD':'Entreprise trouvée',siret:p.source==='societe_com'?siret:null,
      address:'8 rue du Test 59100 Roubaix',codePostal:'59100',city:'Roubaix',phone:'03 20 99 88 77',
      website:'https://cloud-recette.example.org',apeCode:'43.22A',
      sourceUrl:p.source==='societe_com'?'https://www.societe.com/societe/atelier-cloud-'+siret.slice(0,9)+'.html':p.source==='pagesjaunes'?'https://www.pagesjaunes.fr/pros/87654321':'https://www.google.com/maps/place/Entreprise/',
      ...(p.source==='societe_com'?{companyDetails:{fields:{'Forme juridique':'SAS'},managers:['Alice CLOUD'],establishments:[],links:[]}}:{}),
      ...(p.source==='pagesjaunes'?{pagesjaunesProfile:{sourceUrl:'https://www.pagesjaunes.fr/pros/87654321',name:p.target?p.target.company:'Entreprise trouvée',
        address:'8 rue du Test 59100 Roubaix',codePostal:'59100',city:'Roubaix',phone:'03 20 99 88 77',email:null,website:'https://cloud-recette.example.org',
        siret:null,siren:'966777008',description:'Atelier de plomberie avec entretien et dépannage',openingHours:p.query==='cloud-pj-refresh'?'Lundi : 10h00–19h00':'Lundi : 09h00–18h00',
        services:'Entretien · Dépannage',legal:'SIREN : 966777008',socials:{facebook:'https://www.facebook.com/atelier-recette'},rating:4.6,reviewCount:3,
        reviews:[{author:'Client recette',date:null,text:'Intervention professionnelle, rapide et soignée.'}],capturedAt:new Date().toISOString()}}:{}),
    }],drafts:[]}));return;
  }
  res.writeHead(404).end(JSON.stringify({error:'Route inconnue'}));
});

try {
  console.log("\nGrowthOS — tests d'installation isolés");
  await Promise.all([
    new Promise(resolve => companies.listen(companiesPort, "127.0.0.1", resolve)),
    new Promise(resolve => ollama.listen(ollamaPort, "127.0.0.1", resolve)),
    new Promise(resolve => pagesJaunes.listen(pagesJaunesPort, "127.0.0.1", resolve)),
    new Promise(resolve => browserStub.listen(browserPort, "127.0.0.1", resolve)),
    new Promise(resolve => cloudStub.listen(cloudPort,'127.0.0.1',resolve)),
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
  // Persistent, tenant-scoped diagnostics must be ready on the very first boot.
  check((await request('GET','/diagnostics/summary')).status===401,'Diagnostics : lecture interdite hors connexion');
  const diagnosticSummary=await request('GET','/diagnostics/summary',undefined,token);
  check(diagnosticSummary.status===200&&Array.isArray(diagnosticSummary.body.levels),'Diagnostics : tableau de bord accessible à l’administrateur');
  const diagnosticClient=await request('POST','/diagnostics/client-events',{
    code:'SMOKE_FRONTEND_FAILURE',message:'Erreur simulée côté navigateur',details:{reason:'Cloudflare challenge',secret:'never-store-me',cookie:'never-store-cookie'},
  },token);
  check(diagnosticClient.status===202,'Diagnostics : signalements frontend enregistrables');
  const diagnosticEvents=await request('GET','/diagnostics/events?search=SMOKE_FRONTEND_FAILURE',undefined,token);
  check(diagnosticEvents.status===200&&diagnosticEvents.body.events.length===1&&
    !JSON.stringify(diagnosticEvents.body.events[0].details).includes('never-store'),
    'Diagnostics : recherche tenant-aware et expurgation des secrets');
  check((await request('GET','/diagnostics/sources',undefined,token)).status===200,'Diagnostics : état des sources consultable');
  const diagnosticExport=await request('GET','/diagnostics/export?search=SMOKE_FRONTEND_FAILURE',undefined,token);
  check(diagnosticExport.status===200&&diagnosticExport.body.diagnosticEvents.length===1,
    'Diagnostics : export JSON exploitable par les agents');
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
  check(forgedChoice.status===200&&forgedChoice.body.alreadyResolved,'Une résolution déjà traitée est acquittée sans rejouer la décision');
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
    check(enriched.status===200 && enriched.body.conflicts===2,'Régression Chauffagiste : même SIRET, nom/ville/adresse différents proposés sans bloquer la capture');
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
    check(changes.every(r=>r.status===200) && after.body.company==='Ancien nom'&&after.body.sourceDetails.identity.legalName==='SOLUTION ENR' && after.body.address===capture.address && after.body.sourceDetails.crossSource.conflicts.length===0,
      'Résolutions concurrentes : nom et adresse appliqués sans perdre les décisions');
    const activities=await request('GET','/activities?prospectId='+id+'&scope=history',undefined,token);
    const cityHistory=activities.body.find(a=>a.type==='data_update' && a.description.includes('Chauffagiste → Roubaix'));
    check(activities.body.length===3 && cityHistory?.description.includes(capture.sourceUrl) && cityHistory.createdBy,
      'Historique réel de la fiche : enrichissement et trois corrections, auteur, source et valeurs avant/après');
    await request('POST',path+'/enrich-capture',{taskId,capture,confirmed:true},token);
    await request('POST',path+'/resolve-conflict',{conflictId:city.id,decision:'use_incoming'},token);
    check((await request('GET','/activities?prospectId='+id,undefined,token)).body.length===3,
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
  {
    const target=await request('POST','/prospects',{company:'Nom commercial préservé',siret:'96677709900019',city:'Lille',address:'89 rue des Meuniers 59000 Lille'},token);
    const taskId=randomUUID(),path='/sourcing/device/prospects/'+target.body.id;
    const capture={id:'task_'+taskId,source:'societe_com',company:'MONSIEUR SOUMAILA DIABATE',siret:'96677709900019',city:'Lille',address:'APPT 38 89 RUE DES MEUNIERS 59000 LILLE',codePostal:'59000',capturedAt:Date.now(),sourceUrl:'https://www.societe.com/societe/monsieur-soumaila-diabate-966777099.html'};
    await request('POST',path+'/enrich-capture',{taskId,capture,confirmed:true},token);
    let p=(await request('GET','/prospects/'+target.body.id,undefined,token)).body;
    check(p.company==='Nom commercial préservé'&&p.sourceDetails.identity.legalName==='MONSIEUR SOUMAILA DIABATE','Identité : nom commercial conservé, raison sociale séparée pour le même SIRET');
    const restorePath=path+'/display-name';
    const rename=await request('POST',restorePath,{name:'Enseigne restaurée',expectedCurrentValue:p.company},token);
    check(rename.status===200&&rename.body.prospect.company==='Enseigne restaurée'&&rename.body.prospect.sourceDetails.identity.legalName==='MONSIEUR SOUMAILA DIABATE','Nom affiché : restauration explicite sans perdre raison sociale ni SIRET');
    check((await request('POST',restorePath,{name:'Autre nom',expectedCurrentValue:p.company},token)).status===409,'Nom affiché : modification concurrente protégée');
    const conflict=p.sourceDetails.crossSource.conflicts.find(c=>c.field==='address');
    await request('PATCH','/prospects/'+p.id,{address:'89 Rue des Meuniers, 59000 Lille'},token);
    const resolved=await request('POST',path+'/resolve-conflict',{conflictId:conflict.id,decision:'use_incoming',expectedCurrentValue:'89 Rue des Meuniers, 59000 Lille'},token);
    check(resolved.status===200&&resolved.body.prospect.address===capture.address&&!resolved.body.prospect.sourceDetails.crossSource.conflicts.length,'Désaccord : ancienne comparaison débloquée avec la valeur réellement affichée');
    const count=(await request('GET','/activities?prospectId='+p.id,undefined,token)).body.length;
    check((await request('POST',path+'/resolve-conflict',{conflictId:conflict.id,decision:'use_incoming'},token)).status===200&&(await request('GET','/activities?prospectId='+p.id,undefined,token)).body.length===count,'Désaccord : double validation idempotente sans nouvelle activité');
    const otherTask=randomUUID();await request('POST',path+'/enrich-capture',{taskId:otherTask,capture:{...capture,id:'task_'+otherTask,address:'90 rue des Meuniers 59000 Lille'},confirmed:true},token);
    p=(await request('GET','/prospects/'+p.id,undefined,token)).body;const other=p.sourceDetails.crossSource.conflicts.find(c=>c.field==='address');
    await request('PATCH','/prospects/'+p.id,{address:'Adresse modifiée entre deux clics'},token);
    check((await request('POST',path+'/resolve-conflict',{conflictId:other.id,decision:'use_incoming',expectedCurrentValue:capture.address},token)).status===409,'Désaccord : véritable modification concurrente toujours protégée');
    await request('PATCH','/prospects/'+p.id,{address:other.incoming},token);
    const already=await request('POST',path+'/resolve-conflict',{conflictId:other.id,decision:'use_incoming'},token);
    check(already.status===200&&!already.body.prospect.sourceDetails.crossSource.conflicts.length,'Désaccord : valeur déjà appliquée acquittée sans boucle de rechargement');
  }
  const siteStatus=await request('POST',`/prospects/${absentSite.body.id}/verify-company`,{},token);
  check(siteStatus.body.snapshot.fields['État de l’entreprise']==='Active' && siteStatus.body.snapshot.fields['État de l’établissement']===null,
    'Établissement absent de la réponse : état non vérifié, aucune activité déduite du siège');
  await request('PATCH',watchPath+'/monitoring',{enabled:true,intervalHours:24},token);
  await monitoringMaintenance('expire',watchId);watchVersion=3;
  await monitoringMaintenance('cron',watchId);
  const renamed=await request('GET',watchPath,undefined,token);
  check(renamed.body.company==='Entreprise de veille'&&renamed.body.sourceDetails.identity.legalName==='Entreprise de veille renommée' && renamed.body.apeCode==='43.21A' && renamed.body.nafLabel?.includes('électrique'),
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
  await request('PATCH',watchPath,{siren:'777000003',siret:'77700000300019'},token);
  await request('PATCH',watchPath+'/monitoring',{enabled:true,intervalHours:24},token);
  await monitoringMaintenance('expire',watchId);
  const correctedIdentity=await request('POST',watchPath+'/verify-company',{force:true},token);
  check(!correctedIdentity.body.error && correctedIdentity.body.snapshot.siren==='777000003' && correctedIdentity.body.snapshot.sourceUpdatedAt==='2020-01-01' &&
    (await request('GET',watchPath,undefined,token)).body.sourceDetails.identity.legalName==='Entreprise identité corrigée',
    'Veille : nouvelle entreprise après correction du SIREN acceptée malgré une date officielle plus ancienne');
  await request('PATCH',watchPath,{siret:'77700000300027'},token);
  await monitoringMaintenance('expire',watchId);
  const correctedSite=await request('POST',watchPath+'/verify-company',{force:true},token);
  check(!correctedSite.body.error && correctedSite.body.snapshot.requestedSiret==='77700000300027' && correctedSite.body.snapshot.sourceUpdatedAt==='2019-01-01' &&
    (await request('GET',watchPath,undefined,token)).body.city==='Lille',
    'Veille : changement de SIRET dans la même entreprise établit un nouveau contrôle sans comparer les dates de deux établissements');
  await request('PATCH',watchPath+'/monitoring',{enabled:false,intervalHours:24},token);

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

  {
    const state=await request('GET','/browser/status',undefined,token);
    check(state.body.configured && state.body.ready && state.body.automatic.includes('societe_com') && !state.body.automatic.includes('linkedin'),
      'Cloud : état réel du worker et capacités automatiques limitées aux collecteurs disponibles');
    check((await request('GET','/browser/profiles',undefined)).status===401,'Cloud : profils inaccessibles sans authentification GrowthOS');
    const made=await request('POST','/browser/profiles',{source:'societe_com',label:'Societe.com recette',mode:'public'},token);
    const profile=made.body;
    check(made.status===201 && profile.id && profile.mode==='public','Cloud : création du profil de source publique');
    check((await request('POST','/browser/profiles',{source:'unknown',label:'Source inconnue'},token)).status===400,'Cloud : source arbitraire refusée');
    const listed=await request('GET','/browser/profiles',undefined,token);
    check(listed.body.some(p=>p.id===profile.id) && !JSON.stringify(listed.body).includes(testEnv.CLOUD_BROWSER_TOKEN),'Cloud : profils listés sans secret du worker');
    check((await request('POST',`/browser/profiles/${profile.id}/open`,{query:'ATELIER',url:'http://127.0.0.1'},token)).status===400,
      'Cloud : URL arbitraire ou interne refusée par le contrat API');
    const opened=await request('POST',`/browser/profiles/${profile.id}/open`,{query:'ATELIER',area:'Roubaix'},token);
    check(opened.status===200 && opened.body.controlId,'Cloud : ouverture de la source avec contrôle de la vue');
    const screenshot=await request('POST',`/browser/profiles/${profile.id}/view`,{},token);
    check(screenshot.status===200 && screenshot.body.image.startsWith('data:image/jpeg;base64,'),'Cloud : vue transmise uniquement via la route authentifiée');
    const beforeForeign=cloudCalls.length;
    check((await request('POST',`/browser/profiles/${profile.id}/view`,{},foreignToken)).status===404 && cloudCalls.length===beforeForeign,
      'Cloud : autre agence refusée avant tout appel au worker ou à la session');
    const sameTenantPayload=JSON.parse(Buffer.from(token.split('.')[1],'base64url'));sameTenantPayload.userId=randomUUID();
    const unsigned=token.split('.')[0]+'.'+Buffer.from(JSON.stringify(sameTenantPayload)).toString('base64url');
    const colleague=unsigned+'.'+createHmac('sha256',testEnv.JWT_SECRET).update(unsigned).digest('base64url');
    check((await request('POST',`/browser/profiles/${profile.id}/view`,{},colleague)).status===404,'Cloud : profil personnel non accessible à un autre utilisateur de la même agence');
    const target=await request('POST','/prospects',{company:'Ancien nom cloud',siret:'96677700200019',city:'Chauffagiste',address:'Adresse erronée',lat:50.7,lng:3.1,phone:'03 20 11 22 33'},token);
    const created=await request('POST','/browser/jobs',{profileId:profile.id,prospectId:target.body.id,query:'96677700200019',area:'Roubaix'},token);
    check(created.status===201 && created.body.status==='queued' && created.body.mode==='enrich','Cloud : tâche ciblée persistée avant exécution');
    check((await request('POST',`/browser/profiles/${profile.id}/erase`,{},token)).status===409,'Cloud : déconnexion empêchée tant qu’un lot utilise le profil');
    await runCloudMaintenance(created.body.id);
    const done=await request('GET','/browser/jobs/'+created.body.id,undefined,token);
    const updated=await request('GET','/prospects/'+target.body.id,undefined,token);
    check(done.body.status==='completed' && done.body.result.applied.filled.includes('city'),'Cloud : lecture et fusion terminent la tâche automatiquement sans extension');
    check(updated.body.company==='Ancien nom cloud'&&updated.body.sourceDetails.identity.legalName==='ATELIER CLOUD' && updated.body.city==='Roubaix' && updated.body.postalCode==='59100' && updated.body.address==='8 rue du Test 59100 Roubaix' && updated.body.lat===null,
      'Cloud : SIRET exact corrige automatiquement identité et adresse avec invalidation de l’ancienne carte');
    check(updated.body.phone==='03 20 11 22 33' && updated.body.sourceDetails.crossSource.conflicts.some(c=>c.field==='phone'),
      'Cloud : téléphone divergent conservé comme proposition sans écrasement silencieux');
    const activity=await request('GET','/activities?prospectId='+target.body.id,undefined,token);
    check(activity.body.some(a=>a.type==='data_update' && a.description.includes('Chauffagiste → Roubaix') && a.description.includes('Enrichissement automatique')),
      'Cloud : mise à jour automatique relue dans les activités avec valeurs avant/après');
    await runCloudMaintenance(created.body.id);
    check((await request('GET','/activities?prospectId='+target.body.id,undefined,token)).body.length===activity.body.length &&
      (await request('POST','/browser/jobs/'+created.body.id+'/retry',{},token)).status===409,
      'Cloud : exécuter deux fois la même tâche terminée ne rejoue ni fusion ni activité');
    check((await request('GET','/browser/jobs/'+created.body.id,undefined,foreignToken)).status===404,'Cloud : résultat de tâche isolé par agence');
    const wrong=await request('POST','/browser/jobs',{profileId:profile.id,prospectId:target.body.id,query:'cloud-wrong'},token);
    await runCloudMaintenance(wrong.body.id);
    check((await request('GET','/browser/jobs/'+wrong.body.id,undefined,token)).body.status==='needs_review' &&
      (await request('GET','/prospects/'+target.body.id,undefined,token)).body.siret==='96677700200019',
      'Cloud : autre SIRET en revue sans modification du prospect');
    const reviewPath='/browser/jobs/'+wrong.body.id;
    const blockedReview=await request('GET',reviewPath+'/review',undefined,token);
    check(blockedReview.body.blocked,'Confirmation : SIREN contradictoire bloqué même après vérification visuelle');
    check((await request('POST',reviewPath+'/confirm',{captureIndex:0,confirmed:true,expectedUpdatedAt:blockedReview.body.version,expectedCaptureDigest:blockedReview.body.captureDigest},token)).status===409,'Confirmation : identité légale incompatible impossible à forcer');
    const manualTarget=await request('POST','/prospects',{company:'Enseigne à confirmer',city:'Chauffagiste',phone:'03 20 11 22 33'},token);
    const manualTask=randomUUID(),localCapture={source:'societe_com',company:'ATELIER MANUEL',siret:'96677709100019',address:'8 rue du Test 59100 Roubaix',city:'Roubaix',codePostal:'59100',phone:'03 20 99 88 77',sourceUrl:'https://www.societe.com/societe/atelier-manuel-966777091.html',capturedAt:Date.now()};
    const staged=await request('POST','/browser/local-review',{taskId:manualTask,prospectId:manualTarget.body.id,capture:localCapture},token);
    check(staged.status===200&&staged.body.job.status==='needs_review','Chrome local : capture conservée pour comparaison sans fusion prématurée');
    const manualPath='/browser/jobs/'+staged.body.job.id;
    await seedManualParent(manualTarget.body.id,staged.body.job.id);
    const review=await request('GET',manualPath+'/review',undefined,token);
    check(review.status===200&&!review.body.blocked&&review.body.fields.some(v=>v.field==='city'&&v.before==='Chauffagiste')&&review.body.fields.some(v=>v.field==='company'&&v.after==='ATELIER MANUEL'),'Confirmation : comparaison des valeurs actuelles avec la source malgré nom/ville différents');
    check((await request('GET',manualPath+'/review',undefined,foreignToken)).status===404&&(await request('GET',manualPath+'/review',undefined,colleague)).status===404,'Confirmation : comparaison privée isolée par utilisateur et agence');
    check((await request('POST',manualPath+'/confirm',{captureIndex:0,expectedUpdatedAt:review.body.version,expectedCaptureDigest:review.body.captureDigest},token)).status===400,'Confirmation : accord explicite requis');
    await request('POST','/browser/local-review',{taskId:manualTask,cloudJobId:staged.body.job.id,prospectId:manualTarget.body.id,capture:{...localCapture,phone:'03 20 99 88 76'}},token);
    check((await request('POST',manualPath+'/confirm',{captureIndex:0,confirmed:true,expectedUpdatedAt:review.body.version,expectedCaptureDigest:review.body.captureDigest},token)).status===409,'Confirmation : capture remplacée dans un autre onglet refusée avant toute fusion');
    await request('POST','/browser/local-review',{taskId:manualTask,cloudJobId:staged.body.job.id,prospectId:manualTarget.body.id,capture:localCapture},token);
    await request('PATCH','/prospects/'+manualTarget.body.id,{company:'Enseigne corrigée'},token);
    check((await request('POST',manualPath+'/confirm',{captureIndex:0,confirmed:true,expectedUpdatedAt:review.body.version,expectedCaptureDigest:review.body.captureDigest},token)).status===409,'Confirmation : modification concurrente détectée sans écrasement');
    const freshReview=await request('GET',manualPath+'/review',undefined,token);
    await request('PATCH','/prospects/'+manualTarget.body.id,{score:12},token);
    cloudUnavailable=true;
    check((await request('GET','/browser/status',undefined,token)).body.ready===false,'Validation locale : navigateur cloud indisponible pendant le test');
    const cloudCallsBeforeConfirm=cloudCalls.length;
    const confirmed=await request('POST',manualPath+'/confirm',{captureIndex:0,confirmed:true,expectedUpdatedAt:freshReview.body.version,expectedCaptureDigest:freshReview.body.captureDigest,expectedValues:freshReview.body.expectedValues,replaceFields:['company','city','phone']},token);
    check(cloudCalls.length===cloudCallsBeforeConfirm,'Validation locale : enregistrement sans appel au navigateur cloud');cloudUnavailable=false;
    const manualUpdated=(await request('GET','/prospects/'+manualTarget.body.id,undefined,token)).body;
    check(confirmed.status===200&&confirmed.body.job.status==='completed'&&manualUpdated.siret==='96677709100019'&&manualUpdated.company==='ATELIER MANUEL'&&manualUpdated.city==='Roubaix'&&manualUpdated.phone==='03 20 99 88 77','Confirmation : mise à jour de métadonnées sans blocage, identité et remplacements enregistrés dans le CRM');
    const parentAfter=(await request('GET','/prospects/'+manualTarget.body.id+'/enrichment',undefined,token)).body;
    check(parentAfter.steps.societe_com.status==='completed'&&parentAfter.status==='queued'&&['entreprises','insee','bodacc','pappers'].every(source=>parentAfter.steps[source].status==='pending'),'Confirmation : bilan parent actualisé et sources dépendant de l’identité reprogrammées');
    const manualActivities=(await request('GET','/activities?prospectId='+manualTarget.body.id,undefined,token)).body;
    check(manualActivities.some(a=>a.type==='data_update'&&a.description.includes('confirmée')&&a.description.includes('Chauffagiste → Roubaix')),'Confirmation : historique avec utilisateur et valeurs avant/après');
    check((await request('POST',manualPath+'/confirm',{captureIndex:0,confirmed:true,expectedUpdatedAt:freshReview.body.version,expectedCaptureDigest:freshReview.body.captureDigest},token)).body.alreadyApplied===true&&(await request('GET','/activities?prospectId='+manualTarget.body.id,undefined,token)).body.length===manualActivities.length,'Confirmation : double clic sans nouvelle activité ni nouvelle fusion');
    const duplicateTarget=await request('POST','/prospects',{company:'Doublon à vérifier'},token),duplicateTask=randomUUID();
    const duplicateStage=await request('POST','/browser/local-review',{taskId:duplicateTask,prospectId:duplicateTarget.body.id,capture:localCapture},token);
    const duplicatePath='/browser/jobs/'+duplicateStage.body.job.id,duplicateReview=await request('GET',duplicatePath+'/review',undefined,token);
    const duplicateConfirm=await request('POST',duplicatePath+'/confirm',{captureIndex:0,confirmed:true,expectedUpdatedAt:duplicateReview.body.version,expectedCaptureDigest:duplicateReview.body.captureDigest,expectedValues:duplicateReview.body.expectedValues},token);
    check(duplicateConfirm.status===409&&duplicateConfirm.body.code==='CRM_IDENTITY_DUPLICATE'&&duplicateConfirm.body.error.includes('autre fiche')&&duplicateConfirm.body.traceId,'Validation locale : doublon CRM expliqué, jamais présenté comme une panne du navigateur');
    check((await request('GET',duplicatePath,undefined,token)).body.status==='needs_review'&&!(await request('GET','/prospects/'+duplicateTarget.body.id,undefined,token)).body.siret,'Validation refusée : capture intacte et transaction CRM annulée');
    const failureLogs=await request('GET','/diagnostics/events?search=CRM_IDENTITY_DUPLICATE',undefined,token);
    check(failureLogs.body.events.some(e=>e.prospect_id===duplicateTarget.body.id&&e.job_id===duplicateTask&&e.source==='societe_com'&&e.details.databaseCode==='23505'&&e.trace_id===duplicateConfirm.body.traceId),'Diagnostics : cause SQLSTATE du refus liée à source, prospect, tâche et trace');
    const localBound=await request('POST','/browser/local-review',{taskId:randomUUID(),cloudJobId:wrong.body.id,prospectId:target.body.id,capture:{...localCapture,siret:'96677700200019',sourceUrl:'https://www.societe.com/societe/atelier-cloud-966777002.html'}},token);
    check(localBound.status===200&&localBound.body.job.id===wrong.body.id&&localBound.body.job.result.localCapture,'Chrome local : secours rattaché à la tâche cloud existante');
    const wrongSource=await request('POST','/browser/local-review',{taskId:randomUUID(),cloudJobId:wrong.body.id,prospectId:target.body.id,capture:{...localCapture,source:'pagesjaunes',sourceUrl:'https://www.pagesjaunes.fr/pros/12345678'}},token);
    check(wrongSource.status===409,'Chrome local : capture d’une autre source refusée');
    const finishBefore=await request('POST',manualPath+'/finish-review',{},token);
    check(finishBefore.status===200&&finishBefore.body.prospectId===manualTarget.body.id&&finishBefore.body.url.includes('view=enrichments')&&finishBefore.body.url.includes(staged.body.job.id),'Parcours source : retour interne au bon prospect et onglet après enregistrement réel');
    await enrichmentReadFailure(true);
    try{
      const finishWithoutSummary=await request('POST',manualPath+'/finish-review',{},token);
      check(finishWithoutSummary.status===200&&finishWithoutSummary.body.prospectId===manualTarget.body.id,'Retour sauvegardé : une panne du bilan secondaire ne bloque pas la navigation');
      let refreshLogs;
      for(let n=0;n<20;n++){refreshLogs=await request('GET','/diagnostics/events?search=ENRICHMENT_REFRESH_FAILED',undefined,token);if(refreshLogs.body.events?.some(e=>e.job_id===staged.body.job.id))break;await new Promise(r=>setTimeout(r,20));}
      check(refreshLogs.body.events?.some(e=>e.job_id===staged.body.job.id&&e.prospect_id===manualTarget.body.id),'Retour sauvegardé : panne du bilan tracée sans perdre la preuve CRM');
    }finally{await enrichmentReadFailure(false);}
    check((await request('POST',reviewPath+'/finish-review',{},token)).status===409,'Parcours source : aucune redirection de succès avant sauvegarde');
    check((await request('POST',manualPath+'/finish-review',{},foreignToken)).status===404&&(await request('POST',manualPath+'/finish-review',{},colleague)).status===404,'Parcours source : retour isolé par agence et utilisateur');
    // Two real CRM dossiers, a captured legal identifier already held by the other dossier.
    const mergeCurrent=await request('POST','/prospects',{company:'Atelier commercial fusion',email:'commercial@atelier-fusion.fr',phone:'0320112233',address:'8 rue du Test 59100 Roubaix',firstName:'Alice',lastName:'Martin'},token);
    const mergeOther=await request('POST','/prospects',{company:'ALICE MARTIN',siret:'96677710100019',siren:'966777101',phone:'0611223344',email:'direction@atelier-fusion.fr',website:'https://atelier-fusion.fr'},token);
    const mergeTask=randomUUID(),mergeCapture={...localCapture,id:'task_'+mergeTask,company:'ALICE MARTIN',siret:'96677710100019',siren:'966777101',sourceUrl:'https://www.societe.com/societe/alice-martin-966777101.html'};
    const mergeStaged=await request('POST','/browser/local-review',{taskId:mergeTask,prospectId:mergeCurrent.body.id,capture:mergeCapture},token);
    const mergeJob=mergeStaged.body.job.id,mergeContext={otherId:mergeOther.body.id,jobId:mergeJob,captureIndex:0};
    const mergeReview=await request('GET','/browser/jobs/'+mergeJob+'/review',undefined,token);
    check(mergeReview.status===200&&mergeReview.body.duplicate?.id===mergeOther.body.id,'Fusion : comparaison source indique la fiche exacte qui possède déjà le SIRET');
    await mergeFixtureSql("INSERT INTO activities(type,title,tenant_id,prospect_id,created_by) SELECT 'note','Note à conserver',tenant_id,id,created_by FROM prospects WHERE id=$1",[mergeOther.body.id]);
    await mergeFixtureSql("INSERT INTO deals(title,stage,tenant_id,prospect_id) SELECT 'Affaire à conserver','lead',tenant_id,id FROM prospects WHERE id=$1",[mergeOther.body.id]);
    await mergeFixtureSql("INSERT INTO prospect_monitoring(prospect_id,tenant_id,enabled,snapshot) SELECT id,tenant_id,true,'{\"managers\":[\"Alice Martin · Gérante\"]}'::jsonb FROM prospects WHERE id=$1",[mergeOther.body.id]);
    await mergeFixtureSql("INSERT INTO audit_logs(tenant_id,user_id,action,entity_type,entity_id,metadata) SELECT tenant_id,created_by,'comment','prospect',id,'{}'::jsonb FROM prospects WHERE id=$1",[mergeOther.body.id]);
    await mergeFixtureSql("UPDATE cloud_browser_jobs SET result=jsonb_set(result,'{imports}',jsonb_build_object('receipt',jsonb_build_object('status','imported','prospectId',$2::text))) WHERE id=$1",[mergeJob,mergeOther.body.id]);
    const mp=await request('POST','/prospects/'+mergeCurrent.body.id+'/merge-preview',mergeContext,token);
    check(mp.status===200&&mp.body.other.siret==='96677710100019'&&mp.body.activities.some(a=>a.prospect_id===mergeOther.body.id&&a.count===1),'Fusion : noms, SIRET, coordonnées et activités des deux dossiers présentés');
    check((await request('POST','/prospects/'+mergeCurrent.body.id+'/merge-preview',mergeContext,foreignToken)).status===404&&(await request('POST','/prospects/'+mergeCurrent.body.id+'/merge-preview',mergeContext,colleague)).status===409,'Fusion : autre agence et capture privée d’un collègue refusées');
    const mergePayload={...mergeContext,mergeKey:mp.body.mergeKey,proofDigest:mp.body.proofDigest,survivorId:mergeCurrent.body.id,expectedVersions:{[mergeCurrent.body.id]:mp.body.current.updatedAt,[mergeOther.body.id]:mp.body.other.updatedAt},replaceFields:[],confirmed:true};
    check((await request('POST','/prospects/'+mergeCurrent.body.id+'/merge',{...mergePayload,confirmed:false},token)).status===400,'Fusion : aucune fusion sans confirmation explicite');
    const staleMerge=await request('POST','/prospects/'+mergeCurrent.body.id+'/merge',{...mergePayload,expectedVersions:{...mergePayload.expectedVersions,[mergeOther.body.id]:'2000-01-01T00:00:00.000Z'}},token);
    check(staleMerge.status===409&&(await request('GET','/prospects/'+mergeOther.body.id,undefined,token)).body.siret==='96677710100019','Fusion : modification concurrente refusée sans libérer l’identité');
    const wrongProof=await request('POST','/prospects/'+mergeCurrent.body.id+'/merge',{...mergePayload,proofDigest:'0'.repeat(64)},token);
    check(wrongProof.status===409,'Fusion : preuve modifiée entre comparaison et confirmation refusée');
    await mergeFixtureSql("UPDATE cloud_browser_jobs SET status='running',lease=gen_random_uuid(),lease_until=NOW()+INTERVAL '1 minute' WHERE id=$1",[mergeJob]);
    check((await request('POST','/prospects/'+mergeCurrent.body.id+'/merge',mergePayload,token)).status===423,'Fusion : une capture en cours ne peut pas être utilisée pour fusionner');
    await mergeFixtureSql("UPDATE cloud_browser_jobs SET status='needs_review',lease=NULL,lease_until=NULL WHERE id=$1",[mergeJob]);
    const occupiedMergeJob=await mergeFixtureSql("INSERT INTO cloud_browser_jobs(tenant_id,created_by,profile_id,prospect_id,mode,query,status) SELECT tenant_id,created_by,profile_id,$2,'enrich','Fusion occupée','running' FROM cloud_browser_jobs WHERE id=$1 RETURNING id",[mergeJob,mergeOther.body.id]);
    check((await request('POST','/prospects/'+mergeCurrent.body.id+'/merge',mergePayload,token)).status===423,'Fusion : collecte active sur l’autre dossier bloque le regroupement sans annulation silencieuse');
    await mergeFixtureSql("UPDATE cloud_browser_jobs SET status='cancelled' WHERE id=$1",[occupiedMergeJob[0].id]);
    // A future linked table with an additional uniqueness rule must make everything roll back.
    await mergeFixtureSql("CREATE TABLE growthos_test_merge_links(id UUID DEFAULT gen_random_uuid(),tenant_id UUID NOT NULL,prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,kind TEXT,UNIQUE(prospect_id,kind))");
    try{
      await mergeFixtureSql("INSERT INTO growthos_test_merge_links(tenant_id,prospect_id,kind) SELECT tenant_id,id,'same' FROM prospects WHERE id=ANY($1::uuid[])",[[mergeCurrent.body.id,mergeOther.body.id]]);
      const failedMerge=await request('POST','/prospects/'+mergeCurrent.body.id+'/merge',mergePayload,token);
      check(failedMerge.status>=400&&(await request('GET','/prospects/'+mergeOther.body.id,undefined,token)).body.siret==='96677710100019'&&!(await request('GET','/prospects/'+mergeCurrent.body.id,undefined,token)).body.siret,'Fusion : erreur sur une liaison annule toutes les écritures et restitue les deux fiches');
      check((await mergeFixtureSql('SELECT id FROM prospect_merge_receipts WHERE id=$1',[mergePayload.mergeKey])).length===0,'Fusion : aucun reçu de succès après une transaction annulée');
      await mergeFixtureSql('DELETE FROM growthos_test_merge_links WHERE prospect_id=$1',[mergeCurrent.body.id]);
      const parallelMerges=await Promise.all([request('POST','/prospects/'+mergeCurrent.body.id+'/merge',mergePayload,token),request('POST','/prospects/'+mergeCurrent.body.id+'/merge',mergePayload,token)]);
      const merged=parallelMerges.find(r=>!r.body.alreadyMerged)||parallelMerges[0];
      check(parallelMerges.every(r=>r.status===200)&&parallelMerges.filter(r=>r.body.alreadyMerged).length===1,'Fusion : deux confirmations simultanées utilisent un seul reçu et une seule transaction effective');
      check(merged.status===200&&merged.body.prospectId===mergeCurrent.body.id,'Fusion : transaction confirmée et nom commercial conservé');
      const mergedProfile=(await request('GET','/prospects/'+mergeCurrent.body.id,undefined,token)).body;
      check(mergedProfile.company==='Atelier commercial fusion'&&mergedProfile.siret==='96677710100019'&&mergedProfile.email==='commercial@atelier-fusion.fr'&&mergedProfile.website==='https://atelier-fusion.fr','Fusion : champs vides complétés, principale choisie et identité du même établissement transférées');
      const points=mergedProfile.sourceDetails.contactPoints;
      check(points.some(p=>p.value==='commercial@atelier-fusion.fr')&&points.some(p=>p.value==='direction@atelier-fusion.fr')&&points.some(p=>p.value.replace(/\D/g,'')==='0611223344'),'Fusion : toutes les coordonnées des deux fiches conservées avec provenance');
      const alias=(await request('GET','/prospects/'+mergeOther.body.id,undefined,token)).body;
      check(alias.id===mergeCurrent.body.id&&alias.mergedFromId===mergeOther.body.id,'Fusion : l’ancien lien retrouve le dossier conservé');
      check((await request('GET','/prospects/'+mergeOther.body.id,undefined,foreignToken)).status===404,'Fusion : l’alias ne révèle aucune fiche d’une autre agence');
      const moved=await mergeFixtureSql('SELECT prospect_id FROM growthos_test_merge_links');
      const movedDeal=await mergeFixtureSql("SELECT prospect_id FROM deals WHERE title='Affaire à conserver'");
      check(moved[0].prospect_id===mergeCurrent.body.id&&movedDeal[0].prospect_id===mergeCurrent.body.id,'Fusion : affaires et futures liaisons étrangères suivent la fiche conservée');
      const movedActivities=(await request('GET','/activities?prospectId='+mergeCurrent.body.id+'&scope=history',undefined,token)).body;
      check(movedActivities.some(a=>a.title==='Note à conserver')&&movedActivities.filter(a=>a.title==='Fusion de fiches prospect').length===1,'Fusion : activités originales et événement de fusion présents');
      const archives=await request('GET','/prospects/'+mergeCurrent.body.id+'/merges',undefined,token);
      check(archives.status===200&&archives.body[0].profiles.length===2&&archives.body[0].archivedMonitoring===1&&archives.body[0].changes.siret.before===null&&archives.body[0].changes.siret.after==='96677710100019','Fusion : les deux états initiaux et la surveillance sont archivés');
      const replay=await request('POST','/prospects/'+mergeCurrent.body.id+'/merge',mergePayload,token);
      check(replay.status===200&&replay.body.alreadyMerged,'Fusion : réponse perdue puis nouvel envoi réutilisent le reçu sans doublon');
      check((await request('POST','/prospects/'+mergeCurrent.body.id+'/merge',{...mergePayload,survivorId:mergeOther.body.id},token)).status===409,'Fusion : un reçu ne permet pas de changer la décision après coup');
      const movedAudit=await mergeFixtureSql("SELECT entity_id,metadata FROM audit_logs WHERE action='comment' AND metadata->>'mergeId'=$1",[mergePayload.mergeKey]);
      const movedReceipt=await mergeFixtureSql("SELECT result->'imports'->'receipt'->>'prospectId' AS id FROM cloud_browser_jobs WHERE id=$1",[mergeJob]);
      check(movedAudit.some(a=>a.entity_id===mergeCurrent.body.id&&a.metadata.mergedFromProspectId===mergeOther.body.id)&&movedReceipt[0].id===mergeCurrent.body.id,'Fusion : commentaires d’équipe et reçus d’import suivent le dossier, avec provenance d’origine');
      const reviewAfter=await request('GET','/browser/jobs/'+mergeJob+'/review',undefined,token);
      const confirmAfter=await request('POST','/browser/jobs/'+mergeJob+'/confirm',{captureIndex:0,confirmed:true,expectedUpdatedAt:reviewAfter.body.version,expectedCaptureDigest:reviewAfter.body.captureDigest,expectedValues:reviewAfter.body.expectedValues,replaceFields:[]},token);
      check(!reviewAfter.body.duplicate&&confirmAfter.status===200&&confirmAfter.body.job.status==='completed','Fusion : comparaison source reprise et enrichissement terminé après regroupement');
      const recoveryId=randomUUID(),failedStep={entreprises:{label:'Annuaire officiel',status:'failed',message:'Ancien échec avant identification'}};
      await mergeFixtureSql("INSERT INTO prospect_enrichment_jobs(id,tenant_id,created_by,prospect_id,status,steps) SELECT $1,tenant_id,created_by,id,'partial',$2::jsonb FROM prospects WHERE id=$3",[recoveryId,JSON.stringify(failedStep),mergeCurrent.body.id]);
      const recovered=await request('GET','/prospects/'+mergeCurrent.body.id+'/enrichment',undefined,token);
      check(recovered.body.status==='queued'&&recovered.body.steps.entreprises.status==='pending'&&recovered.body.steps.entreprises.recoveryIdentity==='96677710100019','Bilan : une ancienne source échouée est reprogrammée après confirmation du SIRET');
      const recoveredSteps=recovered.body.steps;recoveredSteps.entreprises.status='failed';
      await mergeFixtureSql("UPDATE prospect_enrichment_jobs SET status='partial',steps=$2 WHERE id=$1",[recoveryId,JSON.stringify(recoveredSteps)]);
      const recoveredOnce=await request('GET','/prospects/'+mergeCurrent.body.id+'/enrichment',undefined,token);
      check(recoveredOnce.body.status==='partial'&&recoveredOnce.body.steps.entreprises.status==='failed','Bilan : un nouvel échec de la même identité ne provoque pas une reprise infinie');
      await mergeFixtureSql("INSERT INTO diagnostic_events(tenant_id,component,code,level,message,source,prospect_id,job_id,details,created_at) SELECT tenant_id,'enrichment','SOURCE_FAILED','error','Cause historique','entreprises',id,$2,$3::jsonb,NOW() FROM prospects WHERE id=$1",[mergeCurrent.body.id,recoveryId,JSON.stringify({databaseCode:'23505',databaseConstraint:'idx_prospects_tenant_siret',reason:'Enregistrement refusé'})]);
      const oldCause=await request('GET','/diagnostics/jobs',undefined,token);
      check(oldCause.body.jobs.find(j=>j.id===recoveryId)?.sources.find(s=>s.source==='entreprises')?.diagnosis.causeCode==='CRM_IDENTITY_DUPLICATE','Diagnostics : ancien échec recoupé avec le vrai refus SQL, sans fausse indisponibilité de l’Annuaire');
      await mergeFixtureSql("INSERT INTO diagnostic_events(tenant_id,component,code,level,message,source,prospect_id,job_id,details) SELECT tenant_id,'enrichment','SOURCE_FAILED','error','Nouvelle tentative','entreprises',id,$2,$3::jsonb FROM prospects WHERE id=$1",[mergeCurrent.body.id,recoveryId,JSON.stringify({databaseCode:null,reason:'fetch failed'})]);
      const currentCause=await request('GET','/diagnostics/jobs',undefined,token);
      check(currentCause.body.jobs.find(j=>j.id===recoveryId)?.sources.find(s=>s.source==='entreprises')?.diagnosis.causeCode==='SOURCE_NETWORK','Diagnostics : une nouvelle panne réseau remplace la cause SQL historique de la tentative précédente');
      delete recoveredSteps.entreprises.recoveryIdentity;
      await mergeFixtureSql("UPDATE prospect_enrichment_jobs SET status='cancelled',steps=$2 WHERE id=$1",[recoveryId,JSON.stringify(recoveredSteps)]);
      check((await request('GET','/prospects/'+mergeCurrent.body.id+'/enrichment',undefined,token)).body.status==='cancelled','Bilan : consulter une tâche annulée ne relance aucune recherche');



    }finally{await mergeFixtureSql('DROP TABLE growthos_test_merge_links');}
    const keepExistingCurrent=await request('POST','/prospects',{company:'Enseigne conservée',city:'Lille',phone:'0320556677',email:'contact@enseigne-fusion.fr'},token);
    const keepExistingOther=await request('POST','/prospects',{company:'Identité légale de secours',siret:'96677710200019',email:'bureau@autre-atelier.fr'},token);
    await mergeFixtureSql("UPDATE prospects SET source_details=$2::jsonb WHERE id=$1",[keepExistingCurrent.body.id,JSON.stringify({crossSource:{fieldSources:{email:{source:'website',sourceUrl:'https://enseigne-fusion.fr/contact'}}}})]);
    await mergeFixtureSql("UPDATE prospects SET source_details=$2::jsonb WHERE id=$1",[keepExistingOther.body.id,JSON.stringify({crossSource:{fieldSources:{email:{source:'societe_com',sourceUrl:'https://www.societe.com/societe/identite-legale-966777102.html'}}}})]);
    const keepTask=randomUUID(),keepCapture={...localCapture,id:'task_'+keepTask,company:'Identité légale de secours',siret:'96677710200019',siren:'966777102',sourceUrl:'https://www.societe.com/societe/identite-legale-966777102.html'};
    const keepStaged=await request('POST','/browser/local-review',{taskId:keepTask,prospectId:keepExistingCurrent.body.id,capture:keepCapture},token);
    const keepContext={otherId:keepExistingOther.body.id,jobId:keepStaged.body.job.id,captureIndex:0},kp=(await request('POST','/prospects/'+keepExistingCurrent.body.id+'/merge-preview',keepContext,token)).body;
    const keepResult=await request('POST','/prospects/'+keepExistingCurrent.body.id+'/merge',{...keepContext,mergeKey:kp.mergeKey,proofDigest:kp.proofDigest,survivorId:keepExistingOther.body.id,confirmed:true,replaceFields:['company','email'],expectedVersions:{[keepExistingCurrent.body.id]:kp.current.updatedAt,[keepExistingOther.body.id]:kp.other.updatedAt}},token);
    check(keepResult.status===200&&keepResult.body.prospectId===keepExistingOther.body.id,'Fusion : choix explicite de conserver la fiche existante accepté');
    const keptExisting=(await request('GET','/prospects/'+keepExistingOther.body.id,undefined,token)).body;
    const keptJob=(await request('GET','/browser/jobs/'+keepStaged.body.job.id,undefined,token)).body;
    check(keptExisting.company==='Enseigne conservée'&&keptExisting.email==='contact@enseigne-fusion.fr'&&keptExisting.sourceDetails.crossSource.fieldSources.email.source==='website'&&keptExisting.sourceDetails.crossSource.fieldSources.email.sourceUrl==='https://enseigne-fusion.fr/contact'&&keptExisting.sourceDetails.contactPoints.some(p=>p.value==='bureau@autre-atelier.fr')&&keptExisting.sourceDetails.crossSource.fieldSources.company.mergedFromProspectId===keepExistingCurrent.body.id,'Fusion : nom et email choisis portent la preuve du donneur, l’ancienne principale reste conservée');
    check(keptJob.prospect_id===keepExistingOther.body.id&&(await request('GET','/prospects/'+keepExistingCurrent.body.id,undefined,token)).body.id===keepExistingOther.body.id,'Fusion : tâche source et ancien lien suivent aussi le choix de l’autre fiche');
    const unrelatedCurrent=await request('POST','/prospects',{company:'Autre établissement distinct',siret:'96677710300019'},token),unrelatedTask=randomUUID();
    const unrelatedStaged=await request('POST','/browser/local-review',{taskId:unrelatedTask,prospectId:unrelatedCurrent.body.id,capture:{...keepCapture,id:'task_'+unrelatedTask}},token);
    const unrelatedPreview=await request('POST','/prospects/'+unrelatedCurrent.body.id+'/merge-preview',{otherId:keepExistingOther.body.id,jobId:unrelatedStaged.body.job.id,captureIndex:0},token);
    check(unrelatedPreview.status===409,'Fusion : deux SIRET connus différents restent strictement interdits malgré une capture ciblée');
    const deviceProspect=await request('POST','/prospects',{company:'Atelier appareil',siret:'96677711000019',city:'Roubaix',phone:'0320112233'},token);
    const deviceProfile=(await request('POST','/browser/profiles',{source:'societe_com',label:'Source appareil'},token)).body;
    const deviceJob=(await request('POST','/browser/jobs',{profileId:deviceProfile.id,prospectId:deviceProspect.body.id,query:'966777110',area:'Roubaix'},token)).body;
    const deviceParent=(await request('POST','/prospects/'+deviceProspect.body.id+'/enrichment',{},token)).body;
    await mergeFixtureSql("UPDATE cloud_browser_jobs SET status='awaiting_user',result=$2 WHERE id=$1",[deviceJob.id,JSON.stringify({enrichmentRunId:deviceParent.id})]);
    await mergeFixtureSql("UPDATE prospect_enrichment_jobs SET status='partial',steps=$2 WHERE id=$1",[deviceParent.id,JSON.stringify({societe_com:{label:'Societe.com',status:'awaiting_user',jobId:deviceJob.id,profileId:deviceProfile.id}})]);
    const deviceContext={prospectId:deviceProspect.body.id,deviceId:randomUUID(),runId:randomUUID()};
    check((await request('POST','/browser/device-plan',deviceContext,foreignToken)).status===404,'Navigateur utilisateur : plan isolé par agence');
    const devicePlan=await request('POST','/browser/device-plan',deviceContext,token);
    check((await request('POST','/browser/device-plan',deviceContext,token)).body.runId===deviceContext.runId,'Navigateur utilisateur : réponse de préparation perdue rejouée sur le même lot');
    check(devicePlan.status===200&&devicePlan.body.jobs.length===1&&devicePlan.body.jobs[0].id===deviceJob.id&&devicePlan.body.prospect.siret==='96677711000019','Navigateur utilisateur : même tâche source et identifiants CRM transmis sans jeton fournisseur');
    check((await request('POST','/browser/device-plan',{...deviceContext,deviceId:randomUUID(),runId:randomUUID()},token)).status===423,'Navigateur utilisateur : second appareil bloqué pendant le bail');
    check((await request('POST','/browser/jobs/'+deviceJob.id+'/retry',{},token)).status===423,'Navigateur utilisateur : reprise cloud refusée pendant une lecture locale');
    const deviceCapture={capturedAt:Date.now()-60*60_000,source:'societe_com',company:'ATELIER APPAREIL',siret:'96677711000019',siren:'966777110',sourceUrl:'https://www.societe.com/societe/atelier-appareil-966777110.html',address:'8 rue du Test 59100 Roubaix',codePostal:'59100',city:'Roubaix',email:'contact@atelier-appareil.fr',emails:['contact@atelier-appareil.fr','devis@atelier-appareil.fr'],phones:['0320112233','0612345678'],companyDetails:{fields:{'Forme juridique':'SARL'},managers:[],establishments:[],links:[]}};
    const devicePayload={deviceId:deviceContext.deviceId,runId:deviceContext.runId,status:'completed',captures:[{...deviceCapture,company:'Autre société',siret:'96677711300019',siren:'966777113',sourceUrl:'https://www.societe.com/societe/autre-966777113.html'},deviceCapture],references:[]};
    check((await request('POST','/browser/jobs/'+deviceJob.id+'/device-result',{...devicePayload,runId:randomUUID()},token)).status===409,'Navigateur utilisateur : résultat d’un autre lot refusé');
    check((await request('POST','/browser/jobs/'+deviceJob.id+'/device-result',{...devicePayload,captures:[{...deviceCapture,source:'bing'}]},token)).status===400,'Navigateur utilisateur : mauvaise source refusée avant toute écriture');
    check((await request('POST','/browser/jobs/'+deviceJob.id+'/device-result',devicePayload,foreignToken)).status===404,'Navigateur utilisateur : réception isolée par agence');
    const deviceReceived=await request('POST','/browser/jobs/'+deviceJob.id+'/device-result',devicePayload,token);
    check(deviceReceived.status===200&&deviceReceived.body.applied,'Navigateur utilisateur : identité exacte appliquée sans validation manuelle supplémentaire');
    const deviceUpdated=(await request('GET','/prospects/'+deviceProspect.body.id,undefined,token)).body;
    check(deviceUpdated.email==='contact@atelier-appareil.fr'&&deviceUpdated.company==='Atelier appareil','Navigateur utilisateur : CRM relu, email ajouté et nom affiché conservé');
    const deviceProof=(await request('GET','/browser/jobs/'+deviceJob.id,undefined,token)).body;check(deviceProof.result.captures.length===1&&deviceProof.result.captures[0].siret==='96677711000019'&&deviceProof.result.captureHistory.some(c=>c.siret==='96677711300019'),'Navigateur utilisateur : seule la fiche concordante est affichée comme appliquée, les autres preuves restent archivées');
    check(deviceProof.result.captures[0].capturedAt===deviceCapture.capturedAt,'Navigateur utilisateur : date de lecture conservée après une synchronisation différée');
    check(deviceUpdated.sourceDetails.contactPoints.some(p=>p.type==='email'&&p.value==='devis@atelier-appareil.fr')&&deviceUpdated.sourceDetails.contactPoints.some(p=>p.type==='phone'&&p.value==='0612345678'),'Navigateur utilisateur : coordonnées supplémentaires conservées avec la principale');
    check((await request('POST','/browser/jobs/'+deviceJob.id+'/device-result',devicePayload,token)).body.alreadyReceived,'Navigateur utilisateur : réponse perdue/reprise sans doublon ni nouvelle activité');
    check((await request('POST','/browser/jobs/'+deviceJob.id+'/device-result',{...devicePayload,reasonCode:'NO_RESULTS'},token)).status===409,'Navigateur utilisateur : un reçu ne permet pas de changer le résultat');
    const deviceBilan=(await request('GET','/prospects/'+deviceProspect.body.id+'/enrichment',undefined,token)).body;
    check(deviceBilan.steps.societe_com.status==='completed','Navigateur utilisateur : bilan parent réconcilié après sauvegarde locale');
    // A different source must remain reviewable when its identity conflicts.
    const blockedDeviceJob=(await request('POST','/browser/jobs',{profileId:deviceProfile.id,prospectId:deviceProspect.body.id,query:'966777110',area:'Roubaix'},token)).body;
    await mergeFixtureSql("UPDATE cloud_browser_jobs SET status='awaiting_user',result='{}' WHERE id=$1",[blockedDeviceJob.id]);
    await mergeFixtureSql("UPDATE prospect_enrichment_jobs SET status='partial',steps=$2 WHERE id=$1",[deviceParent.id,JSON.stringify({societe_com:{label:'Societe.com',status:'awaiting_user',jobId:blockedDeviceJob.id,profileId:deviceProfile.id}})]);
    const blockedContext={...deviceContext,runId:randomUUID()};await request('POST','/browser/device-plan',blockedContext,token);
    const blockedPayload={...devicePayload,runId:blockedContext.runId,captures:[{...deviceCapture,siret:'96677711200019',siren:'966777112',sourceUrl:'https://www.societe.com/societe/autre-966777112.html'}]};
    const blockedDevice=await request('POST','/browser/jobs/'+blockedDeviceJob.id+'/device-result',blockedPayload,token);
    check(blockedDevice.status===200&&blockedDevice.body.status==='needs_review'&&!blockedDevice.body.applied,'Navigateur utilisateur : identité contradictoire conservée pour comparaison, jamais appliquée');
    check((await request('GET','/browser/jobs/'+blockedDeviceJob.id+'/review',undefined,token)).body.blocked,'Navigateur utilisateur : preuve locale complète consultable dans la comparaison existante');
    const stoppedContext={...deviceContext,runId:randomUUID()};await request('POST','/browser/device-plan',stoppedContext,token);
    await request('POST','/browser/device-stop',stoppedContext,token);
    check((await request('POST','/browser/jobs/'+blockedDeviceJob.id+'/device-result',{...devicePayload,runId:stoppedContext.runId},token)).status===409,'Navigateur utilisateur : un arrêt interdit tout résultat tardif');
    check((await request('POST','/browser/jobs/'+blockedDeviceJob.id+'/retry',{},token)).status===200,'Navigateur utilisateur : retour au cloud possible après arrêt explicite');
    await request('POST','/browser/jobs/'+blockedDeviceJob.id+'/cancel',{},token);await mergeFixtureSql("UPDATE cloud_browser_jobs SET status='awaiting_user',result='{}' WHERE id=$1",[blockedDeviceJob.id]);
    const challengedContext={...deviceContext,runId:randomUUID()};await request('POST','/browser/device-plan',challengedContext,token);
    const challengedResult=await request('POST','/browser/jobs/'+blockedDeviceJob.id+'/device-result',{runId:challengedContext.runId,deviceId:challengedContext.deviceId,status:'awaiting_user',reasonCode:'SECURITY_CHALLENGE',captures:[],references:[]},token);
    check(challengedResult.status===200&&challengedResult.body.status==='awaiting_user'&&!challengedResult.body.applied,'Navigateur utilisateur : contrôle source reçu sans capture fictive ni mise à jour CRM');
    const challengedBilan=(await request('GET','/prospects/'+deviceProspect.body.id+'/enrichment',undefined,token)).body;
    check(challengedBilan.steps.societe_com.status==='awaiting_user'&&challengedBilan.steps.societe_com.message.includes('sécurité'),'Navigateur utilisateur : bilan parent conserve le vrai motif d’intervention locale');
    const investigationTarget=await request('POST','/prospects',{company:'Hydreo',city:'Lille',phone:'03 20 11 22 33',website:'https://hydreo-site.fr/mentions-legales'},token);
    const investigationRun=await request('POST','/prospects/'+investigationTarget.body.id+'/enrichment',{},token);await runEnrichmentMaintenance(investigationRun.body.id,2);
    const investigationRead=(await request('GET','/prospects/'+investigationTarget.body.id,undefined,token)).body;
    check(investigationRead.email==='hydreo59@gmail.com'&&investigationRead.sourceDetails.website.snapshot.pages[0].url==='https://hydreo-site.fr/','Enquête site : accueil lu même si l’URL initiale est une mention légale ; Gmail publié rapproché hors H1');
    check(!investigationRead.linkedinUrl&&investigationRead.sourceDetails.website.snapshot.socials.some(s=>s.kind==='person'&&s.url.includes('/in/alice-martin')),'Enquête site : profil LinkedIn personnel conservé comme indice, jamais rangé comme page entreprise');
    check(investigationRead.sourceDetails.website.snapshot.socials.some(s=>s.source==='facebook'&&s.kind==='profile'&&s.url==='https://www.facebook.com/people/hydreo-59/100083348056733/'&&s.sourceUrl.startsWith('https://hydreo-site.fr/')),'Réseaux site : profil Facebook /people/ enregistré et relu dans le CRM avec sa provenance');
    const peopleBefore=(await request('GET','/contacts',undefined,token)).body.data;
    check(peopleBefore.some(c=>c.prospectId===investigationTarget.body.id&&c.name==='Alice Martin'&&!c.isManager&&!c.phone&&!c.email),'Enquête sociale : nom public visible sans inventer gérance ni coordonnées directes');
    await runEnrichmentMaintenance(investigationRun.body.id,2);
    const investigated=(await request('GET','/prospects/'+investigationTarget.body.id,undefined,token)).body;
    check(investigated.siret==='96677709400019'&&investigated.sourceDetails.identity.legalName==='ALICE MARTIN'&&investigated.company==='Hydreo','Enquête multisource : piste nominative du site → recherche officielle par nom → enseigne et identité juridique recoupées');
    check(investigated.city==='Lille'&&investigated.sourceDetails.crossSource.conflicts.some(c=>c.field==='city'&&c.incoming==='Roubaix'),'Enquête : une divergence de ville reste proposée à vérifier après identification, sans effacement silencieux');
    check((await request('GET','/contacts',undefined,token)).body.data.some(c=>c.prospectId===investigationTarget.body.id&&c.name==='Alice Martin'&&c.isManager&&c.role==='Gérante'),'Enquête : le rôle de dirigeant vient ensuite de la source officielle');
    const websiteTarget=await request('POST','/prospects',{company:'Atelier Site',website:'https://atelier-site.fr',phone:'03 20 11 22 33',address:'8 rue du Test 59100 Roubaix',city:'Roubaix',postalCode:'59100'},token);
    const websiteRun=await request('POST','/prospects/'+websiteTarget.body.id+'/enrichment',{},token);
    await runEnrichmentMaintenance(websiteRun.body.id,3);
    const websiteUpdated=(await request('GET','/prospects/'+websiteTarget.body.id,undefined,token)).body;
    check(websiteUpdated.email==='contact@atelier-site.fr'&&websiteUpdated.sourceDetails.website.snapshot.emails[0].sourceUrl==='https://atelier-site.fr/contact','Site prospect : email publié lu sur Contact avec provenance exacte');
    check(websiteUpdated.sourceDetails.crossSource.fieldSources.email.sourceUrl==='https://atelier-site.fr/contact'&&websiteUpdated.linkedinUrl==='https://www.linkedin.com/company/atelier-site/','Site prospect : réseaux sociaux et preuve par champ conservés');
    const multiTarget=await request('POST','/prospects',{company:'Nom commercial atelier',website:'https://atelier-multiple.fr',phone:'03 20 11 22 33',city:'Roubaix'},token);
    const multiRun=await request('POST','/prospects/'+multiTarget.body.id+'/enrichment',{},token);await runEnrichmentMaintenance(multiRun.body.id,2);
    const multiCrm=(await request('GET','/prospects/'+multiTarget.body.id,undefined,token)).body;
    check(multiCrm.email==='contact.atelier@gmail.com'&&multiCrm.company==='Nom commercial atelier','Site lié : Gmail publié rapproché par téléphone et éditeur, nom commercial conservé');
    const multiSnapshot=multiCrm.sourceDetails.website.snapshot;
    check(multiSnapshot.emails.length===2&&multiSnapshot.phones.length===2&&multiSnapshot.addresses.length===2&&multiSnapshot.publishers[0].name==='ATELIER EDITEUR'&&multiSnapshot.sirets[0]==='96677709300019'&&multiSnapshot.apeCodes[0]==='43.22A'&&!multiSnapshot.sirets.includes('96688888800019'),'Mentions légales : coordonnées multiples, éditeur, APE et identifiants conservés, hébergeur exclu');
    check(multiCrm.sourceDetails.contactPoints.filter(p=>p.source==='website'&&p.type==='email').length===2,'Coordonnées : emails supplémentaires persistés dans le dossier');
    const alternative=multiCrm.sourceDetails.contactPoints.find(p=>p.value==='devis@atelier-multiple.fr');
    const choice={type:alternative.type,value:alternative.value,source:alternative.source,sourceUrl:alternative.sourceUrl,expectedCurrentValue:multiCrm.email,confirmed:true};
    check((await request('POST','/contacts/'+multiTarget.body.id+'/coordinates/primary',choice,foreignToken)).status===404,'Choix de coordonnée : isolation par agence');
    check((await request('POST','/contacts/'+multiTarget.body.id+'/coordinates/primary',{...choice,value:'invente@example.org'},token)).status===409,'Choix de coordonnée : preuve obligatoire');
    check((await request('POST','/contacts/'+multiTarget.body.id+'/coordinates/primary',choice,token)).status===200,'Coordonnées multiples : choix de l’email principal enregistré');
    const chosen=(await request('GET','/prospects/'+multiTarget.body.id,undefined,token)).body;
    check(chosen.email===alternative.value&&chosen.sourceDetails.contactPoints.some(p=>p.value==='contact.atelier@gmail.com'),'Changer la principale conserve toutes les coordonnées');
    check((await request('POST','/contacts/'+multiTarget.body.id+'/coordinates/primary',choice,token)).body.alreadyApplied,'Coordonnée principale : double validation idempotente');
    check((await request('GET','/activities?prospectId='+multiTarget.body.id,undefined,token)).body.some(a=>a.description.includes('contact.atelier@gmail.com → devis@atelier-multiple.fr')),'Coordonnée principale : valeurs avant/après tracées');
    await request('PATCH','/prospects/'+multiTarget.body.id,{email:'manuel@atelier-multiple.fr'},token);
    const restoredPrimary=await request('POST','/contacts/'+multiTarget.body.id+'/coordinates/primary',{...choice,expectedCurrentValue:'manuel@atelier-multiple.fr'},token);
    const afterManual=(await request('GET','/prospects/'+multiTarget.body.id,undefined,token)).body;
    check(restoredPrimary.status===200&&afterManual.sourceDetails.contactPoints.some(p=>p.value==='manuel@atelier-multiple.fr'&&p.source==='crm'),'Coordonnée principale : ancienne saisie manuelle conservée avant remplacement');
    check((await request('POST','/contacts/'+multiTarget.body.id+'/coordinates/primary',{type:'email',value:'manuel@atelier-multiple.fr',source:'crm',sourceUrl:null,expectedCurrentValue:choice.value,confirmed:true},token)).status===200,'Coordonnée précédente : réutilisable après le changement de principale');
    await runEnrichmentMaintenance(multiRun.body.id,2);
    const publisherCrm=(await request('GET','/prospects/'+multiTarget.body.id,undefined,token)).body;
    check(publisherCrm.siret==='96677709300019'&&publisherCrm.sourceDetails.identity.legalName==='ATELIER EDITEUR'&&publisherCrm.company==='Nom commercial atelier','Site puis Annuaire : éditeur légal rapproché par preuve, SIRET enregistré et enseigne conservée');
    const sourceContacts=await request('GET','/contacts',undefined,token);
    check(sourceContacts.status===200&&sourceContacts.body.data.some(c=>c.name==='Denis LIQUARD'&&c.emails.includes('denis@atelier-recette.example.org')),'Répertoire Contacts : dirigeants des sources répercutés sans nouveau prospect');
    check(sourceContacts.body.data.some(c=>c.prospectId===multiTarget.body.id&&c.name==='Chloé Editeur'),'Répertoire Contacts : dirigeant officiel mis à jour après rapprochement du site');
    check(sourceContacts.body.data.some(c=>c.prospectId===multiTarget.body.id&&c.kind==='company'&&c.emails.includes('devis@atelier-multiple.fr')&&c.emails.includes('contact.atelier@gmail.com')),'Répertoire Contacts : coordonnées générales multiples accessibles séparément des dirigeants');
    check(sourceContacts.body.data.filter(c=>c.prospectId===multiTarget.body.id&&c.kind==='person').every(c=>!c.phone&&!c.email),'Répertoire Contacts : ne pas attribuer les coordonnées générales au dirigeant officiel');
    const waiting=await request('POST','/browser/jobs',{profileId:profile.id,prospectId:target.body.id,query:'cloud-wait'},token);
    await runCloudMaintenance(waiting.body.id);
    check((await request('GET','/browser/jobs/'+waiting.body.id,undefined,token)).body.status==='awaiting_user','Cloud : source demandant une intervention suspend le lot');
    check((await request('POST','/browser/jobs/'+waiting.body.id+'/retry',{resume:true},token)).body.status==='queued','Cloud : reprise explicite depuis la page intégrée');
    await request('POST','/browser/jobs/'+waiting.body.id+'/cancel',{},token);
    const doomed=await request('POST','/prospects',{company:'Cible supprimée cloud',siret:'96677700300019'},token);
    const doomedJob=await request('POST','/browser/jobs',{profileId:profile.id,prospectId:doomed.body.id,query:'96677700300019'},token);
    await request('DELETE','/prospects/'+doomed.body.id,undefined,token);await runCloudMaintenance(doomedJob.body.id);
    const gone=await request('GET','/browser/jobs/'+doomedJob.body.id,undefined,token);
    check(gone.body.status==='failed' && gone.body.mode==='enrich' && !gone.body.result.captures,
      'Cloud : cible supprimée ne transforme pas un enrichissement en découverte importable');
    const cancelTarget=await request('POST','/prospects',{company:'Cible à conserver',siret:'96677700400019',city:'Ville initiale'},token);
    const cancelJob=await request('POST','/browser/jobs',{profileId:profile.id,prospectId:cancelTarget.body.id,query:'96677700400019'},token);
    cloudDelay=1000;const collectCount=cloudCalls.filter(c=>c.action==='/collect').length;
    const running=runCloudMaintenance(cancelJob.body.id);
    for(let i=0;i<100 && cloudCalls.filter(c=>c.action==='/collect').length===collectCount;i++)await delay(50);
    const queuedCancel=await request('POST','/browser/jobs',{profileId:profile.id,prospectId:cancelTarget.body.id,query:'96677700400019'},token);
    const stopsBefore=cloudCalls.filter(c=>c.action==='/stop').length;
    await request('POST','/browser/jobs/'+queuedCancel.body.id+'/cancel',{},token);
    check(cloudCalls.filter(c=>c.action==='/stop').length===stopsBefore,'Cloud : annuler un lot en file ne ferme pas le navigateur du lot actif');
    check((await request('POST','/browser/jobs/history/delete',{scope:'selected',ids:[cancelJob.body.id]},token)).status===409,'Cloud historique : une tâche en cours ne peut pas être supprimée');
    const cancelled=await request('POST','/browser/jobs/'+cancelJob.body.id+'/cancel',{},token);await running;cloudDelay=0;
    check(cancelled.status===200 && (await request('GET','/browser/jobs/'+cancelJob.body.id,undefined,token)).body.status==='cancelled' &&
      (await request('GET','/prospects/'+cancelTarget.body.id,undefined,token)).body.company==='Cible à conserver',
      'Cloud : annulation pendant lecture empêche la fusion ultérieure dans le CRM');
    const social=await request('POST','/browser/profiles',{source:'linkedin',label:'Compte LinkedIn',mode:'account'},token);
    check((await request('POST','/browser/jobs',{profileId:social.body.id,query:'entreprise'},token)).status===422,
      'Cloud : une session réseau ne prétend pas disposer d’un collecteur non implémenté');
    check((await request('POST',`/browser/profiles/${profile.id}/action`,{controlId:opened.body.controlId,event:{type:'text',text:'RECETTE_SECRETE_NON_STOCKEE'}},token)).status===200,
      'Cloud : saisie explicite dans le navigateur par une route authentifiée');
    const failedInput=await request('POST',`/browser/profiles/${profile.id}/action`,{controlId:opened.body.controlId,event:{type:'text',text:'RECETTE_ERREUR_SECRETE_NON_STOCKEE'}},token);
    await delay(80);
    check(failedInput.status===503&&!apiErrorLog.includes('RECETTE_ERREUR_SECRETE_NON_STOCKEE'),'Cloud : panne worker pendant saisie sans contenu confidentiel dans les journaux');
    check(!JSON.stringify((await request('GET','/browser/jobs',undefined,token)).body).includes('RECETTE_SECRETE_NON_STOCKEE'),
      'Cloud : la saisie de connexion ne persiste pas dans la file de tâches');
    const mapProfile=await request('POST','/browser/profiles',{source:'google_maps',label:'Maps public'},token);
    const discovery=await request('POST','/browser/jobs',{profileId:mapProfile.body.id,query:'plombier',area:'Roubaix'},token);
    await runCloudMaintenance(discovery.body.id);
    const captured=await request('GET','/browser/jobs/'+discovery.body.id,undefined,token);
    check(captured.body.status==='completed' && captured.body.mode==='discover' && captured.body.result.captures.length===1,
      'Cloud : collecte publique livre une sélection persistante avant création de prospects');
    const liveProspect=await request('POST','/prospects',{company:'Nord Artisan',city:'Lille',address:'38 Bd Carnot, 59800 Lille',phone:'07 80 99 59 59'},token);
    const liveRun=await request('POST','/prospects/'+liveProspect.body.id+'/enrichment',{},token);await runEnrichmentMaintenance(liveRun.body.id,1);
    const liveCrm=await request('GET','/prospects/'+liveProspect.body.id,undefined,token);
    check(liveCrm.body.siret==='97996550600012'&&liveCrm.body.sourceDetails.entreprises.snapshot.fields['État de l’établissement']==='Fermé','Annuaire réel Nord Artisan : BUREAU 3 / Bd Carnot, ancien établissement fermé conservé au lieu du nouveau siège');
    const mapDetail=await request('POST','/browser/jobs',{profileId:mapProfile.body.id,prospectId:liveProspect.body.id,query:'live-maps-detail'},token);await runCloudMaintenance(mapDetail.body.id);
    check((await request('GET','/browser/jobs/'+mapDetail.body.id,undefined,token)).body.result.applied,'Maps réel : détail visible sur URL search accepté par la validation API');
    const hq=await request('POST','/browser/jobs',{profileId:profile.id,prospectId:liveProspect.body.id,query:'live-societe-hq'},token);await runCloudMaintenance(hq.body.id);
    const withLegal=await request('GET','/prospects/'+liveProspect.body.id,undefined,token);
    check(withLegal.body.siret==='97996550600012'&&withLegal.body.address.includes('38')&&withLegal.body.sourceDetails.societe_com.scope==='unite_legale'&&withLegal.body.sourceDetails.societe_com.companyDetails.managerContacts[0].role==='Présidente','Societe.com : dirigeants /manager/ du même SIREN appliqués sans déplacer le site vers le siège 00020');
    const organicProfile=await request('POST','/browser/profiles',{source:'google_search',label:'Web organique'},token);
    const organicJob=await request('POST','/browser/jobs',{profileId:organicProfile.body.id,prospectId:liveProspect.body.id,query:'organic-only'},token);await runCloudMaintenance(organicJob.body.id);
    const organicResult=await request('GET','/browser/jobs/'+organicJob.body.id,undefined,token);
    check(organicResult.body.status==='completed'&&organicResult.body.result.references[0].url==='https://nordartisan.fr/'&&!organicResult.body.result.applied,'Web organique sans fiche locale : liens conservés, aucune fausse intervention ni donnée inventée');
    const automaticProspect=await request('POST','/prospects',{company:'Nord Artisan Recette',city:'Roubaix',address:'8 rue du Test 59100 Roubaix',phone:'03 20 55 66 77'},token);
    const autoPath='/prospects/'+automaticProspect.body.id+'/enrichment';
    check((await request('POST',autoPath,{})).status===401,'Enrichissement automatique : lancement refusé sans authentification');
    check((await request('POST',autoPath,{},foreignToken)).status===404,'Enrichissement automatique : autre agence refusée avant recherche');
    const automaticRun=await request('POST',autoPath,{},token),duplicateRun=await request('POST',autoPath,{},token);
    check(automaticRun.status===202&&automaticRun.body.id===duplicateRun.body.id,'Enrichissement automatique : un clic lance une tâche persistante, double clic idempotent');
    await runEnrichmentMaintenance(automaticRun.body.id,3);
    const checkpoint=await request('GET',autoPath,undefined,token);
    check(checkpoint.body.status==='queued'&&checkpoint.body.steps.entreprises.status==='completed'&&checkpoint.body.steps.google_maps.jobId,'Enrichissement automatique : identité Annuaire résolue avant les collecteurs, lien de reprise persisté');
    await runEnrichmentMaintenance(automaticRun.body.id);
    const autoDone=await request('GET',autoPath,undefined,token),autoCrm=await request('GET','/prospects/'+automaticProspect.body.id,undefined,token);
    check(autoDone.body.status==='partial'&&autoDone.body.summary.sourcesDone>=4&&autoCrm.body.siren==='966777055'&&autoCrm.body.siret==='96677705500019'&&autoCrm.body.email==='contact@nord-recette.invalid',
      'Enrichissement automatique : reprise du serveur, Annuaire et collecteurs croisés, données directement dans le CRM');
    check(autoDone.body.steps.insee.status==='skipped'&&autoDone.body.steps.insee.message.includes('via l’Annuaire'),'Enrichissement automatique : INSEE indirect distingué de l’API directe non configurée');
    check(autoDone.body.steps.societe_com.status==='needs_review'&&autoCrm.body.company==='Nord Artisan Recette'&&!JSON.stringify(autoCrm.body.sourceDetails).includes('KEVIN DUVILLE'),
      'Enrichissement automatique : mauvais homonyme Societe.com exclu sans altérer le prospect');
    check(autoCrm.body.phone==='03 20 55 66 77'&&autoCrm.body.sourceDetails.crossSource.conflicts.some(c=>c.source==='bing'&&c.field==='phone'),
      'Enrichissement automatique : téléphone divergent proposé, coordonnées confirmées conservées');
    check(autoDone.body.steps.pappers.status==='completed'&&autoCrm.body.sourceDetails.pappers.companyDetails.managers.includes('Paul PAPPERS'),'Pappers : lecture cloud, données et dirigeants publics enregistrés avec provenance');
    check(autoDone.body.steps.bodacc.status==='completed'&&autoCrm.body.sourceDetails.bodacc.announcements.length===105&&!autoCrm.body.sourceDetails.bodacc.hasMore,'BODACC : API publique paginée au-delà de 100, toutes les annonces rattachées au SIREN exact');
    const autoActivities=await request('GET','/activities?prospectId='+automaticProspect.body.id,undefined,token);
    check(autoActivities.body.some(a=>a.type==='data_update'&&a.description.includes('966777055'))&&autoCrm.body.sourceDetails.entreprises.snapshot.managers[0].includes('Alice'),
      'Enrichissement automatique : identité, dirigeants officiels et activité avant/après conservés');
    const inseeKey=await request('POST','/admin/api-keys',{provider:'insee',apiKey:'isolated-insee-key'},token);
    check(inseeKey.status===201,'Enrichissement automatique : clé INSEE chiffrée et isolée dans l’agence');
    const directRun=await request('POST',autoPath,{},token);await runEnrichmentMaintenance(directRun.body.id);
    const directResult=await request('GET',autoPath,undefined,token);
    check(inseeCalls===1&&directResult.body.steps.insee.status==='completed','Enrichissement automatique : API INSEE 3.11 appelée avec son en-tête de clé et SIRET contrôlé');
    const stableBodacc=(await request('GET','/activities?prospectId='+automaticProspect.body.id,undefined,token)).body.filter(a=>a.title==='Enrichissement · BODACC');
    check(stableBodacc.length===autoActivities.body.filter(a=>a.title==='Enrichissement · BODACC').length,'BODACC : pagination et relecture inchangée ne créent pas de fausses modifications');
    bodaccVersion=1;const updatedBodaccRun=await request('POST',autoPath,{},token);await runEnrichmentMaintenance(updatedBodaccRun.body.id);
    const changedBodaccCrm=await request('GET','/prospects/'+automaticProspect.body.id,undefined,token),changedBodaccActivities=await request('GET','/activities?prospectId='+automaticProspect.body.id,undefined,token);
    check(changedBodaccActivities.body.filter(a=>a.title==='Enrichissement · BODACC').length===stableBodacc.length+1&&JSON.stringify(changedBodaccCrm.body.sourceDetails.bodacc.announcements).includes('Modification corrigée')&&changedBodaccCrm.body.sourceDetails.bodacc.history.length>0,'BODACC : changement réel appliqué une fois, ancienne version et activité conservées');
    const pappersProfile=await request('POST','/browser/profiles',{source:'pappers',label:'Pappers public'},token);
    const pappersTask=await request('POST','/browser/jobs',{profileId:pappersProfile.body.id,prospectId:liveProspect.body.id,query:'979965506'},token);await runCloudMaintenance(pappersTask.body.id);
    const pappersCrm=await request('GET','/prospects/'+liveProspect.body.id,undefined,token);
    check(pappersCrm.body.siret==='97996550600012'&&pappersCrm.body.sourceDetails.pappers.scope==='unite_legale','Pappers : autre siège du même SIREN ne remplace ni SIRET ni adresse de l’ancien établissement');
    const nordRefresh=await request('POST','/prospects/'+liveProspect.body.id+'/enrichment',{},token);await runEnrichmentMaintenance(nordRefresh.body.id);
    const nordRecords=await request('GET','/prospects/'+liveProspect.body.id,undefined,token);
    check(nordRecords.body.sourceDetails.bodacc.announcements.length===4&&!JSON.stringify(nordRecords.body.sourceDetails.bodacc.announcements).includes('C202699999999'),'BODACC réel : quatre annonces Nord Artisan conservées, résultat d’un autre SIREN rejeté');
    const replayProspect=await request('POST','/prospects',{company:'Reprise BODACC',siren:'966777077',siret:'96677707700019'},token),replayRun=await request('POST','/prospects/'+replayProspect.body.id+'/enrichment',{},token);
    const replayed=await bodaccCheckpoint(replayProspect.body.id,replayRun.body.id,'replay');
    check(replayed.checkpoint.status==='completed'&&replayed.checkpoint.offset===105&&replayed.announcements===105&&replayed.activities===1,'BODACC : curseur et source atomiques, dernière page rejouée après redémarrage sans troncature ni fausse activité');
    const changedIdentity=await request('POST','/prospects',{company:'Identité BODACC corrigée',siren:'966777078',siret:'96677707800019'},token),identityRun=await request('POST','/prospects/'+changedIdentity.body.id+'/enrichment',{},token);
    await bodaccCheckpoint(changedIdentity.body.id,identityRun.body.id,'prepare');
    await request('PATCH','/prospects/'+changedIdentity.body.id,{siren:'966777079',siret:'96677707900019'},token);await runEnrichmentMaintenance(identityRun.body.id,4);
    const identityCrm=await request('GET','/prospects/'+changedIdentity.body.id,undefined,token),identityCalls=bodaccCalls.filter(c=>c.siren==='966777079');
    check(identityCalls[0]?.offset===0&&identityCrm.body.sourceDetails.bodacc.siren==='966777079'&&identityCrm.body.sourceDetails.bodacc.announcements.length===105,'BODACC : SIREN corrigé entre les pages, pagination repartie de zéro sans historique incomplet');
    const archiveJob=await storeTestSourcingJob(automaticProspect.body.id,Array.from({length:65},(_,i)=>({siren:String(966779000+i),company:'Archive entreprise '+i,address:i+' rue Archive 59100 Roubaix',codePostal:'59100'})));
    check((await request('GET','/sourcing/jobs/'+archiveJob+'/results',undefined,token)).body.data.length===65,'Collecte unifiée : 65 anciens résultats consultables, sans coupure de l’historique à 50');
    const officialProfile=await request('POST','/browser/profiles',{source:'entreprises',label:'Annuaire natif'},token);
    const officialTask=await request('POST','/browser/jobs',{profileId:officialProfile.body.id,query:'cloud-official-many',filters:{regions:['32'],departements:['59'],codesPostaux:[]}},token);
    await runCloudMaintenance(officialTask.body.id);await runCloudMaintenance(officialTask.body.id);
    const officialResults=await request('GET','/browser/jobs/'+officialTask.body.id,undefined,token);
    check(officialResults.body.status==='completed'&&officialResults.body.result.captures.length===35&&officialResults.body.result.captures[0].siren,
      'Collecte unifiée : Annuaire natif paginé au-delà de 25 avec filtres géographiques et identifiants');
    const officialImport=await request('POST','/browser/jobs/'+officialTask.body.id+'/import',{captureIds:officialResults.body.result.captures.slice(0,2).map(c=>c.id)},token);
    check(officialImport.body.imported===2&&Object.keys(officialImport.body.job.result.imports).length===2,'Collecte unifiée : import Annuaire avec les mêmes reçus CRM que les autres sources');
    check(state.body.automatic.includes('pagesjaunes'),'Cloud : PagesJaunes dispose du collecteur automatique dans le même navigateur');
    const pjProfile=await request('POST','/browser/profiles',{source:'pagesjaunes',label:'PagesJaunes public'},token);
    const pjTask=await request('POST','/browser/jobs',{profileId:pjProfile.body.id,query:'plombier',area:'Roubaix'},token);await runCloudMaintenance(pjTask.body.id);
    const pjResult=await request('GET','/browser/jobs/'+pjTask.body.id,undefined,token);
    check(pjResult.body.status==='completed'&&pjResult.body.result.captures[0].source==='pagesjaunes','Cloud : résultats PagesJaunes disponibles sans passer par l’extension');
    const pjImported=await request('POST','/browser/jobs/'+pjTask.body.id+'/import',{captureIds:[pjResult.body.result.captures[0].id]},token);
    const pjCrmId=pjImported.body.job?.result?.imports?.[pjResult.body.result.captures[0].id]?.prospectId;
    const pjCrm=await request('GET','/prospects/'+pjCrmId,undefined,token);
    check(pjImported.status===200&&pjCrm.body.siren==='966777008'&&pjCrm.body.sourceDetails.pagesjaunes.openingHours.includes('09h00')&&pjCrm.body.sourceDetails.pagesjaunes.reviews.length===1,
      'Cloud PagesJaunes : import du SIREN seul, horaires, avis, services et réseaux de la fiche détaillée');
    const pjRefresh=await request('POST','/browser/jobs',{profileId:pjProfile.body.id,query:'cloud-pj-refresh',prospectId:pjCrmId},token);await runCloudMaintenance(pjRefresh.body.id);
    const pjRefreshed=await request('GET','/prospects/'+pjCrmId,undefined,token);
    const pjHistory=await request('GET','/activities?prospectId='+pjCrmId,undefined,token);
    check(pjRefreshed.body.sourceDetails.pagesjaunes.openingHours.includes('10h00')&&pjRefreshed.body.sourceDetails.pagesjaunes.history[0].openingHours.includes('09h00'),
      'Cloud PagesJaunes : enrichissement ciblé actualise les détails et conserve la version précédente');
    check(JSON.stringify(pjHistory.body).includes('Informations détaillées PagesJaunes')&&JSON.stringify(pjHistory.body).includes('10h00'),
      'Cloud PagesJaunes : modification détaillée tracée dans l’activité du prospect');
    const branchTarget=await request('POST','/prospects',{company:'Établissement ciblé',siret:'96677705700019',city:'Roubaix',address:'1 rue Cible 59100 Roubaix',phone:'03 20 55 00 01'},token);
    const branchTask=await request('POST','/browser/jobs',{profileId:pjProfile.body.id,prospectId:branchTarget.body.id,query:'cloud-siren-only'},token);await runCloudMaintenance(branchTask.body.id);
    check((await request('GET','/browser/jobs/'+branchTask.body.id,undefined,token)).body.status==='needs_review'&&!(await request('GET','/prospects/'+branchTarget.body.id,undefined,token)).body.email,
      'Enrichissement automatique : SIREN commun sans coordonnées concordantes ne fusionne pas un autre établissement');
    const areaTask=await request('POST','/browser/jobs',{profileId:officialProfile.body.id,query:'cloud-official-area',area:'59000'},token);await runCloudMaintenance(areaTask.body.id);
    const areaResults=await request('GET','/browser/jobs/'+areaTask.body.id,undefined,token);
    check(areaResults.body.result.captures.length===1&&areaResults.body.result.captures[0].city==='Lille','Collecte Annuaire : code postal de la zone vérifié localement, siège parisien exclu');
    const scopeProspect=await request('POST','/prospects',{company:'Activité locale conservée',siret:'96677705600019',city:'Roubaix',address:'9 rue Scope 59100 Roubaix',apeCode:'43.21A'},token);
    await monitoringMaintenance('legacy-empty-label',scopeProspect.body.id);
    const scopeRun=await request('POST','/prospects/'+scopeProspect.body.id+'/enrichment',{},token);await runEnrichmentMaintenance(scopeRun.body.id,1);
    const scopeCrm=await request('GET','/prospects/'+scopeProspect.body.id,undefined,token);
    check(scopeCrm.body.apeCode==='43.21A'&&scopeCrm.body.nafLabel?.includes('électrique')&&scopeCrm.body.sourceDetails.entreprises.apeScope==='unite_legale'&&scopeCrm.body.sourceDetails.annuaire?.apeScope!=='unite_legale'&&scopeCrm.body.sourceDetails.crossSource.conflicts.some(c=>c.field==='apeCode'&&c.incoming==='70.10Z'),
      'Enrichissement officiel : APE de l’établissement conservé face au repli d’activité de l’unité légale');
    const many=await request('POST','/browser/jobs',{profileId:mapProfile.body.id,query:'cloud-many'},token);await runCloudMaintenance(many.body.id);
    const firstMany=await request('GET','/browser/jobs/'+many.body.id,undefined,token);
    check(firstMany.body.status==='queued'&&firstMany.body.result.hasMore&&firstMany.body.result.captures.length===25,'Cloud : la collecte de 25 fiches poursuit automatiquement sa suite');
    const firstIds=firstMany.body.result.captures.map(c=>c.id);
    const earlyImport=await request('POST','/browser/jobs/'+many.body.id+'/import',{captureIds:firstIds},token);
    check(earlyImport.body.imported===25,'Cloud : résultats déjà lus importables pendant que la suite est en file');
    await request('POST','/browser/jobs/'+many.body.id+'/cancel',{},token);
    const continued=await request('POST','/browser/jobs/'+many.body.id+'/retry',{resume:true},token);
    check(continued.body.result.captures.length===25&&Object.keys(continued.body.result.imports).length===25,'Cloud : annuler et reprendre conserve les résultats et les reçus des lots précédents');
    await runCloudMaintenance(many.body.id);
    const finalMany=await request('GET','/browser/jobs/'+many.body.id,undefined,token);
    check(finalMany.body.status==='completed'&&finalMany.body.result.captures.length===38&&finalMany.body.result.captures[0].id===firstIds[0],
      'Cloud : 38 résultats accumulés sans plafond total et sans renommer les anciennes captures');
    check(firstIds.every(id=>finalMany.body.result.imports[id]?.status==='imported'),'Cloud : les reçus CRM restent présents après ajout de la suite');
    const remainingIds=finalMany.body.result.captures.slice(25).map(c=>c.id);
    check((await request('POST','/browser/jobs/'+many.body.id+'/import',{captureIds:remainingIds},token)).body.imported===13,'Cloud : les fiches après la vingt-cinquième sont importables');

    const existingReceipt=await request('POST','/prospects',{company:'CRM cloud existant',address:'20 rue du Test 59100 Roubaix',postalCode:'59100',city:'Roubaix',phone:'03 00 41 01 02'},token);
    const conflictingReceipt=await request('POST','/prospects',{company:'CRM cloud contradictoire',address:'30 rue du Test 59100 Roubaix',postalCode:'59100',city:'Roubaix',phone:'03 00 41 01 99'},token);
    const mixedJob=await request('POST','/browser/jobs',{profileId:mapProfile.body.id,query:'receipt-mixed'},token);await runCloudMaintenance(mixedJob.body.id);
    const mixedBefore=await request('GET','/browser/jobs/'+mixedJob.body.id,undefined,token);
    const mixedIds=mixedBefore.body.result.captures.map(c=>c.id);
    check((await request('POST','/browser/jobs/'+mixedJob.body.id+'/import',{captureIds:mixedIds})).status===401,'Cloud import : refus sans authentification');
    check((await request('POST','/browser/jobs/'+mixedJob.body.id+'/import',{captureIds:mixedIds},foreignToken)).status===404 &&
      (await request('POST','/browser/jobs/'+mixedJob.body.id+'/import',{captureIds:mixedIds},colleague)).status===404,'Cloud import : collecte privée isolée de l’autre agence et du collègue');
    check((await request('POST','/browser/jobs/'+mixedJob.body.id+'/import',{captureIds:[mixedIds[0],'capture-inconnue']},token)).status===400,'Cloud import : sélection étrangère au lot refusée avant tout import');
    check((await request('POST','/browser/jobs/'+created.body.id+'/import',{captureIds:[mixedIds[0]]},token)).status===409,'Cloud import : une tâche d’enrichissement ne devient pas un import de prospects');
    const imports=await Promise.all([request('POST','/browser/jobs/'+mixedJob.body.id+'/import',{captureIds:mixedIds},token),request('POST','/browser/jobs/'+mixedJob.body.id+'/import',{captureIds:mixedIds},token)]);
    check(imports.every(r=>r.status===200)&&imports.reduce((sum,r)=>sum+r.body.imported,0)===1,'Cloud import : deux clics simultanés créent une seule fiche');
    const mixedAfter=await request('GET','/browser/jobs/'+mixedJob.body.id,undefined,token),states=mixedAfter.body.result.imports;
    check(states[mixedIds[0]].status==='imported'&&states[mixedIds[1]].status==='already_present'&&states[mixedIds[1]].prospectId===existingReceipt.body.id,
      'Cloud import : reçus persistants distinguent création et présence préalable dans le CRM');
    check(states[mixedIds[2]].status==='needs_review'&&states[mixedIds[2]].prospectId===conflictingReceipt.body.id&&states[mixedIds[3]].status==='failed',
      'Cloud import : conflit et fiche invalide restent à traiter sans faux succès');
    check(imports.every(r=>r.body.processedIds.length===2)&&
      (await request('GET','/prospects/'+conflictingReceipt.body.id,undefined,token)).body.phone==='03 00 41 01 99',
      'Cloud import : seules les fiches traitées quittent la sélection, téléphone divergent conservé');
    const conflictActivity=await request('GET','/activities?prospectId='+conflictingReceipt.body.id,undefined,token);
    check(conflictActivity.body.filter(a=>a.type==='data_update').length===1,'Cloud import : répétition du lot ne duplique pas l’activité de désaccord');
    const replay=await request('POST','/browser/jobs/'+mixedJob.body.id+'/import',{captureIds:mixedIds.slice(0,2)},token);
    check(replay.body.imported===0&&replay.body.alreadyPresent===2&&replay.body.job.result.imports[mixedIds[0]].at===states[mixedIds[0]].at,
      'Cloud import : réessai après réponse perdue réutilise les reçus sans création ni changement de date');
    const legacyJob=await request('POST','/browser/jobs',{profileId:mapProfile.body.id,query:'receipt-legacy'},token);await runCloudMaintenance(legacyJob.body.id);
    const legacyBefore=await request('GET','/browser/jobs/'+legacyJob.body.id,undefined,token),legacyCapture=legacyBefore.body.result.captures[0];
    const legacyImport=await request('POST','/sourcing/device/import-prospects',{verified:[legacyCapture],drafts:[]},token);
    const legacyAfter=await request('GET','/browser/jobs/'+legacyJob.body.id,undefined,token);
    check(legacyImport.body.imported===1&&legacyAfter.body.result.imports[legacyCapture.id].status==='already_present'&&legacyAfter.body.result.imports[legacyCapture.id].prospectId,
      'Cloud import : anciennes captures importées reconnues depuis la preuve CRM existante');
    const legacyConflictJob=await request('POST','/browser/jobs',{profileId:mapProfile.body.id,query:'receipt-legacy-conflict'},token);await runCloudMaintenance(legacyConflictJob.body.id);
    const legacyConflictBefore=await request('GET','/browser/jobs/'+legacyConflictJob.body.id,undefined,token),legacyConflictCapture=legacyConflictBefore.body.result.captures[0];
    await request('POST','/sourcing/device/import-prospects',{verified:[legacyConflictCapture],drafts:[]},token);
    const legacyGood=await request('GET','/browser/jobs/'+legacyJob.body.id,undefined,token);
    const legacyBad=await request('GET','/browser/jobs/'+legacyConflictJob.body.id,undefined,token);
    check(legacyGood.body.result.imports[legacyCapture.id].status==='already_present'&&legacyBad.body.result.imports[legacyConflictCapture.id].status==='needs_review',
      'Cloud import : seul le désaccord correspondant aux valeurs de la capture la remet en revue');

    const refreshedList=await request('GET','/browser/jobs',undefined,token);
    check(refreshedList.body.find(j=>j.id===mixedJob.body.id).result.imports[mixedIds[0]].status==='imported'&&
      refreshedList.body.find(j=>j.id===legacyJob.body.id).result.imports[legacyCapture.id].status==='already_present',
      'Cloud import : rafraîchir la liste conserve les états des imports anciens et nouveaux');
    if(realPostgresUrl){
      const rollbackJob=await request('POST','/browser/jobs',{profileId:mapProfile.body.id,query:'receipt-rollback'},token);await runCloudMaintenance(rollbackJob.body.id);
      const rollbackBefore=await request('GET','/browser/jobs/'+rollbackJob.body.id,undefined,token);
      await cloudReceiptFailure('install');
      try{
        const rollbackImport=await request('POST','/browser/jobs/'+rollbackJob.body.id+'/import',{captureIds:[rollbackBefore.body.result.captures[0].id]},token);
        const afterFailure=await request('GET','/browser/jobs/'+rollbackJob.body.id,undefined,token);
        const crmAfterFailure=await request('GET','/prospects?search=Import%20cloud%20transaction',undefined,token);
        check(rollbackImport.status===500&&!Object.keys(afterFailure.body.result.imports).length&&crmAfterFailure.body.total===0,
          'Cloud import : panne d’écriture du reçu annule aussi la création CRM dans la même transaction');
      }finally{await cloudReceiptFailure('remove');}
      const retryRollback=await request('POST','/browser/jobs/'+rollbackJob.body.id+'/import',{captureIds:[rollbackBefore.body.result.captures[0].id]},token);
      check(retryRollback.body.imported===1&&retryRollback.body.job.result.imports[rollbackBefore.body.result.captures[0].id].status==='imported',
        'Cloud import : reprise après panne transactionnelle crée et trace une seule fiche');
    }

    const oldImportedId=states[mixedIds[0]].prospectId;await request('DELETE','/prospects/'+oldImportedId,undefined,token);
    const deletedState=(await request('GET','/browser/jobs/'+mixedJob.body.id,undefined,token)).body.result.imports[mixedIds[0]];
    check(deletedState.status==='missing'&&!deletedState.prospectId,'Cloud import : fiche CRM supprimée signalée et rendue réimportable sans lien cassé');
    const restored=await request('POST','/browser/jobs/'+mixedJob.body.id+'/import',{captureIds:[mixedIds[0]]},token);
    check(restored.body.imported===1&&restored.body.job.result.imports[mixedIds[0]].prospectId!==oldImportedId,'Cloud import : réimport autorisé après suppression réelle de la fiche CRM');

    check((await request('POST','/browser/jobs/history/delete',{scope:'all'})).status===401,'Cloud historique : suppression interdite sans connexion');
    check((await request('POST','/browser/jobs/history/delete',{scope:'selected',ids:[]},token)).status===400,'Cloud historique : sélection vide refusée');
    check((await request('POST','/browser/jobs/history/delete',{scope:'all'},foreignToken)).body.deleted===0 &&
      (await request('GET','/browser/jobs/'+created.body.id,undefined,token)).status===200,'Cloud historique : nettoyage d’une autre agence sans effet sur mes tâches');
    check((await request('POST','/browser/jobs/history/delete',{scope:'all'},colleague)).body.deleted===0 &&
      (await request('GET','/browser/jobs/'+created.body.id,undefined,token)).status===200,'Cloud historique : nettoyage d’un collègue sans effet sur mes tâches personnelles');
    check((await request('POST','/browser/jobs/history/delete',{scope:'selected',ids:[created.body.id]},foreignToken)).status===404,'Cloud historique : suppression ciblée isolée par agence');
    check((await request('POST','/browser/jobs/history/delete',{scope:'selected',ids:[created.body.id,randomUUID()]},token)).status===404 &&
      (await request('GET','/browser/jobs/'+created.body.id,undefined,token)).status===200,'Cloud historique : sélection avec ID inaccessible refusée sans suppression partielle');
    const resumed=await request('POST','/browser/jobs/'+cancelJob.body.id+'/retry',{resume:true},token);
    check(resumed.status===200 && resumed.body.id===cancelJob.body.id && resumed.body.status==='queued' && resumed.body.query==='96677700400019' && !resumed.body.result.captures,
      'Cloud : reprise d’une tâche annulée avec même identité et critères conservés');
    await runCloudMaintenance(cancelJob.body.id);
    check((await request('GET','/browser/jobs/'+cancelJob.body.id,undefined,token)).body.status==='completed' &&
      (await request('GET','/prospects/'+cancelTarget.body.id,undefined,token)).body.company==='Cible à conserver','Cloud : tâche annulée reprise jusqu’au résultat et à la mise à jour CRM');
    const protectedJob=await request('POST','/browser/jobs',{profileId:mapProfile.body.id,query:'Tâche en file à conserver'},token);
    check((await request('POST','/browser/jobs/history/delete',{scope:'selected',ids:[created.body.id,protectedJob.body.id]},token)).status===409 &&
      (await request('GET','/browser/jobs/'+created.body.id,undefined,token)).status===200,'Cloud historique : lot mixte actif/terminé refusé atomiquement');
    const single=await request('POST','/browser/jobs/history/delete',{scope:'selected',ids:[created.body.id]},token);
    check(single.body.deleted===1 && single.body.deletedIds[0]===created.body.id && (await request('GET','/browser/jobs/'+created.body.id,undefined,token)).status===404,'Cloud historique : une recherche terminée disparaît durablement');
    check((await request('GET','/prospects/'+target.body.id,undefined,token)).body.company==='Ancien nom cloud' &&
      (await request('GET','/activities?prospectId='+target.body.id,undefined,token)).body.length===activity.body.length &&
      (await request('GET','/browser/profiles',undefined,token)).body.some(p=>p.id===profile.id),'Cloud historique : prospects, activités et profils préservés après suppression');
    check((await request('POST','/browser/jobs/history/delete',{scope:'selected',ids:[discovery.body.id,discovery.body.id]},token)).body.deleted===1,'Cloud historique : identifiants répétés ne doublent pas la suppression');
    for(let i=0;i<32;i++){
      const extra=await request('POST','/browser/jobs',{profileId:mapProfile.body.id,query:'Historique de recette '+i},token);
      await request('POST','/browser/jobs/'+extra.body.id+'/cancel',{},token);
    }
    const cleared=await request('POST','/browser/jobs/history/delete',{scope:'all'},token);
    check(cleared.body.deleted>30 && (await request('GET','/browser/jobs',undefined,token)).body.every(j=>!['completed','cancelled','failed'].includes(j.status)),
      'Cloud historique : nettoyage intégral au-delà des trente recherches affichées');
    check((await request('GET','/browser/jobs/'+protectedJob.body.id,undefined,token)).body.status==='queued' &&
      (await request('GET','/browser/jobs/'+wrong.body.id,undefined,token)).body.status==='needs_review','Cloud historique : nettoyage conserve les tâches actives et en attente de revue');

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
    new Promise(resolve => cloudStub.close(resolve)),
  ]);
  await rm(ephemeralDbDir, { recursive: true, force: true });
}
