import { resolve4 } from "node:dns/promises";
import { isIP } from "node:net";
import { request } from "node:https";

export type SeoCheck = { label: string; status: "ok" | "warning" | "error"; detail: string };

export function isPublicIPv4(ip: string): boolean {
  const bytes = ip.split(".").map(Number);
  if (bytes.length !== 4 || bytes.some(b => !Number.isInteger(b) || b < 0 || b > 255)) return false;
  const [a, b, c] = bytes;
  if (a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 ||
      a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 ||
      a === 100 && b >= 64 && b <= 127 || a === 198 && (b === 18 || b === 19) ||
      a === 192 && b === 0 || a === 192 && b === 88 && c === 99 ||
      a === 192 && b === 0 && c === 2 || a === 198 && b === 51 && c === 100 ||
      a === 203 && b === 0 && c === 113) return false;
  return true;
}

export function validatePublicWebsite(raw: string): URL {
  const url = new URL(raw.trim().startsWith("http") ? raw.trim() : `https://${raw.trim()}`);
  if (url.protocol !== "https:" || url.port && url.port !== "443" || url.username || url.password ||
      isIP(url.hostname) !== 0 || url.hostname.length > 253 || !url.hostname.includes(".") ||
      /(?:^|\.)(?:localhost|local|internal|test|invalid|example)$/.test(url.hostname) ||
      !url.hostname.split(".").every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) ||
      url.pathname.length > 500) throw new Error("Saisissez un domaine public en HTTPS, sans port personnalisé");
  url.hash = "";
  return url;
}

async function fetchPublicHtml(url: URL): Promise<{ code: number; body: string; elapsed: number }> {
  const ips = await resolve4(url.hostname);
  if (!ips.length || ips.some(ip => !isPublicIPv4(ip))) throw new Error("Adresse réseau privée ou non autorisée");
  const ip = ips[0];
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const req = request(url, {
      method: "GET", family: 4, timeout: 8_000,
      lookup: (_hostname, _options, callback) => callback(null, ip, 4),
      headers: { "User-Agent": "GrowthOS-SEO-Audit/1.0", "Accept": "text/html" },
    }, response => {
      const chunks: Buffer[] = [];
      let size = 0;
      const contentType = String(response.headers["content-type"] || "");
      if (!contentType.includes("text/html")) {
        response.resume(); reject(new Error("Réponse non HTML")); return;
      }
      response.on("data", (data:Buffer) => {
        size += data.length;
        if (size > 250_000) { req.destroy(new Error("Page supérieure à 250 Ko : audit léger annulé")); return; }
        chunks.push(data);
      });
      response.on("end", () => resolve({ code: response.statusCode || 0, body: Buffer.concat(chunks).toString("utf8"), elapsed: Date.now()-start }));
      response.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("Site trop lent (> 8 secondes)")));
    req.on("error", reject);
    req.end();
  });
}

function extract(html:string, re:RegExp):string {
  return (html.match(re)?.[1] || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

export async function inspectWebsite(raw:string) {
  const url = validatePublicWebsite(raw);
  const response = await fetchPublicHtml(url);
  const html = response.body;
  const title = extract(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = extract(html, /<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
    || extract(html, /<meta\s+[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
  const h1s = [...html.matchAll(/<h1(?:\s[^>]*)?>([\s\S]*?)<\/h1>/gi)];
  const viewport = /<meta\s+[^>]*name=["']viewport["']/i.test(html);
  const noindex = /<meta\s+[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html);
  const canonical = /<link\s+[^>]*rel=["']canonical["']/i.test(html);
  const checks:SeoCheck[] = [
    { label:"Réponse HTTPS", status:response.code === 200 ? "ok" : "error", detail:`Code HTTP ${response.code}` },
    { label:"Titre de page", status:title ? title.length<=65 ? "ok" : "warning" : "error", detail:title ? `${title.slice(0,100)} (${title.length} caractères)` : "Balise title absente" },
    { label:"Description SEO", status:description ? "ok" : "warning", detail:description ? `${description.length} caractères` : "Meta description absente" },
    { label:"Titre H1", status:h1s.length===1 ? "ok" : "warning", detail:`${h1s.length} balise(s) H1 détectée(s)` },
    { label:"Affichage mobile", status:viewport ? "ok" : "warning", detail:viewport ? "Balise viewport présente" : "Balise viewport absente" },
    { label:"Indexabilité", status:noindex ? "error" : "ok", detail:noindex ? "Directive noindex détectée" : "Pas de noindex dans le HTML initial" },
    { label:"URL canonique", status:canonical ? "ok" : "warning", detail:canonical ? "Balise canonical présente" : "Balise canonical absente" },
  ];
  return { url:url.origin, checkedAt:new Date().toISOString(), httpStatus:response.code,
    serverResponseMs:response.elapsed, checks, title,
    limitations:"Contrôle léger du HTML initial. Ne remplace pas Lighthouse, les Core Web Vitals, l'indexation Google, ni un crawl complet." };
}
