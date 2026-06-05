import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

/**
 * Middleware pour valider la signature HMAC des webhooks entrants.
 * Attend le header X-GrowthOS-Signature: sha256=<hex>
 */
export function webhookAuth(secret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const signature = req.headers["x-growthos-signature"] as string | undefined;
    if (!signature) {
      res.status(401).json({ error: "Signature manquante" });
      return;
    }
    const body = req.body ? JSON.stringify(req.body) : "";
    const expected = `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
    try {
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        res.status(401).json({ error: "Signature invalide" });
        return;
      }
    } catch {
      res.status(401).json({ error: "Signature invalide" });
      return;
    }
    next();
  };
}
