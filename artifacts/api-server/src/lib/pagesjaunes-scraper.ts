import { createHash } from "node:crypto";
import { providerKeysService } from "./provider-keys/ProviderKeysService";

export type PagesJaunesResult = {
  id: string;
  siren: string;
  siret: string | null;
  company: string;
  address: string | null;
  codePostal: string;
  city: string | null;
  phone: string | null;
  website: string | null;
  sourceUrl: string | null;
};

function decode(text: string): string {
  const entities: Record<string, string> = {
    amp: "&", quot: '"', apos: "'", nbsp: " ", lt: "<", gt: ">",
    eacute: "é", egrave: "è", ecirc: "ê", agrave: "à", ccedil: "ç",
    ugrave: "ù", ouml: "ö", rsquo: "’", ndash: "–", hellip: "…",
  };
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (full, entity: string) => {
    if (entity.startsWith("#")) {
      const hex = entity[1]?.toLowerCase() === "x";
      const value = parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(value) && value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : full;
    }
    return entities[entity.toLowerCase()] ?? full;
  });
}
function plain(html: string): string {
  return decode(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}
function classText(html: string, className: string): string | null {
  // Les noms de classes sont des constantes internes, pas des données externes.
  const pattern = new RegExp("<([a-z][a-z0-9:-]*)\\b[^>]*class=[\"'][^\"']*\\b" +
    className + "\\b[^\"']*[\"'][^>]*>([\\s\\S]*?)<\\/\\1>", "i");
  const result = html.match(pattern);
  return result ? plain(result[2]) || null : null;
}
function validWebUrl(url: string, base: string): string | null {
  try {
    const value = new URL(decode(url), base);
    return value.protocol === "https:" || value.protocol === "http:" ? value.href : null;
  } catch { return null; }
}
function normalized(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function parsePagesJaunesHtml(html: string, limit: number): PagesJaunesResult[] {
  const items: PagesJaunesResult[] = [];
  const seen = new Set<string>();
  const cardStart = /<li\b[^>]*class=["'][^"']*\bbi\b[^"']*["'][^>]*>/gi;
  const offsets: number[] = [];
  for (const match of html.matchAll(cardStart)) offsets.push(match.index);
  for (let i = 0; i < offsets.length && items.length < limit; i++) {
    const card = html.slice(offsets[i], offsets[i + 1] ?? (offsets[i] + 15000));
    const name = plain(card.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1] ?? "");
    const address = classText(card, "bi-address") || classText(card, "label-adresse");
    if (!name || !address || name.length > 160) continue;
    const cleanAddress = address.replace(/\s+/g, " ").trim();
    const postal = cleanAddress.match(/\b(\d{5})\b/)?.[1] ?? "";
    const city = postal ? cleanAddress.split(postal)[1]?.trim().replace(/[,;].*$/, "") || null : null;
    const siret = plain(card).match(/\b(\d{14})\b/)?.[1] ?? null;
    const siren = siret?.slice(0, 9) ?? "";
    const profileAnchor = card.match(/<a\b[^>]*class=["'][^"']*\bbi-denomination\b[^"']*["'][^>]*href=["']([^"']+)/i)
      || card.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*\bbi-denomination\b/i);
    const candidateProfile = validWebUrl(profileAnchor?.[1] ?? "", "https://www.pagesjaunes.fr");
    const sourceUrl = candidateProfile && new URL(candidateProfile).hostname.endsWith("pagesjaunes.fr") ? candidateProfile : null;
    const websiteAnchor = card.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>(?:[^<]*)(?:Site internet|Site web)/i);
    const website = websiteAnchor ? validWebUrl(websiteAnchor[1], "https://www.pagesjaunes.fr") : null;
    const phoneLink = card.match(/href=["']tel:([\d+\s().-]{8,25})["']/i)?.[1];
    const phoneVisible = classText(card, "number-contact")?.match(/(?:\+33|0)[\d .-]{8,15}/)?.[0];
    const phone = (phoneLink ?? phoneVisible ?? "").replace(/\s+/g, " ").trim() || null;
    const identity = sourceUrl || normalized(name) + "|" + normalized(cleanAddress);
    const id = "pj_" + createHash("sha256").update(identity).digest("hex").slice(0, 20);
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({ id, siren, siret, company: name, address: cleanAddress,
      codePostal: postal, city, phone, website, sourceUrl });
  }
  return items;
}

let nextAllowedAt = 0;
let requestQueue: Promise<void> = Promise.resolve();

export async function searchPagesJaunes(params: { query: string; location: string; limit: number; tenantId?: string }): Promise<PagesJaunesResult[]> {
  // File d'attente globale : jamais plus d'une requête simultanée, minimum 5 s entre deux.
  const run = requestQueue.then(async () => {
    const requestedInterval = Number(process.env.PAGESJAUNES_MIN_INTERVAL_MS);
    const interval = Number.isFinite(requestedInterval) && requestedInterval > 0
      ? Math.min(60000, Math.max(5000, requestedInterval)) : 5000;
    const wait = Math.max(0, nextAllowedAt - Date.now());
    if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
    nextAllowedAt = Date.now() + interval;
    const isSmoke = process.env.GROWTHOS_SMOKE_TEST === "true";
    const origin = isSmoke && process.env.PAGESJAUNES_TEST_ORIGIN
      ? process.env.PAGESJAUNES_TEST_ORIGIN : "https://www.pagesjaunes.fr";
    const url = new URL("/annuaire/chercherlespros", origin);
    url.searchParams.set("quoiqui", params.query);
    url.searchParams.set("ou", params.location);
    url.searchParams.set("univers", "pagesjaunes");
    // Une passerelle est utilisée seulement si l'administrateur a enregistré sa clé chiffrée.
    // Le domaine ciblé et celui de la passerelle sont fixés par le serveur (pas d'URL utilisateur).
    const gatewayKey = params.tenantId
      ? await providerKeysService.getKey(params.tenantId, "scrapingbee") : null;
    const gatewayOrigin = isSmoke && process.env.PAGESJAUNES_TEST_GATEWAY_ORIGIN
      ? process.env.PAGESJAUNES_TEST_GATEWAY_ORIGIN : "https://app.scrapingbee.com";
    const gatewayUrl = new URL("/api/v1", gatewayOrigin);
    if (gatewayKey) {
      gatewayUrl.searchParams.set("url", url.href);
      gatewayUrl.searchParams.set("mode", "auto");
      gatewayUrl.searchParams.set("max_cost", "25"); // plafond 25 crédits / page (pas de mode stealth 75)
      gatewayUrl.searchParams.set("country_code", "fr");
    }
    const response = gatewayKey
      ? await fetch(gatewayUrl, {
          headers: { Accept: "text/html", Authorization: `Bearer ${gatewayKey.apiKey}` },
          redirect: "error",
          signal: AbortSignal.timeout(60000),
        })
      : await fetch(url, {
          headers: {
            Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "fr-FR,fr;q=0.9",
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          },
          redirect: "error",
          signal: AbortSignal.timeout(12000),
        });
    if (response.status === 403 || response.status === 429) {
      throw new Error(gatewayKey
        ? "Passerelle de scraping HTTP " + response.status + " : clé refusée, quota ou site protégé."
        : "PagesJaunes HTTP " + response.status + " : accès direct refusé. Configurez la clé ScrapingBee dans Clés API Providers pour tenter la collecte via navigateur/proxy distant.");
    }
    if (!response.ok) throw new Error((gatewayKey ? "Passerelle ScrapingBee" : "PagesJaunes") + " : HTTP " + response.status);
    if (!(response.headers.get("content-type") || "").includes("text/html")) {
      throw new Error("PagesJaunes : réponse HTML attendue.");
    }
    const html = await response.text();
    if (html.length > 2_000_000) throw new Error("PagesJaunes : page trop volumineuse.");
    if (/captcha|v[ée]rifiez que vous [êe]tes humain/i.test(plain(html).slice(0, 500))) {
      throw new Error("PagesJaunes demande une vérification humaine ; recherche interrompue.");
    }
    return parsePagesJaunesHtml(html, params.limit);
  });
  requestQueue = run.then(() => undefined, () => undefined);
  return run;
}
