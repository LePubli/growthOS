/* Extension MV3 : PagesJaunes depuis le navigateur, capture explicite d'autres sources.
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
  // Toutes les données proviennent de la fiche affichée dans CE navigateur.
  // Chaque onglet est lu séparément : jamais le texte d'une page entière comme "horaires".
  const clean = v => String(v || '').replace(/\s+/g, ' ').trim();
  const waitLocal = ms => new Promise(resolve => setTimeout(resolve, ms));
  const root = () => document.querySelector('main, [role="main"]') || document.body;
  const safeUrl = raw => {
    try {
      const u = new URL(raw, location.href);
      return ['https:', 'http:'].includes(u.protocol) ? u.href : null;
    } catch { return null; }
  };
  const isPagesJaunes = host => host === 'pagesjaunes.fr' || host.endsWith('.pagesjaunes.fr');
  const normalize = v => clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9]/g,'');
  const name = clean(root().querySelector('h1')?.innerText || root().querySelector('h1')?.textContent);
  const jsonBusinesses = [];
  for (const tag of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const walk = (value, depth=0) => {
        if (!value || typeof value !== 'object' || depth > 5) return;
        if (Array.isArray(value)) { value.forEach(v => walk(v, depth+1)); return; }
        if ([].concat(value['@type'] || []).some(t => /LocalBusiness|Restaurant|Organization|Store|Plumber/i.test(String(t)))) jsonBusinesses.push(value);
        if (value['@graph']) walk(value['@graph'], depth+1);
      };
      walk(JSON.parse(tag.textContent || ''));
    } catch {}
  }
  const business = jsonBusinesses.find(b => name && normalize(b.name) === normalize(name))
    || jsonBusinesses.find(b => name && (normalize(b.name).includes(normalize(name)) || normalize(name).includes(normalize(b.name))))
    || jsonBusinesses[0];
  const contactLinks = new Map();
  function collectLinks() {
    for (const anchor of root().querySelectorAll('a[href]')) {
      const label = clean(anchor.innerText || anchor.textContent);
      const raw = anchor.getAttribute('href') || '';
      const url = safeUrl(raw);
      if ((url && label) || /^tel:|^mailto:/i.test(raw)) contactLinks.set(label + '|' + raw, {label,raw,url});
    }
  }
  collectLinks();
  const snapshots = {};
  const selectedPanel = control => {
    const id = control?.getAttribute('aria-controls');
    const pane = id && document.getElementById(id);
    if (pane && !pane.hasAttribute('hidden')) return pane;
    const live = [...root().querySelectorAll('[role="tabpanel"]')].find(el =>
      !el.hasAttribute('hidden') && el.getAttribute('aria-hidden') !== 'true');
    return live || root();
  };
  async function selectTab(label) {
    const controls = [...root().querySelectorAll('[role="tab"], button, a, [role="button"]')];
    const control = controls.find(el =>
      el.getClientRects().length > 0 &&
      label.test(clean(el.innerText || el.textContent).slice(0,60)) &&
      clean(el.innerText || el.textContent).length < 65);
    if (control) {
      try { control.click(); await waitLocal(600); } catch {}
    }
    const pane = selectedPanel(control);
    snapshots[label.source] = (pane.innerText || '').slice(0,16000);
    collectLinks();
    return pane;
  }
  async function clickReveal(pattern) {
    const el = [...root().querySelectorAll('button, summary, [role="button"]')].find(c =>
      c.getClientRects().length > 0 &&
      pattern.test(clean(c.innerText || c.textContent).slice(0,100)) &&
      clean(c.innerText || c.textContent).length < 110);
    if (el) { try {el.click(); await waitLocal(450);} catch {} }
  }
  await clickReveal(/voir plus de coordonnées/i);
  await clickReveal(/afficher le (?:n°|numéro|nº)/i);
  collectLinks();
  const presentation = await selectTab(/^Présentation$/i);
  const presentationText = (presentation.innerText || '').slice(0,16000);
  const introHeading = [...presentation.querySelectorAll('h2,h3,h4')].find(el =>
    /^plus d.infos sur|^à propos(?: de)?/i.test(clean(el.innerText || el.textContent)));
  const introArea = introHeading?.closest('section,article') || introHeading?.parentElement?.parentElement;
  const presentationParagraphs = introArea ? [...introArea.querySelectorAll('p')].map(el => clean(el.innerText)) : [];
  const presentationServices = [...presentation.querySelectorAll('ul, ol')].filter(el =>
    /prestation|activit[eé]s|sp[eé]cialit[eé]s/i.test(clean(el.previousElementSibling?.innerText || '').slice(0,90)))
    .flatMap(el => [...el.querySelectorAll('li')].map(li => clean(li.innerText)));
  await clickReveal(/voir plus de coordonnées/i);
  await clickReveal(/afficher le (?:n°|numéro|nº)/i);
  collectLinks();
  const hoursPane = await selectTab(/^Horaires$/i);
  const hoursText = (hoursPane.innerText || '').slice(0,12000);
  const reviewPane = await selectTab(/^Avis$/i);
  const reviewsText = (reviewPane.innerText || '').slice(0,12000);
  const reviewNodes = [...reviewPane.querySelectorAll('[itemprop="review"], [itemtype*="schema.org/Review"], article[class*="avis"], article[class*="review"]')];
  const reviews = [];
  for (const element of reviewNodes.slice(0,12)) {
    const text = clean(element.querySelector('[itemprop="reviewBody"], blockquote, [class*="commentaire"], [class*="comment"], p')?.innerText || '');
    // Ne pas classer des textes marketing ou menus comme avis clients.
    if (text.length < 20 || text.length > 800 || /professionnels, appelez|pagesjaunes vous aide/i.test(text)) continue;
    const author = clean(element.querySelector('[itemprop="author"], [class*="author"], [class*="auteur"]')?.innerText).slice(0,100) || null;
    const date = clean(element.querySelector('time, [itemprop="datePublished"]')?.getAttribute('datetime')
      || element.querySelector('time, [itemprop="datePublished"]')?.innerText).slice(0,40) || null;
    if (!reviews.some(r => r.text === text)) reviews.push({author,date,text});
  }
  await selectTab(/^Contact$/i);
  await clickReveal(/afficher le (?:n°|numéro|nº)/i);
  await clickReveal(/voir plus de coordonnées/i);
  collectLinks();
  await selectTab(/^INSEE$/i);
  await clickReveal(/^sur l[’']établissement$/i);
  const establishmentText = (root().innerText || '').slice(0,10000);
  await clickReveal(/^sur l[’']entreprise$/i);
  const companyText = (root().innerText || '').slice(0,10000);
  await clickReveal(/informations financières et juridiques/i);
  const inseeText = establishmentText + '\n' + companyText + '\n' +
    (root().innerText || '').slice(0,10000);
  collectLinks();

  const collected = [...contactLinks.values()];
  let website = null;
  for (const link of collected) {
    if (!link.url) continue;
    const target = new URL(link.url);
    const host = target.hostname.replace(/^www\./,'');
    const labelHost = link.label.replace(/^https?:\/\//i,'').replace(/^www\./i,'').replace(/\/.*$/,'').toLowerCase();
    // PagesJaunes peut utiliser un lien de redirection interne alors que le domaine
    // réel est écrit en clair dans l'onglet Contact.
    if (isPagesJaunes(host) && /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(labelHost)
        && !isPagesJaunes(labelHost)) {
      website = 'https://' + labelHost; break;
    }
    if (isPagesJaunes(host) || /^(?:www\.)?(?:facebook|instagram|linkedin|google|youtube|twitter|x)\.com$/.test(host)) continue;
    const labelMatches = labelHost === host;
    if (labelMatches || /^(?:site web|site internet|visiter le site)$/i.test(link.label)) {
      website = link.url.slice(0,500); break;
    }
  }
  if (!website && typeof business?.url === 'string') {
    const candidate = safeUrl(business.url);
    if (candidate && !isPagesJaunes(new URL(candidate).hostname)) website = candidate.slice(0,500);
  }
  const socials = {};
  for (const link of collected) {
    if (!link.url) continue;
    const host = new URL(link.url).hostname.replace(/^www\./,'');
    if (host === 'facebook.com' || host.endsWith('.facebook.com')) socials.facebook ||= link.url;
    if (host === 'instagram.com' || host.endsWith('.instagram.com')) socials.instagram ||= link.url;
    if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) socials.linkedin ||= link.url;
  }
  const tel = collected.filter(l => l.raw.startsWith('tel:')).map(l => clean(decodeURIComponent(l.raw.slice(4))));
  const phone = [...tel, clean(business?.telephone)].find(p => /^(?:\+33|0)[\d\s().-]{8,20}$/.test(p)) || null;
  const email = collected.filter(l => l.raw.startsWith('mailto:'))
    .map(l => clean(l.raw.slice(7).split('?')[0]))
    .find(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) || null;

  let address = null, codePostal = null, city = null;
  const addr = business?.address;
  if (addr && typeof addr === 'object' && addr.streetAddress && /^\d{5}$/.test(String(addr.postalCode || ''))) {
    codePostal = String(addr.postalCode);
    city = clean(addr.addressLocality).replace(/\bVoir le plan\b.*/i,'').slice(0,120) || null;
    address = clean(addr.streetAddress + ' ' + codePostal + ' ' + (city || '')).slice(0,320);
  }
  if (!address) {
    const line = [...root().querySelectorAll('address, [class*="adresse"], [class*="address"]')]
      .map(e => clean(e.innerText || e.textContent))
      .find(v => /\b\d{5}\b/.test(v) && v.length < 250);
    if (line) {
      address = line.replace(/\s*Voir (?:le plan|l'itinéraire).*$/i,'').slice(0,320);
      codePostal = address.match(/\b\d{5}\b/)?.[0] || null;
      city = codePostal ? clean(address.split(codePostal)[1]).replace(/\s*Voir.*$/i,'').slice(0,120) || null : null;
    }
  }
  // Détecte un vrai numéro placé après son libellé INSEE, jamais un nombre trouvé au hasard.
  const legalText = inseeText + '\n' + presentationText;
  const identifier = (label, length) => {
    const r = new RegExp('\\b(?:num[eé]ro\\s+(?:de\\s+)?|n[°º]\\s*)?' + label +
      '\\b\\s*[:\\-]?\\s*((?:\\d[ .\\u00a0-]?){' + length + '})','gi');
    for (const match of legalText.matchAll(r)) {
      const digits = match[1].replace(/\D/g,'');
      if (digits.length === length) return digits;
    }
    return null;
  };
  const siret = identifier('SIRET',14);
  const siren = identifier('SIREN',9) || siret?.slice(0,9) || null;
  const legalLines = legalText.split('\n').map(clean).filter(v =>
    /^(?:SIRET|SIREN|Code APE|NAF|Forme juridique|Date de création|Capital social)\b/i.test(v) && v.length < 180);
  const legal = [...new Set(legalLines)].slice(0,7).join('\n').slice(0,1000) || null;

  // Horaires: seulement les sept jours + plages horaires identifiables.
  const days = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
  const opening = [];
  const hoursScope = hoursText.slice(Math.max(0, hoursText.search(/informations pratiques|horaires d'ouverture|^horaires$/im)));
  for (const day of days) {
    const found = [...hoursScope.matchAll(new RegExp('\\b' + day + '\\b','gi'))];
    let record = null;
    for (const match of found) {
      const after = hoursScope.slice(match.index + day.length, match.index + day.length + 95);
      const nextDay = after.search(/\b(?:Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche)\b/i);
      const short = nextDay >= 0 ? after.slice(0,nextDay) : after;
      const ranges = [...short.matchAll(/(\d{1,2})\s*(?:h|:)\s*(\d{2})\s*(?:-|–|à|au)\s*(\d{1,2})\s*(?:h|:)\s*(\d{2})/gi)]
        .slice(0,2).map(m => m[1].padStart(2,'0') + 'h' + m[2] + '–' + m[3].padStart(2,'0') + 'h' + m[4]);
      if (ranges.length) {record = day + ' : ' + ranges.join(' / '); break;}
      if (/^\s*:?\s*ferm[eé]\b/i.test(short)) {record = day + ' : Fermé'; break;}
    }
    if (record) opening.push(record);
  }
  const openingHours = opening.length ? opening.join('\n') : null;

  // Présentation: un paragraphe identifié, pas les onglets, publicités ni la liste d'avis.
  let description = null;
  const paragraphs = presentationParagraphs
    .filter(t => t.length >= 35 && t.length <= 650 &&
      !/professionnels, appelez|pagesjaunes vous aide|avis négatifs|horaires|^ce(tte)? entreprise/i.test(t));
  if (paragraphs.length) description = paragraphs[0].slice(0,600);
  const services = presentationServices
    .filter(v => v && v.length < 90).slice(0,15).join(' · ').slice(0,1000) || null;

  const ratingSource = [clean(reviewsText).slice(0,1600), clean(presentationText).slice(0,1200)].join(' ');
  const visibleRating = ratingSource.match(/\b([0-5](?:[,.]\d)?)\s*(?:★|⭐){3,5}\s*\(?\s*(\d{1,6})\s*avis\b/i)
    || ratingSource.match(/\b([0-5](?:[,.]\d)?)\s*(?:sur\s*5|\/\s*5)\s*\(?\s*(\d{1,6})\s*avis\b/i);
  const numericRating = Number(String(business?.aggregateRating?.ratingValue || visibleRating?.[1] || '').replace(',','.'));
  const rating = Number.isFinite(numericRating) && numericRating > 0 && numericRating <= 5 ? numericRating : null;
  const jsonCount = Number(business?.aggregateRating?.reviewCount || business?.aggregateRating?.ratingCount);
  const visibleCount = Number(visibleRating?.[2]);
  const reviewCount = Number.isInteger(jsonCount) && jsonCount > 0 ? jsonCount
    : Number.isInteger(visibleCount) && visibleCount > 0 ? visibleCount : null;

  return {
    sourceUrl: location.href, name, address, codePostal, city, phone, email, website, siren, siret,
    description, openingHours, services, legal, socials, rating, reviewCount, reviews,
    capturedAt: new Date().toISOString(),
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

const CAPTURE_SOURCES = ['google_maps','google_search','bing','linkedin','societe_com','facebook','instagram','tiktok'];
const QUEUE_KEY = 'growthos_verified_captures_v1';
const DRAFTS_KEY = 'growthos_unverified_drafts_v1';
const ENRICH_CURSOR_KEY = 'growthos_enrich_cursor_v1';
const MAP_BATCH_KEY = 'growthos_maps_batch_v1';
const MAP_SEEN_KEY = 'growthos_maps_seen_v1';
const AGE_LIMIT = 24 * 60 * 60 * 1000;
function hostMatches(source,url) {
  try {
    const u = new URL(url);
    if(u.protocol!=='https:')return false;
    if(source==='pagesjaunes')return ['pagesjaunes.fr','www.pagesjaunes.fr'].includes(u.hostname);
    if(source==='google_maps')return ['google.com','www.google.com','maps.google.com','google.fr','www.google.fr'].includes(u.hostname) && u.pathname.startsWith('/maps');
    if(source==='google_search')return ['google.com','www.google.com','google.fr','www.google.fr'].includes(u.hostname);
    if(source==='bing')return ['www.bing.com','bing.com'].includes(u.hostname);
    if(source==='societe_com')return ['societe.com','www.societe.com'].includes(u.hostname) && /^\/societe\/[a-z0-9-]+-\d{9}\.html\/?$/i.test(u.pathname);
    if(source==='facebook')return ['facebook.com','www.facebook.com'].includes(u.hostname) && /^\/[a-z0-9.\-]+\/?$/i.test(u.pathname) && !/^\/(?:home.php|profile.php|groups|events|watch|marketplace|login|share|search|reel|stories|gaming|people|pages)\/?$/i.test(u.pathname);
    if(source==='tiktok')return ['tiktok.com','www.tiktok.com'].includes(u.hostname) && /^\/@[a-z0-9_](?:[a-z0-9_.]{0,22}[a-z0-9_])?\/?$/i.test(u.pathname);
    if(source==='instagram')return ['instagram.com','www.instagram.com'].includes(u.hostname) && /^\/[a-z0-9._]+\/?$/i.test(u.pathname) && !/^\/(?:p|reels?|stories|accounts|explore|direct|about|developer|legal)\/?$/i.test(u.pathname);
    if(source==='linkedin')return ['www.linkedin.com','linkedin.com'].includes(u.hostname) && /^\/company\/[a-z0-9_-]+\/?/i.test(u.pathname);
  }catch{}
  return false;
}
async function readQueue(){
  const saved = (await chrome.storage.local.get(QUEUE_KEY))[QUEUE_KEY];
  const queue = Array.isArray(saved) ? saved : [];
  return queue.filter(item=>item && CAPTURE_SOURCES.includes(item.source)
    && typeof item.capturedAt==='number' && Date.now()-item.capturedAt>=0 && Date.now()-item.capturedAt<AGE_LIMIT);
}
async function storeQueue(queue){await chrome.storage.local.set({[QUEUE_KEY]:queue});}
async function readDrafts(){
  const saved=(await chrome.storage.local.get(DRAFTS_KEY))[DRAFTS_KEY];
  return (Array.isArray(saved)?saved:[]).filter(item=>
    item && ['google_maps','google_search','bing'].includes(item.source) &&
    typeof item.capturedAt==='number' && Date.now()-item.capturedAt>=0 &&
    Date.now()-item.capturedAt<AGE_LIMIT);
}
async function storeDrafts(items){await chrome.storage.local.set({[DRAFTS_KEY]:items});}
function sameCaptureIdentity(a,b){
  if(a.source!==b.source || normalizeBusiness(a.company)!==normalizeBusiness(b.company))return false;
  const ap=String(a.phone||'').replace(/\D/g,''),bp=String(b.phone||'').replace(/\D/g,'');
  if(ap.length>=9 && bp.length>=9 && ap===bp)return true;
  if(a.address && b.address && normalizeStreet(a.address).length>=9 &&
    normalizeStreet(a.address)===normalizeStreet(b.address))return true;
  try{
    const left=new URL(a.sourceUrl),right=new URL(b.sourceUrl);
    return left.pathname.startsWith('/maps/place/')&&left.pathname===right.pathname;
  }catch{return false;}
}
let storageWrites=Promise.resolve();
function withStorageWrite(operation){
  const next=storageWrites.then(operation);
  storageWrites=next.catch(()=>{});
  return next;
}
function addDrafts(rawDrafts,verified=[]){
  return withStorageWrite(()=>storeNewDrafts(rawDrafts,verified));
}
async function storeNewDrafts(rawDrafts, verified=[]){
  const queue=await readQueue();
  const drafts=(await readDrafts()).filter(d=>![...queue,...verified].some(v=>sameCaptureIdentity(d,v)));
  let draftAdded=0,draftIgnored=0;
  for(const raw of rawDrafts){
    const source=String(raw?.source||'');
    const company=String(raw?.company||'').trim().slice(0,160);
    const sourceUrl=String(raw?.sourceUrl||'');
    if(!['google_maps','google_search','bing'].includes(source) || company.length<2 ||
      !hostMatches(source,sourceUrl))continue;
    const key=[source,company.toLocaleLowerCase('fr'),sourceUrl].join('|');
    const existing=drafts.some(d=>[d.source,d.company.toLocaleLowerCase('fr'),d.sourceUrl].join('|')===key)
      || [...queue,...verified].some(v=>sameCaptureIdentity(v,raw));
    if(existing){draftIgnored++;continue;}
    const safeWebsite=(()=>{try{const u=new URL(String(raw.website||''));return /^https?:$/.test(u.protocol)?u.href.slice(0,500):null;}catch{return null;}})();
    drafts.push({id:'draft_'+crypto.randomUUID().replace(/-/g,'').slice(0,32),source,company,
      address:String(raw.address||'').trim().slice(0,320)||null,
      city:String(raw.city||'').trim().slice(0,120)||null,
      phone:String(raw.phone||'').trim().slice(0,40)||null,
      website:safeWebsite,sourceUrl,capturedAt:Date.now()});
    draftAdded++;
  }
  await storeDrafts(drafts);
  return {draftAdded,draftIgnored};
}
function validCaptured(item,manual=false,verifiedSiret=false){
  if(!item || !CAPTURE_SOURCES.includes(item.source))throw new Error('Source non prise en charge');
  const company=String(item.company||'').trim().slice(0,160);
  const address=String(item.address||'').trim().slice(0,320);
  const codePostal=String(item.codePostal||'').trim();
  if(company.length<2 || address.length<7 || !/^\d{5}$/.test(codePostal)
    || !address.includes(codePostal))throw new Error('Nom, adresse complète et code postal obligatoires');
  const sourceUrl=String(item.sourceUrl||'').trim();
  if(!hostMatches(item.source,sourceUrl))throw new Error('Lien de source invalide pour '+item.source);
  const inputSiret = manual && item.source==='societe_com' ? String(item.siret || '').trim() : '';
  if (inputSiret && (!/^\d{14}$/.test(inputSiret) || !new URL(sourceUrl).pathname.replace(/\/$/,'').endsWith('-'+inputSiret.slice(0,9)+'.html')))
    throw new Error('Le SIRET doit correspondre au SIREN de la fiche Societe.com.');
  const cleanUrl=raw=>{try{const url=new URL(String(raw||''));return /^https?:$/.test(url.protocol)?url.href.slice(0,500):null;}catch{return null;}};
  const phone=String(item.phone||'').trim().slice(0,40)||null;
  const city=String(item.city||'').trim().slice(0,120)||null;
  return {id:'local_'+crypto.randomUUID().replace(/-/g,'').slice(0,32),source:item.source,
    company,address,codePostal,city,phone,website:cleanUrl(item.website),sourceUrl,
    ...(item.source==='societe_com' && item.email ? {email:String(item.email).trim().slice(0,254)} : {}),
    siret:inputSiret || (verifiedSiret && /^\d{14}$/.test(String(item.siret||'')) ? item.siret : null),
    ...(verifiedSiret && item.apeCode ? {apeCode:item.apeCode,nafLabel:item.nafLabel||null,nafVersion:item.nafVersion||null,...(item.apeScope ? {apeScope:item.apeScope} : {})} : {}),
    ...(item.source==='societe_com' && item.companyDetails ? {companyDetails:item.companyDetails} : {}),
    collectionMode:manual?'manual':'visible',capturedAt:Date.now()};
}
function addToQueue(items,manual=false,verifiedSiret=false){
  return withStorageWrite(()=>storeNewCaptures(items,manual,verifiedSiret));
}
async function storeNewCaptures(items, manual, verifiedSiret){
  const queue=await readQueue();let added=0,ignored=0;
  for(const raw of items){
    const item=validCaptured(raw,manual,verifiedSiret);
    const key=[item.source,item.company,item.address,item.codePostal].join('|').toLocaleLowerCase('fr');
    const existing=queue.find(q=>[q.source,q.company,q.address,q.codePostal].join('|').toLocaleLowerCase('fr')===key);
    if(existing){
      if(item.companyDetails){existing.companyDetails=item.companyDetails;existing.capturedAt=item.capturedAt;}
      for(const field of ['phone','email','website','city','siret','apeCode','nafLabel','nafVersion','apeScope']){
        if(item[field] && !existing[field] && (!existing.siret || !item.siret || existing.siret===item.siret))
          existing[field]=item[field];
      }
      ignored++;continue;
    }
    queue.push(item);added++;
  }
  await storeQueue(queue);
  await storeDrafts((await readDrafts()).filter(draft=>!queue.some(item=>sameCaptureIdentity(draft,item))));
  return {ok:true,added,ignored,results:queue,warnings:[]};
}

// Enrichissement conservateur : répertoire national des entreprises ou
// Géoplateforme/BAN pour une rue ET un numéro déjà visibles dans la carte.
// Le code postal saisi n'est qu'un filtre, jamais une preuve à lui seul.
function normalizeBusiness(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9]/g,'');
}
function businessMatches(left,right){
  const variants=value=>[normalizeBusiness(value),
    ...[...String(value||'').matchAll(/\(([^()]+)\)/g)].map(m=>normalizeBusiness(m[1]))];
  const first=new Set(variants(left).filter(v=>v.length>=7));
  return variants(right).some(v=>v.length>=7&&first.has(v));
}
function normalizeStreet(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/\b(?:av|ave)\.?\b/g,'avenue')
    .replace(/\bbd\.?\b/g,'boulevard').replace(/\br\.?\b/g,'rue')
    .replace(/[^a-z0-9]/g,'');
}
function visibleStreetNumber(value){
  const text=String(value||'').replace(/\s+/g,' ').trim();
  const match=text.match(/\b(\d{1,4})(?:\s*(?:bis|ter))?\s+(?:rue|r\.?|avenue|av\.?|boulevard|bd\.?|place|route|rte\.?|chemin|all[eé]e|impasse|quai|square)\s+[^,;·•]{3,90}/i);
  return match?match[0].replace(/\s+\d{5}\b.*$/,'').trim():null;
}
async function fetchOfficialJson(url,timeoutMs=4500){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(url.href,{headers:{Accept:'application/json'},signal:controller.signal});
    if(!response.ok)throw new Error('HTTP '+response.status);
    return await response.json();
  }finally{clearTimeout(timer);}
}
async function geocodeVisibleStreet(draft,postal){
  const partial=visibleStreetNumber(draft.address);
  if(!partial)return null;
  const url=new URL('https://data.geopf.fr/geocodage/search');
  url.searchParams.set('q',[partial,draft.city||''].filter(Boolean).join(' '));
  url.searchParams.set('postcode',postal);
  url.searchParams.set('type','housenumber');
  url.searchParams.set('limit','5');
  const response=await fetchOfficialJson(url);
  if(!Array.isArray(response.features))throw new Error('Format du géocodeur incorrect');
  const exact=[];
  for(const feature of response.features){
    const item=feature?.properties||{};
    if(item.type!=='housenumber'||String(item.postcode||'')!==postal)continue;
    if(Number(item.score??item._score??0)<0.85)continue;
    const verifiedStreet=[item.housenumber,item.street].filter(Boolean).join(' ');
    if(normalizeStreet(partial)!==normalizeStreet(verifiedStreet))continue;
    if(draft.city && normalizeBusiness(draft.city)!==normalizeBusiness(item.city))continue;
    const address=String(item.label||'').trim();
    const city=String(item.city||'').trim();
    if(!address.includes(postal)||!city||address.length>320)continue;
    if(!exact.some(e=>normalizeStreet(e.address)===normalizeStreet(address)))
      exact.push({address,codePostal:postal,city,siret:null});
  }
  return exact.length===1?exact[0]:null;
}
function verifiedOfficialMatch(draft,records,postal){
  const distinctive=normalizeBusiness(draft.company);
  if(distinctive.length<7 || ['plombier','restaurant','chauffagiste','electricien','depannage',
    'plomberie','serrurier','boulangerie','services','entreprise'].includes(distinctive))return null;
  const matches=[];
  for(const company of records){
    const names=[company.nom_complet,company.nom_raison_sociale,company.nom_commercial];
    const establishments=[...(Array.isArray(company.matching_etablissements)?company.matching_etablissements:[]),
      ...(company.siege?[company.siege]:[])];
    for(const site of establishments){
      if(String(site.code_postal||'')!==postal)continue;
      const tradeNames=[...names,site.enseigne,site.enseigne_1,site.denomination_usuelle].filter(Boolean);
      if(!tradeNames.some(name=>businessMatches(draft.company,name)))continue;
      const city=String(site.libelle_commune||'').trim();
      if(draft.city && city && normalizeBusiness(draft.city)!==normalizeBusiness(city))continue;
      const street=String(site.adresse||'').trim();
      // Un résultat ne contenant que « 59100 Roubaix » n'est pas une rue vérifiée.
      const streetOnly=street.replace(new RegExp('\\b'+postal+'\\b','g'),'')
        .replace(city?new RegExp(city.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'ig'):/a^/g,'').trim();
      if(streetOnly.length<6)continue;
      if(draft.address){
        const localStreet=normalizeStreet(draft.address.split(/\b\d{5}\b/)[0]);
        const officialStreet=normalizeStreet(streetOnly);
        if(localStreet.length>=8 && !officialStreet.includes(localStreet) && !localStreet.includes(officialStreet))continue;
      }
      const siret=String(site.siret||'');
      if(!/^\d{14}$/.test(siret))continue;
      const address=street.includes(postal)?street:[street,postal,city].filter(Boolean).join(' ');
      if(!address.includes(postal))continue;
      if(matches.some(m=>m.siret===siret))continue;
      const activity=site.activite_principale ? site : company;
      const code=String(activity.activite_principale||'').toUpperCase();
      const metadata=/^\d{2}\.\d{2}[A-Z]$/.test(code) ? {
        apeCode:code,nafLabel:activity.libelle_activite_principale||null,
        nafVersion:activity.nomenclature_activite_principale||null,apeScope:activity===site?'etablissement':'unite_legale',
      } : {};
      matches.push({address,codePostal:postal,city:city||null,siret,...metadata});
    }
  }
  return matches.length===1?matches[0]:null;
}
async function lookupBusiness(draft,postal){
  const query=draft.company;
  const url=new URL('https://recherche-entreprises.api.gouv.fr/search');
  url.searchParams.set('q',query);
  url.searchParams.set('code_postal',postal);
  url.searchParams.set('per_page','25');
  const body=await fetchOfficialJson(url,5000);
  if(!Array.isArray(body.results))throw new Error('Format de réponse de l’annuaire incorrect');
  // Résultats tronqués : on ne peut plus prouver l'unicité.
  const truncated=Number(body.total_results||0)>25||body.results.length>=25;
  return {truncated,match:truncated?null:verifiedOfficialMatch(draft,body.results,postal)};
}
async function enrichLocalDrafts(payload){
  const area=String(payload?.area||'').trim();
  const codes=[...new Set(area.match(/\b\d{5}\b/g)||[])];
  if(codes.length!==1)throw new Error('Pour enrichir, saisissez un code postal unique dans le champ Zone (ex. 59100 Roubaix).');
  const postal=codes[0];
  const drafts=(await readDrafts()).filter(d=>!payload?.sourceUrl || d.sourceUrl===payload.sourceUrl);
  if(!drafts.length)return {ok:true,checked:0,added:0,already:0,pending:0,skipped:0,errors:[]};
  const batch=drafts;
  const matched=[];const errors=[],details=[];let fromDirectory=0,fromGeocoder=0;
  let already=0;
  for(const draft of batch){
    const query=String(draft.company||'').trim();
    if(!query){continue;}
    let result=null,reason='';
    // Une rue et un numéro affichés dans Google sont une preuve locale plus
    // forte qu'un simple nom commercial. La BAN confirme l'adresse, pas le SIRET.
    if(visibleStreetNumber(draft.address)){
      try{
        result=await geocodeVisibleStreet(draft,postal);
        if(result)fromGeocoder++;
        else reason='Rue et numéro non confirmés de façon unique par la BAN';
      }catch(error){
        reason='Géocodeur indisponible : '+String(error?.message||error).slice(0,70);
        errors.push(query+' : '+reason);
      }
    }

    try{
      const {match,truncated}=await lookupBusiness(draft,postal);
      if(match){matched.push({...draft,...match});fromDirectory++;}
      else if(!result)details.push({company:query,reason:truncated?'Trop de résultats officiels : identité ambiguë':
        reason||(!visibleStreetNumber(draft.address)
          ? 'Google ne montre pas de rue numérotée ; aucun nom légal unique confirmé'
          : 'Nom commercial absent de l’annuaire ou plusieurs sociétés possibles')});
    }catch(error){
      errors.push(query+' : '+String(error?.message||error).slice(0,90));
      details.push({company:query,reason:reason||'Annuaire indisponible : '+String(error?.message||error).slice(0,70)});
    }
    if(result && !matched.some(item=>item.id===draft.id))matched.push({...draft,...result});
    await wait(300);
  }
  const saved=matched.length?await addToQueue(matched,false,true):{added:0,ignored:0};
  already=saved.ignored||0;
  if(saved.added||already){
    const promoted=new Set(matched.map(item=>item.id));
    await withStorageWrite(async()=>storeDrafts((await readDrafts()).filter(draft=>!promoted.has(draft.id))));
  }
  return {ok:true,checked:batch.length,added:saved.added||0,already,
    pending:batch.length-matched.length,skipped:Math.max(0,drafts.length-batch.length),
    fromDirectory,fromGeocoder,details,errors};
}
// Fonction exécutée dans l'onglet Maps : ne lit que des résultats chargés dans le navigateur.
async function readMapBusinessLinks(){
  const links=[];const seen=new Set();
  const feed=document.querySelector('[role="feed"]') || document.querySelector('div.m6QErb[aria-label]');
  let scroller=feed;
  for(let level=0;scroller&&level<5&&scroller.scrollHeight<=scroller.clientHeight+16;level++)
    scroller=scroller.parentElement;
  let idle=0;
  while(idle<4){
    const count=links.length;
    const anchors=[...document.querySelectorAll('.Nv2PK a[href*="/maps/place/"],a.hfpxzc[href*="/maps/place/"],a[href*="/maps/place/"]')];
    for(const anchor of anchors){
      if(!anchor.getClientRects().length)continue;
      try{
        const link=new URL(anchor.href,location.href);
        if(link.origin!==location.origin || !link.pathname.startsWith('/maps/place/'))continue;
        const url=location.origin+link.pathname+link.search;
        if(seen.has(link.pathname))continue;
        seen.add(link.pathname);links.push(url);
      }catch{}
    }
    if(!scroller)break;
    const before=scroller.scrollTop;
    scroller.scrollBy({top:650,behavior:'instant'});
    await new Promise(resolve=>setTimeout(resolve,500));
    idle=scroller.scrollTop===before && links.length===count ? idle+1 : 0;
  }
  return links;
}
async function captureMapBatch(payload){
  const tabs=await chrome.tabs.query({active:true,currentWindow:true});
  const tab=tabs[0];
  if(!tab?.id || !(hostMatches('google_search',tab.url)||hostMatches('google_maps',tab.url)))
    throw new Error('Ouvrez d’abord un onglet Google ou Maps, puis lancez la lecture du lot.');
  const original=new URL(tab.url);
  const query=String(payload?.query||'').trim(),area=String(payload?.area||'').trim();
  const currentList=hostMatches('google_maps',tab.url) && !original.pathname.startsWith('/maps/place/');
  if(!currentList && (query.length<3||query.length>120||area.length>100))
    throw new Error('Indiquez une activité et une zone avant la lecture automatique.');
  const searchUrl=currentList?tab.url:original.origin+'/maps/search/'+encodeURIComponent(query+' '+area);
  const searchKey=currentList ? searchUrl : normalizeBusiness(query)+'|'+normalizeBusiness(area);
  const tabId=tab.id;
  let state={status:'running',checked:0,total:0,added:0,errors:[],startedAt:Date.now()};
  const save=async()=>chrome.storage.local.set({[MAP_BATCH_KEY]:state});
  await save();
  const targets=new Set([searchUrl]);
  try{
    if(!currentList)await chrome.tabs.update(tabId,{url:searchUrl});
    await waitTab(tabId,20000);
    let links=[];
    // Google Maps peut dessiner les cartes après la fin du chargement HTML.
    for(let attempt=0;attempt<4&&!links.length;attempt++){
      await wait(1500);
      const injected=await chrome.scripting.executeScript({target:{tabId},func:readMapBusinessLinks});
      links=Array.isArray(injected?.[0]?.result)?injected[0].result:[];
    }
    if(!links.length)throw new Error('Aucun lien de fiche Maps visible : ouvrez manuellement une entreprise, puis capturez-la.');
    const savedSeen=(await chrome.storage.local.get(MAP_SEEN_KEY))[MAP_SEEN_KEY]||{};
    const done=new Set(Array.isArray(savedSeen[searchKey])?savedSeen[searchKey]:[]);
    links=links.filter(url=>!done.has(new URL(url).pathname));
    if(!links.length)throw new Error('Toutes les fiches Maps chargées ont déjà été examinées. Faites défiler les résultats ou réinitialisez le parcours Maps.');
    state={...state,total:links.length};await save();
    for(const url of links){
      const current=new URL((await chrome.tabs.get(tabId)).url);
      if(current.origin!==original.origin || !current.pathname.startsWith('/maps/'))
        throw new Error('Lecture arrêtée après un changement de page.');
      targets.add(url);
      try{
        await chrome.tabs.update(tabId,{url});
        await waitTab(tabId,20000);
        await wait(1500);
        const injected=await chrome.scripting.executeScript({target:{tabId},files:['capture.js']});
        const captured=injected?.[0]?.result;
        if(!captured||captured.error)throw new Error(captured?.error||'Fiche inaccessible');
        const identity=new URL(url).pathname;
        const isTarget=item=>{try{return new URL(item.sourceUrl).pathname===identity;}catch{return false;}};
        const verified=(captured.results||[]).filter(isTarget).filter(item=>item.source==='google_maps' &&
          item.company && item.address && item.codePostal && item.address.includes(item.codePostal));
        if(verified.length){
          const item=verified[0];
          let official=null;
          try{official=(await lookupBusiness(item,item.codePostal)).match;}
          catch{state.errors.push(item.company+' : annuaire indisponible');}
          const stored=await addToQueue([{...item,...official}],false,Boolean(official));
          state={...state,added:state.added+stored.added};
        }else{
          const partial=(captured.drafts||[]).filter(item=>item.source==='google_maps' && isTarget(item));
          if(!partial.length)throw new Error('Fiche Maps non chargée, à réessayer');
          await addDrafts(partial);
          if((area.match(/\b\d{5}\b/g)||[]).length===1){
            const result=await enrichLocalDrafts({area,sourceUrl:partial[0].sourceUrl});
            state.added+=result.added;
          }
        }
        done.add(new URL(url).pathname);
        await chrome.storage.local.set({[MAP_SEEN_KEY]:{...savedSeen,[searchKey]:[...done]}});
      }catch(error){state.errors.push(String(error?.message||error).slice(0,100));}
      state={...state,checked:state.checked+1};await save();
      await wait(400);
    }
    state={...state,status:'done'};
    await save();
    return {ok:true,...state};
  }catch(error){
    state={...state,status:'error',errors:[...state.errors,String(error?.message||error)]};
    await save();throw error;
  }finally{
    try{
      const current=await chrome.tabs.get(tabId);
      // Ne pas écraser une navigation effectuée par l'utilisateur entre-temps.
      const now=new URL(current.url||'');
      const targetPaths=new Set([...targets].map(url=>new URL(url).pathname));
      if(now.origin===original.origin&&targetPaths.has(now.pathname))
        await chrome.tabs.update(tabId,{url:tab.url});
    }catch{}
  }
}
async function popupAction(message){
  const action=message.action;
  if(action==='list-captures')return {ok:true,results:await readQueue(),warnings:[]};
  if(action==='list-drafts')return {ok:true,drafts:await readDrafts()};
  if(action==='reset-maps-progress'){
    await chrome.storage.local.set({[MAP_SEEN_KEY]:{}});return {ok:true};
  }
  if(action==='ack-import'){
    const ids=new Set((Array.isArray(message.payload?.ids)?message.payload.ids:[])
      .filter(id=>typeof id==='string'&&id.length<=64).slice(0,50));
    await withStorageWrite(async()=>{
      await storeQueue((await readQueue()).filter(item=>!ids.has(item.id)));
      await storeDrafts((await readDrafts()).filter(item=>!ids.has(item.id)));
    });
    return {ok:true};
  }
  if(action==='auto-capture-status'){
    const saved=(await chrome.storage.local.get(MAP_BATCH_KEY))[MAP_BATCH_KEY];
    if(saved?.status==='running' && !busy)
      return {ok:true,status:{...saved,status:'interrupted',errors:[...(saved.errors||[]),
        'Lecture interrompue, vous pouvez relancer le lot.']}};
    return {ok:true,status:saved||{status:'idle',checked:0,total:0,added:0,errors:[]}};
  }
  if(action==='auto-capture-maps'){
    if(busy)throw new Error('Une autre collecte est déjà en cours');
    busy=true;
    try{return await captureMapBatch(message.payload);}finally{busy=false;}
  }
  if(action==='enrich-local-drafts'){
    if(busy)throw new Error('Une autre collecte est en cours');
    busy=true;
    try{return await enrichLocalDrafts(message.payload);}finally{busy=false;}
  }
  if(action==='remove-draft'){
    const drafts=(await readDrafts()).filter(d=>d.id!==String(message.payload?.id||''));
    await storeDrafts(drafts);return {ok:true,drafts};
  }
  if(action==='remove-capture'){
    const id=String(message.payload?.id||'');
    const queue=(await readQueue()).filter(q=>q.id!==id);
    await storeQueue(queue);return {ok:true,results:queue};
  }
  if(action==='clear-captures'){
    await Promise.all([storeQueue([]),storeDrafts([]),chrome.storage.local.set({[ENRICH_CURSOR_KEY]:0})]);
    return {ok:true,results:[],drafts:[]};
  }
  if(action==='manual-add'){
    const saved=await addToQueue([message.payload],true);
    const draftId=String(message.payload?.draftId||'');
    if(draftId && (saved.added||saved.ignored)){
      await storeDrafts((await readDrafts()).filter(d=>d.id!==draftId));
    }
    return saved;
  }
  if(action==='open-source'){
    const {source,query,area}=message.payload||{};
    if(!CAPTURE_SOURCES.includes(source) && source!=='pagesjaunes')throw new Error('Source inconnue');
    const activity=String(query||'').trim(),location=String(area||'').trim();
    if(activity.length<3 || activity.length>120 || location.length>100)throw new Error('Saisissez une activité (3 caractères minimum).');
    let url;
    if(source==='google_maps')url='https://www.google.com/maps/search/'+encodeURIComponent([activity,location].filter(Boolean).join(' '));
    else if(source==='google_search')url='https://www.google.com/search?q='+encodeURIComponent([activity,location].filter(Boolean).join(' '));
    else if(source==='bing')url='https://www.bing.com/search?q='+encodeURIComponent([activity,location].filter(Boolean).join(' '));
    else if(source==='societe_com')url='https://www.societe.com/cgi-bin/search?champs='+encodeURIComponent(activity);
    else if(source==='facebook')url='https://www.facebook.com/search/pages/?q='+encodeURIComponent([activity,location].filter(Boolean).join(' '));
    else if(source==='tiktok')url='https://www.tiktok.com/search/user?q='+encodeURIComponent([activity,location].filter(Boolean).join(' '));
    else if(source==='instagram')url='https://www.instagram.com/explore/search/keyword/?q='+encodeURIComponent(activity);
    else if(source==='linkedin')url='https://www.linkedin.com/search/results/companies/?keywords='+encodeURIComponent(activity);
    else url='https://www.pagesjaunes.fr/annuaire/chercherlespros?quoiqui='+encodeURIComponent(activity)+'&ou='+encodeURIComponent(location);
    await chrome.tabs.create({url,active:true});return {ok:true,url};
  }
  if(action==='capture-tab'){
    const tabs=await chrome.tabs.query({active:true,currentWindow:true});
    const tab=tabs[0];
    if(tab?.id && tab.url && hostMatches('societe_com',tab.url)){
      const injected=await chrome.scripting.executeScript({target:{tabId:tab.id},files:['societe.js']});
      const result=injected?.[0]?.result;
      if(!result?.results?.length || result.error)throw new Error(result?.error||'Fiche Societe.com illisible');
      return addToQueue(result.results,false,true);
    }
    if(!tab?.id || !tab.url || !['google_maps','google_search','bing'].some(s=>hostMatches(s,tab.url)))
      throw new Error('Ouvrez un résultat Google Maps, Google Search ou Bing puis recliquez sur l’extension.');
    const url=new URL(tab.url);
    if(hostMatches('google_maps',tab.url) && !url.pathname.startsWith('/maps/place/')){
      return popupAction({action:'auto-capture-maps',payload:message.payload});
    }
    const injected=await chrome.scripting.executeScript({target:{tabId:tab.id},files:['capture.js']});
    const result=injected?.[0]?.result;
    if(!result || result.error)throw new Error(result?.error||'Page illisible');
    const stored=result.results?.length ? await addToQueue(result.results)
      : {ok:true,results:await readQueue(),added:0,ignored:0};
    const drafts=await addDrafts(result.drafts||[],stored.results||[]);
    const query=url.searchParams.get('q') || message.payload?.query;
    const area=String(message.payload?.area||'');
    const canEnrich=result.drafts?.length && (area.match(/\b\d{5}\b/g)||[]).length===1;
    const enrichment=canEnrich ? await enrichLocalDrafts({area,sourceUrl:tab.url}) : {added:0};
    if(message.payload && result.source==='google_search' && result.drafts?.length && query?.length>=3){
      const run=await popupAction({action:'auto-capture-maps',payload:{query,area:message.payload?.area}});
      return {...run,added:stored.added+enrichment.added+run.added,draftAdded:drafts.draftAdded};
    }
    return {...stored,...drafts,added:stored.added+enrichment.added,warning:result.warning};
  }
  throw new Error('Action non autorisée');
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  let origin;
  try { origin = new URL(sender.url || '').origin; } catch {}
  const fromPopup=typeof sender.url==='string' && sender.url.startsWith(chrome.runtime.getURL(''));
  if(fromPopup){
    popupAction(message).then(reply).catch(err=>reply({ok:false,error:String(err?.message||err)}));
    return true;
  }
  if (origin !== 'https://agile.le-publicitaire.fr') {
    reply({ok:false,error:'Origine non autorisée'}); return false;
  }
  if (message?.action === 'ping') {
    Promise.all([readQueue(),readDrafts()]).then(([results,drafts])=>reply({ok:true,
      results,drafts,version:chrome.runtime.getManifest?.().version||'inconnue',
      extensionId:chrome.runtime.id||'inconnue',warnings:[]}))
      .catch(error=>reply({ok:false,error:String(error?.message||error)}));
    return true;
  }
  if(message?.action==='get-captures'){
    readQueue().then(results=>reply({ok:true,results,warnings:[]}))
      .catch(error=>reply({ok:false,error:String(error?.message||error)}));
    return true;
  }
  if(message?.action==='get-drafts'){
    readDrafts().then(drafts=>reply({ok:true,drafts,warnings:[]}))
      .catch(error=>reply({ok:false,error:String(error?.message||error)}));
    return true;
  }
  if(message?.action==='ack-import'){
    popupAction(message).then(reply).catch(error=>reply({ok:false,error:String(error?.message||error)}));
    return true;
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
