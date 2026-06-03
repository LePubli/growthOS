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
  const statusCode = err.statusCode ?? 500;
  const traceId = req.traceId ?? "unknown";
  const timestamp = new Date().toISOString();

  logger.error({
    traceId,
    statusCode,
    method: req.method,
    path: req.path,
    error: err.message,
    stack: err.stack,
    body: req.body && Object.keys(req.body ?? {}).length ? req.body : undefined,
  }, "Unhandled error");

  const message =
    statusCode < 500 || err.expose
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
