import { Router } from "express";
import { z } from "zod";
import {
  MonitoringError,
  monitoringState,
  configureMonitoring,
  verifyProspect,
} from "../../services/prospect-monitoring";
const router = Router();
router.get("/:id/monitoring", async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    res.json(await monitoringState(req.auth!.tenantId, id));
  } catch (err) {
    if (err instanceof z.ZodError)
      res.status(400).json({ error: "Identifiant invalide" });
    else if (err instanceof MonitoringError)
      res.status(err.status).json({ error: err.message });
    else next(err);
  }
});
router.patch("/:id/monitoring", async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const config = z
      .object({
        enabled: z.boolean(),
        intervalHours: z
          .union([z.literal(24), z.literal(72), z.literal(168)])
          .default(24),
      })
      .strict()
      .parse(req.body);
    res.json(
      await configureMonitoring(
        req.auth!.tenantId,
        id,
        config.enabled,
        config.intervalHours,
      ),
    );
  } catch (err) {
    if (err instanceof z.ZodError)
      res.status(400).json({ error: "Paramètres de veille invalides" });
    else if (err instanceof MonitoringError)
      res.status(err.status).json({ error: err.message });
    else next(err);
  }
});
router.post("/:id/verify-company", async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const body = z
      .object({ force: z.boolean().default(false) })
      .strict()
      .parse(req.body || {});
    res.json(await verifyProspect(req.auth!.tenantId, id, body.force));
  } catch (err) {
    if (err instanceof z.ZodError)
      res.status(400).json({ error: "Paramètres de vérification invalides" });
    else if (err instanceof MonitoringError)
      res.status(err.status).json({ error: err.message });
    else next(err);
  }
});
export default router;
