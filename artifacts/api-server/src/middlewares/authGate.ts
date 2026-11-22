import type { NextFunction, Request, Response } from "express";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map<string, { count: number; until: number }>();

/** Basic per-address throttling for the single-instance deployment. */
export function throttleAuthentication(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  const email = typeof req.body?.email === "string" ? req.body.email.toLowerCase() : "";
  const key = `${req.socket.remoteAddress ?? "unknown"}:${req.path}:${email}`;
  let entry = attempts.get(key);
  if (!entry || entry.until <= now) {
    entry = { count: 0, until: now + WINDOW_MS };
  }
  entry.count++;
  attempts.set(key, entry);

  if (attempts.size > 5000) {
    for (const [candidate, item] of attempts) {
      if (item.until <= now) attempts.delete(candidate);
    }
  }

  if (entry.count > MAX_ATTEMPTS) {
    res.setHeader("Retry-After", Math.ceil((entry.until - now) / 1000));
    res.status(429).json({ error: "Trop de tentatives. Réessayez dans quelques minutes." });
    return;
  }
  next();
}

/** Initial user creation should be a deliberate, temporary operation. */
export function requireRegistrationEnabled(_req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PUBLIC_REGISTRATION !== "true") {
    res.status(403).json({ error: "Inscriptions publiques désactivées" });
    return;
  }
  next();
}
