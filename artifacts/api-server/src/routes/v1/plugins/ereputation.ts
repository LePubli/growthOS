import { Router } from "express";
import { requireAuth } from "../../../middlewares/auth";
import { campaignService } from "../../../lib/plugin-ereputation/CampaignService";
import { strategyEngine } from "../../../lib/plugin-ereputation/StrategyEngine";
import { sentimentAnalyzer } from "../../../lib/plugin-ereputation/SentimentAnalyzer";
import { db } from "@workspace/db";
import { signalsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

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
  const dashboard = await campaignService.getDashboard(req.params.id, tenantId);
  if (!dashboard) { res.status(404).json({ error: "Campagne introuvable" }); return; }
  res.json(dashboard);
});

/* POST /ereputation/campaigns/:id/audit */
router.post("/campaigns/:id/audit", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  try {
    const result = await campaignService.runAudit(req.params.id, tenantId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* POST /ereputation/campaigns/:id/generate-strategy */
router.post("/campaigns/:id/generate-strategy", requireAuth, async (req, res) => {
  try {
    const strategy = await strategyEngine.generateAutomatedStrategy(req.params.id);
    res.json({ strategy });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* POST /ereputation/campaigns/:id/generate-content */
router.post("/campaigns/:id/generate-content", requireAuth, async (req, res) => {
  const { platform, tone } = req.body as { platform: string; tone: string };
  if (!platform) { res.status(400).json({ error: "platform requis" }); return; }
  try {
    const content = await strategyEngine.generateContent(req.params.id, platform as any, (tone ?? "professionnel") as any);
    res.json({ content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* GET /ereputation/campaigns/:id/serp */
router.get("/campaigns/:id/serp", requireAuth, async (req, res) => {
  const data = await campaignService.getSerpData(req.params.id);
  res.json(data);
});

/* POST /ereputation/campaigns/:id/serp */
router.post("/campaigns/:id/serp", requireAuth, async (req, res) => {
  const { keyword, position, url, volume } = req.body;
  await campaignService.addSerpEntry(req.params.id, keyword, position, url, volume);
  res.json({ ok: true });
});

/* GET /ereputation/campaigns/:id/sentiment */
router.get("/campaigns/:id/sentiment", requireAuth, async (req, res) => {
  const logs = await campaignService.getSentimentLogs(req.params.id);
  res.json(logs);
});

/* POST /ereputation/campaigns/:id/sentiment */
router.post("/campaigns/:id/sentiment", requireAuth, async (req, res) => {
  const { text, sourceUrl } = req.body;
  if (!text) { res.status(400).json({ error: "text requis" }); return; }
  await campaignService.addSentimentLog(req.params.id, text, sourceUrl);
  const analysis = sentimentAnalyzer.analyzeText(text);
  res.json({ ok: true, analysis });
});

/* POST /ereputation/campaigns/:id/sentiment/:logId/ai-response */
router.post("/campaigns/:id/sentiment/:logId/ai-response", requireAuth, async (req, res) => {
  const { text } = req.body as { text: string };
  const response = `Merci pour votre retour. Nous prenons note de votre expérience et allons immédiatement investiguer afin de vous apporter la meilleure solution possible. Notre équipe vous contactera sous 24h. — L'équipe GrowthOS`;
  res.json({ response });
});

/* GET /ereputation/campaigns/:id/posts */
router.get("/campaigns/:id/posts", requireAuth, async (req, res) => {
  const posts = await campaignService.getPosts(req.params.id);
  res.json(posts);
});

/* POST /ereputation/campaigns/:id/posts */
router.post("/campaigns/:id/posts", requireAuth, async (req, res) => {
  const { platform, content, scheduledAt } = req.body;
  if (!platform || !content) { res.status(400).json({ error: "platform et content requis" }); return; }
  const post = await campaignService.createPost(req.params.id, platform, content, scheduledAt);
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

  let sentimentScore = 70;
  if (campaigns.length > 0) {
    const logs = await campaignService.getSentimentLogs(campaigns[0].id);
    if (logs.length > 0) {
      const avg = logs.reduce((s: number, l: any) => s + (l.score ?? 0.5), 0) / logs.length;
      sentimentScore = Math.round((avg + 1) / 2 * 100);
    }
  }

  const positiveSignals = signals.filter((s) => (s.score ?? 50) >= 70).length;
  const negativeSignals = signals.filter((s) => (s.score ?? 50) < 40).length;
  const signalScore = signals.length === 0
    ? 65
    : Math.round(65 + (positiveSignals - negativeSignals * 1.5) / Math.max(signals.length, 1) * 30);

  const score = Math.min(99, Math.max(10, Math.round(sentimentScore * 0.45 + signalScore * 0.55)));

  const grade = score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : score >= 35 ? "D" : "F";
  const label = score >= 80 ? "Excellente" : score >= 65 ? "Bonne" : score >= 50 ? "Moyenne" : "À améliorer";
  const trend = positiveSignals > negativeSignals ? "up" : positiveSignals === negativeSignals ? "stable" : "down";

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
