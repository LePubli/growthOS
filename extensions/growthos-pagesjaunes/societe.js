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
  const websiteValue = field(['site internet','site web','site web de l’entreprise','site internet de l’entreprise']);
  let website = null;
  try {
    const parsed = new URL(websiteValue.startsWith('www.') ? 'https://'+websiteValue : websiteValue);
    if (['https:','http:'].includes(parsed.protocol) && !/(^|\.)societe\.com$/.test(parsed.hostname)) website=parsed.href;
  } catch { /* Le site web reste absent si aucun lien explicite n’est affiché. */ }
  const activity = field(['activite (naf / ape)','activite (naf/ape)','code naf / ape','code naf/ape']);
  const rawApe = activity.match(/\b(\d{2})\.?([0-9]{2}[A-Z])\b/)?.slice(1).join('.') || null;
  return {results:[{source:'societe_com',company,address,codePostal,city,phone,website,
    sourceUrl:url.href,siret,...(siret && rawApe ? {apeCode:rawApe,nafLabel:null,nafVersion:null,apeScope:'unite_legale'} : {})}]};
})();
