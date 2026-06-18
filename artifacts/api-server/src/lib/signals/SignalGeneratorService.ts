/**
 * SignalGeneratorService — Génération de signaux depuis des sources réelles
 * Sources: RSS (gratuit), SerpAPI (clé requise), Crunchbase (clé requise)
 * Fallback automatique sur la génération mock si les sources échouent.
 */

import { pool } from "@workspace/db";
import { logger } from "../logger";
import { emitSignalReceived } from "../plugin-signal-intelligence/event-emitter";

/* ─── Types ────────────────────────────────────────────────── */

export type SignalSource = "rss" | "serpapi" | "crunchbase" | "linkedin" | "mock";
export type SignalType = "funding" | "hiring" | "news" | "technology" | "intent";

export interface GeneratedSignal {
  company: string;
  type: SignalType;
  title: string;
  description: string;
  score: number;
  source: string;
  sourceUrl?: string;
}

export interface GenerateConfig {
  sourceType: SignalSource;
  keywords?: string[];
  companies?: string[];
  maxResults?: number;
  apiKey?: string;
  endpointUrl?: string;
}

/* ─── RSS Sources gratuites ─────────────────────────────────── */

const RSS_FEEDS = [
  { url: "https://www.lesechos.fr/rss/rss_tech.xml",           label: "Les Echos Tech" },
  { url: "https://www.maddyness.com/feed/",                    label: "Maddyness" },
  { url: "https://feeds.feedburner.com/TechCrunch",             label: "TechCrunch" },
  { url: "https://www.frenchweb.fr/feed",                       label: "FrenchWeb" },
  { url: "https://www.lefigaro.fr/rss/figaro_economie.xml",     label: "Le Figaro Économie" },
];

/* ─── Détection de type ─────────────────────────────────────── */

function detectSignalType(title: string, description: string): SignalType {
  const text = `${title} ${description}`.toLowerCase();

  if (/\b(lève|levée|financement|série [abc]|seed|round|invest|funding|tour de table|capital)\b/.test(text)) return "funding";
  if (/\b(recrute|embauche|recrutement|hiring|poste|offre d'emploi|job|career)\b/.test(text)) return "hiring";
  if (/\b(technolog|cloud|ia|ai|saas|logiciel|software|platform|api|data|digital)\b/.test(text)) return "technology";
  if (/\b(intent|signal|achat|budget|appel d'offre|rfp|projet)\b/.test(text)) return "intent";
  return "news";
}

function detectScore(type: SignalType, text: string): number {
  const base: Record<SignalType, number> = { funding: 82, hiring: 70, technology: 68, intent: 78, news: 58 };
  let score = base[type];
  // Bonus keywords
  if (/million|€|m€|\$m/i.test(text)) score += 8;
  if (/france|paris|lyon|bordeaux/i.test(text)) score += 3;
  if (/ceo|cto|cro|vp|directeur|chief/i.test(text)) score += 5;
  return Math.min(99, score);
}

/* ─── Extraction de nom d'entreprise depuis un titre ─────────── */

function extractCompany(title: string, fallback: string): string {
  // Patterns FR: "Acme lève 10M€", "Acme recrute...", "Série A : Acme", etc.
  const patterns = [
    /^([A-Z][A-Za-z0-9& .]+?)\s+(?:lève|recrute|annonce|lance|s'associe|ouvre|signe|obtient)/,
    /^([A-Z][A-Za-z0-9& .]+?)\s*:/,
    /Série\s+[A-Z]\s+(?:pour|:)\s+([A-Z][A-Za-z0-9& .]+)/i,
    /financement de ([A-Z][A-Za-z0-9& .]+)/i,
  ];
  for (const p of patterns) {
    const m = title.match(p);
    if (m?.[1] && m[1].length > 2 && m[1].length < 60) return m[1].trim();
  }
  return fallback;
}

/* ─── Parser RSS (sans dépendance externe) ──────────────────── */

function parseRSSItems(xml: string): { title: string; description: string; link: string; pubDate: string }[] {
  const items: { title: string; description: string; link: string; pubDate: string }[] = [];
  const itemBlocks = xml.match(/<item[^>]*>([\s\S]*?)<\/item>/gi) ?? [];

  for (const block of itemBlocks.slice(0, 20)) {
    const title       = (block.match(/<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>/s)?.[1]
                    ?? block.match(/<title[^>]*>(.*?)<\/title>/s)?.[1] ?? "").trim();
    const description = (block.match(/<description[^>]*><!\[CDATA\[(.*?)\]\]><\/description>/s)?.[1]
                    ?? block.match(/<description[^>]*>(.*?)<\/description>/s)?.[1] ?? "").trim();
    const link        = (block.match(/<link[^>]*>(.*?)<\/link>/s)?.[1] ?? "").trim();
    const pubDate     = (block.match(/<pubDate[^>]*>(.*?)<\/pubDate>/s)?.[1] ?? "").trim();

    if (title) items.push({
      title: title.replace(/<[^>]+>/g, "").trim(),
      description: description.replace(/<[^>]+>/g, "").slice(0, 400).trim(),
      link,
      pubDate,
    });
  }

  return items;
}

/* ─── Service ───────────────────────────────────────────────── */

class SignalGeneratorService {
  // ── RSS ───────────────────────────────────────────────────────────────────────

  async generateFromRSS(tenantId: string, config: GenerateConfig): Promise<GeneratedSignal[]> {
    const signals: GeneratedSignal[] = [];
    const maxResults = config.maxResults ?? 15;
    const keywords = (config.keywords ?? []).map(k => k.toLowerCase());
    const companies = (config.companies ?? []).map(c => c.toLowerCase());

    for (const feed of RSS_FEEDS) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);

        const resp = await fetch(feed.url, {
          signal: ctrl.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "application/rss+xml, application/xml, text/xml, application/atom+xml, */*;q=0.8",
            "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
            "Cache-Control": "no-cache",
          },
        });
        clearTimeout(timer);

        if (!resp.ok) {
          if (resp.status === 403 || resp.status === 404) {
            logger.warn({ url: feed.url, status: resp.status }, "RSS feed blocked or not found — skipped");
          } else {
            logger.warn({ url: feed.url, status: resp.status }, "RSS fetch failed");
          }
          continue;
        }

        const xml = await resp.text();
        const items = parseRSSItems(xml);

        for (const item of items) {
          if (signals.length >= maxResults) break;

          const text = `${item.title} ${item.description}`.toLowerCase();

          // Filtrer par mots-clés si configurés
          if (keywords.length > 0 && !keywords.some(k => text.includes(k))) continue;

          const type = detectSignalType(item.title, item.description);
          const company = companies.length > 0
            ? companies.find(c => text.includes(c)) ?? extractCompany(item.title, "Actualité")
            : extractCompany(item.title, feed.label);
          const score = detectScore(type, text);

          signals.push({
            company,
            type,
            title: item.title.slice(0, 160),
            description: item.description.slice(0, 500) || `Signal détecté depuis ${feed.label}`,
            score,
            source: feed.label,
            sourceUrl: item.link || undefined,
          });
        }

        if (signals.length >= maxResults) break;
      } catch (err: any) {
        if (err.name !== "AbortError") {
          logger.warn({ url: feed.url, err: err.message }, "RSS error — skipped");
        }
      }
    }

    return signals;
  }

  // ── SerpAPI ──────────────────────────────────────────────────────────────────

  async generateFromSerpAPI(tenantId: string, config: GenerateConfig): Promise<GeneratedSignal[]> {
    if (!config.apiKey) {
      logger.warn("SerpAPI key missing — fallback to mock");
      return [];
    }

    const signals: GeneratedSignal[] = [];
    const queries = config.keywords?.length
      ? config.keywords
      : config.companies?.length
        ? config.companies.map(c => `${c} levée de fonds recrutement`)
        : ["startup française financement 2026"];

    for (const q of queries.slice(0, 3)) {
      try {
        const url = `https://serpapi.com/search.json?q=${encodeURIComponent(q)}&api_key=${config.apiKey}&hl=fr&num=10`;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 10000);
        const resp = await fetch(url, { signal: ctrl.signal });
        clearTimeout(timer);

        if (!resp.ok) continue;

        const data = await resp.json() as any;
        const results: any[] = data.organic_results ?? [];

        for (const r of results.slice(0, 5)) {
          const title = r.title ?? "";
          const desc = r.snippet ?? "";
          const type = detectSignalType(title, desc);
          const company = extractCompany(title, "Source SERP");
          const score = detectScore(type, `${title} ${desc}`);

          signals.push({
            company,
            type,
            title: title.slice(0, 160),
            description: desc.slice(0, 500),
            score,
            source: "SerpAPI",
            sourceUrl: r.link,
          });
        }
      } catch (err: any) {
        logger.warn({ q, err: err.message }, "SerpAPI error");
      }
    }

    return signals;
  }

  // ── Crunchbase ───────────────────────────────────────────────────────────────

  async generateFromCrunchbase(tenantId: string, config: GenerateConfig): Promise<GeneratedSignal[]> {
    if (!config.apiKey) return [];

    const signals: GeneratedSignal[] = [];
    try {
      const url = `https://api.crunchbase.com/api/v4/searches/funding_rounds?user_key=${config.apiKey}`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10000);

      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field_ids: ["identifier", "funded_organization_identifier", "announced_on", "investment_type", "money_raised"],
          query: [{ type: "predicate", field_id: "announced_on", operator_id: "gte", values: ["2026-01-01"] }],
          limit: 10,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      if (!resp.ok) return [];

      const data = await resp.json() as any;
      for (const entity of (data.entities ?? []).slice(0, 10)) {
        const company = entity.properties?.funded_organization_identifier?.value ?? "Unknown";
        const amount  = entity.properties?.money_raised?.value_usd;
        const amountStr = amount ? ` — ${(amount / 1_000_000).toFixed(1)}M$` : "";
        signals.push({
          company,
          type: "funding",
          title: `${company} — Levée de fonds${amountStr}`,
          description: `Financement détecté via Crunchbase pour ${company}.${amountStr ? ` Montant : ${amountStr}.` : ""}`,
          score: amount > 10_000_000 ? 92 : 80,
          source: "Crunchbase",
        });
      }
    } catch (err: any) {
      logger.warn({ err: err.message }, "Crunchbase error");
    }

    return signals;
  }

  // ── Persist en DB ─────────────────────────────────────────────────────────────

  async persistSignals(tenantId: string, signals: GeneratedSignal[]): Promise<number> {
    let inserted = 0;

    for (const s of signals) {
      if (!s.company || !s.title) continue;
      try {
        const result = await pool.query(
          `INSERT INTO signals (type, company, title, description, score, status, tenant_id, detected_at)
           VALUES ($1, $2, $3, $4, $5, 'new', $6, NOW())
           RETURNING id`,
          [s.type, s.company.slice(0, 120), s.title.slice(0, 200), s.description.slice(0, 1000), s.score, tenantId],
        );
        inserted++;

        if (s.score >= 75 && result.rows[0]?.id) {
          emitSignalReceived({
            signalId: result.rows[0].id,
            accountId: s.company,
            type: s.type as any,
            impactScore: s.score,
            title: s.title,
          });
        }
      } catch {
        // Ignore insert errors (duplicates possible)
      }
    }

    return inserted;
  }

  // ── Point d'entrée principal ─────────────────────────────────────────────────

  async generate(tenantId: string, config: GenerateConfig): Promise<{ inserted: number; signals: GeneratedSignal[]; source: string }> {
    let signals: GeneratedSignal[] = [];
    let usedSource = config.sourceType;

    try {
      switch (config.sourceType) {
        case "rss":
          signals = await this.generateFromRSS(tenantId, config);
          break;
        case "serpapi":
          signals = await this.generateFromSerpAPI(tenantId, config);
          if (signals.length === 0) {
            // Fallback RSS si SerpAPI vide/erreur
            signals = await this.generateFromRSS(tenantId, config);
            usedSource = "rss";
          }
          break;
        case "crunchbase":
          signals = await this.generateFromCrunchbase(tenantId, config);
          if (signals.length === 0) {
            signals = await this.generateFromRSS(tenantId, config);
            usedSource = "rss";
          }
          break;
        default:
          signals = [];
      }
    } catch (err) {
      logger.error({ err }, "SignalGenerator.generate error — falling back to empty");
    }

    const inserted = await this.persistSignals(tenantId, signals);

    return {
      inserted,
      signals: signals.slice(0, 50),
      source: usedSource,
    };
  }
}

export const signalGeneratorService = new SignalGeneratorService();
