import { createHash, randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { logger } from "../logger";
import { browserCall, cloudConfigured, CloudBrowserError } from "../../services/cloud-browser";
import { sentimentAnalyzer } from "./SentimentAnalyzer";
import { campaignService, CampaignError, type Campaign } from "./CampaignService";
import { erepAI } from "./ErepAI";
import { alertService } from "./AlertService";
import { assertFeedUrl, fetchGoogleNews, fetchPublicFeed, type FeedItem } from "./FeedReader";

/**
 * E-réputation — lot 2 « veille » (agent 3).
 *
 * Une veille = un passage (erep_watch_runs) composé d'étapes :
 *   serp    : top N Google / Bing d'une requête (navigateur cloud, /erep-collect) ;
 *   reviews : note et derniers avis d'une fiche Google Maps / PagesJaunes (navigateur cloud) ;
 *   news    : Google Actualités (flux RSS public) ;
 *   rss     : flux de presse ajoutés par l'agence (HTTPS public, filtrés sur le nom).
 *
 * Le navigateur cloud est partagé avec la prospection : la veille lui cède la
 * place (aucune étape navigateur tant qu'une collecte prospect est en file ou
 * en cours, nouvel essai 2 minutes plus tard). Un contrôle de sécurité ou de
 * consentement n'est jamais contourné : l'étape passe « awaiting_user ».
 */

export const WATCH_ENGINES = ["google_search", "bing"] as const;
export type WatchEngine = (typeof WATCH_ENGINES)[number];
export type WatchFrequency = "off" | "daily" | "weekly";
export type WatchSettings = {
  engines: WatchEngine[]; extraQueries: string[]; mapsUrl: string | null; pagesjaunesUrl: string | null;
  newsEnabled: boolean; rssFeeds: string[]; frequency: WatchFrequency; dailyDepth: number; weeklyDepth: number;
  nextRunAt: string | null; nextWeeklyAt: string | null; configured: boolean;
};
export type WatchStep = {
  type: "serp" | "reviews" | "news" | "rss"; source: string; query?: string; url?: string;
  status: "pending" | "completed" | "awaiting_user" | "skipped" | "failed";
  message?: string | null; items?: number; newItems?: number; dropped?: number; moved?: number; finishedAt?: string;
};

const MAPS_URL = /^https:\/\/(?:www\.)?google\.(?:com|fr)\/maps\/place\//;
const PJ_URL = /^https:\/\/(?:www\.)?pagesjaunes\.fr\/pros\/\d+/;
const MAX_QUERIES = 10;
const RETRY_MS = 2 * 60 * 1000;
const SOURCE_LABEL: Record<string, string> = { google_search: "Google", bing: "Bing", google_maps: "Google Maps", pagesjaunes: "PagesJaunes", google_news: "Google Actualités", rss: "Flux RSS" };

const DEFAULTS: Omit<WatchSettings, "nextRunAt" | "nextWeeklyAt" | "configured"> = {
  engines: ["google_search", "bing"], extraQueries: [], mapsUrl: null, pagesjaunesUrl: null,
  newsEnabled: true, rssFeeds: [], frequency: "daily", dailyDepth: 20, weeklyDepth: 50,
};

const sha = (v: string) => createHash("sha256").update(v).digest("hex").slice(0, 40);
const normalize = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
function normalUrl(raw: string): string {
  try { const u = new URL(raw); u.hash = ""; u.hostname = u.hostname.replace(/^www\./, ""); return u.href.replace(/\/$/, ""); } catch { return raw; }
}

// ── Heure de Paris (créneau de nuit 3 h – 6 h) sans dépendance externe.
function parisOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(at).reduce<Record<string, number>>((acc, p) => { if (p.type !== "literal") acc[p.type] = Number(p.value); return acc; }, {});
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - at.getTime();
}
function parisWallClock(at: Date) { const local = new Date(at.getTime() + parisOffsetMs(at)); return { y: local.getUTCFullYear(), m: local.getUTCMonth(), d: local.getUTCDate(), weekday: local.getUTCDay() }; }
function parisTime(y: number, m: number, d: number, minutes: number): Date {
  let guess = Date.UTC(y, m, d, 0, minutes);
  for (let i = 0; i < 2; i++) guess = Date.UTC(y, m, d, 0, minutes) - parisOffsetMs(new Date(guess));
  return new Date(guess);
}
/** Prochain créneau : 3 h + décalage stable par campagne (0 à 179 min), le lendemain ou le dimanche suivant. */
export function nextSlot(campaignId: string, from: Date, weekly: boolean): Date {
  const minutes = 180 + (parseInt(sha(campaignId).slice(0, 6), 16) % 180);
  const today = parisWallClock(from);
  for (let add = 0; add <= 8; add++) {
    const day = new Date(Date.UTC(today.y, today.m, today.d + add));
    if (weekly && day.getUTCDay() !== 0) continue;
    const slot = parisTime(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), minutes);
    if (slot.getTime() > from.getTime() + 60_000) return slot;
  }
  return new Date(from.getTime() + 24 * 3600_000);
}

function rowToSettings(row: any | undefined): WatchSettings {
  if (!row) return { ...DEFAULTS, nextRunAt: null, nextWeeklyAt: null, configured: false };
  return {
    engines: (row.engines ?? []).filter((e: string) => (WATCH_ENGINES as readonly string[]).includes(e)),
    extraQueries: row.extra_queries ?? [], mapsUrl: row.maps_url, pagesjaunesUrl: row.pagesjaunes_url,
    newsEnabled: row.news_enabled, rssFeeds: row.rss_feeds ?? [], frequency: row.frequency,
    dailyDepth: row.daily_depth, weeklyDepth: row.weekly_depth,
    nextRunAt: row.next_run_at ? new Date(row.next_run_at).toISOString() : null,
    nextWeeklyAt: row.next_weekly_at ? new Date(row.next_weekly_at).toISOString() : null, configured: true,
  };
}

/** Requêtes générées : nom et variantes, contexte (lieu, fonction), mots-clés, sources du catalogue. */
export function buildQueries(campaign: Campaign, settings: Pick<WatchSettings, "extraQueries">): string[] {
  const name = campaign.targetName.trim();
  const out: string[] = [];
  const push = (q: string) => { const v = q.replace(/\s+/g, " ").trim().slice(0, 160); if (v && !out.some(o => normalize(o) === normalize(v))) out.push(v); };
  push(`"${name}"`);
  for (const alias of campaign.subjectAliases.slice(0, 2)) push(`"${alias}"`);
  if (campaign.subjectLocation) push(`"${name}" ${campaign.subjectLocation}`);
  if (campaign.subjectRole) push(`"${name}" ${campaign.subjectRole}`);
  if (campaign.targetType === "B2C") {
    // Catalogue personnes : réseaux, annuaires de dirigeants, vidéos.
    push(`"${name}" (site:linkedin.com OR site:facebook.com OR site:instagram.com OR site:x.com OR site:youtube.com OR site:tiktok.com)`);
    push(`"${name}" (site:societe.com OR site:pappers.fr OR site:infogreffe.fr OR site:copainsdavant.linternaute.com)`);
  } else {
    push(`"${name}" avis`);
    push(`"${name}" (site:trustpilot.com OR site:avis-verifies.com OR site:custplace.com OR site:yelp.fr OR site:pagesjaunes.fr OR site:justacote.com)`);
  }
  for (const k of campaign.keywords.slice(0, 5)) push(k);
  for (const q of settings.extraQueries) push(q);
  return out.slice(0, MAX_QUERIES);
}

export class WatchService {
  async getSettings(campaignId: string): Promise<WatchSettings> {
    const { rows } = await pool.query(`SELECT * FROM erep_watch_settings WHERE campaign_id = $1`, [campaignId]);
    return rowToSettings(rows[0]);
  }

  async overview(campaignId: string, tenantId: string) {
    const campaign = await this.campaign(campaignId, tenantId);
    const settings = await this.getSettings(campaignId);
    const profiles = await pool.query<{ source: string }>(
      `SELECT DISTINCT source FROM cloud_browser_profiles WHERE tenant_id = $1 AND deleted_at IS NULL`, [tenantId]);
    const available = new Set(profiles.rows.map(r => r.source));
    const lastRun = (await this.listRuns(campaignId, 1))[0] ?? null;
    return {
      settings, queries: buildQueries(campaign, settings), cloudConfigured: cloudConfigured(),
      profiles: Object.fromEntries(["google_search", "bing", "google_maps", "pagesjaunes"].map(s => [s, available.has(s)])),
      lastRun,
    };
  }

  async saveSettings(campaignId: string, tenantId: string, input: Partial<Omit<WatchSettings, "nextRunAt" | "nextWeeklyAt" | "configured">>, userId?: string): Promise<WatchSettings> {
    await this.campaign(campaignId, tenantId);
    const next = { ...(await this.getSettings(campaignId)), ...input };
    next.engines = [...new Set(next.engines)];
    next.extraQueries = [...new Set((next.extraQueries ?? []).map(q => q.trim()).filter(Boolean))];
    next.rssFeeds = [...new Set((next.rssFeeds ?? []).map(q => q.trim()).filter(Boolean))];
    if (next.extraQueries.length > 10 || next.extraQueries.some(q => q.length > 160)) throw new CampaignError("10 requêtes supplémentaires au plus, de 160 caractères au plus");
    if (next.mapsUrl && !MAPS_URL.test(next.mapsUrl)) throw new CampaignError("Fiche Google Maps : collez l'adresse complète https://www.google.com/maps/place/…");
    if (next.pagesjaunesUrl && !PJ_URL.test(next.pagesjaunesUrl)) throw new CampaignError("Fiche PagesJaunes : collez l'adresse https://www.pagesjaunes.fr/pros/…");
    if (next.rssFeeds.length > 10) throw new CampaignError("10 flux RSS au plus");
    for (const feed of next.rssFeeds) {
      try { assertFeedUrl(feed); } catch { throw new CampaignError(`Flux RSS refusé (HTTPS public attendu) : ${feed.slice(0, 120)}`); }
    }
    if (next.dailyDepth < 10 || next.dailyDepth > 100 || next.weeklyDepth < 10 || next.weeklyDepth > 100) throw new CampaignError("Profondeur SERP entre 10 et 100");
    const now = new Date();
    const nextRun = next.frequency === "off" ? null : nextSlot(campaignId, now, next.frequency === "weekly");
    const nextWeekly = next.frequency === "off" ? null : nextSlot(campaignId, now, true);
    await pool.query(
      `INSERT INTO erep_watch_settings (campaign_id, tenant_id, engines, extra_queries, maps_url, pagesjaunes_url, news_enabled, rss_feeds,
         frequency, daily_depth, weekly_depth, next_run_at, next_weekly_at, updated_by, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
       ON CONFLICT (campaign_id) DO UPDATE SET engines = EXCLUDED.engines, extra_queries = EXCLUDED.extra_queries,
         maps_url = EXCLUDED.maps_url, pagesjaunes_url = EXCLUDED.pagesjaunes_url, news_enabled = EXCLUDED.news_enabled,
         rss_feeds = EXCLUDED.rss_feeds, frequency = EXCLUDED.frequency, daily_depth = EXCLUDED.daily_depth,
         weekly_depth = EXCLUDED.weekly_depth, next_run_at = EXCLUDED.next_run_at, next_weekly_at = EXCLUDED.next_weekly_at,
         updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
      [campaignId, tenantId, JSON.stringify(next.engines), JSON.stringify(next.extraQueries), next.mapsUrl || null, next.pagesjaunesUrl || null,
        next.newsEnabled, JSON.stringify(next.rssFeeds), next.frequency, next.dailyDepth, next.weeklyDepth, nextRun, nextWeekly, userId ?? null],
    );
    return this.getSettings(campaignId);
  }

  private async campaign(campaignId: string, tenantId: string): Promise<Campaign> {
    const campaign = await campaignService.getCampaign(campaignId, tenantId);
    if (!campaign) throw new CampaignError("Campagne introuvable", 404);
    return campaign;
  }

  /** Met une veille en file. Une seule veille active par campagne. */
  async enqueue(campaignId: string, tenantId: string, kind: "daily" | "weekly" | "manual", options: { depth?: number; userId?: string } = {}) {
    const campaign = await this.campaign(campaignId, tenantId);
    if (campaign.status !== "active") throw new CampaignError("Réactivez la campagne pour lancer sa veille", 409);
    const settings = await this.getSettings(campaignId);
    const depth = Math.max(10, Math.min(100, options.depth ?? (kind === "weekly" ? settings.weeklyDepth : settings.dailyDepth)));
    const steps: WatchStep[] = [];
    for (const engine of settings.engines) for (const query of buildQueries(campaign, settings)) steps.push({ type: "serp", source: engine, query, status: "pending" });
    if (settings.mapsUrl) steps.push({ type: "reviews", source: "google_maps", url: settings.mapsUrl, status: "pending" });
    if (settings.pagesjaunesUrl) steps.push({ type: "reviews", source: "pagesjaunes", url: settings.pagesjaunesUrl, status: "pending" });
    if (settings.newsEnabled) for (const name of [campaign.targetName, ...campaign.subjectAliases.slice(0, 1)]) steps.push({ type: "news", source: "google_news", query: `"${name}"`, status: "pending" });
    for (const url of settings.rssFeeds) steps.push({ type: "rss", source: "rss", url, status: "pending" });
    if (!steps.length) throw new CampaignError("Aucune source de veille : activez un moteur, une fiche, Google Actualités ou un flux");
    try {
      const { rows } = await pool.query(
        `INSERT INTO erep_watch_runs (tenant_id, campaign_id, kind, depth, steps, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [tenantId, campaignId, kind, depth, JSON.stringify(steps), options.userId ?? null]);
      logger.info({ campaignId, runId: rows[0].id, kind, steps: steps.length }, "E-rep watch run queued");
      return this.toRun(rows[0]);
    } catch (error: any) {
      if (error?.code === "23505") throw new CampaignError("Une veille est déjà en file ou en cours pour cette campagne", 409);
      throw error;
    }
  }

  async listRuns(campaignId: string, limit = 20) {
    const { rows } = await pool.query(`SELECT * FROM erep_watch_runs WHERE campaign_id = $1 ORDER BY created_at DESC LIMIT $2`, [campaignId, limit]);
    return rows.map(r => this.toRun(r));
  }

  private toRun(row: any) {
    return {
      id: row.id, campaignId: row.campaign_id, kind: row.kind, depth: row.depth, status: row.status, steps: row.steps as WatchStep[],
      stats: row.stats, message: row.message, attempts: row.attempts, createdAt: row.created_at, startedAt: row.started_at, finishedAt: row.finished_at,
      notBefore: row.not_before,
    };
  }

  private async runOf(runId: string, tenantId: string) {
    const { rows } = await pool.query(`SELECT * FROM erep_watch_runs WHERE id = $1 AND tenant_id = $2`, [runId, tenantId]);
    if (!rows[0]) throw new CampaignError("Veille introuvable", 404);
    return rows[0];
  }

  /** Reprend les étapes en attente ou en échec (après un contrôle de sécurité effectué dans le navigateur). */
  async resume(runId: string, tenantId: string) {
    const run = await this.runOf(runId, tenantId);
    if (!["awaiting_user", "partial", "failed"].includes(run.status)) throw new CampaignError("Cette veille ne peut pas être reprise", 409);
    const steps = (run.steps as WatchStep[]).map(s => ["awaiting_user", "failed"].includes(s.status) ? { ...s, status: "pending" as const, message: null } : s);
    try {
      const { rows } = await pool.query(
        `UPDATE erep_watch_runs SET status = 'queued', steps = $3, not_before = NOW(), attempts = 0, finished_at = NULL, message = NULL
          WHERE id = $1 AND tenant_id = $2 RETURNING *`, [runId, tenantId, JSON.stringify(steps)]);
      return this.toRun(rows[0]);
    } catch (error: any) {
      if (error?.code === "23505") throw new CampaignError("Une autre veille est déjà en cours pour cette campagne", 409);
      throw error;
    }
  }

  async cancel(runId: string, tenantId: string) {
    const run = await this.runOf(runId, tenantId);
    if (!["queued", "awaiting_user"].includes(run.status)) throw new CampaignError("Seule une veille en file ou en attente peut être annulée", 409);
    const { rows } = await pool.query(`UPDATE erep_watch_runs SET status = 'cancelled', finished_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING *`, [runId, tenantId]);
    return this.toRun(rows[0]);
  }

  // ── Exécution ──────────────────────────────────────────────────────────────
  private processing = false;

  /** Traite au plus une veille ; renvoie l'identifiant traité ou null. */
  async processNext(): Promise<string | null> {
    if (this.processing) return null;
    this.processing = true;
    try {
      await pool.query(`UPDATE erep_watch_runs SET status = 'queued', lease = NULL, lease_until = NULL WHERE status = 'running' AND lease_until < NOW()`);
      const lease = randomUUID();
      const { rows } = await pool.query(
        `UPDATE erep_watch_runs SET status = 'running', lease = $1, lease_until = NOW() + INTERVAL '30 minutes', started_at = COALESCE(started_at, NOW())
          WHERE id = (SELECT id FROM erep_watch_runs WHERE status = 'queued' AND not_before <= NOW() ORDER BY not_before, created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
          RETURNING *`, [lease]);
      if (!rows[0]) return null;
      await this.execute(rows[0], lease);
      return rows[0].id as string;
    } finally { this.processing = false; }
  }

  private async prospectingBusy(): Promise<boolean> {
    const { rows } = await pool.query(`SELECT EXISTS (SELECT 1 FROM cloud_browser_jobs WHERE status IN ('queued','running')) AS busy`);
    return !!rows[0]?.busy;
  }

  private async execute(run: any, lease: string): Promise<void> {
    const steps = run.steps as WatchStep[];
    const campaign = await campaignService.getCampaign(run.campaign_id, run.tenant_id);
    if (!campaign) return;
    const isBaselineSerp = !(await pool.query(`SELECT 1 FROM erep_serp_collections WHERE campaign_id = $1 AND run_id <> $2 LIMIT 1`, [run.campaign_id, run.id])).rows[0];
    const save = (fields: Record<string, unknown>) => {
      const keys = Object.keys(fields);
      return pool.query(`UPDATE erep_watch_runs SET ${keys.map((k, i) => `${k} = $${i + 3}`).join(", ")} WHERE id = $1 AND lease = $2`,
        [run.id, lease, ...keys.map(k => (k === "steps" || k === "stats") ? JSON.stringify(fields[k]) : fields[k])]);
    };
    for (const step of steps) {
      if (step.status !== "pending") continue;
      const cancelled = (await pool.query(`SELECT status, lease FROM erep_watch_runs WHERE id = $1`, [run.id])).rows[0];
      if (cancelled?.lease !== lease) return;
      const browser = step.type === "serp" || step.type === "reviews";
      if (browser && cloudConfigured() && await this.prospectingBusy()) {
        // La prospection a la priorité sur le navigateur partagé.
        await save({ steps, status: "queued", lease: null, lease_until: null, not_before: new Date(Date.now() + RETRY_MS), attempts: run.attempts + 1,
          message: "Navigateur cloud occupé par la prospection : la veille reprendra automatiquement." });
        return;
      }
      try {
        Object.assign(step, await this.runStep(run, campaign, step, isBaselineSerp));
      } catch (error) {
        if (error instanceof CloudBrowserError && error.status === 423 && run.attempts < 30) {
          await save({ steps, status: "queued", lease: null, lease_until: null, not_before: new Date(Date.now() + RETRY_MS), attempts: run.attempts + 1,
            message: "Navigateur cloud occupé : la veille reprendra automatiquement." });
          return;
        }
        step.status = "failed";
        step.message = error instanceof CloudBrowserError || error instanceof CampaignError ? error.message
          : (error instanceof Error ? error.message : "Étape impossible").slice(0, 240);
        logger.warn({ runId: run.id, type: step.type, source: step.source, reason: step.message }, "E-rep watch step failed");
      }
      step.finishedAt = new Date().toISOString();
      await save({ steps, lease_until: new Date(Date.now() + 30 * 60_000) });
    }
    const count = (s: WatchStep["status"]) => steps.filter(x => x.status === s).length;
    const stats = {
      steps: steps.length, completed: count("completed"), awaitingUser: count("awaiting_user"), failed: count("failed"), skipped: count("skipped"),
      items: steps.reduce((n, s) => n + (s.items ?? 0), 0), newItems: steps.reduce((n, s) => n + (s.newItems ?? 0), 0),
      dropped: steps.reduce((n, s) => n + (s.dropped ?? 0), 0), moved: steps.reduce((n, s) => n + (s.moved ?? 0), 0),
      baseline: isBaselineSerp,
    };
    const status = stats.awaitingUser ? "awaiting_user" : stats.failed && !stats.completed ? "failed" : stats.failed ? "partial"
      : !stats.completed && stats.skipped ? "failed" : "completed";
    const message = stats.awaitingUser ? "Une source demande une vérification dans le navigateur cloud, puis « Reprendre »."
      : status === "failed" ? "Aucune source n'a pu être lue : voir le détail des étapes." : null;
    await save({ steps, stats, status, message, lease: null, lease_until: null, finished_at: new Date() });
    // Lot 3 : sentiment IA des nouvelles mentions, score historisé, puis alertes et plan de crise.
    await erepAI.analyzePending(run.campaign_id, run.tenant_id).catch(err => logger.warn({ reason: err instanceof Error ? err.message : "unknown" }, "E-rep AI analysis failed"));
    await campaignService.calculateReputationScore(run.campaign_id).catch(() => null);
    const alerts = await alertService.evaluateRun(run.id).catch(err => { logger.warn({ reason: err instanceof Error ? err.message : "unknown" }, "E-rep alert evaluation failed"); return 0; });
    logger.info({ runId: run.id, campaignId: run.campaign_id, status, newItems: stats.newItems, alerts }, "E-rep watch run finished");
  }

  private async profileFor(tenantId: string, source: string): Promise<string | null> {
    const { rows } = await pool.query(
      `SELECT id FROM cloud_browser_profiles WHERE tenant_id = $1 AND source = $2 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`, [tenantId, source]);
    return rows[0]?.id ?? null;
  }

  private async runStep(run: any, campaign: Campaign, step: WatchStep, baseline: boolean): Promise<Partial<WatchStep>> {
    if (step.type === "news" || step.type === "rss") {
      const items = step.type === "news" ? await fetchGoogleNews(step.query!) : await fetchPublicFeed(step.url!);
      return this.storeNews(run, campaign, step, items);
    }
    if (!cloudConfigured()) return { status: "skipped", message: "Navigateur cloud non configuré dans la stack." };
    const profileId = await this.profileFor(run.tenant_id, step.source);
    if (!profileId) return { status: "skipped", message: `Aucun profil navigateur ${SOURCE_LABEL[step.source]} : créez-le dans Prospection → Navigateur cloud.` };
    const payload = step.type === "serp"
      ? { tenantId: run.tenant_id, profileId, source: step.source, task: "serp", query: step.query, depth: run.depth }
      : { tenantId: run.tenant_id, profileId, source: step.source, task: "reviews", url: step.url, limit: 20 };
    const data = await browserCall("/erep-collect", payload, 240_000, run.id);
    if (data.status === "awaiting_user") {
      // Lecture interrompue (contrôle de sécurité, consentement) : aucune mesure enregistrée,
      // l'étape sera rejouée entièrement après « Reprendre ».
      return { status: "awaiting_user", message: String(data.message ?? "Vérification requise dans le navigateur cloud.").slice(0, 300) };
    }
    const stored = step.type === "serp" ? await this.storeSerp(run, campaign, step, data.results ?? [], baseline) : await this.storeReviews(run, campaign, step, data);
    return data.status !== "completed"
      ? { ...stored, status: "failed", message: "Réponse du navigateur inattendue." }
      : { ...stored, status: "completed", message: null };
  }

  private async upsertMention(run: any, m: { kind: "serp" | "review" | "news"; source: string; fingerprint: string; url: string | null; title: string | null; excerpt: string | null; publishedAt?: string | null; sentiment: string; score: number; baseline: boolean; critical?: boolean }): Promise<{ inserted: boolean; id: string }> {
    const { rows } = await pool.query(
      `INSERT INTO erep_mentions (tenant_id, campaign_id, run_id, kind, source, fingerprint, url, title, excerpt, published_at, sentiment, score, baseline, severity)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (campaign_id, fingerprint) DO UPDATE SET last_seen_at = NOW()
       RETURNING id, (xmax = 0) AS inserted`,
      [run.tenant_id, run.campaign_id, run.id, m.kind, m.source, m.fingerprint, m.url, m.title?.slice(0, 400) ?? null, m.excerpt?.slice(0, 1000) ?? null,
        m.publishedAt ?? null, m.sentiment, m.score, m.baseline, m.critical ? "critical" : "normal"]);
    return { inserted: !!rows[0]?.inserted, id: rows[0].id };
  }

  private async storeSerp(run: any, campaign: Campaign, step: WatchStep, results: Array<{ url: string; title?: string; snippet?: string; position: number }>, baseline: boolean) {
    const clean = results.filter(r => typeof r?.url === "string" && /^https?:\/\//.test(r.url) && Number.isInteger(r.position)).slice(0, 100);
    // Le relevé précédent est lu dans les collectes (un relevé vide réussi compte aussi).
    const previousRun = (await pool.query(
      `SELECT run_id FROM erep_serp_collections WHERE campaign_id = $1 AND engine = $2 AND query = $3 AND run_id <> $4 ORDER BY captured_at DESC LIMIT 1`,
      [run.campaign_id, step.source, step.query, run.id])).rows[0]?.run_id;
    const previous = previousRun ? (await pool.query(`SELECT url, position FROM erep_serp_snapshots WHERE run_id = $1 AND engine = $2 AND query = $3`, [previousRun, step.source, step.query])).rows : [];
    const seenBefore = new Set((await pool.query(`SELECT DISTINCT url FROM erep_serp_snapshots WHERE campaign_id = $1 AND engine = $2 AND query = $3 AND run_id <> $4`,
      [run.campaign_id, step.source, step.query, run.id])).rows.map(r => normalUrl(r.url)));
    await pool.query(`DELETE FROM erep_serp_snapshots WHERE run_id = $1 AND engine = $2 AND query = $3`, [run.id, step.source, step.query]);
    await pool.query(
      `INSERT INTO erep_serp_collections (campaign_id, run_id, engine, query, depth, result_count) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (run_id, engine, query) DO UPDATE SET depth = EXCLUDED.depth, result_count = EXCLUDED.result_count, captured_at = NOW()`,
      [run.campaign_id, run.id, step.source, step.query, run.depth, clean.length]);
    let newItems = 0, moved = 0;
    for (const r of clean) {
      await pool.query(`INSERT INTO erep_serp_snapshots (campaign_id, run_id, engine, query, position, url, title, snippet) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [run.campaign_id, run.id, step.source, step.query, r.position, r.url.slice(0, 1000), r.title?.slice(0, 300) ?? null, r.snippet?.slice(0, 600) ?? null]);
      const key = normalUrl(r.url);
      const before = previous.find(p => normalUrl(p.url) === key);
      if (before && before.position !== r.position) moved++;
      if (previousRun && !seenBefore.has(key)) newItems++;
      const sentiment = sentimentAnalyzer.analyzeText(`${r.title ?? ""} ${r.snippet ?? ""}`);
      await this.upsertMention(run, { kind: "serp", source: step.source, fingerprint: `url:${sha(key)}`, url: r.url, title: r.title ?? null, excerpt: r.snippet ?? null,
        sentiment: sentiment.sentiment, score: sentiment.score, baseline, critical: sentiment.critical });
    }
    const currentKeys = new Set(clean.map(r => normalUrl(r.url)));
    // Comparaison limitée à la profondeur lue (un top 50 n'est pas comparé au-delà d'un top 20).
    const bound = clean.length >= run.depth ? Math.max(...clean.map(r => r.position)) : run.depth;
    const dropped = previous.filter(p => p.position <= bound && !currentKeys.has(normalUrl(p.url))).length;
    // Position du site de la cible (si renseigné) : alimente le suivi SERP et le score.
    if (campaign.targetUrl) {
      let host = ""; try { host = new URL(campaign.targetUrl).hostname.replace(/^www\./, ""); } catch { /* URL cible invalide */ }
      if (host) {
        const own = clean.find(r => { try { const h = new URL(r.url).hostname.replace(/^www\./, ""); return h === host || h.endsWith("." + host); } catch { return false; } });
        await pool.query(`INSERT INTO erep_serp_tracking (campaign_id, keyword, position, url) VALUES ($1,$2,$3,$4)`,
          [run.campaign_id, `${step.source === "bing" ? "Bing · " : ""}${step.query}`.slice(0, 200), own?.position ?? null, own?.url ?? null]);
      }
    }
    return { items: clean.length, newItems, dropped: previousRun ? dropped : 0, moved };
  }

  private async storeReviews(run: any, campaign: Campaign, step: WatchStep, data: any) {
    const summary = data?.summary;
    if (summary && (summary.rating != null || summary.count != null)) {
      // null / absent = non lu : ne jamais le convertir en 0.
      const rating = summary.rating == null ? NaN : Number(summary.rating), count = summary.count == null ? NaN : Number(summary.count);
      await pool.query(`INSERT INTO erep_review_stats (campaign_id, run_id, source, rating, review_count) VALUES ($1,$2,$3,$4,$5)`,
        [run.campaign_id, run.id, step.source, Number.isFinite(rating) && rating > 0 && rating <= 5 ? rating : null, Number.isInteger(count) && count >= 0 ? count : null]);
    }
    const first = !(await pool.query(`SELECT 1 FROM erep_reviews WHERE campaign_id = $1 AND source = $2 LIMIT 1`, [run.campaign_id, step.source])).rows[0];
    let newItems = 0;
    const reviews = Array.isArray(data?.reviews) ? data.reviews.slice(0, 50) : [];
    for (const r of reviews) {
      const text = typeof r.text === "string" ? r.text.slice(0, 2000) : "";
      const rating = Number(r.rating);
      const hasRating = Number.isFinite(rating) && rating >= 1 && rating <= 5;
      if (!text && !hasRating) continue;
      // La date affichée est relative (« il y a 2 jours ») : elle n'entre pas dans l'empreinte.
      const fingerprint = sha(`${step.source}|${r.externalId || `${r.author ?? ""}|${text.slice(0, 300)}`}`);
      const fromText = sentimentAnalyzer.analyzeText(text);
      const sentiment = hasRating ? (rating <= 2 ? "neg" : rating >= 4 ? "pos" : "neu") : fromText.sentiment;
      const score = hasRating ? Number(((rating - 3) / 2).toFixed(2)) : fromText.score;
      const inserted = await pool.query(
        `INSERT INTO erep_reviews (campaign_id, run_id, source, fingerprint, external_id, author, rating, review_date, text, owner_response, sentiment, score)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (campaign_id, fingerprint) DO NOTHING RETURNING id`,
        [run.campaign_id, run.id, step.source, fingerprint, r.externalId ?? null, r.author ? String(r.author).slice(0, 100) : null, hasRating ? rating : null,
          r.date ? String(r.date).slice(0, 40) : null, text || null, !!r.ownerResponse, sentiment, score]);
      if (!inserted.rows[0]) continue;
      newItems++;
      const mention = await this.upsertMention(run, { kind: "review", source: step.source, fingerprint: `review:${fingerprint}`, url: step.url ?? null,
        title: `${SOURCE_LABEL[step.source]} · ${hasRating ? `${rating}/5` : "avis"}${r.author ? ` · ${String(r.author).slice(0, 60)}` : ""}`,
        excerpt: text || null, sentiment, score, baseline: first, critical: fromText.critical });
      // Journal de sentiment lié à la mention (les avis ont leur propre composante du score).
      await pool.query(`INSERT INTO erep_sentiment_logs (campaign_id, source_url, text, sentiment, score, mention_id) VALUES ($1,$2,$3,$4,$5,$6)`,
        [run.campaign_id, step.url ?? null, (text || `Avis ${rating}/5`).slice(0, 2000), sentiment, score, mention.id]);
    }
    return { items: reviews.length, newItems: first ? 0 : newItems };
  }

  private async storeNews(run: any, campaign: Campaign, step: WatchStep, items: FeedItem[]) {
    const names = [campaign.targetName, ...campaign.subjectAliases].map(normalize).filter(n => n.length >= 3);
    // Un flux de presse généraliste contient tout : seuls les articles citant la cible sont gardés.
    const relevant = step.type === "rss" ? items.filter(i => names.some(n => normalize(`${i.title} ${i.summary}`).includes(n))) : items;
    const first = !(await pool.query(`SELECT 1 FROM erep_mentions WHERE campaign_id = $1 AND kind = 'news' AND source = $2 LIMIT 1`, [run.campaign_id, step.source])).rows[0];
    let newItems = 0;
    for (const item of relevant.slice(0, 40)) {
      const sentiment = sentimentAnalyzer.analyzeText(`${item.title} ${item.summary}`);
      const inserted = await this.upsertMention(run, { kind: "news", source: step.source, fingerprint: `news:${sha(item.url ? normalUrl(item.url) : normalize(item.title))}`,
        url: item.url, title: item.source ? `${item.title} — ${item.source}`.slice(0, 400) : item.title, excerpt: item.summary || null,
        publishedAt: item.publishedAt, sentiment: sentiment.sentiment, score: sentiment.score, baseline: first, critical: sentiment.critical });
      if (!inserted.inserted) continue;
      newItems++;
      await pool.query(`INSERT INTO erep_sentiment_logs (campaign_id, source_url, text, sentiment, score, mention_id) VALUES ($1,$2,$3,$4,$5,$6)`,
        [run.campaign_id, item.url, item.title.slice(0, 2000), sentiment.sentiment, sentiment.score, inserted.id]);
    }
    return { status: "completed" as const, items: relevant.length, newItems: first ? 0 : newItems, message: null };
  }

  // ── Lecture ────────────────────────────────────────────────────────────────
  async listMentions(campaignId: string, filters: { status?: string; kind?: string; limit?: number }) {
    const where = ["campaign_id = $1"]; const values: unknown[] = [campaignId];
    if (filters.status) { values.push(filters.status); where.push(`status = $${values.length}`); }
    if (filters.kind) { values.push(filters.kind); where.push(`kind = $${values.length}`); }
    values.push(Math.max(1, Math.min(200, filters.limit ?? 100)));
    const { rows } = await pool.query(
      `SELECT id, kind, source, url, title, excerpt, published_at, sentiment, score::float AS score, status, baseline, first_seen_at, last_seen_at, severity, analysis_source, themes
         FROM erep_mentions WHERE ${where.join(" AND ")} ORDER BY first_seen_at DESC, id LIMIT $${values.length}`, values);
    const counts = (await pool.query(
      `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'new')::int AS "new", COUNT(*) FILTER (WHERE status = 'new' AND NOT baseline)::int AS "newSinceBaseline",
              COUNT(*) FILTER (WHERE sentiment = 'neg' AND status <> 'ignored')::int AS negative,
              COUNT(*) FILTER (WHERE severity = 'critical' AND status <> 'ignored')::int AS critical
         FROM erep_mentions WHERE campaign_id = $1`, [campaignId])).rows[0];
    return { mentions: rows, counts };
  }

  async setMentionStatus(mentionId: string, tenantId: string, status: "new" | "qualified" | "ignored") {
    const { rows } = await pool.query(`UPDATE erep_mentions SET status = $3 WHERE id = $1 AND tenant_id = $2 RETURNING id, status`, [mentionId, tenantId, status]);
    if (!rows[0]) throw new CampaignError("Mention introuvable", 404);
    return rows[0];
  }

  /** Dernier relevé par moteur et requête, avec repères « nouveau » et position précédente. */
  async latestSerp(campaignId: string) {
    const { rows } = await pool.query(
      `WITH latest AS (
         SELECT DISTINCT ON (engine, query) engine, query, run_id, captured_at, result_count FROM erep_serp_collections WHERE campaign_id = $1 ORDER BY engine, query, captured_at DESC),
       prev AS (
         SELECT DISTINCT ON (c.engine, c.query) c.engine, c.query, c.run_id FROM erep_serp_collections c JOIN latest l ON l.engine = c.engine AND l.query = c.query
          WHERE c.campaign_id = $1 AND c.run_id <> l.run_id ORDER BY c.engine, c.query, c.captured_at DESC)
       SELECT l.engine, l.query, s.position, s.url, s.title, s.snippet, l.captured_at, l.result_count,
              p2.position AS previous_position,
              (s.url IS NOT NULL AND p.run_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM erep_serp_snapshots o WHERE o.campaign_id = $1 AND o.engine = s.engine AND o.query = s.query AND o.run_id <> s.run_id AND o.url = s.url)) AS is_new
         FROM latest l
         LEFT JOIN erep_serp_snapshots s ON s.run_id = l.run_id AND s.engine = l.engine AND s.query = l.query
         LEFT JOIN prev p ON p.engine = l.engine AND p.query = l.query
         LEFT JOIN erep_serp_snapshots p2 ON p2.run_id = p.run_id AND p2.engine = l.engine AND p2.query = l.query AND p2.url = s.url
        ORDER BY l.engine, l.query, s.position NULLS FIRST`, [campaignId]);
    return rows;
  }

  async reviewsOverview(campaignId: string) {
    const stats = (await pool.query(
      `SELECT DISTINCT ON (source) source, rating::float AS rating, review_count, captured_at FROM erep_review_stats WHERE campaign_id = $1 ORDER BY source, captured_at DESC`, [campaignId])).rows;
    const reviews = (await pool.query(
      `SELECT id, source, author, rating::float AS rating, review_date, text, owner_response, sentiment, first_seen_at, reply_draft, reply_draft_source FROM erep_reviews WHERE campaign_id = $1 ORDER BY first_seen_at DESC LIMIT 100`, [campaignId])).rows;
    return { stats, reviews };
  }

  // ── Planification ──────────────────────────────────────────────────────────
  async scheduleDue(now = new Date()): Promise<number> {
    const { rows } = await pool.query(
      `SELECT s.campaign_id, s.tenant_id, s.frequency, s.next_weekly_at FROM erep_watch_settings s JOIN erep_campaigns c ON c.id = s.campaign_id
        WHERE s.frequency <> 'off' AND s.next_run_at <= $1 AND c.status = 'active' LIMIT 100`, [now]);
    let queued = 0;
    for (const row of rows) {
      const weekly = row.frequency === "weekly" || (row.next_weekly_at && new Date(row.next_weekly_at) <= now);
      try { await this.enqueue(row.campaign_id, row.tenant_id, weekly ? "weekly" : "daily"); queued++; }
      catch (error) { if (!(error instanceof CampaignError)) logger.warn({ campaignId: row.campaign_id, reason: error instanceof Error ? error.message : "unknown" }, "E-rep watch scheduling failed"); }
      await pool.query(
        `UPDATE erep_watch_settings SET next_run_at = $2, next_weekly_at = CASE WHEN $3::boolean THEN $4::timestamptz ELSE next_weekly_at END WHERE campaign_id = $1`,
        [row.campaign_id, nextSlot(row.campaign_id, now, row.frequency === "weekly"), !!weekly, nextSlot(row.campaign_id, now, true)]);
    }
    return queued;
  }
}

export const watchService = new WatchService();

/** Planificateur : toutes les minutes, met en file les veilles dues et traite la file. */
export function startErepWatch(): void {
  if (process.env.GROWTHOS_SMOKE_TEST === "true") return;
  let busy = false;
  const tick = async () => {
    if (busy) return; busy = true;
    try { await watchService.scheduleDue(); while (await watchService.processNext()) { /* une veille après l'autre */ } }
    catch (error) { logger.warn({ reason: error instanceof Error ? error.message : "unknown" }, "E-rep watch scheduler failed"); }
    finally { busy = false; }
  };
  setInterval(() => void tick(), 60_000).unref();
}

/** Déclenchement immédiat (bouton « Lancer maintenant », reprise) sans attendre la minute suivante. */
export function kickErepWatch(): void {
  void (async () => { while (await watchService.processNext()) { /* file */ } })()
    .catch(error => logger.warn({ reason: error instanceof Error ? error.message : "unknown" }, "E-rep watch run failed"));
}
