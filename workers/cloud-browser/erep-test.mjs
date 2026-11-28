// Veille e-réputation (lot 2) : lecteurs SERP et avis exécutés dans un vrai Chromium
// sur des pages de recette locales (aucun accès réseau réel).
// Lancement : node workers/cloud-browser/erep-test.mjs
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BrowserService} from './service.mjs';
import {erepCollect,erepInput} from './erep.mjs';

const require=createRequire(process.env.CLOUD_PLAYWRIGHT_PACKAGE||import.meta.url);
let chromium;try{({chromium}=require('playwright-core'));}catch{({chromium}=require('playwright'));}
const directory=await mkdtemp(join(tmpdir(),'growthos-erep-browser-'));
const service=new BrowserService({directory,sessionKey:'recette-veille-erep-cle-interne'.repeat(2),
  chromium:{launchPersistentContext:(path,options)=>chromium.launchPersistentContext(path,{...options,...(process.env.CLOUD_TEST_BROWSER?{executablePath:process.env.CLOUD_TEST_BROWSER}:{})})}});
const tenantId='20000000-0000-4000-8000-000000000001';
const id=(n,source)=>({tenantId,profileId:`20000000-0000-4000-8000-00000000000${n}`,source});
const html=body=>`<!doctype html><html><head><meta charset="utf-8"></head><body>${body}</body></html>`;
const googleCard=i=>`<div class="MjjYud"><div class="g"><a href="https://site${i}.example.fr/page?x=${i}#frag"><h3>Résultat ${i} Acme Lille</h3></a>
  <div class="VwiC3b">Extrait ${i} : Acme Lille, ${i===3?'arnaque et escroquerie signalées':'artisan recommandé'}.</div></div></div>`;
const googlePage=(from,to,next)=>html(`<div id="search"><div id="rso">
  <div class="MjjYud"><a href="https://maps.google.com/x"><h3>Lien Google</h3></a></div>
  ${Array.from({length:to-from+1},(_,k)=>googleCard(from+k)).join('')}</div></div>${next?`<a id="pnnext" href="${next}">Suivant</a>`:''}`);
const bingPage=html(`<ol id="b_results">${[1,2,3].map(i=>`<li class="b_algo"><h2><a href="https://bing${i}.example.org/">Bing ${i}</a></h2><div class="b_caption"><p>Texte ${i}</p></div></li>`).join('')}</ol>`);
const mapsPlace=html(`<div role="main"><h1 class="DUwDvf">Acme Lille</h1>
  <div class="F7nice"><span><span aria-hidden="true">4,2</span></span><span><span aria-label="128 avis">(128)</span></span></div>
  <div class="m6QErb DxyBCb" style="height:300px;overflow:auto"><div style="height:900px">
  <div class="jftiEf" data-review-id="r1"><div class="d4r55">Marie D.</div><span class="kvMYJc" role="img" aria-label="5 étoiles"></span><span class="rsqaWe">il y a 2 jours</span><span class="wiI7pd">Travail impeccable, équipe sérieuse.</span></div>
  <div class="jftiEf" data-review-id="r2"><div class="d4r55">Paul</div><span class="kvMYJc" role="img" aria-label="1 étoile"></span><span class="rsqaWe">il y a 1 semaine</span><span class="wiI7pd">Chantier abandonné, aucune réponse.</span><div class="CDe7pd">Réponse du propriétaire</div></div>
  </div></div></div>`);
const consent=html('<form action="https://consent.google.com/save"><p>Avant de continuer vers Google</p></form>');
const challenge=html('<div id="challenge-running">Vérifiez que vous êtes humain</div>');

async function routed(scope,pages){
  const p=await service.profile(scope);
  await p.context.route('https://**/*',route=>{
    const url=route.request().url();
    const hit=Object.entries(pages).find(([prefix])=>url.startsWith(prefix));
    return hit?route.fulfill({contentType:'text/html; charset=utf-8',body:hit[1]}):route.abort();
  });
  return p;
}
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;console.log('  ✓ '+m);};
try{
  // Validation des demandes
  assert.throws(()=>erepInput({...id(1,'google_search'),task:'reviews',url:'https://www.google.com/maps/place/x'}),/invalide/);checks++;
  assert.throws(()=>erepInput({...id(1,'google_search'),task:'serp',query:''}),/invalide/);checks++;
  assert.throws(()=>erepInput({...id(1,'google_maps'),task:'reviews',url:'https://evil.example/maps/place/x'}),/invalide/);checks++;
  ok(erepInput({...id(1,'bing'),task:'serp',query:'acme',depth:500}).depth===100,'Profondeur SERP bornée à 100');

  // SERP Google sur deux pages, liens Google exclus, positions continues
  const page2='https://www.google.com/search?q=acme&start=10';
  await routed(id(1,'google_search'),{[page2]:googlePage(11,20,null),'https://www.google.com/search':googlePage(1,10,page2)});
  const g=await erepCollect(service,{...id(1,'google_search'),task:'serp',query:'Acme Lille',depth:15});
  ok(g.status==='completed'&&g.results.length===15&&g.pages===2,'Google : 15 résultats lus sur 2 pages');
  ok(g.results.every((r,i)=>r.position===i+1)&&!g.results.some(r=>/google/.test(r.url)),'Google : positions continues, liens Google exclus');
  ok(g.results[0].url==='https://site1.example.fr/page?x=1'&&/arnaque/.test(g.results[2].snippet),'Google : URL sans ancre et extrait lus');

  // Bing
  await routed(id(2,'bing'),{'https://www.bing.com/search':bingPage});
  const b=await erepCollect(service,{...id(2,'bing'),task:'serp',query:'Acme',depth:20});
  ok(b.status==='completed'&&b.results.length===3&&b.results[1].title==='Bing 2'&&b.results[1].snippet==='Texte 2','Bing : résultats et extraits lus');

  // Consentement : jamais contourné
  await routed(id(3,'google_search'),{'https://www.google.com/search':consent});
  const c=await erepCollect(service,{...id(3,'google_search'),task:'serp',query:'Acme',depth:10});
  ok(c.status==='awaiting_user'&&/consentement/.test(c.message),'Consentement Google : passage en attente, pas de contournement');

  // Avis Google Maps
  const place='https://www.google.com/maps/place/Acme+Lille/@50.6,3.0';
  await routed(id(4,'google_maps'),{'https://www.google.com/maps/place/':mapsPlace});
  const m=await erepCollect(service,{...id(4,'google_maps'),task:'reviews',url:place,limit:10});
  ok(m.status==='completed'&&m.summary.rating===4.2&&m.summary.count===128,'Maps : note 4,2 et 128 avis lus');
  ok(m.reviews.length===2&&m.reviews[1].rating===1&&m.reviews[1].ownerResponse===true&&m.reviews[0].author==='Marie D.','Maps : avis, note, auteur et réponse du propriétaire lus');

  // PagesJaunes protégé par Cloudflare : attente humaine
  await routed(id(5,'pagesjaunes'),{'https://www.pagesjaunes.fr/pros/':challenge});
  const pj=await erepCollect(service,{...id(5,'pagesjaunes'),task:'reviews',url:'https://www.pagesjaunes.fr/pros/123456'});
  ok(pj.status==='awaiting_user'&&/contrôle de sécurité/.test(pj.message),'PagesJaunes : contrôle de sécurité remis à l’humain');

  // Verrou partagé avec la prospection
  service.busy=true;
  await assert.rejects(()=>erepCollect(service,{...id(1,'google_search'),task:'serp',query:'x'}),e=>e.status===423);
  service.busy=false;ok(true,'Navigateur occupé par la prospection : veille refusée (423)');
  console.log(`\n${checks} contrôles navigateur de veille réussis.`);
}finally{await service.close();await rm(directory,{recursive:true,force:true});}
