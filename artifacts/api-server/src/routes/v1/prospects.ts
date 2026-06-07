import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { prospectsTable } from "@workspace/db";
import { eq, and, or, ilike, desc, count, isNull, isNotNull } from "drizzle-orm";

import { actionLogger } from "../../lib/ActionLogger";

const router = Router();
router.use(actionLogger);

/* ─── Geocoding via Nominatim (OpenStreetMap — free, no key) ─── */

interface GeoResult { lat: number; lng: number }

async function geocodeAddress(address: string): Promise<GeoResult | null> {
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
  jobTitle: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  status: z.enum(["new", "contacted", "qualified", "negotiation", "won", "lost"]).optional().default("new"),
  score: z.number().int().min(0).max(100).optional(),
  isStarred: z.boolean().optional(),
});

/* ─── Routes ─── */

router.get("/", async (req, res) => {
  const { search, status, page = "1", limit = "50", geo, noGeo } = req.query as Record<string, string>;
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
    )!);
  }
  // ?noGeo=true → only prospects with an address but no coordinates yet
  if (noGeo === "true") {
    conditions.push(isNotNull(prospectsTable.address));
    conditions.push(isNull(prospectsTable.lat));
  }

  const where = and(...conditions);

  const [rows, [{ total }]] = await Promise.all([
    db.select().from(prospectsTable).where(where).orderBy(desc(prospectsTable.createdAt)).limit(parseInt(limit)).offset(offset),
    db.select({ total: count() }).from(prospectsTable).where(where),
  ]);

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

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const [prospect] = await db.select().from(prospectsTable)
    .where(and(eq(prospectsTable.id, id), eq(prospectsTable.tenantId, req.auth!.tenantId)))
    .limit(1);
  if (!prospect) { res.status(404).json({ error: "Prospect introuvable" }); return; }
  res.json(prospect);
});

router.post("/", async (req, res) => {
  const parse = prospectSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Données invalides", details: parse.error.issues });
    return;
  }
  const { email, address, lat, lng, ...rest } = parse.data;

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

  res.status(201).json(prospect);
});

router.post("/bulk", async (req, res) => {
  const { prospects } = req.body as { prospects: any[] };
  if (!Array.isArray(prospects) || prospects.length === 0) {
    res.status(400).json({ error: "Tableau de prospects requis" });
    return;
  }
  const rows = prospects.slice(0, 1000).map((p) => ({
    firstName: p.firstName || null,
    lastName: p.lastName || null,
    email: p.email || null,
    phone: p.phone || null,
    company: p.company || null,
    jobTitle: p.jobTitle || null,
    website: p.website || null,
    address: p.address || null,
    lat: p.lat != null ? parseFloat(p.lat) : null,
    lng: p.lng != null ? parseFloat(p.lng) : null,
    status: (p.status as any) || "new",
    tenantId: req.auth!.tenantId,
    createdBy: req.auth!.userId,
  }));

  const inserted = await db.insert(prospectsTable).values(rows).returning({ id: prospectsTable.id, address: prospectsTable.address, lat: prospectsTable.lat });

  // Background geocoding for rows that have an address but no coordinates
  // Rate-limited: 1 request/second to respect Nominatim ToS
  const toGeocode = inserted.filter(r => r.address && r.lat == null);
  if (toGeocode.length > 0) {
    (async () => {
      for (let i = 0; i < toGeocode.length; i++) {
        const { id, address } = toGeocode[i];
        if (address) await geocodeAndUpdate(id, address);
        // 1.2s between requests to stay under Nominatim's 1 req/s limit
        if (i < toGeocode.length - 1) await new Promise(r => setTimeout(r, 1200));
      }
    })().catch(() => {});
  }

  res.status(201).json({ count: inserted.length, geocoding: toGeocode.length });
});

router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const parse = prospectSchema.partial().safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Données invalides" });
    return;
  }
  const { email, address, lat, lng, ...rest } = parse.data;
  const updateData: any = { ...rest, updatedAt: new Date() };
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

  res.json(updated);
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

export default router;
