import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BrowserService} from './service.mjs';
const require=createRequire(process.env.CLOUD_PLAYWRIGHT_PACKAGE||import.meta.url);
const {chromium}=require('playwright-core');
const directory=await mkdtemp(join(tmpdir(),'growthos-cloud-runtime-'));
const tempServer=createServer();await new Promise(r=>tempServer.listen(0,'127.0.0.1',r));const port=tempServer.address().port;await new Promise(r=>tempServer.close(r));
const token='recette-http-token-interne-separe-'.repeat(2);
const child=spawn(process.execPath,[fileURLToPath(new URL('./server.mjs',import.meta.url))],{env:{...process.env,CLOUD_BROWSER_TOKEN:token,BROWSER_PROFILE_DIR:directory,PORT:String(port)},stdio:'ignore'});
const service=new BrowserService({directory,sessionKey:'recette-jeton-interne-separe'.repeat(3),chromium:{launchPersistentContext:(path,options)=>chromium.launchPersistentContext(path,{...options,...(process.env.CLOUD_TEST_BROWSER?{executablePath:process.env.CLOUD_TEST_BROWSER}:{})})}});
const identity={tenantId:'10000000-0000-4000-8000-000000000001',profileId:'10000000-0000-4000-8000-000000000002',source:'societe_com'};
const companyUrl='https://www.societe.com/societe/atelier-cloud-966777002.html';
const company=`<html><head><title>ATELIER CLOUD</title></head><body><main><h1>ATELIER CLOUD</h1><dl>
  <dt>SIREN</dt><dd>966777002</dd><dt>SIRET</dt><dd>96677700200019</dd><dt>Adresse</dt><dd>8 rue du Test 59100 Roubaix</dd>
  <dt>Activité (NAF / APE)</dt><dd>43.22A</dd><dt>Forme juridique</dt><dd>SAS</dd><dt>Dirigeant</dt><dd>Alice CLOUD</dd>
  </dl><input id="proof" aria-label="Texte de recette"/><button>Valider</button></main></body></html>`;
async function fixture(scope){
  const p=await service.profile(scope);
  await p.context.route('https://www.societe.com/**',route=>route.fulfill({contentType:'text/html',body:route.request().url().includes('/societe/')?company:`<html><body><a href="${companyUrl}">ATELIER CLOUD</a></body></html>`}));return p;
}
try{
  let health;
  for(let attempt=0;attempt<50;attempt++){try{health=await fetch('http://127.0.0.1:'+port+'/healthz');break;}catch{await new Promise(r=>setTimeout(r,100));}}
  assert.equal(health?.status,401,'Le service interne refuse un accès sans jeton');
  const call=(path,body,secret=token)=>fetch('http://127.0.0.1:'+port+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Worker-Token':secret},...(body===undefined?{}:{body:JSON.stringify(body)})});
  assert.equal((await call('/healthz',undefined,'é'.repeat(token.length))).status,401,'Un jeton non ASCII ne fait pas tomber le service');
  assert.equal((await call('/healthz')).status,200);
  assert.equal((await call('/open',{...identity,tenantId:'../autre'})).status,400);
  assert.equal((await call('/open',{query:'x'.repeat(25000)})).status,413);
  assert.equal((await call('/view',identity)).status,409);
  let p=await fixture(identity);
  const opened=await service.open({...identity,query:'96677700200019'});
  assert.ok(opened.controlId);const view=await service.view(identity);assert.ok(view.image.startsWith('data:image/jpeg;base64,'));
  const collected=await service.collect({...identity,query:'96677700200019',target:{siret:'96677700200019'}});
  assert.equal(collected.status,'completed');assert.equal(collected.results[0].city,'Roubaix');assert.equal(collected.results[0].siret,'96677700200019');
  assert.equal(collected.results[0].companyDetails.fields['Forme juridique'],'SAS');
  assert.equal(collected.results[0].companyDetails.managers[0],'Alice CLOUD');
  await p.page.evaluate(()=>{document.cookie='growthos_proof=session-recette; path=/; Secure; SameSite=Lax';localStorage.setItem('growthos_proof','recette');});
  const field=await p.page.locator('#proof').boundingBox();
  await service.action({...identity,controlId:opened.controlId,event:{type:'click',x:field.x+5,y:field.y+5}});
  await service.action({...identity,controlId:opened.controlId,event:{type:'text',text:'saisie de recette'}});
  assert.equal(await p.page.locator('#proof').inputValue(),'saisie de recette');
  const second=await service.open({...identity,keepPage:true});
  await assert.rejects(()=>service.action({...identity,controlId:opened.controlId,event:{type:'key',key:'Enter'}}),e=>e.status===409);
  await assert.rejects(()=>service.view({...identity,tenantId:'10000000-0000-4000-8000-000000000003'}),e=>e.status===409);
  await service.close();
  assert.ok(!(await readFile(join(directory,identity.tenantId,identity.profileId,'growthos-session.enc'),'utf8')).includes('session-recette'),'Le fichier de reprise des cookies de session est chiffré');
  p=await fixture(identity);await service.open({...identity,query:'96677700200019'});
  assert.ok((await p.context.cookies()).some(c=>c.name==='growthos_proof'),'Cookie conservé après fermeture et relance');
  await p.page.goto(companyUrl);assert.equal(await p.page.evaluate(()=>localStorage.getItem('growthos_proof')),'recette');
  const other={...identity,profileId:'10000000-0000-4000-8000-000000000004'};await fixture(other);await service.open({...other,query:'test'});
  assert.ok(!(await service.current.context.cookies()).some(c=>c.name==='growthos_proof'),'Autre compte sans cookie du premier');
  await assert.rejects(()=>service.collect({...other,source:'linkedin',query:'test'}),e=>e.status===422);
  await service.erase(identity);await fixture(identity);await service.open({...identity,query:'test'});
  assert.ok(!(await service.current.context.cookies()).some(c=>c.name==='growthos_proof'),'Déconnexion efface réellement la session');
  console.log('✓ Chromium réel : recherche → fiche Societe.com → extraction, vue JPEG, saisie, session persistante, séparation des comptes, contrôle et déconnexion');
}finally{child.kill('SIGTERM');await service.close();await rm(directory,{recursive:true,force:true});}
