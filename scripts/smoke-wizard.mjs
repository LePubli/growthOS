/**
 * Disposable integration smoke test for GrowthOS first-run setup.
 *
 * Requirements: Node.js 24, API dependencies installed, API dist built.
 * Run: node scripts/smoke-wizard.mjs
 *
 * Uses an ephemeral PGlite PostgreSQL-compatible adapter plus local directory
 * and Ollama stubs. No remote service, user database or email is touched.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

const root = resolve(fileURLToPath(import.meta.url), "../..");
const processes = [];
let apiErrorLog = "";
const ephemeralDbDir = await mkdtemp(join(tmpdir(), "growthos-smoke-"));
const setupToken = randomBytes(32).toString("hex");
// CI runs against a disposable PostgreSQL 16 service, which supports the
// parallel queries issued inside several dashboard routes. Local development
// can retain PGlite for fast, low-dependency wizard smoke tests.
const realPostgresUrl = process.env.SMOKE_POSTGRES_URL;

async function availablePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

const [dbPort, apiPort, companiesPort, ollamaPort] = await Promise.all([
  availablePort(), availablePort(), availablePort(), availablePort(),
]);
const base = `http://127.0.0.1:${apiPort}/api/v1`;
const testEnv = {
  ...process.env,
  DATABASE_URL: realPostgresUrl ?? `postgresql://postgres:postgres@127.0.0.1:${dbPort}/postgres`,
  JWT_SECRET: randomBytes(48).toString("hex"),
  JWT_REFRESH_SECRET: randomBytes(48).toString("hex"),
  ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  SETUP_TOKEN: setupToken,
  COMPANY_DIRECTORY_API_URL: `http://127.0.0.1:${companiesPort}/search`,
  ENABLE_OUTBOUND_EMAIL: "false",
  ALLOW_PUBLIC_REGISTRATION: "false",
  PLATFORM_ADMIN_EMAILS: "admin@wizard.invalid",
  NODE_ENV: "production",
  PORT: String(apiPort),
};

function check(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`  ✓ ${message}`);
}

function startProcess(command, args) {
  const child = spawn(command, args, {
    cwd: root,
    env: testEnv,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  processes.push(child);
  let stderr = "";
  child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-1200); });
  if (args[0] === "artifacts/api-server/dist/index.mjs") {
    child.stdout.on("data", chunk => {
      const lines = String(chunk).split("\n").filter(line => /"level":50|Unhandled error/.test(line));
      apiErrorLog = (apiErrorLog + lines.join("\n") + "\n").slice(-12000);
    });
  }
  child.on("exit", (code) => {
    if (code && code !== 0) console.error(`  ${command} stopped (${code}): ${stderr}`);
  });
  return child;
}

async function request(method, path, data, token) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
    signal: AbortSignal.timeout(12000),
  });
  return { status: response.status, body: await response.json() };
}

async function awaitApi(timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await request("GET", "/setup/status");
      if (response.status === 200) return response.body;
    } catch { /* waiting on PostgreSQL migrations and HTTP listener */ }
    await delay(500);
  }
  throw new Error("API did not start (check database migrations and startup logs)");
}

const companies = createServer((req, res) => {
  if (!req.url?.startsWith("/search?")) { res.writeHead(404).end(); return; }
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ results: [
    { siren: "100000001", nom_complet: "Entreprise test A", siege: { siret: "10000000100012", adresse: "10 rue Nationale, 59000 Lille", code_postal: "59000", libelle_commune: "Lille" } },
    { siren: "100000002", nom_complet: "Entreprise test B", siege: { adresse: "Paris, France", code_postal: "75001", libelle_commune: "Paris" },
      matching_etablissements: [{ siret: "10000000200015", adresse: "20 rue du Molinel, 59000 Lille", code_postal: "59000", libelle_commune: "Lille" }] },
    { siren: "100000003", nom_complet: "Entreprise hors zone", siege: { adresse: "Paris, France", code_postal: "75001", libelle_commune: "Paris" } },
    { siren: "100000004", nom_complet: "Entreprise Roubaix", siege: { siret: "10000000400018", adresse: "4 rue de Roubaix, 59100 Roubaix", code_postal: "59100", libelle_commune: "Roubaix" } },
  ] }));
});
const ollama = createServer((req, res) => {
  if (req.url !== "/api/tags") { res.writeHead(404).end(); return; }
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ models: [{ name: "llama3.1:8b" }] }));
});

try {
  console.log("\nGrowthOS — tests d'installation isolés");
  await Promise.all([
    new Promise(resolve => companies.listen(companiesPort, "127.0.0.1", resolve)),
    new Promise(resolve => ollama.listen(ollamaPort, "127.0.0.1", resolve)),
  ]);
  if (!realPostgresUrl) {
    startProcess("npx", ["--yes", "@electric-sql/pglite-socket", `--db=${ephemeralDbDir}`, `--port=${dbPort}`, "--host=127.0.0.1"]);
    await delay(3000);
  }
  startProcess("node", ["artifacts/api-server/dist/index.mjs"]);

  const initial = await awaitApi();
  check(initial.needsBootstrap, "Installation vierge détectée");
  const password = "LocalOnlyPassword#123456";
  const setup = { setupToken, companyName: "Agence de test", email: "admin@wizard.invalid", password };
  check((await request("POST", "/setup/bootstrap", { ...setup, setupToken: "bad" })).status === 403,
    "Code d'installation invalide refusé");
  const admin = await request("POST", "/setup/bootstrap", setup);
  check(admin.status === 201 && !!admin.body.accessToken, "Premier administrateur créé");
  const token = admin.body.accessToken;
  check((await request("POST", "/setup/bootstrap", setup)).status === 409,
    "Seconde initialisation refusée");
  check((await request("GET", "/setup/configuration")).status === 401,
    "Configuration privée protégée");
  const configured = await request("PATCH", "/setup/configuration", {
    companyName: "Agence de test SEO", targetRegion: "Hauts-de-France",
    website: "https://example.com", dailyEmailLimit: 10,
    email: { mode: "disabled" },
  }, token);
  check(configured.status === 200, "Paramètres de l'agence enregistrés");
  check((await request("POST", "/setup/smtp/verify", {}, token)).status === 422,
    "SMTP non configuré correctement refusé");

  const defaults = await request("GET", "/setup/configuration", undefined, token);
  check(defaults.body.aiProvider === "disabled", "Aucun fournisseur IA activé par défaut");
  check((await request("PATCH", "/setup/configuration", {
    companyName: "Agence de test SEO", aiProvider: "deepseek",
  }, token)).status === 422, "Impossible d'activer une IA sans clé enregistrée");

  for (const provider of ["anthropic", "openai", "deepseek"]) {
    const saved = await request("POST", "/admin/api-keys", {
      provider, apiKey: `test-${provider}-not-for-production`,
    }, token);
    check(saved.status === 201 && !saved.body.apiKey && saved.body.apiKeyMasked.includes("…"),
      `Clé ${provider} enregistrée sans exposer son contenu`);
  }
  const cloudConfiguration = await request("GET", "/setup/configuration", undefined, token);
  check(["anthropic", "openai", "deepseek"].every(provider => cloudConfiguration.body.aiProviders.includes(provider)),
    "Trois fournisseurs IA disponibles simultanément");
  const primaryCloud = await request("PATCH", "/setup/configuration", {
    companyName: "Agence de test SEO", aiProvider: "deepseek",
  }, token);
  check(primaryCloud.status === 200, `DeepSeek défini comme fournisseur principal (HTTP ${primaryCloud.status})`);
  const effective = await request("GET", "/ai-sdr/provider-settings", undefined, token);
  check(effective.status === 200 && effective.body.activeProvider === "deepseek" &&
    effective.body.configuredProviders.includes("anthropic") && effective.body.configuredProviders.includes("openai"),
    `AI SDR lit le fournisseur principal et les connecteurs disponibles (HTTP ${effective.status}, ${JSON.stringify(effective.body)})`);

  const ollamaUrl = `http://127.0.0.1:${ollamaPort}`;
  const savedKey = await request("POST", "/admin/api-keys", {
    provider: "ollama", apiKey: "local", endpointUrl: ollamaUrl,
  }, token);
  check(savedKey.status === 201 && savedKey.body.apiKeyMasked === "****" && !savedKey.body.apiKey,
    "Identifiants IA sauvegardés sans exposer le secret");
  const testedAI = await request("POST", "/admin/api-keys/ollama/test", {
    apiKey: "local", endpointUrl: ollamaUrl,
  }, token);
  check(testedAI.status === 200 && testedAI.body.ok, "Connexion IA locale testée");
  check((await request("POST", "/setup/finish", {}, token)).status === 200,
    "Wizard finalisé");
  check((await request("GET", "/setup/configuration", undefined, token)).body.onboardingComplete,
    "État du wizard conservé en base");
  check((await request("POST", "/auth/login", {
    email: setup.email, password,
  })).status === 200, "Reconnexion administrateur réussie");
  check((await request("POST", "/auth/register", {
    email: "other@wizard.invalid", password,
  })).status === 403, "Inscription publique fermée");

  check((await request("POST", "/sourcing/jobs", {
    type: "linkedin", name: "Connecteur indisponible", params: { query: "CEO" },
  }, token)).status === 400, "Faux connecteur LinkedIn désactivé");
  const invalidGeo = await request("POST", "/sourcing/jobs", {
    type: "entreprises", name: "Zone vide", params: { query: "plombier", regions: [], departements: [], codesPostaux: [], limit: 5 },
  }, token);
  check(invalidGeo.status === 400, "Une zone géographique est obligatoire");
  const source = await request("POST", "/sourcing/jobs", {
    type: "entreprises", name: "Test Lille", params: { query: "plombier", regions: [], departements: [], codesPostaux: ["59000"], limit: 5 },
  }, token);
  check(source.status === 201 && source.body.count === 2 && source.body.status === "completed",
    "Annuaire officiel simulé : seulement 2 établissements locaux trouvés");
  const results = await request("GET", `/sourcing/jobs/${source.body.id}/results`, undefined, token);
  check(results.status === 200 && results.body.total === 2 &&
    results.body.data.every(r => r.codePostal === "59000" && !r.address.includes("Paris")),
    "Géographie stricte : le siège parisien est remplacé par son établissement lillois");
  const multipleZones = await request("POST", "/sourcing/jobs", {
    type: "entreprises", name: "Lille et Roubaix", params: {
      query: "plombier", regions: ["32"], departements: ["59", "62"], codesPostaux: ["59000", "59100"], limit: 5,
    },
  }, token);
  check(multipleZones.status === 201 && multipleZones.body.count === 3,
    "Multi-zones : régions, départements et codes postaux acceptent plusieurs valeurs");
  const byRegion = await request("POST", "/sourcing/jobs", {
    type: "entreprises", name: "Région HDF", params: {
      query: "plombier", regions: ["32"], departements: [], codesPostaux: [], limit: 5,
    },
  }, token);
  check(byRegion.status === 201 && byRegion.body.count === 3,
    "Recherche par région sans code postal");
  const byDepartment = await request("POST", "/sourcing/jobs", {
    type: "entreprises", name: "Deux départements", params: {
      query: "plombier", regions: [], departements: ["59", "62"], codesPostaux: [], limit: 5,
    },
  }, token);
  check(byDepartment.status === 201 && byDepartment.body.count === 3,
    "Recherche par plusieurs départements sans code postal");
  const crmBeforeImport = await request("GET", "/prospects", undefined, token);
  check(crmBeforeImport.status === 200 && crmBeforeImport.body.total === 0,
    "Une recherche n'insère aucun prospect sans sélection");
  const invalidSelection = await request("POST", `/sourcing/jobs/${source.body.id}/import`,
    { sirens: ["999999999"] }, token);
  check(invalidSelection.status === 400, "Impossible d'importer une entreprise absente de la recherche");
  const selectedImport = await request("POST", `/sourcing/jobs/${source.body.id}/import`,
    { sirens: ["100000001"] }, token);
  check(selectedImport.status === 200 && selectedImport.body.imported === 1,
    "Import explicite : une seule entreprise sélectionnée est ajoutée");
  const repeatedSelection = await request("POST", `/sourcing/jobs/${source.body.id}/import`,
    { sirens: ["100000001"] }, token);
  check(repeatedSelection.status === 200 && repeatedSelection.body.imported === 0 &&
    repeatedSelection.body.skipped === 1, "SIREN déjà importé : doublon ignoré");
  const importSecond = await request("POST", `/sourcing/jobs/${source.body.id}/import`,
    { sirens: ["100000002"] }, token);
  check(importSecond.status === 200 && importSecond.body.imported === 1,
    "La seconde entreprise est importée uniquement à la demande");
  const crm = await request("GET", "/prospects", undefined, token);
  check(crm.status === 200 && crm.body.total === 2 &&
    crm.body.data.some(p => p.siren === "100000001" && p.siret === "10000000100012" && p.postalCode === "59000" && p.city === "Lille"),
    "Les prospects importés conservent leur SIREN, SIRET, code postal et ville");
  const noMockActivity = await request("GET", `/activities?prospectId=${crm.body.data[0].id}`, undefined, token);
  check(noMockActivity.status === 200 && noMockActivity.body.length === 0,
    "Une fiche prospect importée démarre sans activités ni commentaires");
  const realComment = await request("POST", "/activities", {
    prospectId: crm.body.data[0].id, type: "comment",
    title: "Commentaire", description: "Message réel de suivi", status: "done",
  }, token);
  const actualHistory = await request("GET", `/activities?prospectId=${crm.body.data[0].id}`, undefined, token);
  check(realComment.status === 201 && actualHistory.body.length === 1 &&
    actualHistory.body[0].description === "Message réel de suivi",
    "Un commentaire enregistré est réellement relu depuis la base");
  const csvRows = [
    { firstName: "Alice", lastName: "Import", email: "alice.csv@example.com", status: "new" },
    { firstName: "Alice", lastName: "Bis", email: "ALICE.CSV@example.com", status: "new" },
    { firstName: "Bob", lastName: "Import", email: "bob.csv@example.com", status: "contacted" },
  ];
  const firstImport = await request("POST", "/prospects/bulk",
    { prospects: csvRows, duplicateMode: "skip" }, token);
  check(firstImport.status === 201 && firstImport.body.imported === 2 &&
    firstImport.body.duplicates === 1 && firstImport.body.skipped === 1,
    "Import CSV : doublon dans le fichier ignoré");
  const repeatImport = await request("POST", "/prospects/bulk",
    { prospects: [csvRows[0], csvRows[2]], duplicateMode: "skip" }, token);
  check(repeatImport.status === 201 && repeatImport.body.imported === 0 &&
    repeatImport.body.duplicates === 2 && repeatImport.body.skipped === 2,
    "Import CSV : doublons déjà présents en base ignorés");
  const updateImport = await request("POST", "/prospects/bulk", {
    prospects: [{ ...csvRows[0], company: "Entreprise mise à jour" }],
    duplicateMode: "update",
  }, token);
  const changedProspect = await request("GET", "/prospects?search=alice.csv%40example.com", undefined, token);
  check(updateImport.status === 201 && updateImport.body.updated === 1 &&
    updateImport.body.imported === 0 && changedProspect.body.data?.[0]?.company === "Entreprise mise à jour",
    "Import CSV : mise à jour d'un doublon réellement persistée");
  const invalidImport = await request("POST", "/prospects/bulk", {
    prospects: [{ firstName: "Invalid", email: "not-an-email", status: "new" }],
  }, token);
  check(invalidImport.status === 400, "Import CSV : email invalide refusé sans insertion");

  // Le pipeline contient des opportunités commerciales liées au CRM,
  // pas automatiquement tous les prospects dont le statut est "qualified".
  const importedId = changedProspect.body.data?.[0]?.id;
  check(Boolean(importedId), "Un prospect importé possède un identifiant CRM");
  const qualifiedProspect = await request("PATCH", `/prospects/${importedId}`, { status: "qualified" }, token);
  check(qualifiedProspect.status === 200 && qualifiedProspect.body.status === "qualified",
    "Qualification du prospect conservée");
  const pipelineBefore = await request("GET", "/pipeline", undefined, token);
  check(pipelineBefore.status === 200 && pipelineBefore.body.length === 0,
    "Le pipeline est vide tant qu'aucun deal n'a été créé");

  const linkedDeal = await request("POST", "/pipeline", {
    prospectId: importedId, title: "Refonte site + SEO", value: 1800,
    stage: "qualified", probability: 40, priority: "high",
    notes: "Prospect issu de l'import CSV",
  }, token);
  check(linkedDeal.status === 201 && linkedDeal.body.prospectId === importedId &&
    linkedDeal.body.company === "Entreprise mise à jour" &&
    linkedDeal.body.prospect === "Alice Import" &&
    linkedDeal.body.priority === "high" && linkedDeal.body.notes === "Prospect issu de l'import CSV",
    "Création d'un deal : lien CRM, contact, entreprise, priorité et notes persistés");
  const linkedList = await request("GET", `/pipeline?prospectId=${importedId}`, undefined, token);
  check(linkedList.status === 200 && linkedList.body.length === 1 &&
    linkedList.body[0].id === linkedDeal.body.id,
    "La fiche prospect retrouve uniquement ses deals liés");
  const updatedDeal = await request("PATCH", `/pipeline/${linkedDeal.body.id}`, {
    stage: "proposal", priority: "low", notes: "Devis envoyé",
  }, token);
  check(updatedDeal.status === 200 && updatedDeal.body.prospectId === importedId &&
    updatedDeal.body.stage === "proposal" && updatedDeal.body.priority === "low" &&
    updatedDeal.body.notes === "Devis envoyé",
    "Mise à jour d'un deal sans perte du lien prospect");
  const missingProspectDeal = await request("POST", "/pipeline", {
    prospectId: "00000000-0000-4000-8000-000000000001",
    title: "Prospect inexistant", value: 100,
  }, token);
  check(missingProspectDeal.status === 404, "Un deal ne peut pas être lié à un prospect inexistant");

  const convertedDeal = await request("POST", "/pipeline/from-prospect", {
    prospectId: importedId, title: "Audit SEO", value: 300, priority: "medium",
  }, token);
  const convertedProspect = await request("GET", `/prospects/${importedId}`, undefined, token);
  check(convertedDeal.status === 201 && convertedDeal.body.prospectId === importedId &&
    convertedProspect.body.status === "converted",
    "Conversion depuis la fiche prospect : deal lié et statut converti");



  const enrichmentSources = await request("GET", "/enrich/sources", undefined, token);
  check(enrichmentSources.status === 200 && enrichmentSources.body.some(s => s.id === "google_news" && s.implemented) &&
    enrichmentSources.body.some(s => s.id === "linkedin" && !s.implemented && !s.isActive),
    "Enrichissement : connecteurs réels distingués des sources non implémentées");
  check((await request("PUT", "/enrich/api-config/hunter", { apiKey: "secret" }, token)).status === 410,
    "Ancienne configuration globale des clés désactivée");
  check((await request("POST", "/enrich/test-connection/hunter", {}, token)).status === 501,
    "Aucun faux test de connexion réussi");
  check((await request("POST", "/enrich/batch", { prospectIds: [crm.body.data[0].id] }, token)).status === 501,
    "Enrichissement asynchrone sans file persistante désactivé");
  check((await request("POST", "/seo-audit/check", { url: "https://127.0.0.1/admin" }, token)).status === 400,
    "Inspection SEO : accès aux adresses internes refusé");
  check((await request("POST", "/seo-audit/check", { url: "https://example.org" })).status === 401,
    "Inspection SEO réservée aux utilisateurs authentifiés");
  check((await request("POST", "/meetings", { title: "Réunion sans audio" }, token)).status === 501,
    "Aucune transcription de réunion inventée");

  const sequence = await request("POST", "/sequences", {
    name: "Brouillon de test", status: "draft", steps: [],
  }, token);
  check(sequence.status === 201, "Brouillon de séquence enregistré");
  check((await request("POST", `/sequences/${sequence.body.id}/toggle`, {}, token)).status === 409,
    "Activation prématurée de séquence refusée");
  check((await request("POST", `/sequences/${sequence.body.id}/events`, { type: "reply" }, token)).status === 501,
    "Aucune fausse réponse email injectée par une API non vérifiée");
  check((await request("POST", `/email/sequences/${sequence.body.id}/launch`, {}, token)).status === 409,
    "Envoi sans gestion du désabonnement bloqué");
  check((await request("POST", "/email/send", {
    to: "receiver@wizard.invalid", subject: "Test", html: "<p>Test</p>",
  }, token)).status === 409, "Aucun email externe envoyé par défaut");

  const audit = await request("GET", "/audit/deep?force=true", undefined, token);
  check(audit.status === 202 && audit.body.status === "running" &&
    typeof audit.body.progress?.completed === "number",
    "Audit profond lancé sans bloquer la requête HTTP");
  const running = await request("GET", "/audit/deep", undefined, token);
  check(["running", "complete"].includes(running.body.status),
    "Statut de l'audit consultable sans relancer de scan");

  let audited = running.body;
  const auditDeadline = Date.now() + 30000;
  while (audited.status === "running" && Date.now() < auditDeadline) {
    await delay(300);
    audited = (await request("GET", "/audit/deep", undefined, token)).body;
  }
  check(audited.status === "complete", "Audit profond terminé avec un rapport structuré");
  check(audited.report.backend.routesDiscovered >= 250 &&
    audited.report.backend.routesTested >= 10,
    "Inventaire de routes Express 5 complet, distinct des lectures réellement vérifiées");
  check(audited.report.backend.routesTested + audited.report.backend.routesSkipped ===
    audited.report.backend.routesDiscovered,
    "Compteurs de couverture cohérents : vérifiées + non testées = recensées");
  check(audited.report.assessment === "partial" && audited.report.healthScore === null &&
    audited.report.backend.coveragePct < 100,
    "Un audit partiel ne se présente jamais comme un faux 100/100");
  check(audited.report.backend.routesByMethod.POST >= 80 &&
    audited.report.backend.moduleCoverage.some(m => m.module === "prospects" && m.tested > 0) &&
    audited.report.backend.untestedRoutes.some(r => r.method === "POST" && r.route === "/api/v1/prospects"),
    "Inventaire par méthode et module, écritures explicitement non testées");
  const verified = audited.report.backend;
  console.log(`  Couverture réelle : ${verified.routesTested}/${verified.routesDiscovered} (${verified.coveragePct}%), ${verified.routesOk} contrôles OK`);
  for (const route of verified.brokenRoutes) {
    console.log(`  ⚠ ${route.method} ${route.route}: HTTP ${route.status} — ${route.error ?? "validation échouée"}`);
  }
  check(verified.routesTested >= 35, "Modules CRM, tâches, mémoire, autopilot, IA et revenus inclus dans les sondes");
  if (realPostgresUrl) {
    check(verified.routes5xx === 0 && verified.contractErrors === 0 && verified.routes4xx === 0,
      "Aucun code d'erreur ou contrat de réponse invalide sur PostgreSQL 16");
  } else if (verified.brokenRoutes.length > 0) {
    console.log("  Note : le simulateur PGlite ne supporte pas toutes les lectures SQL concurrentes ; les erreurs sont vérifiées séparément dans la CI PostgreSQL 16.");
  }
  const prospectProbe = audited.report.backend.allRoutes.find(r => r.route === "/api/v1/prospects");
  check(prospectProbe?.status === 200 && prospectProbe.passed,
    `Route CRM avec tenant administrateur : HTTP ${prospectProbe?.status ?? 'absent'} (${prospectProbe?.error ?? 'aucun détail'})`);

  console.log("\nPASS — installation, CRM, IA, audit de lecture isolé et sécurité validés\n");
} catch (error) {
  process.exitCode = 1;
  console.error("\nFAIL —", error.message, "\n");
  if (apiErrorLog.trim()) console.error("Diagnostic API isolée (erreurs uniquement) :", apiErrorLog.slice(-3800));
} finally {
  for (const child of processes.reverse()) {
    if (child.pid) { try { process.kill(-child.pid, "SIGTERM"); } catch { /* already stopped */ } }
  }
  await Promise.all([
    new Promise(resolve => companies.close(resolve)),
    new Promise(resolve => ollama.close(resolve)),
  ]);
  await rm(ephemeralDbDir, { recursive: true, force: true });
}
