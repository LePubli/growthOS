import { Router } from "express";
import { requireAuth } from "../../../middlewares/auth";
import { revenueService } from "../../../lib/plugin-revenue-intelligence/RevenueService";

const router = Router();

// GET /revenue/kpis — core KPIs
router.get("/kpis", requireAuth, async (req, res) => {
  try {
    const data = await revenueService.getCoreKPIs(req.auth!.tenantId);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /revenue/funnel — conversion funnel per stage
router.get("/funnel", requireAuth, async (req, res) => {
  try {
    const data = await revenueService.getConversionFunnel(req.auth!.tenantId);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /revenue/forecast — weighted 30/60/90d forecast
router.get("/forecast", requireAuth, async (req, res) => {
  try {
    const data = await revenueService.getForecast(req.auth!.tenantId);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /revenue/trends — last 6 months revenue trend
router.get("/trends", requireAuth, async (req, res) => {
  try {
    const data = await revenueService.getTrends(req.auth!.tenantId);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /revenue/ai-summary — AI narrative forecast
router.get("/ai-summary", requireAuth, async (req, res) => {
  try {
    const data = await revenueService.getAIForecastSummary(req.auth!.tenantId);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
