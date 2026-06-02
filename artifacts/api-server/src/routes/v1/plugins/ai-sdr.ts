import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../../middlewares/auth";
import { aiSDRService, generatePlaybook, PROMPT_TEMPLATES } from "../../../lib/plugin-ai-sdr/AISDRService";

const router = Router();

const DraftSchema = z.object({
  accountId: z.string().min(1, "accountId is required"),
  goal:      z.string().min(3, "goal must be at least 3 characters"),
  tone:      z.enum(["formal", "casual", "friendly"]).optional().default("friendly"),
});

// GET /ai-sdr/status — check Ollama availability
router.get("/status", requireAuth, async (_req, res) => {
  try {
    const status = await aiSDRService.checkOllamaStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /ai-sdr/templates — saved prompt templates
router.get("/templates", requireAuth, (_req, res) => {
  res.json(PROMPT_TEMPLATES);
});

// POST /ai-sdr/draft/email
router.post("/draft/email", requireAuth, async (req, res) => {
  const parse = DraftSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: parse.error.flatten() }); return; }
  try {
    const draft = await aiSDRService.draftEmail({
      ...parse.data,
      tenantId: req.auth!.tenantId,
    });
    res.json(draft);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Draft generation failed" });
  }
});

// POST /ai-sdr/draft/linkedin
router.post("/draft/linkedin", requireAuth, async (req, res) => {
  const parse = DraftSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: parse.error.flatten() }); return; }
  try {
    const draft = await aiSDRService.draftLinkedInMessage({
      ...parse.data,
      tenantId: req.auth!.tenantId,
    });
    res.json(draft);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Draft generation failed" });
  }
});

// POST /ai-sdr/sequence
router.post("/sequence", requireAuth, async (req, res) => {
  const parse = DraftSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: parse.error.flatten() }); return; }
  try {
    const draft = await aiSDRService.generateSequence({
      ...parse.data,
      tenantId: req.auth!.tenantId,
    });
    res.json(draft);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Sequence generation failed" });
  }
});

// POST /ai-sdr/playbook — generate sales playbook for an account
router.post("/playbook", requireAuth, async (req, res) => {
  const parse = DraftSchema.safeParse({ ...req.body, goal: req.body.goal ?? "generate sales playbook" });
  if (!parse.success) { res.status(400).json({ error: parse.error.flatten() }); return; }
  try {
    const playbook = await generatePlaybook({ ...parse.data, tenantId: req.auth!.tenantId });
    res.json(playbook);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Playbook generation failed" });
  }
});

export default router;
