/* Exécuté uniquement après un clic explicite sur « Capturer cet onglet ».
   Lecture du DOM affiché, aucune navigation, aucun scroll ni clic automatique.
   LinkedIn n'est volontairement pas lu : saisie manuelle uniquement. */
(() => {
  const host = location.hostname.toLowerCase();
  const source = /(^|\.)bing\.com$/.test(host) ? 'bing'
    : /(^|\.)google\.(com|fr)$/.test(host) ? (/^\/maps(?:\/|$)/.test(location.pathname) ? 'google_maps' : 'google_search')
    : null;
  if (!source) return { error: 'Ouvrez Google Maps, Google Search ou Bing pour utiliser la capture.' };
  const clean = value => String(value || '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();
  const visible = node => !!(node && node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
  const safeUrl = value => {
    try { const u = new URL(value, location.href); return /^https?:$/.test(u.protocol) ? u.href.slice(0, 500) : null; }
    catch { return null; }
  };
  const candidates = [];
  const read = (node, preferredName, preferredAddress, preferredWebsite, preferredPhone, preferredUrl) => {
    if (!node || !visible(node)) return;
    const lines = (node.innerText || '').split(/\n+/).map(clean).filter(Boolean).slice(0, 80);
    const name = clean(preferredName || node.querySelector('h1,h2,h3,[role="heading"],.fontHeadlineSmall')?.innerText).slice(0, 160);
    if (name.length < 2 || /^(?:résultats|images|avis|horaires|voir plus|web|publicité)$/i.test(name)) return;
    const labelled = [...node.querySelectorAll('[aria-label]')].filter(visible)
      .map(el => clean(el.getAttribute('aria-label'))).find(v => /^(?:adresse|address)\s*:/i.test(v) && /\b\d{5}\b/.test(v));
    const address = clean(preferredAddress || (labelled && labelled.replace(/^(?:adresse|address)\s*:\s*/i,''))
      || lines.find(line => /\b\d{5}\b/.test(line) && /\b(?:rue|avenue|av\.?|boulevard|bd\.?|place|route|chemin|all[eé]e|impasse|quai|square)\b/i.test(line))).slice(0, 320);
    const codePostal = address.match(/\b\d{5}\b/)?.[0];
    // Les résultats génériques ne sont jamais transformés en fiche CRM sans vraie adresse.
    if (!codePostal || address.length < 7) return;
    const city = clean(address.split(codePostal)[1] || '').replace(/\s*(?:Voir|Itinéraire|Directions).*$/i,'').slice(0,120) || null;
    const phoneRaw = clean(preferredPhone || node.querySelector('a[href^="tel:"]')?.getAttribute('href')?.slice(4)
      || lines.find(line => /^(?:t[eé]l[eé]phone|phone)\s*:/i.test(line))?.replace(/^[^:]+:\s*/,''));
    const phone = /^(?:\+33|0)[\d\s.()-]{8,20}$/.test(phoneRaw) ? phoneRaw.slice(0,40) : null;
    const websiteLink = [...node.querySelectorAll('a[href]')].find(a => visible(a)
      && /^(?:site web|website|site internet)$/i.test(clean(a.innerText || a.getAttribute('aria-label'))));
    const websiteCandidate = safeUrl(preferredWebsite || websiteLink?.href);
    const external = websiteCandidate && !/(^|\.)(?:google\.(?:com|fr)|bing\.com)$/.test(new URL(websiteCandidate).hostname)
      ? websiteCandidate : null;
    const sourceUrl = safeUrl(preferredUrl || location.href);
    const item = {source, company:name, address,codePostal,city,phone,website:external,sourceUrl,siret:null};
    const key = [name,address].map(s=>s.toLocaleLowerCase('fr')).join('|');
    if (!candidates.some(c => [c.company,c.address].map(s=>s.toLocaleLowerCase('fr')).join('|')===key)) candidates.push(item);
  };
  // JSON-LD quand la page publie explicitement un établissement local (pas de données devinées).
  for (const script of [...document.querySelectorAll('script[type="application/ld+json"]')].slice(0,25)) {
    try {
      const walk = (obj,depth=0) => {
        if(!obj || typeof obj!=='object' || depth>4)return;
        if(Array.isArray(obj))return obj.forEach(v=>walk(v,depth+1));
        if([].concat(obj['@type']||[]).some(t=>/LocalBusiness|Restaurant|Store|Organization|ProfessionalService/i.test(String(t)))) {
          const a=obj.address;
          if(a && /^\d{5}$/.test(String(a.postalCode||'')))read(document.body,obj.name,
            [a.streetAddress,a.postalCode,a.addressLocality].map(clean).filter(Boolean).join(' '),obj.url,obj.telephone,location.href);
        }
        if(obj['@graph'])walk(obj['@graph'],depth+1);
      };
      walk(JSON.parse(script.textContent||''));
    }catch{}
  }
  const selectors = source==='google_maps'
    ? ['[role="article"]','.Nv2PK','[data-item-id="address"]','div[role="main"]']
    : source==='google_search' ? ['#rhs','.kp-wholepage','[data-attrid*="address"]']
    : ['#b_context','.b_entityTP','.b_ans'];
  const nodes = [...new Set(selectors.flatMap(selector=>[...document.querySelectorAll(selector)]))].filter(visible).slice(0,80);
  for (const node of nodes) {
    const panel = node.closest('[role="article"],.kp-wholepage,.b_entityTP') || node;
    let sourceLink = null;
    if(source==='google_maps'){
      const anchor=panel.querySelector('a[href*="/maps/place/"]');
      sourceLink=safeUrl(anchor?.href)||location.href;
    }
    read(panel,null,null,null,null,sourceLink);
    if(candidates.length>=25)break;
  }
  return {source,results:candidates.slice(0,25),scanned:nodes.length,
    warning:candidates.length ? null : 'Aucune fiche avec nom et adresse postale complète sur cette page. Ouvrez une fiche d’établissement ou utilisez la saisie manuelle.'};
})();
