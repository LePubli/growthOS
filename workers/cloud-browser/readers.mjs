import {readFileSync} from 'node:fs';
const extension=readFileSync(new URL('../../extensions/growthos-pagesjaunes/background.js',import.meta.url),'utf8');
function reader(start,end){
  const a=extension.indexOf(start),b=extension.indexOf(end,a);
  if(a<0||b<a)throw Error('Lecteur PagesJaunes canonique introuvable');
  return '('+extension.slice(a,b).trim()+')()';
}
export const readers={
  societe_com:readFileSync(new URL('../../extensions/growthos-pagesjaunes/societe.js',import.meta.url),'utf8'),
  general:readFileSync(new URL('../../extensions/growthos-pagesjaunes/capture.js',import.meta.url),'utf8'),
  pagesjaunesSearch:reader('function readSearchResults()','async function waitTab('),
  pagesjaunesProfile:reader('async function readBusinessProfile()','async function enrichProfile('),
};

// Public, rendered DOM only. Never inspect provider state or hidden API responses.
export function societeSearchCards(){
  const visible=n=>!!n?.getClientRects().length&&getComputedStyle(n).visibility!=='hidden';
  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  return [...document.querySelectorAll('a[href*="/societe/"]')].filter(visible).map(a=>{
    const card=a.closest('li[data-type],article,.finder-card')||a;
    const title=card.querySelector('h2,h3');
    const heading=title?.cloneNode(true);heading?.querySelectorAll('span,button').forEach(n=>n.remove());
    const label=clean(a.getAttribute('aria-label')||heading?.textContent||a.innerText);
    const text=clean(card.innerText);
    const location=[...card.querySelectorAll('p')].map(n=>clean(n.innerText)).find(v=>/^\d{5}\s+/.test(v))||text.match(/\b\d{5}\s+[A-ZÀ-Ÿ][A-ZÀ-Ÿ '’-]*$/)?.[0]||'';
    return {url:a.href,label,location};
  });
}
export function pageEvidence(){
  const visible=n=>!!n?.getClientRects().length&&getComputedStyle(n).visibility!=='hidden';
  const text=(document.body?.innerText||'').slice(0,18000);
  const challenge=!!document.querySelector('iframe[src*="challenges.cloudflare.com"],#challenge-running,#challenge-stage,.cf-turnstile')||
    /(?:compl[eé]ter? le ["«]?challenge|complete.*security check|verify you are human|v[eé]rifiez que vous [eê]tes humain|unusual traffic|trafic inhabituel)/i.test(text);
  const consent=!!document.querySelector('form[action*="consent"],form[action*="sorry"]')||/avant de continuer vers google|before you continue to google/i.test(text);
  const selector=location.hostname.includes('bing.com')?'#b_results .b_algo h2 a':'#search a:has(h3),#rso a:has(h3)';
  const references=[...document.querySelectorAll(selector)].filter(visible).flatMap(a=>{
    try{const u=new URL(a.href);if(u.protocol!=='https:'||u.username||u.password)return [];
      return [{url:u.href.slice(0,1000),label:(a.innerText||'').replace(/\s+/g,' ').trim().slice(0,180)}];}catch{return [];}
  }).slice(0,20);
  const empty=/aucun r[eé]sultat|did not match any documents|no results found|there are no results/i.test(text);
  return {challenge,consent,references,empty};
}
export function mapsDetailEvidence(){
  const root=document.querySelector('[role="main"]');
  const title=root?.querySelector('h1.DUwDvf');
  const control=root?.querySelector('[data-item-id="address"]');
  const visible=n=>!!n?.getClientRects().length&&getComputedStyle(n).visibility!=='hidden';
  if(!visible(title)||!visible(control))return null;
  return {title:title.innerText.trim().slice(0,160),address:(control.getAttribute('aria-label')||control.innerText).replace(/^(?:adresse|address)\s*:\s*/i,'').trim().slice(0,320)};
}
