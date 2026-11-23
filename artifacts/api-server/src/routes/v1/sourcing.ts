import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { sourcingJobsTable, prospectsTable } from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { requireAuth } from "../../middlewares/auth";
import { logger } from "../../lib/logger";
import { DEPARTMENT_TO_REGION, departmentFromPostalCode } from "../../lib/france-geo";

const router = Router();

const jobSchema = z.object({
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
});

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
  siren: string;
  siret: string | null;
  company: string;
  address: string | null;
  codePostal: string;
  city: string | null;
};
type SavedParams = {
  query?: string;
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
    params: parsed.data.params,
    status: "running",
    tenantId: req.auth!.tenantId,
    createdBy: req.auth!.userId,
  }).returning();
  const started = Date.now();
  try {
    const results = await searchFrenchCompanies(parsed.data.params);
    const [finished] = await db.update(sourcingJobsTable).set({
      status: "completed", count: results.length, progress: 100,
      params: { ...parsed.data.params, results },
      duration: `${((Date.now() - started) / 1000).toFixed(1)} s`,
      updatedAt: new Date(),
    }).where(and(eq(sourcingJobsTable.id, job.id), eq(sourcingJobsTable.tenantId, req.auth!.tenantId))).returning();
    res.status(201).json(finished);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Recherche indisponible";
    logger.warn({ jobId: job.id, message }, "Official company directory failed");
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
    const candidates = params.results.slice(0, 25);
    const sirens = candidates.map(r => r.siren).filter(s => /^\d{9}$/.test(s));
    const existing = sirens.length ? await db.select({
      id: prospectsTable.id, siren: prospectsTable.siren,
    }).from(prospectsTable).where(and(
      eq(prospectsTable.tenantId, req.auth!.tenantId), inArray(prospectsTable.siren, sirens),
    )) : [];
    const bySiren = new Map(existing.map(p => [p.siren, p.id]));
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
        || (candidate.address ? byLegacy.get(`${candidate.company}|${candidate.address}`) : undefined) || null;
      return { ...candidate, imported: Boolean(prospectId), prospectId };
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
  const parsed = z.object({ sirens: z.array(z.string().regex(/^\d{9}$/)).min(1).max(25) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Sélection invalide" });
    return;
  }
  const job = await getJob(String(req.params.id), req.auth!.tenantId);
  if (!job) { res.status(404).json({ error: "Recherche introuvable" }); return; }
  const candidates = savedParams(job).results;
  if (!Array.isArray(candidates) || job.status !== "completed") {
    res.status(409).json({ error: "Cette recherche n'est pas importable. Relancez une recherche." });
    return;
  }
  const requested = [...new Set(parsed.data.sirens)];
  const eligible = candidates.filter(candidate => requested.includes(candidate.siren));
  if (eligible.length !== requested.length) {
    res.status(400).json({ error: "Une entreprise sélectionnée ne fait pas partie de cette recherche" });
    return;
  }

  let imported = 0;
  let skipped = 0;
  for (const candidate of eligible) {
    const [bySiren] = await db.select({ id: prospectsTable.id }).from(prospectsTable).where(and(
      eq(prospectsTable.tenantId, req.auth!.tenantId), eq(prospectsTable.siren, candidate.siren),
    )).limit(1);
    if (bySiren) { skipped++; continue; }

    // Older automatically imported entries did not store SIREN. Avoid copying
    // their exact company + address into the CRM a second time.
    const [legacy] = candidate.address ? await db.select({ id: prospectsTable.id }).from(prospectsTable).where(and(
      eq(prospectsTable.tenantId, req.auth!.tenantId),
      eq(prospectsTable.company, candidate.company),
      eq(prospectsTable.address, candidate.address),
    )).limit(1) : [];
    if (legacy) { skipped++; continue; }

    const inserted = await db.insert(prospectsTable).values({
      siren: candidate.siren, siret: candidate.siret, company: candidate.company,
      address: candidate.address, postalCode: candidate.codePostal, city: candidate.city,
      status: "new", tenantId: req.auth!.tenantId, createdBy: req.auth!.userId,
    }).onConflictDoNothing().returning({ id: prospectsTable.id });
    if (inserted.length) imported++; else skipped++;
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
