import { request } from "node:https";
import { resolve4 } from "node:dns/promises";
import { isPublicIPv4, validatePublicWebsite } from "../seo/inspectWebsite";

/**
 * Lecture de flux RSS / Atom pour la veille presse (lot 2).
 *  - Flux ajoutés par l'agence : HTTPS public uniquement, IP résolue vérifiée
 *    puis épinglée (pas de SSRF ni de rebinding DNS), 2 redirections au plus,
 *    2 Mo et 10 s au maximum.
 *  - Google Actualités : adresse fixe de configuration (EREP_GOOGLE_NEWS_RSS_URL).
 */
export type FeedItem = { title: string; url: string | null; summary: string; publishedAt: string | null; source: string | null };

const MAX_BYTES = 2 * 1024 * 1024;

export function assertFeedUrl(raw: string): URL {
  const url = validatePublicWebsite(raw);
  if (!/^https:$/.test(url.protocol)) throw new Error("Flux HTTPS attendu");
  return url;
}

async function pinnedGet(url: URL, redirects = 0): Promise<string> {
  assertFeedUrl(url.href);
  const ips = await resolve4(url.hostname);
  if (!ips.length || ips.some(ip => !isPublicIPv4(ip))) throw new Error("Adresse réseau privée ou non autorisée");
  const ip = ips[0];
  return new Promise((resolve, reject) => {
    const req = request(url, {
      method: "GET", family: 4, timeout: 10_000,
      lookup: (_h, _o, cb) => cb(null, ip, 4),
      headers: { "User-Agent": "GrowthOS-Veille/1.0", Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
    }, res => {
      const code = res.statusCode ?? 0;
      if (code >= 300 && code < 400 && res.headers.location) {
        res.resume();
        if (redirects >= 2) { reject(new Error("Trop de redirections")); return; }
        try { resolve(pinnedGet(new URL(res.headers.location, url), redirects + 1)); } catch (e) { reject(e); }
        return;
      }
      if (code !== 200) { res.resume(); reject(new Error(`Flux indisponible (HTTP ${code})`)); return; }
      let size = 0; const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => { size += c.length; if (size > MAX_BYTES) { req.destroy(new Error("Flux trop volumineux")); return; } chunks.push(c); });
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("Délai de lecture du flux dépassé")));
    req.on("error", reject);
    req.end();
  });
}

export async function fetchPublicFeed(raw: string): Promise<FeedItem[]> {
  return parseFeed(await pinnedGet(assertFeedUrl(raw)));
}

export async function fetchGoogleNews(query: string): Promise<FeedItem[]> {
  const base = new URL(process.env.EREP_GOOGLE_NEWS_RSS_URL || "https://news.google.com/rss/search");
  base.searchParams.set("q", query);
  base.searchParams.set("hl", "fr"); base.searchParams.set("gl", "FR"); base.searchParams.set("ceid", "FR:fr");
  const response = await fetch(base, { redirect: "error", signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "GrowthOS-Veille/1.0" } });
  if (!response.ok) throw new Error(`Google Actualités indisponible (HTTP ${response.status})`);
  const text = await response.text();
  if (text.length > MAX_BYTES) throw new Error("Flux trop volumineux");
  return parseFeed(text);
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function decode(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") { const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ""; }
      return ENTITIES[e.toLowerCase()] ?? m;
    });
}
const strip = (v: string) => decode(decode(v).replace(/<[^>]*>/g, " ")).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const tag = (block: string, name: string) => block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"))?.[1] ?? "";

/** Analyse RSS 2.0 et Atom, sans exécution ni entité externe. */
export function parseFeed(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  for (const block of blocks.slice(0, 100)) {
    const title = strip(tag(block, "title")).slice(0, 400);
    let link = strip(tag(block, "link"));
    if (!link) link = block.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? "";
    let url: string | null = null;
    try { const u = new URL(decode(link)); if (/^https?:$/.test(u.protocol)) url = u.href.slice(0, 1000); } catch { /* lien absent ou invalide */ }
    const summary = strip(tag(block, "description") || tag(block, "summary") || tag(block, "content")).slice(0, 800);
    const date = strip(tag(block, "pubDate") || tag(block, "published") || tag(block, "updated"));
    const parsed = date ? new Date(date) : null;
    const source = strip(tag(block, "source")).slice(0, 200) || null;
    if (title) items.push({ title, url, summary, publishedAt: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null, source });
  }
  return items;
}
