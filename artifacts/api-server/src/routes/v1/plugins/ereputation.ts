import { Router } from "express";
import { requireAuth } from "../../../middlewares/auth";
import { campaignService } from "../../../lib/plugin-ereputation/CampaignService";
import { strategyEngine } from "../../../lib/plugin-ereputation/StrategyEngine";
import { sentimentAnalyzer } from "../../../lib/plugin-ereputation/SentimentAnalyzer";
import { db } from "@workspace/db";
import { signalsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();
router.use(requireAuth);

// All nested campaign endpoints must be tenant-scoped (not just the dashboard).
router.param('id', async (req, res, next, id) => {
  try {
    const campaign = await campaignService.getCampaign(String(id), req.auth!.tenantId);
    if (!campaign) { res.status(404).json({ error: 'Campagne introuvable' }); return; }
    next();
  } catch { res.status(500).json({ error: 'Vérification de campagne impossible' }); }
});

/* GET /ereputation/campaigns */
router.get("/campaigns", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const campaigns = await campaignService.listCampaigns(tenantId);
  res.json(campaigns);
});

/* POST /ereputation/campaigns */
router.post("/campaigns", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const { name, targetType, targetName, targetUrl, keywords } = req.body;
  if (!name || !targetType || !targetName) {
    res.status(400).json({ error: "name, targetType, targetName requis" });
    return;
  }
  try {
    const campaign = await campaignService.createCampaign({ name, targetType, targetName, targetUrl, keywords: keywords ?? [], tenantId });
    res.status(201).json(campaign);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* GET /ereputation/campaigns/:id/dashboard */
router.get("/campaigns/:id/dashboard", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const dashboard = await campaignService.getDashboard(String(req.params.id), tenantId);
  if (!dashboard) { res.status(404).json({ error: "Campagne introuvable" }); return; }
  res.json(dashboard);
});

/* POST /ereputation/campaigns/:id/audit */
router.post("/campaigns/:id/audit", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  try {
    const result = await campaignService.runAudit(String(req.params.id), tenantId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* POST /ereputation/campaigns/:id/generate-strategy */
router.post("/campaigns/:id/generate-strategy", requireAuth, async (req, res) => {
  try {
    const strategy = await strategyEngine.generateAutomatedStrategy(String(req.params.id), req.auth!.tenantId);
    res.json({ strategy });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* POST /ereputation/campaigns/:id/generate-content */
router.post("/campaigns/:id/generate-content", requireAuth, async (req, res) => {
  const parsed = z.object({
    platform: z.enum(["LinkedIn", "X", "Blog", "Newsletter", "Instagram"]),
    tone: z.enum(["professionnel", "inspirant", "éducatif", "storytelling"]).default("professionnel"),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Plateforme ou ton invalide" }); return; }
  try {
    const content = await strategyEngine.generateContent(String(req.params.id), req.auth!.tenantId, parsed.data.platform, parsed.data.tone);
    res.json({ content, status: "draft", published: false });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* GET /ereputation/campaigns/:id/serp */
router.get("/campaigns/:id/serp", requireAuth, async (req, res) => {
  const data = await campaignService.getSerpData(String(req.params.id));
  res.json(data);
});

/* POST /ereputation/campaigns/:id/serp */
router.post("/campaigns/:id/serp", requireAuth, async (req, res) => {
  const { keyword, position, url, volume } = req.body;
  await campaignService.addSerpEntry(String(req.params.id), keyword, position, url, volume);
  res.json({ ok: true });
});

/* GET /ereputation/campaigns/:id/sentiment */
router.get("/campaigns/:id/sentiment", requireAuth, async (req, res) => {
  const logs = await campaignService.getSentimentLogs(String(req.params.id));
  res.json(logs);
});

/* POST /ereputation/campaigns/:id/sentiment */
router.post("/campaigns/:id/sentiment", requireAuth, async (req, res) => {
  const { text, sourceUrl } = req.body;
  if (!text) { res.status(400).json({ error: "text requis" }); return; }
  await campaignService.addSentimentLog(String(req.params.id), text, sourceUrl);
  const analysis = sentimentAnalyzer.analyzeText(text);
  res.json({ ok: true, analysis });
});

/* POST /ereputation/campaigns/:id/sentiment/:logId/ai-response */
router.post("/campaigns/:id/sentiment/:logId/ai-response", requireAuth, async (req, res) => {
  res.status(501).json({ error: "Réponse automatique indisponible : elle nécessiterait un fournisseur IA et une validation humaine." });
});

/* GET /ereputation/campaigns/:id/posts */
router.get("/campaigns/:id/posts", requireAuth, async (req, res) => {
  const posts = await campaignService.getPosts(String(req.params.id));
  res.json(posts);
});

/* POST /ereputation/campaigns/:id/posts */
router.post("/campaigns/:id/posts", requireAuth, async (req, res) => {
  const { platform, content, scheduledAt } = req.body;
  if (!platform || !content) { res.status(400).json({ error: "platform et content requis" }); return; }
  if (scheduledAt) { res.status(409).json({ error: "Planification non disponible sans moteur de publication. Enregistrez un brouillon sans date." }); return; }
  const post = await campaignService.createPost(String(req.params.id), platform, content, scheduledAt);
  res.status(201).json(post);
});

/* GET /ereputation/pbn */
router.get("/pbn", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const sites = await campaignService.getPbnSites(tenantId);
  res.json(sites);
});

/* POST /ereputation/pbn */
router.post("/pbn", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const { campaignId, url, daScore, paScore } = req.body;
  if (!url) { res.status(400).json({ error: "url requis" }); return; }
  const site = await campaignService.addPbnSite(tenantId, campaignId ?? null, url, daScore ?? 0, paScore ?? 0);
  res.status(201).json(site);
});

/* POST /ereputation/analyze-text */
router.post("/analyze-text", requireAuth, async (req, res) => {
  const { text } = req.body;
  if (!text) { res.status(400).json({ error: "text requis" }); return; }
  const result = sentimentAnalyzer.analyzeText(text);
  res.json(result);
});

/* GET /ereputation/score-global
 * Compute a global reputation score from signals + sentiment logs.
 * Returns: { score, grade, signals, trend, breakdown }
 */
router.get("/score-global", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;

  const signals = await db.select().from(signalsTable)
    .where(eq(signalsTable.tenantId, tenantId));

  const campaigns = await campaignService.listCampaigns(tenantId);

  let sentimentScore: number | null = null;
  if (campaigns.length > 0) {
    const logs = await campaignService.getSentimentLogs(campaigns[0].id);
    if (logs.length > 0) {
      const avg = logs.reduce((s: number, l: any) => s + (Number(l.score) || 0), 0) / logs.length;
      sentimentScore = Math.round((avg + 1) / 2 * 100);
    }
  }

  // Signal impact scores are NOT sentiment polarity; using them as such produces
  // a fictitious global reputation score. Only evaluated mentions can be scored.
  const positiveSignals = 0;
  const negativeSignals = 0;
  const signalScore: number | null = null;
  const score = sentimentScore;

  const grade = score===null ? null : score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : score >= 35 ? "D" : "F";
  const label = score===null ? "Non évalué" : score >= 80 ? "Excellente" : score >= 65 ? "Bonne" : score >= 50 ? "Moyenne" : "À améliorer";
  const trend = null; // No historical comparison; don't fabricate a trend.

  res.json({
    score,
    grade,
    label,
    trend,
    breakdown: {
      sentimentScore,
      signalScore,
      totalSignals: signals.length,
      positiveSignals,
      negativeSignals,
      campaigns: campaigns.length,
    },
  });
});

export default router;
