import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ShieldCheck, AlertTriangle, XCircle, RefreshCw, Wrench, Database, Globe, Puzzle, Clock, CheckCircle, ChevronDown, ChevronRight, Zap } from 'lucide-react';
import apiClient from '@/lib/api-client';

interface RouteAuditResult {
  plugin: string;
  method: string;
  route: string;
  status: number;
  latencyMs: number;
  error?: string;
  passed: boolean;
  auth: boolean;
}

interface TableAuditResult {
  table: string;
  exists: boolean;
  rowCount: number | null;
  error?: string;
}

interface DeepAuditReport {
  timestamp: string;
  healthScore: number | null;
  assessment: 'partial' | 'complete';
  backend: {
    routesDiscovered: number;
    routesTested: number;
    routesSkipped: number;
    coveragePct: number;
    routesByMethod: Record<string, number>;
    untestedRoutes: { method: string; route: string; reason: string }[];
    moduleCoverage: { module: string; total: number; tested: number; errors: number }[];
    routesOk: number;
    routes4xx: number;
    routes5xx: number;
    contractErrors: number;
    avgLatencyMs: number;
    brokenRoutes: RouteAuditResult[];
    allRoutes: RouteAuditResult[];
  };
  database: {
    tablesOk: number;
    tablesMissing: string[];
    tables: TableAuditResult[];
    totalRows: number;
  };
  plugins: {
    active: number;
    disabled: number;
    error: number;
    uploaded: number;
    list: { id: string; name: string; state: string; error?: string }[];
  };
  durationMs: number;
}

type AuditResponse =
  | { status: 'idle' }
  | { status: 'running'; startedAt: number; progress: { completed: number; total: number } }
  | { status: 'failed'; error: string }
  | { status: 'complete'; cached: boolean; report: DeepAuditReport };

function HealthGauge({ score }: { score: number | null }) {
  const partial = score === null;
  const color = partial ? '#D97706' : score >= 80 ? '#059669' : score >= 60 ? '#D97706' : '#DC2626';
  const label = partial ? 'Non certifié' : score >= 80 ? 'Excellent' : score >= 60 ? 'Attention requise' : 'Problèmes détectés';
  const circumference = 2 * Math.PI * 52;
  const offset = circumference - ((score ?? 0) / 100) * circumference;

  return (
    <div style={{ textAlign: 'center', padding: '8px 0' }}>
      <div style={{ position: 'relative', width: 130, height: 130, margin: '0 auto 10px' }}>
        <svg width="130" height="130" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="65" cy="65" r="52" fill="none" stroke="var(--card-border)" strokeWidth="10" />
          <circle cx="65" cy="65" r="52" fill="none" stroke={color} strokeWidth="10"
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: partial ? 22 : 30, fontWeight: 900, color }}>{partial ? '—' : score}</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{partial ? 'audit partiel' : '/100'}</span>
        </div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color }}>{label}</div>
    </div>
  );
}

function StatusBadge({ status, passed }: { status: number; passed?: boolean }) {
  const isOk    = status >= 200 && status < 400 && passed !== false;
  const isAuth  = status === 401 || status === 403;
  const isErr   = status === 0 || status >= 404;
  const color   = isOk ? '#059669' : isAuth ? '#D97706' : '#DC2626';
  const bg      = isOk ? '#ECFDF5' : isAuth ? '#FEF3C7' : '#FEF2F2';
  const icon    = isOk ? '✅' : isAuth ? '⚠️' : '❌';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, color, background: bg, fontFamily: 'monospace' }}>
      <span style={{ fontSize: 9 }}>{icon}</span>{status === 0 ? 'ERR' : status}
    </span>
  );
}

function CollapsibleSection({ title, icon, count, countColor, children, defaultOpen = false }: {
  title: string; icon: React.ReactNode; count?: number; countColor?: string;
  children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, overflow: 'hidden', marginBottom: 14 }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--text-muted)' }}>{icon}</span>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{title}</span>
          {count !== undefined && (
            <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 20, background: countColor ? `${countColor}18` : 'var(--body-bg)', color: countColor ?? 'var(--text-muted)', fontWeight: 700, border: `1px solid ${countColor ?? 'var(--card-border)'}44` }}>
              {count}
            </span>
          )}
        </div>
        {open ? <ChevronDown size={15} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={15} style={{ color: 'var(--text-muted)' }} />}
      </button>
      {open && <div style={{ borderTop: '1px solid var(--card-border)', padding: '0 18px 18px' }}>{children}</div>}
    </div>
  );
}

export default function DeepAuditPage() {
  const qc = useQueryClient();
  const [showAllRoutes, setShowAllRoutes] = useState(false);
  const [showAllUntested, setShowAllUntested] = useState(false);

  const { data, isError, error } = useQuery({
    queryKey: ['deep-audit'],
    queryFn: () => apiClient.get('/audit/deep') as Promise<AuditResponse>,
    refetchInterval: query => query.state.data?.status === 'running' ? 2500 : false,
    retry: false,
  });

  const runAuditMutation = useMutation({
    mutationFn: () => apiClient.get('/audit/deep?force=true') as Promise<AuditResponse>,
    onSuccess: (d) => {
      qc.setQueryData(['deep-audit'], d);
      if (d.status === 'running') toast.info('Audit lancé : la progression s’actualise automatiquement.');
    },
    onError: (err: any) => toast.error(`Audit échoué : ${err?.message ?? 'Erreur inconnue'}`),
  });

  const autoFixMutation = useMutation({
    mutationFn: () => apiClient.post('/audit/auto-fix', {}) as Promise<{ fixed: string[]; failed: string[] }>,
    onSuccess: (d) => {
      const total = d.fixed.length + d.failed.length;
      if (d.failed.length > 0) toast.warning(`Auto-fix : ${d.fixed.length} réparés, ${d.failed.length} échoués`);
      else toast.success(`Auto-fix : ${d.fixed.length} action(s) effectuée(s)`);
      if (total > 0) runAuditMutation.mutate();
    },
    onError: (err: any) => toast.error(`Auto-fix échoué : ${err?.message ?? 'Erreur inconnue'}`),
  });

  const report = data?.status === 'complete' ? data.report : undefined;
  const isRunning = runAuditMutation.isPending || data?.status === 'running';

  return (
    <div style={{ minHeight: '100vh', padding: '16px clamp(16px,3vw,28px)', background: 'var(--body-bg)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Santé technique · contrôle partiel</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '2px 0 0' }}>
            Inventaire complet des routes et contrôles techniques limités aux lectures sûres (aucune action métier exécutée)
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => runAuditMutation.mutate()}
            disabled={isRunning}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: isRunning ? 'default' : 'pointer', opacity: isRunning ? .7 : 1 }}>
            {isRunning ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />Analyse…</> : <><Zap size={13} />Lancer l'audit</>}
          </button>
        </div>
      </div>

      {data?.status === 'failed' && !isRunning && (
        <div role="alert" style={{ color: '#DC2626', padding: '12px 18px', marginBottom: 18, background: '#FEF2F2', borderRadius: 10 }}>
          Échec de l'audit : {data.error}. Consultez les logs du conteneur API avant de relancer.
        </div>
      )}

      {isError && !isRunning && (
        <div role="alert" style={{ color: '#DC2626', padding: '12px 18px', marginBottom: 18, background: '#FEF2F2', borderRadius: 10 }}>
          Impossible de consulter l'audit : {error instanceof Error ? error.message : 'Erreur réseau'}.
        </div>
      )}

      {!report && !isRunning && data?.status !== 'failed' && (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <ShieldCheck size={48} style={{ margin: '0 auto 16px', display: 'block', opacity: .2 }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Aucun rapport disponible</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Cliquez sur "Lancer l'audit" pour scanner l'application en temps réel</p>
          <button onClick={() => runAuditMutation.mutate()} style={{ padding: '10px 24px', borderRadius: 12, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Zap size={16} />Lancer le premier audit
          </button>
        </div>
      )}

      {isRunning && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#EEF2FF', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RefreshCw size={26} style={{ color: 'var(--color-primary)', animation: 'spin 1s linear infinite' }} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Audit en cours…</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Lectures HTTP sans écriture, une par une · Tables SQL · Inventaire des plugins</p>
          {data?.status === 'running' && data.progress.total > 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Routes vérifiées : {data.progress.completed} / {data.progress.total}</p>
          )}
        </div>
      )}

      {report && !isRunning && (
        <>
          {/* Score + stats strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16, marginBottom: 20, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: 20, alignItems: 'center' }}>
            <HealthGauge score={report.healthScore} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
              {[
                { l: 'Routes recensées', v: report.backend.routesDiscovered, color: 'var(--color-primary)', bg: '#EEF2FF', icon: <Globe size={13}/> },
                { l: 'Routes vérifiées', v: report.backend.routesTested, color: '#4F46E5', bg: '#EEF2FF', icon: <CheckCircle size={13}/> },
                { l: 'Non testées', v: report.backend.routesSkipped, color: '#92400E', bg: '#FFFBEB', icon: <AlertTriangle size={13}/> },
                { l: 'Couverture API', v: `${report.backend.coveragePct}%`, color: '#92400E', bg: '#FFFBEB', icon: <Globe size={13}/> },
                { l: 'Lectures OK', v: report.backend.routesOk, color: '#059669', bg: '#ECFDF5', icon: <CheckCircle size={13}/> },
                { l: 'Réponses 4xx', v: report.backend.routes4xx, color: '#92400E', bg: '#FFFBEB', icon: <AlertTriangle size={13}/> },
                { l: 'Erreurs 5xx', v: report.backend.routes5xx, color: report.backend.routes5xx > 0 ? '#DC2626' : '#6B7280', bg: report.backend.routes5xx > 0 ? '#FEF2F2' : '#F9FAFB', icon: <XCircle size={13}/> },
                { l: 'Contrats invalides', v: report.backend.contractErrors, color: report.backend.contractErrors > 0 ? '#DC2626' : '#6B7280', bg: report.backend.contractErrors > 0 ? '#FEF2F2' : '#F9FAFB', icon: <XCircle size={13}/> },
                { l: 'Latence moy.', v: `${report.backend.avgLatencyMs}ms`, color: '#D97706', bg: '#FEF3C7', icon: <Clock size={13}/> },
                { l: 'Tables clés accessibles', v: `${report.database.tablesOk}/${report.database.tablesOk + report.database.tablesMissing.length}`, color: '#059669', bg: '#ECFDF5', icon: <Database size={13}/> },
                { l: 'Plugins activés (non exécutés)', v: report.plugins.active, color: '#4F46E5', bg: '#EEF2FF', icon: <Puzzle size={13}/> },
                { l: 'Lignes (tables clés)', v: report.database.totalRows.toLocaleString(), color: 'var(--text-secondary)', bg: 'var(--body-bg)', icon: <Database size={13}/> },
                { l: 'Durée audit', v: `${report.durationMs}ms`, color: 'var(--text-secondary)', bg: 'var(--body-bg)', icon: <Clock size={13}/> },
              ].map((k, i) => (
                <div key={i} style={{ background: k.bg, borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ color: k.color, marginTop: 1 }}>{k.icon}</span>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: k.color }}>{k.v}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>{k.l}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div role="status" style={{ marginBottom: 16, padding: '12px 16px', border: '1px solid #FDE68A', background: '#FFFBEB', borderRadius: 10, color: '#92400E', fontSize: 12 }}>
            <strong>Audit non certifié :</strong> {report.backend.routesTested} routes vérifiées sur {report.backend.routesDiscovered} ({report.backend.coveragePct}%).
            Les {report.backend.routesSkipped} autres routes (dont les créations, modifications, suppressions, exports et lectures non qualifiées) n’ont pas été exécutées.
            Des réponses HTTP 200 ne prouvent pas que les parcours utilisateurs, les agents IA, les emails ou les plugins fonctionnent de bout en bout.
            <div style={{ marginTop: 6 }}>Inventaire par méthode : {Object.entries(report.backend.routesByMethod).map(([method, count]) => `${method} ${count}`).join(' · ')}.</div>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
            Audit du {new Date(report.timestamp).toLocaleString('fr-FR')} {data?.status === 'complete' && data.cached && '— (résultat mis en cache, cliquez "Lancer" pour relancer)'}
          </div>

          {/* Broken routes / response contracts */}
          <CollapsibleSection title="Échecs de contrôles (HTTP / contrat JSON / timeout)" icon={<XCircle size={16}/>}
            count={report.backend.brokenRoutes.length}
            countColor={report.backend.brokenRoutes.length > 0 ? '#DC2626' : '#059669'}
            defaultOpen={report.backend.brokenRoutes.length > 0}>
            {report.backend.brokenRoutes.length === 0 ? (
              <div style={{ paddingTop: 14, display: 'flex', alignItems: 'center', gap: 8, color: '#059669', fontSize: 13 }}>
                <CheckCircle size={16} />Aucun échec sur les routes effectivement vérifiées
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 14, fontSize: 12 }}>
                <thead>
                  <tr>
                    {['Plugin','Méthode','Route','Status','Latence','Erreur'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.backend.brokenRoutes.map((r, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--card-border)', background: '#FEF2F2' }}>
                      <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{r.plugin}</td>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 700, color: '#4F46E5' }}>{r.method}</td>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{r.route}</td>
                      <td style={{ padding: '8px 10px' }}><StatusBadge status={r.status} passed={r.passed} /></td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{r.latencyMs}ms</td>
                      <td style={{ padding: '8px 10px', color: '#DC2626', maxWidth: 280, fontSize: 11 }}>{r.error ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CollapsibleSection>

          <CollapsibleSection title="Couverture par module (inventaire / lectures vérifiées)" icon={<Puzzle size={16}/>}
            count={report.backend.moduleCoverage.filter(m => m.tested === 0).length} countColor="#D97706">
            <div style={{ overflowX: 'auto', marginTop: 14 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr>{['Module', 'Routes recensées', 'Vérifiées', 'Erreurs constatées', 'État'].map(h => <th key={h} style={{ textAlign: 'left', padding: 8, color: 'var(--text-muted)' }}>{h}</th>)}</tr></thead>
                <tbody>{report.backend.moduleCoverage.map(m => (
                  <tr key={m.module} style={{ borderTop: '1px solid var(--card-border)' }}>
                    <td style={{ padding: 8, fontWeight: 600 }}>{m.module}</td>
                    <td style={{ padding: 8 }}>{m.total}</td>
                    <td style={{ padding: 8 }}>{m.tested}</td>
                    <td style={{ padding: 8, color: m.errors ? '#DC2626' : 'var(--text-muted)' }}>{m.errors}</td>
                    <td style={{ padding: 8, color: m.tested === 0 ? '#D97706' : '#6B7280' }}>{m.tested === 0 ? 'Non vérifié' : m.tested < m.total ? 'Partiel' : 'Lectures vérifiées'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Routes non testées et raisons" icon={<AlertTriangle size={16}/>}
            count={report.backend.routesSkipped} countColor="#D97706">
            <div style={{ overflowX: 'auto', marginTop: 14 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr>{['Méthode', 'Route', 'Pourquoi non testée'].map(h => <th key={h} style={{ textAlign: 'left', padding: 8, color: 'var(--text-muted)' }}>{h}</th>)}</tr></thead>
                <tbody>{(showAllUntested ? report.backend.untestedRoutes : report.backend.untestedRoutes.slice(0, 40)).map((r, i) => (
                  <tr key={`${r.method}:${r.route}:${i}`} style={{ borderTop: '1px solid var(--card-border)' }}>
                    <td style={{ padding: 8, fontFamily: 'monospace' }}>{r.method}</td>
                    <td style={{ padding: 8, fontFamily: 'monospace' }}>{r.route}</td>
                    <td style={{ padding: 8, color: 'var(--text-muted)' }}>{r.reason}</td>
                  </tr>
                ))}</tbody>
              </table>
              {report.backend.untestedRoutes.length > 40 && (
                <button onClick={() => setShowAllUntested(!showAllUntested)} style={{ marginTop: 10, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  {showAllUntested ? 'Réduire la liste' : `Afficher toutes les ${report.backend.routesSkipped} routes`}
                </button>
              )}
            </div>
          </CollapsibleSection>

          {/* DB tables */}
          <CollapsibleSection title="État des tables DB (absentes ou illisibles)" icon={<Database size={16}/>}
            count={report.database.tablesMissing.length > 0 ? report.database.tablesMissing.length : report.database.tablesOk}
            countColor={report.database.tablesMissing.length > 0 ? '#DC2626' : '#059669'}
            defaultOpen={report.database.tablesMissing.length > 0}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 8, marginTop: 14 }}>
              {report.database.tables.map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 9, background: t.exists ? 'var(--body-bg)' : '#FEF2F2', border: `1px solid ${t.exists ? 'var(--card-border)' : '#FECACA'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    {t.exists ? <CheckCircle size={12} style={{ color: '#059669' }} /> : <XCircle size={12} style={{ color: '#DC2626' }} />}
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: t.exists ? 'var(--text-primary)' : '#DC2626' }}>{t.table}</span>
                  </div>
                  {t.exists && t.rowCount !== null && (
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{t.rowCount.toLocaleString()} lignes</span>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* Plugins */}
          <CollapsibleSection title="État des plugins" icon={<Puzzle size={16}/>}
            count={report.plugins.active}
            countColor="#059669">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 8, marginTop: 14 }}>
              {report.plugins.list.map((p, i) => {
                const color = p.state === 'ACTIVE' ? '#059669' : p.state === 'ERROR' ? '#DC2626' : p.state === 'DISABLED' ? '#6B7280' : '#D97706';
                const bg = p.state === 'ACTIVE' ? '#ECFDF5' : p.state === 'ERROR' ? '#FEF2F2' : p.state === 'DISABLED' ? '#F9FAFB' : '#FEF3C7';
                return (
                  <div key={i} style={{ padding: '8px 12px', borderRadius: 9, background: bg, border: `1px solid ${color}33` }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--text-muted)' }}>{p.id}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color, padding: '1px 6px', borderRadius: 6, background: `${color}18` }}>{p.state}</span>
                    </div>
                    {p.error && <div style={{ fontSize: 10, color: '#DC2626', marginTop: 4 }} title={p.error}>{p.error.slice(0, 60)}</div>}
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>

          {/* All routes */}
          <CollapsibleSection title="Toutes les routes testées" icon={<Globe size={16}/>} count={report.backend.routesTested}>
            <div style={{ marginTop: 14 }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {['Plugin','Méthode','Route','Status','Latence','Auth'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(showAllRoutes ? report.backend.allRoutes : report.backend.allRoutes.slice(0, 20)).map((r, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--card-border)' }}>
                        <td style={{ padding: '7px 10px', color: 'var(--text-muted)' }}>{r.plugin}</td>
                        <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontWeight: 700, fontSize: 11, color: '#4F46E5' }}>{r.method}</td>
                        <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-primary)' }}>{r.route}</td>
                        <td style={{ padding: '7px 10px' }}><StatusBadge status={r.status} passed={r.passed} /></td>
                        <td style={{ padding: '7px 10px', color: r.latencyMs > 1000 ? '#DC2626' : 'var(--text-muted)', fontFamily: 'monospace', fontSize: 11 }}>{r.latencyMs}ms</td>
                        <td style={{ padding: '7px 10px', fontSize: 11, color: r.auth ? '#4F46E5' : 'var(--text-muted)' }}>{r.auth ? '🔒' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!showAllRoutes && report.backend.allRoutes.length > 20 && (
                <button onClick={() => setShowAllRoutes(true)} style={{ marginTop: 10, padding: '7px 18px', borderRadius: 9, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>
                  Voir les {report.backend.allRoutes.length - 20} routes restantes
                </button>
              )}
            </div>
          </CollapsibleSection>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
