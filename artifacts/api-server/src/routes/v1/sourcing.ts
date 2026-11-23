import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { sourcingJobsTable, prospectsTable } from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";
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
};
type CompanyRecord = {
  siren?: string;
  nom_complet?: string;
  nom_raison_sociale?: string;
  siege?: DirectoryAddress;
  matching_etablissements?: DirectoryAddress[];
};
type SearchCandidate = {
  id?: string; // Identifiant de source, utile sans SIREN
  source?: 'entreprises' | 'pagesjaunes';
  sources?: string[];
  siren: string;
  siret: string | null;
  company: string;
  address: string | null;
  codePostal: string;
  city: string | null;
  phone?: string | null;
  website?: string | null;
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

async function searchFrenchCompanies(params: GeoFilters): Promise<SearchCandidate[]> {
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
    signal: AbortSignal.timeout(15000),
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
    found.push({
      siren,
      siret: /^\d{14}$/.test(local.siret || "") ? local.siret! : null,
      company,
      address: local.adresse?.trim() || null,
      codePostal: local.code_postal!,
      city: local.libelle_commune?.trim() || null,
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
    const previous = merged.get(key);
    if (previous) {
      previous.sources = [...new Set([...(previous.sources || []), source])];
      previous.phone ||= candidate.phone;
      previous.website ||= candidate.website;
      previous.sourceUrl ||= candidate.sourceUrl;
      previous.siret ||= candidate.siret;
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
          const candidates = await searchPagesJaunes({ query: params.query, location, limit: params.limit, tenantId });
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
      ? await searchPagesJaunes({ ...parsed.data.params, tenantId: req.auth!.tenantId })
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
    const [bySiretRows, byUrlRows] = await Promise.all([
      sirets.length ? db.select({ id: prospectsTable.id, siret: prospectsTable.siret }).from(prospectsTable)
        .where(and(eq(prospectsTable.tenantId, req.auth!.tenantId), inArray(prospectsTable.siret, sirets))) : Promise.resolve([]),
      urls.length ? db.select({ id: prospectsTable.id, sourceUrl: prospectsTable.sourceUrl }).from(prospectsTable)
        .where(and(eq(prospectsTable.tenantId, req.auth!.tenantId), inArray(prospectsTable.sourceUrl, urls))) : Promise.resolve([]),
    ]);
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

  let imported = 0;
  let skipped = 0;
  for (const candidate of eligible) {
    if (/^\d{9}$/.test(candidate.siren)) {
      const [bySiren] = await db.select({ id: prospectsTable.id }).from(prospectsTable).where(and(
        eq(prospectsTable.tenantId, req.auth!.tenantId), eq(prospectsTable.siren, candidate.siren),
      )).limit(1);
      if (bySiren) { skipped++; continue; }
    }
    if (candidate.siret && /^\d{14}$/.test(candidate.siret)) {
      const [bySiret] = await db.select({ id: prospectsTable.id }).from(prospectsTable).where(and(
        eq(prospectsTable.tenantId, req.auth!.tenantId), eq(prospectsTable.siret, candidate.siret),
      )).limit(1);
      if (bySiret) { skipped++; continue; }
    }
    if (candidate.sourceUrl) {
      const [byUrl] = await db.select({ id: prospectsTable.id }).from(prospectsTable).where(and(
        eq(prospectsTable.tenantId, req.auth!.tenantId), eq(prospectsTable.sourceUrl, candidate.sourceUrl),
      )).limit(1);
      if (byUrl) { skipped++; continue; }
    }
    const [legacy] = candidate.address ? await db.select({ id: prospectsTable.id }).from(prospectsTable).where(and(
      eq(prospectsTable.tenantId, req.auth!.tenantId),
      eq(prospectsTable.company, candidate.company),
      eq(prospectsTable.address, candidate.address),
    )).limit(1) : [];
    if (legacy) { skipped++; continue; }

    const [insertedRow] = await db.insert(prospectsTable).values({
      siren: /^\d{9}$/.test(candidate.siren) ? candidate.siren : null,
      siret: candidate.siret || null,
      company: candidate.company,
      address: candidate.address,
      postalCode: candidate.codePostal || null,
      city: candidate.city,
      phone: candidate.phone || null,
      website: candidate.website || null,
      source: candidate.sources?.map(item => item === "entreprises" ? "annuaire-entreprises" : item).join(",")
        || (candidate.source === "pagesjaunes" || job.type === "pagesjaunes" ? "pagesjaunes" : "annuaire-entreprises"),
      sourceUrl: candidate.sourceUrl || null,
      status: "new", tenantId: req.auth!.tenantId, createdBy: req.auth!.userId,
    }).onConflictDoNothing().returning({ id: prospectsTable.id });
    if (insertedRow) imported++; else skipped++;
  }
  res.json({ imported, skipped, selected: requested.length });
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
