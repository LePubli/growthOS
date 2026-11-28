// A missing identifier is never evidence. Keep the same establishment across sources.
export const normalizedIdentity=(v:unknown)=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const digits=(v:unknown)=>String(v||'').replace(/\D/g,'');
const legal=(v:unknown,size:number)=>new RegExp('^\\d{'+size+'}$').test(String(v||''))?String(v):'';
// Remove only explicit unit complements; keep street numbers, bis/ter and postal codes.
export const addressIdentity=(v:unknown)=>normalizedIdentity(String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/\b(?:bureau|bur|appartement|appt|etage|batiment|bat|local|lot)\.?\s*[a-z]?\d+[a-z]?\b/g,' ')
  .replace(/\bbd\.?\s/g,'boulevard ').replace(/\bav\.?\s/g,'avenue ').replace(/\br\.?\s/g,'rue ').replace(/\brte\.?\s/g,'route '));
const names=(v:unknown)=>[String(v||''),...String(v||'').matchAll(/\(([^()]+)\)/g)].map(x=>normalizedIdentity(Array.isArray(x)?x[1]:x)).filter(Boolean);
export function captureIdentityMatches(p:any,c:any):boolean{
  let urlSiren='';
  try{if(c.source==='societe_com')urlSiren=new URL(c.sourceUrl).pathname.match(/-(\d{9})\.html\/?$/i)?.[1]||'';}catch{}
  const knownSiret=legal(p.siret,14),incomingSiret=legal(c.siret,14);
  const known=legal(p.siren,9)||knownSiret.slice(0,9);
  const incoming=legal(c.siren||c.pagesjaunesProfile?.siren,9)||incomingSiret.slice(0,9)||urlSiren;
  if(known&&incoming&&known!==incoming)return false;
  if(knownSiret&&incomingSiret)return knownSiret===incomingSiret;
  const city=normalizedIdentity(p.city),otherCity=normalizedIdentity(c.city);
  if(city&&otherCity&&city!==otherCity)return false;
  const address=addressIdentity(p.address),otherAddress=addressIdentity(c.address);
  const addressMatch=address.length>=9&&otherAddress===address;
  const phone=digits(p.phone).replace(/^33/,'0'),otherPhone=digits(c.phone).replace(/^33/,'0');
  const phoneMatch=!!city&&city===otherCity&&phone.length>=9&&phone===otherPhone;
  if(known&&incoming&&known===incoming)
    return (!knownSiret&&!p.address&&!p.phone)||addressMatch||phoneMatch;
  const candidates=[c.company,...(Array.isArray(c.aliases)?c.aliases:[])].flatMap(names);
  const name=normalizedIdentity(p.company);
  return !!name&&candidates.includes(name)&&(addressMatch||phoneMatch);
}
export function uniqueIdentityMatch(p:any,candidates:any[]){
  const matches=candidates.filter(c=>captureIdentityMatches(p,c));
  const unique=[...new Map(matches.map(c=>[c.siret||[c.siren,c.company,c.address].join('|'),c])).values()];
  return unique.length===1?unique[0]:null;
}

/** A commercial name can differ from the legal publisher of its own website.
 * Require independent phone + published legal name + exact establishment address.
 * A web domain or an identifier alone is never sufficient. */
export function websitePublisherMatches(p:any,c:any):boolean{
  if(p.siren||p.siret)return false;
  const site=(p.sourceDetails||p.source_details)?.website?.snapshot;
  if(!site||site.identity!=='matched'||!legal(c.siret,14)||!site.sirets?.includes(c.siret))return false;
  if(new Set(site.sirets).size!==1||new Set([...(site.sirens||[]),...site.sirets.map((v:string)=>v.slice(0,9))]).size!==1)return false;
  if(!site.publishers?.some((v:any)=>normalizedIdentity(v.name)===normalizedIdentity(c.company)))return false;
  const phone=digits(p.phone).replace(/^33/,'0');
  if(phone.length<9||!site.phones?.some((v:any)=>digits(v.phone).replace(/^33/,'0')===phone))return false;
  const address=addressIdentity(c.address);
  return address.length>=12&&site.addresses?.some((v:any)=>addressIdentity(v.address)===address);
}

/** Follow a person linked by the business website as a search clue. Confirm
 * only against an official trade name AND official person/manager identity,
 * with the website's published phone matching the CRM. A slug alone never
 * becomes a manager or contact and cannot override a known legal identity. */
export function websiteInvestigationMatches(p:any,c:any):boolean{
  const known=legal(p.siren,9)||legal(p.siret,14).slice(0,9),incoming=legal(c.siren,9)||legal(c.siret,14).slice(0,9);
  if(known||!incoming||!legal(c.siret,14))return false;
  const site=(p.sourceDetails||p.source_details)?.website?.snapshot;
  if(!site||site.identity!=='matched')return false;
  const publishedSirets=(site.sirets||[]).map((v:unknown)=>legal(v,14)).filter(Boolean);
  const publishedSirens=[...(site.sirens||[]).map((v:unknown)=>legal(v,9)).filter(Boolean),...publishedSirets.map((v:string)=>v.slice(0,9))];
  if(c.siret.slice(0,9)!==incoming||publishedSirens.some((v:string)=>v!==incoming)||publishedSirets.length&&!publishedSirets.includes(c.siret))return false;
  try{if(new URL(site.url).hostname.replace(/^www\./,'')!==new URL(p.website).hostname.replace(/^www\./,''))return false;}catch{return false;}
  const phone=digits(p.phone).replace(/^33/,'0');if(phone.length<9||!site.phones?.some((v:any)=>digits(v.phone).replace(/^33/,'0')===phone))return false;
  if(c.snapshot?.fields?.['État de l’établissement']==='Fermé')return false;
  if(addressIdentity(p.address).length>=9&&addressIdentity(c.address)!==addressIdentity(p.address))return false;
  const brand=normalizedIdentity(p.company);if(brand.length<4)return false;
  const fields=c.companyDetails?.fields||{};
  const aliases=[c.company,...(c.aliases||[]),...(c.tradeNames||[]),...Object.entries(fields).filter(([k])=>/commercial|enseigne/i.test(k)).map(([,v])=>v)].flatMap(names);
  if(!aliases.includes(brand))return false;
  const officials=[c.company,...(c.snapshot?.managers||[]),...(c.companyDetails?.managers||[]),...(c.companyDetails?.managerContacts||[]).map((v:any)=>v.name)]
    .map(v=>normalizedIdentity(String(v||'').split(/\s+[·–]\s+/)[0].replace(/\s*\([^)]*\)\s*$/,'').replace(/^(monsieur|madame|mme|m[.])\s+/i,'')));
  return (site.people||[]).some((clue:any)=>{
    if(!clue.name||!site.socials?.some((s:any)=>s.kind==='person'&&s.url===clue.profileUrl&&s.sourceUrl===clue.sourceUrl))return false;
    const person=normalizedIdentity(clue.name);return person.length>=6&&officials.includes(person);
  });
}
