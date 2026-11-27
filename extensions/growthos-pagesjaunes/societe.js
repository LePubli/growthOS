/* Lecture de la fiche ouverte après le clic de l’utilisateur dans Chrome. */
(() => {
  const url = new URL(location.href);
  const siren = url.pathname.match(/^\/societe\/[a-z0-9-]+-(\d{9})\.html\/?$/i)?.[1];
  if (url.protocol !== 'https:' || !['societe.com','www.societe.com'].includes(url.hostname) || !siren)
    return {error:'Ouvrez une fiche société Societe.com.'};
  const visible = element => element && element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden';
  const clean = value => String(value || '').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
  const normalized = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s*:\s*$/,'');
  const title = document.querySelector('h1');
  if (!visible(title)) return {error:'Le nom de la société n’est pas visible. Terminez le chargement de la page.'};
  const company = clean(title.innerText).slice(0,160);
  const root = document.querySelector('main') || document.body;
  const lines = (root.innerText || '').split(/\n+/).map(clean).filter(Boolean);
  const semanticRows = typeof root.querySelectorAll === 'function'
    ? [...root.querySelectorAll('dt, th')].filter(visible).map(label => [clean(label.innerText), clean(label.nextElementSibling?.innerText)]) : [];
  const field = labels => {
    for (const [label,value] of semanticRows) if(labels.includes(normalized(label)) && value) return value;
    for (const line of lines) {
      const key = normalized(line);
      const label = [...labels].sort((a,b)=>b.length-a.length).find(label => key === label || key.startsWith(label + ':') || key.startsWith(label + ' :'));
      if (!label) continue;
      if(key === label) return lines[lines.indexOf(line)+1] || '';
      return clean(line.slice(label.length).replace(/^\s*:\s*/,''));
    }
    return '';
  };
  const shownSiren = field(['siren']).match(/(?:\d[\s\u00a0]*){9}/)?.[0].replace(/\s/g,'');
  if (shownSiren !== siren) return {error:'Le SIREN affiché ne correspond pas à l’adresse de cette fiche.'};
  const rawSiret = field(['siret du siege social','siret du siege','siret']).match(/(?:\d[\s\u00a0]*){14}/)?.[0].replace(/\s/g,'') || '';
  const siret = /^\d{14}$/.test(rawSiret) && rawSiret.startsWith(siren) ? rawSiret : null;
  const address = field(['adresse','adresse du siege social','adresse du siege']);
  const codePostal = address.match(/\b\d{5}\b/)?.[0];
  if (!company || !codePostal) return {error:'Adresse complète ou code postal non visible. Complétez la fiche manuellement.'};
  const city = clean(address.slice(address.indexOf(codePostal)+5)).replace(/^[,\s]+/,'').slice(0,120) || null;
  const phoneValue = field(['telephone','tel','telephone de contact']);
  let phone = phoneValue.match(/(?:\+33\s?(?:\(0\))?\s?|0)[1-9](?:[ .-]?\d{2}){4}\b/)?.[0] || null;
  const emailValue=field(['mail de contact','adresse email','email']);
  let email=emailValue.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0] || null;
  const websiteValue = field(['site internet','site web','site web de l’entreprise','site internet de l’entreprise']);
  let website = null;
  try {
    const parsed = new URL(websiteValue.startsWith('www.') ? 'https://'+websiteValue : websiteValue);
    if (['https:','http:'].includes(parsed.protocol) && !/(^|\.)societe\.com$/.test(parsed.hostname)) website=parsed.href;
  } catch { /* Le site web reste absent si aucun lien explicite n’est affiché. */ }
  const activity = field(['activite (naf / ape)','activite (naf/ape)','code naf / ape','code naf/ape']);
  const rawApe = activity.match(/\b(\d{2})\.?([0-9]{2}[A-Z])\b/)?.slice(1).join('.') || null;
  const details = {};
  const labels = {
    'Forme juridique':['forme juridique'],
    'Capital social':['capital social','capital'],
    'Date de création':['date de creation'],
    'Numéro de TVA':['numero de tva','numero de tva intracommunautaire'],
    'Statut RCS':['statut rcs'], 'Statut INSEE':['statut insee'], 'Statut RNE':['statut rne'],
    'Activité déclarée':['activite principale declaree'],
    'Convention collective':['convention collective deduite','convention collective'],
    'Noms commerciaux':['noms commerciaux','nom commercial'],
    'Effectif':['effectif','effectif salarie','effectif salaries'],
    'Chiffre d’affaires':['chiffre d’affaires','chiffre d\'affaires'],
    'Résultat net':['resultat net'],
  };
  for (const [label, aliases] of Object.entries(labels)) {
    const value=field(aliases);
    if(value && value.length<=600 && !/^(?:afficher|consulter|obtenir|recherche de|voir|non disponible)/i.test(value)) details[label]=value;
  }
  const titleIndex=lines.indexOf(company);
  const header=titleIndex>=0?lines.slice(titleIndex+1,titleIndex+8):[];
  const displayedStatus=header.find(line=>/^(?:Active?|Cess[eé]e?|Radi[eé]e?|Ferm[eé]e?)(?:\s|$)/i.test(line));
  if(displayedStatus)details['Statut affiché']=displayedStatus.slice(0,120);
  const anchors=typeof root.querySelectorAll==='function'?[...root.querySelectorAll('a[href]')].filter(visible):[];
  const managerLink = link => {
    try { const target=new URL(link.href,url.href);return ['societe.com','www.societe.com'].includes(target.hostname) && /^\/(?:dirigeants?|manager)\//i.test(target.pathname); } catch {return false;}
  };
  const headings=typeof root.querySelectorAll==='function'?[...root.querySelectorAll('h2, h3')].filter(visible):[];
  const heading=headings.find(element=>/^dirigeants?(?:\s|$)/i.test(clean(element.innerText)));
  const nextSection = heading => heading ? headings.slice(headings.indexOf(heading)+1)
    .find(candidate => Number(candidate.tagName?.slice(1) || 2) <= Number(heading.tagName?.slice(1) || 2)) : null;
  const nextHeading=nextSection(heading);
  // Limiter les liens à la rubrique de cette société, avant les recommandations.
  const managerAnchors=anchors.filter(link => managerLink(link) && heading && (
    (typeof heading.compareDocumentPosition==='function' && (heading.compareDocumentPosition(link)&4) &&
      (!nextHeading || (nextHeading.compareDocumentPosition(link)&2)))));
  const managers=[...new Set(managerAnchors.map(link=>clean(link.innerText))
    .filter(name=>name.length>3 && name.length<=120 && !/^(?:voir|consulter|dirigeants? de)/i.test(name)))].slice(0,30);
  const summaryManager=field(['dirigeant','dirigeants','gerant','president']);
  if(!managers.length && summaryManager && summaryManager.length<=120 && !/voir|obtenir|afficher|non disponible/i.test(summaryManager))managers.push(summaryManager);
  const managerContacts=[];
  const managerKey=link=>String(link.href).split('#')[0];
  const managerCards=new Set();
  for(const anchor of managerAnchors){
    const name=clean(anchor.innerText);
    if(!managers.includes(name) || managerContacts.some(contact=>contact.name===name))continue;
    const explicitCard=typeof anchor.closest==='function'?anchor.closest('article, li, [data-dirigeant], .card'):null;
    let card=explicitCard;
    if(!card)card=anchor.parentElement;
    // Les cartes peuvent être des div sans classe stable. Remonter uniquement
    // tant que la zone contient un seul dirigeant et aucune autre rubrique.
    for(let parent=card?.parentElement,depth=0;!explicitCard && parent && parent!==root && depth<4;parent=parent.parentElement,depth++){
      if(typeof parent.querySelectorAll!=='function' || clean(parent.innerText).length>1500)break;
      const local=[...parent.querySelectorAll('a[href]')].filter(visible);
      if(new Set(local.filter(managerLink).map(managerKey)).size!==1 || [...parent.querySelectorAll('h2, h3')].some(element=>/^(?:dirigeants?|contacter?|ces entreprises)\b/i.test(clean(element.innerText))))break;
      card=parent;
    }
    const cardLinks=card && card!==root && typeof card.querySelectorAll==='function' ? [...card.querySelectorAll('a[href]')].filter(visible) : [];
    const isolated=card && card!==root && clean(card.innerText).length<=1500 && new Set(cardLinks.filter(managerLink).map(managerKey)).size<=1;
    if(isolated)managerCards.add(card);
    const cardText=isolated?clean(card.innerText):'';
    const role=cardText.match(/\b(?:Pr[eé]sident(?:e)?(?:-directeur g[eé]n[eé]ral)?|G[eé]rant(?:e)?|Directeur g[eé]n[eé]ral|Administrateur|Associ[eé](?:e)?)\b/i)?.[0] || null;
    const localLinks=isolated?cardLinks:[];
    const localPhone=localLinks.find(link=>/^tel:/i.test(link.href));
    const localEmail=localLinks.find(link=>/^mailto:/i.test(link.href));
    const phone=localPhone?decodeURIComponent(localPhone.href.slice(4)).replace(/[ .-]/g,'').replace(/^\+33\(0\)/,'+33').match(/^(?:\+33|0)[1-9](?:[ .-]?\d{2}){4}$/)?.[0] || null:null;
    const email=localEmail?decodeURIComponent(localEmail.href.slice(7).split('?')[0]).match(/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i)?.[0] || null:null;
    managerContacts.push({name,role,phone,email,profileUrl:new URL(anchor.href,url.href).href});
  }
  // Les coordonnées d'un dirigeant restent attachées à sa carte. Les coordonnées
  // générales sont lues dans la rubrique Contact de l'entreprise uniquement.
  const contactHeading=headings.find(element=>/^contacter?\s/i.test(clean(element.innerText)));
  const nextContactHeading=nextSection(contactHeading);
  const companyLinks=contactHeading?anchors.filter(link=>
    (contactHeading.compareDocumentPosition(link)&4) && (!nextContactHeading || (nextContactHeading.compareDocumentPosition(link)&2)) &&
    ![...managerCards].some(card=>card.contains?.(link))):[];
  if(!phone){const link=companyLinks.find(link=>/^tel:/i.test(link.href));if(link)phone=decodeURIComponent(link.href.slice(4)).replace(/[ .-]/g,'').replace(/^\+33\(0\)/,'+33').match(/^(?:\+33|0)[1-9](?:[ .-]?\d{2}){4}$/)?.[0] || null;}
  if(!email){const link=companyLinks.find(link=>/^mailto:/i.test(link.href));if(link)email=decodeURIComponent(link.href.slice(7).split('?')[0]).match(/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i)?.[0] || null;}
  const establishments=[];
  for(let index=0;index<lines.length && establishments.length<30;index++){
    if(normalized(lines[index])!=='siret')continue;
    const value=(lines[index+1]||'').replace(/\s/g,'');
    if(!/^\d{14}$/.test(value)||!value.startsWith(siren)||establishments.some(site=>site.siret===value))continue;
    const next=lines.slice(index+2,index+24);
    const addressIndex=next.findIndex(line=>normalized(line)==='adresse');
    const shownAddress=addressIndex>=0?next[addressIndex+1]:null;
    establishments.push({siret:value,address:shownAddress && /\b\d{5}\b/.test(shownAddress)?shownAddress.slice(0,320):null});
  }
  if(siret && !establishments.some(site=>site.siret===siret))establishments.unshift({siret,address});
  const links=[];
  for(const anchor of anchors){
    const label=clean(anchor.innerText);
    if(label.length<14 || label.length>180 || !/statuts|comptes annuels|annonce|bodacc|kbis|acte constitutif/i.test(label))continue;
    try{
      const target=new URL(anchor.href,url.href);
      if(target.protocol==='https:' && ['societe.com','www.societe.com'].includes(target.hostname) &&
          !links.some(link=>link.url===target.href)) links.push({label,url:target.href});
    }catch{ /* Un lien invalide reste absent. */ }
    if(links.length>=20)break;
  }
  const companyDetails={fields:details,managers,managerContacts,establishments,links};
  return {results:[{source:'societe_com',company,address,codePostal,city,phone,email,website,
    sourceUrl:url.href,siret,companyDetails,...(siret && rawApe ? {apeCode:rawApe,nafLabel:null,nafVersion:null,apeScope:'unite_legale'} : {})}]};
})();
