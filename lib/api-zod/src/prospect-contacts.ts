/** Contacts nominatifs relevés dans le CRM et les sources rattachées au prospect.
 * Les téléphones généraux de l'entreprise ne sont pas attribués à un dirigeant.
 * Aucun nom ni rôle n'est inféré à partir de la raison sociale. */
export type ProspectPerson = {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  profileUrl: string | null;
  source: 'societe_com' | 'pappers' | 'annuaire' | 'crm' | 'website';
  isManager: boolean;
  phones?: string[]; emails?: string[]; sources?: string[];
};

export type ProspectPeopleInput = {
  firstName?: string | null;
  lastName?: string | null;
  jobTitle?: string | null;
  phone?: string | null;
  email?: string | null;
  sourceDetails?: Record<string, unknown> | null;
};

const nonEmpty = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;
const publicHttpUrl = (value: unknown): string | null => {
  const url = nonEmpty(value);
  return url && /^https?:\/\//i.test(url) ? url : null;
};
const normalize = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr-FR').replace(/\s+/g, ' ').trim();
const plainRecord = (value: unknown): Record<string, unknown> | null =>
  !!value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

export function collectProspectPeople(prospect: ProspectPeopleInput, officialManagerNames: string[] = []): ProspectPerson[] {
  const all: ProspectPerson[] = [];
  const byName = new Map<string, number>();
  const add = (person: ProspectPerson) => {
    const key = normalize(person.name);
    const existingIndex = byName.get(key);
    if (existingIndex !== undefined) {
      const old = all[existingIndex];
      // Le relevé détaillé a priorité sur une simple ligne « nom · rôle ».
      all[existingIndex] = {
        ...old,
        role: old.role || person.role,
        phone: old.phone || person.phone,
        email: old.email || person.email,
        profileUrl: old.profileUrl || person.profileUrl,
        isManager: old.isManager || person.isManager,
        phones:[...new Set([...(old.phones||[]),...(person.phones||[]),person.phone].filter(Boolean))] as string[],
        emails:[...new Set([...(old.emails||[]),...(person.emails||[]),person.email].filter(Boolean))] as string[],
        sources:[...new Set([...(old.sources||[old.source]),person.source])],
      };
      return;
    }
    byName.set(key, all.length);
    all.push({...person,phones:person.phone?[person.phone]:[],emails:person.email?[person.email]:[],sources:[person.source]});
  };

  for(const source of ['societe_com','pappers'] as const){
  const societe = plainRecord(prospect.sourceDetails?.[source]);
  const details = plainRecord(societe?.companyDetails);
  const managerContacts = details?.managerContacts;
  if (Array.isArray(managerContacts)) {
    for (const entry of managerContacts) {
      const contact = plainRecord(entry);
      const name = nonEmpty(contact?.name);
      if (!name) continue;
      add({
        id: source+':' + normalize(name), name,
        role: nonEmpty(contact?.role),
        phone: nonEmpty(contact?.phone), email: nonEmpty(contact?.email),
        profileUrl: publicHttpUrl(contact?.profileUrl),
        source, isManager: true,
      });
    }
  }
  const managers = details?.managers;
  if (Array.isArray(managers)) {
    for (const item of managers) {
      const raw = nonEmpty(item);
      if (!raw) continue;
      const [namePart, ...roleParts] = raw.split(/\s+[·–]\s+/);
      const name = nonEmpty(namePart);
      if (!name) continue;
      add({id:source+':'+normalize(name), name, role:nonEmpty(roleParts.join(' · ')),
        phone:null,email:null,profileUrl:null,source,isManager:true});
    }
  }

  }
  const snapshots=['entreprises','insee'].flatMap(source=>{const snapshot=plainRecord(plainRecord(prospect.sourceDetails?.[source])?.snapshot);return Array.isArray(snapshot?.managers)?snapshot.managers:[];});
  for (const item of [...officialManagerNames,...snapshots]) {
    const raw = nonEmpty(item);
    if (!raw) continue;
    const [namePart, ...roleParts] = raw.split(/\s+[·–]\s+/);
    const name = nonEmpty(namePart);
    if (!name) continue;
    add({id:'annuaire:'+normalize(name),name,role:nonEmpty(roleParts.join(' · ')),
      phone:null,email:null,profileUrl:null,source:'annuaire',isManager:true});
  }

  const merged=prospect.sourceDetails?.mergedPeople;
  if(Array.isArray(merged))for(const raw of merged){const p=plainRecord(raw),name=nonEmpty(p?.name);if(name&&['societe_com','pappers','annuaire','crm','website'].includes(String(p?.source)))add({...p,name,profileUrl:publicHttpUrl(p?.profileUrl),id:'merged:'+normalize(name)} as ProspectPerson);}
  const stored=prospect.sourceDetails?.contactPoints;
  if(Array.isArray(stored))for(const raw of stored){const point=plainRecord(raw),name=nonEmpty(point?.personName);const i=name?byName.get(normalize(name)):undefined;if(i===undefined)continue;const old=all[i],value=nonEmpty(point?.value);if(!value)continue;if(point?.type==='email')old.emails=[...new Set([...(old.emails||[]),value])];if(point?.type==='phone')old.phones=[...new Set([...(old.phones||[]),value])];old.email=old.email||old.emails?.[0]||null;old.phone=old.phone||old.phones?.[0]||null;}
  const website=plainRecord(plainRecord(prospect.sourceDetails?.website)?.snapshot);
  if(website?.identity!=='contradictory'&&Array.isArray(website?.people))for(const raw of website.people){const p=plainRecord(raw),name=nonEmpty(p?.name);if(name&&p?.nameState==='observed'&&p?.association==='company_mentioned_on_profile')add({id:'website:'+normalize(name),name,role:null,phone:null,email:null,profileUrl:publicHttpUrl(p.profileUrl),source:'website',isManager:false});}
  const crmName = [prospect.firstName, prospect.lastName].map(nonEmpty).filter(Boolean).join(' ').trim();
  if (crmName) {
    add({id:'crm:'+normalize(crmName),name:crmName,role:nonEmpty(prospect.jobTitle),
      phone:null,email:null,profileUrl:null,
      source:'crm',isManager:/\b(dirigeant|gérant|président|directeur général)\b/i.test(prospect.jobTitle||'')});
  }
  return all;
}

export type ProspectContactPoint={
  type:'email'|'phone'|'address'; value:string; source:string; sourceUrl:string|null;
  state:'confirmed'|'published'|'review'; personName?:string|null; establishmentSiret?:string|null;
};
const pointKey=(p:ProspectContactPoint)=>[p.type,
  p.type==='phone'?p.value.replace(/\D/g,'').replace(/^33/,'0'):normalize(p.value),
  p.source,p.sourceUrl||'',normalize(p.personName||''),p.establishmentSiret||''].join('|');
/** All published coordinates are retained; a primary CRM field is only one choice. */
export function collectProspectContactPoints(prospect:ProspectPeopleInput&{address?:string|null;source?:string|null;sourceUrl?:string|null}):ProspectContactPoint[]{
  const points:ProspectContactPoint[]=[];
  const add=(type:ProspectContactPoint['type'],value:unknown,source:string,url:unknown,state:ProspectContactPoint['state']='confirmed',personName?:string|null,establishmentSiret?:string|null)=>{
    const text=nonEmpty(value);if(!text)return;
    if(type==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text))return;
    if(type==='phone'&&text.replace(/\D/g,'').length<8)return;
    points.push({type,value:type==='email'?text.toLowerCase():text,source,sourceUrl:publicHttpUrl(url),state,personName:personName||null,...(establishmentSiret?{establishmentSiret}:{})});
  };
  const details=prospect.sourceDetails||{};
  const stored=details.contactPoints;
  if(Array.isArray(stored))for(const raw of stored){const p=plainRecord(raw);if(p&&['email','phone','address'].includes(String(p.type)))add(p.type as ProspectContactPoint['type'],p.value,String(p.source||'crm'),p.sourceUrl,['confirmed','published','review'].includes(String(p.state))?p.state as ProspectContactPoint['state']:'review',nonEmpty(p.personName),nonEmpty(p.establishmentSiret));}
  const site=plainRecord(plainRecord(details.website)?.snapshot);
  for(const type of ['email','phone','address'] as const){
    const fieldSource=plainRecord(plainRecord(plainRecord(details.crossSource)?.fieldSources)?.[type]);
    const source=nonEmpty(fieldSource?.source)||(prospect.source&&!prospect.source.includes(',')?prospect.source:'crm');
    // Website snapshots already contain the exact proof URL for every value.
    if(source==='website'&&site){
      const key=type==='email'?'emails':type==='phone'?'phones':'addresses';
      const value=nonEmpty(prospect[type]);
      const same=(v:unknown)=>type==='phone'?String(v||'').replace(/\D/g,'').replace(/^33/,'0')===String(value||'').replace(/\D/g,'').replace(/^33/,'0'):normalize(String(v||''))===normalize(value||'');
      if(Array.isArray(site[key])&&(site[key] as unknown[]).some(raw=>same(plainRecord(raw)?.[type])))continue;
      // A manual edit can leave the former source metadata behind. Preserve
      // the value as CRM data without inventing a website proof for it.
      if(!points.some(p=>p.type===type&&same(p.value)))add(type,value,'crm',null);
      continue;
    }
    add(type,prospect[type],source,fieldSource?.sourceUrl||prospect.sourceUrl);
  }
  const conflicts=plainRecord(details.crossSource)?.conflicts;
  if(Array.isArray(conflicts))for(const raw of conflicts){const p=plainRecord(raw);if(p&&['email','phone','address'].includes(String(p.field)))add(p.field as ProspectContactPoint['type'],p.incoming,String(p.source||'source'),p.sourceUrl,'review');}
  if(site){const state=site.identity==='contradictory'?'review':site.identity==='matched'?'confirmed':'published';
    for(const [type,list] of [['email','emails'],['phone','phones'],['address','addresses']] as const)
      if(Array.isArray(site[list]))for(const raw of site[list] as unknown[]){const p=plainRecord(raw);if(p)add(type,p[type],'website',p.sourceUrl,state);}
  }
  for(const source of ['societe_com','pappers']){
    const profile=plainRecord(details[source]),company=plainRecord(profile?.companyDetails);
    if(Array.isArray(company?.establishments))for(const raw of company.establishments){const v=plainRecord(raw);if(v)add('address',v.address,source,profile?.sourceUrl,'published',null,nonEmpty(v.siret));}
  }
  for(const source of ['societe_com','pappers']){
    const profile=plainRecord(details[source]),company=plainRecord(profile?.companyDetails);
    if(Array.isArray(company?.managerContacts))for(const raw of company.managerContacts){const person=plainRecord(raw),name=nonEmpty(person?.name);if(!name)continue;add('email',person?.email,source,person?.profileUrl||profile?.sourceUrl,'confirmed',name);add('phone',person?.phone,source,person?.profileUrl||profile?.sourceUrl,'confirmed',name);}
  }
  const unique=new Map<string,ProspectContactPoint>();
  for(const p of points)unique.set(pointKey(p),p);
  return [...unique.values()];
}
