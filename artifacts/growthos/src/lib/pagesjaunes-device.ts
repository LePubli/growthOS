/* Communication limitée à l'extension navigateur installée sur cet appareil.
   Le serveur GrowthOS et l'extension ne partagent ni mot de passe ni token. */
export type LocalCompany = {
  id: string;
  company: string;
  address: string;
  codePostal: string;
  city: string | null;
  phone: string | null;
  website: string | null;
  sourceUrl: string | null;
  siret: string | null;
};
type ExtensionResponse = {
  results: LocalCompany[];
  warnings: string[];
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
function askExtension(action: 'ping'|'search', payload?: object, timeoutMs = 2000): Promise<ExtensionResponse> {
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
      resolve({results: Array.isArray(m.results) ? m.results : [], warnings: Array.isArray(m.warnings) ? m.warnings : []});
    }
    window.addEventListener('message',listener);
    window.postMessage({channel:CHANNEL,direction:'to-extension',requestId,action,payload},window.location.origin);
  });
}
export function pingLocalPagesJaunes() { return askExtension('ping'); }
export function searchLocalPagesJaunes(payload: {query:string;locations:string[];limit:number}) {
  // 8 zones * (chargement 25s + pause 5s), plus marge pour la recherche.
  return askExtension('search',payload,Math.min(270000, payload.locations.length * 34000 + 15000));
}
