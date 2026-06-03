import { Router } from "express";
import { requireAuth } from "../../../middlewares/auth";
import { executiveService } from "../../../lib/plugin-executive-command/ExecutiveService";

const router = Router();

// GET /executive/overview — full command center summary
router.get("/overview", requireAuth, async (req, res) => {
  try {
    const overview = await executiveService.getCommandOverview(req.auth!.tenantId);
    res.json(overview);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /executive/assistant/ask — AI assistant conversational query
router.post("/assistant/ask", requireAuth, async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "question is required" });
    }
    const response = await executiveService.queryAssistant(question, req.auth!.tenantId);
    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
