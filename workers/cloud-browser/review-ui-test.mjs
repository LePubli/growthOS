import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
const require=createRequire(process.env.CLOUD_PLAYWRIGHT_PACKAGE||import.meta.url),{chromium}=require('playwright-core');
const directory=process.env.REVIEW_UI_FIXTURE||'/fixtures';
const server=createServer(async(req,res)=>{try{const file=['/app.js','/app.css'].includes(req.url)?req.url:'/index.html';res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(directory+file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CLOUD_TEST_BROWSER?{executablePath:process.env.CLOUD_TEST_BROWSER}:{})});
try{
 for(const scenario of ['waiting','ready','applied','busy','lost','history','discovery','save_conflict','mobile_long','mobile_blocked','activities_fail','parent_fail','finish_fail']){
  const mobile=scenario.startsWith('mobile_')||scenario.endsWith('_fail');const page=await browser.newPage({viewport:mobile?{width:scenario==='mobile_long'?360:390,height:844}:{width:1280,height:900},isMobile:mobile,hasTouch:mobile});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  const history=scenario==='history'||scenario==='discovery';
  await page.goto(origin+'/navigateur?source='+(scenario==='discovery'?'google_maps':'societe_com')+(history?'':'&prospectId=10000000-0000-4000-8000-000000000001&jobId=10000000-0000-4000-8000-000000000002')+'&scenario='+scenario);
  if(history)await page.locator('summary').filter({hasText:'Tâches récentes'}).click();
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
  if(scenario.startsWith('mobile_')){
   const dialog=page.getByRole('dialog',{name:'Comparer et valider cette fiche'});await dialog.waitFor();
   await page.getByRole('button',{name:'Reprendre le contrôle',exact:true}).click();
   const remote=page.getByLabel('Navigateur distant interactif');await remote.waitFor();
   await page.getByRole('button',{name:'Taille réelle',exact:true}).click();
   const img=remote.locator('img');assert.equal(Math.round((await img.boundingBox()).width),1280,'Source remains readable at real pixel size on mobile');
   await remote.evaluate(el=>{el.scrollLeft=300;el.scrollTop=200;});assert((await remote.evaluate(el=>el.scrollLeft))>0,'Source can be panned horizontally');
   await dialog.scrollIntoViewIfNeeded();
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No document overflow at mobile viewport');
   const reviewBox=await dialog.boundingBox(),historyBox=await page.locator('.cloud-browser-history-drawer').boundingBox();
   assert(historyBox.y>=reviewBox.y+reviewBox.height-1,'Comparison is fully contained above the history; no clipped fixed-height panel');
   const button=dialog.getByRole('button',{name:'Valider et enregistrer',exact:true});await button.scrollIntoViewIfNeeded();
   if(scenario==='mobile_blocked'){assert(await button.isDisabled());await dialog.getByText('Le SIREN ou le SIRET contredit', {exact:false}).waitFor();assert.equal(await page.evaluate(()=>window.__reviewCalls.confirm),0);await page.close();console.log('✓ Mobile identity conflict remains explained and cannot overwrite CRM');continue;}
  }
  if(scenario==='save_conflict'){
   await page.getByRole('checkbox',{name:'Remplacer par cette valeur'}).uncheck();
   await page.getByRole('button',{name:'Valider et enregistrer',exact:true}).click();
   await page.getByRole('alert').filter({hasText:'La valeur CRM a changé'}).waitFor();
   assert(page.url().includes('/navigateur?'),'No success return before actual save');
   await page.getByRole('button',{name:'Actualiser la comparaison',exact:true}).click();
   const choice=page.getByRole('checkbox',{name:'Remplacer par cette valeur'});await choice.waitFor();assert.equal(await choice.isChecked(),false,'Explicit replacement choices survive comparison refresh');
  }
  if(scenario!=='applied')await page.getByRole('button',{name:'Valider et enregistrer',exact:true}).click();
  await page.waitForURL(url=>url.pathname==='/prospects/10000000-0000-4000-8000-000000000001'&&url.searchParams.get('view')==='enrichments'&&url.searchParams.get('reviewedJob')==='10000000-0000-4000-8000-000000000002');
  const tab=page.getByRole('button',{name:'Enrichissements',exact:true});await tab.waitFor();assert.equal(await tab.getAttribute('aria-current'),'page');
  await page.getByRole('status').filter({hasText:'Enregistré depuis'}).first().waitFor();
  assert.equal(await page.evaluate(()=>window.__reviewCalls.confirm),scenario==='applied'?0:scenario==='save_conflict'?2:1,'Exactly one explicit confirmation, none for already applied data');
  if(['activities_fail','parent_fail'].includes(scenario))await page.getByRole('status').filter({hasText:'Certaines données de suivi'}).first().waitFor();
  await page.reload();await page.getByRole('button',{name:'Enrichissements',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Enrichissements',exact:true}).getAttribute('aria-current'),'page','The tab survives reload');
  assert.deepEqual(errors,[]);console.log('✓ Source review scenario:',scenario);await page.close();
 }
 console.log('✓ Real React/Chromium: read → compare → one confirmation → correct prospect and enrichment tab; reload, alreadyApplied and 409/423 context retained');
}finally{await browser.close();await new Promise(r=>server.close(r));}
