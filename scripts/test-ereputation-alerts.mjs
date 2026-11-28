/**
 * Tests d'intégration e-réputation — lot 3 « analyse et alertes ».
 *
 * Prérequis : PostgreSQL 16, dépendances installées, API compilée
 *   pnpm --filter @workspace/api-server build
 * Lancement :
 *   EREP_POSTGRES_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres node scripts/test-ereputation-alerts.mjs
 *
 * Un faux navigateur cloud, un faux Google Actualités et un faux fournisseur IA
 * (API compatible OpenAI) locaux remplacent les services réels. Les e-mails
 * sont en mode journal (EREP_ALERT_EMAIL_ENABLED=log) : rien n'est envoyé.
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
const dbName = `growthos_erep3_${randomBytes(4).toString("hex")}`;
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
const fakePort = await availablePort();
const env = {
  ...process.env,
  CLOUD_BROWSER_URL: `http://127.0.0.1:${fakePort}`,
  CLOUD_BROWSER_TOKEN: randomBytes(24).toString("hex"),
  EREP_GOOGLE_NEWS_RSS_URL: `http://127.0.0.1:${fakePort}/rss`,
  EREP_ALERT_EMAIL_ENABLED: "log",
  EREP_APP_URL: "https://growthos.example",
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
  if (!condition) throw new Error(`${message}${detail !== undefined ? ` — reçu : ${JSON.stringify(detail).slice(0, 800)}` : ""}`);
  passed++;
  console.log(`  ✓ ${message}`);
}

async function request(method, path, data, token) {
  const response = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, body };
}

// ── Faux services : navigateur cloud, Google Actualités, fournisseur IA.
const fake = { phase: 1, llmCalls: 0, mapsRating: 4.2, serpMode: undefined };
const rssXml = items => `<?xml version="1.0"?><rss><channel>${items.map(i => `<item><title><![CDATA[${i.title}]]></title><link>${i.url}</link><pubDate>Sat, 28 Nov 2026 08:00:00 GMT</pubDate><source url="https://presse.example">${i.source}</source><description>${i.title}</description></item>`).join("")}</channel></rss>`;
const serpFor = phase => phase === 1
  ? ["https://r1.example/a", "https://r2.example/b", "https://acme-lille.fr/", "https://r4.example/arnaque", "https://r5.example/e"]
  : ["https://r2.example/b", "https://r1.example/a", "https://acme-lille.fr/", "https://r6.example/nouveau", "https://r4.example/arnaque"];
/** Faux modèle : verdicts déterministes selon le texte de chaque mention. */
function llmAnswer(prompt) {
  fake.llmCalls++;
  if (prompt.includes("Rédige")) return "Bonjour Lina, merci pour votre retour. Nous sommes désolés pour ce retard et souhaitons en parler avec vous : pouvez-vous nous contacter directement ? Cordialement, l'équipe Acme Lille.";
  const lines = prompt.split("Mentions :\n")[1]?.split("\n").filter(l => /^\d+\. /.test(l)) ?? [];
  const verdicts = lines.map(line => {
    const i = Number(line.split(".")[0]);
    if (/arnaque/i.test(line)) return { i, sentiment: "neg", score: -0.9, critical: true, themes: ["arnaque"] };
    if (/nouveau|litige|Retard|abandonné/i.test(line)) return { i, sentiment: "neg", score: -0.6, critical: false, themes: ["litige"] };
    if (/Excellent|récompensée|rachète/i.test(line)) return { i, sentiment: "pos", score: 0.7, critical: false, themes: ["qualité"] };
    return { i, sentiment: "neu", score: 0, critical: false, themes: [] };
  });
  return `Voici l'analyse :\n${JSON.stringify(verdicts)}`;
}
const fakeServer = createServer(async (req, res) => {
  let raw = ""; for await (const c of req) raw += c;
  const send = (status, value) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(value)); };
  if (req.url.startsWith("/rss")) {
    const items = [{ title: "Acme Lille rachète un concurrent", url: "https://presse.example/acme-rachat", source: "La Voix" },
      { title: "Acme Lille : un litige avec un client", url: "https://presse.example/acme-litige", source: "Nord Éclair" }];
    if (fake.phase >= 2) items.push({ title: "Acme Lille récompensée", url: "https://presse.example/acme-prix", source: "La Voix" });
    res.writeHead(200, { "Content-Type": "application/rss+xml" }); res.end(rssXml(items)); return;
  }
  if (req.url === "/v1/chat/completions") {
    const body = JSON.parse(raw || "{}");
    send(200, { choices: [{ message: { content: llmAnswer(body.messages?.[0]?.content ?? "") } }] }); return;
  }
  if (req.headers["x-worker-token"] !== env.CLOUD_BROWSER_TOKEN) { send(401, { error: "Accès refusé" }); return; }
  const input = JSON.parse(raw || "{}");
  await delay(100);
  if (input.task === "serp" && fake.serpMode === "blocked") { send(200, { status: "awaiting_user", results: [], pages: 1, message: "La source demande votre consentement." }); return; }
  if (input.task === "serp") {
    const urls = serpFor(fake.phase).slice(0, input.depth);
    send(200, { status: "completed", pages: 1, results: urls.map((url, i) => ({ url, title: `Titre ${url}`, snippet: url.includes("arnaque") ? "Acme Lille arnaque signalée" : "Acme Lille", position: i + 1 })) });
    return;
  }
  if (input.source === "google_maps") {
    const reviews = [{ externalId: "g1", author: "Marie", rating: 5, date: "il y a 2 jours", text: "Excellent travail, je recommande", ownerResponse: false },
      { externalId: "g2", author: "Paul", rating: 1, date: "il y a 1 semaine", text: "Chantier abandonné", ownerResponse: true }];
    if (fake.phase >= 2) reviews.unshift({ externalId: "g3", author: "Lina", rating: 2, date: "il y a 1 heure", text: "Retard important", ownerResponse: false });
    send(200, { status: "completed", summary: { name: "Acme Lille", rating: fake.mapsRating, count: 128 }, reviews });
    return;
  }
  send(400, { error: "Tâche inconnue" });
});
await new Promise(r => fakeServer.listen(fakePort, "127.0.0.1", r));

async function waitRun(campaignId, token) {
  const deadline = Date.now() + 30000;
  for (;;) {
    const runs = (await request("GET", `/ereputation/campaigns/${campaignId}/watch/runs`, undefined, token)).body;
    if (Array.isArray(runs) && runs[0] && !["queued", "running"].includes(runs[0].status)) { await delay(300); return runs[0]; }
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
  console.log(`\nGrowthOS — e-réputation lot 3 « analyse et alertes » (base jetable ${dbName})`);
  api = spawn("node", ["artifacts/api-server/dist/index.mjs"], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
  api.stdout.on("data", c => { apiLog = (apiLog + c).slice(-20000); });
  api.stderr.on("data", c => { apiLog = (apiLog + c).slice(-20000); });
  const deadline = Date.now() + 90000;
  for (;;) {
    try { if ((await request("GET", "/setup/status")).status === 200) break; } catch { /* démarrage */ }
    if (Date.now() > deadline) throw new Error("L'API n'a pas démarré (migrations ?)");
    await delay(500);
  }
  const boot = await request("POST", "/setup/bootstrap", {
    setupToken, companyName: "Agence alertes test", email: "admin@alertes.invalid", password: "LocalOnlyPassword#123456",
  });
  check(boot.status === 201 && boot.body.accessToken, "Administrateur de recette créé", boot.body);
  const token = boot.body.accessToken;
  const me = jwt.decode(token);
  await db.connect();
  const otherTenant = (await db.query(`INSERT INTO tenants (name, slug) VALUES ('Agence concurrente', $1) RETURNING id`, [`concurrente-${randomUUID()}`])).rows[0].id;
  const otherUser = (await db.query(`INSERT INTO users (email, password_hash, tenant_id, role) VALUES ('autre@alertes.invalid', 'x', $1, 'admin') RETURNING id`, [otherTenant])).rows[0].id;
  const otherToken = jwt.sign({ userId: otherUser, tenantId: otherTenant, email: "autre@alertes.invalid", role: "admin" }, JWT_SECRET, { expiresIn: "15m" });

  // ── Schéma
  const tables = (await db.query(`SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'erep_%'`)).rows.map(r => r.table_name);
  check(["erep_score_history", "erep_alert_settings", "erep_crisis_plans", "erep_email_settings", "erep_email_log"].every(t => tables.includes(t)), "Tables du lot 3 créées", tables);

  // ── Fournisseur IA de l'agence (faux service compatible OpenAI)
  const key = await request("POST", "/admin/api-keys", { provider: "openai", apiKey: "sk-test-local", endpointUrl: `http://127.0.0.1:${fakePort}/v1` }, token);
  check(key.status === 201, "Clé du fournisseur IA enregistrée", key.body);
  await db.query(`UPDATE tenants SET settings = COALESCE(settings, '{}'::jsonb) || '{"aiProvider":"openai"}'::jsonb WHERE id = $1`, [me.tenantId]);

  // ── Campagne entité, veille Google + Maps + presse
  const cid = (await request("POST", "/ereputation/campaigns", { name: "Alertes Acme", targetType: "B2B", targetName: "Acme Lille",
    targetUrl: "https://www.acme-lille.fr", subjectLocation: "Lille" }, token)).body.id;
  await request("PUT", `/ereputation/campaigns/${cid}/watch`, { engines: ["google_search"], mapsUrl: "https://www.google.com/maps/place/Acme+Lille/@50.6,3.0", newsEnabled: true }, token);
  for (const source of ["google_search", "google_maps"])
    await db.query(`INSERT INTO cloud_browser_profiles (tenant_id, created_by, source, label) VALUES ($1, $2, $3, $3)`, [me.tenantId, me.userId, source]);

  // ── Passage 1 (référence) : sentiment IA
  await request("POST", `/ereputation/campaigns/${cid}/watch/run`, {}, token);
  const run1 = await waitRun(cid, token);
  check(run1.status === "completed", "Passage 1 terminé", run1.steps.map(s => [s.source, s.status, s.message]));
  const m1 = (await request("GET", `/ereputation/campaigns/${cid}/mentions`, undefined, token)).body;
  check(fake.llmCalls >= 1 && m1.mentions.every(m => m.analysis_source === "ai"), "Toutes les mentions analysées par le fournisseur IA de l'agence", m1.mentions.map(m => [m.title, m.analysis_source]));
  const arnaque = m1.mentions.find(m => m.url?.includes("arnaque"));
  check(arnaque.severity === "critical" && arnaque.sentiment === "neg" && arnaque.themes.includes("arnaque"), "Accusation d'arnaque : mention critique avec thème", arnaque);
  check(m1.mentions.find(m => m.title?.includes("litige")).sentiment === "neg" && m1.counts.critical >= 1, "Article « litige » négatif, compteur de critiques", m1.counts);
  const logsSynced = (await db.query(`SELECT COUNT(*)::int AS n FROM erep_sentiment_logs l JOIN erep_mentions m ON m.id = l.mention_id WHERE l.campaign_id = $1 AND l.sentiment <> m.sentiment`, [cid])).rows[0].n;
  check(logsSynced === 0, "Journal de sentiment aligné sur l'analyse IA (score)");
  const alerts1 = (await request("GET", `/ereputation/alerts?campaignId=${cid}`, undefined, token)).body;
  check(!alerts1.some(a => ["negative_mention", "low_review", "negative_serp"].includes(a.type)), "Référence : aucune alerte « nouvelle mention » sur l'existant", alerts1.map(a => a.type));

  // ── Score expliqué
  const sc = await request("GET", `/ereputation/campaigns/${cid}/score`, undefined, token);
  check(sc.status === 200 && Number.isInteger(sc.body.score) && sc.body.components.length === 4, "Score expliqué : 4 composantes", sc.body);
  const comp = Object.fromEntries(sc.body.components.map(c => [c.key, c]));
  check(comp.serp.measured && comp.sentiment.measured && comp.reviews.measured && !comp.backlinks.measured && comp.backlinks.points === null,
    "Composantes mesurées / non mesurées distinguées (liens non mesurés)", sc.body.components.map(c => [c.key, c.value]));
  check(Math.abs(comp.serp.effectiveWeight - 0.4 / 0.9) < 0.002 && Math.abs(comp.reviews.effectiveWeight - 0.2 / 0.9) < 0.002, "Poids renormalisés sur les composantes mesurées (40/30/20 sur 90)", sc.body.components.map(c => c.effectiveWeight));
  const sumPoints = sc.body.components.reduce((s, c) => s + (c.points ?? 0), 0);
  check(Math.abs(sumPoints - sc.body.score) <= 1, "Somme des points des composantes = score", { sumPoints, score: sc.body.score });
  check(comp.reviews.value === 80 && comp.reviews.factors.some(f => f.label.includes("Google Maps : 4,2/5 sur 128 avis")), "Avis : 4,2/5 → 80/100, facteur détaillé", comp.reviews);
  check(comp.serp.factors.some(f => f.tone === "neg" && /Résultat négatif critique en position 4/.test(f.label) && f.impact < 0), "SERP : résultat négatif position 4 chiffré en points perdus", comp.serp.factors);
  check(sc.body.summary.some(s => s.startsWith(`${sc.body.score}/100`)) && sc.body.summary.some(s => s.startsWith("Ce qui pèse le plus")) && sc.body.summary.some(s => /Non mesuré : liens et autorité/.test(s)),
    "Résumé lisible : score, points négatifs, composante non mesurée signalée", sc.body.summary);
  check(sc.body.history.length === 1 && sc.body.previous === null && sc.body.summary.some(s => s.startsWith("Premier relevé")), "Historique : premier relevé du jour", sc.body.history);
  check((await request("GET", `/ereputation/campaigns/${cid}/score`, undefined, otherToken)).status === 404, "Autre agence : score inaccessible");

  // ── Plan de crise ouvert par la mention critique (seuil « alerte »)
  const crisis1 = (await request("GET", `/ereputation/campaigns/${cid}/crisis`, undefined, token)).body;
  check(crisis1.open && crisis1.open.level === 2 && crisis1.open.reasons.some(r => /critique/.test(r)), "Plan de crise « Alerte » ouvert sur mention critique", crisis1);
  check(crisis1.open.actions.some(a => a.id === "reply_publish") && !crisis1.open.actions.some(a => a.level === 3), "Plan : actions des niveaux 1 et 2 uniquement", crisis1.open.actions.map(a => a.id));
  const crisisAlert = (await request("GET", `/ereputation/alerts?campaignId=${cid}`, undefined, token)).body.find(a => a.type === "crisis");
  check(crisisAlert && crisisAlert.severity === "high" && crisisAlert.href.includes(`campaign=${cid}`), "Alerte de crise créée avec lien vers la campagne", crisisAlert);
  const notifs = (await request("GET", "/notifications", undefined, token)).body;
  const notifList = Array.isArray(notifs) ? notifs : notifs.notifications ?? notifs.data ?? [];
  check(notifList.some(n => n.payload?.module === "ereputation" && n.payload?.campaignId === cid && n.href?.startsWith("/ereputation/watch")), "Alerte visible dans la cloche de notifications", notifList.slice(0, 3));
  await request("POST", `/ereputation/campaigns/${cid}/crisis/evaluate`, {}, token);
  const crisisCount = (await db.query(`SELECT COUNT(*)::int AS n FROM erep_alerts WHERE campaign_id = $1 AND type = 'crisis'`, [cid])).rows[0].n;
  const plans = (await db.query(`SELECT COUNT(*)::int AS n FROM erep_crisis_plans WHERE campaign_id = $1`, [cid])).rows[0].n;
  check(crisisCount === 1 && plans === 1, "Réévaluation : ni plan ni alerte en double", { crisisCount, plans });

  // ── Passage 2 : nouveautés négatives
  fake.phase = 2;
  await request("POST", `/ereputation/campaigns/${cid}/watch/run`, {}, token);
  const run2 = await waitRun(cid, token);
  const alerts2 = (await request("GET", `/ereputation/alerts?campaignId=${cid}`, undefined, token)).body;
  const byType = t => alerts2.filter(a => a.type === t);
  check(byType("negative_serp").length === 1 && /position 4/.test(byType("negative_serp")[0].title), "Résultat négatif entré dans le top 10 : alerte", alerts2.map(a => a.title));
  check(byType("negative_mention").length === 1 && /1 nouvelle\(s\) mention\(s\) négative\(s\)/.test(byType("negative_mention")[0].title), "Nouvelles mentions négatives regroupées en une alerte", byType("negative_mention"));
  check(byType("low_review").length === 1 && /1 nouvel\(s\) avis/.test(byType("low_review")[0].title), "Nouvel avis 2 étoiles : alerte", byType("low_review"));
  check(!alerts2.some(a => a.title.includes("récompensée")), "Article positif : pas d'alerte");
  const sc2 = (await request("GET", `/ereputation/campaigns/${cid}/score`, undefined, token)).body;
  check(sc2.components.find(c => c.key === "serp").factors.some(f => f.url === "https://r6.example/nouveau" && f.impact < 0), "Score : le nouveau résultat négatif apparaît dans les facteurs", sc2.components[0].factors);

  // ── Note en baisse, captcha
  fake.mapsRating = 3.8;
  await request("POST", `/ereputation/campaigns/${cid}/watch/run`, {}, token);
  await waitRun(cid, token);
  const drop = (await request("GET", `/ereputation/alerts?campaignId=${cid}`, undefined, token)).body.filter(a => a.type === "rating_drop");
  check(drop.length === 1 && /4,2 à 3,8/.test(drop[0].description), "Note Maps 4,2 → 3,8 : alerte de baisse", drop);
  fake.serpMode = "blocked";
  await request("POST", `/ereputation/campaigns/${cid}/watch/run`, {}, token);
  const blocked = await waitRun(cid, token);
  check(blocked.status === "awaiting_user" && (await request("GET", `/ereputation/alerts?campaignId=${cid}`, undefined, token)).body.some(a => a.type === "watch_blocked" && a.severity === "low"), "Veille bloquée par un consentement : alerte basse");
  await request("POST", `/ereputation/watch/runs/${blocked.id}/cancel`, {}, token);
  fake.serpMode = undefined;
  check((await request("GET", `/ereputation/alerts?campaignId=${cid}`, undefined, otherToken)).body.length === 0, "Autre agence : aucune alerte visible");

  // ── Correction manuelle, ignorer une mention
  const neutral = (await request("GET", `/ereputation/campaigns/${cid}/mentions`, undefined, token)).body.mentions.find(m => m.url === "https://r1.example/a");
  check(neutral.sentiment === "neu", "Résultat neutre avant correction", neutral);
  const settingsMail = await request("PUT", "/ereputation/alert-email", { recipients: [me.userId], daily: true, weekly: true, immediateCritical: true }, token);
  check(settingsMail.status === 200 && settingsMail.body.settings.mode === "log" && settingsMail.body.members.some(m => m.id === me.userId), "Réglages e-mail : destinataire de l'agence, mode journal", settingsMail.body.settings);
  const corr = await request("PATCH", `/ereputation/mentions/${neutral.id}`, { sentiment: "neg", critical: true }, token);
  check(corr.status === 200 && corr.body.analysis_source === "manual" && corr.body.severity === "critical", "Correction manuelle : négatif critique", corr.body);
  await delay(800);
  const critAlert = (await db.query(`SELECT id, emailed_at FROM erep_alerts WHERE campaign_id = $1 AND dedup_key = $2`, [cid, `critical:${neutral.id}`])).rows[0];
  check(critAlert && critAlert.emailed_at, "Correction en critique : alerte et e-mail immédiat (mode journal)", critAlert);
  await request("POST", `/ereputation/campaigns/${cid}/watch/run`, {}, token);
  await waitRun(cid, token);
  const kept = (await db.query(`SELECT sentiment, analysis_source FROM erep_mentions WHERE id = $1`, [neutral.id])).rows[0];
  check(kept.sentiment === "neg" && kept.analysis_source === "manual", "Correction manuelle conservée après un nouveau passage IA", kept);
  const r6 = (await request("GET", `/ereputation/campaigns/${cid}/mentions`, undefined, token)).body.mentions.find(m => m.url === "https://r6.example/nouveau");
  await request("PATCH", `/ereputation/mentions/${r6.id}`, { status: "ignored" }, token);
  const sc3 = (await request("GET", `/ereputation/campaigns/${cid}/score`, undefined, token)).body;
  check(!sc3.components.find(c => c.key === "serp").factors.some(f => f.url === "https://r6.example/nouveau"), "Mention ignorée : sortie des facteurs du score");
  check((await request("PATCH", `/ereputation/mentions/${r6.id}`, { sentiment: "excellent" }, token)).status === 400, "Sentiment inconnu refusé");
  check((await request("PATCH", `/ereputation/mentions/${r6.id}`, { sentiment: "pos" }, otherToken)).status === 404, "Autre agence : correction refusée");

  // ── Score : évolution et baisse sur 7 jours
  await db.query(`INSERT INTO erep_score_history (campaign_id, day, score, components) VALUES ($1, CURRENT_DATE - 2, 95, '{"serp":100,"sentiment":90,"reviews":90,"backlinks":null}')`, [cid]);
  const sc4 = (await request("GET", `/ereputation/campaigns/${cid}/score`, undefined, token)).body;
  check(sc4.previous && sc4.previous.score === 95 && sc4.previous.delta === sc4.score - 95 && sc4.previous.byComponent.length > 0, "Évolution depuis le relevé précédent, par composante", sc4.previous);
  check(sc4.summary.some(s => s.startsWith("En baisse de")), "Résumé : baisse expliquée", sc4.summary);
  await request("POST", `/ereputation/campaigns/${cid}/crisis/evaluate`, {}, token);
  check((await db.query(`SELECT COUNT(*)::int AS n FROM erep_alerts WHERE campaign_id = $1 AND type = 'score_drop'`, [cid])).rows[0].n === 1, "Baisse d'au moins 10 points en 7 jours : alerte");

  // ── Règles et escalade en crise
  check((await request("PUT", `/ereputation/campaigns/${cid}/alert-rules`, { crisis: { crisisScore: 80, alertScore: 60 } }, token)).status === 400, "Seuil de crise au-dessus du seuil d'alerte refusé");
  check((await request("PUT", `/ereputation/campaigns/${cid}/alert-rules`, { scoreLow: 150 }, token)).status === 400, "Seuil hors bornes refusé");
  check((await request("GET", `/ereputation/campaigns/${cid}/alert-rules`, undefined, otherToken)).status === 404, "Autre agence : règles inaccessibles");
  const esc = await request("PUT", `/ereputation/campaigns/${cid}/alert-rules`, { scoreLow: 90, crisis: { crisisScore: 89, alertScore: 90 } }, token);
  check(esc.status === 200 && esc.body.rules.crisis.crisisScore === 89 && esc.body.rules.negativeMention === true, "Règles enregistrées, valeurs par défaut conservées", esc.body.rules);
  await request("POST", `/ereputation/campaigns/${cid}/crisis/evaluate`, {}, token);
  const crisis2 = (await request("GET", `/ereputation/campaigns/${cid}/crisis`, undefined, token)).body;
  check(crisis2.open.id === crisis1.open.id && crisis2.open.level === 3 && crisis2.open.actions.some(a => a.id === "legal") && !crisis2.open.actions.some(a => a.id === "rgpd_delist"),
    "Escalade en « Crise » du même plan, actions d'entité ajoutées", crisis2.open);
  check(crisis2.open.actions.filter(a => a.id === "qualify").length === 1, "Escalade : actions existantes non dupliquées");
  check((await db.query(`SELECT COUNT(*)::int AS n FROM erep_alerts WHERE campaign_id = $1 AND type = 'score_low'`, [cid])).rows[0].n === 1, "Score sous le seuil : alerte unique");
  const hist = (await request("GET", `/ereputation/campaigns/${cid}/history`, undefined, token)).body.map(h => h.action);
  check(hist.includes("crisis_open") && hist.includes("crisis_escalate"), "Historique : ouverture et escalade du plan tracées", hist);

  // ── Actions du plan et clôture
  const planId = crisis2.open.id;
  const done = await request("PATCH", `/ereputation/crisis/${planId}/actions/qualify`, { done: true, assigneeId: me.userId }, token);
  check(done.status === 200 && done.body.actions.find(a => a.id === "qualify").done && done.body.actions.find(a => a.id === "qualify").doneBy === "admin@alertes.invalid", "Action cochée et attribuée", done.body.actions[0]);
  check((await request("PATCH", `/ereputation/crisis/${planId}/actions/qualify`, { assigneeId: otherUser }, token)).status === 400, "Attribution à un membre d'une autre agence refusée");
  check((await request("PATCH", `/ereputation/crisis/${planId}/actions/qualify`, { done: true }, otherToken)).status === 404, "Autre agence : plan inaccessible");
  const closed = await request("POST", `/ereputation/crisis/${planId}/close`, { note: "Situation maîtrisée" }, token);
  check(closed.status === 200 && closed.body.status === "closed", "Plan clôturé par l'agence");
  check((await request("POST", `/ereputation/crisis/${planId}/close`, {}, token)).status === 409, "Double clôture refusée (409)");

  // ── Résolution d'alerte
  const anyAlert = (await request("GET", `/ereputation/alerts?campaignId=${cid}&open=1`, undefined, token)).body[0];
  const resolved = await request("PATCH", `/ereputation/alerts/${anyAlert.id}`, { resolved: true }, token);
  check(resolved.status === 200 && resolved.body.is_resolved === true && !(await request("GET", `/ereputation/alerts?campaignId=${cid}&open=1`, undefined, token)).body.some(a => a.id === anyAlert.id), "Alerte résolue, sortie des alertes ouvertes");

  // ── Brouillon de réponse à un avis
  const reviews = (await request("GET", `/ereputation/campaigns/${cid}/reviews`, undefined, token)).body.reviews;
  const lina = reviews.find(r => r.author === "Lina");
  const draft = await request("POST", `/ereputation/reviews/${lina.id}/reply-draft`, {}, token);
  check(draft.status === 200 && draft.body.source === "ai" && /désolés/.test(draft.body.draft), "Brouillon de réponse IA", draft.body);
  check((await request("GET", `/ereputation/campaigns/${cid}/reviews`, undefined, token)).body.reviews.find(r => r.id === lina.id).reply_draft === draft.body.draft, "Brouillon conservé avec l'avis (jamais publié)");
  check((await request("POST", `/ereputation/reviews/${lina.id}/reply-draft`, {}, otherToken)).status === 404, "Autre agence : brouillon refusé");
  await db.query(`UPDATE tenants SET settings = settings - 'aiProvider' WHERE id = $1`, [me.tenantId]);
  const local = await request("POST", `/ereputation/reviews/${lina.id}/reply-draft`, {}, token);
  check(local.status === 200 && local.body.source === "template" && local.body.draft.includes("Acme Lille"), "Sans fournisseur IA : modèle local", local.body);

  // ── E-mails internes
  check((await request("PUT", "/ereputation/alert-email", { recipients: [otherUser] }, token)).status === 400, "Destinataire hors de l'agence refusé");
  const preview = (await request("GET", "/ereputation/alert-email/preview?kind=weekly", undefined, token)).body;
  check(preview.subject.includes("hebdomadaire") && preview.html.includes("Alertes Acme") && preview.html.includes("https://growthos.example/ereputation/watch?campaign="), "Aperçu hebdomadaire avec lien vers la campagne", preview.subject);
  const test = await request("POST", "/ereputation/alert-email/test", {}, token);
  check(test.status === 200 && test.body.sent === true && test.body.recipients === 1 && test.body.mode === "log", "Envoi de test (mode journal)", test.body);
  const daily1 = await request("POST", "/ereputation/alert-email/send-now", { kind: "daily" }, token);
  const daily2 = await request("POST", "/ereputation/alert-email/send-now", { kind: "daily" }, token);
  check(daily1.body.status === "sent" && daily2.body.status === "already_sent", "Récapitulatif quotidien envoyé une seule fois par jour", [daily1.body, daily2.body]);
  const logs = (await request("GET", "/ereputation/alert-email", undefined, token)).body.settings.lastSends.map(l => l.kind);
  check(["daily", "test", "immediate"].every(k => logs.includes(k)), "Journal des envois : quotidien, test, immédiat", logs);

  // ── Saisie manuelle critique : alerte interne, jamais de signal de prospection
  await request("POST", `/ereputation/campaigns/${cid}/sentiment`, { text: "Acme Lille est une arnaque, escroquerie totale" }, token);
  check((await db.query(`SELECT COUNT(*)::int AS n FROM erep_alerts WHERE campaign_id = $1 AND dedup_key LIKE 'log:%' AND type = 'critical_mention'`, [cid])).rows[0].n === 1, "Mention saisie critique : alerte interne");
  check((await db.query(`SELECT COUNT(*)::int AS n FROM signals WHERE type = 'reputation_crisis'`)).rows[0].n === 0, "Aucune écriture dans le fil « signals » de la prospection");

  // ── Personne physique : plan de crise avec déréférencement RGPD
  const person = (await request("POST", "/ereputation/campaigns", { name: "Crise Albert", targetType: "B2C", targetName: "Albert Ducamps",
    mandateReference: "M-1", mandateSignatory: "Albert Ducamps", mandateSignedAt: new Date().toISOString().slice(0, 10), retentionUntil: new Date(Date.now() + 300 * 86400000).toISOString().slice(0, 10) }, token)).body;
  for (let i = 0; i < 3; i++)
    await db.query(`INSERT INTO erep_mentions (tenant_id, campaign_id, kind, source, fingerprint, title, sentiment, score, severity) VALUES ($1,$2,'news','rss',$3,'Albert Ducamps condamné','neg',-0.9,'critical')`, [me.tenantId, person.id, `t${i}`]);
  const pc = (await request("POST", `/ereputation/campaigns/${person.id}/crisis/evaluate`, {}, token)).body;
  check(pc.open && pc.open.level === 3 && pc.open.actions.some(a => a.id === "rgpd_delist") && pc.open.actions.some(a => a.id === "personal_data") && !pc.open.actions.some(a => a.id === "legal"),
    "Personne : 3 mentions critiques → « Crise », déréférencement RGPD proposé", pc.open?.actions?.map(a => a.id));

  // ── Suppression : alertes, plans, historique du score et notifications partent avec la campagne
  const notifBefore = (await db.query(`SELECT COUNT(*)::int AS n FROM notifications WHERE payload->>'campaignId' = $1`, [person.id])).rows[0].n;
  check(notifBefore > 0, "Notifications liées à la personne présentes avant suppression");
  check((await request("DELETE", `/ereputation/campaigns/${person.id}`, undefined, token)).status === 200, "Campagne personne supprimée");
  const leftPerson = (await db.query(`SELECT (SELECT COUNT(*) FROM notifications WHERE payload->>'campaignId' = $1::text) + (SELECT COUNT(*) FROM erep_alerts WHERE campaign_id = $1::uuid)
    + (SELECT COUNT(*) FROM erep_crisis_plans WHERE campaign_id = $1::uuid) AS n`, [person.id])).rows[0].n;
  check(Number(leftPerson) === 0, "Suppression personne : notifications, alertes et plans effacés", leftPerson);
  check((await request("DELETE", `/ereputation/campaigns/${cid}`, undefined, token)).status === 200, "Campagne entité supprimée");
  const left = (await db.query(`SELECT (SELECT COUNT(*) FROM erep_score_history WHERE campaign_id = $1::uuid) + (SELECT COUNT(*) FROM erep_alert_settings WHERE campaign_id = $1::uuid)
    + (SELECT COUNT(*) FROM erep_alerts WHERE campaign_id = $1::uuid) + (SELECT COUNT(*) FROM notifications WHERE payload->>'campaignId' = $1::text) AS n`, [cid])).rows[0].n;
  check(Number(left) === 0, "Suppression entité : historique du score, règles, alertes et notifications effacés", left);

  console.log(`\n${passed} contrôles e-réputation lot 3 réussis.`);
} catch (error) {
  console.error(`\n✗ ${error.message}`);
  if (apiLog) console.error("\nJournal API (fin) :\n" + apiLog.split("\n").filter(l => /"level":(40|50)|Error/.test(l)).slice(-15).join("\n"));
  process.exitCode = 1;
} finally {
  api?.kill("SIGTERM");
  fakeServer.close();
  await delay(500);
  await db.end().catch(() => undefined);
  await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`).catch(() => undefined);
  await admin.end();
}
