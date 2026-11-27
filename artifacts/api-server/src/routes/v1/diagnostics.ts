import { Router } from 'express';
import { pool } from '@workspace/db';
import { requireRole } from '../../middlewares/auth';
import { recordDiagnosticEvent, safeDiagnosticDetails, safeDiagnosticText } from '../../lib/diagnostics';
import { diagnoseSourceIssue } from '../../lib/source-diagnosis';

const router = Router();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clientRate = new Map<string, { count: number; start: number }>();

// Authenticated customers can report a frontend failure without admin read access.
router.post('/client-events', async (req, res) => {
  const key = `${req.auth!.tenantId}:${req.auth!.userId}`;
  const now = Date.now();
  if (clientRate.size > 2000) clientRate.clear();
  const current = clientRate.get(key);
  const rate = !current || now - current.start > 60_000 ? { count: 0, start: now } : current;
  rate.count++;
  clientRate.set(key, rate);
  if (rate.count > 15) { res.status(429).json({ message: 'Trop de rapports envoyés.' }); return; }
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  if (typeof body.code !== 'string' || body.code.length > 80 ||
      typeof body.message !== 'string' || body.message.length > 400 ||
      (body.details !== undefined && (typeof body.details !== 'object' || Array.isArray(body.details)))) {
    res.status(400).json({ message: 'Format de diagnostic invalide.' }); return;
  }
  await recordDiagnosticEvent({
    tenantId: req.auth!.tenantId, userId: req.auth!.userId,
    level: 'error', component: 'frontend', code: body.code,
    message: body.message, details: body.details || {},
  });
  res.status(202).json({ accepted: true });
});

router.use(requireRole('admin'));

function eventFilters(query: Record<string, unknown>, tenantId: string) {
  const args: unknown[] = [tenantId];
  const where = ['tenant_id=$1'];
  const add = (column: string, value: unknown, valid: (v: string) => boolean) => {
    if (typeof value === 'string' && valid(value)) {
      args.push(value); where.push(`${column}=$${args.length}`);
    }
  };
  add('level', query.level, v => ['info', 'warn', 'error'].includes(v));
  add('component', query.component, v => /^[a-z0-9_-]{1,60}$/i.test(v));
  add('source', query.source, v => /^[a-z0-9_-]{1,60}$/i.test(v));
  add('prospect_id', query.prospectId, v => uuid.test(v));
  add('job_id', query.jobId, v => uuid.test(v));
  const days = Math.max(1, Math.min(90, Number(query.days) || 7));
  args.push(days); where.push(`created_at >= NOW() - ($${args.length}::integer * INTERVAL '1 day')`);
  if (typeof query.search === 'string' && query.search.trim().length > 0) {
    args.push(`%${query.search.trim().slice(0, 80).replace(/[\\%_]/g, '\\$&')}%`);
    where.push(`(code ILIKE $${args.length} OR message ILIKE $${args.length} OR trace_id ILIKE $${args.length})`);
  }
  return { sql: where.join(' AND '), args, days };
}

router.get('/summary', async (req, res) => {
  const tenant = req.auth!.tenantId;
  const [levels, components, totals] = await Promise.all([
    pool.query(`SELECT level,COUNT(*)::int AS count FROM diagnostic_events WHERE tenant_id=$1 AND created_at > NOW()-INTERVAL '24 hours' GROUP BY level`, [tenant]),
    pool.query(`SELECT component,COUNT(*)::int AS count FROM diagnostic_events WHERE tenant_id=$1 AND created_at > NOW()-INTERVAL '24 hours' GROUP BY component ORDER BY count DESC`, [tenant]),
    pool.query(`SELECT COUNT(*) FILTER(WHERE created_at > NOW()-INTERVAL '24 hours')::int AS last_24h,
      COUNT(*) FILTER(WHERE created_at > NOW()-INTERVAL '7 days')::int AS last_7d FROM diagnostic_events WHERE tenant_id=$1 AND created_at > NOW()-INTERVAL '7 days'`, [tenant]),
  ]);
  res.json({ levels: levels.rows, components: components.rows, totals: totals.rows[0], generatedAt: new Date().toISOString() });
});

router.get('/events', async (req, res) => {
  const { sql, args } = eventFilters(req.query, req.auth!.tenantId);
  const page = Math.max(1, Math.min(10000, Number(req.query.page) || 1));
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 40));
  const [count, rows] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS count FROM diagnostic_events WHERE ${sql}`, args),
    pool.query(`SELECT * FROM diagnostic_events WHERE ${sql} ORDER BY created_at DESC,id DESC LIMIT $${args.length + 1} OFFSET $${args.length + 2}`,
      [...args, limit, (page - 1) * limit]),
  ]);
  res.json({ events: rows.rows, total: count.rows[0].count, page, limit });
});

async function recentJobs(tenant: string, days: number) {
  const [cloud, enrich] = await Promise.all([
    pool.query(`SELECT j.id,j.prospect_id,j.status,j.error,j.created_at,j.updated_at,p.source
      FROM cloud_browser_jobs j LEFT JOIN cloud_browser_profiles p ON p.id=j.profile_id AND p.tenant_id=j.tenant_id
      WHERE j.tenant_id=$1 AND j.created_at>NOW()-($2::integer*INTERVAL '1 day')
      ORDER BY j.updated_at DESC LIMIT 120`, [tenant, days]),
    pool.query(`SELECT id,prospect_id,status,steps,created_at,updated_at FROM prospect_enrichment_jobs
      WHERE tenant_id=$1 AND created_at>NOW()-($2::integer*INTERVAL '1 day') ORDER BY updated_at DESC LIMIT 120`, [tenant, days]),
  ]);
  return [
    ...cloud.rows.map(j => ({ type: 'cloud', id: j.id, prospectId: j.prospect_id, status: j.status,
      source: j.source, message: safeDiagnosticText(j.error || ''), diagnosis: ['failed','awaiting_user','needs_review'].includes(j.status)?diagnoseSourceIssue({source:j.source,status:j.status,reason:j.error}):null, createdAt: j.created_at, updatedAt: j.updated_at })),
    ...enrich.rows.map(j => ({ type: 'enrichment', id: j.id, prospectId: j.prospect_id, status: j.status,
      sources: Object.entries(j.steps || {}).map(([source, step]) => ({ source, status: (step as any).status,
        message: safeDiagnosticText((step as any).message || '', 220),
        diagnosis: ['failed','needs_review','awaiting_user','empty','skipped'].includes((step as any).status)?diagnoseSourceIssue({source,status:(step as any).status,reason:(step as any).message}):null })), createdAt: j.created_at, updatedAt: j.updated_at })),
  ].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
}

router.get('/jobs', async (req, res) => {
  const days = Math.max(1, Math.min(90, Number(req.query.days) || 7));
  res.json({ jobs: await recentJobs(req.auth!.tenantId, days) });
});

router.get('/sources', async (req, res) => {
  const tenant = req.auth!.tenantId;
  const days = Math.max(1, Math.min(90, Number(req.query.days) || 7));
  const [cloud, enrich] = await Promise.all([
    pool.query(`SELECT p.source, COUNT(*)::int AS runs,
      COUNT(*) FILTER(WHERE j.status IN ('failed','needs_review','awaiting_user'))::int AS issues,
      MAX(j.updated_at) AS last_seen,
      MAX(j.updated_at) FILTER(WHERE j.status IN ('failed','needs_review','awaiting_user')) AS last_issue_at,
      (ARRAY_AGG(j.error ORDER BY j.updated_at DESC) FILTER(WHERE j.error IS NOT NULL))[1] AS last_reason
      FROM cloud_browser_jobs j JOIN cloud_browser_profiles p ON p.id=j.profile_id AND p.tenant_id=j.tenant_id
      WHERE j.tenant_id=$1 AND j.created_at > NOW()-($2::integer*INTERVAL '1 day') GROUP BY p.source`, [tenant, days]),
    pool.query(`SELECT step.key AS source, COUNT(*)::int AS runs,
      COUNT(*) FILTER(WHERE step.value->>'status' IN ('failed','needs_review','awaiting_user'))::int AS issues,
      MAX(j.updated_at) AS last_seen,
      MAX(j.updated_at) FILTER(WHERE step.value->>'status' IN ('failed','needs_review','awaiting_user')) AS last_issue_at,
      (ARRAY_AGG(step.value->>'message' ORDER BY j.updated_at DESC)
        FILTER(WHERE step.value->>'status' IN ('failed','needs_review','awaiting_user')))[1] AS last_reason
      FROM prospect_enrichment_jobs j CROSS JOIN LATERAL jsonb_each(j.steps) AS step
      WHERE j.tenant_id=$1 AND j.created_at > NOW()-($2::integer*INTERVAL '1 day')
        AND step.value->>'status' <> 'pending' GROUP BY step.key`, [tenant, days]),
  ]);
  const bySource = new Map<string, { source: string; runs: number; issues: number; lastSeen: string; lastIssueAt: string | null; lastReason: string; diagnosis: ReturnType<typeof diagnoseSourceIssue> | null }>();
  for (const row of [...cloud.rows, ...enrich.rows]) {
    const before = bySource.get(row.source);
    const lastSeen = before && +new Date(before.lastSeen) > +new Date(row.last_seen) ? before.lastSeen : row.last_seen;
    const lastIssueAt = before?.lastIssueAt && (!row.last_issue_at || +new Date(before.lastIssueAt) > +new Date(row.last_issue_at)) ? before.lastIssueAt : row.last_issue_at;
    const lastReason = before && lastIssueAt === before.lastIssueAt ? before.lastReason : row.last_reason;
    const issues = (before?.issues || 0) + row.issues;
    bySource.set(row.source, { source: row.source, runs: (before?.runs || 0) + row.runs,
      issues, lastSeen, lastIssueAt, lastReason: safeDiagnosticText(lastReason || '', 220),
      diagnosis: issues ? diagnoseSourceIssue({source:row.source,reason:lastReason}) : null });
  }
  res.json({ sources: [...bySource.values()].sort((a,b) => b.issues-a.issues || b.runs-a.runs) });
});

router.get('/export', async (req, res) => {
  const { sql, args, days } = eventFilters(req.query, req.auth!.tenantId);
  const [events, jobs] = await Promise.all([
    pool.query(`SELECT id,trace_id,level,component,code,message,source,prospect_id,job_id,details,created_at
      FROM diagnostic_events WHERE ${sql} ORDER BY created_at DESC LIMIT 500`, args),
    recentJobs(req.auth!.tenantId, days),
  ]);
  res.set('Content-Disposition', `attachment; filename="growthos-diagnostic-${new Date().toISOString().slice(0, 10)}.json"`);
  res.set('Cache-Control', 'no-store');
  res.json({ schemaVersion: 1, generatedAt: new Date().toISOString(), windowDays: days,
    diagnosticEvents: events.rows.map(event => ({ ...event, details: safeDiagnosticDetails(event.details) })), jobs,
    note: 'Rapport technique anonymisé : aucune capture, cookie, clé, requête client ou corps HTTP.' });
});

export default router;
