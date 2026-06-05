import { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
    }
  }
}

/**
 * Middleware: extrait tenantId du JWT (req.auth) et l'injecte en req.tenantId.
 * À utiliser après requireAuth sur les routes nécessitant l'isolation multi-tenant.
 */
export function requireTenant(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth?.tenantId) {
    res.status(401).json({ error: "Tenant non identifié" });
    return;
  }
  req.tenantId = req.auth.tenantId;
  next();
}

/**
 * Retourne le tenantId à utiliser dans les clauses WHERE.
 * Throws si absent — ne devrait jamais arriver si requireTenant est appliqué.
 */
export function getTenantScope(req: Request): string {
  const id = req.auth?.tenantId ?? req.tenantId;
  if (!id) throw new Error("getTenantScope: tenantId absent de la requête");
  return id;
}
