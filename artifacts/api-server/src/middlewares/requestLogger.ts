import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { logger } from "../lib/logger";
import { recordDiagnosticEvent } from "../lib/diagnostics";

declare global {
  namespace Express {
    interface Request {
      traceId?: string;
      startTime?: bigint;
    }
  }
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  req.traceId = randomUUID();
  req.startTime = process.hrtime.bigint();

  logger.info({
    traceId: req.traceId,
    method: req.method,
    path: req.path,
    // Do not log query values: SSE auth tokens and integration credentials
    // may be passed as query parameters by legacy clients.
  }, "→ request");

  res.on("finish", () => {
    const durationMs = req.startTime
      ? Number(process.hrtime.bigint() - req.startTime) / 1_000_000
      : undefined;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

    logger[level]({
      traceId: req.traceId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: durationMs?.toFixed(2),
      // Never log request bodies. Failed login, bootstrap and provider-key
      // requests frequently contain passwords and API secrets.
    }, `← response ${res.statusCode}`);

    // Automatic coverage for every existing AND future Express route. Avoid
    // self-reporting and never persist URL query parameters, request bodies or tokens.
    if (req.auth?.tenantId && !req.path.startsWith('/api/v1/diagnostics') &&
        (res.statusCode >= 400 || (durationMs !== undefined && durationMs >= 3000))) {
      const route = req.path.replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, ':id')
        .replace(/\/[0-9]{4,}(?=\/|$)/g, '/:id').slice(0, 180);
      void recordDiagnosticEvent({
        tenantId: req.auth.tenantId, userId: req.auth.userId, traceId: req.traceId,
        level: res.statusCode >= 500 ? 'error' : 'warn', component: 'api',
        code: res.statusCode >= 400 ? `HTTP_${res.statusCode}` : 'SLOW_REQUEST',
        message: res.statusCode >= 400 ? `Réponse HTTP ${res.statusCode}` : 'Requête lente',
        details: { method: req.method, route, statusCode: res.statusCode, durationMs: Math.round(durationMs || 0) },
      });
    }
  });

  next();
}
