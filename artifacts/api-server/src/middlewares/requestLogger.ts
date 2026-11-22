import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { logger } from "../lib/logger";

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
  });

  next();
}
