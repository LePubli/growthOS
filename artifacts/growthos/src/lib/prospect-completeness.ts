import { collectProspectPeople, type ProspectPeopleInput } from './prospect-people.ts';

export type CompletenessProspect = ProspectPeopleInput & {
  company?: string | null;
  siren?: string | null;
  siret?: string | null;
  apeCode?: string | null;
  nafLabel?: string | null;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
  website?: string | null;
};

export type CompletenessCriterion = { label: string; met: boolean; missing: string };

const present = (value: string | null | undefined): boolean => Boolean(value?.trim());
const digits = (value: string | null | undefined): string => (value || '').replace(/\D/g, '');
const goodEmail = (value: string | null | undefined): boolean =>
  Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()));
const goodWebsite = (value: string | null | undefined): boolean => {
  if (!present(value)) return false;
  try {
    const url = new URL(/^https?:\/\//i.test(value!) ? value! : 'https://' + value!);
    return ['http:', 'https:'].includes(url.protocol) && url.hostname.includes('.') && !url.hostname.endsWith('.');
  } catch { return false; }
};
export const hasValidGeoPosition = (lat: number | null | undefined, lng: number | null | undefined): boolean =>
  typeof lat === 'number' && typeof lng === 'number' &&
  Number.isFinite(lat) && Number.isFinite(lng) &&
  Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0);

/** Score purement documentaire, pas un score commercial ni une validation humaine. */
export function computeProspectCompleteness(prospect: CompletenessProspect, officialManagers: string[] = []) {
  const siren = digits(prospect.siren);
  const siret = digits(prospect.siret);
  const legalIds = siren.length === 9 && siret.length === 14 && siret.startsWith(siren);
  const activeGeo = hasValidGeoPosition(prospect.lat, prospect.lng);
  const managers = collectProspectPeople(prospect, officialManagers).filter(person => person.isManager);
  const criteria: CompletenessCriterion[] = [
    { label: 'Identité SIREN/SIRET', met: present(prospect.company) && legalIds,
      missing: 'Raison sociale, SIREN à 9 chiffres et SIRET cohérent à 14 chiffres requis.' },
    { label: 'Identification officielle', met: legalIds && Boolean(prospect.sourceDetails?.annuaire),
      missing: 'Vérifier le SIRET auprès de l’Annuaire des Entreprises.' },
    { label: 'Activité APE / NAF', met: /^\d{2}\.\d{2}[A-Z]$/i.test(prospect.apeCode?.trim() || '') && present(prospect.nafLabel),
      missing: 'Code APE valide et libellé d’activité officiel requis.' },
    { label: 'Adresse postale complète', met: present(prospect.address) && /^\d{5}$/.test(prospect.postalCode?.trim() || '') && present(prospect.city),
      missing: 'Renseigner la voie, le code postal français et la ville.' },
    { label: 'Localisation GPS', met: activeGeo,
      missing: 'Géocoder l’adresse pour afficher une position sur la carte.' },
    { label: 'Téléphone de contact', met: digits(prospect.phone).length >= 9 && digits(prospect.phone).length <= 15,
      missing: 'Un numéro de téléphone exploitable doit être renseigné.' },
    { label: 'Adresse email valide', met: goodEmail(prospect.email),
      missing: 'Renseigner une adresse email valide.' },
    { label: 'Site web valide', met: goodWebsite(prospect.website),
      missing: 'Renseigner le domaine ou l’adresse HTTP(S) du site.' },
    { label: 'Dirigeant nominatif', met: managers.some(person => present(person.name) && present(person.role)),
      missing: 'Identifier au moins un dirigeant et sa fonction dans une source.' },
  ];
  const completed = criteria.filter(criterion => criterion.met).length;
  return { criteria, completed, total: criteria.length, percent: Math.round(completed / criteria.length * 100) };
}
