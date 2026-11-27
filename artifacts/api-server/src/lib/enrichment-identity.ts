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
