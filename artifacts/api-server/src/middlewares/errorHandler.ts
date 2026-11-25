import { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

export interface ApiError extends Error {
  statusCode?: number;
  expose?: boolean;
}

/** Central error handler — mount AFTER all routes */
export function errorHandler(
  err: ApiError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Drizzle wraps PostgreSQL exceptions in cause. Never expose raw SQL errors.
  let databaseError: any = err;
  for (let depth = 0; depth < 4 && databaseError?.cause; depth++)
    databaseError = databaseError.cause;
  const identityDuplicate =
    databaseError?.code === "23505" &&
    ["idx_prospects_tenant_siret", "idx_prospects_tenant_siren"].includes(
      databaseError?.constraint,
    );
  const identityMismatch =
    databaseError?.code === "23514" &&
    databaseError?.constraint === "prospects_identity_consistency";
  const statusCode =
    identityDuplicate || identityMismatch ? 409 : (err.statusCode ?? 500);
  const traceId = req.traceId ?? "unknown";
  const timestamp = new Date().toISOString();

  logger.error(
    {
      traceId,
      statusCode,
      method: req.method,
      path: req.path,
      error: err.message,
      stack: err.stack,
      body:
        req.body && Object.keys(req.body ?? {}).length ? req.body : undefined,
    },
    "Unhandled error",
  );

  const message = identityDuplicate
    ? `Ce ${databaseError.constraint.endsWith("siret") ? "SIRET" : "SIREN"} est déjà utilisé par une fiche prospect de votre agence. Consultez la fiche existante avant de poursuivre.`
    : identityMismatch
      ? "Vérifiez les identifiants : SIREN de 9 chiffres, SIRET de 14 chiffres et 9 premiers chiffres identiques."
      : statusCode < 500 || err.expose
        ? err.message
        : "Une erreur interne est survenue.";

  res.status(statusCode).json({
    statusCode,
    message,
    path: req.path,
    timestamp,
    traceId,
  });
}

/** 404 catch-all — mount AFTER all routes, BEFORE errorHandler */
export function notFound(req: Request, res: Response): void {
  res.status(404).json({
    statusCode: 404,
    message: `Route ${req.method} ${req.path} introuvable.`,
    path: req.path,
    timestamp: new Date().toISOString(),
  });
}
