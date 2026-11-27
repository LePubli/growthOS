import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
const require=createRequire(process.env.CLOUD_PLAYWRIGHT_PACKAGE||import.meta.url),{chromium}=require('playwright-core');
const directory=process.env.REVIEW_UI_FIXTURE||'/fixtures';
const server=createServer(async(req,res)=>{try{const script=req.url==='/app.js';res.setHeader('Content-Type',script?'text/javascript':'text/html');res.end(await readFile(directory+(script?'/app.js':'/index.html')));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CLOUD_TEST_BROWSER?{executablePath:process.env.CLOUD_TEST_BROWSER}:{})});
try{
 for(const scenario of ['waiting','ready','applied','busy','lost','history','discovery']){
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  const history=scenario==='history'||scenario==='discovery';
  await page.goto(origin+'/navigateur?source='+(scenario==='discovery'?'google_maps':'societe_com')+(history?'':'&prospectId=10000000-0000-4000-8000-000000000001&jobId=10000000-0000-4000-8000-000000000002')+'&scenario='+scenario);
  if(scenario==='discovery'){
   await page.getByRole('textbox',{name:'Recherche',exact:true}).fill('Plombier');
   await page.getByRole('button',{name:'Voir les résultats',exact:true}).click();
   const launch=page.getByRole('button',{name:'Lancer la collecte',exact:true});
   await launch.click();await page.waitForFunction(()=>window.__reviewCalls.launch===1);
   await launch.click();await page.waitForFunction(()=>window.__reviewCalls.launch===2);
   assert.equal(await page.getByRole('dialog').count(),0);assert.deepEqual(errors,[]);await page.close();console.log('✓ Discovery history keeps the search action available after repeated completed searches');continue;
  }
  if(scenario==='history')await page.getByRole('button',{name:'Comparer et valider',exact:true}).click();
  if(scenario==='busy'||scenario==='lost'){
   await page.getByRole('alert').filter({hasText:scenario==='busy'?'occupé':'Session fermée'}).first().waitFor();
   assert(page.url().includes('jobId=10000000-0000-4000-8000-000000000002'),'409/423 must retain the targeted job');
   await page.evaluate(()=>window.__releaseSource());
  }
  if(scenario==='waiting'||scenario==='busy'||scenario==='lost')await page.getByRole('button',{name:'Lire cette fiche',exact:true}).click();
  if(scenario!=='applied')await page.getByRole('button',{name:'Valider et enregistrer',exact:true}).click();
  await page.waitForURL('**/prospects/10000000-0000-4000-8000-000000000001?view=enrichments&reviewedJob=10000000-0000-4000-8000-000000000002');
  const tab=page.getByRole('button',{name:'Enrichissements',exact:true});await tab.waitFor();assert.equal(await tab.getAttribute('aria-current'),'page');
  await page.getByRole('status').filter({hasText:'Enregistré depuis'}).first().waitFor();
  assert.equal(await page.evaluate(()=>window.__reviewCalls.confirm),scenario==='applied'?0:1,'Exactly one explicit confirmation, none for already applied data');
  await page.reload();await page.getByRole('button',{name:'Enrichissements',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Enrichissements',exact:true}).getAttribute('aria-current'),'page','The tab survives reload');
  assert.deepEqual(errors,[]);console.log('✓ Source review scenario:',scenario);await page.close();
 }
 console.log('✓ Real React/Chromium: read → compare → one confirmation → correct prospect and enrichment tab; reload, alreadyApplied and 409/423 context retained');
}finally{await browser.close();await new Promise(r=>server.close(r));}
