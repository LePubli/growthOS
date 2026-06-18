import { Router } from "express";
import { requireAuth } from "../../../middlewares/auth";
import { dealCoachService } from "../../../lib/plugin-ai-deal-coach/DealCoachService";

const router = Router();

// GET /deal-coach/pipeline/health — pipeline health overview
router.get("/pipeline/health", requireAuth, async (req, res) => {
  try {
    const health = await dealCoachService.getPipelineHealth(req.auth!.tenantId);
    res.json(health);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /deal-coach/risks — all at-risk deals
router.get("/risks", requireAuth, async (req, res) => {
  try {
    const deals = await dealCoachService.getAtRiskDeals(req.auth!.tenantId);
    res.json(deals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /deal-coach/deals — all deals with coach data
router.get("/deals", requireAuth, async (req, res) => {
  try {
    const deals = await dealCoachService.getAllDeals(req.auth!.tenantId);
    res.json(deals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /deal-coach/deals/:id/analyze — trigger analysis
router.post("/deals/:id/analyze", requireAuth, async (req, res) => {
  try {
    const provider = (req.body as { provider?: string }).provider ?? "ollama";
    const result = await dealCoachService.analyzeDeal(req.params.id, req.auth!.tenantId, provider);
    res.json(result);
  } catch (err: any) {
    console.error(err);
    if (err?.message?.includes("not found")) {
      res.status(404).json({ error: "Deal introuvable" });
    } else {
      res.status(500).json({ error: "Analysis failed" });
    }
  }
});

// GET /deal-coach/deals/:id/coach — get coach result for deal
router.get("/deals/:id/coach", requireAuth, async (req, res) => {
  try {
    const result = await dealCoachService.getDealCoach(req.params.id, req.auth!.tenantId);
    if (!result) { res.status(404).json({ error: "Deal introuvable" }); return; }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
