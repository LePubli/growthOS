import { pool } from '@workspace/db';
import { logger } from './logger';

export type DiagnosticLevel = 'info' | 'warn' | 'error';
export type DiagnosticEvent = {
  tenantId: string;
  userId?: string | null;
  traceId?: string | null;
  level: DiagnosticLevel;
  component: string;
  code: string;
  message: string;
  source?: string | null;
  prospectId?: string | null;
  jobId?: string | null;
  details?: Record<string, unknown>;
};

// All new modules can emit this shared event. Never persist bodies, credentials,
// source HTML, captures or customer content in this operational diagnostic store.
const forbiddenKey = /token|password|secret|authorization|cookie|credential|api.?key|html|body|headers|screenshot|capture|payload|email|phone|query|search.?term|address/i;
export function safeDiagnosticText(value: unknown, limit = 400): string {
  const raw=String(value??'');
  if(/failed query|\b(?:insert into|select .+ from|update .+ set)\b/i.test(raw))return 'Échec de requête en base (contenu exclu des diagnostics).';
  return raw
    .replace(/https?:\/\/\S+/gi, '[URL]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/\b[A-Za-z0-9_-]{22,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g, '[TOKEN]')
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, '[EMAIL]')
    .replace(/\b(?:\+33|0)[1-9](?:[ .-]?\d{2}){4}\b/g, '[PHONE]')
    .slice(0, limit);
}

export function safeDiagnosticDetails(details: Record<string, unknown> = {}): Record<string, unknown> {
  const walk = (value: unknown, depth: number): unknown => {
    if (depth > 3) return '[TRUNCATED]';
    if (Array.isArray(value)) return value.slice(0, 15).map(v => walk(v, depth + 1));
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).slice(0, 25)
        .filter(([key]) => !forbiddenKey.test(key))
        .map(([key, entry]) => [safeDiagnosticText(key, 60), walk(entry, depth + 1)]));
    }
    if (typeof value === 'string') return safeDiagnosticText(value, 450);
    return typeof value === 'number' || typeof value === 'boolean' ? value : null;
  };
  const clean = walk(details, 0) as Record<string, unknown>;
  // An event should never make diagnostics storage grow without bound.
  return JSON.stringify(clean).length <= 8000 ? clean : { truncated: true, fields: Object.keys(clean).slice(0, 20) };
}

export async function recordDiagnosticEvent(event: DiagnosticEvent): Promise<void> {
  if (!event.tenantId) return;
  try {
    const details = safeDiagnosticDetails(event.details);
    // The same scrubbed business event is available even when DB persistence fails.
    logger[event.level]({tenantId:event.tenantId,traceId:event.traceId||null,component:event.component,
      code:event.code,source:event.source||null,prospectId:event.prospectId||null,jobId:event.jobId||null,details},safeDiagnosticText(event.message));
    await pool.query(`INSERT INTO diagnostic_events
      (tenant_id,user_id,trace_id,level,component,code,message,source,prospect_id,job_id,details)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`, [
      event.tenantId, event.userId || null, event.traceId || null, event.level,
      safeDiagnosticText(event.component, 65), safeDiagnosticText(event.code, 90),
      safeDiagnosticText(event.message, 400), event.source ? safeDiagnosticText(event.source, 65) : null,
      event.prospectId || null, event.jobId || null, JSON.stringify(details),
    ]);
  } catch (error) {
    // Observability must never prevent the underlying business operation.
    logger.warn({ reason: error instanceof Error ? error.name : 'unknown' }, 'Diagnostic persistence unavailable');
  }
}

export function errorDiagnosticDetails(error: unknown): Record<string, unknown> {
  const err = error as { name?: string; message?: string; status?: number; code?: string; cause?: unknown } | null;
  let current:any=err, databaseCode:string|null=null, databaseConstraint:string|null=null;
  for(let depth=0;current&&depth<5;depth++,current=current.cause){
    if(typeof current.code==='string'&&/^[0-9A-Z]{5}$/.test(current.code)){
      databaseCode=current.code;
      // Explicit allowlist: never expose SQL, parameters, a detail or a row value.
      databaseConstraint=['idx_prospects_tenant_siret','idx_prospects_tenant_siren','prospects_identity_consistency'].includes(current.constraint)?current.constraint:null;
      break;
    }
  }
  return {
    errorType: err?.name || 'UnknownError',
    errorCode: databaseCode || (typeof err?.code==='string'&&/^[A-Z0-9_]{2,40}$/.test(err.code)?err.code:null),
    databaseCode,databaseConstraint,
    httpStatus: typeof err?.status === 'number' ? err.status : null,
    reason: databaseCode||/failed query|\b(?:insert into|select .+ from|update .+ set)\b/i.test(err?.message||'')
      ? 'Échec de l’enregistrement en base. Consulter le code technique.' : err?.message || 'Erreur non identifiée',
  };
}

/** 90-day retention, limited batches to avoid prolonged DB locks on busy tenants. */
export function startDiagnosticsRetention(): void {
  if (process.env.GROWTHOS_SMOKE_TEST === 'true') return;
  const prune = () => void pool.query(`DELETE FROM diagnostic_events WHERE id IN (
    SELECT id FROM diagnostic_events WHERE created_at < NOW() - INTERVAL '90 days'
    ORDER BY created_at LIMIT 2000
  )`).catch(error => logger.warn({ reason: error instanceof Error ? error.name : 'unknown' }, 'Diagnostics retention unavailable'));
  prune();
  setInterval(prune, 60 * 60 * 1000).unref();
}
