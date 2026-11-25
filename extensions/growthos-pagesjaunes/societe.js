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
  const field = labels => {
    const index = lines.findIndex(line => labels.includes(normalized(line)));
    return index >= 0 ? lines[index+1] || '' : '';
  };
  const shownSiren = field(['siren']).replace(/\s/g,'');
  if (shownSiren !== siren) return {error:'Le SIREN affiché ne correspond pas à l’adresse de cette fiche.'};
  const rawSiret = field(['siret du siege social','siret du siege','siret']).replace(/\s/g,'');
  const siret = /^\d{14}$/.test(rawSiret) && rawSiret.startsWith(siren) ? rawSiret : null;
  const address = field(['adresse','adresse du siege social','adresse du siege']);
  const codePostal = address.match(/\b\d{5}\b/)?.[0];
  if (!company || !codePostal) return {error:'Adresse complète ou code postal non visible. Complétez la fiche manuellement.'};
  const city = clean(address.slice(address.indexOf(codePostal)+5)).replace(/^[,\s]+/,'').slice(0,120) || null;
  const phoneValue = field(['telephone','tel','telephone de contact']);
  const phone = phoneValue.match(/(?:\+33\s?(?:\(0\))?\s?|0)[1-9](?:[ .-]?\d{2}){4}\b/)?.[0] || null;
  const emailValue=field(['mail de contact','adresse email','email']);
  const email=emailValue.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0] || null;
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
  const managers=[...new Set(anchors.filter(link=>{
    try{return /^\/dirigeants?\//i.test(new URL(link.href,url.href).pathname);}catch{return false;}
  }).map(link=>clean(link.innerText)).filter(name=>name.length>3 && name.length<=120 && !/^voir/i.test(name)))].slice(0,30);
  const summaryManager=field(['dirigeants']);
  if(!managers.length && summaryManager && summaryManager.length<=120 && !/voir|obtenir/i.test(summaryManager))managers.push(summaryManager);
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
  const companyDetails={fields:details,managers,establishments,links};
  return {results:[{source:'societe_com',company,address,codePostal,city,phone,email,website,
    sourceUrl:url.href,siret,companyDetails,...(siret && rawApe ? {apeCode:rawApe,nafLabel:null,nafVersion:null,apeScope:'unite_legale'} : {})}]};
})();
