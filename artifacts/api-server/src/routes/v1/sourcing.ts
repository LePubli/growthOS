import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { sourcingJobsTable, prospectsTable } from "@workspace/db";
import { eq, and, desc, inArray, or, ilike } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { requireAuth } from "../../middlewares/auth";
import { logger } from "../../lib/logger";
import { DEPARTMENT_TO_REGION, departmentFromPostalCode, REGION_NAMES, DEPARTMENT_NAMES } from "../../lib/france-geo";
import { searchPagesJaunes } from "../../lib/pagesjaunes-scraper";

const router = Router();

const jobSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("entreprises"),
    name: z.string().trim().min(1).max(120),
    params: z.object({
      query: z.string().trim().min(3).max(120),
      regions: z.array(z.string().regex(/^\d{2}$/)).max(18).default([]),
      departements: z.array(z.string().regex(/^(?:\d{2}|2A|2B|97\d)$/)).max(101).default([]),
      codesPostaux: z.array(z.string().regex(/^\d{5}$/)).max(25).default([]),
      limit: z.coerce.number().int().min(1).max(25).optional().default(10),
    }).refine(p => p.regions.length + p.departements.length + p.codesPostaux.length > 0,
      "Choisissez au moins une région, un département ou un code postal"),
  }),
  z.object({
    type: z.literal("pagesjaunes"),
    name: z.string().trim().min(1).max(120),
    params: z.object({
      query: z.string().trim().min(2).max(120),
      location: z.string().trim().min(2).max(120),
      limit: z.coerce.number().int().min(1).max(25).optional().default(10),
    }),
  }),
  z.object({
    type: z.literal("multi"),
    name: z.string().trim().min(1).max(120),
    params: z.object({
      sources: z.array(z.enum(["entreprises", "pagesjaunes"])).min(1).max(2)
        .refine(items => new Set(items).size === items.length),
      query: z.string().trim().min(3).max(120),
      regions: z.array(z.string().regex(/^\d{2}$/)).max(18).default([]),
      departements: z.array(z.string().regex(/^(?:\d{2}|2A|2B|97\d)$/)).max(101).default([]),
      codesPostaux: z.array(z.string().regex(/^\d{5}$/)).max(25).default([]),
      limit: z.coerce.number().int().min(1).max(25).optional().default(10),
    }).refine(p => p.regions.length + p.departements.length + p.codesPostaux.length > 0,
      "Choisissez au moins une zone géographique"),
  }),
]);

type DirectoryAddress = {
  adresse?: string;
  code_postal?: string;
  libelle_commune?: string;
  siret?: string;
  code_departement?: string;
  code_region?: string;
  activite_principale?: string;
  libelle_activite_principale?: string;
  nomenclature_activite_principale?: string;
};
type CompanyRecord = {
  siren?: string;
  nom_complet?: string;
  nom_raison_sociale?: string;
  siege?: DirectoryAddress;
  matching_etablissements?: DirectoryAddress[];
  activite_principale?: string;
  libelle_activite_principale?: string;
  nomenclature_activite_principale?: string;
};
type SearchCandidate = {
  id?: string; // Identifiant de source, utile sans SIREN
  source?: 'entreprises' | 'pagesjaunes' | 'google_maps' | 'google_search' | 'bing' | 'linkedin';
  sources?: string[];
  siren: string;
  siret: string | null;
  apeCode?: string | null;
  nafLabel?: string | null;
  nafVersion?: string | null;
  company: string;
  address: string | null;
  codePostal: string;
  city: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  sourceDetails?: Record<string, unknown> | null;
  sourceUrl?: string | null;
};
type SavedParams = {
  query?: string;
  location?: string;
  sources?: string[];
  sourceStatuses?: Record<string, { status: string; count?: number; error?: string; zonesAttempted?: number; zonesTotal?: number }>;
  codePostal?: string; // anciennes recherches
  regions?: string[];
  departements?: string[];
  codesPostaux?: string[];
  limit?: number;
  results?: SearchCandidate[];
  importedIds?: string[]; // historical jobs created before selective import
  draftEnrichment?: { checked: number; matched: number; pending: number; pendingItems: { id: string; company: string; source: string; reason: string }[]; updatedAt: string };
  deviceDrafts?: DeviceDraft[]; // captures locales incomplètes, conservées hors du CRM
  draftImports?: Record<string,string>; // id de capture locale => id du prospect créé explicitement
};

type GeoFilters = { query: string; regions: string[]; departements: string[]; codesPostaux: string[]; limit: number };

function matchingGeo(establishment: DirectoryAddress, params: GeoFilters): boolean {
  const cp = establishment.code_postal || "";
  if (!/^\d{5}$/.test(cp)) return false;
  const dep = establishment.code_departement || departmentFromPostalCode(cp);
  const region = establishment.code_region || DEPARTMENT_TO_REGION[dep];
  return (!params.codesPostaux.length || params.codesPostaux.includes(cp))
    && (!params.departements.length || params.departements.includes(dep))
    && (!params.regions.length || Boolean(region && params.regions.includes(region)));
}

async function searchFrenchCompanies(params: GeoFilters, timeoutMs = 15000): Promise<SearchCandidate[]> {
  // Requête exclusivement dirigée vers l'annuaire public, jamais vers une URL utilisateur.
  const url = new URL(process.env.COMPANY_DIRECTORY_API_URL ?? "https://recherche-entreprises.api.gouv.fr/search");
  url.searchParams.set("q", params.query);
  if (params.regions.length) url.searchParams.set("region", params.regions.join(","));
  if (params.departements.length) url.searchParams.set("departement", params.departements.join(","));
  if (params.codesPostaux.length) url.searchParams.set("code_postal", params.codesPostaux.join(","));
  url.searchParams.set("per_page", String(params.limit));
  url.searchParams.set("page", "1");

  const response = await fetch(url, {
    headers: { "Accept": "application/json", "User-Agent": "GrowthOS/1.0 (public company directory)" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Annuaire des entreprises : HTTP ${response.status}`);
  const body = await response.json() as { results?: CompanyRecord[] };
  if (!Array.isArray(body.results)) throw new Error("Réponse incorrecte de l'annuaire des entreprises");

  // L'API peut ignorer les filtres lorsque q est un SIREN/SIRET. Elle peut aussi
  // renvoyer un siège hors zone alors que l'établissement correspondant est local.
  // Ne jamais proposer un établissement sans preuve de localisation conforme.
  const found: SearchCandidate[] = [];
  const seen = new Set<string>();
  for (const result of body.results) {
    const siren = String(result.siren || "").trim();
    const company = (result.nom_complet ?? result.nom_raison_sociale ?? "").trim();
    if (!/^\d{9}$/.test(siren) || !company || seen.has(siren)) continue;
    const local = [...(result.matching_etablissements || []), ...(result.siege ? [result.siege] : [])]
      .find(est => matchingGeo(est, params));
    if (!local) continue;
    seen.add(siren);
    // L'établissement local peut exercer une activité différente du siège.
    // La donnée de l'unité légale n'est utilisée qu'en repli, avec sa provenance.
    const establishmentApe = local.activite_principale?.trim();
    const rawApe = establishmentApe || result.activite_principale?.trim() || '';
    const apeCode = /^\d{2}\.\d{2}[A-Z]$/.test(rawApe.toUpperCase()) ? rawApe.toUpperCase() : null;
    const activitySource = establishmentApe ? local : result;
    found.push({
      siren,
      siret: /^\d{14}$/.test(local.siret || "") ? local.siret! : null,
      company,
      address: local.adresse?.trim() || null,
      codePostal: local.code_postal!,
      city: local.libelle_commune?.trim() || null,
      apeCode,
      nafLabel: apeCode ? activitySource.libelle_activite_principale?.trim() || null : null,
      nafVersion: apeCode ? activitySource.nomenclature_activite_principale?.trim() || null : null,
      sourceDetails: apeCode ? {annuaire:{apeScope:establishmentApe?'etablissement':'unite_legale'}} : null,
    });
    if (found.length >= params.limit) break;
  }
  return found;
}

function savedParams(job: typeof sourcingJobsTable.$inferSelect): SavedParams {
  return (job.params || {}) as SavedParams;
}

async function getJob(id: string, tenantId: string) {
  const [job] = await db.select().from(sourcingJobsTable)
    .where(and(eq(sourcingJobsTable.id, id), eq(sourcingJobsTable.tenantId, tenantId))).limit(1);
  return job;
}


type MultiParams = Extract<z.infer<typeof jobSchema>, { type: "multi" }>["params"];
type SourceName = MultiParams["sources"][number];

// Rapprochement conservateur entre sources : SIREN/SIRET vérifiés ou
// nom + rue + code postal identiques après normalisation typographique.
// Deux SIREN contradictoires ne doivent jamais être réunis par adresse.
function normalizedIdentity(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]/g, "");
}
function normalizedStreet(candidate: SearchCandidate): string | null {
  if (!candidate.address || !/^\d{5}$/.test(candidate.codePostal)) return null;
  const beforePostal = candidate.address
    .replace(/\s*Voir (?:le plan|l'itinéraire).*$/i, "")
    .split(candidate.codePostal)[0];
  // Une adresse légale peut commencer par un complément :
  // "MAISON 10 95 RUE DE L'EPEULE" doit se comparer à "95 rue Epeule".
  // Le numéro est obligatoirement suivi d'un type de voie.
  const road = beforePostal.match(/(?:^|\s)(\d{1,4}[a-z]?)\s+(rue|r|avenue|av|boulevard|bd|place|pl|route|rte|chemin|che|impasse|imp|allée|allee|quai)\.?\s+(.+)$/i);
  if (!road) return null;
  const typeAliases: Record<string,string> = {
    r:"rue",av:"avenue",bd:"boulevard",pl:"place",rte:"route",
    che:"chemin",imp:"impasse",allee:"allée",
  };
  const type = normalizedIdentity(typeAliases[road[2].toLowerCase()] || road[2]);
  const streetTokens = road[3].normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/);
  const articles = new Set(["de","du","des","la","le","les","l","d"]);
  const street = streetTokens.filter(token => !articles.has(token))
    .map(token => token === "st" ? "saint" : token === "ste" ? "sainte" : token)
    .join("");
  return street.length >= 4 ? normalizedIdentity(road[1]) + "|" + type + "|" + street : null;
}
function businessNamesMatch(a: string, b: string): boolean {
  // Un nom d'usage officiel peut être indiqué entre parenthèses :
  // "OULAID BEN BOUDINA (BEN PLOMBIER)" et "Ben Plombier".
  // Aucun rapprochement par sous-chaîne approximative ou mot-clé générique.
  const names = (label: string) => {
    const variants = [normalizedIdentity(label)];
    for (const match of label.matchAll(/\(([^()]+)\)/g)) {
      const alias = normalizedIdentity(match[1]);
      if (alias.length >= 6) variants.push(alias);
    }
    return variants;
  };
  const left = new Set(names(a));
  return names(b).some(name => name.length >= 6 && left.has(name));
}
function isSameCompany(a: SearchCandidate, b: SearchCandidate): boolean {
  const aSiren = /^\d{9}$/.test(a.siren) ? a.siren : null;
  const bSiren = /^\d{9}$/.test(b.siren) ? b.siren : null;
  if (aSiren && bSiren && aSiren !== bSiren) return false;
  if (a.siret && b.siret && a.siret !== b.siret) return false;
  if (aSiren && bSiren && aSiren === bSiren) return true;
  if (a.siret && b.siret && a.siret === b.siret) return true;
  const aStreet = normalizedStreet(a);
  const bStreet = normalizedStreet(b);
  return Boolean(aStreet && bStreet && aStreet === bStreet
    && a.codePostal === b.codePostal && businessNamesMatch(a.company,b.company));
}
function mergeCompany(target: SearchCandidate, other: SearchCandidate): void {
  target.sources = [...new Set([
    ...(target.sources || (target.source ? [target.source] : [])),
    ...(other.sources || (other.source ? [other.source] : [])),
  ])];
  target.siren ||= other.siren;
  target.siret ||= other.siret;
  target.phone ||= other.phone;
  target.email ||= other.email;
  target.website ||= other.website;
  const matchingActivity = !target.apeCode || !other.apeCode || target.apeCode === other.apeCode;
  target.apeCode ||= other.apeCode;
  if (matchingActivity) {
    target.nafLabel ||= other.nafLabel;
    target.nafVersion ||= other.nafVersion;
  }
  // Une fiche PagesJaunes détaillée doit rester accessible même si Google/Bing
  // a été capturé en premier. Les URLs de toutes les sources restent dans sourceDetails.
  if(other.source==='pagesjaunes' && other.sourceUrl)target.sourceUrl=other.sourceUrl;
  else target.sourceUrl ||= other.sourceUrl;
  target.id ||= other.id;
  target.sourceDetails = { ...(other.sourceDetails || {}), ...(target.sourceDetails || {}) };
}
function candidateKey(c: SearchCandidate): string {
  const normalize = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]/g, "");
  if (/^\d{9}$/.test(c.siren)) return "siren:" + c.siren;
  if (c.siret) return "siret:" + c.siret;
  return "local:" + normalize(c.company) + "|" + normalize(c.address || "") + "|" + c.codePostal;
}

function pagesJaunesLocations(params: MultiParams): string[] {
  const precise = params.codesPostaux.map(cp => cp);
  const departments = params.departements.map(code => DEPARTMENT_NAMES[code] ? DEPARTMENT_NAMES[code] + " (" + code + ")" : code);
  const regions = params.regions.map(code => REGION_NAMES[code] || code);
  // Si un code postal est choisi, les départements/régions sont des filtres supplémentaires, pas des zones à ajouter.
  return [...new Set(precise.length ? precise : departments.length ? departments : regions)];
}

async function runMultiSearch(jobId: string, tenantId: string, params: MultiParams): Promise<void> {
  const began = Date.now();
  const merged = new Map<string, SearchCandidate>();
  const statuses: NonNullable<SavedParams["sourceStatuses"]> = Object.fromEntries(
    params.sources.map(source => [source, { status: "pending", count: 0 }]),
  );
  let done = 0;
  let successes = 0;

  async function persist() {
    const allDone = done === params.sources.length;
    const result = [...merged.values()].slice(0, 50);
    const failed = params.sources.filter(source => statuses[source]?.status === "error");
    await db.update(sourcingJobsTable).set({
      status: allDone ? (successes ? "completed" : "error") : "running",
      count: result.length,
      progress: Math.round(done / params.sources.length * 100),
      params: { ...params, results: result, sourceStatuses: statuses },
      error: allDone && failed.length ? failed.map(source => source + ": " + (statuses[source].error || "Erreur")).join(" | ") : null,
      duration: ((Date.now() - began) / 1000).toFixed(1) + " s",
      updatedAt: new Date(),
    }).where(and(eq(sourcingJobsTable.id, jobId), eq(sourcingJobsTable.tenantId, tenantId)));
  }

  function add(candidate: SearchCandidate, source: SourceName) {
    const key = candidateKey(candidate);
    const previous = merged.get(key) || [...merged.values()].find(current => isSameCompany(current, candidate));
    if (previous) {
      mergeCompany(previous, { ...candidate, source, sources: [source] });
    } else {
      merged.set(key, { ...candidate, source, sources: [source] });
    }
  }
  await persist();

  for (const source of params.sources) {
    statuses[source] = { status: "running", count: 0 };
    await persist();
    try {
      if (source === "entreprises") {
        const candidates = await searchFrenchCompanies(params);
        candidates.forEach(candidate => add(candidate, source));
        statuses[source] = { status: "completed", count: candidates.length };
      } else {
        const locations = pagesJaunesLocations(params);
        const found = new Map<string, SearchCandidate>();
        let attempted = 0;
        for (const location of locations) {
          attempted++;
          // Recherche d'une localité à la fois : pas de concaténation de codes postaux interprétée comme une ville.
          const candidates = await searchPagesJaunes({ query: params.query, location, limit: params.limit });
          for (const candidate of candidates) {
            if (!candidate.codePostal || !matchingGeo({
              code_postal: candidate.codePostal,
            }, params)) continue;
            found.set(candidateKey(candidate), candidate);
            if (found.size >= params.limit) break;
          }
          if (found.size >= params.limit) break;
          statuses[source] = { status: "running", count: found.size, zonesAttempted: attempted, zonesTotal: locations.length };
          await persist();
        }
        [...found.values()].forEach(candidate => add(candidate, source));
        statuses[source] = { status: "completed", count: found.size, zonesAttempted: attempted, zonesTotal: locations.length };
      }
      successes++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Recherche indisponible";
      statuses[source] = { status: "error", error: message };
      logger.warn({ jobId, source, message }, "Sourcing provider failed; other sources continue");
    }
    done++;
    await persist();
  }
}

// Import des résultats collectés dans le Chrome local, après validation côté serveur.
// L'extension n'obtient jamais le JWT : c'est la page GrowthOS authentifiée qui poste les données.
const deviceSources = ['pagesjaunes','google_maps','google_search','bing','linkedin'] as const;
type DeviceSource = typeof deviceSources[number];
function validDeviceSourceUrl(source: DeviceSource, value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    switch (source) {
      case 'pagesjaunes': return ['pagesjaunes.fr','www.pagesjaunes.fr'].includes(host);
      case 'google_maps': return ['www.google.com','maps.google.com','google.com','www.google.fr','google.fr'].includes(host)
        && url.pathname.startsWith('/maps');
      case 'google_search': return ['www.google.com','google.com','www.google.fr','google.fr'].includes(host);
      case 'bing': return ['www.bing.com','bing.com'].includes(host);
      case 'linkedin': return ['www.linkedin.com','linkedin.com'].includes(host)
        && /^\/company\/[a-z0-9_-]+\/?/i.test(url.pathname);
    }
  } catch { return false; }
}
const deviceCandidateSchema = z.object({
  id: z.string().trim().min(3).max(64),
  source: z.enum(deviceSources).default('pagesjaunes'), // compatibilité extension 0.3
  company: z.string().trim().min(2).max(160),
  address: z.string().trim().min(5).max(320),
  codePostal: z.string().regex(/^\d{5}$/),
  city: z.string().trim().max(120).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  website: z.string().url().max(500).refine(url=>['https:','http:'].includes(new URL(url).protocol)).nullable().optional(),
  sourceUrl: z.string().url().max(500).nullable().optional(),
  siret: z.string().regex(/^\d{14}$/).nullable().optional(),
  collectionMode: z.enum(['manual','visible']).optional(),
  capturedAt: z.number().int().positive().optional(),
}).strict().superRefine((item, context) => {
  if (item.sourceUrl ? !validDeviceSourceUrl(item.source,item.sourceUrl) : item.source!=='pagesjaunes') {
    context.addIssue({code:'custom',path:['sourceUrl'],message:'URL de source obligatoire et conforme à la source'});
  }
  if (!item.address.includes(item.codePostal)) {
    context.addIssue({code:'custom',path:['address'],message:'Adresse et code postal incohérents'});
  }
  if (item.source==='linkedin' && item.collectionMode!=='manual') {
    context.addIssue({code:'custom',path:['collectionMode'],message:'LinkedIn : saisie manuelle uniquement'});
  }
});
// Une fiche incomplète n'est JAMAIS considérée comme une entreprise importable.
// Seul un rapprochement unique à une adresse vérifiée permet de la promouvoir.
const deviceDraftSchema = z.object({
  id: z.string().trim().min(3).max(64),
  source: z.enum(['google_maps','google_search','bing']),
  company: z.string().trim().min(2).max(160),
  address: z.string().trim().max(320).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  website: z.string().url().max(500).refine(v=>['https:','http:'].includes(new URL(v).protocol)).nullable().optional(),
  sourceUrl: z.string().url().max(500),
  capturedAt: z.number().int().positive(),
}).strict().superRefine((item, context)=>{
  if(!validDeviceSourceUrl(item.source,item.sourceUrl))
    context.addIssue({code:'custom',path:['sourceUrl'],message:'Source du brouillon invalide'});
  if(item.capturedAt>Date.now()+60000 || Date.now()-item.capturedAt>24*60*60*1000)
    context.addIssue({code:'custom',path:['capturedAt'],message:'Brouillon expiré (24 h)'});
});
type DeviceDraft = z.infer<typeof deviceDraftSchema>;
const deviceDraftsSchema = z.array(deviceDraftSchema).max(75);

type ImportCapture = {
  id:string;source:string;company:string;address?:string|null;codePostal?:string|null;
  city?:string|null;phone?:string|null;email?:string|null;website?:string|null;siret?:string|null;
  siren?:string|null;sourceUrl?:string|null;capturedAt?:number;
  apeCode?:string|null;nafLabel?:string|null;nafVersion?:string|null;
  sourceDetails?:Record<string,unknown>|null;
};
type EnrichmentField = 'address'|'postalCode'|'city'|'phone'|'email'|'website'|'siret'|'siren'|'apeCode'|'nafLabel'|'nafVersion';
type EnrichmentConflict = {
  id:string;field:EnrichmentField;existing:string;incoming:string;
  source:string;sourceUrl:string|null;capturedAt:string;
};
const FIELDS:EnrichmentField[]=['address','postalCode','city','phone','email','website','siret','siren','apeCode','nafLabel','nafVersion'];
const stringOrEmpty=(value:unknown)=>typeof value==='string'?value.trim():'';
function normalizedField(field:EnrichmentField,value:unknown):string{
  const raw=stringOrEmpty(value);
  if(field==='phone')return normalizedPhone(raw);
  if(field==='website'){
    try{const u=new URL(raw);return u.hostname.replace(/^www\./,'').toLowerCase()+u.pathname.replace(/\/$/,'').toLowerCase();}
    catch{return raw.toLowerCase();}
  }
  return normalizedIdentity(raw);
}
function jsonRecord(value:unknown):Record<string,unknown>{
  return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
}
function captureProfileUrl(value:string|null|undefined):string|null{
  try{
    const url=new URL(value||'');
    return /^\/maps\/place\//.test(url.pathname) || /^\/company\/[a-z0-9_-]+\/?$/i.test(url.pathname)
      || (['pagesjaunes.fr','www.pagesjaunes.fr'].includes(url.hostname)&&/^\/pros\/\d{4,20}\/?$/.test(url.pathname))
      ? url.href:null;
  }catch{return null;}
}
function incomingFields(item:ImportCapture,incomplete:boolean):Partial<Record<EnrichmentField,string>>{
  const fields:Partial<Record<EnrichmentField,string>>={};
  for(const field of ['address','city','phone','email','website'] as const){
    const value=stringOrEmpty(item[field]);if(value)fields[field]=value;
  }
  if(!incomplete){
    if(item.codePostal)fields.postalCode=item.codePostal;
    if(item.siret){fields.siret=item.siret;fields.siren=item.siren||item.siret.slice(0,9);}
    else if(item.siren)fields.siren=item.siren;
    if(/^\d{2}\.\d{2}[A-Z]$/.test(item.apeCode||'')){
      fields.apeCode=item.apeCode!;
      if(item.nafLabel)fields.nafLabel=item.nafLabel;
      if(item.nafVersion)fields.nafVersion=item.nafVersion;
    }
  }
  return fields;
}
function sameEstablishment(record:{company:string|null;address:string|null;city:string|null;
  phone:string|null;website:string|null;siret:string|null;sourceUrl:string|null},
  incoming:ImportCapture,incomplete:boolean):boolean{
  const siret=!incomplete?incoming.siret:null;
  if(siret&&record.siret&&record.siret!==siret)return false; // Deux identités juridiques contradictoires.
  if(siret&&record.siret===siret)return true;
  const profile=captureProfileUrl(incoming.sourceUrl);
  if(profile&&record.sourceUrl===profile)return true;
  if(normalizedIdentity(record.company||'')!==normalizedIdentity(incoming.company))return false;
  const city=normalizedIdentity(incoming.city||''),recordCity=normalizedIdentity(record.city||'');
  if(city&&recordCity&&city!==recordCity)return false;
  const address=normalizedIdentity(incoming.address||'');
  if(address.length>=9 && address===normalizedIdentity(record.address||''))return true;
  const phone=normalizedPhone(incoming.phone);
  if(phone.length>=9&&phone===normalizedPhone(record.phone)&&city&&recordCity&&city===recordCity)return true;
  // Un site web peut être commun à toutes les agences d'un réseau : jamais une preuve d'identité seule.
  return false;
}
async function mergeProspectCapture(
  existing:typeof prospectsTable.$inferSelect,item:ImportCapture,incomplete:boolean,
  tenantId:string,
):Promise<{updated:boolean;filled:string[];conflicts:number;newConflicts:EnrichmentConflict[]}>{
  const oldDetails=jsonRecord(existing.sourceDetails);
  const oldMerge=jsonRecord(oldDetails.crossSource);
  const oldConflicts=Array.isArray(oldMerge.conflicts)
    ? oldMerge.conflicts as EnrichmentConflict[]:[];
  const priorResolutions=Array.isArray(oldMerge.resolutions)
    ? oldMerge.resolutions as Array<EnrichmentConflict & {decision:string}>:[];
  const oldObservations=Array.isArray(oldMerge.observations)
    ? oldMerge.observations as Array<{captureId:string;source:string;sourceUrl:string|null;capturedAt:string;
      fieldsFilled?:string[]}>:[];
  const fieldSources=jsonRecord(oldMerge.fieldSources);
  const updates:Partial<Record<EnrichmentField,string>>={};
  const filled:string[]=[],newConflicts:EnrichmentConflict[]=[];
  const now=new Date(item.capturedAt||Date.now()).toISOString();
  const fields=incomingFields(item,incomplete);
  for(const field of FIELDS){
    const incoming=fields[field];if(!incoming)continue;
    const current=stringOrEmpty(existing[field]);
    if(!current){
      updates[field]=incoming;filled.push(field);
      fieldSources[field]={source:item.source,sourceUrl:item.sourceUrl,capturedAt:now};
    }else if(normalizedField(field,current)!==normalizedField(field,incoming)){
      const repeated=[...oldConflicts,...priorResolutions].some(c=>c.field===field&&c.incoming===incoming&&
        c.existing===current&&c.source===item.source);
      if(!repeated)newConflicts.push({id:randomUUID(),field,existing:current,incoming,
        source:item.source,sourceUrl:item.sourceUrl||null,capturedAt:now});
    }
  }
  const alreadyObserved=oldObservations.some(o=>o.captureId===item.id);
  const sources=new Set(String(existing.source||'').split(',').map(x=>x.trim()).filter(Boolean));
  const incomingSources=item.source.split(',').map(s=>s.trim()).filter(Boolean);
  const sourceAdded=incomingSources.some(source=>!sources.has(source));
  for(const source of incomingSources)sources.add(source);
  if(!filled.length&&!newConflicts.length&&!sourceAdded&&alreadyObserved)
    return {updated:false,filled,conflicts:0,newConflicts:[]};
  const observation={captureId:item.id,source:item.source,sourceUrl:item.sourceUrl||null,
    capturedAt:now,fieldsFilled:filled};
  const incomingDetails=jsonRecord(item.sourceDetails);
  const combinedDetails={...oldDetails};
  for(const [source,details] of Object.entries(incomingDetails)){
    if(!(source in combinedDetails))combinedDetails[source]=details;
    else if(details&&typeof details==='object'&&!Array.isArray(details)){
      const oldSource=jsonRecord(combinedDetails[source]);
      const merged={...oldSource};
      for(const [key,value] of Object.entries(jsonRecord(details)))
        if(merged[key]==null||merged[key]==='')merged[key]=value;
      combinedDetails[source]=merged;
    }
  }
  const updatedDetails={...combinedDetails,crossSource:{...oldMerge,
    fieldSources,
    observations:(alreadyObserved?oldObservations:[...oldObservations,observation]).slice(-60),
    conflicts:[...oldConflicts,...newConflicts].slice(-60),
  }};
  await db.update(prospectsTable).set({
    ...updates,
    source:[...sources].join(','),
    sourceUrl:existing.sourceUrl||captureProfileUrl(item.sourceUrl),
    sourceDetails:updatedDetails,updatedAt:new Date(),
  }).where(and(eq(prospectsTable.id,existing.id),eq(prospectsTable.tenantId,tenantId)));
  return {updated:true,filled,conflicts:newConflicts.length,newConflicts};
}

// Entrée directe des captures de l'extension vers Prospects, sans job sourcing.
// Aucun identifiant, code postal ou adresse n'est déduit d'une requête Google.
router.post('/device/import-prospects',requireAuth,async(req,res)=>{
  const parsed=z.object({
    verified:z.array(deviceCandidateSchema).max(25).default([]),
    drafts:z.array(deviceDraftSchema).max(25).default([]),
  }).strict().refine(data=>data.verified.length+data.drafts.length>0 &&
    data.verified.length+data.drafts.length<=25).safeParse(req.body);
  if(!parsed.success){res.status(400).json({error:'Sélection invalide (25 fiches maximum)',details:parsed.error.issues});return;}
  let imported=0,enriched=0,skipped=0,conflicts=0;
  const reviews:{prospectId:string;company:string;fields:string[];type:'conflict'|'ambiguous'}[]=[];
  const processedIds:string[]=[];
  const usedIds=new Set<string>();
  for(const entry of [...parsed.data.verified.map(value=>({item:value,incomplete:false})),
    ...parsed.data.drafts.map(value=>({item:value,incomplete:true}))]){
    const {item,incomplete}=entry;
    if(usedIds.has(item.id)){skipped++;continue;}
    usedIds.add(item.id);
    const company=normalizedIdentity(item.company);
    const phone=normalizedPhone(item.phone);
    const address=normalizedIdentity(item.address||'');
    const city=normalizedIdentity(item.city||'');
    const website=String(item.website||'').toLowerCase();
    if(incomplete && !phone && !website && !address){skipped++;continue;}
    const siret=!incomplete && 'siret' in item ? item.siret : null;
    const profileUrl=captureProfileUrl(item.sourceUrl);
    const where=[ilike(prospectsTable.company,item.company)];
    if(siret)where.push(eq(prospectsTable.siret,siret));
    if(profileUrl)where.push(eq(prospectsTable.sourceUrl,profileUrl));
    const prior=await db.select().from(prospectsTable).where(and(
      eq(prospectsTable.tenantId,req.auth!.tenantId),or(...where),
    )).limit(100);
    const matches=prior.filter(record=>sameEstablishment(record,item,incomplete));
    if(matches.length>1){
      skipped++;reviews.push({prospectId:'',company:item.company,fields:[],type:'ambiguous'});continue;
    }
    if(matches.length===1){
      const merged=await mergeProspectCapture(matches[0],item,incomplete,req.auth!.tenantId);
      if(merged.filled.length)enriched++;else skipped++;
      conflicts+=merged.conflicts;
      if(merged.newConflicts.length)reviews.push({prospectId:matches[0].id,company:item.company,
        fields:merged.newConflicts.map(c=>c.field),type:'conflict'});
      processedIds.push(item.id);continue;
    }
    const [created]=await db.insert(prospectsTable).values({
      company:item.company,address:item.address||null,
      postalCode:!incomplete && 'codePostal' in item ? item.codePostal : null,
      city:item.city||null,phone:item.phone||null,website:item.website||null,
      email:null,siren:null,siret:siret||null,
      source:item.source,sourceUrl:profileUrl,
      sourceDetails:{browserCapture:{source:item.source,sourceUrl:item.sourceUrl,
        incomplete,capturedAt:new Date(item.capturedAt||Date.now()).toISOString(),
        postalCodeVerified:!incomplete,localCaptureId:item.id},
        ...(incomplete?{browserDraft:{incomplete:true,source:item.source,
          sourceUrl:item.sourceUrl,postalCodeVerified:false}}:{}),
        crossSource:{fieldSources:Object.fromEntries(Object.keys(incomingFields(item,incomplete))
          .map(field=>[field,{source:item.source,sourceUrl:item.sourceUrl||null,
            capturedAt:new Date(item.capturedAt||Date.now()).toISOString()}])),
          observations:[{captureId:item.id,source:item.source,sourceUrl:item.sourceUrl||null,
            capturedAt:new Date(item.capturedAt||Date.now()).toISOString(),
            fieldsFilled:Object.keys(incomingFields(item,incomplete))}],conflicts:[]}},
      status:'new',tenantId:req.auth!.tenantId,createdBy:req.auth!.userId,
    }).onConflictDoNothing().returning({id:prospectsTable.id});
    if(created){imported++;processedIds.push(item.id);}else skipped++;
  }
  res.json({imported,enriched,skipped,conflicts,reviews,selected:usedIds.size,processedIds});
});

// Chaque désaccord reste en attente jusqu'au choix explicite d'un utilisateur du tenant.
router.post('/device/prospects/:id/resolve-conflict',requireAuth,async(req,res)=>{
  const parsed=z.object({conflictId:z.string().uuid(),decision:z.enum(['keep_existing','use_incoming'])})
    .strict().safeParse(req.body);
  if(!parsed.success){res.status(400).json({error:'Décision de fusion invalide'});return;}
  const [prospect]=await db.select().from(prospectsTable).where(and(
    eq(prospectsTable.id,String(req.params.id)),eq(prospectsTable.tenantId,req.auth!.tenantId),
  )).limit(1);
  if(!prospect){res.status(404).json({error:'Prospect introuvable'});return;}
  const details=jsonRecord(prospect.sourceDetails),crossSource=jsonRecord(details.crossSource);
  const conflicts=Array.isArray(crossSource.conflicts)?crossSource.conflicts as EnrichmentConflict[]:[];
  const found=conflicts.find(c=>c.id===parsed.data.conflictId&&FIELDS.includes(c.field));
  if(!found){res.status(404).json({error:'Conflit déjà résolu ou introuvable'});return;}
  if(stringOrEmpty(prospect[found.field])!==found.existing){
    res.status(409).json({error:'La valeur CRM a changé. Rechargez la fiche avant de trancher.'});return;
  }
  const fieldSources=jsonRecord(crossSource.fieldSources);
  if(parsed.data.decision==='use_incoming')
    fieldSources[found.field]={source:found.source,sourceUrl:found.sourceUrl,capturedAt:found.capturedAt,
      resolvedAt:new Date().toISOString()};
  const resolutions=Array.isArray(crossSource.resolutions)?crossSource.resolutions as unknown[]:[];
  const nextDetails={...details,crossSource:{...crossSource,fieldSources,
    conflicts:conflicts.filter(c=>c.id!==found.id),
    resolutions:[...resolutions,{...found,decision:parsed.data.decision,
      resolvedAt:new Date().toISOString()}].slice(-80)}};
  const update=parsed.data.decision==='use_incoming'?{[found.field]:found.incoming}:{};
  const [updated]=await db.update(prospectsTable).set({...update,sourceDetails:nextDetails,
    updatedAt:new Date()}).where(and(eq(prospectsTable.id,prospect.id),
    eq(prospectsTable.tenantId,req.auth!.tenantId))).returning();
  res.json({prospect:updated});
});

const distinctiveDraft = (company: string) => {
  const label=normalizedIdentity(company);
  return label.length>=7 && !new Set([
    'plombier','plomberie','chauffagiste','restaurant','electricien','entreprise',
    'artisan','boulangerie','serrurier','depannage','services',
  ]).has(label);
};
const normalizedPhone = (value: string | null | undefined) => {
  const digits=String(value||'').replace(/\D/g,'');
  return digits.startsWith('33') && digits.length===11 ? '0'+digits.slice(2) : digits;
};
function draftCityMatches(draft: DeviceDraft, candidate: SearchCandidate): boolean {
  // Une fiche Google géolocalisée à Paris ne peut pas être rapprochée d'un
  // établissement lillois simplement parce que leur enseigne est identique.
  return !draft.city || !candidate.city || normalizedIdentity(draft.city)===normalizedIdentity(candidate.city);
}
function attachVerifiedDraft(target: SearchCandidate, draft: DeviceDraft, method: string): void {
  const sourceDetails={
    [draft.source]: {sourceUrl:draft.sourceUrl,collectionMode:'browser-visible',
      matchedBy:method,capturedAt:new Date(draft.capturedAt).toISOString()},
  };
  mergeCompany(target,{
    id:draft.id,source:draft.source,sources:[draft.source],siren:'',siret:null,
    company:draft.company,address:target.address,codePostal:target.codePostal,city:target.city,
    phone:draft.phone||null,website:draft.website||null,sourceUrl:draft.sourceUrl,
    sourceDetails,
  });
}
async function enrichDeviceDrafts(drafts: DeviceDraft[], params: GeoFilters,
  seen: Map<string, SearchCandidate>) {
  const pendingItems: {id:string;company:string;source:string;reason:string}[]=[];
  const already=new Set<string>();
  let matched=0;
  const toLookup:DeviceDraft[]=[];
  for(const draft of drafts){
    const key=draft.source+'|'+normalizedIdentity(draft.company)+'|'+draft.sourceUrl;
    if(already.has(key))continue;
    already.add(key);
    if(!distinctiveDraft(draft.company)){
      pendingItems.push({id:draft.id,company:draft.company,source:draft.source,reason:'Nom trop générique pour une identification fiable'});continue;
    }
    const localMatches=[...seen.values()].filter(candidate=>
      candidate.address && draftCityMatches(draft,candidate) && businessNamesMatch(candidate.company,draft.company) &&
      draft.phone && candidate.phone && normalizedPhone(candidate.phone)===normalizedPhone(draft.phone));
    // Sans adresse Google, même nom + ville n'est pas une preuve d'identité.
    // Le rapprochement local exige aussi un numéro de téléphone identique.
    if(localMatches.length===1){attachVerifiedDraft(localMatches[0],draft,'verified-local-phone-and-name');matched++;continue;}
    if(localMatches.length>1){
      pendingItems.push({id:draft.id,company:draft.company,source:draft.source,reason:'Plusieurs établissements locaux portent ce nom'});continue;
    }
    toLookup.push(draft);
  }
  const started=Date.now();
  for(let i=0;i<toLookup.length;i+=2){
    if(Date.now()-started>25000){
      for(const draft of toLookup.slice(i))pendingItems.push({id:draft.id,company:draft.company,source:draft.source,reason:'Limite de temps atteinte ; relancez l’enrichissement'});
      break;
    }
    const batch=toLookup.slice(i,i+2);
    const found=await Promise.all(batch.map(async draft=>{
      try {return {draft,candidates:await searchFrenchCompanies({...params,query:draft.company,limit:25},5000)};}
      catch(error){return {draft,candidates:[] as SearchCandidate[],error:error instanceof Error?error.message:'Annuaire indisponible'};}
    }));
    for(const item of found){
      const {draft}=item;
      if('error' in item){
        pendingItems.push({id:draft.id,company:draft.company,source:draft.source,reason:`Annuaire indisponible : ${item.error}`});continue;
      }
      const exact=item.candidates.filter(candidate=>businessNamesMatch(candidate.company,draft.company)
        && draftCityMatches(draft,candidate));
      // Les homonymes sont laissés à vérifier, sans supposer un CP depuis la recherche.
      if(exact.length!==1 || !exact[0].address || item.candidates.length>=25){
        pendingItems.push({id:draft.id,company:draft.company,source:draft.source,
          reason:exact.length>1||item.candidates.length>=25?'Correspondances officielles potentiellement multiples':'Aucune adresse officielle unique vérifiée'});continue;
      }
      const verified=exact[0];
      const prior=[...seen.values()].find(candidate=>isSameCompany(candidate,verified));
      const target=prior||{...verified,source:'entreprises' as const,sources:['entreprises']};
      if(!prior)seen.set(candidateKey(target),target);
      attachVerifiedDraft(target,draft,'official-directory-exact-name');matched++;
    }
    // L'annuaire public limite les requêtes par IP ; au plus deux par demi-seconde.
    if(i+2<toLookup.length)await new Promise(resolve=>setTimeout(resolve,500));
  }
  return {checked:already.size,matched,pending:pendingItems.length,
    pendingItems:pendingItems.slice(0,75),updatedAt:new Date().toISOString()};
}
const deviceSearchSchema = z.object({
  name: z.string().trim().min(1).max(120),
  params: z.object({
    sources: z.array(z.enum(['entreprises',...deviceSources])).min(1).max(6)
      .refine(items => items.some(source=>source!=='entreprises') && new Set(items).size === items.length),
    query: z.string().trim().min(3).max(120),
    regions: z.array(z.string().regex(/^\d{2}$/)).max(18).default([]),
    departements: z.array(z.string().regex(/^(?:\d{2}|2A|2B|97\d)$/)).max(101).default([]),
    codesPostaux: z.array(z.string().regex(/^\d{5}$/)).max(25).default([]),
    limit: z.coerce.number().int().min(1).max(25).default(10),
  }).refine(p => p.regions.length + p.departements.length + p.codesPostaux.length > 0),
  candidates: z.array(deviceCandidateSchema).max(125),
  drafts: deviceDraftsSchema.optional().default([]),
  sourceErrors: z.record(z.string(),z.string().trim().min(1).max(200)).optional(),
}).strict().superRefine((item,context)=>{
  for(const candidate of item.candidates)if(!item.params.sources.includes(candidate.source)){
    context.addIssue({code:'custom',path:['candidates'],message:'Candidat issu d’une source non sélectionnée'});
    break;
  }
  if(item.drafts.some(draft=>!item.params.sources.includes(draft.source))){
    context.addIssue({code:'custom',path:['drafts'],message:'Brouillon issu d’une source non sélectionnée'});
  }
  if(Object.keys(item.sourceErrors||{}).some(source=>!item.params.sources.some(selected=>selected===source))){
    context.addIssue({code:'custom',path:['sourceErrors'],message:'Erreur associée à une source non sélectionnée'});
  }
});

router.post("/device/jobs", requireAuth, async (req, res) => {
  const parsed = deviceSearchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Résultats locaux invalides", details: parsed.error.issues }); return;
  }
  const { name, params, candidates, drafts, sourceErrors } = parsed.data;
  const seen = new Map<string, SearchCandidate>();
  const counts: Record<string, number> = {};
  for (const item of candidates) {
    if (!matchingGeo({ code_postal: item.codePostal }, params)) continue;
    if((counts[item.source]||0)>=params.limit)continue;
    const candidate: SearchCandidate = {
      ...item, siren: item.siret?.slice(0, 9) || "", siret: item.siret || null,
      city: item.city || null, phone: item.phone || null,
      website: item.website || null, sourceUrl: item.sourceUrl || null,
      source: item.source, sources: [item.source],
      sourceDetails: {[item.source]: {
        sourceUrl:item.sourceUrl || null,
        collectionMode:item.collectionMode || (item.source==='pagesjaunes'?'browser':'visible'),
        capturedAt:new Date().toISOString(),
      }},
    };
    const key = candidateKey(candidate);
    const prior = seen.get(key) || [...seen.values()].find(previous=>isSameCompany(previous,candidate));
    if(prior && prior.sources?.includes(item.source))continue;
    if(prior)mergeCompany(prior,candidate);
    else seen.set(key,candidate);
    counts[item.source]=(counts[item.source]||0)+1;
  }
  const sourceStatuses: NonNullable<SavedParams["sourceStatuses"]> = {};
  for(const source of params.sources.filter(source=>source!=='entreprises')){
    const failure=sourceErrors?.[source];
    sourceStatuses[source] = {status:failure?'error':(counts[source] || source==='pagesjaunes'?'completed':'pending'),
      count:counts[source]||0,...(failure?{error:failure}:{})};
  }
  let error: string | null = Object.entries(sourceErrors||{}).filter(([source])=>params.sources.some(selected=>selected===source))
    .map(([source,reason])=>`${source}: ${reason}`).join(' | ') || null;
  if (params.sources.includes("entreprises")) {
    try {
      const official = await searchFrenchCompanies(params);
      sourceStatuses.entreprises = { status: "completed", count: official.length };
      for (const record of official) {
        const key = candidateKey(record);
        const prior = seen.get(key) || [...seen.values()].find(candidate => isSameCompany(candidate, record));
        if (prior) {
          mergeCompany(prior, { ...record, source: "entreprises", sources: ["entreprises"] });
        } else {
          seen.set(key, { ...record, source: "entreprises", sources: ["entreprises"] });
        }
      }
    } catch (cause) {
      const issue = cause instanceof Error ? cause.message : "Annuaire indisponible";
      error = [error,issue].filter(Boolean).join(' | ');
      sourceStatuses.entreprises = { status: "error", error:issue };
    }
  }
  const draftEnrichment=drafts.length ? await enrichDeviceDrafts(drafts,params,seen) : undefined;
  const pendingIds=new Set((draftEnrichment?.pendingItems||[]).map(item=>item.id));
  for(const source of params.sources.filter(source=>source!=='entreprises')){
    const verified=[...seen.values()].filter(candidate=>candidate.sources?.includes(source));
    if(verified.length && sourceStatuses[source]?.status!=='error')
      sourceStatuses[source]={status:'completed',count:verified.length};
    else if(drafts.some(draft=>draft.source===source) && sourceStatuses[source]?.status==='pending')
      sourceStatuses[source]={status:'incomplete',count:0};
  }
  const results = [...seen.values()].slice(0, 150);
  const [job] = await db.insert(sourcingJobsTable).values({
    type: "multi", name, tenantId: req.auth!.tenantId, createdBy: req.auth!.userId,
    status: "completed", count: results.length, progress: 100,
    params: { ...params, results, sourceStatuses, draftEnrichment,
      deviceDrafts:drafts.filter(draft=>pendingIds.has(draft.id)),draftImports:{},collectionMode: "device" },
    duration: "Navigateur local", error,
  }).returning();
  res.status(201).json(job);
});

// Réessayer un lot depuis le navigateur actuel, sans réimporter les fiches en CRM.
router.post('/device/jobs/:id/enrich-drafts',requireAuth,async(req,res)=>{
  const parsed=deviceDraftsSchema.safeParse(req.body?.drafts);
  if(!parsed.success){res.status(400).json({error:'Brouillons locaux invalides',details:parsed.error.issues});return;}
  const job=await getJob(String(req.params.id),req.auth!.tenantId);
  if(!job){res.status(404).json({error:'Recherche introuvable'});return;}
  const prior=savedParams(job);
  if(job.type!=='multi' || (prior as SavedParams & {collectionMode?:string}).collectionMode!=='device'
    || !Array.isArray(prior.results) || job.status!=='completed'){
    res.status(409).json({error:'Cette recherche ne prend pas en charge le connecteur local'});return;
  }
  const sources=prior.sources||[];
  if(parsed.data.some(draft=>!sources.includes(draft.source))){
    res.status(400).json({error:'Source non sélectionnée pour cette recherche'});return;
  }
  const params={query:prior.query||'',regions:prior.regions||[],departements:prior.departements||[],
    codesPostaux:prior.codesPostaux||[],limit:prior.limit||10};
  const seen=new Map<string,SearchCandidate>(prior.results.map(candidate=>[candidateKey(candidate),candidate]));
  const allDrafts=[...(prior.deviceDrafts||[]),...parsed.data]
    .filter((draft,index,items)=>items.findIndex(item=>item.id===draft.id)===index).slice(0,75);
  const draftEnrichment=await enrichDeviceDrafts(allDrafts,params,seen);
  const pendingIds=new Set(draftEnrichment.pendingItems.map(item=>item.id));
  const results=[...seen.values()].slice(0,150);
  const sourceStatuses={...(prior.sourceStatuses||{})};
  for(const source of sources.filter(item=>item!=='entreprises')){
    const count=results.filter(item=>item.sources?.includes(source)).length;
    if(count && sourceStatuses[source]?.status!=='error')sourceStatuses[source]={status:'completed',count};
    else if(parsed.data.some(draft=>draft.source===source) && sourceStatuses[source]?.status==='pending')
      sourceStatuses[source]={status:'incomplete',count:0};
  }
  const [updated]=await db.update(sourcingJobsTable).set({count:results.length,
    params:{...prior,results,sourceStatuses,draftEnrichment,
      deviceDrafts:allDrafts.filter(draft=>pendingIds.has(draft.id)||prior.draftImports?.[draft.id])},
  }).where(and(eq(sourcingJobsTable.id,job.id),eq(sourcingJobsTable.tenantId,req.auth!.tenantId))).returning();
  res.json({job:updated,enrichment:draftEnrichment});
});

// L'utilisateur peut choisir de conserver une piste commerciale même sans
// adresse : import explicite et traçable, jamais une preuve SIRET/SIREN ni CP.
router.post('/device/jobs/:id/import-drafts',requireAuth,async(req,res)=>{
  const parsed=z.object({ids:z.array(z.string().trim().min(3).max(64)).min(1).max(25)})
    .strict().safeParse(req.body);
  if(!parsed.success || new Set(parsed.data?.ids||[]).size!==parsed.data?.ids.length){
    res.status(400).json({error:'Sélection de fiches incomplètes invalide'});return;
  }
  const job=await getJob(String(req.params.id),req.auth!.tenantId);
  if(!job){res.status(404).json({error:'Recherche introuvable'});return;}
  const saved=savedParams(job);
  if(job.status!=='completed' ||
     (saved as SavedParams & {collectionMode?:string}).collectionMode!=='device' ||
     !Array.isArray(saved.deviceDrafts)){
    res.status(409).json({error:'Cette recherche ne permet pas l’import de fiches incomplètes'});return;
  }
  const pending=new Set((saved.draftEnrichment?.pendingItems||[]).map(item=>item.id));
  const selected=parsed.data.ids.map(id=>saved.deviceDrafts!.find(draft=>draft.id===id));
  if(selected.some(draft=>!draft || !pending.has(draft.id) || !saved.sources?.includes(draft.source))){
    res.status(400).json({error:'Une fiche est absente, enrichie ou issue d’une source non sélectionnée'});return;
  }
  let imported=0,skipped=0;
  const draftImports={...(saved.draftImports||{})};
  for(const draft of selected as DeviceDraft[]){
    if(draftImports[draft.id]){skipped++;continue;}
    const phone=normalizedPhone(draft.phone);
    const company=normalizedIdentity(draft.company);
    const city=normalizedIdentity(draft.city||'');
    const website=String(draft.website||'').toLowerCase();
    const partialAddress=normalizedIdentity(draft.address||'');
    // Au moins une coordonnée ou rue réellement relevée, afin d'éviter des
    // imports de simples mots-clés de recherche sans entreprise identifiable.
    if(!phone&&!website&&!partialAddress){skipped++;continue;}
    const existing=await db.select({id:prospectsTable.id,company:prospectsTable.company,
      phone:prospectsTable.phone,city:prospectsTable.city,website:prospectsTable.website,
      address:prospectsTable.address}).from(prospectsTable).where(and(
      eq(prospectsTable.tenantId,req.auth!.tenantId),eq(prospectsTable.company,draft.company)
    )).limit(60);
    const duplicate=existing.find(record=>normalizedIdentity(record.company||'')===company &&
      normalizedIdentity(record.city||'')===city && (
        (phone && normalizedPhone(record.phone)===phone) ||
        (website && String(record.website||'').toLowerCase()===website) ||
        (partialAddress && normalizedIdentity(record.address||'')===partialAddress)
      ));
    if(duplicate){draftImports[draft.id]=duplicate.id;skipped++;continue;}
    const url=(()=>{try{
      const parsed=new URL(draft.sourceUrl);
      return /^\/maps\/place\//.test(parsed.pathname)?draft.sourceUrl:null;
    }catch{return null;}})();
    const [created]=await db.insert(prospectsTable).values({
      siren:null,siret:null,company:draft.company,
      address:draft.address||null,postalCode:null,city:draft.city||null,
      phone:draft.phone||null,email:null,website:draft.website||null,
      source:draft.source,sourceUrl:url,status:'new',
      sourceDetails:{browserDraft:{incomplete:true,source:draft.source,
        sourceUrl:draft.sourceUrl,capturedAt:new Date(draft.capturedAt).toISOString(),
        draftId:draft.id,jobId:job.id,postalCodeVerified:false}},
      tenantId:req.auth!.tenantId,createdBy:req.auth!.userId,
    }).onConflictDoNothing().returning({id:prospectsTable.id});
    if(created){draftImports[draft.id]=created.id;imported++;}else skipped++;
  }
  await db.update(sourcingJobsTable).set({params:{...saved,draftImports},updatedAt:new Date()})
    .where(and(eq(sourcingJobsTable.id,job.id),eq(sourcingJobsTable.tenantId,req.auth!.tenantId)));
  res.json({imported,skipped,selected:selected.length});
});


const pagesJaunesProfileUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && ["pagesjaunes.fr", "www.pagesjaunes.fr"].includes(parsed.hostname)
      && /^\/pros\/\d{4,20}\/?$/.test(parsed.pathname);
  } catch { return false; }
};
const profileUrl = z.string().max(500).url().refine(pagesJaunesProfileUrl, "Fiche PagesJaunes attendue");
const profileSchema = z.object({
  sourceUrl: profileUrl,
  name: z.string().trim().min(2).max(160),
  address: z.string().trim().max(320).nullable(),
  codePostal: z.string().regex(/^\d{5}$/).nullable(),
  city: z.string().trim().max(120).nullable(),
  phone: z.string().trim().max(40).nullable(),
  email: z.string().email().max(250).nullable(),
  website: z.string().url().max(500).refine(v => ["https:", "http:"].includes(new URL(v).protocol)).nullable(),
  siret: z.string().regex(/^\d{14}$/).nullable(),
  siren: z.string().regex(/^\d{9}$/).nullable(),
  description: z.string().trim().max(1500).nullable(),
  openingHours: z.string().trim().max(1500).nullable(),
  services: z.string().trim().max(1400).nullable(),
  legal: z.string().trim().max(1500).nullable(),
  socials: z.object({
    facebook: z.string().url().max(500).optional(),
    instagram: z.string().url().max(500).optional(),
    linkedin: z.string().url().max(500).optional(),
  }).strict(),
  rating: z.number().min(0).max(5).nullable(),
  reviewCount: z.number().int().min(0).max(1000000).nullable(),
  reviews: z.array(z.object({
    author: z.string().trim().max(100).nullable(),
    date: z.string().trim().max(40).nullable(),
    text: z.string().trim().min(20).max(800),
  }).strict()).max(12).optional().default([]),
  capturedAt: z.string().datetime().optional(),
}).strict();

router.post("/device/prospects/:id/enrich", requireAuth, async (req,res) => {
  const parsed = profileSchema.safeParse(req.body?.profile);
  if (!parsed.success) {res.status(400).json({error:"Détails PagesJaunes invalides",details:parsed.error.issues});return;}
  const [prospect] = await db.select().from(prospectsTable).where(and(
    eq(prospectsTable.id,String(req.params.id)),eq(prospectsTable.tenantId,req.auth!.tenantId)
  )).limit(1);
  if (!prospect) {res.status(404).json({error:"Prospect introuvable"});return;}
  if (!prospect.sourceUrl || !pagesJaunesProfileUrl(prospect.sourceUrl)
    || new URL(prospect.sourceUrl).pathname !== new URL(parsed.data.sourceUrl).pathname) {
    res.status(409).json({error:"Cette fiche ne correspond pas à la source du prospect"});return;
  }
  const profile=parsed.data;
  if (prospect.postalCode && profile.codePostal && prospect.postalCode !== profile.codePostal) {
    res.status(409).json({error:"Le code postal de la fiche source ne correspond pas au prospect"});return;
  }
  const cleanCity = (v: string | null) => v?.replace(/\s*Voir (?:le plan|l'itinéraire).*$/i,"").trim() || null;
  const cleanAddress = (v: string | null) => v?.replace(/\s*Voir (?:le plan|l'itinéraire).*$/i,"").trim() || null;
  let siren = prospect.siren;
  let siret = prospect.siret;
  const nextSiren = profile.siren || profile.siret?.slice(0,9) || null;
  if (!siren && nextSiren) {
    const [other] = await db.select({id:prospectsTable.id}).from(prospectsTable).where(and(
      eq(prospectsTable.tenantId,req.auth!.tenantId),eq(prospectsTable.siren,nextSiren)
    )).limit(1);
    if (!other || other.id === prospect.id) siren=nextSiren;
  }
  if (!siret && profile.siret) {
    const [other] = await db.select({id:prospectsTable.id}).from(prospectsTable).where(and(
      eq(prospectsTable.tenantId,req.auth!.tenantId),eq(prospectsTable.siret,profile.siret)
    )).limit(1);
    if (!other || other.id === prospect.id) siret=profile.siret;
  }
  const prior = (prospect.sourceDetails && typeof prospect.sourceDetails === "object"
    && !Array.isArray(prospect.sourceDetails)) ? prospect.sourceDetails : {};
  const [updated] = await db.update(prospectsTable).set({
    phone: prospect.phone || profile.phone,
    email: prospect.email || profile.email,
    website: (!prospect.website || /^https?:\/\/(?:[^/]+\.)?pagesjaunes\.fr\//i.test(prospect.website))
      ? (profile.website || prospect.website) : prospect.website,
    siren, siret,
    city: cleanCity(prospect.city) || cleanCity(profile.city),
    address: cleanAddress(prospect.address) || cleanAddress(profile.address),
    postalCode: prospect.postalCode || profile.codePostal,
    sourceDetails: {...prior,pagesjaunes:{...profile,capturedAt:new Date().toISOString()}},
    updatedAt: new Date(),
  }).where(and(eq(prospectsTable.id,prospect.id),eq(prospectsTable.tenantId,req.auth!.tenantId))).returning();
  res.json(updated);
});

router.post("/device/jobs/:id/enrich", requireAuth, async(req,res) => {
  const parsed=z.object({
    candidateId:z.string().min(3).max(64),
    profile:profileSchema,
  }).strict().safeParse(req.body);
  if(!parsed.success){res.status(400).json({error:"Fiche détaillée invalide",details:parsed.error.issues});return;}
  const job=await getJob(String(req.params.id),req.auth!.tenantId);
  if(!job){res.status(404).json({error:"Recherche introuvable"});return;}
  const saved=savedParams(job);
  if(job.status!=="completed" || !Array.isArray(saved.results) || !saved.sources?.includes("pagesjaunes")){
    res.status(409).json({error:"Recherche PagesJaunes non enrichissable"});return;
  }
  const index=saved.results.findIndex(c=>(c.id || c.siren)===parsed.data.candidateId);
  if(index<0){res.status(404).json({error:"Entreprise absente de cette recherche"});return;}
  const original=saved.results[index];
  const profile=parsed.data.profile;
  if(!original.sourceUrl || !pagesJaunesProfileUrl(original.sourceUrl)
    || new URL(original.sourceUrl).pathname!==new URL(profile.sourceUrl).pathname) {
    res.status(409).json({error:"La fiche PagesJaunes ne correspond pas à cette entreprise"});return;
  }
  if(profile.codePostal && original.codePostal && profile.codePostal!==original.codePostal){
    res.status(409).json({error:"Code postal incohérent avec la recherche"});return;
  }
  const normalizedName=(name:string)=>name.normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase().replace(/[^a-z0-9]/g,"");
  if (normalizedName(profile.name)!==normalizedName(original.company)
    && !normalizedName(profile.name).includes(normalizedName(original.company))
    && !normalizedName(original.company).includes(normalizedName(profile.name))) {
    res.status(409).json({error:"Le nom de la fiche source ne correspond pas au résultat"});return;
  }
  const updated:SearchCandidate={
    ...original,
    phone:original.phone||profile.phone,
    email:original.email||profile.email,
    website:(!original.website || /^https?:\/\/(?:[^/]+\.)?pagesjaunes\.fr\//i.test(original.website))
      ? (profile.website||original.website) : original.website,
    siret:original.siret||profile.siret,
    siren:original.siren||profile.siren||profile.siret?.slice(0,9)||"",
    city:original.city?.replace(/\s*Voir.*$/i,"")||profile.city,
    address:original.address?.replace(/\s*Voir (?:le plan|l'itinéraire).*$/i,"")||profile.address,
    sourceDetails:{...(original.sourceDetails||{}),pagesjaunes:{...profile,capturedAt:new Date().toISOString()}},
  };
  const results=[...saved.results];
  results[index]=updated;
  await db.update(sourcingJobsTable).set({params:{...saved,results},updatedAt:new Date()})
    .where(and(eq(sourcingJobsTable.id,job.id),eq(sourcingJobsTable.tenantId,req.auth!.tenantId)));
  res.json(updated);
});

router.get("/sources/status", requireAuth, async (_req, res) => {
  const configured = process.env.PAGESJAUNES_BROWSER_URL?.trim();
  if (!configured) { res.json({ pagesjaunes: { mode: "direct", browserReady: false } }); return; }
  try {
    const url = new URL("/healthz", configured);
    const response = await fetch(url, { signal: AbortSignal.timeout(2500), redirect: "error" });
    res.json({ pagesjaunes: { mode: "browser", browserReady: response.ok } });
  } catch {
    res.json({ pagesjaunes: { mode: "browser", browserReady: false } });
  }
});

router.get("/jobs", requireAuth, async (req, res) => {
  const jobs = await db.select().from(sourcingJobsTable)
    .where(eq(sourcingJobsTable.tenantId, req.auth!.tenantId))
    .orderBy(desc(sourcingJobsTable.createdAt)).limit(100);
  res.json(jobs);
});

router.post("/jobs", requireAuth, async (req, res) => {
  const parsed = jobSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Critères invalides", details: parsed.error.issues });
    return;
  }
  const [job] = await db.insert(sourcingJobsTable).values({
    type: parsed.data.type,
    name: parsed.data.name,
    params: parsed.data.type === "multi" ? { ...parsed.data.params, results: [], sourceStatuses: {} } : parsed.data.params,
    status: "running",
    tenantId: req.auth!.tenantId,
    createdBy: req.auth!.userId,
  }).returning();
  if (parsed.data.type === "multi") {
    void runMultiSearch(job.id, req.auth!.tenantId, parsed.data.params).catch(async error => {
      const message = error instanceof Error ? error.message : "Échec du traitement";
      logger.error({ jobId: job.id, message }, "Multi-source worker stopped unexpectedly");
      await db.update(sourcingJobsTable).set({ status: "error", error: message, updatedAt: new Date() })
        .where(eq(sourcingJobsTable.id, job.id));
    });
    res.status(202).json(job);
    return;
  }
  const started = Date.now();
  try {
    const results = parsed.data.type === "pagesjaunes"
      ? await searchPagesJaunes(parsed.data.params)
      : await searchFrenchCompanies(parsed.data.params);
    const [finished] = await db.update(sourcingJobsTable).set({
      status: "completed", count: results.length, progress: 100,
      params: { ...parsed.data.params, results },
      duration: `${((Date.now() - started) / 1000).toFixed(1)} s`,
      updatedAt: new Date(),
    }).where(and(eq(sourcingJobsTable.id, job.id), eq(sourcingJobsTable.tenantId, req.auth!.tenantId))).returning();
    res.status(201).json(finished);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Recherche indisponible";
    logger.warn({ jobId: job.id, message, source: parsed.data.type }, "Sourcing provider failed");
    await db.update(sourcingJobsTable).set({
      status: "error", error: message, updatedAt: new Date(),
    }).where(eq(sourcingJobsTable.id, job.id));
    res.status(502).json({ error: "Recherche indisponible", detail: message, jobId: job.id });
  }
});

router.get("/jobs/:id", requireAuth, async (req, res) => {
  const job = await getJob(String(req.params.id), req.auth!.tenantId);
  if (!job) { res.status(404).json({ error: "Recherche introuvable" }); return; }
  res.json(job);
});

router.get("/jobs/:id/results", requireAuth, async (req, res) => {
  const job = await getJob(String(req.params.id), req.auth!.tenantId);
  if (!job) { res.status(404).json({ error: "Recherche introuvable" }); return; }
  const params = savedParams(job);

  if (Array.isArray(params.results)) {
    const candidates = params.results.slice(0, 50);
    const sirens = candidates.map(r => r.siren).filter(s => /^\d{9}$/.test(s));
    const existing = sirens.length ? await db.select({
      id: prospectsTable.id, siren: prospectsTable.siren,
    }).from(prospectsTable).where(and(
      eq(prospectsTable.tenantId, req.auth!.tenantId), inArray(prospectsTable.siren, sirens),
    )) : [];
    const bySiren = new Map(existing.map(p => [p.siren, p.id]));
    const sirets = [...new Set(candidates.map(p => p.siret).filter((v): v is string => Boolean(v && /^\d{14}$/.test(v))))];
    const urls = [...new Set(candidates.map(p => p.sourceUrl).filter((v): v is string => Boolean(v)))];
    // Requêtes séquentielles : évite les lectures concurrentes dans l'adaptateur
    // PostgreSQL local utilisé pour les vérifications d'intégration isolées.
    const bySiretRows = sirets.length ? await db.select({ id: prospectsTable.id, siret: prospectsTable.siret }).from(prospectsTable)
      .where(and(eq(prospectsTable.tenantId, req.auth!.tenantId), inArray(prospectsTable.siret, sirets))) : [];
    const byUrlRows = urls.length ? await db.select({ id: prospectsTable.id, sourceUrl: prospectsTable.sourceUrl }).from(prospectsTable)
      .where(and(eq(prospectsTable.tenantId, req.auth!.tenantId), inArray(prospectsTable.sourceUrl, urls))) : [];
    const bySiret = new Map(bySiretRows.map(p => [p.siret, p.id]));
    const byUrl = new Map(byUrlRows.map(p => [p.sourceUrl, p.id]));
    const companies = [...new Set(candidates.map(candidate => candidate.company))];
    const legacy = companies.length ? await db.select({
      id: prospectsTable.id, company: prospectsTable.company, address: prospectsTable.address,
    }).from(prospectsTable).where(and(
      eq(prospectsTable.tenantId, req.auth!.tenantId),
      inArray(prospectsTable.company, companies),
    )) : [];
    const byLegacy = new Map(legacy.map(p => [`${p.company}|${p.address}`, p.id]));
    const data = candidates.map(candidate => {
      const prospectId = bySiren.get(candidate.siren)
        || (candidate.siret ? bySiret.get(candidate.siret) : undefined)
        || (candidate.sourceUrl ? byUrl.get(candidate.sourceUrl) : undefined)
        || (candidate.address ? byLegacy.get(`${candidate.company}|${candidate.address}`) : undefined) || null;
      return { ...candidate, id: candidate.id || candidate.siren, imported: Boolean(prospectId), prospectId };
    });
    res.json({ data, total: data.length, imported: data.filter(p => p.imported).length });
    return;
  }

  // Legacy searches already imported companies. Preserve their visible results
  // without re-importing or deleting any existing prospect.
  const ids = Array.isArray(params.importedIds)
    ? params.importedIds.filter(id => typeof id === "string" && /^[a-f0-9-]{36}$/i.test(id)).slice(0, 25) : [];
  if (!ids.length) { res.json({ data: [], total: 0, imported: 0 }); return; }
  const old = await db.select().from(prospectsTable)
    .where(and(eq(prospectsTable.tenantId, req.auth!.tenantId), inArray(prospectsTable.id, ids)));
  res.json({
    data: old.map(p => ({ siren: p.siren || p.id, company: p.company, address: p.address,
      codePostal: p.postalCode || params.codePostal || "", city: p.city || null, siret: p.siret || null, imported: true, prospectId: p.id })),
    total: old.length, imported: old.length,
  });
});

router.post("/jobs/:id/import", requireAuth, async (req, res) => {
  const parsed = z.object({
    sirens: z.array(z.string().regex(/^\d{9}$/)).min(1).max(25).optional(),
    ids: z.array(z.string().min(3).max(64)).min(1).max(50).optional(),
  }).refine(input => Boolean(input.sirens?.length || input.ids?.length)).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Sélection invalide" }); return; }
  const job = await getJob(String(req.params.id), req.auth!.tenantId);
  if (!job) { res.status(404).json({ error: "Recherche introuvable" }); return; }
  const candidates = savedParams(job).results;
  if (!Array.isArray(candidates) || job.status !== "completed") {
    res.status(409).json({ error: "Cette recherche n'est pas importable. Relancez une recherche." });
    return;
  }
  const requested = [...new Set(parsed.data.ids ?? parsed.data.sirens ?? [])];
  const key = (candidate: SearchCandidate) => candidate.id || candidate.siren;
  const eligible = candidates.filter(candidate => requested.includes(key(candidate)));
  if (eligible.length !== requested.length) {
    res.status(400).json({ error: "Une entreprise sélectionnée ne fait pas partie de cette recherche" });
    return;
  }

  let imported = 0,enriched=0,conflicts=0;
  let skipped = 0;
  for (const candidate of eligible) {
    const incoming:ImportCapture={
      id:candidate.id||candidate.siret||candidate.siren,
      source:candidate.sources?.map(s=>s==='entreprises'?'annuaire-entreprises':s).join(',')
        || (candidate.source==='entreprises'?'annuaire-entreprises':candidate.source||'annuaire-entreprises'),
      company:candidate.company,address:candidate.address,codePostal:candidate.codePostal,
      city:candidate.city,phone:candidate.phone,email:candidate.email,website:candidate.website,
      apeCode:candidate.apeCode,nafLabel:candidate.nafLabel,nafVersion:candidate.nafVersion,
      siren:/^\d{9}$/.test(candidate.siren)?candidate.siren:null,
      siret:candidate.siret,sourceUrl:candidate.sourceUrl,sourceDetails:candidate.sourceDetails,
    };
    const alternatives=[ilike(prospectsTable.company,candidate.company)];
    if(candidate.siret)alternatives.push(eq(prospectsTable.siret,candidate.siret));
    if(/^\d{9}$/.test(candidate.siren))alternatives.push(eq(prospectsTable.siren,candidate.siren));
    const profile=captureProfileUrl(candidate.sourceUrl);
    if(profile)alternatives.push(eq(prospectsTable.sourceUrl,profile));
    const existing=await db.select().from(prospectsTable).where(and(
      eq(prospectsTable.tenantId,req.auth!.tenantId),or(...alternatives),
    )).limit(100);
    const matches=existing.filter(prospect=>sameEstablishment(prospect,incoming,false));
    if(matches.length>1){skipped++;continue;}
    if(matches.length===1){
      const outcome=await mergeProspectCapture(matches[0],incoming,false,req.auth!.tenantId);
      if(outcome.filled.length)enriched++;else skipped++;
      conflicts+=outcome.conflicts;
      continue;
    }

    const [insertedRow] = await db.insert(prospectsTable).values({
      siren: /^\d{9}$/.test(candidate.siren) ? candidate.siren : null,
      siret: candidate.siret || null,
      company: candidate.company,
      address: candidate.address,
      postalCode: candidate.codePostal || null,
      city: candidate.city,
      phone: candidate.phone || null,
      email: candidate.email || null,
      website: candidate.website || null,
      apeCode: candidate.apeCode || null,
      nafLabel: candidate.nafLabel || null,
      nafVersion: candidate.nafVersion || null,
      sourceDetails: candidate.sourceDetails || {},
      source: candidate.sources?.map(item => item === "entreprises" ? "annuaire-entreprises" : item).join(",")
        || (candidate.source === "pagesjaunes" || job.type === "pagesjaunes" ? "pagesjaunes" : "annuaire-entreprises"),
      sourceUrl: candidate.sourceUrl || null,
      status: "new", tenantId: req.auth!.tenantId, createdBy: req.auth!.userId,
    }).onConflictDoNothing().returning({ id: prospectsTable.id });
    if (insertedRow) imported++; else skipped++;
  }
  res.json({ imported,enriched,conflicts,skipped,selected: requested.length });
});

router.patch("/jobs/:id", requireAuth, async (req, res) => {
  const allowed = z.object({
    status: z.enum(["queued", "running", "paused", "completed", "error"]).optional(),
    count: z.number().int().optional(),
    progress: z.number().int().min(0).max(100).optional(),
    duration: z.string().optional(),
    error: z.string().nullable().optional(),
  }).safeParse(req.body);
  if (!allowed.success) { res.status(400).json({ error: "Données invalides" }); return; }
  const [updated] = await db.update(sourcingJobsTable)
    .set({ ...allowed.data, updatedAt: new Date() })
    .where(and(eq(sourcingJobsTable.id, String(req.params.id)), eq(sourcingJobsTable.tenantId, req.auth!.tenantId)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Recherche introuvable" }); return; }
  res.json(updated);
});

router.delete("/jobs/:id", requireAuth, async (req, res) => {
  await db.delete(sourcingJobsTable).where(and(
    eq(sourcingJobsTable.id, String(req.params.id)), eq(sourcingJobsTable.tenantId, req.auth!.tenantId),
  ));
  res.status(204).send();
});

export default router;
