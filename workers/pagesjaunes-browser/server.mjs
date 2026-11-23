/**
 * GrowthOS PagesJaunes browser worker.
 * Runs inside its own unprivileged Docker container and visits only one
 * server-defined PagesJaunes search endpoint. Never accepts arbitrary URLs.
 */
import { createServer } from 'node:http';
import { chromium } from 'playwright-core';

const port = Number(process.env.PORT || 3199);
const expectedToken = process.env.PAGESJAUNES_WORKER_TOKEN || '';
const maxBodyBytes = 16_384;
const maxHtmlBytes = 2_000_000;
let browser = null;
let active = false;
let idleTimer = null;

const message = (res, code, detail) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({ error: detail }));
};

function safeInput(data) {
  if (typeof data !== 'object' || data === null) throw new Error('Critères invalides');
  const query = typeof data.query === 'string' ? data.query.trim() : '';
  const location = typeof data.location === 'string' ? data.location.trim() : '';
  if (query.length < 2 || query.length > 120 || location.length < 2 || location.length > 120) {
    throw new Error('Activité ou localisation invalide');
  }
  return { query, location };
}

async function browserInstance() {
  if (!browser?.isConnected()) {
    browser = await chromium.launch({ headless: true, chromiumSandbox: false,
      args: ['--disable-dev-shm-usage', '--disable-background-networking'] });
  }
  return browser;
}

async function extract({ query, location }) {
  clearTimeout(idleTimer);
  const instance = await browserInstance();
  const context = await instance.newContext({
    locale: 'fr-FR', timezoneId: 'Europe/Paris',
    viewport: { width: 1365, height: 900 },
    serviceWorkers: 'block', acceptDownloads: false,
  });
  try {
    const page = await context.newPage();
    await page.route('**/*', route => {
      const resource = route.request();
      if (['image', 'media', 'font'].includes(resource.resourceType())) return route.abort();
      // No file:// or requests to loopback/private networks from remote page JS.
      let parsed;
      try { parsed = new URL(resource.url()); } catch { return route.abort(); }
      if (parsed.protocol === 'data:' || parsed.protocol === 'blob:') return route.continue();
      if (parsed.protocol !== 'https:') return route.abort();
      const host = parsed.hostname.toLowerCase();
      if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') ||
          /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) return route.abort();
      return route.continue();
    });
    const url = new URL('https://www.pagesjaunes.fr/annuaire/chercherlespros');
    url.searchParams.set('quoiqui', query);
    url.searchParams.set('ou', location);
    url.searchParams.set('univers', 'pagesjaunes');
    const navigation = await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 25_000 });
    const status = navigation?.status() || 0;
    if (status === 403 || status === 429) return { code: status, error: `PagesJaunes a renvoyé HTTP ${status} au navigateur` };
    if (status >= 400 || !status) return { code: 502, error: `Navigation PagesJaunes HTTP ${status}` };
    // Give hydrated results time to render, but never wait indefinitely.
    await page.locator('li.bi').first().waitFor({ state: 'attached', timeout: 8_000 }).catch(() => {});
    const html = await page.content();
    if (Buffer.byteLength(html, 'utf8') > maxHtmlBytes) return { code: 413, error: 'HTML trop volumineux' };
    const text = (await page.locator('body').innerText({ timeout: 4_000 }).catch(() => '')).slice(0, 1200);
    if (/captcha|v[ée]rifiez que vous [êe]tes humain|robot|acc[eè]s refus[eé]/i.test(text) &&
        !html.includes('class="bi ')) {
      return { code: 403, error: 'PagesJaunes demande une vérification humaine au navigateur' };
    }
    return { code: 200, html };
  } finally {
    await context.close();
    idleTimer = setTimeout(async () => {
      if (active) return;
      const toClose = browser;
      browser = null;
      await toClose?.close().catch(() => {});
    }, 60_000);
    idleTimer.unref();
  }
}

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":true}');
    return;
  }
  if (req.method !== 'POST' || req.url !== '/extract') return message(res, 404, 'Route introuvable');
  if (expectedToken && req.headers['x-worker-token'] !== expectedToken) return message(res, 401, 'Accès refusé');
  if (active) return message(res, 429, 'Navigateur occupé : réessayez plus tard');
  active = true;
  try {
    let raw = '';
    for await (const chunk of req) {
      raw += chunk.toString('utf8');
      if (Buffer.byteLength(raw, 'utf8') > maxBodyBytes) return message(res, 413, 'Requête trop volumineuse');
    }
    const params = safeInput(JSON.parse(raw));
    const result = await extract(params);
    if (result.code !== 200) return message(res, result.code, result.error);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(result.html);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erreur navigateur';
    message(res, msg.includes('invalide') || msg.includes('invalid') || error instanceof SyntaxError ? 400 : 502,
      msg.slice(0, 240));
  } finally { active = false; }
});

server.listen(port, '0.0.0.0', () => console.log(`PagesJaunes browser worker ready on :${port}`));
process.on('SIGTERM', () => {
  server.close();
  void browser?.close().finally(() => process.exit(0));
});
