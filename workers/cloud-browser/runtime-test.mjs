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
  await p.context.route('https://www.societe.com/**',route=>route.fulfill({contentType:'text/html',body:route.request().url().includes('/societe/')?company:`<html><body><a href="${companyUrl}">ATELIER CLOUD</a><a href="${companyUrl}#__establishments">Établissements</a></body></html>`}));return p;
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
  const maps={...identity,profileId:'10000000-0000-4000-8000-000000000005',source:'google_maps'};
  p=await service.profile(maps);
  await p.context.route('https://www.google.com/**',route=>{
    const url=route.request().url(),index=Number(new URL(url).pathname.match(/Atelier-(\d+)/)?.[1]||0);
    const body=url.includes('/maps/place/')?`<main role="main"><h1>Atelier ${index}</h1><button data-item-id="address" aria-label="Adresse: ${index+1} rue du Test 59100 Roubaix">Adresse</button><button data-item-id="phone:tel" aria-label="Téléphone: 03 20 11 22 33">Téléphone</button></main>`
      :`<div role="feed">${Array.from({length:35},(_,i)=>`<a href="https://www.google.com/maps/place/Atelier-${i}">Atelier ${i}</a>`).join('')}<p>Vous êtes arrivé à la fin de la liste.</p></div>`;
    return route.fulfill({contentType:'text/html',body});
  });
  const mapBatch1=await service.collect({...maps,query:'plombier',area:'Roubaix'});
  assert.equal(mapBatch1.results.length,25);assert.equal(mapBatch1.hasMore,true);
  const mapBatch2=await service.collect({...maps,query:'plombier',area:'Roubaix',cursor:mapBatch1.cursor,resume:true});
  assert.equal(mapBatch2.results.length,10);assert.equal(mapBatch2.hasMore,false);
  assert.equal(new Set([...mapBatch1.results,...mapBatch2.results].map(c=>c.sourceUrl)).size,35,'Plus de 25 fiches réellement lues sans répétition');
  const search={...identity,profileId:'10000000-0000-4000-8000-000000000007',source:'google_search'};
  p=await service.profile(search);
  await p.context.route('https://www.google.com/**',route=>route.fulfill({contentType:'text/html',body:new URL(route.request().url()).searchParams.get('q')==='selected-panel'
    ?'<div id="rhs"><h2>Atelier choisi</h2><p>8 rue du Test 59100 Roubaix</p><a href="tel:0320112233">03 20 11 22 33</a></div>'
    :'<p>Ouvrez une fiche lisible</p>'}));
  const waiting=await service.collect({...search,query:'plombier'});
  assert.equal(waiting.status,'awaiting_user');
  await p.page.goto('https://www.google.com/search?q=selected-panel');
  const resumed=await service.collect({...search,query:'plombier',resume:true,cursor:waiting.cursor});
  assert.equal(resumed.status,'completed');assert.equal(resumed.results[0].company,'Atelier choisi');
  assert.ok(p.page.url().includes('selected-panel'),'La reprise conserve le panneau choisi manuellement');
  const pj={...identity,profileId:'10000000-0000-4000-8000-000000000006',source:'pagesjaunes'};
  p=await service.profile(pj);
  await p.context.route('https://www.pagesjaunes.fr/**',route=>{
    const url=new URL(route.request().url()),number=url.pathname.includes('/pros/')?Number(url.pathname.split('/').pop())-100000000:Number(url.searchParams.get('page')||1);
    const details={"@type":"LocalBusiness",name:'Atelier PagesJaunes '+number,address:{streetAddress:number+' rue du Test',postalCode:'59100',addressLocality:'Roubaix'},telephone:'03 20 11 22 33',email:'contact@atelier-recette.invalid',url:'https://atelier-recette.invalid'};
    const body=url.pathname.includes('/pros/')?`<main><h1>${details.name}</h1><p>${number} rue du Test 59100 Roubaix</p><a href="tel:0320112233">Téléphone</a><a href="mailto:contact@atelier-recette.invalid">Email professionnel</a><script type="application/ld+json">${JSON.stringify(details)}</script></main>`
      :`<ul><li class="bi"><a class="bi-denomination" href="/pros/${100000000+number}"><h3>${details.name}</h3></a><span class="bi-address">${number} rue du Test 59100 Roubaix</span></li></ul>${number===1?'<a rel="next" href="/annuaire/chercherlespros?quoiqui=plombier&ou=Roubaix&page=2">Suivant</a>':''}`;
    return route.fulfill({contentType:'text/html',body});
  });
  const pjBatch1=await service.collect({...pj,query:'plombier',area:'Roubaix'});
  assert.equal(pjBatch1.results[0].company,'Atelier PagesJaunes 1');assert.equal(pjBatch1.results[0].codePostal,'59100');assert.equal(pjBatch1.hasMore,true);
  const pjBatch2=await service.collect({...pj,query:'plombier',area:'Roubaix',cursor:pjBatch1.cursor,resume:true});
  assert.equal(pjBatch2.results[0].company,'Atelier PagesJaunes 2');assert.equal(pjBatch2.hasMore,false);
  assert.equal(pjBatch2.results[0].email,'contact@atelier-recette.invalid');
  assert.equal(pjBatch2.results[0].pagesjaunesProfile.name,'Atelier PagesJaunes 2');
  const unrelated={...identity,profileId:'10000000-0000-4000-8000-000000000008'};
  p=await service.profile(unrelated);
  await p.context.route('https://www.societe.com/**',route=>route.fulfill({contentType:'text/html',body:'<a href="https://www.societe.com/societe/monsieur-kevin-duville-793137845.html">MONSIEUR KEVIN DUVILLE</a>'}));
  const rejected=await service.collect({...unrelated,query:'Nord Artisan',area:'Lille',target:{company:'Nord Artisan'}});
  assert.equal(rejected.status,'awaiting_user');assert.equal(rejected.results.length,0);
  assert.ok(p.page.url().includes('/recherche?'),'Une unique fiche sans nom concordant ne doit pas être ouverte automatiquement');
  const realistic={...identity,profileId:'10000000-0000-4000-8000-000000000009'};
  p=await service.profile(realistic);
  await p.context.route('https://www.societe.com/**',route=>{
    const url=new URL(route.request().url());
    const body=url.pathname.includes('/societe/')?`<main><h1>NORD ARTISAN</h1><dl><div><dt>SIREN</dt><dd>979 965 506<button>Copier</button></dd></div><div><dt>SIRET DU SIEGE SOCIAL</dt><dd>979 965 506 00020<button>Copier</button></dd></div><div><dt>ADRESSE</dt><dd>34 PLACE DU GENERAL DE GAULLE BUREAU 3, 59800 LILLE</dd></div></dl>
      <h2>Dirigeants de NORD ARTISAN</h2><ul><li><a href="/manager/Alice.RECETTE.123.html">Alice RECETTE</a><p>MANDAT</p><p>Présidente depuis le 19 novembre 2026</p><a href="/manager/Alice.RECETTE.123.html">Voir la fiche</a></li></ul><h2>Finances</h2></main>`
      :`<style>.overlay{position:absolute;inset:0}li{position:relative;padding:10px}</style><ul>
      <li data-type="c"><a class="overlay" href="/societe/nord-artisan-979965506.html" aria-label="NORD ARTISAN"></a><div><h2>NORD ARTISAN<span>979 965 506</span></h2><p>Travaux de menuiserie métallique</p><p>59000 LILLE</p></div></li>
      <li data-type="c"><a class="overlay" href="/societe/nord-artisan-111111111.html" aria-label="NORD ARTISAN"></a><div><h2>NORD ARTISAN<span>111 111 111</span></h2><p>75001 PARIS</p></div></li>
      <li data-type="c"><a class="overlay" href="/societe/artisan-du-nord-798461463.html" aria-label="ARTISAN DU NORD"></a><div><h2>ARTISAN DU NORD<span>798 461 463</span></h2><p>59000 LILLE</p></div></li></ul>`;
    return route.fulfill({contentType:'text/html',body});
  });
  const real=await service.collect({...realistic,query:'Nord Artisan',area:'Lille',target:{company:'Nord Artisan',city:'Lille'}});
  assert.equal(real.status,'completed');assert.equal(real.results[0].siret,'97996550600020');
  assert.equal(real.results[0].companyDetails.managerContacts[0].role,'Présidente');
  assert.ok(real.results[0].companyDetails.managerContacts[0].profileUrl.includes('/manager/'));
  const rendered={...maps,profileId:'10000000-0000-4000-8000-000000000010'};
  p=await service.profile(rendered);
  await p.context.route('https://www.google.com/**',route=>route.fulfill({contentType:'text/html',body:'<main role="main"><h1 class="DUwDvf">Nord Artisan</h1><button data-item-id="address" aria-label="Adresse: 38 Bd Carnot, 59800 Lille">Adresse</button><button data-item-id="phone:tel" aria-label="Téléphone: 07 80 99 59 59">Téléphone</button></main>'}));
  const detail=await service.collect({...rendered,query:'Nord Artisan',area:'Lille'});
  assert.equal(detail.results[0].mapsDetail.title,'Nord Artisan');assert.ok(detail.results[0].sourceUrl.includes('/maps/search/'));
  for(const source of ['google_search','bing']){
    const organic={...identity,source,profileId:source==='bing'?'10000000-0000-4000-8000-000000000012':'10000000-0000-4000-8000-000000000011'};
    p=await service.profile(organic);
    await p.context.route('**/*',route=>route.fulfill({contentType:'text/html',body:source==='bing'?'<ol id="b_results"><li class="b_algo"><h2><a href="https://nordartisan.fr/">Nord Artisan</a></h2></li></ol>':'<div id="search"><a href="https://nordartisan.fr/"><h3>Nord Artisan</h3></a></div>'}));
    const links=await service.collect({...organic,query:'Nord Artisan',area:'Lille'});
    assert.equal(links.status,'completed');assert.equal(links.results.length,0);assert.equal(links.references[0].url,'https://nordartisan.fr/');
  }
  const blocked={...pj,profileId:'10000000-0000-4000-8000-000000000013'};
  p=await service.profile(blocked);
  await p.context.route('https://www.pagesjaunes.fr/**',route=>route.fulfill({status:403,contentType:'text/html',body:'<h1>Sécurité</h1><p>Afin de nous aider à lutter contre certaines attaques informatiques, veuillez compléter le "challenge" suivant.</p><div id="challenge-stage"></div>'}));
  const challenge=await service.collect({...blocked,query:'Nord Artisan',area:'Lille'});
  assert.equal(challenge.status,'awaiting_user');assert.ok(challenge.message.includes('Cloudflare'));assert.equal(challenge.results.length,0);
  console.log('✓ Régressions DOM : Societe.com lien vide + ville + /manager/, Maps détaillé sur URL search, résultats organiques Google/Bing, blocage Cloudflare explicite');
  console.log('✓ Chromium réel : 35 fiches Maps en continuation et PagesJaunes recherche → détail → page suivante avec lecteurs canoniques');
  console.log('✓ Chromium réel : recherche → fiche Societe.com → extraction, vue JPEG, saisie, session persistante, séparation des comptes, contrôle et déconnexion');
}finally{child.kill('SIGTERM');await service.close();await rm(directory,{recursive:true,force:true});}
