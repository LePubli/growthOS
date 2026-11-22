import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../../middlewares/auth";
import { sendEmail } from "../../services/email";

const router = Router();
router.use(requireRole("admin"));

const manualEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().trim().min(1).max(200),
  html: z.string().trim().min(1).max(100000),
});

// Only intentionally enabled one-off mail; no fake delivery receipts.
router.post("/send", async (req, res) => {
  const parsed = manualEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Destinataire, objet ou contenu invalide" });
    return;
  }
  const result = await sendEmail({ tenantId: req.auth!.tenantId, ...parsed.data });
  res.status(result.success ? 200 : 409).json(result);
});

// The earlier implementation sent only the first untracked email. It had no
// opt-out, list suppression, pause-on-reply or scheduler. Prevent customers
// from interpreting it as a working multi-step outreach sequence.
router.post("/sequences/:id/launch", (_req, res) => {
  res.status(409).json({
    error: "Séquences d'envoi suspendues : il faut d'abord ajouter les désabonnements, la gestion des réponses et le planificateur.",
  });
});

export default router;
