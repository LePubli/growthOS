/* Communication limitée à l'extension navigateur installée sur cet appareil.
   Le serveur GrowthOS et l'extension ne partagent ni mot de passe ni token. */
export type CompanyDetails = {fields:Record<string,string>;managers:string[];
  establishments:{siret:string;address:string|null}[];links:{label:string;url:string}[]};
export type LocalCompany = {
  id: string;
  source?: 'pagesjaunes' | 'google_maps' | 'google_search' | 'bing' | 'linkedin' | 'societe_com' | 'facebook' | 'instagram' | 'tiktok';
  company: string;
  address: string;
  codePostal: string;
  city: string | null;
  phone: string | null;
  email?: string | null;
  website: string | null;
  sourceUrl: string | null;
  siret: string | null;
  apeCode?: string | null;
  apeScope?: 'etablissement' | 'unite_legale';
  nafLabel?: string | null;
  nafVersion?: string | null;
  companyDetails?: CompanyDetails;
  collectionMode?: 'manual' | 'visible';
  capturedAt?: number;
};
export type LocalDraft = {
  id: string;
  source: 'google_maps' | 'google_search' | 'bing';
  company: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  website: string | null;
  sourceUrl: string;
  capturedAt: number;
};
export type LocalProfile = {
  sourceUrl: string; name: string;
  address: string | null; codePostal: string | null; city: string | null;
  phone: string | null; email: string | null; website: string | null;
  siret: string | null; siren: string | null;
  description: string | null; openingHours: string | null; services: string | null; legal: string | null;
  socials: {facebook?:string;instagram?:string;linkedin?:string};
  rating: number | null; reviewCount: number | null; capturedAt: string;
};
type ExtensionResponse = {
  results: LocalCompany[];
  drafts: LocalDraft[];
  warnings: string[];
  profile: LocalProfile | null;
  version?: string;
  extensionId?: string;
};
const CHANNEL = 'growthos-pagesjaunes-device-v1';
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
export function isMobileConnectorRequired() { return isMobile; }
export function localPagesJaunesLocations(filters: {
  regions: string[]; departements: string[]; codesPostaux: string[];
  departmentNames: Record<string, string>; regionNames: Record<string, string>;
}): string[] {
  const {regions, departements, codesPostaux, departmentNames, regionNames} = filters;
  // Les zones de recherche restent des lieux ; les filtres exacts sont revérifiés par l'API.
  return [...new Set(codesPostaux.length ? codesPostaux :
    departements.length ? departements.map(code => departmentNames[code] || code) :
    regions.map(code => regionNames[code] || code))];
}
function askExtension(action: 'ping'|'search'|'enrich'|'get-captures'|'get-drafts'|'ack-import', payload?: object, timeoutMs = 4000): Promise<ExtensionResponse> {
  return new Promise((resolve,reject) => {
    if (isMobile) { reject(new Error('Sur téléphone, une application Android dédiée sera nécessaire.')); return; }
    const requestId = crypto.randomUUID();
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', listener);
      reject(new Error('Connecteur non détecté. Installez l’extension Chrome puis actualisez GrowthOS.'));
    }, timeoutMs);
    function listener(event: MessageEvent) {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const m = event.data;
      if (!m || m.channel !== CHANNEL || m.direction !== 'from-extension' || m.requestId !== requestId) return;
      window.clearTimeout(timeout); window.removeEventListener('message',listener);
      if (!m.ok) { reject(new Error(m.error || 'Extension indisponible')); return; }
      resolve({results: Array.isArray(m.results) ? m.results : [], drafts: Array.isArray(m.drafts) ? m.drafts : [], warnings: Array.isArray(m.warnings) ? m.warnings : [], profile: m.profile || null,
        version:m.version,extensionId:m.extensionId});
    }
    window.addEventListener('message',listener);
    window.postMessage({channel:CHANNEL,direction:'to-extension',requestId,action,payload},window.location.origin);
  });
}
export function pingLocalPagesJaunes() { return askExtension('ping'); }
export function acknowledgeLocalImport(ids:string[]) { return askExtension('ack-import',{ids}); }
/** Les fiches restent sur l'appareil jusqu'à la recherche : aucun token CRM dans l'extension. */
export async function getLocalCaptures(): Promise<LocalCompany[]> {
  const response=await askExtension('get-captures');
  return response.results.filter(item=>['google_maps','google_search','bing','linkedin','societe_com','facebook','instagram','tiktok'].includes(item.source||''));
}
/** Brouillons locaux (jamais importables tant qu'une adresse n'est pas vérifiée). */
export async function getLocalDrafts(): Promise<LocalDraft[]> {
  try {
    const response = await askExtension('get-drafts');
    return response.drafts.filter(item => ['google_maps','google_search','bing'].includes(item.source));
  } catch {
    // Le pont de l'extension 0.4.1 ignore cette action et expire après 2 s.
    // Conserver les captures vérifiées de cette version jusqu'à la migration
    // vers l'extension 0.5 (le ping et get-captures restent vérifiés séparément).
    return [];
  }
}
export function searchLocalPagesJaunes(payload: {query:string;locations:string[];limit:number}) {
  // 8 zones * (chargement 25s + pause 5s), plus marge pour la recherche.
  return askExtension('search',payload,Math.min(270000, payload.locations.length * 34000 + 15000));
}

export async function enrichLocalPagesJaunes(url: string): Promise<LocalProfile> {
  const response = await askExtension('enrich', {url}, 60000);
  if (!response.profile) throw new Error('La fiche PagesJaunes n’a pas pu être extraite');
  return response.profile;
}
