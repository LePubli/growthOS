import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middlewares/auth";
import { logger } from "../../lib/logger";
import { meetingService } from "../../lib/plugin-meeting-intelligence/MeetingService";

const router = Router();

router.use(requireAuth);

/* ────────────────────────────────────────────────
   GET /api/v1/meetings
   List all meetings for the current tenant
──────────────────────────────────────────────── */
router.get("/", async (req, res) => {
  try {
    const meetings = await meetingService.listMeetings(req.auth!.tenantId);
    res.json({ meetings, total: meetings.length });
  } catch (err) {
    logger.error({ err }, "List meetings error");
    res.status(500).json({ error: "Erreur lors de la récupération des réunions" });
  }
});

/* ────────────────────────────────────────────────
   GET /api/v1/meetings/:id
──────────────────────────────────────────────── */
router.get("/:id", async (req, res) => {
  try {
    const meeting = await meetingService.getMeeting(req.params.id, req.auth!.tenantId);
    if (!meeting) {
      res.status(404).json({ error: "Réunion introuvable" });
      return;
    }
    res.json(meeting);
  } catch (err) {
    logger.error({ err }, "Get meeting error");
    res.status(500).json({ error: "Erreur lors de la récupération" });
  }
});

/* ────────────────────────────────────────────────
   POST /api/v1/meetings
   Create + auto-trigger processing
──────────────────────────────────────────────── */
const createSchema = z.object({
  title: z.string().min(1).max(256),
  simulatedFileName: z.string().optional(),
});

router.post("/", async (req, res) => {
  const parse = createSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Données invalides", details: parse.error.issues });
    return;
  }

  try {
    const id = await meetingService.createMeeting({
      ...parse.data,
      tenantId: req.auth!.tenantId,
    });
    res.status(201).json({ id, ok: true });
  } catch (err) {
    logger.error({ err }, "Create meeting error");
    res.status(500).json({ error: "Erreur lors de la création de la réunion" });
  }
});

/* ────────────────────────────────────────────────
   POST /api/v1/meetings/:id/process
   Manual re-trigger (if status is pending/error)
──────────────────────────────────────────────── */
router.post("/:id/process", async (req, res) => {
  try {
    const ok = await meetingService.triggerProcessing(req.params.id, req.auth!.tenantId);
    if (!ok) {
      res.status(404).json({ error: "Réunion introuvable" });
      return;
    }
    res.json({ ok: true, message: "Traitement démarré" });
  } catch (err) {
    logger.error({ err }, "Process meeting error");
    res.status(500).json({ error: "Erreur lors du traitement" });
  }
});

/* ────────────────────────────────────────────────
   DELETE /api/v1/meetings/:id
──────────────────────────────────────────────── */
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await meetingService.deleteMeeting(req.params.id, req.auth!.tenantId);
    if (!deleted) {
      res.status(404).json({ error: "Réunion introuvable" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Delete meeting error");
    res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

export default router;
