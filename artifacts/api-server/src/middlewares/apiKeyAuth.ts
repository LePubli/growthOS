import { Request, Response, NextFunction } from "express";
import { ApiKeyService } from "../lib/api/ApiKeyService";

declare global {
  namespace Express {
    interface Request {
      apiKey?: { keyId: string; tenantId: string; scopes: string[] };
    }
  }
}

/**
 * Middleware d'authentification par clé API.
 * Alternative à requireAuth (JWT). Accepte : Authorization: Bearer gos_<key>
 * Applique le rate limiting par clé.
 */
export async function apiKeyAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  const raw =
    header?.startsWith("Bearer gos_") ? header.slice(7) : null;

  if (!raw) {
    res.status(401).json({ error: "Clé API manquante (Bearer gos_...)" });
    return;
  }

  const validated = await ApiKeyService.validateApiKey(raw);
  if (!validated) {
    res.status(401).json({ error: "Clé API invalide ou révoquée" });
    return;
  }

  // Rate limiting
  if (!ApiKeyService.checkRateLimit(validated.keyId)) {
    res.status(429).json({
      error: "Rate limit dépassé",
      message: "Maximum 100 requêtes/minute par clé API",
      retry_after: 60,
    });
    return;
  }

  // Injecter dans req pour les routes en aval
  req.apiKey = validated;
  req.auth = {
    userId: "api-key",
    tenantId: validated.tenantId,
    email: "api@growthos.app",
  };
  req.tenantId = validated.tenantId;

  next();
}

/** Vérifie qu'une scope est présente */
export function requireScope(scope: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.apiKey?.scopes.includes(scope) && !req.apiKey?.scopes.includes("admin")) {
      res.status(403).json({ error: `Scope manquant: ${scope}` });
      return;
    }
    next();
  };
}
