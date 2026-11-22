import type { NextFunction, Request, Response } from "express";

/**
 * Tenant administrators must not be able to edit global billing plans or
 * inspect other tenants. Platform operators are explicitly allowlisted.
 * Empty allowlist means deny all platform-wide administration.
 */
export function isPlatformAdmin(req: Request): boolean {
  if (req.auth?.role === "platform_admin") return true;
  const email = req.auth?.email?.toLowerCase();
  if (!email || req.auth?.role !== "admin") return false;

  const allowlist = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email);
}

export function requirePlatformAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!isPlatformAdmin(req)) {
    res.status(403).json({ error: "Accès réservé à l'administration de la plateforme" });
    return;
  }
  next();
}
