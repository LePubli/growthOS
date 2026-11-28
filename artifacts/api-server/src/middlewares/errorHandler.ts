import { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";
import { prospectIdentityConstraint } from "../lib/prospect-identity";
import { recordDiagnosticEvent, errorDiagnosticDetails, safeDiagnosticText } from '../lib/diagnostics';

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
  const constraint = prospectIdentityConstraint(err);
  const identityDuplicate = constraint?.startsWith("idx_prospects_") ?? false;
  const identityMismatch = constraint === "prospects_identity_consistency";
  const statusCode =
    identityDuplicate || identityMismatch ? 409 : (err.statusCode ?? 500);
  const traceId = req.traceId ?? "unknown";
  const timestamp = new Date().toISOString();

  logger[identityDuplicate||identityMismatch?'warn':'error'](
    {
      traceId,
      statusCode,
      method: req.method,
      path: req.path,
      error: safeDiagnosticText(err.message, 500),
      stack: safeDiagnosticText(err.stack, 2500),
      // Never log the request body: it may contain passwords, provider keys or PII.
    },
    "Unhandled error",
  );

  if (req.auth?.tenantId) void recordDiagnosticEvent({
    tenantId: req.auth.tenantId, userId: req.auth.userId, traceId,
    level: identityDuplicate||identityMismatch?'warn':'error', component: 'api', code: identityDuplicate?'CRM_IDENTITY_DUPLICATE':identityMismatch?'CRM_IDENTITY_INCONSISTENT':'UNHANDLED_EXCEPTION',
    message: `Exception HTTP ${statusCode}`,
    details: { method: req.method, statusCode, ...errorDiagnosticDetails(err) },
  });

  const message = identityDuplicate
    ? `Ce ${constraint!.endsWith("siret") ? "SIRET" : "SIREN"} est déjà utilisé par une fiche prospect de votre agence. Consultez la fiche existante avant de poursuivre.`
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
