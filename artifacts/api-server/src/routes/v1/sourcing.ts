import {captureIdentityMatches} from '../../lib/enrichment-identity';
import { professionalSourceUrl } from '@workspace/api-zod';
import { isDeepStrictEqual } from 'node:util';
import { Router } from "express";
import { z } from "zod";
import { activityLabel, db } from "@workspace/db";
import { sourcingJobsTable, prospectsTable, activitiesTable } from "@workspace/db";
import {changeDescription,prospectFieldLabels,type FieldChanges} from '../../lib/prospect-change-history';
import { eq, and, desc, inArray, or, ilike, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { requireAuth } from "../../middlewares/auth";
import { logger } from "../../lib/logger";
import { isProspectIdentityDuplicate } from "../../lib/prospect-identity";
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
  source?: 'entreprises' | 'pagesjaunes' | 'google_maps' | 'google_search' | 'bing' | 'linkedin' | 'societe_com' | 'pappers' | 'facebook' | 'instagram' | 'tiktok';
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
      nafLabel: apeCode ? activityLabel(apeCode, activitySource.nomenclature_activite_principale) || activitySource.libelle_activite_principale?.trim() || null : null,
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
  if (aSiren && bSiren && aSiren === bSiren && ![a.source,b.source].includes('societe_com')) return true;
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
  if (c.siret) return "siret:" + c.siret;
  if (c.source !== 'societe_com' && /^\d{9}$/.test(c.siren)) return "siren:" + c.siren;
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
const deviceSources = ['entreprises','pagesjaunes','google_maps','google_search','bing','linkedin','societe_com','pappers','facebook','instagram','tiktok'] as const;
type DeviceSource = typeof deviceSources[number];
function validDeviceSourceUrl(source: DeviceSource, value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    switch (source) {
      case 'entreprises': return host==='annuaire-entreprises.data.gouv.fr'&&/^\/entreprise\/\d{9}$/.test(url.pathname);
      case 'pagesjaunes': return ['pagesjaunes.fr','www.pagesjaunes.fr'].includes(host);
      case 'google_maps': return ['www.google.com','maps.google.com','google.com','www.google.fr','google.fr'].includes(host)
        && url.pathname.startsWith('/maps');
      case 'google_search': return ['www.google.com','google.com','www.google.fr','google.fr'].includes(host);
      case 'bing': return professionalSourceUrl(source,value)!==null;
      case 'pappers': return ['pappers.fr','www.pappers.fr'].includes(host)&&/^\/entreprise\/(?:[a-z0-9-]+-)?\d{9}\/?$/i.test(url.pathname);
      case 'societe_com': return ['societe.com','www.societe.com'].includes(host) && /^\/societe\/[a-z0-9-]+-\d{9}\.html\/?$/i.test(url.pathname);
      case 'facebook': case 'tiktok': case 'instagram': case 'linkedin':
        return professionalSourceUrl(source, value)!==null;
    }
  } catch { return false; }
}
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

const companyDetailsSchema = z.object({
  fields:z.record(z.string().max(100),z.string().max(1000)).refine(value=>Object.keys(value).length<=30),
  managers:z.array(z.string().max(150)).max(50),
  managerContacts:z.array(z.object({
    name:z.string().trim().min(2).max(150),role:z.string().max(150).nullable(),
    phone:z.string().max(40).nullable(),email:z.string().email().max(254).nullable(),
    profileUrl:z.string().url().max(500).refine(value=>{
      let url:URL;try{url=new URL(value);}catch{return false;}return url.protocol==='https:'&&!url.username&&!url.password&&!url.port && ((['societe.com','www.societe.com'].includes(url.hostname)&&/^\/(?:dirigeants?|manager)\//i.test(url.pathname))||(['pappers.fr','www.pappers.fr'].includes(url.hostname)&&/^\/dirigeant\//i.test(url.pathname)));
    }).nullable(),
  }).strict()).max(50).optional(),
  establishments:z.array(z.object({siret:z.string().regex(/^\d{14}$/),address:z.string().max(320).nullable()}).strict()).max(30),
  links:z.array(z.object({label:z.string().max(180),url:z.string().url().max(500).refine(value=>{
    try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port && ['societe.com','www.societe.com','pappers.fr','www.pappers.fr'].includes(url.hostname);}catch{return false;}
  })}).strict()).max(20),
}).strict();
const deviceCandidateFieldsSchema = z.object({
  id: z.string().trim().min(3).max(64),
  source: z.enum(deviceSources).default('pagesjaunes'), // compatibilité extension 0.3
  company: z.string().trim().min(2).max(160),
  address: z.string().trim().min(5).max(320),
  codePostal: z.string().regex(/^\d{5}$/),
  city: z.string().trim().max(120).nullable().optional(),
  email:z.string().email().max(254).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  website: z.string().url().max(500).refine(url=>['https:','http:'].includes(new URL(url).protocol)).nullable().optional(),
  sourceUrl: z.string().url().max(500).nullable().optional(),
  siret: z.string().regex(/^\d{14}$/).nullable().optional(),
  siren: z.string().regex(/^\d{9}$/).nullable().optional(),
  apeCode: z.string().regex(/^\d{2}\.\d{2}[A-Z]$/).nullable().optional(),
  nafLabel: z.string().trim().max(250).nullable().optional(),
  apeScope: z.enum(['etablissement','unite_legale']).optional(),
  nafVersion: z.string().trim().max(32).nullable().optional(),
  companyDetails: companyDetailsSchema.optional(),
  mapsDetail:z.object({title:z.string().trim().min(2).max(160),address:z.string().trim().min(5).max(320)}).strict().optional(),
  pagesjaunesProfile: profileSchema.optional(),
  collectionMode: z.enum(['manual','visible']).optional(),
  capturedAt: z.number().int().positive().optional(),
}).strict();
function validatePagesJaunesProfile(item:{source:string;company:string;sourceUrl?:string|null;siret?:string|null;pagesjaunesProfile?:z.infer<typeof profileSchema>},ctx:z.RefinementCtx){
  const profile=item.pagesjaunesProfile;
  const details=(item as any).companyDetails;
  if(details){
    const expected=item.source==='pappers'?'pappers.fr':'societe.com';
    if(!['pappers','societe_com'].includes(item.source)||[...(details.managerContacts||[]).map((c:any)=>c.profileUrl),...(details.links||[]).map((l:any)=>l.url)].filter(Boolean).some((value:string)=>new URL(value).hostname.replace(/^www\./,'')!==expected))ctx.addIssue({code:'custom',path:['companyDetails'],message:'Détails incohérents avec la source.'});
  }
  if(item.source==='pappers'&&item.sourceUrl){try{const siren=new URL(item.sourceUrl).pathname.match(/(\d{9})\/?$/)?.[1];if(!siren||item.siret&&!item.siret.startsWith(siren)||'siren' in item&&item.siren&&item.siren!==siren)ctx.addIssue({code:'custom',path:['siret'],message:'Identifiant incohérent avec la fiche Pappers.'});}catch{ctx.addIssue({code:'custom',path:['sourceUrl'],message:'Fiche Pappers invalide.'});}}

  if(item.siret&&'siren' in item&&item.siren&&!item.siret.startsWith(String(item.siren)))ctx.addIssue({code:'custom',path:['siren'],message:'SIREN et SIRET incohérents.'});
  if(item.source==='entreprises'&&item.siret&&item.sourceUrl&&!item.sourceUrl.endsWith('/'+item.siret.slice(0,9)))ctx.addIssue({code:'custom',path:['sourceUrl'],message:'URL officielle incohérente.'});
  if(!profile)return;
  if(item.source!=='pagesjaunes'||profile.sourceUrl!==item.sourceUrl||normalizedIdentity(profile.name)!==normalizedIdentity(item.company)||
    (profile.siren&&profile.siret&&!profile.siret.startsWith(profile.siren))||
    (profile.siret&&profile.siret!==item.siret)||
    (profile.siren&&item.siret&&!item.siret.startsWith(profile.siren)))
    ctx.addIssue({code:'custom',path:['pagesjaunesProfile'],message:'Détails PagesJaunes incohérents avec la fiche capturée.'});
}
function capturedSourceDetails(item:{source:string;sourceUrl?:string|null;capturedAt?:number;companyDetails?:unknown;pagesjaunesProfile?:z.infer<typeof profileSchema>}){
  return {
    ...(item.source==='pappers'&&item.companyDetails?{pappers:{companyDetails:item.companyDetails,sourceUrl:item.sourceUrl,capturedAt:item.capturedAt}}:{}),
    ...(item.source==='societe_com'&&item.companyDetails?{societe_com:{companyDetails:item.companyDetails,sourceUrl:item.sourceUrl,capturedAt:item.capturedAt}}:{}),
    ...(item.source==='pagesjaunes'&&item.pagesjaunesProfile?{pagesjaunes:{...item.pagesjaunesProfile,capturedAt:new Date(item.capturedAt||Date.now()).toISOString()}}:{}),
  };
}
const deviceCandidateSchema = deviceCandidateFieldsSchema.superRefine((item, context) => {
  validatePagesJaunesProfile(item,context);
  if (item.sourceUrl ? !validDeviceSourceUrl(item.source,item.sourceUrl) : item.source!=='pagesjaunes') {
    context.addIssue({code:'custom',path:['sourceUrl'],message:'URL de source obligatoire et conforme à la source'});
  }
  if (item.source === 'societe_com' && item.siret && (!item.sourceUrl || !validDeviceSourceUrl('societe_com', item.sourceUrl) || !new URL(item.sourceUrl).pathname.replace(/\/$/, '').endsWith('-'+item.siret.slice(0,9)+'.html'))) {
    context.addIssue({code:'custom',path:['siret'],message:'SIRET incohérent avec la fiche Societe.com'});
  }
  if (!item.address.includes(item.codePostal)) {
    context.addIssue({code:'custom',path:['address'],message:'Adresse et code postal incohérents'});
  }
  if (['linkedin','facebook','instagram','tiktok'].includes(item.source) && item.collectionMode!=='manual') {
    context.addIssue({code:'custom',path:['collectionMode'],message:'Confirmez la fiche professionnelle en saisie manuelle'});
  }
}).transform(item => ({
  ...item,
  sourceDetails:{
    ...(item.apeCode && item.apeScope ? {annuaire:{apeScope:item.apeScope}} : {}),
    ...capturedSourceDetails(item),
  },
  ...(item.source==='pagesjaunes'&&item.pagesjaunesProfile?.siren?{siren:item.pagesjaunesProfile.siren}:{}),
  ...(item.source === 'societe_com' && item.sourceUrl
    ? {siren: new URL(item.sourceUrl).pathname.match(/-(\d{9})\.html/i)?.[1]} : {}),
}));
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
  targetedIdentity?:boolean;
};
type EnrichmentField = 'company'|'linkedinUrl'|'address'|'postalCode'|'city'|'phone'|'email'|'website'|'siret'|'siren'|'apeCode'|'nafLabel'|'nafVersion';
type EnrichmentConflict = {
  id:string;field:EnrichmentField;existing:string;incoming:string;
  source:string;sourceUrl:string|null;capturedAt:string;
};
const FIELDS:EnrichmentField[]=['company','linkedinUrl','address','postalCode','city','phone','email','website','siret','siren','apeCode','nafLabel','nafVersion'];
const stringOrEmpty=(value:unknown)=>typeof value==='string'?value.trim():'';
function normalizedField(field:EnrichmentField,value:unknown):string{
  const raw=stringOrEmpty(value);
  if(field==='phone')return normalizedPhone(raw);
  if(field==='linkedinUrl')return professionalSourceUrl('linkedin',raw) || raw;
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
    if(url.protocol!=='https:')return null;
    const linkedin=professionalSourceUrl('linkedin',value);
    if(linkedin)return linkedin;
    return (['www.google.com','google.com','maps.google.com','www.google.fr','google.fr'].includes(url.hostname) && /^\/maps\/place\//.test(url.pathname))
      || (['pagesjaunes.fr','www.pagesjaunes.fr'].includes(url.hostname)&&/^\/pros\/\d{4,20}\/?$/.test(url.pathname))
      ? url.href:null;
  }catch{return null;}
}
function incomingFields(item:ImportCapture,incomplete:boolean):Partial<Record<EnrichmentField,string>>{
  const fields:Partial<Record<EnrichmentField,string>>={};
  if(item.targetedIdentity)fields.company=item.company;
  for(const field of ['address','city','phone','email','website'] as const){
    const value=stringOrEmpty(item[field]);if(value)fields[field]=value;
  }
  const linkedinUrl=item.source.split(',').includes('linkedin') ? professionalSourceUrl('linkedin',item.sourceUrl) : null;
  if(linkedinUrl)fields.linkedinUrl=linkedinUrl;
  if(!incomplete){
    if(item.codePostal)fields.postalCode=item.codePostal;
    if(item.siret){fields.siret=item.siret;fields.siren=item.siren||item.siret.slice(0,9);}
    else if(item.siren)fields.siren=item.siren;
    if(/^\d{2}\.\d{2}[A-Z]$/.test(item.apeCode||'')){
      fields.apeCode=item.apeCode!;
      const label = activityLabel(item.apeCode, item.nafVersion) || item.nafLabel;
      if(label)fields.nafLabel=label;
      if(item.nafVersion)fields.nafVersion=item.nafVersion;
    }
  }
  return fields;
}
export function captureHasPendingConflict(record:Record<string,unknown>,item:ImportCapture,incomplete=false):boolean{
  const conflicts=jsonRecord(jsonRecord(record.sourceDetails).crossSource).conflicts;
  const fields=incomingFields(item,incomplete);
  return Array.isArray(conflicts)&&conflicts.some(c=>c.source===item.source && FIELDS.includes(c.field) &&
    !!fields[c.field as EnrichmentField] &&
    normalizedField(c.field,fields[c.field as EnrichmentField])===normalizedField(c.field,c.incoming) &&
    normalizedField(c.field,record[c.field as EnrichmentField])===normalizedField(c.field,c.existing));
}
function sameEstablishment(record:{company:string|null;address:string|null;city:string|null;
  phone:string|null;website:string|null;siren:string|null;siret:string|null;sourceUrl:string|null},
  incoming:ImportCapture,incomplete:boolean):boolean{
  const siret=!incomplete?incoming.siret:null;
  if(incoming.siren && record.siren && incoming.siren!==record.siren)return false;
  if(siret&&record.siret&&record.siret!==siret)return false; // Deux identités juridiques contradictoires.
  if(siret&&record.siret===siret)return true;
  const profile=captureProfileUrl(incoming.sourceUrl);
  // A company LinkedIn page can serve several establishments. It must never
  // override the address/city evidence used to identify an establishment.
  if(profile && !professionalSourceUrl('linkedin',profile) && record.sourceUrl===profile)return true;
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
// Existing captures may predate canonical storage (no www, no final slash,
// an About URL or tracking parameters). Match them before deciding ambiguity.
function linkedinProfilePredicate(profile:string) {
  const pattern='^https://(www[.])?linkedin[.]com(:443)?/company/([a-z0-9_-]+)(/about)?/?([?#].*)?$';
  const replacement='https://www.linkedin.com/company/\\3/';
  return sql`(
    regexp_replace(lower(trim(${prospectsTable.sourceUrl})), ${pattern}, ${replacement}) = ${profile}
    OR regexp_replace(lower(trim(${prospectsTable.linkedinUrl})), ${pattern}, ${replacement}) = ${profile}
  )`;
}
function ambiguousLinkedinProfiles(records: (typeof prospectsTable.$inferSelect)[], incoming:ImportCapture) {
  const profile=professionalSourceUrl('linkedin',incoming.sourceUrl);
  if(!profile)return [];
  return records.filter(record=>{
    const known=[record.linkedinUrl,record.sourceUrl].map(value=>professionalSourceUrl('linkedin',value));
    if(!known.includes(profile))return false;
    const city=normalizedIdentity(incoming.city||''), existingCity=normalizedIdentity(record.city||'');
    // A clearly different city identifies a separate establishment; otherwise
    // require review when the usual identity evidence did not produce a match.
    return !(city && existingCity && city!==existingCity);
  });
}
export async function mergeProspectCapture(
  existing:typeof prospectsTable.$inferSelect,item:ImportCapture,incomplete:boolean,
  tenantId:string, executor:Pick<typeof db,'update'|'insert'>=db,actorId?:string,autoFields:EnrichmentField[]=[],
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
  if(existing.apeCode&&fields.apeCode&&existing.apeCode!==fields.apeCode&&!autoFields.includes('apeCode')){
    if(!existing.nafLabel)delete fields.nafLabel;
    if(!existing.nafVersion)delete fields.nafVersion;
  }
  for(const field of FIELDS){
    const incoming=fields[field];if(!incoming)continue;
    const current=stringOrEmpty(existing[field]);
    if(!current || (autoFields.includes(field) && normalizedField(field,current)!==normalizedField(field,incoming))){
      updates[field]=incoming;filled.push(field);
      fieldSources[field]={source:item.source,sourceUrl:item.sourceUrl,capturedAt:now,...(autoFields.length?{automatic:true}:{})};
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
  if(!filled.length&&!newConflicts.length&&!sourceAdded&&alreadyObserved &&
    !jsonRecord(item.sourceDetails).pappers&&!jsonRecord(item.sourceDetails).societe_com&&!jsonRecord(item.sourceDetails).pagesjaunes)
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
  const activityScope=jsonRecord(incomingDetails.annuaire).apeScope;
  if(activityScope&&item.apeCode===(updates.apeCode||existing.apeCode)&&
    (activityScope==='etablissement'||!jsonRecord(oldDetails.annuaire).apeScope))
    combinedDetails.annuaire={...jsonRecord(combinedDetails.annuaire),apeScope:activityScope};
  if(['societe_com','pappers'].includes(item.source) && incomingDetails[item.source]){
    const incomingProfile=jsonRecord(incomingDetails[item.source]);
    const oldProfile=jsonRecord(oldDetails[item.source]);
    if(incomingProfile.companyDetails && Number(incomingProfile.capturedAt||0)>=Number(oldProfile.capturedAt||0)){
      const changed=!isDeepStrictEqual(oldProfile.companyDetails,incomingProfile.companyDetails);
      const history=Array.isArray(oldProfile.history)?oldProfile.history:[];
      combinedDetails[item.source]={...oldProfile,...incomingProfile,
        history:changed && oldProfile.companyDetails ? [...history,{capturedAt:oldProfile.capturedAt,companyDetails:oldProfile.companyDetails}].slice(-10) : history};
    }
  }
  let pagesJaunesChanged=false;
  if(item.source==='pagesjaunes'&&incomingDetails.pagesjaunes){
    const incoming=jsonRecord(incomingDetails.pagesjaunes),prior=jsonRecord(oldDetails.pagesjaunes);
    if(Date.parse(String(incoming.capturedAt||''))>=(Date.parse(String(prior.capturedAt||''))||0)){
      const {capturedAt:oldAt,history:oldHistory,...oldData}=prior;
      const {capturedAt:newAt,history:ignored,...newData}=incoming;
      pagesJaunesChanged=!isDeepStrictEqual(oldData,newData);
      const history=Array.isArray(oldHistory)?oldHistory:[];
      combinedDetails.pagesjaunes={...incoming,history:pagesJaunesChanged&&oldAt?[...history,{...oldData,capturedAt:oldAt}].slice(-10):history};
    }
  }
  let officialDetailsChanged=false;
  const officialSource=['entreprises','insee'].includes(item.source)?item.source:null;
  if(officialSource&&incomingDetails[officialSource]){
    const incoming=jsonRecord(incomingDetails[officialSource]),prior=jsonRecord(oldDetails[officialSource]);
    officialDetailsChanged=!isDeepStrictEqual(prior.snapshot,incoming.snapshot);
    const history=Array.isArray(prior.history)?prior.history:[];
    combinedDetails[officialSource]={...incoming,history:officialDetailsChanged&&prior.snapshot?[...history,{snapshot:prior.snapshot,capturedAt:prior.capturedAt}].slice(-10):history};
  }
  const updatedDetails={...combinedDetails,crossSource:{...oldMerge,
    fieldSources,
    observations:(alreadyObserved?oldObservations:[...oldObservations,observation]).slice(-60),
    conflicts:[...oldConflicts,...newConflicts].slice(-60),
  }};
  await executor.update(prospectsTable).set({
    ...updates,
    ...(['address','postalCode','city'].some(field=>filled.includes(field))?{lat:null,lng:null}:{}),
    source:[...sources].join(','),
    sourceUrl:existing.sourceUrl||captureProfileUrl(item.sourceUrl),
    sourceDetails:updatedDetails,updatedAt:new Date(),
  }).where(and(eq(prospectsTable.id,existing.id),eq(prospectsTable.tenantId,tenantId)));
  const legalSource=item.source==='pappers'?'pappers':'societe_com';
  const oldSociete=jsonRecord(oldDetails[legalSource]).companyDetails;
  const nextSociete=jsonRecord(combinedDetails[legalSource]).companyDetails;
  const detailsChanged=!!nextSociete && !isDeepStrictEqual(oldSociete,nextSociete);
  if(filled.length || newConflicts.length || detailsChanged || pagesJaunesChanged || officialDetailsChanged){
    const changes:FieldChanges=Object.fromEntries(filled.map(field=>[field,{before:existing[field as EnrichmentField],after:updates[field as EnrichmentField]}]));
    if(detailsChanged)changes['Informations détaillées '+(legalSource==='pappers'?'Pappers':'Societe.com')]={before:oldSociete||null,after:nextSociete};
    if(pagesJaunesChanged)changes['Informations détaillées PagesJaunes']={before:oldDetails.pagesjaunes||null,after:combinedDetails.pagesjaunes};
    if(officialDetailsChanged&&officialSource)changes['Données officielles · '+officialSource]={before:oldDetails[officialSource]||null,after:combinedDetails[officialSource]};
    const proposals=newConflicts.length?'\nPropositions non appliquées : '+newConflicts.map(c=>`${prospectFieldLabels[c.field]||c.field} : ${c.existing} → ${c.incoming}`).join(' ; '):'';
    await executor.insert(activitiesTable).values({type:'data_update',title:'Enrichissement · '+item.source,
      description:changeDescription(item.source,item.sourceUrl||null,changes,autoFields.length?'Enrichissement automatique : identité exacte et données confirmées de la source.':'Champs vides complétés ; les valeurs divergentes restent à valider.',now)+proposals,
      status:'done',doneAt:new Date(),prospectId:existing.id,tenantId,createdBy:actorId||null});
  }
  return {updated:true,filled,conflicts:newConflicts.length,newConflicts};
}

// L'enrichissement ciblé accepte une source partielle, sans créer de prospect.
// L'import de listes conserve ses exigences d'adresse vérifiée.
const targetCaptureSchema=deviceCandidateFieldsSchema.extend({
  source:z.enum(deviceSources),
  capturedAt:z.number().int().positive(),
  website:z.string().url().max(500).refine(value=>{
    try{return ['http:','https:'].includes(new URL(value).protocol);}catch{return false;}
  }).nullable().optional(),
  address:z.string().trim().max(320).nullable().optional(),
  codePostal:z.string().regex(/^\d{5}$/).nullable().optional(),
}).superRefine((item,ctx)=>{
  validatePagesJaunesProfile(item,ctx);
  const validSource=!!item.sourceUrl && validDeviceSourceUrl(item.source,item.sourceUrl);
  if(!validSource)
    ctx.addIssue({code:'custom',path:['sourceUrl'],message:'Ouvrez une fiche professionnelle conforme à la source.'});
  if(item.sourceUrl && validSource){
    const url=new URL(item.sourceUrl);
    if(url.username || url.password || (url.port && url.port!=='443') ||
      (item.source==='google_maps' && !url.pathname.startsWith('/maps/place/') && !(url.pathname.startsWith('/maps/search/') && item.collectionMode==='visible' && item.mapsDetail && normalizedIdentity(item.mapsDetail.title)===normalizedIdentity(item.company) && normalizedIdentity(item.mapsDetail.address)===normalizedIdentity(item.address||'') && !!item.codePostal)) ||
      (item.source==='pagesjaunes' && !/^\/pros\/\d{4,20}\/?$/.test(url.pathname)))
      ctx.addIssue({code:'custom',path:['sourceUrl'],message:'Ouvrez une fiche détaillée de cet établissement.'});
  }
  if(item.source==='societe_com' && item.siret && item.sourceUrl && validSource &&
    !new URL(item.sourceUrl).pathname.replace(/\/$/,'').endsWith('-'+item.siret.slice(0,9)+'.html'))
    ctx.addIssue({code:'custom',path:['siret'],message:'SIRET incohérent avec la fiche Societe.com.'});
  if(item.address && item.codePostal && !item.address.includes(item.codePostal))
    ctx.addIssue({code:'custom',path:['address'],message:'Adresse et code postal incohérents.'});
  if(['linkedin','facebook','instagram','tiktok'].includes(item.source) && item.collectionMode!=='manual')
    ctx.addIssue({code:'custom',path:['collectionMode'],message:'Confirmez les données visibles de la page professionnelle.'});
  if(item.capturedAt && (item.capturedAt>Date.now()+60000 || Date.now()-item.capturedAt>86400000))
    ctx.addIssue({code:'custom',path:['capturedAt'],message:'Capture expirée (24 h).'});
}).transform(item=>({...item,
  ...(item.source==='pagesjaunes'&&item.pagesjaunesProfile?.siren?{siren:item.pagesjaunesProfile.siren}:{}),
  ...(item.source==='societe_com' && item.sourceUrl ? {siren:new URL(item.sourceUrl).pathname.match(/-(\d{9})\.html/i)?.[1]}:{}),
  sourceDetails:capturedSourceDetails(item),
}));
export async function applyTargetCapture(tenantId:string,userId:string,prospectId:string,taskId:string,rawCapture:unknown,automatic=false,cloud?:{lease:string;result:Record<string,unknown>}){
  const parsed=targetCaptureSchema.safeParse(rawCapture);
  if(!parsed.success || !z.string().uuid().safeParse(prospectId).success || !z.string().uuid().safeParse(taskId).success)
    return {status:400,error:!parsed.success?'Capture invalide : '+[...new Set(parsed.error.issues.map(issue=>issue.path.join('.')+': '+issue.message))].join(' ; ').slice(0,450):'Identifiant de tâche ou de prospect invalide.'};
  const capture=parsed.data;
  if(capture.id!=='task_'+taskId)return {status:400,error:'Capture et tâche incohérentes.'};
  return db.transaction(async tx=>{
      if(cloud){
        const job=await tx.execute(sql`SELECT status,lease FROM cloud_browser_jobs WHERE id=${taskId} AND tenant_id=${tenantId} FOR UPDATE`);
        if(job.rows[0]?.status!=='running'||job.rows[0]?.lease!==cloud.lease)return {status:409,error:'La tâche a été annulée ou reprise ailleurs.'};
      }
      const complete=async(outcome:{status:number;filled:string[];conflicts:number;alreadyApplied:boolean})=>{
        if(cloud)await tx.execute(sql`UPDATE cloud_browser_jobs SET status='completed',result=${JSON.stringify({...cloud.result,applied:outcome})}::jsonb,lease=NULL,lease_until=NULL,updated_at=NOW() WHERE id=${taskId} AND tenant_id=${tenantId}`);
        return outcome;
      };
      const [prospect]=await tx.select().from(prospectsTable).where(and(
        eq(prospectsTable.id,prospectId),eq(prospectsTable.tenantId,tenantId),
      )).for('update');
      if(!prospect)return {status:404,error:'Prospect introuvable.'};
      const observations=jsonRecord(jsonRecord(prospect.sourceDetails).crossSource).observations;
      if(Array.isArray(observations) && observations.some(o=>jsonRecord(o).captureId===capture.id))
        return complete({status:200,filled:[],conflicts:0,alreadyApplied:true});
      const knownSiren=prospect.siren || prospect.siret?.slice(0,9);
      const incomingSiren=capture.siren || capture.siret?.slice(0,9);
      // A company page describes its headquarters. Reuse legal-entity details
      // only when SIREN is already confirmed; never move the prospect's site.
      const legalOnly=!!(automatic&&cloud&&['societe_com','pappers'].includes(capture.source)&&capture.companyDetails&&knownSiren&&knownSiren===incomingSiren&&prospect.siret&&capture.siret&&prospect.siret!==capture.siret);
      if((knownSiren && incomingSiren && knownSiren!==incomingSiren) ||
        (!legalOnly && prospect.siret && capture.siret && prospect.siret!==capture.siret))
        return {status:409,error:'L’identité juridique ou l’établissement diffère de ce prospect.'};
      const legalMatch=!!(knownSiren && incomingSiren===knownSiren);
      const exactSite=!!(prospect.siret && capture.siret===prospect.siret);
      if(!legalOnly && !exactSite && ((!legalMatch && normalizedIdentity(prospect.company||'')!==normalizedIdentity(capture.company)) ||
        (prospect.city && capture.city && normalizedIdentity(prospect.city)!==normalizedIdentity(capture.city)))
      )
        return {status:409,error:'Le nom ou la ville diffère. Vérifiez la fiche et son établissement avant enrichissement.'};
      if(automatic&&!legalOnly&&!captureIdentityMatches(prospect,capture))return {status:409,error:'L’établissement ne correspond pas avec certitude. Vérifiez ses coordonnées.'};
      const projected=legalOnly?{...capture,siret:null,address:null,codePostal:null,city:null,phone:null,email:null,website:null,apeCode:null,nafLabel:null,nafVersion:null,
        sourceDetails:{[capture.source]:{...jsonRecord(jsonRecord(capture.sourceDetails)[capture.source]),scope:'unite_legale',headquarters:{siret:capture.siret,address:capture.address,city:capture.city}}}}:capture;
      const merged=await mergeProspectCapture(prospect,{...projected,targetedIdentity:true},false,tenantId,tx,userId,automatic && exactSite && capture.source==='societe_com' ? ['company','address','postalCode','city','apeCode','nafLabel','nafVersion'] : []);
      return complete({status:200,filled:merged.filled,conflicts:merged.conflicts,alreadyApplied:false});
    });
}
router.post('/device/prospects/:id/enrich-capture',requireAuth,async(req,res)=>{
  const parsed=z.object({taskId:z.string().uuid(),confirmed:z.literal(true),capture:z.unknown()}).strict().safeParse(req.body);
  if(!parsed.success){res.status(400).json({error:'Confirmez une capture valide du prospect ciblé.'});return;}
  try{
    const result=await applyTargetCapture(req.auth!.tenantId,req.auth!.userId,String(req.params.id),parsed.data.taskId,parsed.data.capture);
    res.status(result.status).json(result);
  }catch(error){
    if(isProspectIdentityDuplicate(error)){res.status(409).json({error:'Ce SIRET est déjà utilisé par un autre prospect.'});return;}
    throw error;
  }
});

router.post('/device/prospects/:id/societe-enrich', requireAuth, async (req, res) => {
  const prospectId = z.string().uuid().safeParse(req.params.id);
  if (!prospectId.success) { res.status(400).json({error:'Identifiant prospect invalide'}); return; }
  const parsed = z.object({capture: deviceCandidateSchema, confirmed: z.literal(true)}).strict().safeParse(req.body);
  if (!parsed.success || parsed.data.capture.source !== 'societe_com') {
    res.status(400).json({error:'Confirmez une fiche Societe.com valide avant enrichissement.'}); return;
  }
  const [prospect] = await db.select().from(prospectsTable).where(and(
    eq(prospectsTable.id,prospectId.data),eq(prospectsTable.tenantId,req.auth!.tenantId),
  )).limit(1);
  if (!prospect) { res.status(404).json({error:'Prospect introuvable'}); return; }
  const incoming = parsed.data.capture;
  const knownSiren = prospect.siren || prospect.siret?.slice(0,9);
  if ((knownSiren && knownSiren !== incoming.siren) ||
      (prospect.siret && incoming.siret && prospect.siret !== incoming.siret)) {
    res.status(409).json({error:'L’identité juridique ou l’établissement de la fiche Societe.com diffère de ce prospect.'}); return;
  }
  if (!knownSiren && !sameEstablishment(prospect,incoming,false) &&
      (normalizedIdentity(prospect.company || '') !== normalizedIdentity(incoming.company) ||
       (prospect.city && incoming.city && normalizedIdentity(prospect.city) !== normalizedIdentity(incoming.city)))) {
    res.status(409).json({error:'La société ou la ville diffère. Vérifiez le rapprochement et le SIREN avant enrichissement.'}); return;
  }
  const merged = await mergeProspectCapture(prospect,incoming,false,req.auth!.tenantId,db,req.auth!.userId);
  res.json({enriched:merged.filled.length>0,conflicts:merged.conflicts});
});

// Entrée directe des captures de l'extension vers Prospects, sans job sourcing.
// Aucun identifiant, code postal ou adresse n'est déduit d'une requête Google.
export type CaptureImportOutcome={captureId:string;status:'imported'|'enriched'|'already_present'|'needs_review'|'failed'|'missing';prospectId?:string;message?:string;at?:string};
export const deviceImportSchema=z.object({
    verified:z.array(deviceCandidateSchema).max(25).default([]),
    drafts:z.array(deviceDraftSchema).max(25).default([]),
  }).strict().refine(data=>data.verified.length+data.drafts.length>0 &&
    data.verified.length+data.drafts.length<=25);
export async function importParsedCaptures(data:z.infer<typeof deviceImportSchema>,tenantId:string,userId:string,
  executor:Pick<typeof db,'select'|'update'|'insert'>=db,recoverIdentityRace=true){
  let imported=0,enriched=0,skipped=0,conflicts=0;
  const reviews:{prospectId:string;company:string;fields:string[];type:'conflict'|'ambiguous'|'identity'}[]=[];
  const processedIds:string[]=[];
  const outcomes:CaptureImportOutcome[]=[];
  const receipt=(item:ImportCapture,status:CaptureImportOutcome['status'],prospectId?:string,message?:string)=>outcomes.push({captureId:item.id,status,prospectId,message,at:new Date().toISOString()});
  const usedIds=new Set<string>();
  for(const entry of [...data.verified.map(value=>({item:value,incomplete:false})),
    ...data.drafts.map(value=>({item:value,incomplete:true}))]){
    const {item,incomplete}=entry;
    if(usedIds.has(item.id)){skipped++;continue;}
    usedIds.add(item.id);
    const company=normalizedIdentity(item.company);
    const phone=normalizedPhone(item.phone);
    const address=normalizedIdentity(item.address||'');
    const city=normalizedIdentity(item.city||'');
    const website=String(item.website||'').toLowerCase();
    if(incomplete && !phone && !website && !address){skipped++;receipt(item,'failed',undefined,'Données insuffisantes pour identifier un établissement.');continue;}
    const siret=!incomplete && 'siret' in item ? item.siret : null;
    const profileUrl=captureProfileUrl(item.sourceUrl);
    const where=[ilike(prospectsTable.company,item.company)];
    const legalId = !incomplete && 'siren' in item ? item.siren : null;
    if(legalId)where.push(eq(prospectsTable.siren,legalId));
    if(siret)where.push(eq(prospectsTable.siret,siret));
    if(profileUrl)where.push(eq(prospectsTable.sourceUrl,profileUrl));
    const linkedinProfile=professionalSourceUrl('linkedin',item.sourceUrl);
    if(linkedinProfile)where.push(linkedinProfilePredicate(linkedinProfile));
    const priorQuery=executor.select().from(prospectsTable).where(and(
      eq(prospectsTable.tenantId,tenantId),or(...where),
    )).limit(100);
    const prior=await (recoverIdentityRace?priorQuery:priorQuery.for('update'));
    const matches=prior.filter(record=>sameEstablishment(record,item,incomplete));
    if(!matches.length && legalId && prior.some(record=>record.siren===legalId)){
      skipped++;
      reviews.push({prospectId:'',company:item.company,fields:['siren'],type:'ambiguous'});
      receipt(item,'needs_review',undefined,'Plusieurs établissements possibles pour ce SIREN.');
      continue;
    }
    if(!matches.length){
      const ambiguousProfiles=ambiguousLinkedinProfiles(prior,item);
      if(ambiguousProfiles.length){
        skipped++;reviews.push({prospectId:ambiguousProfiles.length===1?ambiguousProfiles[0].id:'',company:item.company,fields:['linkedinUrl','address'],type:'ambiguous'});receipt(item,'needs_review',ambiguousProfiles.length===1?ambiguousProfiles[0].id:undefined,'Vérifiez l’établissement de cette page LinkedIn.');continue;
      }
    }
    if(matches.length>1){
      skipped++;reviews.push({prospectId:'',company:item.company,fields:[],type:'ambiguous'});receipt(item,'needs_review',undefined,'Plusieurs fiches CRM correspondent.');continue;
    }
    if(matches.length===1){
      if(siret && matches[0].siret===siret && matches[0].company && normalizedIdentity(matches[0].company)!==company){
        skipped++;reviews.push({prospectId:matches[0].id,company:item.company,fields:['company','siret'],type:'identity'});receipt(item,'needs_review',matches[0].id,'Même SIRET, nom différent : confirmation nécessaire.');continue;
      }
      const merged=await mergeProspectCapture(matches[0],item,incomplete,tenantId,executor,userId).catch((error:unknown)=>{
        if(recoverIdentityRace && isProspectIdentityDuplicate(error))return null;
        throw error;
      });
      if(!merged){skipped++;receipt(item,'needs_review',undefined,'Identifiant déjà utilisé : vérifiez la fiche existante.');continue;}
      if(merged.filled.length)enriched++;else skipped++;
      conflicts+=merged.conflicts;
      if(merged.newConflicts.length)reviews.push({prospectId:matches[0].id,company:item.company,
        fields:merged.newConflicts.map(c=>c.field),type:'conflict'});
      const unresolved=captureHasPendingConflict(matches[0],item,incomplete);
      receipt(item,merged.newConflicts.length||unresolved?'needs_review':merged.filled.length?'enriched':'already_present',matches[0].id,
        merged.newConflicts.length||unresolved?'Des valeurs différentes restent à vérifier sur la fiche CRM.':undefined);
      processedIds.push(item.id);continue;
    }
    const [created]=await executor.insert(prospectsTable).values({
      company:item.company,address:item.address||null,
      postalCode:!incomplete && 'codePostal' in item ? item.codePostal : null,
      city:item.city||null,phone:item.phone||null,website:item.website||null,
      ...incomingFields(item,incomplete),
      source:item.source,sourceUrl:profileUrl,
      sourceDetails:{...('sourceDetails' in item ? item.sourceDetails : {}),browserCapture:{source:item.source,sourceUrl:item.sourceUrl,
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
      status:'new',tenantId:tenantId,createdBy:userId,
     }).onConflictDoNothing().returning({id:prospectsTable.id}).catch((error:unknown)=>{
      // A BEFORE INSERT trigger can raise before ON CONFLICT is evaluated.
      // Keep prior processedIds and continue the remaining selection.
      if(recoverIdentityRace && isProspectIdentityDuplicate(error))return [];
      throw error;
    });
    if(created){imported++;processedIds.push(item.id);receipt(item,'imported',created.id);}else{skipped++;receipt(item,'needs_review',undefined,'Identifiant déjà utilisé : vérifiez la fiche existante.');}
  }
  return {imported,enriched,skipped,conflicts,reviews,selected:usedIds.size,processedIds,outcomes};
}
router.post('/device/import-prospects',requireAuth,async(req,res)=>{
  const parsed=deviceImportSchema.safeParse(req.body);
  if(!parsed.success){res.status(400).json({error:'Sélection invalide (25 fiches maximum)',details:parsed.error.issues});return;}
  res.json(await importParsedCaptures(parsed.data,req.auth!.tenantId,req.auth!.userId));
});

// Chaque désaccord reste en attente jusqu'au choix explicite d'un utilisateur du tenant.
router.post('/device/prospects/:id/resolve-conflict',requireAuth,async(req,res)=>{
  const id=z.string().uuid().safeParse(req.params.id);
  const parsed=z.object({conflictId:z.string().uuid(),decision:z.enum(['keep_existing','use_incoming'])})
    .strict().safeParse(req.body);
  if(!id.success || !parsed.success){res.status(400).json({error:'Décision de fusion invalide'});return;}
  const result=await db.transaction(async tx=>{
    const [prospect]=await tx.select().from(prospectsTable).where(and(
      eq(prospectsTable.id,id.data),eq(prospectsTable.tenantId,req.auth!.tenantId),
    )).for('update');
    if(!prospect)return {status:404,error:'Prospect introuvable'};
    const details=jsonRecord(prospect.sourceDetails),crossSource=jsonRecord(details.crossSource);
    const conflicts=Array.isArray(crossSource.conflicts)?crossSource.conflicts as EnrichmentConflict[]:[];
    const found=conflicts.find(c=>c.id===parsed.data.conflictId&&FIELDS.includes(c.field));
    if(!found)return {status:404,error:'Conflit déjà résolu ou introuvable'};
    if(stringOrEmpty(prospect[found.field])!==found.existing)
      return {status:409,error:'La valeur CRM a changé. Rechargez la fiche avant de trancher.'};
    const apply=parsed.data.decision==='use_incoming';
    const fieldSources=jsonRecord(crossSource.fieldSources);
    if(apply)fieldSources[found.field]={source:found.source,sourceUrl:found.sourceUrl,capturedAt:found.capturedAt,resolvedAt:new Date().toISOString()};
    const resolutions=Array.isArray(crossSource.resolutions)?crossSource.resolutions as unknown[]:[];
    const nextDetails={...details,crossSource:{...crossSource,fieldSources,conflicts:conflicts.filter(c=>c.id!==found.id),
      resolutions:[...resolutions,{...found,decision:parsed.data.decision,resolvedAt:new Date().toISOString()}].slice(-80)}};
    const update=apply?{[found.field]:found.incoming,...(['address','city','postalCode'].includes(found.field)?{lat:null,lng:null}:{})}:{};
    const [updated]=await tx.update(prospectsTable).set({...update,sourceDetails:nextDetails,updatedAt:new Date()})
      .where(and(eq(prospectsTable.id,prospect.id),eq(prospectsTable.tenantId,req.auth!.tenantId))).returning();
    await tx.insert(activitiesTable).values({type:'data_update',title:apply?'Correction validée · '+found.field:'Proposition écartée · '+found.field,
      description:changeDescription(found.source,found.sourceUrl,apply?{[found.field]:{before:found.existing,after:found.incoming}}:{},
        apply?'Nouvelle valeur validée par l’utilisateur.':`Valeur conservée : ${found.existing}. Proposition écartée : ${found.incoming}.`,found.capturedAt),
      prospectId:prospect.id,tenantId:req.auth!.tenantId,createdBy:req.auth!.userId,doneAt:new Date()});
    return {status:200,prospect:updated};
  });
  res.status(result.status).json(result);
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
    sources: z.array(z.enum(['entreprises',...deviceSources])).min(1).max(deviceSources.length + 1)
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
      ...item, siren: item.siret?.slice(0, 9) || item.siren || "", siret: item.siret || null,
      city: item.city || null, phone: item.phone || null,
      website: item.website || null, sourceUrl: item.sourceUrl || null,
      source: item.source, sources: [item.source],
      sourceDetails: {...item.sourceDetails, [item.source]: {
        ...jsonRecord(jsonRecord(item.sourceDetails)[item.source]),
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
    const candidates = params.results;
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
        || (candidate.source==='entreprises'?'annuaire-entreprises':candidate.source||(job.type==='pagesjaunes'?'pagesjaunes':'annuaire-entreprises')),
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
    const linkedinProfile=professionalSourceUrl('linkedin',incoming.sourceUrl);
    if(linkedinProfile)alternatives.push(linkedinProfilePredicate(linkedinProfile));
    const existing=await db.select().from(prospectsTable).where(and(
      eq(prospectsTable.tenantId,req.auth!.tenantId),or(...alternatives),
    )).limit(100);
    const matches=existing.filter(prospect=>sameEstablishment(prospect,incoming,false));
    if(!matches.length && ambiguousLinkedinProfiles(existing,incoming).length){skipped++;continue;}
    if(matches.length>1){skipped++;continue;}
    if(matches.length===1){
      const outcome=await mergeProspectCapture(matches[0],incoming,false,req.auth!.tenantId,db,req.auth!.userId).catch((error:unknown)=>{
        if(isProspectIdentityDuplicate(error))return null;
        throw error;
      });
      if(!outcome){skipped++;continue;}
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
      linkedinUrl: incomingFields(incoming,false).linkedinUrl || null,
      apeCode: candidate.apeCode || null,
      nafLabel: candidate.nafLabel || null,
      nafVersion: candidate.nafVersion || null,
      sourceDetails: candidate.sourceDetails || {},
      source: incoming.source,
      sourceUrl: candidate.sourceUrl || null,
      status: "new", tenantId: req.auth!.tenantId, createdBy: req.auth!.userId,
     }).onConflictDoNothing().returning({ id: prospectsTable.id }).catch((error:unknown)=>{
      if(isProspectIdentityDuplicate(error))return [];
      throw error;
    });
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
