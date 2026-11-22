import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { sourcingJobsTable, prospectsTable } from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { requireAuth } from "../../middlewares/auth";
import { logger } from "../../lib/logger";

const router = Router();

const jobSchema = z.object({
  type: z.literal("entreprises"),
  name: z.string().trim().min(1).max(120),
  params: z.object({
    query: z.string().trim().min(3).max(120),
    limit: z.coerce.number().int().min(1).max(25).optional().default(10),
  }),
});

type CompanyRecord = {
  siren?: string;
  nom_complet?: string;
  nom_raison_sociale?: string;
  siege?: { adresse?: string };
};

/** Actual public-data company import. No fake scraping or guessed contacts. */
async function importFrenchCompanies(jobId: string, tenantId: string, userId: string,
  params: { query: string; limit: number }): Promise<number> {
  const start = Date.now();
  // Optional override supports deterministic integration tests and mirrors;
  // this URL is server-controlled, never accepted from a prospect or request.
  const url = new URL(process.env.COMPANY_DIRECTORY_API_URL ?? "https://recherche-entreprises.api.gouv.fr/search");
  url.searchParams.set("q", params.query);
  url.searchParams.set("per_page", String(params.limit));
  url.searchParams.set("page", "1");
  const response = await fetch(url, {
    headers: { "Accept": "application/json", "User-Agent": "GrowthOS/1.0 (B2B prospect research)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Annuaire des entreprises : HTTP ${response.status}`);
  const body = await response.json() as { results?: CompanyRecord[] };
  if (!Array.isArray(body.results)) throw new Error("Réponse incorrecte de l'annuaire des entreprises");

  let imported = 0;
  const importedIds: string[] = [];
  for (const result of body.results.slice(0, params.limit)) {
    const company = (result.nom_complet ?? result.nom_raison_sociale ?? "").trim();
    if (!company) continue;
    const address = result.siege?.adresse?.trim() || null;
    // Only actual public company data is imported: never fabricate a
    // personal email, contact name or website from the legal register.
    const [prospect] = await db.insert(prospectsTable).values({
      company,
      address,
      status: "new",
      tenantId,
      createdBy: userId,
    }).returning({ id: prospectsTable.id });
    importedIds.push(prospect.id);
    imported++;
  }
  await db.update(sourcingJobsTable).set({
    status: "completed", count: imported, progress: 100,
    params: { ...params, importedIds },
    duration: `${((Date.now() - start) / 1000).toFixed(1)} s`, updatedAt: new Date(),
  }).where(and(eq(sourcingJobsTable.id, jobId), eq(sourcingJobsTable.tenantId, tenantId)));
  return imported;
}

router.get("/jobs", requireAuth, async (req, res) => {
  const rows = await db.select().from(sourcingJobsTable)
    .where(eq(sourcingJobsTable.tenantId, req.auth!.tenantId))
    .orderBy(desc(sourcingJobsTable.createdAt))
    .limit(100);
  res.json(rows);
});

router.post("/jobs", requireAuth, async (req, res) => {
  const parse = jobSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Données invalides", details: parse.error.issues });
    return;
  }
  const [job] = await db.insert(sourcingJobsTable).values({
    type: parse.data.type,
    name: parse.data.name,
    params: parse.data.params,
    status: "running",
    tenantId: req.auth!.tenantId,
    createdBy: req.auth!.userId,
  }).returning();
  try {
    await importFrenchCompanies(job.id, req.auth!.tenantId, req.auth!.userId, parse.data.params);
    const [finished] = await db.select().from(sourcingJobsTable).where(eq(sourcingJobsTable.id, job.id));
    res.status(201).json(finished);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import impossible";
    logger.warn({ jobId: job.id, message }, "French company sourcing failed");
    await db.update(sourcingJobsTable).set({ status: "error", error: message, updatedAt: new Date() })
      .where(eq(sourcingJobsTable.id, job.id));
    res.status(502).json({ error: "Recherche indisponible", detail: message, jobId: job.id });
  }
});

router.get("/jobs/:id", requireAuth, async (req, res) => {
  const [job] = await db.select().from(sourcingJobsTable)
    .where(and(
      eq(sourcingJobsTable.id, String(req.params.id)),
      eq(sourcingJobsTable.tenantId, req.auth!.tenantId),
    ))
    .limit(1);
  if (!job) { res.status(404).json({ error: "Job introuvable" }); return; }
  res.json(job);
});

router.get("/jobs/:id/results", requireAuth, async (req, res) => {
  const [job] = await db.select().from(sourcingJobsTable)
    .where(and(eq(sourcingJobsTable.id, String(req.params.id)), eq(sourcingJobsTable.tenantId, req.auth!.tenantId)))
    .limit(1);
  if (!job) { res.status(404).json({ error: "Job introuvable" }); return; }
  const params = (job.params ?? {}) as { importedIds?: unknown };
  const ids = Array.isArray(params.importedIds)
    ? params.importedIds.filter((id): id is string => typeof id === "string" && /^[a-f0-9-]{36}$/i.test(id)).slice(0, 25)
    : [];
  if (!ids.length) { res.json({ data: [], total: 0 }); return; }
  const prospects = await db.select().from(prospectsTable)
    .where(and(eq(prospectsTable.tenantId, req.auth!.tenantId), inArray(prospectsTable.id, ids)));
  res.json({ data: prospects, total: prospects.length });
});

router.patch("/jobs/:id", requireAuth, async (req, res) => {
  const allowed = z.object({
    status: z.enum(["queued", "running", "paused", "completed", "error"]).optional(),
    count: z.number().int().optional(),
    progress: z.number().int().min(0).max(100).optional(),
    duration: z.string().optional(),
    error: z.string().nullable().optional(),
  }).safeParse(req.body);
  if (!allowed.success) {
    res.status(400).json({ error: "Données invalides" });
    return;
  }
  const [updated] = await db.update(sourcingJobsTable)
    .set({ ...allowed.data, updatedAt: new Date() })
    .where(and(
      eq(sourcingJobsTable.id, String(req.params.id)),
      eq(sourcingJobsTable.tenantId, req.auth!.tenantId),
    ))
    .returning();
  if (!updated) { res.status(404).json({ error: "Job introuvable" }); return; }
  res.json(updated);
});

router.delete("/jobs/:id", requireAuth, async (req, res) => {
  await db.delete(sourcingJobsTable).where(
    and(
      eq(sourcingJobsTable.id, String(req.params.id)),
      eq(sourcingJobsTable.tenantId, req.auth!.tenantId),
    )
  );
  res.status(204).send();
});

export default router;
