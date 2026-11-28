import { Router } from "express";
import { z } from "zod";
import { db,pool } from "@workspace/db";
import {mergeFields,previewProspectMerge,mergeProspects,ProspectMergeError,siretDuplicate,mergeArchiveProfile} from "../../services/prospect-merges";
import {isProspectIdentityDuplicate} from "../../lib/prospect-identity";
import {recordDiagnosticEvent,errorDiagnosticDetails} from "../../lib/diagnostics";
import { prospectsTable } from "@workspace/db";
import { eq, and, or, ilike, asc, desc, count, isNull, isNotNull, inArray, sql } from "drizzle-orm";

import { actionLogger } from "../../lib/ActionLogger";

const router = Router();
router.use(actionLogger);
router.use('/:id',(req,res,next)=>{if(z.string().uuid().safeParse(req.params.id).success)res.locals.prospectId=req.params.id;next();});

/* ─── Geocoding via Nominatim (OpenStreetMap — free, no key) ─── */

interface GeoResult { lat: number; lng: number }

async function geocodeAddress(address: string): Promise<GeoResult | null> {
  // Isolated integration recipes must never send their addresses to a public provider.
  if (process.env.GROWTHOS_SMOKE_TEST === "true") return null;
  if (!address?.trim()) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=fr,be,ch,lu,de,es,it,gb`;
    const res = await fetch(url, {
      headers: { "User-Agent": "GrowthOS-CRM/1.0 (contact@growthos.app)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { lat: string; lon: string }[];
    if (data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

/** Fire-and-forget geocoding for a single prospect row */
async function geocodeAndUpdate(id: string, address: string): Promise<void> {
  const coords = await geocodeAddress(address);
  if (!coords) return;
  await db.update(prospectsTable)
    .set({ lat: coords.lat, lng: coords.lng, updatedAt: new Date() })
    .where(eq(prospectsTable.id, id));
}

/* ─── Validation schemas ─── */

const prospectSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  company: z.string().optional(),
  siren: z.string().transform(value => value.replace(/\s/g, "")).pipe(z.string().regex(/^\d{9}$/).or(z.literal(""))).optional(),
  siret: z.string().transform(value => value.replace(/\s/g, "")).pipe(z.string().regex(/^\d{14}$/).or(z.literal(""))).optional(),
  apeCode: z.string().trim().toUpperCase().regex(/^\d{2}\.\d{2}[A-Z]$/).optional().or(z.literal("")),
  nafLabel: z.string().trim().max(250).optional(),
  nafVersion: z.string().trim().max(32).optional(),
  postalCode: z.string().regex(/^\d{5}$/).optional().or(z.literal("")),
  city: z.string().max(120).optional(),
  linkedinUrl: z.string().optional(),
  jobTitle: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  status: z.enum(["new", "contacted", "qualified", "negotiation", "won", "lost", "converted", "archived"]).optional().default("new"),
  score: z.number().int().min(0).max(100).optional(),
  isStarred: z.boolean().optional(),
});

const patchProspectSchema = prospectSchema.partial().extend({
  firstName: prospectSchema.shape.firstName.nullable(),
  lastName: prospectSchema.shape.lastName.nullable(),
  email: prospectSchema.shape.email.nullable(),
  phone: prospectSchema.shape.phone.nullable(),
  company: prospectSchema.shape.company.nullable(),
  siren: prospectSchema.shape.siren.nullable(),
  siret: prospectSchema.shape.siret.nullable(),
  apeCode: prospectSchema.shape.apeCode.nullable(),
  nafLabel: prospectSchema.shape.nafLabel.nullable(),
  nafVersion: prospectSchema.shape.nafVersion.nullable(),
  postalCode: prospectSchema.shape.postalCode.nullable(),
  city: prospectSchema.shape.city.nullable(),
  linkedinUrl: prospectSchema.shape.linkedinUrl.nullable(),
  jobTitle: prospectSchema.shape.jobTitle.nullable(),
  website: prospectSchema.shape.website.nullable(),
  address: prospectSchema.shape.address.nullable(),
  lat: prospectSchema.shape.lat.nullable(),
  lng: prospectSchema.shape.lng.nullable(),
  score: prospectSchema.shape.score.nullable(),
  isStarred: prospectSchema.shape.isStarred.nullable(),
});

async function withIdentityConflicts(prospect: typeof prospectsTable.$inferSelect) {
  const siret = prospect.siret?.replace(/\s/g, '');
  const identityConflicts = siret ? await db.select({id:prospectsTable.id,company:prospectsTable.company,siret:prospectsTable.siret})
    .from(prospectsTable).where(and(eq(prospectsTable.tenantId,prospect.tenantId),
      sql`${prospectsTable.id} <> ${prospect.id}`,
      sql`regexp_replace(${prospectsTable.siret}, '[[:space:]]', '', 'g') = ${siret}`)) : [];
  return {...prospect, identityConflicts, identityMismatch: Boolean(siret && prospect.siren && siret.slice(0,9)!==prospect.siren)};
}

/* ─── Routes ─── */

router.get("/", async (req, res) => {
  const { search, status, page = "1", limit = "50", geo, noGeo, apeCode, activitySearch, sortBy, sortDir } = req.query as Record<string, string>;
  const tenantId = req.auth!.tenantId;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const conditions = [eq(prospectsTable.tenantId, tenantId)];
  if (status && status !== "all") {
    conditions.push(eq(prospectsTable.status, status));
  }
  if (search) {
    conditions.push(or(
      ilike(prospectsTable.firstName, `%${search}%`),
      ilike(prospectsTable.lastName, `%${search}%`),
      ilike(prospectsTable.email, `%${search}%`),
      ilike(prospectsTable.company, `%${search}%`),
      ilike(prospectsTable.apeCode, `%${search}%`),
      ilike(prospectsTable.nafLabel, `%${search}%`),
    )!);
  }
  if (apeCode?.trim()) conditions.push(ilike(prospectsTable.apeCode, `${apeCode.trim()}%`));
  if (activitySearch?.trim()) conditions.push(ilike(prospectsTable.nafLabel, `%${activitySearch.trim()}%`));
  // ?noGeo=true → only prospects with an address but no coordinates yet
  if (noGeo === "true") {
    conditions.push(isNotNull(prospectsTable.address));
    conditions.push(isNull(prospectsTable.lat));
  }

  const where = and(...conditions);

  const sortColumns = {
    createdAt: prospectsTable.createdAt,
    company: prospectsTable.company,
    apeCode: prospectsTable.apeCode,
    nafLabel: prospectsTable.nafLabel,
  } as const;
  const sortColumn = sortColumns[(sortBy || 'createdAt') as keyof typeof sortColumns] || prospectsTable.createdAt;
  const ordering = sortDir === 'asc' ? asc(sortColumn) : desc(sortColumn);
  const rows = await db.select().from(prospectsTable).where(where)
    .orderBy(ordering, desc(prospectsTable.createdAt), desc(prospectsTable.id))
    .limit(parseInt(limit)).offset(offset);
  const [{ total }] = await db.select({ total: count() }).from(prospectsTable).where(where);

  // When ?geo=1 is requested, also return a geoOnly list (prospects with coords, up to 500)
  if (geo === "1") {
    const geoRows = await db.select().from(prospectsTable)
      .where(and(
        eq(prospectsTable.tenantId, tenantId),
        // SQL expression to filter non-null lat/lng
        ...([eq(prospectsTable.tenantId, tenantId)] as any[]),
      ))
      .orderBy(desc(prospectsTable.score))
      .limit(500);
    const withCoords = geoRows.filter(r => r.lat != null && r.lng != null);
    res.json({ data: rows, total: Number(total), page: parseInt(page), limit: parseInt(limit), geo: withCoords });
    return;
  }

  res.json({ data: rows, total: Number(total), page: parseInt(page), limit: parseInt(limit) });
});

router.get("/map", async (req, res) => {
  const tenantId = req.auth!.tenantId;
  // Return all prospects that have coordinates, up to 1000
  const rows = await db.select({
    id: prospectsTable.id,
    firstName: prospectsTable.firstName,
    lastName: prospectsTable.lastName,
    company: prospectsTable.company,
    address: prospectsTable.address,
    lat: prospectsTable.lat,
    lng: prospectsTable.lng,
    status: prospectsTable.status,
    score: prospectsTable.score,
    phone: prospectsTable.phone,
    email: prospectsTable.email,
  })
    .from(prospectsTable)
    .where(eq(prospectsTable.tenantId, tenantId))
    .orderBy(desc(prospectsTable.score))
    .limit(1000);

  const withCoords = rows.filter(r => r.lat != null && r.lng != null);
  res.json({ data: withCoords, total: withCoords.length, hasGeo: withCoords.length > 0 });
});

const mergeContextSchema=z.object({otherId:z.string().uuid(),jobId:z.string().uuid().optional(),runId:z.string().uuid().optional(),captureIndex:z.number().int().min(0).max(100).default(0)}).strict();
router.post('/:id/merge-preview',async(req,res)=>{
 const id=z.string().uuid().parse(req.params.id),data=mergeContextSchema.parse(req.body);
 res.json(await previewProspectMerge(req.auth!.tenantId,req.auth!.userId,id,data));
});
router.post('/:id/merge',async(req,res)=>{
 const id=z.string().uuid().parse(req.params.id),data=mergeContextSchema.extend({mergeKey:z.string().uuid(),proofDigest:z.string().regex(/^[a-f0-9]{64}$/),survivorId:z.string().uuid(),confirmed:z.literal(true),expectedVersions:z.record(z.string().uuid(),z.string().datetime()),replaceFields:z.array(z.enum(mergeFields)).max(mergeFields.length).default([])}).parse(req.body);
 const result=await mergeProspects(req.auth!.tenantId,req.auth!.userId,id,data);
 void recordDiagnosticEvent({tenantId:req.auth!.tenantId,userId:req.auth!.userId,traceId:req.traceId,level:'info',component:'crm-merge',code:result.alreadyMerged?'PROSPECT_MERGE_REPLAYED':'PROSPECTS_MERGED',message:'Fusion contrôlée de deux fiches prospect enregistrée',prospectId:result.prospectId,jobId:data.jobId,details:{mergeId:result.mergeId,alreadyMerged:result.alreadyMerged}});
 res.json(result);
});
router.get('/:id/merges',async(req,res)=>{
 const id=z.string().uuid().parse(req.params.id);
 const rows=await pool.query('SELECT id,removed_id,created_at,archive FROM prospect_merge_receipts WHERE tenant_id=$1 AND survivor_id=$2 ORDER BY created_at DESC',[req.auth!.tenantId,id]);
 res.json(rows.rows.map(r=>({id:r.id,fromId:r.removed_id,createdAt:r.created_at,profiles:r.archive.prospects.map(mergeArchiveProfile),changes:r.archive.changes||{},archivedMonitoring:r.archive.monitoring.length,archivedEnrichments:r.archive.enrichmentData.length})));
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const [prospect] = await db.select().from(prospectsTable)
    .where(and(eq(prospectsTable.id, id), eq(prospectsTable.tenantId, req.auth!.tenantId)))
    .limit(1);
  if (!prospect) {
    const merged=(await pool.query('SELECT survivor_id FROM prospect_merge_receipts WHERE tenant_id=$1 AND removed_id=$2',[req.auth!.tenantId,id])).rows[0];
    if(merged?.survivor_id){const [canonical]=await db.select().from(prospectsTable).where(and(eq(prospectsTable.id,merged.survivor_id),eq(prospectsTable.tenantId,req.auth!.tenantId)));if(canonical){res.json({...await withIdentityConflicts(canonical),mergedFromId:id});return;}}
    res.status(404).json({ error: "Prospect introuvable" }); return;
  }
  res.json(await withIdentityConflicts(prospect));
});

// Complète une ancienne fiche (ou une fiche PagesJaunes) via un SIREN/SIRET
// existant. Jamais d'attribution d'activité par simple proximité de nom.
router.post('/:id/activity-enrich', async (req, res) => {
  const [prospect] = await db.select().from(prospectsTable).where(and(
    eq(prospectsTable.id, String(req.params.id)),
    eq(prospectsTable.tenantId, req.auth!.tenantId),
  )).limit(1);
  if (!prospect) { res.status(404).json({ error: 'Prospect introuvable' }); return; }
  const siren = /^\d{9}$/.test(prospect.siren || '') ? prospect.siren! :
    /^\d{14}$/.test(prospect.siret || '') ? prospect.siret!.slice(0, 9) : null;
  if (!siren) { res.status(422).json({ error: 'Un SIREN ou SIRET vérifié est nécessaire pour identifier l’activité.' }); return; }

  try {
    const url = new URL(process.env.COMPANY_DIRECTORY_API_URL || 'https://recherche-entreprises.api.gouv.fr/search');
    url.searchParams.set('q', siren);
    url.searchParams.set('per_page', '10');
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'GrowthOS/1.0 (public company directory)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Annuaire HTTP ${response.status}`);
    type ActivityRecord = { siren?:string; activite_principale?:string;libelle_activite_principale?:string;
      nomenclature_activite_principale?:string; siege?:ActivityLocation; matching_etablissements?:ActivityLocation[] };
    type ActivityLocation = { siret?:string;activite_principale?:string;libelle_activite_principale?:string;nomenclature_activite_principale?:string };
    const json = await response.json() as {results?:ActivityRecord[]};
    const legal = json.results?.find(item => item.siren === siren);
    if (!legal) { res.status(404).json({ error: 'Entreprise introuvable dans l’Annuaire officiel.' }); return; }
    const location = prospect.siret ? [...(legal.matching_etablissements||[]),...(legal.siege?[legal.siege]:[])]
      .find(item => item.siret === prospect.siret && item.activite_principale) : undefined;
    const value = location || legal;
    const apeCode = String(value.activite_principale || '').trim().toUpperCase();
    if (!/^\d{2}\.\d{2}[A-Z]$/.test(apeCode)) {
      res.status(404).json({ error: 'L’Annuaire ne fournit pas de code APE vérifiable pour cet établissement.' }); return;
    }
    if (prospect.apeCode && prospect.apeCode !== apeCode) {
      res.status(409).json({error:'Code APE différent de la fiche actuelle : vérifiez manuellement avant de remplacer.',
        existing:prospect.apeCode,incoming:apeCode});return;
    }
    const previous = (prospect.sourceDetails || {}) as Record<string,unknown>;
    const previousDirectory = previous.annuaire && typeof previous.annuaire === 'object' ?
      previous.annuaire as Record<string,unknown> : {};
    const [updated] = await db.update(prospectsTable).set({
      apeCode,
      nafLabel:prospect.nafLabel || value.libelle_activite_principale?.trim() || null,
      nafVersion:prospect.nafVersion || value.nomenclature_activite_principale?.trim() || null,
      sourceDetails:{...previous,annuaire:{...previousDirectory,
        apeScope:location?'etablissement':'unite_legale',activityVerifiedAt:new Date().toISOString()}},
      updatedAt:new Date(),
    }).where(and(eq(prospectsTable.id,prospect.id),eq(prospectsTable.tenantId,req.auth!.tenantId))).returning();
    res.json(updated);
  } catch {
    res.status(502).json({ error:'Impossible de consulter l’Annuaire officiel pour le moment.' });
  }
});

router.post("/", async (req, res) => {
  const parse = prospectSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Données invalides", details: parse.error.issues });
    return;
  }
  const { email, address, lat, lng, ...rest } = parse.data;
  for (const key of ['siren', 'siret', 'postalCode', 'apeCode'] as const) {
    if (rest[key] === '') rest[key] = null as never;
  }

  // If lat/lng provided manually, use them; otherwise geocode in background
  const [prospect] = await db.insert(prospectsTable).values({
    ...rest,
    email: email || null,
    address: address || null,
    lat: lat ?? null,
    lng: lng ?? null,
    tenantId: req.auth!.tenantId,
    createdBy: req.auth!.userId,
  }).returning();

  // Background geocoding if address given but no coords
  if (address && lat == null && lng == null) {
    geocodeAndUpdate(prospect.id, address).catch(() => {});
  }

  res.status(201).json(await withIdentityConflicts(prospect));
});

router.post("/bulk", async (req, res) => {
  const bulkSchema = z.object({
    prospects: z.array(prospectSchema.extend({ email: z.string().email() })
      .refine(p => Boolean(p.firstName?.trim() || p.lastName?.trim()), "Nom requis")).min(1).max(1000),
    duplicateMode: z.enum(["skip", "update", "create"]).default("skip"),
  });
  const parsed = bulkSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données d'import invalides", details: parsed.error.issues });
    return;
  }

  const { duplicateMode } = parsed.data;
  const tenantId = req.auth!.tenantId;
  const userId = req.auth!.userId;
  const rows = parsed.data.prospects.map(p => ({
    firstName: p.firstName?.trim() || null,
    lastName: p.lastName?.trim() || null,
    email: p.email.trim().toLowerCase(),
    phone: p.phone?.trim() || null,
    company: p.company?.trim() || null,
    siren: p.siren || null, siret: p.siret || null,
    postalCode: p.postalCode || null, city: p.city?.trim() || null,
    jobTitle: p.jobTitle?.trim() || null,
    website: p.website?.trim() || null,
    apeCode: p.apeCode?.trim() || null,
    nafLabel: p.nafLabel?.trim() || null,
    nafVersion: p.nafVersion?.trim() || null,
    address: p.address?.trim() || null,
    lat: p.lat ?? null,
    lng: p.lng ?? null,
    status: p.status,
    tenantId,
    createdBy: userId,
  }));

  const emails = [...new Set(rows.map(p => p.email))];
  const result = await db.transaction(async tx => {
    const existing = await tx.select({ id: prospectsTable.id, email: prospectsTable.email })
      .from(prospectsTable)
      .where(and(eq(prospectsTable.tenantId, tenantId),
        inArray(sql<string>`lower(trim(${prospectsTable.email}))`, emails)));
    const existingByEmail = new Map(
      existing.filter(p => p.email).map(p => [p.email!.trim().toLowerCase(), p.id]),
    );
    const pendingCreates: typeof rows = [];
    const pendingCreateIndex = new Map<string, number>();
    const pendingUpdates = new Map<string, { id: string; data: typeof rows[number] }>();
    let duplicates = 0;
    let skipped = 0;

    for (const row of rows) {
      const existingId = existingByEmail.get(row.email);
      const createIndex = pendingCreateIndex.get(row.email);
      const duplicate = existingId !== undefined || createIndex !== undefined;
      if (duplicate) duplicates++;
      if (duplicate && duplicateMode === "skip") { skipped++; continue; }
      if (existingId && duplicateMode === "update") {
        pendingUpdates.set(row.email, { id: existingId, data: row });
      } else if (createIndex !== undefined && duplicateMode === "update") {
        // Repeated email inside a single CSV: the last row wins.
        pendingCreates[createIndex] = row;
      } else {
        if (!pendingCreateIndex.has(row.email)) pendingCreateIndex.set(row.email, pendingCreates.length);
        pendingCreates.push(row);
      }
    }

    const inserted = pendingCreates.length
      ? await tx.insert(prospectsTable).values(pendingCreates).returning({
          id: prospectsTable.id, address: prospectsTable.address, lat: prospectsTable.lat,
        })
      : [];
    for (const { id, data } of pendingUpdates.values()) {
      await tx.update(prospectsTable).set({
        firstName: data.firstName, lastName: data.lastName, phone: data.phone,
        company: data.company, jobTitle: data.jobTitle, website: data.website,
        address: data.address, lat: data.lat, lng: data.lng, status: data.status,
        // Un CSV incomplet ne doit pas effacer une activité APE/NAF déjà fiable.
        ...(data.siren ? {siren:data.siren} : {}),
        ...(data.siret ? {siret:data.siret} : {}),
        ...(data.postalCode ? {postalCode:data.postalCode} : {}),
        ...(data.city ? {city:data.city} : {}),
        ...(data.apeCode ? { apeCode: data.apeCode } : {}),
        ...(data.nafLabel ? { nafLabel: data.nafLabel } : {}),
        ...(data.nafVersion ? { nafVersion: data.nafVersion } : {}),
        updatedAt: new Date(),
      }).where(and(eq(prospectsTable.id, id), eq(prospectsTable.tenantId, tenantId)));
    }
    return { inserted, imported: inserted.length, updated: pendingUpdates.size, duplicates, skipped };
  });

  // Background geocoding; never block the HTTP response for network lookups.
  const toGeocode = result.inserted.filter(r => r.address && r.lat == null);
  if (toGeocode.length) {
    (async () => {
      for (const [index, item] of toGeocode.entries()) {
        if (item.address) await geocodeAndUpdate(item.id, item.address);
        if (index < toGeocode.length - 1) await new Promise(r => setTimeout(r, 1200));
      }
    })().catch(() => {});
  }

  res.status(201).json({
    imported: result.imported, updated: result.updated,
    duplicates: result.duplicates, skipped: result.skipped,
    geocoding: toGeocode.length,
  });
});

router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const parse = patchProspectSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Données invalides" });
    return;
  }
  const { email, address, lat, lng, ...rest } = parse.data;
  const updateData: any = { ...rest, updatedAt: new Date() };
  for (const key of ["siren", "siret", "postalCode", "apeCode"] as const) {
    if (updateData[key] === "") updateData[key] = null;
  }
  if (email !== undefined) updateData.email = email || null;
  if (address !== undefined) updateData.address = address || null;
  if (lat !== undefined) updateData.lat = lat ?? null;
  if (lng !== undefined) updateData.lng = lng ?? null;

  const [updated] = await db.update(prospectsTable)
    .set(updateData)
    .where(and(eq(prospectsTable.id, id), eq(prospectsTable.tenantId, req.auth!.tenantId)))
    .returning();

  if (!updated) { res.status(404).json({ error: "Prospect introuvable" }); return; }

  // Re-geocode in background if address changed but no explicit coords provided
  if (address && lat == null && lng == null) {
    geocodeAndUpdate(id, address).catch(() => {});
  }

  res.json(await withIdentityConflicts(updated));
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const result = await db.delete(prospectsTable).where(
    and(eq(prospectsTable.id, id), eq(prospectsTable.tenantId, req.auth!.tenantId))
  ).returning({ id: prospectsTable.id });
  if (result.length === 0) {
    res.status(404).json({ error: "Prospect introuvable" });
    return;
  }
  res.json({ ok: true });
});

router.use(async(error:any,req:any,res:any,next:any)=>{
 if(error instanceof z.ZodError){res.status(400).json({error:'Paramètres de fusion invalides.',message:'Paramètres de fusion invalides.'});return;}
 if(error instanceof ProspectMergeError||isProspectIdentityDuplicate(error)){
  const duplicate=isProspectIdentityDuplicate(error);
  const other=duplicate&&res.locals.prospectId?await siretDuplicate(req.auth.tenantId,res.locals.prospectId,req.body?.siret):null;
  const code=duplicate?'CRM_IDENTITY_DUPLICATE':error.status===423?'CRM_MERGE_BUSY':'CRM_MERGE_CONFLICT';
  void recordDiagnosticEvent({tenantId:req.auth?.tenantId,userId:req.auth?.userId,traceId:req.traceId,level:'warn',component:'crm-merge',code,message:'Opération CRM suspendue pour vérification',prospectId:res.locals.prospectId,details:{...errorDiagnosticDetails(error),causeCode:code}});
  const message=duplicate?'Ce SIRET figure déjà sur une autre fiche de cette agence. Comparez les fiches avant de fusionner.':error.message;
  res.status(duplicate?409:error.status).json({error:message,message,code,duplicate:other,traceId:req.traceId});return;
 }
 next(error);
});
export default router;
