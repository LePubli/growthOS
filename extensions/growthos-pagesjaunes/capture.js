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
  const candidates = [], drafts = [];
  const streetFromLine = value => {
    const line = clean(value).replace(/^.*?[·•]\s*/, '');
    const match = line.match(/\b\d{1,4}\s*(?:bis|ter)?\s*(?:rue|r\.|avenue|av\.|boulevard|bd\.|place|route|rte\.|chemin|all[eé]e|impasse|quai|square)\s+[^·•\n]{3,95}/i);
    return match ? clean(match[0]).replace(/\s*(?:·|\|).*$/, '').slice(0, 150) : '';
  };
  const read = (node, preferredName, preferredAddress, preferredWebsite, preferredPhone, preferredUrl, allowDraft = false) => {
    if (!node || !visible(node)) return;
    const lines = (node.innerText || '').split(/\n+/).map(clean).filter(Boolean).slice(0, 80);
    // Les résultats locaux Google exposent souvent un nom dans .OSrXXb ou .dbg0pd,
    // sans h3 ni adresse : le capturer en brouillon plutôt que le jeter.
    const name = clean(preferredName || node.querySelector('.OSrXXb,.dbg0pd,.fontHeadlineSmall,h1,h2,h3,[role="heading"]')?.innerText
      || lines[0]).slice(0, 160);
    if (name.length < 2 || !/[a-zÀ-ÿ]{3}/i.test(name) || /^(?:résultats|images|avis|horaires|voir plus|web|publicité|site web|itinéraire)$/i.test(name)) return;
    const labelled = [...node.querySelectorAll('[aria-label]')].filter(visible)
      .map(el => clean(el.getAttribute('aria-label'))).find(v => /^(?:adresse|address)\s*:/i.test(v) && /\b\d{5}\b/.test(v));
    const address = clean(preferredAddress || (labelled && labelled.replace(/^(?:adresse|address)\s*:\s*/i,''))
      || lines.find(line => /\b\d{5}\b/.test(line) && /\b(?:rue|avenue|av\.?|boulevard|bd\.?|place|route|chemin|all[eé]e|impasse|quai|square)\b/i.test(line))
      || (allowDraft && lines.map(streetFromLine).find(Boolean))).slice(0, 320);
    const codePostal = address.match(/\b\d{5}\b/)?.[0];
    const city = codePostal
      ? clean(address.split(codePostal)[1] || '').replace(/\s*(?:Voir|Itinéraire|Directions).*$/i,'').slice(0,120) || null
      : clean(lines.find(line => /(?:^|[·•])\s*[A-ZÀ-ÿ][a-zà-ÿ-]{2,}(?:[- ][A-ZÀ-ÿ][a-zà-ÿ-]{2,})?\s*$/.test(line))?.split(/[·•]/).pop()).slice(0,120) || null;
    const phoneRaw = clean(preferredPhone || node.querySelector('a[href^="tel:"]')?.getAttribute('href')?.slice(4)
      || lines.find(line => /^(?:t[eé]l[eé]phone|phone)\s*:/i.test(line))?.replace(/^[^:]+:\s*/,''));
    const phoneMatch = (phoneRaw || lines.join(' ')).match(/(?:\+33\s?(?:\(0\))?\s?|0)[1-9](?:[ .-]?\d{2}){4}\b/);
    const phone = phoneMatch?.[0]?.slice(0,40) || null;
    const websiteLink = [...node.querySelectorAll('a[href]')].find(a => visible(a)
      && /^(?:site web|website|site internet)$/i.test(clean(a.innerText || a.getAttribute('aria-label'))));
    const websiteCandidate = safeUrl(preferredWebsite || websiteLink?.href);
    const external = websiteCandidate && !/(^|\.)(?:google\.(?:com|fr)|bing\.com)$/.test(new URL(websiteCandidate).hostname)
      ? websiteCandidate : null;
    const sourceUrl = safeUrl(preferredUrl || location.href);
    const item = {source, company:name, address,codePostal:codePostal||null,city,phone,website:external,sourceUrl,siret:null};
    const key = [name,address].map(s=>s.toLocaleLowerCase('fr')).join('|');
    // Jamais d'import CRM sans adresse + CP réels affichés sur la fiche.
    if (codePostal && address.length >= 7) {
      if (!candidates.some(c => [c.company,c.address].map(s=>s.toLocaleLowerCase('fr')).join('|')===key)) candidates.push(item);
    } else if (allowDraft && (phone || city || /(?:itin[eé]raire|directions|site web)/i.test(lines.join(' ')))) {
      if (!drafts.some(c => c.company.toLocaleLowerCase('fr') === name.toLocaleLowerCase('fr'))) {
        drafts.push({...item,address:address||null,codePostal:null});
      }
    }
  };
  // Google Maps : la liste montre fréquemment seulement « 35 Av. Jean Lebas ».
  // Une fiche d'établissement OUVERTE expose un bouton « Adresse » contenant
  // souvent la rue, le code postal et la ville. Lecture du panneau actif seul.
  if(source==='google_maps'){
    const main=document.querySelector('[role="main"]');
    const placeTitle=main?.querySelector('h1');
    const addressControls=main ? [...main.querySelectorAll('[data-item-id="address"],button[aria-label]')]
      .filter(visible).filter(el => el.matches?.('[data-item-id="address"]') ||
        /^(?:adresse|address)\s*:/i.test(clean(el.getAttribute('aria-label')))) : [];
    const addressValue=addressControls.map(el=>{
      const label=clean(el.getAttribute('aria-label'));
      return /^(?:adresse|address)\s*:/i.test(label)
        ? clean(label.replace(/^(?:adresse|address)\s*:\s*/i,''))
        : clean(el.innerText||el.textContent);
    }).find(value=>/\b\d{5}\b/.test(value));
    // Sur une liste de recherche, ne pas mélanger le titre d'une carte avec
    // l'adresse d'une autre. Le panneau de fiche doit être identifiable.
    const isDetail=/^\/maps\/place\//.test(location.pathname) ||
      (placeTitle?.matches?.('h1.DUwDvf') === true);
    if(isDetail && placeTitle && visible(placeTitle) && addressValue){
      const placeLink=main.querySelector('a[href*="/maps/place/"]');
      const phoneNode=main.querySelector('button[data-item-id^="phone"],a[href^="tel:"]');
      const phoneLabel=clean(phoneNode?.getAttribute('aria-label')||phoneNode?.innerText);
      const websiteNode=main.querySelector('a[data-item-id="authority"],a[aria-label^="Site web"]');
      read(main,placeTitle.innerText,addressValue,websiteNode?.href||null,
        phoneLabel,safeUrl(placeLink?.href)||location.href);
    }
  }
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
    ? ['[role="article"]','.Nv2PK']
    : source==='google_search' ? ['#rhs','.kp-wholepage','[data-attrid*="address"]',
      '.VkpGBb','.rllt__details','[data-cid]','.cXedhc']
    : ['#b_context','.b_entityTP','.b_ans','.b_vList li'];
  const nodes = [...new Set(selectors.flatMap(selector=>[...document.querySelectorAll(selector)]))].filter(visible).slice(0,80);
  for (const node of nodes) {
    const panel = node.closest('[role="article"],.kp-wholepage,.b_entityTP') || node;
    let sourceLink = null;
    if(source==='google_maps'){
      const anchor=panel.querySelector('a[href*="/maps/place/"]');
      sourceLink=safeUrl(anchor?.href)||location.href;
    }
    // #rhs et #b_context sont des conteneurs : ne conserver un brouillon
    // que si le bloc ressemble à une fiche locale, pas à un résultat web générique.
    const text=(panel.innerText||'').slice(0,1300);
    const localCard = source==='google_maps' || /(?:itin[eé]raire|directions|site web)/i.test(text);
    read(panel,null,null,null,null,sourceLink,localCard && text.length<1300);
    if(candidates.length+drafts.length>=50)break;
  }
  // Sur les SERP Google, chaque résultat local porte un bouton « Itinéraire ».
  // Rechercher son petit conteneur parent capte les cartes quand Google renomme
  // ses classes CSS. Pas de défilement ni de clic automatique.
  if(source==='google_search' && candidates.length+drafts.length<25){
    const root=document.querySelector('#search')||document.body;
    const controls=[...root.querySelectorAll('a,button,[role="button"]')].filter(visible)
      .filter(el=>/^(?:itin[eé]raire|directions)\b/i.test(clean(el.innerText||el.textContent).slice(0,40))).slice(0,30);
    for(const control of controls){
      let parent=control.parentElement;
      for(let depth=0;parent && depth<7;depth++,parent=parent.parentElement){
        const text=clean(parent.innerText||'');
        if(text.length<70)continue;
        if(text.length>1000)break;
        if((text.match(/itin[eé]raire/gi)||[]).length>1)break;
        if(!/(?:\b(?:plombier|[a-zà-ÿ]+erie|restaurant|entreprise|[a-zà-ÿ]+eur)\b|(?:\+33|0)[1-9](?:[ .-]?\d{2}){4})/i.test(text))continue;
        read(parent,null,null,null,null,null,true);
        break;
      }
    }
  }
  return {source,results:candidates.slice(0,25),drafts:drafts.slice(0,25),scanned:nodes.length,
    warning:candidates.length||drafts.length ? null : 'Aucune fiche locale identifiable sur cette page. Ouvrez le détail d’un établissement puis réessayez.'};
})();
