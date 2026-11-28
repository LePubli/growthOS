import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../../../middlewares/auth";
import { campaignService, CampaignError, CAMPAIGN_STATUSES } from "../../../lib/plugin-ereputation/CampaignService";
import { changeLog } from "../../../lib/plugin-ereputation/ChangeLog";
import { purgeExpiredPersonCampaigns } from "../../../lib/plugin-ereputation/RetentionService";
import { strategyEngine } from "../../../lib/plugin-ereputation/StrategyEngine";
import { sentimentAnalyzer } from "../../../lib/plugin-ereputation/SentimentAnalyzer";
import { logger } from "../../../lib/logger";
import { watchService, kickErepWatch, WATCH_ENGINES } from "../../../lib/plugin-ereputation/WatchService";
import { parisDay } from "../../../lib/plugin-ereputation/CampaignService";
import { explainScore } from "../../../lib/plugin-ereputation/ScoreModel";
import { alertService, DEFAULT_RULES } from "../../../lib/plugin-ereputation/AlertService";
import { erepAI } from "../../../lib/plugin-ereputation/ErepAI";
import { erepDigest, EmailSettingsInput } from "../../../lib/plugin-ereputation/ErepDigest";

/**
 * API e-réputation (montée sur /api/v1/ereputation, authentification + tenant requis).
 * Contrat détaillé : docs/ereputation/README.md.
 */
const router = Router();
router.use(requireAuth);

const actorOf = (req: Request) => ({ userId: req.auth!.userId, email: req.auth!.email });

function fail(res: Response, error: unknown, fallback: string): void {
  if (error instanceof CampaignError) { res.status(error.status).json({ error: error.message }); return; }
  logger.error({ reason: error instanceof Error ? error.message : "unknown" }, fallback);
  res.status(500).json({ error: fallback });
}

function invalid(res: Response, error: z.ZodError): void {
  const issue = error.issues[0];
  res.status(400).json({ error: `Champ invalide : ${issue?.path.join(".") || "corps"} — ${issue?.message ?? "valeur refusée"}` });
}

// Toutes les routes imbriquées /campaigns/:id/* sont limitées à l'agence de l'utilisateur.
router.param("id", async (req, res, next, id) => {
  try {
    const campaign = await campaignService.getCampaign(String(id), req.auth!.tenantId);
    if (!campaign) { res.status(404).json({ error: "Campagne introuvable" }); return; }
    next();
  } catch { res.status(500).json({ error: "Vérification de campagne impossible" }); }
});

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date AAAA-MM-JJ attendue")
  .refine(v => { const d = new Date(`${v}T00:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v; }, "date inexistante");
const optionalText = (max: number) => z.string().trim().max(max).nullish();
const url = z.string().trim().max(2000).url("URL invalide").refine(v => /^https?:\/\//i.test(v), "URL http(s) attendue");

const campaignFields = {
  name: z.string().trim().min(1).max(200),
  targetType: z.enum(["B2B", "B2C"]),
  targetName: z.string().trim().min(1).max(200),
  targetUrl: z.union([url, z.literal("")]).nullish(),
  keywords: z.array(z.string().max(120)).max(100),
  description: optionalText(4000),
  prospectId: z.string().uuid().nullish(),
  subjectAliases: z.array(z.string().max(200)).max(50),
  subjectLocation: optionalText(200),
  subjectRole: optionalText(200),
  mandateReference: optionalText(200),
  mandateSignatory: optionalText(200),
  mandateSignedAt: date.nullish(),
  mandateScope: optionalText(2000),
  retentionUntil: date.nullish(),
  status: z.enum(CAMPAIGN_STATUSES as [string, ...string[]]),
};
const createSchema = z.object({
  ...campaignFields,
  keywords: campaignFields.keywords.default([]),
  subjectAliases: campaignFields.subjectAliases.default([]),
  status: campaignFields.status.default("active"),
}).strict();
const updateSchema = z.object(campaignFields).partial().strict()
  .refine(v => Object.keys(v).length > 0, "aucun champ à modifier");

/* GET /ereputation/campaigns?includeArchived=true */
router.get("/campaigns", async (req, res) => {
  try {
    res.json(await campaignService.listCampaigns(req.auth!.tenantId, { includeArchived: req.query.includeArchived === "true" }));
  } catch (error) { fail(res, error, "Lecture des campagnes impossible"); }
});

/* POST /ereputation/campaigns */
router.post("/campaigns", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { invalid(res, parsed.error); return; }
  try {
    const campaign = await campaignService.createCampaign({ ...parsed.data, status: parsed.data.status as any, tenantId: req.auth!.tenantId, actor: actorOf(req) });
    res.status(201).json(campaign);
  } catch (error) { fail(res, error, "Création de la campagne impossible"); }
});

/* GET /ereputation/campaigns/:id */
router.get("/campaigns/:id", async (req, res) => {
  try { res.json(await campaignService.getCampaign(String(req.params.id), req.auth!.tenantId)); }
  catch (error) { fail(res, error, "Lecture de la campagne impossible"); }
});

/* PATCH /ereputation/campaigns/:id — modification partielle, historisée */
router.patch("/campaigns/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) { invalid(res, parsed.error); return; }
  try {
    res.json(await campaignService.updateCampaign(String(req.params.id), req.auth!.tenantId, parsed.data as any, actorOf(req)));
  } catch (error) { fail(res, error, "Modification de la campagne impossible"); }
});

/* POST /ereputation/campaigns/:id/status { status: active|paused|archived } */
router.post("/campaigns/:id/status", async (req, res) => {
  const parsed = z.object({ status: campaignFields.status }).strict().safeParse(req.body);
  if (!parsed.success) { invalid(res, parsed.error); return; }
  try {
    res.json(await campaignService.setStatus(String(req.params.id), req.auth!.tenantId, parsed.data.status as any, actorOf(req)));
  } catch (error) { fail(res, error, "Changement de statut impossible"); }
});

/* DELETE /ereputation/campaigns/:id — suppression définitive + données collectées */
router.delete("/campaigns/:id", async (req, res) => {
  try { res.json(await campaignService.deleteCampaign(String(req.params.id), req.auth!.tenantId, actorOf(req))); }
  catch (error) { fail(res, error, "Suppression de la campagne impossible"); }
});

/* GET /ereputation/campaigns/:campaignId/history — disponible aussi après suppression */
router.get("/campaigns/:campaignId/history", async (req, res) => {
  const id = String(req.params.campaignId);
  if (!z.string().uuid().safeParse(id).success) { res.status(400).json({ error: "Identifiant invalide" }); return; }
  try {
    const entries = await changeLog.list(req.auth!.tenantId, id, Number(req.query.limit) || 200);
    if (!entries.length && !(await campaignService.getCampaign(id, req.auth!.tenantId))) {
      res.status(404).json({ error: "Campagne introuvable" }); return;
    }
    res.json(entries);
  } catch (error) { fail(res, error, "Lecture de l'historique impossible"); }
});

/* POST /ereputation/retention/purge — purge immédiate des personnes dont la conservation a expiré (admin) */
router.post("/retention/purge", requireRole("admin"), async (req, res) => {
  try { res.json(await purgeExpiredPersonCampaigns(req.auth!.tenantId)); }
  catch (error) { fail(res, error, "Purge RGPD impossible"); }
});

/* GET /ereputation/campaigns/:id/dashboard */
router.get("/campaigns/:id/dashboard", async (req, res) => {
  try { res.json(await campaignService.getDashboard(String(req.params.id), req.auth!.tenantId)); }
  catch (error) { fail(res, error, "Tableau de bord indisponible"); }
});

/* POST /ereputation/campaigns/:id/audit */
router.post("/campaigns/:id/audit", async (req, res) => {
  try { res.json(await campaignService.runAudit(String(req.params.id), req.auth!.tenantId)); }
  catch (error) { fail(res, error, "Audit impossible"); }
});

/* POST /ereputation/campaigns/:id/generate-strategy */
router.post("/campaigns/:id/generate-strategy", async (req, res) => {
  try { res.json({ strategy: await strategyEngine.generateAutomatedStrategy(String(req.params.id), req.auth!.tenantId) }); }
  catch (err: any) { res.status(503).json({ error: err?.message ?? "Génération IA indisponible" }); }
});

/* POST /ereputation/campaigns/:id/generate-content */
router.post("/campaigns/:id/generate-content", async (req, res) => {
  const parsed = z.object({
    platform: z.enum(["LinkedIn", "X", "Blog", "Newsletter", "Instagram"]),
    tone: z.enum(["professionnel", "inspirant", "éducatif", "storytelling"]).default("professionnel"),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Plateforme ou ton invalide" }); return; }
  try {
    const content = await strategyEngine.generateContent(String(req.params.id), req.auth!.tenantId, parsed.data.platform, parsed.data.tone);
    res.json({ content, status: "draft", published: false });
  } catch (err: any) { res.status(503).json({ error: err?.message ?? "Génération IA indisponible" }); }
});

/* GET /ereputation/campaigns/:id/serp */
router.get("/campaigns/:id/serp", async (req, res) => {
  try { res.json(await campaignService.getSerpData(String(req.params.id))); }
  catch (error) { fail(res, error, "Lecture SERP impossible"); }
});

/* POST /ereputation/campaigns/:id/serp — saisie d'une mesure observée (position null = absent du top 100) */
router.post("/campaigns/:id/serp", async (req, res) => {
  const parsed = z.object({
    keyword: z.string().trim().min(1).max(200),
    position: z.number().int().min(1).max(100).nullable(),
    url: z.union([url, z.literal("")]).nullish(),
    volume: z.number().int().min(0).nullish(),
  }).safeParse(req.body);
  if (!parsed.success) { invalid(res, parsed.error); return; }
  try {
    const { keyword, position, url: resultUrl, volume } = parsed.data;
    await campaignService.addSerpEntry(String(req.params.id), keyword, position, resultUrl, volume);
    res.status(201).json({ ok: true });
  } catch (error) { fail(res, error, "Enregistrement SERP impossible"); }
});

/* GET /ereputation/campaigns/:id/sentiment */
router.get("/campaigns/:id/sentiment", async (req, res) => {
  try { res.json(await campaignService.getSentimentLogs(String(req.params.id))); }
  catch (error) { fail(res, error, "Lecture des mentions impossible"); }
});

/* POST /ereputation/campaigns/:id/sentiment */
router.post("/campaigns/:id/sentiment", async (req, res) => {
  const parsed = z.object({ text: z.string().trim().min(1).max(20000), sourceUrl: z.union([url, z.literal("")]).nullish() }).safeParse(req.body);
  if (!parsed.success) { invalid(res, parsed.error); return; }
  try {
    const analysis = await campaignService.addSentimentLog(String(req.params.id), parsed.data.text, parsed.data.sourceUrl);
    res.status(201).json({ ok: true, analysis });
  } catch (error) { fail(res, error, "Enregistrement de la mention impossible"); }
});

/* POST /ereputation/campaigns/:id/sentiment/:logId/ai-response */
router.post("/campaigns/:id/sentiment/:logId/ai-response", async (_req, res) => {
  res.status(501).json({ error: "Réponse automatique indisponible : elle nécessiterait un fournisseur IA et une validation humaine." });
});

/* GET /ereputation/campaigns/:id/posts */
router.get("/campaigns/:id/posts", async (req, res) => {
  try { res.json(await campaignService.getPosts(String(req.params.id))); }
  catch (error) { fail(res, error, "Lecture des contenus impossible"); }
});

/* POST /ereputation/campaigns/:id/posts */
router.post("/campaigns/:id/posts", async (req, res) => {
  const { platform, content, scheduledAt } = req.body ?? {};
  if (!platform || !content) { res.status(400).json({ error: "platform et content requis" }); return; }
  if (scheduledAt) { res.status(409).json({ error: "Planification non disponible sans moteur de publication. Enregistrez un brouillon sans date." }); return; }
  try { res.status(201).json(await campaignService.createPost(String(req.params.id), String(platform), String(content))); }
  catch (error) { fail(res, error, "Enregistrement du contenu impossible"); }
});

/* GET /ereputation/pbn */
router.get("/pbn", async (req, res) => {
  try { res.json(await campaignService.getPbnSites(req.auth!.tenantId)); }
  catch (error) { fail(res, error, "Lecture des sites impossible"); }
});

/* POST /ereputation/pbn */
router.post("/pbn", async (req, res) => {
  const parsed = z.object({
    url, campaignId: z.string().uuid().nullish(),
    daScore: z.number().int().min(0).max(100).nullish(), paScore: z.number().int().min(0).max(100).nullish(),
  }).safeParse(req.body);
  if (!parsed.success) { invalid(res, parsed.error); return; }
  try {
    const { url: siteUrl, campaignId, daScore, paScore } = parsed.data;
    res.status(201).json(await campaignService.addPbnSite(req.auth!.tenantId, campaignId ?? null, siteUrl, daScore ?? null, paScore ?? null));
  } catch (error) { fail(res, error, "Enregistrement du site impossible"); }
});

/* POST /ereputation/analyze-text */
router.post("/analyze-text", async (req, res) => {
  const { text } = req.body ?? {};
  if (!text) { res.status(400).json({ error: "text requis" }); return; }
  res.json(sentimentAnalyzer.analyzeText(String(text)));
});

/* GET /ereputation/score-global — moyenne des seules campagnes évaluées */
router.get("/score-global", async (req, res) => {
  try {
    const g = await campaignService.getGlobalScore(req.auth!.tenantId);
    const score = g.score;
    const grade = score === null ? null : score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : score >= 35 ? "D" : "F";
    const label = score === null ? "Non évalué" : score >= 80 ? "Excellente" : score >= 65 ? "Bonne" : score >= 50 ? "Moyenne" : "À améliorer";
    res.json({
      score, grade, label,
      trend: null, // pas encore d'historique de score : aucune tendance inventée
      breakdown: {
        campaigns: g.campaigns, evaluatedCampaigns: g.evaluated,
        mentions: g.mentions.total, positiveMentions: g.mentions.pos, negativeMentions: g.mentions.neg,
      },
    });
  } catch (error) { fail(res, error, "Score global indisponible"); }
});

// ── Lot 2 : veille (SERP Google/Bing, avis Maps/PagesJaunes, presse) ─────────
const watchSchema = z.object({
  engines: z.array(z.enum(WATCH_ENGINES)).max(2),
  extraQueries: z.array(z.string().trim().max(160)).max(10),
  mapsUrl: z.union([z.string().trim().max(2000), z.literal("")]).nullish().transform(v => v || null),
  pagesjaunesUrl: z.union([z.string().trim().max(2000), z.literal("")]).nullish().transform(v => v || null),
  newsEnabled: z.boolean(),
  rssFeeds: z.array(z.string().trim().max(2000)).max(10),
  frequency: z.enum(["off", "daily", "weekly"]),
  dailyDepth: z.number().int().min(10).max(100),
  weeklyDepth: z.number().int().min(10).max(100),
}).partial().strict();

/* GET /ereputation/campaigns/:id/watch — réglages, requêtes générées, profils navigateur, dernier passage */
router.get("/campaigns/:id/watch", async (req, res) => {
  try { res.json(await watchService.overview(String(req.params.id), req.auth!.tenantId)); }
  catch (error) { fail(res, error, "Lecture de la veille impossible"); }
});

/* PUT /ereputation/campaigns/:id/watch */
router.put("/campaigns/:id/watch", async (req, res) => {
  const parsed = watchSchema.safeParse(req.body);
  if (!parsed.success) { invalid(res, parsed.error); return; }
  try {
    await watchService.saveSettings(String(req.params.id), req.auth!.tenantId, parsed.data, req.auth!.userId);
    res.json(await watchService.overview(String(req.params.id), req.auth!.tenantId));
  } catch (error) { fail(res, error, "Enregistrement de la veille impossible"); }
});

/* POST /ereputation/campaigns/:id/watch/run { depth? } — « Lancer maintenant » */
router.post("/campaigns/:id/watch/run", async (req, res) => {
  const parsed = z.object({ depth: z.number().int().min(10).max(100).optional() }).strict().safeParse(req.body ?? {});
  if (!parsed.success) { invalid(res, parsed.error); return; }
  try {
    const run = await watchService.enqueue(String(req.params.id), req.auth!.tenantId, "manual", { depth: parsed.data.depth, userId: req.auth!.userId });
    kickErepWatch();
    res.status(202).json(run);
  } catch (error) { fail(res, error, "Lancement de la veille impossible"); }
});

/* GET /ereputation/campaigns/:id/watch/runs */
router.get("/campaigns/:id/watch/runs", async (req, res) => {
  try { res.json(await watchService.listRuns(String(req.params.id))); }
  catch (error) { fail(res, error, "Lecture des passages impossible"); }
});

/* POST /ereputation/watch/runs/:runId/resume | /cancel */
for (const action of ["resume", "cancel"] as const) {
  router.post(`/watch/runs/:runId/${action}`, async (req, res) => {
    if (!/^[0-9a-f-]{36}$/i.test(String(req.params.runId))) { res.status(404).json({ error: "Veille introuvable" }); return; }
    try {
      const run = action === "resume" ? await watchService.resume(String(req.params.runId), req.auth!.tenantId) : await watchService.cancel(String(req.params.runId), req.auth!.tenantId);
      if (action === "resume") kickErepWatch();
      res.json(run);
    } catch (error) { fail(res, error, "Action sur la veille impossible"); }
  });
}

/* GET /ereputation/campaigns/:id/mentions?status=new|qualified|ignored&kind=serp|review|news */
router.get("/campaigns/:id/mentions", async (req, res) => {
  const parsed = z.object({ status: z.enum(["new", "qualified", "ignored"]).optional(), kind: z.enum(["serp", "review", "news"]).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional() }).safeParse(req.query);
  if (!parsed.success) { invalid(res, parsed.error); return; }
  try { res.json(await watchService.listMentions(String(req.params.id), parsed.data)); }
  catch (error) { fail(res, error, "Lecture des mentions impossible"); }
});

/* PATCH /ereputation/mentions/:mentionId { status? , sentiment?, critical? } — qualification et correction manuelle du sentiment */
router.patch("/mentions/:mentionId", async (req, res) => {
  const parsed = z.object({ status: z.enum(["new", "qualified", "ignored"]).optional(), sentiment: z.enum(["pos", "neg", "neu"]).optional(), critical: z.boolean().optional() })
    .strict().refine(v => v.status || v.sentiment, { message: "statut ou sentiment attendu" }).safeParse(req.body);
  if (!parsed.success) { invalid(res, parsed.error); return; }
  const mentionId = String(req.params.mentionId);
  if (!uuidLike(mentionId)) { res.status(404).json({ error: "Mention introuvable" }); return; }
  try {
    let result: Record<string, unknown> = {};
    if (parsed.data.sentiment) {
      result = await erepAI.correct(mentionId, req.auth!.tenantId, { sentiment: parsed.data.sentiment, critical: parsed.data.critical });
      await alertService.onMentionCorrected(mentionId).catch(() => undefined);
    }
    if (parsed.data.status) result = { ...result, ...(await watchService.setMentionStatus(mentionId, req.auth!.tenantId, parsed.data.status)) };
    res.json(result);
  } catch (error) { fail(res, error, "Qualification impossible"); }
});

/* GET /ereputation/campaigns/:id/watch/serp — dernier relevé par moteur et requête */
router.get("/campaigns/:id/watch/serp", async (req, res) => {
  try { res.json(await watchService.latestSerp(String(req.params.id))); }
  catch (error) { fail(res, error, "Lecture du relevé SERP impossible"); }
});

/* GET /ereputation/campaigns/:id/reviews — note, volume et avis relevés */
router.get("/campaigns/:id/reviews", async (req, res) => {
  try { res.json(await watchService.reviewsOverview(String(req.params.id))); }
  catch (error) { fail(res, error, "Lecture des avis impossible"); }
});

// ── Lot 3 : score expliqué, alertes, plans de crise, e-mails ─────────────────
const uuidLike = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/* GET /ereputation/campaigns/:id/score — score, composantes, facteurs chiffrés, évolution, historique 90 jours */
router.get("/campaigns/:id/score", async (req, res) => {
  try {
    await campaignService.calculateReputationScore(String(req.params.id));
    res.json(await explainScore(String(req.params.id), parisDay()));
  } catch (error) { fail(res, error, "Lecture du score impossible"); }
});

/* GET /ereputation/alerts?open=1&campaignId= */
router.get("/alerts", async (req, res) => {
  const parsed = z.object({ open: z.enum(["0", "1"]).optional(), campaignId: z.string().uuid().optional(), limit: z.coerce.number().int().min(1).max(200).optional() }).safeParse(req.query);
  if (!parsed.success) { invalid(res, parsed.error); return; }
  try { res.json(await alertService.listAlerts(req.auth!.tenantId, { campaignId: parsed.data.campaignId, open: parsed.data.open === "1", limit: parsed.data.limit })); }
  catch (error) { fail(res, error, "Lecture des alertes impossible"); }
});

/* PATCH /ereputation/alerts/:alertId { resolved } */
router.patch("/alerts/:alertId", async (req, res) => {
  const parsed = z.object({ resolved: z.boolean() }).strict().safeParse(req.body);
  if (!parsed.success) { invalid(res, parsed.error); return; }
  if (!uuidLike(String(req.params.alertId))) { res.status(404).json({ error: "Alerte introuvable" }); return; }
  try { res.json(await alertService.resolveAlert(String(req.params.alertId), req.auth!.tenantId, req.auth!.userId, parsed.data.resolved)); }
  catch (error) { fail(res, error, "Mise à jour de l'alerte impossible"); }
});

const rulesSchema = z.object({
  negativeMention: z.boolean(), criticalMention: z.boolean(), lowReview: z.boolean(), watchBlocked: z.boolean(),
  ratingDrop: z.number().min(0.1).max(2).nullable(), negativeSerpTop: z.number().int().min(1).max(20).nullable(),
  scoreLow: z.number().int().min(1).max(99).nullable(), scoreDrop: z.number().int().min(1).max(60).nullable(),
  crisis: z.object({
    alertScore: z.number().int().min(1).max(99), crisisScore: z.number().int().min(1).max(99),
    criticalAlert: z.number().int().min(1).max(20), criticalCrisis: z.number().int().min(1).max(50),
    negativeVigilance: z.number().int().min(1).max(50), negativeAlert: z.number().int().min(1).max(100),
  }).partial().strict(),
}).partial().strict();

/* GET / PUT /ereputation/campaigns/:id/alert-rules */
router.get("/campaigns/:id/alert-rules", async (req, res) => {
  try { res.json({ rules: await alertService.getRules(String(req.params.id)), defaults: DEFAULT_RULES }); }
  catch (error) { fail(res, error, "Lecture des règles impossible"); }
});
router.put("/campaigns/:id/alert-rules", async (req, res) => {
  const parsed = rulesSchema.safeParse(req.body);
  if (!parsed.success) { invalid(res, parsed.error); return; }
  try {
    const rules = await alertService.saveRules(String(req.params.id), req.auth!.tenantId, parsed.data as any, req.auth!.userId);
    await alertService.evaluateCrisis(String(req.params.id)).catch(() => undefined);
    res.json({ rules, defaults: DEFAULT_RULES });
  } catch (error) { fail(res, error, "Enregistrement des règles impossible"); }
});

/* GET /ereputation/campaigns/:id/crisis — niveau actuel, plan ouvert, plans clôturés */
router.get("/campaigns/:id/crisis", async (req, res) => {
  try { res.json(await alertService.crisis(String(req.params.id))); }
  catch (error) { fail(res, error, "Lecture du plan de crise impossible"); }
});

/* POST /ereputation/campaigns/:id/crisis/evaluate — réévaluation immédiate des seuils */
router.post("/campaigns/:id/crisis/evaluate", async (req, res) => {
  try {
    await campaignService.calculateReputationScore(String(req.params.id));
    await alertService.evaluateScore(String(req.params.id));
    await alertService.evaluateCrisis(String(req.params.id));
    res.json(await alertService.crisis(String(req.params.id)));
  } catch (error) { fail(res, error, "Évaluation impossible"); }
});

/* PATCH /ereputation/crisis/:planId/actions/:actionId { done?, assigneeId? } */
router.patch("/crisis/:planId/actions/:actionId", async (req, res) => {
  const parsed = z.object({ done: z.boolean().optional(), assigneeId: z.string().uuid().nullable().optional() }).strict().safeParse(req.body);
  if (!parsed.success) { invalid(res, parsed.error); return; }
  if (!uuidLike(String(req.params.planId))) { res.status(404).json({ error: "Plan de crise introuvable" }); return; }
  try { res.json(await alertService.updateAction(String(req.params.planId), req.auth!.tenantId, String(req.params.actionId).slice(0, 40), parsed.data, actorOf(req))); }
  catch (error) { fail(res, error, "Mise à jour de l'action impossible"); }
});

/* POST /ereputation/crisis/:planId/close { note } — clôture décidée par l'agence */
router.post("/crisis/:planId/close", async (req, res) => {
  const parsed = z.object({ note: z.string().trim().max(1000).default("") }).strict().safeParse(req.body ?? {});
  if (!parsed.success) { invalid(res, parsed.error); return; }
  if (!uuidLike(String(req.params.planId))) { res.status(404).json({ error: "Plan de crise introuvable" }); return; }
  try { res.json(await alertService.closePlan(String(req.params.planId), req.auth!.tenantId, parsed.data.note, actorOf(req))); }
  catch (error) { fail(res, error, "Clôture impossible"); }
});

/* POST /ereputation/reviews/:reviewId/reply-draft — brouillon à relire, jamais publié automatiquement */
router.post("/reviews/:reviewId/reply-draft", async (req, res) => {
  if (!uuidLike(String(req.params.reviewId))) { res.status(404).json({ error: "Avis introuvable" }); return; }
  try { res.json(await erepAI.replyDraft(String(req.params.reviewId), req.auth!.tenantId)); }
  catch (error) { fail(res, error, "Brouillon impossible"); }
});

/* GET / PUT /ereputation/alert-email — réglages des e-mails internes (membres de l'agence uniquement) */
router.get("/alert-email", async (req, res) => {
  try { res.json({ settings: await erepDigest.getSettings(req.auth!.tenantId), members: await erepDigest.members(req.auth!.tenantId) }); }
  catch (error) { fail(res, error, "Lecture des réglages e-mail impossible"); }
});
router.put("/alert-email", async (req, res) => {
  const parsed = EmailSettingsInput.strict().safeParse(req.body);
  if (!parsed.success) { invalid(res, parsed.error); return; }
  try {
    await erepDigest.saveSettings(req.auth!.tenantId, parsed.data, req.auth!.userId);
    res.json({ settings: await erepDigest.getSettings(req.auth!.tenantId), members: await erepDigest.members(req.auth!.tenantId) });
  } catch (error) { fail(res, error, "Enregistrement des réglages e-mail impossible"); }
});

/* GET /ereputation/alert-email/preview?kind=daily|weekly — aperçu HTML du récapitulatif */
router.get("/alert-email/preview", async (req, res) => {
  const kind = req.query.kind === "weekly" ? "weekly" : "daily";
  try { const d = await erepDigest.build(req.auth!.tenantId, kind); res.json({ subject: d.subject, html: d.html, empty: d.empty }); }
  catch (error) { fail(res, error, "Aperçu impossible"); }
});

/* POST /ereputation/alert-email/test — envoi de test aux destinataires choisis */
router.post("/alert-email/test", async (req, res) => {
  try { res.json(await erepDigest.sendTest(req.auth!.tenantId)); }
  catch (error) { fail(res, error, "Envoi de test impossible"); }
});

/* POST /ereputation/alert-email/send-now { kind } — envoi du récapitulatif de la période (une fois au plus), administrateur */
router.post("/alert-email/send-now", requireRole("admin"), async (req, res) => {
  const parsed = z.object({ kind: z.enum(["daily", "weekly"]) }).strict().safeParse(req.body);
  if (!parsed.success) { invalid(res, parsed.error); return; }
  try { res.json(await erepDigest.send(req.auth!.tenantId, parsed.data.kind)); }
  catch (error) { fail(res, error, "Envoi impossible"); }
});

export default router;
