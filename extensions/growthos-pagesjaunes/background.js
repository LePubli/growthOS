/* Extension MV3 : navigation depuis le Chrome de l'utilisateur, sur PagesJaunes uniquement.
   Aucune requête vers le VPS, aucun accès aux identifiants, aucune donnée inventée.
*/
let busy = false;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
function validate(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Paramètres absents');
  const query = String(payload.query || '').trim();
  const locations = payload.locations;
  const limit = Number(payload.limit);
  if (query.length < 3 || query.length > 120 ||
      !Array.isArray(locations) || !locations.length || locations.length > 8 ||
      !locations.every(loc => typeof loc === 'string' && loc.trim().length >= 2 && loc.length <= 120) ||
      !Number.isInteger(limit) || limit < 1 || limit > 25) {
    throw new Error('Activité, limite ou zones invalides (8 zones maximum)');
  }
  return {query, locations: [...new Set(locations.map(loc => loc.trim()))], limit};
}
function readSearchResults() {
  // Fonction sérialisée puis exécutée dans le vrai onglet PagesJaunes.
  const body = document.body?.innerText?.slice(0, 2000) || '';
  if (/captcha|vérifiez que vous êtes humain|accès refusé/i.test(body)
      && !document.querySelector('li.bi')) throw new Error('Vérification manuelle PagesJaunes nécessaire');
  const cards = [...document.querySelectorAll('li.bi')].slice(0, 100);
  const output = [];
  const unique = new Set();
  for (const card of cards) {
    const nameNode = card.querySelector('h3');
    const addressNode = card.querySelector('.bi-address, .label-adresse');
    const name = (nameNode?.innerText || nameNode?.textContent || '').replace(/\s+/g, ' ').trim();
    const address = (addressNode?.innerText || addressNode?.textContent || '').replace(/\s+/g, ' ')
      .replace(/\s*Voir (?:le plan|l'itinéraire).*$/i, '').trim();
    const codePostal = address.match(/\b\d{5}\b/)?.[0] || '';
    if (!name || !address || !codePostal || name.length > 160 || address.length > 320) continue;
    const city = address.split(codePostal)[1]?.trim().replace(/[,;].*$/, '')
      .replace(/\s*Voir.*$/i,'').slice(0, 120) || null;
    const profile = card.querySelector('a.bi-denomination[href]');
    let sourceUrl = null;
    if (profile) {
      try {
        const url = new URL(profile.getAttribute('href'), location.href);
        if (url.protocol === 'https:' && (url.hostname === 'pagesjaunes.fr' || url.hostname.endsWith('.pagesjaunes.fr'))) sourceUrl = url.href;
      } catch {}
    }
    const phoneLink = card.querySelector('a[href^="tel:"]');
    const phone = (phoneLink?.getAttribute('href')?.slice(4) || card.querySelector('.number-contact')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) || null;
    const websiteAnchor = [...card.querySelectorAll('a[href]')].find(a => /site (?:internet|web)/i.test(a.innerText || a.textContent || ''));
    let website = null;
    if (websiteAnchor) {
      try {
        const u = new URL(websiteAnchor.getAttribute('href'), location.href);
        if (['http:', 'https:'].includes(u.protocol)) website = u.href.slice(0, 500);
      } catch {}
    }
    const siret = card.innerText?.match(/\b\d{14}\b/)?.[0] || null;
    const identity = [name.toLocaleLowerCase('fr'), address.toLocaleLowerCase('fr'), codePostal].join('|');
    if (unique.has(identity)) continue;
    unique.add(identity);
    // Identifiant opaque déterministe. Aucun SIREN ou téléphone fictif.
    let hash = 2166136261;
    for (const chr of identity) hash = Math.imul(hash ^ chr.charCodeAt(0), 16777619) >>> 0;
    output.push({
      id: 'pj_local_' + hash.toString(16) + '_' + output.length,
      company: name, address, codePostal, city, phone, website, sourceUrl, siret,
    });
  }
  return {results: output, hasCards: cards.length > 0,
    pageTitle: document.title.slice(0, 120)};
}
async function waitTab(tabId, maxMs) {
  const began = Date.now();
  while (Date.now() - began < maxMs) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === 'complete') return;
    await wait(350);
  }
  throw new Error('Chargement PagesJaunes trop long');
}
async function scrape(params) {
  const {query, locations, limit} = validate(params);
  const found = [], seen = new Set(), warnings = [];
  for (const area of locations) {
    if (found.length >= limit) break;
    const url = new URL('https://www.pagesjaunes.fr/annuaire/chercherlespros');
    url.searchParams.set('quoiqui', query);
    url.searchParams.set('ou', area);
    url.searchParams.set('univers', 'pagesjaunes');
    let tabId;
    try {
      const tab = await chrome.tabs.create({url: url.href, active: false});
      if (typeof tab.id !== 'number') throw new Error('Onglet non créé');
      tabId = tab.id;
      await waitTab(tabId, 25000);
      await wait(1800); // Contenu rendu côté navigateur.
      const injected = await chrome.scripting.executeScript({target:{tabId},func:readSearchResults});
      const page = injected?.[0]?.result;
      if (!page) throw new Error('Aucun contenu exploitable');
      if (!page.hasCards) warnings.push(area + ' : aucun bloc entreprise détecté (' + page.pageTitle + ')');
      for (const item of page.results) {
        const key = item.company.toLowerCase() + '|' + item.address.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key); found.push(item);
        if (found.length >= limit) break;
      }
    } catch (err) {
      warnings.push(area + ' : ' + String(err?.message || err).slice(0,160));
    } finally {
      if (typeof tabId === 'number') await chrome.tabs.remove(tabId).catch(()=>{});
    }
    if (found.length < limit) await wait(5000);
  }
  return {ok:true,results:found,warnings};
}

function isProfileUrl(raw) {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' &&
      (u.hostname === 'pagesjaunes.fr' || u.hostname === 'www.pagesjaunes.fr') &&
      /^\/pros\/\d{4,20}\/?$/.test(u.pathname);
  } catch { return false; }
}
// Executed only in a PagesJaunes profile tab. It interacts with visible UI, then
// returns bounded, verifiable fields. No fabricated email/SIREN/telephone.
async function readBusinessProfile() {
  const clean = v => String(v || '').replace(/\s+/g,' ').trim();
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const main = document.querySelector('main, [role="main"]') || document.body;
  const safeUrl = (raw, base=location.href) => {
    try { const u = new URL(raw,base); return ['https:','http:'].includes(u.protocol) ? u.href : null; }
    catch { return null; }
  };
  // Expand only relevant information affordances, not advertising or review buttons.
  const revealTerms = [/voir plus de coordonnées/i,/^sur l’établissement$/i,/^sur l'entreprise$/i,
    /informations financières et juridiques/i,/voir les horaires/i];
  for (const term of revealTerms) {
    const controls=[...main.querySelectorAll('button,[role=button],summary')];
    const control=controls.find(el=>term.test(clean(el.innerText || el.textContent).slice(0,95)));
    if (control) { try {control.click(); await wait(450);} catch {} }
  }
  // A phone number is recorded only when a real tel: link becomes visible.
  const revealPhone=[...main.querySelectorAll('button,[role=button],a')].find(el=>
    /afficher le n[°o]|afficher le numéro/i.test(clean(el.innerText || el.textContent).slice(0,80)));
  if (revealPhone) { try {revealPhone.click();await wait(850);} catch {} }
  const names=[...main.querySelectorAll('h1')].map(e=>clean(e.innerText || e.textContent)).filter(Boolean);
  const name=names[0] || null;
  const ld=[];
  for (const el of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const value=JSON.parse(el.textContent || '');
      const visit=(obj,depth=0)=>{
        if(depth>4 || !obj || typeof obj !== 'object')return;
        if(Array.isArray(obj))return obj.forEach(x=>visit(x,depth+1));
        const types=[].concat(obj['@type'] || []);
        if(types.some(t=>/LocalBusiness|Restaurant|Organization|Store/i.test(String(t)))) ld.push(obj);
        if(obj['@graph']) visit(obj['@graph'],depth+1);
      };
      visit(value);
    } catch {}
  }
  const normalized=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const business=ld.find(v=>name && (normalized(v.name).includes(normalized(name)) || normalized(name).includes(normalized(v.name))))
    || ld.find(v=>!name && typeof v.name === 'string');
  const contactRoots = [...main.querySelectorAll('section,[class*="contact"],[id*="contact"]')];
  const contact = contactRoots.find(el=>/contacter|coordonnées|sites et réseaux sociaux/i.test(clean(el.innerText).slice(0,280))) || main;
  const links=[...contact.querySelectorAll('a[href]')];
  const urlByLabel = (regexp) => {
    for(const a of links){
      if(!regexp.test(clean(a.innerText || a.textContent)))continue;
      const url=safeUrl(a.getAttribute('href'));
      if(url) return url;
    }
    return null;
  };
  const socialLinks={};
  for(const a of links){
    const url=safeUrl(a.getAttribute('href')); if(!url)continue;
    const host=new URL(url).hostname.replace(/^www\./,'');
    if(host==='facebook.com' || host.endsWith('.facebook.com')) socialLinks.facebook ||= url;
    else if(host==='instagram.com' || host.endsWith('.instagram.com')) socialLinks.instagram ||= url;
    else if(host==='linkedin.com' || host.endsWith('.linkedin.com')) socialLinks.linkedin ||= url;
  }
  const phoneCandidates=[
    ...[...main.querySelectorAll('a[href^="tel:"]')].map(a=>clean(a.getAttribute('href')?.slice(4))),
    clean(business?.telephone),
  ].filter(Boolean);
  const phone=phoneCandidates.find(p=>/^(?:\+33|0)[\d\s().-]{8,20}$/.test(p)) || null;
  const email=[...main.querySelectorAll('a[href^="mailto:"]')]
    .map(a=>clean(a.getAttribute('href')?.slice(7)).split('?')[0])
    .find(v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) || null;
  let website=urlByLabel(/^(?:site internet|site web|visiter le site)$/i);
  if(!website){
    const explicit = links.find(a => {
      const label=clean(a.innerText || a.textContent);
      const url=safeUrl(a.getAttribute('href'));
      if(!url)return false;
      const host=new URL(url).hostname.replace(/^www\./,'');
      return /^(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}$/i.test(label)
        && !/(^|\.)(pagesjaunes\.fr|facebook\.com|instagram\.com|linkedin\.com)$/.test(host);
    });
    if(explicit)website=safeUrl(explicit.getAttribute('href'));
  }
  if(!website && business?.url) {
    const candidate=safeUrl(business.url);
    if(candidate && !new URL(candidate).hostname.endsWith('pagesjaunes.fr')) website=candidate;
  }
  if(website && new URL(website).hostname.endsWith('pagesjaunes.fr'))website=null;
  let address=null, city=null, codePostal=null;
  const ad=business?.address;
  if(ad && typeof ad==='object' && ad.streetAddress && /^\d{5}$/.test(String(ad.postalCode || ''))) {
    codePostal=String(ad.postalCode);
    city=clean(ad.addressLocality).replace(/\bVoir le plan\b.*/i,'').slice(0,120) || null;
    address=clean(ad.streetAddress+' '+codePostal+' '+(city||'')).slice(0,320);
  }
  if(!address){
    const line=[...main.querySelectorAll('address,[class*="adresse"],[class*="address"]')]
      .map(e=>clean(e.innerText || e.textContent)).find(v=>/\b\d{5}\b/.test(v) && v.length<320);
    if(line){
      address=line.replace(/\s*Voir (?:le plan|l'itinéraire).*$/i,'').trim();
      codePostal=address.match(/\b\d{5}\b/)?.[0]||null;
      city=codePostal ? clean(address.split(codePostal)[1]).replace(/\s*Voir.*$/i,'').slice(0,120)||null:null;
    }
  }
  const section=(label)=>{
    const heading=[...main.querySelectorAll('h2,h3,h4,[role="heading"]')]
      .find(h=>label.test(clean(h.innerText || h.textContent)));
    if(!heading) return null;
    const parent=heading.closest('section,article,[class*="block"],[class*="section"]') || heading.parentElement?.parentElement;
    return clean(parent?.innerText || '').slice(0,3000)||null;
  };
  const description=section(/présentation|à propos|plus d'infos/i)?.slice(0,1500)||null;
  const openingHours=section(/^horaires|informations pratiques/i)?.slice(0,1500)||null;
  const services=section(/prestations|services|spécialités/i)?.slice(0,1400)||null;
  const legal=section(/informations financières et juridiques|identification/i)?.slice(0,1500)||null;
  const siteText=legal || '';
  const siret=siteText.match(/\bSIRET\s*:?\s*(\d{14})\b/i)?.[1] || null;
  const siren=siteText.match(/\bSIREN\s*:?\s*(\d{9})\b/i)?.[1] || siret?.slice(0,9) || null;
  const ratingVal=Number(String(business?.aggregateRating?.ratingValue||'').replace(',','.'));
  const rating=Number.isFinite(ratingVal) && ratingVal>=0 && ratingVal<=5?ratingVal:null;
  const ratingCount=Number(business?.aggregateRating?.reviewCount || business?.aggregateRating?.ratingCount);
  return {
    sourceUrl:location.href,name,address,codePostal,city,phone,email,website,siret,siren,
    description,openingHours,services,legal,
    socials:socialLinks,
    rating,reviewCount:Number.isInteger(ratingCount)&&ratingCount>=0?ratingCount:null,
    capturedAt:new Date().toISOString(),
  };
}
async function enrichProfile(payload) {
  const url=String(payload?.url || '');
  if(!isProfileUrl(url))throw new Error('Fiche PagesJaunes invalide');
  let tabId;
  try {
    const tab=await chrome.tabs.create({url,active:false});
    if(typeof tab.id!=='number')throw new Error('Onglet PagesJaunes non créé');
    tabId=tab.id;
    await waitTab(tabId,25000);
    await wait(1200);
    const injected=await chrome.scripting.executeScript({target:{tabId},func:readBusinessProfile});
    const profile=injected?.[0]?.result;
    if(!profile || !profile.name)throw new Error('La fiche PagesJaunes ne contient pas de nom lisible');
    if(!isProfileUrl(profile.sourceUrl))throw new Error('URL de fiche incorrecte');
    return {ok:true,profile};
  } finally {
    if(typeof tabId==='number')await chrome.tabs.remove(tabId).catch(()=>{});
  }
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  let origin;
  try { origin = new URL(sender.url || '').origin; } catch {}
  if (origin !== 'https://agile.le-publicitaire.fr') {
    reply({ok:false,error:'Origine non autorisée'}); return false;
  }
  if (message?.action === 'ping') {
    reply({ok:true,results:[],warnings:[]}); return false;
  }
  if (!['search', 'enrich'].includes(message?.action)) {
    reply({ok:false,error:'Action inconnue'}); return false;
  }
  if (busy) {
    reply({ok:false,error:'Une recherche locale est déjà en cours'}); return false;
  }
  busy = true;
  (message.action === 'enrich' ? enrichProfile(message.payload) : scrape(message.payload))
    .then(reply)
    .catch(error=>reply({ok:false,error:String(error?.message || error)}))
    .finally(()=>{busy=false;});
  return true;
});
