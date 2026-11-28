// E-réputation — lot 2 « veille » (agent 3).
// Lecteurs dédiés à la veille, séparés des lecteurs de prospection (agent 2) :
//  - serp    : top N organique Google ou Bing d'une requête (titre, URL, extrait) ;
//  - reviews : note, nombre d'avis et derniers avis d'une fiche Google Maps ou PagesJaunes.
// Mêmes garde-fous que la prospection : profil persistant du tenant, navigation
// limitée au domaine de la source, aucun contournement de contrôle de sécurité
// ou de consentement (la tâche passe « awaiting_user »).
import {BrowserError} from './service.mjs';
import {scope,searchUrl,sourceNavigation} from './protocol.mjs';
import {readers,pageEvidence} from './readers.mjs';

const pause=ms=>new Promise(r=>setTimeout(r,ms));
export const EREP_TASKS={serp:['google_search','bing'],reviews:['google_maps','pagesjaunes']};
const isPlace=(source,url)=>source==='pagesjaunes'
  ?/^https:\/\/(?:www\.)?pagesjaunes\.fr\/pros\/\d+/.test(url)
  :/^https:\/\/(?:www\.)?google\.(?:com|fr)\/maps\/place\//.test(url);

/** Validation stricte de la demande (aucun champ libre transmis au navigateur sans contrôle). */
export function erepInput(input){
  const identity=scope(input);
  const task=input?.task;
  if(!Object.hasOwn(EREP_TASKS,task)||!EREP_TASKS[task].includes(identity.source))throw new BrowserError(400,'Tâche de veille invalide pour cette source');
  if(task==='serp'){
    const query=typeof input.query==='string'?input.query.trim():'';
    if(!query||query.length>160)throw new BrowserError(400,'Requête de veille invalide');
    const depth=Math.max(10,Math.min(100,Math.round(Number(input.depth)||20)));
    return {...identity,task,query,depth};
  }
  const url=typeof input.url==='string'?input.url.trim():'';
  if(!sourceNavigation(identity.source,url)||!isPlace(identity.source,url))throw new BrowserError(400,'Fiche à surveiller invalide');
  const limit=Math.max(1,Math.min(50,Math.round(Number(input.limit)||20)));
  return {...identity,task,url,limit};
}

// ── Lecteurs exécutés dans la page (fonctions autonomes, DOM visible uniquement).
export function serpResults(){
  const visible=n=>!!n?.getClientRects().length&&getComputedStyle(n).visibility!=='hidden';
  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const bing=location.hostname.includes('bing.com');
  const own=h=>/(?:^|\.)(?:google\.[a-z.]+|bing\.com|microsoft\.com|msn\.com)$/i.test(h);
  const anchors=bing?[...document.querySelectorAll('#b_results li.b_algo h2 a')]:[...document.querySelectorAll('#search a:has(h3),#rso a:has(h3)')];
  const seen=new Set(),out=[];
  for(const a of anchors){
    if(!visible(a))continue;
    let u;try{u=new URL(a.href);}catch{continue;}
    if(!/^https?:$/.test(u.protocol)||u.username||u.password||own(u.hostname))continue;
    u.hash='';const url=u.href.slice(0,1000);if(seen.has(url))continue;seen.add(url);
    const card=bing?a.closest('li.b_algo'):a.closest('.MjjYud,.g,[data-hveid],[data-sokoban-container]');
    const title=clean(bing?a.innerText:a.querySelector('h3')?.innerText).slice(0,300);
    const snippet=clean(card?.querySelector(bing?'.b_caption p,.b_lineclamp2,.b_lineclamp3,.b_lineclamp4':'.VwiC3b,[data-sncf],.IsZvec,[style*="-webkit-line-clamp"]')?.innerText).slice(0,600);
    out.push({url,title,snippet});
  }
  return out;
}
export function mapsReviews(limit){
  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const root=document.querySelector('[role="main"]')||document.body;
  const name=clean(root.querySelector('h1')?.innerText).slice(0,200);
  const box=root.querySelector('div.F7nice');
  const boxText=clean(box?.innerText);
  const ratingRaw=clean(box?.querySelector('span[aria-hidden="true"]')?.innerText)||boxText.match(/\b([0-5][,.]\d)\b/)?.[1]||'';
  const rating=Number(ratingRaw.replace(',','.'));
  const countLabel=clean(box?.querySelector('span[aria-label*="avis" i],span[aria-label*="review" i]')?.getAttribute('aria-label'))||boxText.match(/\(([\d\s .]+)\)/)?.[1]||'';
  const count=Number(countLabel.replace(/[^\d]/g,''));
  const reviews=[];
  for(const node of [...document.querySelectorAll('div.jftiEf[data-review-id],div[data-review-id].jJc9Ad')]){
    const id=node.getAttribute('data-review-id');
    if(!id||reviews.some(r=>r.externalId===id))continue;
    const stars=clean(node.querySelector('span.kvMYJc,span[role="img"][aria-label*="étoile" i],span[role="img"][aria-label*="star" i]')?.getAttribute('aria-label'));
    const value=Number(stars.match(/([0-5])/)?.[1]);
    reviews.push({externalId:id.slice(0,120),author:clean(node.querySelector('.d4r55')?.innerText).slice(0,100)||null,
      rating:Number.isFinite(value)&&value>0?value:null,date:clean(node.querySelector('.rsqaWe')?.innerText).slice(0,40)||null,
      text:clean(node.querySelector('.wiI7pd')?.innerText).slice(0,2000),ownerResponse:!!node.querySelector('.CDe7pd')});
    if(reviews.length>=limit)break;
  }
  return {name,rating:Number.isFinite(rating)&&rating>0&&rating<=5?rating:null,count:Number.isFinite(count)&&count>0?count:null,reviews};
}

async function blocked(page){
  const evidence=await page.evaluate(pageEvidence).catch(()=>({challenge:false,consent:false,empty:false}));
  if(evidence.challenge)return 'La source demande un contrôle de sécurité. Effectuez-le dans le navigateur cloud puis relancez la veille.';
  if(evidence.consent)return 'La source demande votre consentement. Validez-le dans le navigateur cloud puis relancez la veille.';
  return evidence.empty?'empty':null;
}

async function serp(p,t){
  const results=[];let url=searchUrl(t.source,t.query),pages=0;
  const maxPages=Math.ceil(t.depth/10)+1;
  while(url&&pages<maxPages&&results.length<t.depth){
    if(!sourceNavigation(t.source,url))break;
    await p.page.goto(url,{waitUntil:'domcontentloaded',timeout:25000});pages++;
    await p.page.locator(t.source==='bing'?'#b_results li.b_algo h2 a':'#search a:has(h3),#rso a:has(h3)').first().waitFor({state:'visible',timeout:6000}).catch(()=>{});
    const read=await p.page.evaluate(serpResults);
    if(!read.length){
      const reason=await blocked(p.page);
      if(reason==='empty'||results.length&&!reason)break;
      return {status:'awaiting_user',results,pages,message:reason||'La page de résultats n’est pas lisible. Vérifiez-la dans le navigateur cloud puis relancez.'};
    }
    for(const item of read){
      if(results.length>=t.depth)break;
      if(!results.some(r=>r.url===item.url))results.push({...item,position:results.length+1});
    }
    const next=await p.page.locator(t.source==='bing'?'a.sb_pagN,a[rel="next"]':'a#pnnext,a[rel="next"]').evaluateAll(nodes=>nodes.map(n=>n.href)).catch(()=>[]);
    url=next.find(v=>sourceNavigation(t.source,v))||null;
    if(url)await pause(900+Math.floor(Math.random()*600));
  }
  return {status:'completed',results,pages};
}

async function reviews(p,t){
  await p.page.goto(t.url,{waitUntil:'domcontentloaded',timeout:25000});
  await p.page.locator('h1').first().waitFor({state:'visible',timeout:10000}).catch(()=>{});
  if(t.source==='pagesjaunes'){
    const reason=await blocked(p.page);
    if(reason&&reason!=='empty')return {status:'awaiting_user',summary:null,reviews:[],message:reason};
    // Lecteur canonique de la fiche PagesJaunes (partagé, lecture seule).
    const profile=await p.page.evaluate(readers.pagesjaunesProfile);
    if(!profile?.name)return {status:'awaiting_user',summary:null,reviews:[],message:'Fiche PagesJaunes illisible. Vérifiez-la dans le navigateur cloud puis relancez.'};
    return {status:'completed',summary:{name:profile.name,rating:profile.rating??null,count:profile.reviewCount??null},
      reviews:(profile.reviews||[]).slice(0,t.limit).map(r=>({externalId:null,author:r.author||null,rating:null,date:r.date||null,text:r.text,ownerResponse:false}))};
  }
  let read=await p.page.evaluate(mapsReviews,t.limit);
  if(!read.name){
    const reason=await blocked(p.page);
    return {status:'awaiting_user',summary:null,reviews:[],message:reason&&reason!=='empty'?reason:'Fiche Google Maps illisible. Vérifiez-la dans le navigateur cloud puis relancez.'};
  }
  // Onglet « Avis », tri « Les plus récents », défilement borné.
  const tab=p.page.locator('button[role="tab"]').filter({hasText:/^(?:Avis|Reviews)$/i}).first();
  if(await tab.count()){
    await tab.click({timeout:4000}).catch(()=>{});await pause(1200);
    const sort=p.page.locator('button[aria-label*="Trier" i],button[aria-label*="Sort" i]').first();
    if(await sort.count()){
      await sort.click({timeout:4000}).catch(()=>{});await pause(600);
      await p.page.locator('[role="menuitemradio"]').filter({hasText:/plus récents|newest/i}).first().click({timeout:4000}).catch(()=>{});
      await pause(1200);
    }
    for(let i=0,stalls=0;i<12&&stalls<2;i++){
      const before=await p.page.locator('div.jftiEf[data-review-id]').count();
      if(before>=t.limit)break;
      await p.page.evaluate(()=>{const n=document.querySelector('div.jftiEf[data-review-id]');let s=n?.parentElement;
        while(s&&s.scrollHeight<=s.clientHeight)s=s.parentElement;if(s)s.scrollTop=s.scrollHeight;});
      await pause(900);
      stalls=(await p.page.locator('div.jftiEf[data-review-id]').count())===before?stalls+1:0;
    }
    // Déplier les avis tronqués (« Plus ») avant lecture.
    await p.page.evaluate(()=>document.querySelectorAll('button.w8nwRe').forEach(b=>b.click())).catch(()=>{});
    await pause(300);
    read=await p.page.evaluate(mapsReviews,t.limit);
  }
  return {status:'completed',summary:{name:read.name,rating:read.rating,count:read.count},reviews:read.reviews.filter(r=>r.text||r.rating)};
}

/** Point d'entrée du worker : partage le verrou « busy » du service de prospection. */
export async function erepCollect(service,input){
  const t=erepInput(input);
  if(service.busy||service.opening)throw new BrowserError(423,'Le navigateur traite déjà une collecte.');
  const p=await service.profile(t);
  if(service.busy)throw new BrowserError(423,'Une autre opération est en cours.');
  service.busy=true;service.touch();
  try{return t.task==='serp'?await serp(p,t):await reviews(p,t);}
  finally{service.busy=false;service.touch();}
}
