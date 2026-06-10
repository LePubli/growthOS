import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthPayload {
  userId: string;
  tenantId: string;
  email: string;
  role?: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export const JWT_SECRET = process.env.JWT_SECRET ?? "growthos-dev-secret-change-in-production";
export const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "growthos-refresh-secret-change-in-production";

export function signAccessToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" });
}

export function signRefreshToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: "7d" });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  // Support Bearer header (standard) or ?token= query param (SSE / EventSource)
  const raw = header?.startsWith("Bearer ")
    ? header.slice(7)
    : typeof req.query.token === "string" ? req.query.token : null;

  if (!raw) {
    res.status(401).json({ error: "Token manquant" });
    return;
  }
  try {
    const payload = jwt.verify(raw, JWT_SECRET) as AuthPayload;
    req.auth = payload;
    next();
  } catch {
    res.status(401).json({ error: "Token invalide ou expiré" });
  }
}

/**
 * Middleware RBAC : vérifie que l'utilisateur authentifié a l'un des rôles requis.
 * Les admins (role='admin') peuvent accéder à tout.
 * Usage : router.get("/", requireAuth, requireRole("client"), handler)
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.auth?.role ?? "member";
    // Admins ont accès à tout
    if (role === "admin" || roles.includes(role)) {
      next();
      return;
    }
    res.status(403).json({ error: "Accès refusé — rôle insuffisant" });
  };
}
