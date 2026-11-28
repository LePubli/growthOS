/**
 * Tests d'intégration du module e-réputation — lot 1 (fondations).
 *
 * Prérequis : PostgreSQL 16 accessible, dépendances installées, API compilée
 *   pnpm --filter @workspace/api-server build
 * Lancement :
 *   EREP_POSTGRES_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres node scripts/test-ereputation.mjs
 *
 * Le script crée une base jetable (growthos_erep_<aléatoire>), y démarre l'API,
 * exécute les scénarios puis supprime la base. Aucun service externe n'est appelé.
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
const env = {
  ...process.env,
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

let api;
let apiLog = "";
const admin = new pg.Client({ connectionString: adminUrl });
await admin.connect();
await admin.query(`CREATE DATABASE ${dbName}`);
const db = new pg.Client({ connectionString: dbUrl });

try {
  console.log(`\nGrowthOS — e-réputation lot 1 (base jetable ${dbName})`);
  api = spawn("node", ["artifacts/api-server/dist/index.mjs"], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
  api.stdout.on("data", c => { apiLog = (apiLog + c).slice(-8000); });
  api.stderr.on("data", c => { apiLog = (apiLog + c).slice(-8000); });

  const deadline = Date.now() + 90000;
  for (;;) {
    try { if ((await request("GET", "/setup/status")).status === 200) break; } catch { /* démarrage */ }
    if (Date.now() > deadline) throw new Error("L'API n'a pas démarré (migrations ?)");
    await delay(500);
  }
  const boot = await request("POST", "/setup/bootstrap", {
    setupToken, companyName: "Agence e-réputation test", email: "admin@erep.invalid", password: "LocalOnlyPassword#123456",
  });
  check(boot.status === 201 && boot.body.accessToken, "Administrateur de recette créé", boot.body);
  const token = boot.body.accessToken;
  const me = jwt.decode(token);

  await db.connect();

  // ── Seconde agence, pour l'isolation
  const otherTenant = (await db.query(`INSERT INTO tenants (name, slug) VALUES ('Agence concurrente', $1) RETURNING id`, [`concurrente-${randomUUID()}`])).rows[0].id;
  const otherToken = jwt.sign({ userId: randomUUID(), tenantId: otherTenant, email: "autre@erep.invalid", role: "admin" }, JWT_SECRET, { expiresIn: "15m" });
  const memberToken = jwt.sign({ userId: me.userId, tenantId: me.tenantId, email: "membre@erep.invalid", role: "member" }, JWT_SECRET, { expiresIn: "15m" });

  // ── Schéma
  const columns = (await db.query(`SELECT column_name, column_default, is_nullable FROM information_schema.columns WHERE table_name = 'erep_campaigns'`)).rows;
  const score = columns.find(c => c.column_name === "reputation_score");
  check(score && score.column_default === null && score.is_nullable === "YES", "Score sans valeur par défaut fictive (NULL = non évalué)", score);
  check(["prospect_id", "mandate_reference", "retention_until", "subject_aliases"].every(n => columns.some(c => c.column_name === n)), "Colonnes cible, CRM et mandat présentes");
  check((await db.query(`SELECT to_regclass('erep_change_log') AS t`)).rows[0].t === "erep_change_log", "Table d'historique créée");

  // ── Validation
  check((await request("POST", "/ereputation/campaigns", { name: "X", targetType: "domain", targetName: "acme.fr" }, token)).status === 400,
    "Type de cible invalide refusé");
  check((await request("POST", "/ereputation/campaigns", { name: "", targetType: "B2B", targetName: "Acme" }, token)).status === 400,
    "Nom vide refusé");
  check((await request("POST", "/ereputation/campaigns", { name: "X", targetType: "B2B", targetName: "Acme", targetUrl: "javascript:alert(1)" }, token)).status === 400,
    "URL non http(s) refusée");
  check((await request("POST", "/ereputation/campaigns", { name: "X", targetType: "B2B", targetName: "Acme", inconnu: 1 }, token)).status === 400,
    "Champ inconnu refusé");
  check((await request("GET", "/ereputation/campaigns")).status === 401, "Accès anonyme refusé");

  // ── Entité B2B liée au CRM
  const prospect = (await db.query(`INSERT INTO prospects (company, tenant_id) VALUES ('Acme Lille', $1) RETURNING id`, [me.tenantId])).rows[0].id;
  const foreignProspect = (await db.query(`INSERT INTO prospects (company, tenant_id) VALUES ('Autre', $1) RETURNING id`, [otherTenant])).rows[0].id;
  check((await request("POST", "/ereputation/campaigns", { name: "X", targetType: "B2B", targetName: "Acme", prospectId: foreignProspect }, token)).status === 404,
    "Fiche CRM d'une autre agence refusée");
  const entity = await request("POST", "/ereputation/campaigns", {
    name: "Réputation Acme", targetType: "B2B", targetName: "Acme Lille", targetUrl: "https://acme.example",
    keywords: ["acme avis", " acme avis ", "acme lille"], prospectId: prospect, subjectLocation: "Lille (59)",
  }, token);
  check(entity.status === 201 && entity.body.subjectKind === "entity", "Campagne entité créée", entity.body);
  check(entity.body.reputationScore === null, "Nouvelle campagne : score non évalué (pas de 50 ni de 0)", entity.body.reputationScore);
  check(entity.body.prospectId === prospect && entity.body.prospectLabel === "Acme Lille", "Fiche CRM liée et libellé lu", entity.body);
  check(JSON.stringify(entity.body.keywords) === JSON.stringify(["acme avis", "acme lille"]), "Mots-clés nettoyés et dédoublonnés", entity.body.keywords);
  const entityId = entity.body.id;

  // ── Personne physique B2C : mandat RGPD obligatoire
  const personBase = { name: "Réputation Albert Ducamps", targetType: "B2C", targetName: "Albert Ducamps", keywords: ["albert ducamps"], subjectAliases: ["A. Ducamps"] };
  const noMandate = await request("POST", "/ereputation/campaigns", personBase, token);
  check(noMandate.status === 400 && /mandat RGPD incomplet/.test(noMandate.body.error), "Personne physique sans mandat refusée", noMandate.body);
  check((await request("POST", "/ereputation/campaigns", { ...personBase, mandateReference: "M-1", mandateSignatory: "Albert Ducamps", mandateSignedAt: isoDay(5), retentionUntil: isoDay(400) }, token)).status === 400,
    "Mandat signé dans le futur refusé");
  check((await request("POST", "/ereputation/campaigns", { ...personBase, mandateReference: "M-1", mandateSignatory: "Albert Ducamps", mandateSignedAt: isoDay(-10), retentionUntil: isoDay(-20) }, token)).status === 400,
    "Fin de conservation antérieure à la signature refusée");
  check((await request("POST", "/ereputation/campaigns", { ...personBase, mandateReference: "M-1", mandateSignatory: "Albert Ducamps", mandateSignedAt: "2026-02-30", retentionUntil: isoDay(300) }, token)).status === 400,
    "Date inexistante refusée");
  const person = await request("POST", "/ereputation/campaigns", {
    ...personBase, mandateReference: "MAND-2026-014", mandateSignatory: "Albert Ducamps", mandateSignedAt: isoDay(0),
    retentionUntil: isoDay(365), mandateScope: "Veille et contre-mesures Google nominatives",
  }, token);
  check(person.status === 201 && person.body.subjectKind === "person" && person.body.mandate.reference === "MAND-2026-014", "Campagne personne physique créée avec mandat", person.body);
  check(person.body.mandate.signedAt === isoDay(0) && person.body.mandate.retentionUntil === isoDay(365), "Dates du mandat restituées sans décalage", person.body.mandate);
  const personId = person.body.id;
  check((await request("PATCH", `/ereputation/campaigns/${personId}`, { mandateReference: "" }, token)).status === 400,
    "Retrait du mandat d'une personne refusé");

  // ── Isolation entre agences
  check((await request("GET", `/ereputation/campaigns/${entityId}`, undefined, otherToken)).status === 404, "Autre agence : lecture refusée");
  check((await request("PATCH", `/ereputation/campaigns/${entityId}`, { name: "Piratage" }, otherToken)).status === 404, "Autre agence : modification refusée");
  check((await request("DELETE", `/ereputation/campaigns/${entityId}`, undefined, otherToken)).status === 404, "Autre agence : suppression refusée");
  check((await request("GET", `/ereputation/campaigns/${entityId}/history`, undefined, otherToken)).status === 404, "Autre agence : historique refusé");
  check((await request("POST", `/ereputation/campaigns/${entityId}/serp`, { keyword: "x", position: 1 }, otherToken)).status === 404, "Autre agence : saisie SERP refusée");
  check((await request("GET", "/ereputation/campaigns", undefined, otherToken)).body.length === 0, "Autre agence : liste vide");

  // ── Modification et historique
  const renamed = await request("PATCH", `/ereputation/campaigns/${entityId}`, { name: "Réputation Acme 2027", keywords: ["acme avis"] }, token);
  check(renamed.status === 200 && renamed.body.name === "Réputation Acme 2027", "Modification partielle enregistrée", renamed.body);
  const noop = await request("PATCH", `/ereputation/campaigns/${entityId}`, { name: "Réputation Acme 2027" }, token);
  check(noop.status === 200, "Modification sans changement acceptée");
  const paused = await request("POST", `/ereputation/campaigns/${entityId}/status`, { status: "paused" }, token);
  check(paused.status === 200 && paused.body.status === "paused", "Mise en pause", paused.body);
  check((await request("POST", `/ereputation/campaigns/${entityId}/status`, { status: "deleted" }, token)).status === 400, "Statut inconnu refusé");
  const history = (await request("GET", `/ereputation/campaigns/${entityId}/history`, undefined, token)).body;
  check(Array.isArray(history) && history.length === 3, "Historique : création, modification, statut (pas d'entrée vide)", history.map?.(h => h.action));
  check(history[0].action === "status" && history[0].changes.status.before === "active" && history[0].changes.status.after === "paused", "Historique : statut avant/après", history[0]);
  check(history[1].changes.name.before === "Réputation Acme" && history[1].changes.name.after === "Réputation Acme 2027" && history[1].actor.email === "admin@erep.invalid",
    "Historique : qui a modifié quoi", history[1]);
  check(history[1].changes.keywords && !history[1].changes.targetName, "Historique : seuls les champs modifiés sont tracés", history[1].changes);

  // ── Archivage
  await request("POST", `/ereputation/campaigns/${entityId}/status`, { status: "archived" }, token);
  check(!(await request("GET", "/ereputation/campaigns", undefined, token)).body.some(c => c.id === entityId), "Campagne archivée masquée par défaut");
  check((await request("GET", "/ereputation/campaigns?includeArchived=true", undefined, token)).body.some(c => c.id === entityId), "Campagne archivée visible sur demande");
  await request("POST", `/ereputation/campaigns/${entityId}/status`, { status: "active" }, token);

  // ── Mesures SERP et score
  check((await request("POST", `/ereputation/campaigns/${entityId}/serp`, { keyword: "acme avis", position: 0 }, token)).status === 400, "Position SERP hors 1-100 refusée");
  check((await request("POST", `/ereputation/campaigns/${entityId}/serp`, { keyword: "", position: 3 }, token)).status === 400, "Mot-clé SERP vide refusé");
  const dash0 = await request("GET", `/ereputation/campaigns/${entityId}/dashboard`, undefined, token);
  check(dash0.status === 200 && dash0.body.reputationScore === null && dash0.body.scoreBreakdown.serp === null, "Sans mesure : score et composantes non évalués", dash0.body);
  check(!dash0.body.aiTasks.some(t => /LinkedIn|PBN/.test(t)), "Aucune tâche codée en dur sans lien avec les mesures", dash0.body.aiTasks);
  await db.query(`INSERT INTO erep_serp_tracking (campaign_id, keyword, position, date) VALUES ($1, 'acme avis', 8, CURRENT_DATE - 1)`, [entityId]);
  check((await request("POST", `/ereputation/campaigns/${entityId}/serp`, { keyword: "acme avis", position: 2, url: "https://acme.example" }, token)).status === 201, "Mesure SERP enregistrée");
  const serp = (await request("GET", `/ereputation/campaigns/${entityId}/serp`, undefined, token)).body;
  check(serp[0].position === 2 && serp[0].previous_position === 8, "Écart calculé depuis la mesure précédente réelle", serp[0]);
  const dash1 = await request("GET", `/ereputation/campaigns/${entityId}/dashboard`, undefined, token);
  check(dash1.body.reputationScore === 85, "Score calculé uniquement sur les mesures réelles (positions 8 puis 2 → 85)", dash1.body.reputationScore);
  const events1 = (await db.query(`SELECT COUNT(*)::int AS n FROM erep_campaigns WHERE id = $1 AND score_updated_at IS NOT NULL`, [entityId])).rows[0].n;
  check(events1 === 1, "Date de calcul du score enregistrée");
  const alertsBefore = (await db.query(`SELECT COUNT(*)::int AS n FROM erep_alerts WHERE campaign_id = $1`, [entityId])).rows[0].n;
  await request("GET", `/ereputation/campaigns/${entityId}/dashboard`, undefined, token);
  await request("GET", `/ereputation/campaigns/${entityId}/dashboard`, undefined, token);
  await delay(300);
  const alertsAfter = (await db.query(`SELECT COUNT(*)::int AS n FROM erep_alerts WHERE campaign_id = $1`, [entityId])).rows[0].n;
  check(alertsAfter === alertsBefore, "Consulter le tableau de bord ne recrée pas d'alertes", { alertsBefore, alertsAfter });
  check((await request("POST", `/ereputation/campaigns/${entityId}/serp`, { keyword: "acme lille", position: null }, token)).status === 201, "Absence du top 100 enregistrée");
  const dashAbsent = await request("GET", `/ereputation/campaigns/${entityId}/dashboard`, undefined, token);
  check(dashAbsent.body.scoreBreakdown.serp === 57, "Absence du top 100 comptée dans le score SERP ((70+100+0)/3 → 57)", dashAbsent.body.scoreBreakdown);
  await db.query(`DELETE FROM erep_serp_tracking WHERE campaign_id = $1 AND position IS NULL`, [entityId]);
  await request("GET", `/ereputation/campaigns/${entityId}/dashboard`, undefined, token);
  const global = await request("GET", "/ereputation/score-global", undefined, token);
  check(global.status === 200 && global.body.score === 85 && global.body.breakdown.evaluatedCampaigns === 1 && global.body.breakdown.campaigns === 2,
    "Score global : moyenne des seules campagnes évaluées", global.body);
  check((await request("GET", "/ereputation/score-global", undefined, otherToken)).body.score === null, "Score global d'une agence sans mesure : non évalué");

  // ── Portail client : plus de score par défaut à 50
  const portal = await request("GET", "/client/ereputation/campaigns", undefined, token);
  const portalPerson = Array.isArray(portal.body) ? portal.body.find(c => c.id === personId) : (portal.body.campaigns ?? []).find(c => c.id === personId);
  check(portal.status === 200 && portalPerson && portalPerson.reputationScore === null, "Portail : campagne sans mesure affichée « non évaluée »", portal.body);

  // ── Suppression d'une personne : données purgées, historique expurgé
  await request("POST", `/ereputation/campaigns/${personId}/sentiment`, { text: "Albert Ducamps est un excellent professionnel" }, token);
  await request("PATCH", `/ereputation/campaigns/${personId}`, { subjectLocation: "Roubaix" }, token);
  const toEntity = await request("PATCH", `/ereputation/campaigns/${personId}`, { targetType: "B2B" }, token);
  check(toEntity.status === 400 && /ne peut pas devenir une entité/.test(toEntity.body.error), "Personne physique non convertible en entité (purge RGPD préservée)", toEntity.body);
  const personAudit = await request("POST", `/ereputation/campaigns/${personId}/audit`, {}, token);
  check(personAudit.status === 200, "Audit de la personne réalisé", personAudit.body);
  await db.query(`INSERT INTO memory_documents (source_type, source_id, content, tenant_id, metadata) VALUES ('erep_score_change', $1, 'Score E-Rep de Albert Ducamps', $2, $3)`,
    [`${personId}-1`, me.tenantId, JSON.stringify({ campaignId: personId, targetName: "Albert Ducamps" })]);
  const memoryBefore = (await db.query(`SELECT COUNT(*)::int AS n FROM memory_documents WHERE content LIKE '%Ducamps%'`)).rows[0].n;
  check(memoryBefore >= 2, "Audit et variation de score indexés dans la mémoire IA", memoryBefore);
  const removed = await request("DELETE", `/ereputation/campaigns/${personId}`, undefined, token);
  check(removed.status === 200 && removed.body.redacted === true, "Suppression d'une personne signalée comme purgée", removed.body);
  check((await request("GET", `/ereputation/campaigns/${personId}`, undefined, token)).status === 404, "Campagne personne supprimée");
  check((await db.query(`SELECT COUNT(*)::int AS n FROM erep_sentiment_logs WHERE campaign_id = $1`, [personId])).rows[0].n === 0, "Mentions collectées supprimées avec la campagne");
  check((await db.query(`SELECT COUNT(*)::int AS n FROM memory_documents WHERE content LIKE '%Ducamps%'`)).rows[0].n === 0, "Mémoire IA : aucune copie des données de la personne après suppression");
  const personHistory = (await request("GET", `/ereputation/campaigns/${personId}/history`, undefined, token)).body;
  check(Array.isArray(personHistory) && personHistory[0].action === "delete" && personHistory.every(h => h.redacted), "Historique conservé après suppression et marqué expurgé", personHistory);
  check(!JSON.stringify(personHistory).includes("Ducamps") && !JSON.stringify(personHistory).includes("Roubaix"), "Historique : aucune donnée personnelle résiduelle", personHistory);
  check(personHistory[0].changes.deletedData.before.mentions !== undefined, "Historique : volume de données supprimées tracé", personHistory[0]);

  // ── Suppression d'une entité : historique conservé en clair
  const pbn = await request("POST", "/ereputation/pbn", { url: "https://blog-agence.example", campaignId: entityId, daScore: 30 }, token);
  check(pbn.status === 201, "Site de l'agence rattaché à la campagne");
  check((await request("POST", "/ereputation/pbn", { url: "https://x.example", campaignId: randomUUID() }, token)).status === 404, "Site rattaché à une campagne inconnue refusé");
  check((await request("DELETE", `/ereputation/campaigns/${entityId}`, undefined, token)).status === 200, "Campagne entité supprimée");
  check((await db.query(`SELECT campaign_id FROM erep_pbn_sites WHERE id = $1`, [pbn.body.id])).rows[0]?.campaign_id === null, "Site PBN de l'agence conservé et détaché");
  const entityHistory = (await request("GET", `/ereputation/campaigns/${entityId}/history`, undefined, token)).body;
  check(entityHistory[0].action === "delete" && entityHistory[0].changes.name.before === "Réputation Acme 2027" && !entityHistory[0].redacted, "Entité : trace de suppression lisible", entityHistory[0]);

  // ── Purge automatique à échéance de conservation
  const expiring = await request("POST", "/ereputation/campaigns", {
    ...personBase, name: "Mandat court", mandateReference: "M-COURT", mandateSignatory: "Albert Ducamps",
    mandateSignedAt: isoDay(-40), retentionUntil: isoDay(10), status: "paused",
  }, token);
  check(expiring.status === 201, "Campagne personne à mandat court créée");
  await db.query(`UPDATE erep_campaigns SET retention_until = CURRENT_DATE - 1 WHERE id = $1`, [expiring.body.id]);
  check((await request("POST", `/ereputation/campaigns/${expiring.body.id}/status`, { status: "active" }, token)).status === 400, "Activation refusée quand la conservation a expiré");
  check((await request("POST", "/ereputation/retention/purge", {}, memberToken)).status === 403, "Purge manuelle réservée aux administrateurs");
  const purge = await request("POST", "/ereputation/retention/purge", {}, token);
  check(purge.status === 200 && purge.body.purged.includes(expiring.body.id), "Purge RGPD des campagnes expirées", purge.body);
  const purgedHistory = (await request("GET", `/ereputation/campaigns/${expiring.body.id}/history`, undefined, token)).body;
  check(purgedHistory[0].action === "retention_purge" && purgedHistory[0].actor.email === "system:retention", "Purge tracée comme action système", purgedHistory[0]);

  // ── Migration : correction des scores fictifs hérités, idempotente
  const legacyEmpty = (await db.query(`INSERT INTO erep_campaigns (name, tenant_id, target_type, target_name, reputation_score) VALUES ('Ancienne vide', $1, 'B2B', 'Vieux', 50) RETURNING id`, [me.tenantId])).rows[0].id;
  const legacyMeasured = (await db.query(`INSERT INTO erep_campaigns (name, tenant_id, target_type, target_name, reputation_score) VALUES ('Ancienne mesurée', $1, 'B2B', 'Vieux 2', 40) RETURNING id`, [me.tenantId])).rows[0].id;
  await db.query(`INSERT INTO erep_serp_tracking (campaign_id, keyword, position) VALUES ($1, 'vieux', 15)`, [legacyMeasured]);
  for (let i = 0; i < 2; i++) {
    await new Promise((resolveRun, rejectRun) => {
      const child = spawn("node", ["--import", "tsx", "--input-type=module", "-e",
        "import {runEreputationFoundationsMigration,pool} from '@workspace/db'; await runEreputationFoundationsMigration(); await pool.end();"],
      { cwd: resolve(root, "artifacts/api-server"), env, stdio: ["ignore", "ignore", "pipe"] });
      let err = ""; child.stderr.on("data", c => { err += c; });
      child.on("exit", code => code === 0 ? resolveRun() : rejectRun(new Error("Migration relancée en échec : " + err.slice(-600))));
    });
  }
  const legacy = Object.fromEntries((await db.query(`SELECT id, reputation_score FROM erep_campaigns WHERE id = ANY($1)`, [[legacyEmpty, legacyMeasured]])).rows.map(r => [r.id, r.reputation_score]));
  check(legacy[legacyEmpty] === null && legacy[legacyMeasured] === 40, "Migration rejouée deux fois : score fictif sans mesure effacé, score mesuré conservé", legacy);

  console.log(`\n${passed} contrôles e-réputation réussis.`);
} catch (error) {
  console.error(`\n✗ ${error.message}`);
  if (apiLog) console.error("\nJournal API (fin) :\n" + apiLog.split("\n").filter(l => /"level":(40|50)|Error/.test(l)).slice(-15).join("\n"));
  process.exitCode = 1;
} finally {
  api?.kill("SIGTERM");
  await delay(500);
  await db.end().catch(() => undefined);
  await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`).catch(() => undefined);
  await admin.end();
}
