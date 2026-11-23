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
