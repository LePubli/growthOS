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

function loadJwtSecret(name: string, developmentFallback: string): string {
  const secret = process.env[name];
  if (process.env.NODE_ENV === "production" && (!secret || secret.length < 32)) {
    throw new Error(`${name} must contain at least 32 characters in production`);
  }
  return secret || developmentFallback;
}

export const JWT_SECRET = loadJwtSecret("JWT_SECRET", "growthos-dev-secret-change-in-production");
export const JWT_REFRESH_SECRET = loadJwtSecret("JWT_REFRESH_SECRET", "growthos-refresh-secret-change-in-production");

if (process.env.NODE_ENV === "production" && JWT_SECRET === JWT_REFRESH_SECRET) {
  throw new Error("JWT_SECRET and JWT_REFRESH_SECRET must be different");
}

export function signAccessToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" });
}

export function signRefreshToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: "7d" });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  // URL tokens can leak via browser history and access logs. Keep this legacy
  // transport only for the two GET EventSource endpoints which need it.
  const isSseEndpoint = req.method === "GET" &&
    /^\/api\/v1\/(notifications\/stream|client\/ereputation\/events)$/.test(req.path);
  const raw = header?.startsWith("Bearer ")
    ? header.slice(7)
    : isSseEndpoint && typeof req.query.token === "string" ? req.query.token : null;

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
/** Normalise le rôle "owner" en "admin" pour rétrocompatibilité. */
export function normalizeRole(role?: string): string {
  if (role === "owner") return "admin";
  return role ?? "member";
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = normalizeRole(req.auth?.role);
    // Admins (et "owner" normalisé en admin) ont accès à tout
    if (role === "platform_admin" || role === "admin" || roles.includes(role)) {
      next();
      return;
    }
    res.status(403).json({ error: "Accès refusé — rôle insuffisant" });
  };
}
