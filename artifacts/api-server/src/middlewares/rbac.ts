import { Request, Response, NextFunction } from "express";
import { rbacService } from "../lib/rbac/RBACService";

/**
 * requirePermission — vérifie qu'un utilisateur possède une permission RBAC.
 * Les admins ont toujours accès (bypass).
 */
export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const auth = req.auth;
    if (!auth) { res.status(401).json({ error: "Non authentifié" }); return; }

    // Les admins (et "owner" normalisé) ont toujours toutes les permissions
    if (auth.role === "admin" || auth.role === "owner") { next(); return; }
    // Note: "owner" est normalisé en "admin" par normalizeRole() dans requireRole()

    try {
      const ok = await rbacService.hasPermission(auth.userId, permission);
      if (!ok) {
        res.status(403).json({ error: `Permission requise : ${permission}` });
        return;
      }
      next();
    } catch {
      res.status(500).json({ error: "Erreur vérification des permissions" });
    }
  };
}

/**
 * requireRole — vérifie que le rôle JWT de l'utilisateur est dans la liste.
 */
export function requireRBACRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const auth = req.auth;
    if (!auth) { res.status(401).json({ error: "Non authentifié" }); return; }
    if (!roles.includes(auth.role ?? "")) {
      res.status(403).json({ error: `Rôle requis : ${roles.join(" ou ")}` });
      return;
    }
    next();
  };
}
