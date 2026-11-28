/**
 * Tests d'intégration de la veille e-réputation — lot 2.
 *
 * Prérequis : PostgreSQL 16, dépendances installées, API compilée
 *   pnpm --filter @workspace/api-server build
 * Lancement :
 *   EREP_POSTGRES_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres node scripts/test-ereputation-watch.mjs
 *
 * Un faux navigateur cloud (/erep-collect) et un faux Google Actualités (RSS)
 * locaux remplacent les sources réelles : aucun accès réseau externe.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

const root = resolve(fileURLToPath(import.meta.url), "../..");
const pg = createRequire(resolve(root, "lib/db/package.json"))("pg");
const jwt = createRequire(resolve(root, "artifacts/api-server/package.json"))("jsonwebtoken");

const adminUrl = process.env.EREP_POSTGRES_URL || process.env.SMOKE_POSTGRES_URL;
if (!adminUrl) {
  console.error("EREP_POSTGRES_URL (ou SMOKE_POSTGRES_URL) est requis : URL d'un PostgreSQL 16 jetable.");
  process.exit(2);
}
const dbName = `growthos_erep_${randomBytes(4).toString("hex")}`;
const dbUrl = (() => { const u = new URL(adminUrl); u.pathname = `/${dbName}`; return u.toString(); })();

async function availablePort() {
  const server = createServer();
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const { port } = server.address();
  await new Promise(r => server.close(r));
  return port;
}

const apiPort = await availablePort();
const base = `http://127.0.0.1:${apiPort}/api/v1`;
const setupToken = randomBytes(32).toString("hex");
const JWT_SECRET = randomBytes(48).toString("hex");
const workerPort = await availablePort();
const env = {
  ...process.env,
  CLOUD_BROWSER_URL: `http://127.0.0.1:${workerPort}`,
  CLOUD_BROWSER_TOKEN: randomBytes(24).toString("hex"),
  EREP_GOOGLE_NEWS_RSS_URL: `http://127.0.0.1:${workerPort}/rss`,
  DATABASE_URL: dbUrl,
  JWT_SECRET,
  JWT_REFRESH_SECRET: randomBytes(48).toString("hex"),
  ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  SETUP_TOKEN: setupToken,
  GROWTHOS_SMOKE_TEST: "true",
  ENABLE_OUTBOUND_EMAIL: "false",
  ALLOW_PUBLIC_REGISTRATION: "false",
  NODE_ENV: "production",
  PORT: String(apiPort),
};

let passed = 0;
function check(condition, message, detail) {
  if (!condition) throw new Error(`${message}${detail !== undefined ? ` — reçu : ${JSON.stringify(detail).slice(0, 600)}` : ""}`);
  passed++;
  console.log(`  ✓ ${message}`);
}

async function request(method, path, data, token) {
  const response = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, body };
}

const isoDay = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);


// ── Faux navigateur cloud et faux Google Actualités (scénarios pilotés par le test).
const worker = { calls: [], phase: 1, delayMs: 250 };
const rssXml = items => `<?xml version="1.0"?><rss><channel>${items.map(i => `<item><title><![CDATA[${i.title}]]></title><link>${i.url}</link><pubDate>Sat, 28 Nov 2026 08:00:00 GMT</pubDate><source url="https://presse.example">${i.source}</source><description>&lt;b&gt;${i.title}&lt;/b&gt;</description></item>`).join("")}</channel></rss>`;
const serpFor = phase => phase === 1
  ? ["https://r1.example/a", "https://r2.example/b", "https://acme-lille.fr/", "https://r4.example/arnaque", "https://r5.example/e"]
  : ["https://r2.example/b", "https://r1.example/a", "https://acme-lille.fr/", "https://r6.example/nouveau", "https://r4.example/arnaque"];
const fakeWorker = createServer(async (req, res) => {
  let raw = ""; for await (const c of req) raw += c;
  const send = (status, value) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(typeof value === "string" ? value : JSON.stringify(value)); };
  if (req.url.startsWith("/rss")) {
    const items = [{ title: "Acme Lille rachète un concurrent", url: "https://presse.example/acme-rachat", source: "La Voix" },
      { title: "Acme Lille : un litige avec un client", url: "https://presse.example/acme-litige", source: "Nord Éclair" }];
    if (worker.phase >= 2) items.push({ title: "Acme Lille récompensée", url: "https://presse.example/acme-prix", source: "La Voix" });
    res.writeHead(200, { "Content-Type": "application/rss+xml" }); res.end(rssXml(items)); return;
  }
  if (req.headers["x-worker-token"] !== env.CLOUD_BROWSER_TOKEN) { send(401, { error: "Accès refusé" }); return; }
  const input = JSON.parse(raw || "{}");
  worker.calls.push(input);
  await delay(worker.delayMs);
  if (req.url !== "/erep-collect") { send(404, { error: "Action introuvable" }); return; }
  if (input.task === "serp") {
    const urls = serpFor(worker.phase).slice(0, input.depth);
    send(200, { status: "completed", pages: 1, results: urls.map((url, i) => ({ url, title: `Titre ${url}`, snippet: url.includes("arnaque") ? "Acme Lille arnaque signalée" : "Acme Lille", position: i + 1 })) });
    return;
  }
  if (input.source === "google_maps") {
    const reviews = [{ externalId: "g1", author: "Marie", rating: 5, date: "il y a 2 jours", text: "Excellent travail, je recommande", ownerResponse: false },
      { externalId: "g2", author: "Paul", rating: 1, date: "il y a 1 semaine", text: "Chantier abandonné", ownerResponse: true }];
    if (worker.phase >= 2) reviews.unshift({ externalId: "g3", author: "Lina", rating: 2, date: "il y a 1 heure", text: "Retard important", ownerResponse: false });
    send(200, { status: "completed", summary: { name: "Acme Lille", rating: 4.2, count: 128 }, reviews });
    return;
  }
  if (input.source === "pagesjaunes") {
    if (worker.phase === 1) send(200, { status: "awaiting_user", summary: null, reviews: [], message: "La source demande un contrôle de sécurité." });
    else send(200, { status: "completed", summary: { name: "Acme Lille", rating: 4, count: 3 }, reviews: [{ externalId: null, author: "Jean", rating: null, date: "12/11/2026", text: "Équipe sérieuse et professionnelle" }] });
    return;
  }
  send(400, { error: "Tâche inconnue" });
});
await new Promise(r => fakeWorker.listen(workerPort, "127.0.0.1", r));

async function waitRun(campaignId, token, done = s => !["queued", "running"].includes(s)) {
  const deadline = Date.now() + 30000;
  for (;;) {
    const runs = (await request("GET", `/ereputation/campaigns/${campaignId}/watch/runs`, undefined, token)).body;
    if (Array.isArray(runs) && runs[0] && done(runs[0].status)) return runs[0];
    if (Date.now() > deadline) throw new Error("La veille ne s'est pas terminée : " + JSON.stringify(runs?.[0]).slice(0, 400));
    await delay(200);
  }
}

let api;
let apiLog = "";
const admin = new pg.Client({ connectionString: adminUrl });
await admin.connect();
await admin.query(`CREATE DATABASE ${dbName}`);
const db = new pg.Client({ connectionString: dbUrl });

try {
  console.log(`\nGrowthOS — e-réputation lot 2 « veille » (base jetable ${dbName})`);
  api = spawn("node", ["artifacts/api-server/dist/index.mjs"], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
  api.stdout.on("data", c => { apiLog = (apiLog + c).slice(-12000); });
  api.stderr.on("data", c => { apiLog = (apiLog + c).slice(-12000); });
  const deadline = Date.now() + 90000;
  for (;;) {
    try { if ((await request("GET", "/setup/status")).status === 200) break; } catch { /* démarrage */ }
    if (Date.now() > deadline) throw new Error("L'API n'a pas démarré (migrations ?)");
    await delay(500);
  }
  const boot = await request("POST", "/setup/bootstrap", {
    setupToken, companyName: "Agence veille test", email: "admin@veille.invalid", password: "LocalOnlyPassword#123456",
  });
  check(boot.status === 201 && boot.body.accessToken, "Administrateur de recette créé", boot.body);
  const token = boot.body.accessToken;
  const me = jwt.decode(token);
  await db.connect();
  const otherTenant = (await db.query(`INSERT INTO tenants (name, slug) VALUES ('Agence concurrente', $1) RETURNING id`, [`concurrente-${randomUUID()}`])).rows[0].id;
  const otherToken = jwt.sign({ userId: randomUUID(), tenantId: otherTenant, email: "autre@veille.invalid", role: "admin" }, JWT_SECRET, { expiresIn: "15m" });

  // ── Schéma
  const tables = (await db.query(`SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'erep_%'`)).rows.map(r => r.table_name);
  check(["erep_watch_settings", "erep_watch_runs", "erep_serp_snapshots", "erep_reviews", "erep_review_stats", "erep_mentions"].every(t => tables.includes(t)), "Tables de veille créées", tables);

  // ── Campagne entité et réglages
  const campaign = (await request("POST", "/ereputation/campaigns", { name: "Veille Acme", targetType: "B2B", targetName: "Acme Lille",
    targetUrl: "https://www.acme-lille.fr", subjectLocation: "Lille", keywords: ["acme lille avis"] }, token)).body;
  const cid = campaign.id;
  const overview0 = (await request("GET", `/ereputation/campaigns/${cid}/watch`, undefined, token)).body;
  check(overview0.settings.configured === false && overview0.settings.frequency === "daily" && overview0.cloudConfigured === true, "Réglages par défaut : quotidien, navigateur configuré", overview0.settings);
  check(overview0.queries[0] === '"Acme Lille"' && overview0.queries.includes('"Acme Lille" Lille') && overview0.queries.includes("acme lille avis")
    && overview0.queries.some(q => q.includes("site:trustpilot.com")), "Requêtes générées : nom exact, lieu, mots-clés, sites d'avis", overview0.queries);
  check(Object.values(overview0.profiles).every(v => v === false), "Aucun profil navigateur détecté au départ", overview0.profiles);
  check((await request("GET", `/ereputation/campaigns/${cid}/watch`, undefined, otherToken)).status === 404, "Autre agence : veille inaccessible");

  for (const [body, label] of [
    [{ mapsUrl: "https://maps.app.goo.gl/abc" }, "lien Maps raccourci refusé"],
    [{ pagesjaunesUrl: "https://evil.example/pros/1" }, "fiche PagesJaunes d'un autre site refusée"],
    [{ rssFeeds: ["https://127.0.0.1/flux"] }, "flux RSS sur adresse IP refusé"],
    [{ rssFeeds: ["http://presse.example/rss"] }, "flux RSS non HTTPS refusé"],
    [{ dailyDepth: 500 }, "profondeur hors bornes refusée"],
    [{ engines: ["yahoo"] }, "moteur inconnu refusé"],
  ]) check((await request("PUT", `/ereputation/campaigns/${cid}/watch`, body, token)).status === 400, `Réglages : ${label}`);

  const saved = await request("PUT", `/ereputation/campaigns/${cid}/watch`, { engines: ["google_search"], frequency: "daily",
    mapsUrl: "https://www.google.com/maps/place/Acme+Lille/@50.6,3.0", pagesjaunesUrl: "https://www.pagesjaunes.fr/pros/123456", newsEnabled: true }, token);
  check(saved.status === 200 && saved.body.settings.configured && saved.body.settings.mapsUrl.includes("/maps/place/"), "Réglages enregistrés", saved.body);
  const parisHour = d => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date(d)).find(p => p.type === "hour").value);
  check(parisHour(saved.body.settings.nextRunAt) >= 3 && parisHour(saved.body.settings.nextRunAt) < 6, "Prochaine veille planifiée la nuit (3 h – 6 h, heure de Paris)", saved.body.settings.nextRunAt);
  const weeklyDay = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", weekday: "short" }).format(new Date(saved.body.settings.nextWeeklyAt));
  check(weeklyDay === "Sun", "Veille hebdomadaire planifiée le dimanche", saved.body.settings.nextWeeklyAt);

  // ── Passage sans profil navigateur : seules les sources sans navigateur sont lues
  const run0 = await request("POST", `/ereputation/campaigns/${cid}/watch/run`, {}, token);
  check(run0.status === 202 && run0.body.status === "queued", "Veille mise en file (202)", run0.body);
  const done0 = await waitRun(cid, token);
  const skipped = done0.steps.filter(s => s.status === "skipped");
  check(done0.status === "completed" && skipped.length === done0.steps.filter(s => s.type === "serp" || s.type === "reviews").length
    && skipped.every(s => /Aucun profil navigateur/.test(s.message)), "Sans profil : étapes navigateur ignorées avec explication, presse lue", done0.steps);
  check(worker.calls.length === 0, "Sans profil : aucun appel au navigateur", worker.calls.length);
  await db.query(`DELETE FROM erep_mentions WHERE campaign_id = $1`, [cid]);

  // ── Profils navigateur de l'agence (créés côté prospection)
  for (const source of ["google_search", "google_maps", "pagesjaunes"])
    await db.query(`INSERT INTO cloud_browser_profiles (tenant_id, created_by, source, label) VALUES ($1, $2, $3, $3)`, [me.tenantId, me.userId, source]);

  // ── Passage 1 : référence
  const r1 = await request("POST", `/ereputation/campaigns/${cid}/watch/run`, {}, token);
  check(r1.status === 202, "Passage 1 lancé");
  check((await request("POST", `/ereputation/campaigns/${cid}/watch/run`, {}, token)).status === 409, "Une seule veille active par campagne (409)");
  const done1 = await waitRun(cid, token);
  check(done1.status === "awaiting_user" && done1.steps.find(s => s.source === "pagesjaunes").status === "awaiting_user", "Contrôle de sécurité PagesJaunes : passage en attente de l'humain", done1.steps);
  check(done1.stats.baseline === true && done1.stats.completed >= 3, "Passage 1 : marqué comme référence", done1.stats);
  const serpCall = worker.calls.find(c => c.task === "serp");
  check(serpCall && serpCall.depth === 20 && serpCall.tenantId === me.tenantId && serpCall.source === "google_search", "Navigateur appelé avec le profil de l'agence et le top 20 quotidien", serpCall);
  check(!worker.calls.some(c => c.source === "bing"), "Moteur désactivé (Bing) non interrogé");
  const tracking = (await db.query(`SELECT keyword, position FROM erep_serp_tracking WHERE campaign_id = $1 AND keyword = '"Acme Lille"'`, [cid])).rows;
  check(tracking.length === 1 && tracking[0].position === 3, "Position du site de la cible enregistrée dans le suivi SERP (3)", tracking);
  const stats1 = (await db.query(`SELECT source, rating::float AS rating, review_count FROM erep_review_stats WHERE campaign_id = $1`, [cid])).rows;
  check(stats1.length === 1 && stats1[0].rating === 4.2 && stats1[0].review_count === 128, "Note et volume Google Maps enregistrés", stats1);
  const mentions1 = (await request("GET", `/ereputation/campaigns/${cid}/mentions`, undefined, token)).body;
  check(mentions1.counts.total > 0 && mentions1.mentions.every(m => m.baseline), "Passage 1 : mentions créées comme référence", mentions1.counts);
  check(mentions1.mentions.some(m => m.kind === "review" && m.sentiment === "neg") && mentions1.mentions.some(m => m.kind === "news" && m.title.includes("Nord Éclair")), "Avis 1 étoile négatif et article de presse dans le fil", mentions1.mentions.map(m => [m.kind, m.title, m.sentiment]));
  check(mentions1.mentions.some(m => m.kind === "serp" && m.sentiment === "neg" && m.url.includes("arnaque")), "Résultat SERP négatif repéré (« arnaque »)");

  // ── Reprise après contrôle de sécurité
  const serpBefore = worker.calls.filter(c => c.task === "serp").length, pjBefore = worker.calls.filter(c => c.source === "pagesjaunes").length;
  const resumed = await request("POST", `/ereputation/watch/runs/${done1.id}/resume`, {}, token);
  check(resumed.status === 200 && resumed.body.status === "queued", "Reprise de la veille en attente", resumed.body);
  worker.phase = 2;
  const done1b = await waitRun(cid, token);
  check(done1b.id === done1.id && done1b.status === "completed" && done1b.steps.every(s => s.status === "completed"), "Après reprise : toutes les étapes terminées", done1b.steps.map(s => [s.source, s.status]));
  check(worker.calls.filter(c => c.task === "serp").length === serpBefore && worker.calls.filter(c => c.source === "pagesjaunes").length === pjBefore + 1, "Reprise : seule l'étape en attente est rejouée");
  check((await request("POST", `/ereputation/watch/runs/${done1.id}/resume`, {}, otherToken)).status === 404, "Autre agence : reprise refusée");

  // ── Passage 2 : détection des nouveautés
  const r2 = await request("POST", `/ereputation/campaigns/${cid}/watch/run`, { depth: 50 }, token);
  check(r2.status === 202 && r2.body.depth === 50, "Passage 2 lancé en profondeur 50");
  const done2 = await waitRun(cid, token);
  const step = done2.steps.find(s => s.type === "serp" && s.query === '"Acme Lille"');
  check(done2.status === "completed" && step.newItems === 1 && step.dropped === 1 && step.moved === 3, "SERP : 1 nouveau résultat, 1 disparu, 3 déplacés", step);
  const maps2 = done2.steps.find(s => s.source === "google_maps");
  check(maps2.newItems === 1 && maps2.items === 3, "Avis Maps : 1 nouvel avis, pas de doublon", maps2);
  const reviewsCount = (await db.query(`SELECT COUNT(*)::int AS n FROM erep_reviews WHERE campaign_id = $1 AND source = 'google_maps'`, [cid])).rows[0].n;
  check(reviewsCount === 3, "Avis Maps stockés sans doublon (3)", reviewsCount);
  const latest = (await request("GET", `/ereputation/campaigns/${cid}/watch/serp`, undefined, token)).body;
  const exact = latest.filter(r => r.query === '"Acme Lille"');
  check(exact.find(r => r.url.includes("r6")).is_new === true && exact.find(r => r.url.includes("r1")).previous_position === 1 && exact.find(r => r.url.includes("r1")).position === 2,
    "Relevé SERP : nouveau résultat signalé et position précédente fournie", exact);
  const mentions2 = (await request("GET", `/ereputation/campaigns/${cid}/mentions?status=new`, undefined, token)).body;
  const fresh = mentions2.mentions.filter(m => !m.baseline);
  check(fresh.some(m => m.url === "https://r6.example/nouveau") && fresh.some(m => m.kind === "review" && /Retard/.test(m.excerpt)) && fresh.some(m => m.kind === "news" && /récompensée/.test(m.title)),
    "Fil : nouveautés SERP, avis et presse distinguées de la référence", fresh.map(m => [m.kind, m.title]));
  check(mentions2.counts.newSinceBaseline === fresh.length, "Compteur des nouveautés depuis la référence", mentions2.counts);
  const reviewsApi = (await request("GET", `/ereputation/campaigns/${cid}/reviews`, undefined, token)).body;
  check(reviewsApi.stats.length === 2 && reviewsApi.reviews.length === 4, "Synthèse des avis : Maps et PagesJaunes", reviewsApi.stats);
  const sentimentLogs = (await db.query(`SELECT COUNT(*)::int AS n FROM erep_sentiment_logs WHERE campaign_id = $1`, [cid])).rows[0].n;
  check(sentimentLogs >= 7, "Avis et articles alimentent la composante mentions du score", sentimentLogs);
  const dash = (await request("GET", `/ereputation/campaigns/${cid}/dashboard`, undefined, token)).body;
  check(dash.reputationScore !== null && dash.scoreBreakdown.serp !== null && dash.scoreBreakdown.sentiment !== null, "Score calculé à partir des mesures de veille", dash.scoreBreakdown);

  // ── Qualification
  const target = fresh[0];
  const q = await request("PATCH", `/ereputation/mentions/${target.id}`, { status: "qualified" }, token);
  check(q.status === 200 && q.body.status === "qualified", "Mention qualifiée");
  check((await request("PATCH", `/ereputation/mentions/${target.id}`, { status: "ignored" }, otherToken)).status === 404, "Autre agence : qualification refusée");
  check((await request("PATCH", `/ereputation/mentions/${target.id}`, { status: "supprimée" }, token)).status === 400, "Statut de mention inconnu refusé");

  // ── La prospection a la priorité sur le navigateur partagé
  const profile = (await db.query(`SELECT id FROM cloud_browser_profiles WHERE tenant_id = $1 AND source = 'google_search'`, [me.tenantId])).rows[0].id;
  const job = (await db.query(`INSERT INTO cloud_browser_jobs (tenant_id, created_by, profile_id, query, status) VALUES ($1,$2,$3,'plombier lille','running') RETURNING id`, [me.tenantId, me.userId, profile])).rows[0].id;
  const before = worker.calls.length;
  await request("POST", `/ereputation/campaigns/${cid}/watch/run`, {}, token);
  await delay(1500);
  const waiting = (await request("GET", `/ereputation/campaigns/${cid}/watch/runs`, undefined, token)).body[0];
  check(waiting.status === "queued" && /prospection/.test(waiting.message) && worker.calls.length === before && new Date(waiting.notBefore) > new Date(),
    "Prospection en cours : la veille attend sans appeler le navigateur", waiting);
  const cancelled = await request("POST", `/ereputation/watch/runs/${waiting.id}/cancel`, {}, token);
  check(cancelled.status === 200 && cancelled.body.status === "cancelled", "Veille en file annulée");
  await db.query(`DELETE FROM cloud_browser_jobs WHERE id = $1`, [job]);

  // ── Planificateur : veille due mise en file avec la profondeur hebdomadaire le dimanche
  await db.query(`UPDATE erep_watch_settings SET next_run_at = NOW() - INTERVAL '1 minute', next_weekly_at = NOW() - INTERVAL '1 minute' WHERE campaign_id = $1`, [cid]);
  await new Promise((resolveRun, rejectRun) => {
    const child = spawn("node", ["--import", "tsx", "--input-type=module", "-e",
      "import {watchService} from './src/lib/plugin-ereputation/WatchService.ts'; import {pool} from '@workspace/db'; console.log(await watchService.scheduleDue()); await pool.end(); process.exit(0);"],
    { cwd: resolve(root, "artifacts/api-server"), env: { ...env, CLOUD_BROWSER_URL: "" }, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = ""; child.stdout.on("data", c => { out += c; }); child.stderr.on("data", c => { err += c; });
    child.on("exit", code => code === 0 && out.trim().endsWith("1") ? resolveRun() : rejectRun(new Error("Planificateur en échec : " + (out + err).slice(-800))));
  });
  const scheduled = (await db.query(`SELECT kind, depth, status FROM erep_watch_runs WHERE campaign_id = $1 ORDER BY created_at DESC LIMIT 1`, [cid])).rows[0];
  const next = (await db.query(`SELECT next_run_at > NOW() AS future, next_weekly_at > NOW() AS weekly_future FROM erep_watch_settings WHERE campaign_id = $1`, [cid])).rows[0];
  check(scheduled.kind === "weekly" && scheduled.depth === 50 && scheduled.status === "queued" && next.future && next.weekly_future, "Planificateur : veille hebdomadaire top 50 mise en file, prochains créneaux recalculés", { scheduled, next });
  await db.query(`UPDATE erep_watch_runs SET status = 'cancelled' WHERE campaign_id = $1 AND status = 'queued'`, [cid]);

  // ── Campagne en pause : pas de veille
  await request("POST", `/ereputation/campaigns/${cid}/status`, { status: "paused" }, token);
  check((await request("POST", `/ereputation/campaigns/${cid}/watch/run`, {}, token)).status === 409, "Campagne en pause : veille refusée");

  // ── Personne physique : requêtes du catalogue personnes
  const person = (await request("POST", "/ereputation/campaigns", { name: "Veille Albert", targetType: "B2C", targetName: "Albert Ducamps", subjectRole: "Dirigeant",
    mandateReference: "M-1", mandateSignatory: "Albert Ducamps", mandateSignedAt: isoDay(0), retentionUntil: isoDay(300) }, token)).body;
  const personQueries = (await request("GET", `/ereputation/campaigns/${person.id}/watch`, undefined, token)).body.queries;
  check(personQueries.includes('"Albert Ducamps" Dirigeant') && personQueries.some(q => q.includes("site:linkedin.com")) && personQueries.some(q => q.includes("site:societe.com"))
    && !personQueries.some(q => q.includes("trustpilot")), "Personne : requêtes réseaux sociaux et annuaires de dirigeants", personQueries);

  // ── Suppression : toute la veille part avec la campagne
  const removed = await request("DELETE", `/ereputation/campaigns/${cid}`, undefined, token);
  check(removed.status === 200, "Campagne supprimée");
  const left = (await db.query(`SELECT (SELECT COUNT(*) FROM erep_mentions WHERE campaign_id = $1) + (SELECT COUNT(*) FROM erep_reviews WHERE campaign_id = $1)
    + (SELECT COUNT(*) FROM erep_serp_snapshots WHERE campaign_id = $1) + (SELECT COUNT(*) FROM erep_watch_runs WHERE campaign_id = $1)
    + (SELECT COUNT(*) FROM erep_watch_settings WHERE campaign_id = $1) AS n`, [cid])).rows[0].n;
  check(Number(left) === 0, "Suppression : réglages, passages, relevés, avis et mentions effacés", left);
  const history = (await request("GET", `/ereputation/campaigns/${cid}/history`, undefined, token)).body;
  check(history[0].changes.deletedData.before.watchMentions > 0, "Historique : volume de mentions supprimées tracé", history[0].changes.deletedData);

  console.log(`\n${passed} contrôles de veille e-réputation réussis.`);
} catch (error) {
  console.error(`\n✗ ${error.message}`);
  if (apiLog) console.error("\nJournal API (fin) :\n" + apiLog.split("\n").filter(l => /"level":(40|50)|Error/.test(l)).slice(-15).join("\n"));
  process.exitCode = 1;
} finally {
  api?.kill("SIGTERM");
  fakeWorker.close();
  await delay(500);
  await db.end().catch(() => undefined);
  await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`).catch(() => undefined);
  await admin.end();
}
