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
    const address = (addressNode?.innerText || addressNode?.textContent || '').replace(/\s+/g, ' ').trim();
    const codePostal = address.match(/\b\d{5}\b/)?.[0] || '';
    if (!name || !address || !codePostal || name.length > 160 || address.length > 320) continue;
    const city = address.split(codePostal)[1]?.trim().replace(/[,;].*$/, '').slice(0, 120) || null;
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
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  let origin;
  try { origin = new URL(sender.url || '').origin; } catch {}
  if (origin !== 'https://agile.le-publicitaire.fr') {
    reply({ok:false,error:'Origine non autorisée'}); return false;
  }
  if (message?.action === 'ping') {
    reply({ok:true,results:[],warnings:[]}); return false;
  }
  if (message?.action !== 'search') {
    reply({ok:false,error:'Action inconnue'}); return false;
  }
  if (busy) {
    reply({ok:false,error:'Une recherche locale est déjà en cours'}); return false;
  }
  busy = true;
  scrape(message.payload)
    .then(reply)
    .catch(error=>reply({ok:false,error:String(error?.message || error)}))
    .finally(()=>{busy=false;});
  return true;
});
