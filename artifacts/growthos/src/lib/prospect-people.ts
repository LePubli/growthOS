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
  source: 'societe_com' | 'pappers' | 'annuaire' | 'crm';
  isManager: boolean;
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
      };
      return;
    }
    byName.set(key, all.length);
    all.push(person);
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
        id: 'societe:' + normalize(name), name,
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
      add({id:'societe:'+normalize(name), name, role:nonEmpty(roleParts.join(' · ')),
        phone:null,email:null,profileUrl:null,source,isManager:true});
    }
  }

  }
  for (const item of officialManagerNames) {
    const raw = nonEmpty(item);
    if (!raw) continue;
    const [namePart, ...roleParts] = raw.split(/\s+[·–]\s+/);
    const name = nonEmpty(namePart);
    if (!name) continue;
    add({id:'annuaire:'+normalize(name),name,role:nonEmpty(roleParts.join(' · ')),
      phone:null,email:null,profileUrl:null,source:'annuaire',isManager:true});
  }

  const crmName = [prospect.firstName, prospect.lastName].map(nonEmpty).filter(Boolean).join(' ').trim();
  if (crmName) {
    add({id:'crm:'+normalize(crmName),name:crmName,role:nonEmpty(prospect.jobTitle),
      phone:null,email:null,profileUrl:null,
      source:'crm',isManager:/\b(dirigeant|gérant|président|directeur général)\b/i.test(prospect.jobTitle||'')});
  }
  return all;
}
