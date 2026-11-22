import { pool } from "@workspace/db";
import { logger } from "../../lib/logger";
import { providerKeysService } from "../provider-keys/ProviderKeysService";

/* ─────────────────────────────────────────────────────────────
   SOURCE REGISTRY — 23 sources (free + paid + scraping)
───────────────────────────────────────────────────────────── */
export type SourceType = "api" | "scrape" | "rss";
export type DataType = "legal" | "financial" | "digital" | "social" | "news" | "jobs" | "org_chart";

export interface SourceDef {
  id: string;
  name: string;
  type: SourceType;
  dataType: DataType;
  free: boolean;
  rateLimitPerMinute: number;
  description: string;
}

export const ALL_SOURCES: SourceDef[] = [
  // Free / Open Data
  { id: "pappers",       name: "Pappers (données légales FR)",  type: "api",    dataType: "legal",     free: true,  rateLimitPerMinute: 60,  description: "SIREN, dirigeants, statuts légaux" },
  { id: "insee",         name: "INSEE Sirene",                  type: "api",    dataType: "legal",     free: true,  rateLimitPerMinute: 30,  description: "Données officielles entreprises" },
  { id: "bodacc",        name: "BODACC (avis officiels)",       type: "rss",    dataType: "legal",     free: true,  rateLimitPerMinute: 10,  description: "Avis de création, modification, dissolution" },
  { id: "google_maps",   name: "Google Maps",                   type: "api",    dataType: "digital",   free: true,  rateLimitPerMinute: 60,  description: "Avis, coordonnées, photos" },
  { id: "google_search", name: "Google Search",                 type: "scrape", dataType: "digital",   free: true,  rateLimitPerMinute: 10,  description: "Présence web, mentions" },
  { id: "google_news",   name: "Google News RSS",               type: "rss",    dataType: "news",      free: true,  rateLimitPerMinute: 20,  description: "Actualités récentes de l'entreprise" },
  { id: "pages_jaunes",  name: "Pages Jaunes",                  type: "scrape", dataType: "digital",   free: true,  rateLimitPerMinute: 10,  description: "Annuaire, contacts, catégorie" },
  { id: "societe_info",  name: "Societe.info (scraping)",       type: "scrape", dataType: "legal",     free: true,  rateLimitPerMinute: 5,   description: "Données légales et financières" },
  { id: "wtj",           name: "Welcome to the Jungle",         type: "scrape", dataType: "jobs",      free: true,  rateLimitPerMinute: 10,  description: "Offres d'emploi publiées" },
  { id: "indeed",        name: "Indeed (offres d'emploi)",      type: "scrape", dataType: "jobs",      free: true,  rateLimitPerMinute: 10,  description: "Recrutements actifs" },
  { id: "apec",          name: "APEC (cadres)",                 type: "scrape", dataType: "jobs",      free: true,  rateLimitPerMinute: 5,   description: "Postes cadres publiés" },
  { id: "twitter",       name: "Twitter / X",                   type: "scrape", dataType: "social",    free: true,  rateLimitPerMinute: 10,  description: "Activité sociale, mentions" },
  { id: "facebook",      name: "Facebook",                      type: "scrape", dataType: "social",    free: true,  rateLimitPerMinute: 5,   description: "Page entreprise, avis" },
  { id: "instagram",     name: "Instagram",                     type: "scrape", dataType: "social",    free: true,  rateLimitPerMinute: 5,   description: "Présence sociale, followers" },
  { id: "website",       name: "Site web entreprise",           type: "scrape", dataType: "digital",   free: true,  rateLimitPerMinute: 5,   description: "Technologies, contacts, mentions légales" },
  // Paid / API key required
  { id: "linkedin",      name: "LinkedIn API",                  type: "api",    dataType: "social",    free: false, rateLimitPerMinute: 60,  description: "Profils, employés, organigramme" },
  { id: "dropcontact",   name: "Dropcontact",                   type: "api",    dataType: "digital",   free: false, rateLimitPerMinute: 60,  description: "Enrichissement email professionnel" },
  { id: "infogreffe",    name: "Infogreffe (actes officiels)",  type: "api",    dataType: "legal",     free: false, rateLimitPerMinute: 30,  description: "Actes, comptes annuels" },
  { id: "crunchbase",    name: "Crunchbase",                    type: "api",    dataType: "financial", free: false, rateLimitPerMinute: 60,  description: "Levées de fonds, investisseurs" },
  { id: "dealroom",      name: "Dealroom (startups)",           type: "api",    dataType: "financial", free: false, rateLimitPerMinute: 60,  description: "Valorisation, funding rounds" },
  { id: "wappalyzer",   name: "Wappalyzer (stack technique)",  type: "api",    dataType: "digital",   free: false, rateLimitPerMinute: 60,  description: "Technologies utilisées" },
  { id: "hunter",        name: "Hunter.io (emails)",            type: "api",    dataType: "digital",   free: false, rateLimitPerMinute: 100, description: "Emails professionnels" },
  { id: "apollo",        name: "Apollo.io (contacts)",          type: "api",    dataType: "org_chart", free: false, rateLimitPerMinute: 60,  description: "Contacts, organigramme B2B" },
];

/** Only these connectors have an actual implementation. The catalogue is not a list of working integrations. */
export const IMPLEMENTED_SOURCES = new Set(["pappers", "insee", "google_news", "wappalyzer", "hunter"]);

/* ─────────────────────────────────────────────────────────────
   IN-MEMORY CACHE (1h TTL)
───────────────────────────────────────────────────────────── */
const cacheStore = new Map<string, { value: any; expiresAt: number }>();

function getFromCache(key: string): any | null {
  const entry = cacheStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cacheStore.delete(key); return null; }
  return entry.value;
}

function saveToCache(key: string, value: any, ttlMs = 3600_000): void {
  cacheStore.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/* ─────────────────────────────────────────────────────────────
   RATE LIMITER (per source)
───────────────────────────────────────────────────────────── */
const rateLimitQueues = new Map<string, number>(); // sourceId → next allowed timestamp

async function waitForRateLimit(sourceId: string, perMinute: number): Promise<void> {
  const minInterval = 60_000 / perMinute;
  const now = Date.now();
  const next = rateLimitQueues.get(sourceId) ?? now;
  if (next > now) await new Promise(r => setTimeout(r, next - now));
  rateLimitQueues.set(sourceId, Date.now() + minInterval);
}

/* ─────────────────────────────────────────────────────────────
   SIGNAL DETECTION
───────────────────────────────────────────────────────────── */
export interface DetectedSignal {
  type: string;
  title: string;
  description: string;
  source: string;
  impactScore: number;
}

function detectSignals(sourceId: string, data: any, company: string): DetectedSignal[] {
  const signals: DetectedSignal[] = [];
  try {
    // Recrutement intensif
    if (sourceId === "wtj" || sourceId === "indeed" || sourceId === "apec") {
      if (data?.openPositions >= 3) {
        signals.push({ type: "hiring", title: "Forte croissance RH", description: `${data.openPositions} postes ouverts détectés`, source: sourceId, impactScore: 75 });
      }
    }
    // Levée de fonds
    if (sourceId === "crunchbase" || sourceId === "dealroom") {
      if (data?.funding?.totalRaised) {
        signals.push({ type: "funding", title: "Levée de fonds", description: `${data.funding.lastRound} — ${data.funding.totalRaised}`, source: sourceId, impactScore: 90 });
      }
    }
    // Nouveau dirigeant
    if (sourceId === "pappers" || sourceId === "infogreffe") {
      if (data?.dirigeants?.length > 0) {
        signals.push({ type: "leadership_identified", title: "Dirigeant identifié", description: `${data.dirigeants[0].prenom} ${data.dirigeants[0].nom} — ${data.dirigeants[0].role}`, source: sourceId, impactScore: 40 });
      }
    }
    // Stack technique premium
    if (sourceId === "wappalyzer") {
      const premium = ["Salesforce", "HubSpot", "SAP", "ServiceNow", "Marketo"];
      const found = (data?.technologies || []).filter((t: string) => premium.includes(t));
      if (found.length > 0) {
        signals.push({ type: "tech_investment", title: "Investissement tech premium", description: `Stack: ${found.join(", ")}`, source: sourceId, impactScore: 70 });
      }
    }
    // Actualité positive
    if (sourceId === "google_news") {
      const positifs = (data?.articles || []).filter((a: any) => a.sentiment === "positif");
      if (positifs.length >= 2) {
        signals.push({ type: "media_positive", title: "Couverture médiatique positive", description: `${positifs.length} articles positifs récents`, source: sourceId, impactScore: 65 });
      }
    }
    // Expansion géographique
    if (sourceId === "bodacc") {
      if (data?.events?.some((e: any) => e.type === "ouverture_etablissement")) {
        signals.push({ type: "expansion", title: "Expansion géographique", description: "Nouvelle implantation détectée (BODACC)", source: sourceId, impactScore: 80 });
      }
    }
  } catch {}
  return signals;
}

/* ─────────────────────────────────────────────────────────────
   LEAD SCORE
───────────────────────────────────────────────────────────── */
function calculateLeadScore(results: Record<string, any>, signals: DetectedSignal[]): number {
  let score = 0; // no observed data means no observed qualification score
  if (results.legal?.siren) score += 10;
  if (results.financial?.chiffreAffaires) score += 10;
  if (results.financial?.funding) score += 15;
  if (results.digital?.technologies?.length) score += 5;
  if (results.jobs?.openPositions >= 3) score += 10;
  if (results.social?.linkedin?.employees > 100) score += 5;
  score += Math.min(signals.length * 5, 15);
  return Math.min(score, 100);
}

/* ─────────────────────────────────────────────────────────────
   RETRY HELPER
───────────────────────────────────────────────────────────── */
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts - 1) throw err;
      await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt)));
    }
  }
  throw new Error("Max retries exceeded");
}

/* ─────────────────────────────────────────────────────────────
   CALL API / SCRAPE SOURCE
───────────────────────────────────────────────────────────── */
async function callSourceForProspect(
  source: SourceDef,
  prospect: any,
  tenantId: string,
  apiKey?: string
): Promise<any> {
  const company = prospect.company || "";
  const cacheKey = `${tenantId}:${prospect.id}:${source.id}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  await waitForRateLimit(source.id, source.rateLimitPerMinute);

  let data: any = null;

  try {
    data = await withRetry(async () => {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 10_000);
      try {
        switch (source.id) {
          case "pappers": {
            if (!apiKey || !company) return null;
            const r = await fetch(
              `https://api.pappers.fr/v1/entreprise?api_token=${apiKey}&q=${encodeURIComponent(company)}&cibles=nom_entreprise`,
              { signal: ctrl.signal }
            );
            if (!r.ok) return null;
            const d = await r.json() as any;
            return d.resultats?.[0] ?? null;
          }
          case "insee": {
            if (!apiKey || !company) return null;
            const r = await fetch(
              `https://api.insee.fr/api-sirene/3.8/siret?q=denominationUniteLegale:"${encodeURIComponent(company)}"&nombre=1`,
              { headers: { Authorization: `Bearer ${apiKey}` }, signal: ctrl.signal }
            );
            if (!r.ok) return null;
            const d = await r.json() as any;
            return d.etablissements?.[0] ?? null;
          }
          case "crunchbase":
          case "dealroom": {
            // Not integrated: never invent financial figures.
            return null;
          }
          case "wappalyzer": {
            if (!apiKey || !prospect.website) return null;
            const r = await fetch(
              `https://api.wappalyzer.com/v2/lookup/?urls=${encodeURIComponent(prospect.website)}`,
              { headers: { "x-api-key": apiKey }, signal: ctrl.signal }
            );
            if (!r.ok) return null;
            return await r.json();
          }
          case "hunter": {
            if (!apiKey || !prospect.company) return null;
            const domain = prospect.website?.replace(/^https?:\/\//, "").split("/")[0] || "";
            if (!domain) return null;
            const r = await fetch(
              `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${apiKey}`,
              { signal: ctrl.signal }
            );
            if (!r.ok) return null;
            return await r.json();
          }
          case "dropcontact": {
            return null;
          }
          case "google_news": {
            if (!company) return null;
            const r = await fetch(
              `https://news.google.com/rss/search?q=${encodeURIComponent(company)}&hl=fr&gl=FR&ceid=FR:fr`,
              { signal: ctrl.signal }
            );
            if (!r.ok) return null;
            const xml = await r.text();
            const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 5).map(m => {
              const title = m[1].match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ?? "";
              const pubDate = m[1].match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? "";
              return { title, publishedAt: pubDate, source: "Google News", sentiment: "neutre", url: "" };
            });
            return { articles: items };
          }
          // Unimplemented integrations are explicitly unavailable; synthetic data must never reach CRM.
          case "wtj": case "indeed": case "apec":
            return null;
          case "twitter": case "facebook": case "instagram":
            return null;
          case "societe_info": case "infogreffe": case "bodacc":
            return null;
          case "google_maps": case "google_search": case "pages_jaunes": case "website":
            return null;
          case "linkedin": case "apollo":
            return null;
          default:
            return null;
        }
      } finally { clearTimeout(timeout); }
    });
  } catch (err: any) {
    logger.warn({ sourceId: source.id, error: err?.message }, "Enrichment source failed");
    return null;
  }

  if (data) {
    data._source = source.id;
    data._fetchedAt = new Date().toISOString();
    saveToCache(cacheKey, data);
  }
  return data;
}

/* ─────────────────────────────────────────────────────────────
   INTERCONNECT WITH PLUGINS
───────────────────────────────────────────────────────────── */
async function interconnectWithPlugins(
  prospectId: string,
  tenantId: string,
  results: Record<string, any>,
  signals: DetectedSignal[],
  score: number
): Promise<void> {
  try {
    // 1. Growth Memory — index collected data
    const summary = Object.entries(results)
      .filter(([, v]) => v != null)
      .map(([k, v]) => `[${k}] ${JSON.stringify(v).slice(0, 200)}`)
      .join("\n");
    if (summary) {
      await pool.query(
        `INSERT INTO memory_documents (source_type, source_id, content, tenant_id, metadata)
         VALUES ('enrichment', $1, $2, $3, $4)
         ON CONFLICT (source_type, source_id, tenant_id) DO UPDATE
         SET content = EXCLUDED.content, updated_at = NOW()`,
        [prospectId, summary, tenantId, { enrichedAt: new Date().toISOString(), score }]
      );
    }
  } catch {}

  try {
    // 2. Signal Intelligence — create detected signals
    for (const sig of signals) {
      await pool.query(
        `INSERT INTO enrichment_signals (prospect_id, signal_type, title, description, source, impact_score)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        [prospectId, sig.type, sig.title, sig.description, sig.source, sig.impactScore]
      );
      // Also insert into main signals table
      await pool.query(
        `INSERT INTO signals (type, company, title, description, score, tenant_id)
         SELECT $1, p.company, $2, $3, $4, $5
         FROM prospects p WHERE p.id = $6`,
        [sig.type, sig.title, sig.description, sig.impactScore, tenantId, prospectId]
      ).catch(() => {});
    }
  } catch {}

  try {
    // 3. Account Intelligence — update health score
    const companyRow = await pool.query(`SELECT company FROM prospects WHERE id = $1`, [prospectId]);
    const company = companyRow.rows[0]?.company;
    if (company) {
      await pool.query(
        `INSERT INTO account_metrics (account_id, tenant_id, health_score, engagement_level, score_breakdown, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (account_id, tenant_id) DO UPDATE
         SET health_score = EXCLUDED.health_score, score_breakdown = EXCLUDED.score_breakdown, updated_at = NOW()`,
        [company, tenantId, score, score >= 70 ? "high" : score >= 40 ? "medium" : "low", JSON.stringify({ enrichmentScore: score, signals: signals.length })]
      ).catch(() => {});
    }
  } catch {}
}

/* ─────────────────────────────────────────────────────────────
   MAIN ENRICH FUNCTION
───────────────────────────────────────────────────────────── */
export async function enrichProspect(prospectId: string, tenantId: string): Promise<{
  historyId: string;
  score: number;
  signals: DetectedSignal[];
  results: Record<string, any>;
  sourcesAttempted: number;
  sourcesSucceeded: number;
  sourcesFailed: number;
}> {
  // Fetch prospect
  const { rows } = await pool.query(
    `SELECT * FROM prospects WHERE id = $1 AND tenant_id = $2`,
    [prospectId, tenantId]
  );
  if (!rows.length) throw new Error("Prospect not found");
  const prospect = rows[0];

  // Only tenant-scoped, AES-decrypted provider keys. Never read the legacy
  // global enrichment_api_configs table (a cross-tenant secret leak).
  const configMap = new Map<string, string>();
  for (const sourceId of IMPLEMENTED_SOURCES) {
    if (sourceId === "google_news") continue;
    const key = await providerKeysService.getKeyWithFallback(tenantId, sourceId).catch(() => null);
    if (key?.apiKey) configMap.set(sourceId, key.apiKey);
  }

  // Create history entry
  const { rows: [hist] } = await pool.query(
    `INSERT INTO enrichment_history (prospect_id, status, triggered_by)
     VALUES ($1, 'running', 'manual') RETURNING id`,
    [prospectId]
  );

  const startedAt = Date.now();
  const results: Record<string, any> = {};
  const allSignals: DetectedSignal[] = [];
  let succeeded = 0;
  let failed = 0;

  // Filter active sources
  const activeSources = ALL_SOURCES.filter(s => IMPLEMENTED_SOURCES.has(s.id) &&
    (s.id === "google_news" || configMap.has(s.id)));

  for (const source of activeSources) {
    try {
      const apiKey = configMap.get(source.id);
      const data = await callSourceForProspect(source, prospect, tenantId, apiKey);
      if (data) {
        results[source.id] = data;
        results[source.dataType] = results[source.dataType] ?? {};
        Object.assign(results[source.dataType], data);
        const sigs = detectSignals(source.id, data, prospect.company || "");
        allSignals.push(...sigs);
        // Persist to enrichment_data
        await pool.query(
          `INSERT INTO enrichment_data (prospect_id, source_id, data_type, raw_data, confidence_score, expires_at)
           VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '1 hour')
           ON CONFLICT (prospect_id, source_id, data_type) DO UPDATE
           SET raw_data = EXCLUDED.raw_data, fetched_at = NOW(), expires_at = EXCLUDED.expires_at`,
          [prospectId, source.id, source.dataType, JSON.stringify(data), 0.8]
        ).catch(() => {});
        succeeded++;
      } else { failed++; }
    } catch { failed++; }
  }

  const score = calculateLeadScore(results, allSignals);

  // Update prospect score
  await pool.query(
    `UPDATE prospects SET score = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`,
    [score, prospectId, tenantId]
  ).catch(() => {});

  // Interconnect
  await interconnectWithPlugins(prospectId, tenantId, results, allSignals, score);

  // Complete history
  const durationMs = Date.now() - startedAt;
  await pool.query(
    `UPDATE enrichment_history
     SET status = 'completed', completed_at = NOW(),
         sources_attempted = $1, sources_succeeded = $2, sources_failed = $3
     WHERE id = $4`,
    [activeSources.length, succeeded, failed, hist.id]
  ).catch(() => {});

  logger.info({ prospectId, score, signals: allSignals.length, durationMs }, "Enrichment completed");

  return { historyId: hist.id, score, signals: allSignals, results, sourcesAttempted: activeSources.length, sourcesSucceeded: succeeded, sourcesFailed: failed };
}

/* Get enriched data for a prospect */
export async function getEnrichmentData(prospectId: string, tenantId: string): Promise<any[]> {
  const { rows } = await pool.query(
    `SELECT e.* FROM enrichment_data e JOIN prospects p ON p.id = e.prospect_id
     WHERE e.prospect_id = $1 AND p.tenant_id = $2 ORDER BY e.fetched_at DESC`,
    [prospectId, tenantId]
  ).catch(() => ({ rows: [] as any[] }));
  return rows;
}

/* Get enrichment history */
export async function getEnrichmentHistory(prospectId: string, tenantId: string): Promise<any[]> {
  const { rows } = await pool.query(
    `SELECT h.* FROM enrichment_history h JOIN prospects p ON p.id = h.prospect_id
     WHERE h.prospect_id = $1 AND p.tenant_id = $2 ORDER BY h.started_at DESC LIMIT 20`,
    [prospectId, tenantId]
  ).catch(() => ({ rows: [] as any[] }));
  return rows;
}
