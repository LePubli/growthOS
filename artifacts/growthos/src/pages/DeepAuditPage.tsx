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
  healthScore: number;
  backend: {
    routesTested: number;
    routesOk: number;
    routes4xx: number;
    routes5xx: number;
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

function HealthGauge({ score }: { score: number }) {
  const color = score >= 80 ? '#059669' : score >= 60 ? '#D97706' : '#DC2626';
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Attention requise' : 'Problèmes détectés';
  const circumference = 2 * Math.PI * 52;
  const offset = circumference - (score / 100) * circumference;

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
          <span style={{ fontSize: 30, fontWeight: 900, color }}>{score}</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>/100</span>
        </div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color }}>{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: number }) {
  const color = status === 0 ? '#6B7280' : status < 400 ? '#059669' : status < 500 ? '#D97706' : '#DC2626';
  const bg = status === 0 ? '#F9FAFB' : status < 400 ? '#ECFDF5' : status < 500 ? '#FEF3C7' : '#FEF2F2';
  return (
    <span style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, color, background: bg, fontFamily: 'monospace' }}>
      {status === 0 ? 'ERR' : status}
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

  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['deep-audit'],
    queryFn: () => apiClient.get('/audit/deep') as Promise<{ cached: boolean; report: DeepAuditReport }>,
    enabled: false,
  });

  const runAuditMutation = useMutation({
    mutationFn: () => apiClient.get('/audit/deep?force=true') as Promise<{ cached: boolean; report: DeepAuditReport }>,
    onSuccess: (d) => {
      qc.setQueryData(['deep-audit'], d);
      toast.success(`Audit terminé — score : ${d.report.healthScore}/100 (${d.report.durationMs}ms)`);
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

  const report = data?.report ?? runAuditMutation.data?.report;
  const isRunning = runAuditMutation.isPending;

  return (
    <div style={{ minHeight: '100vh', padding: 24, background: 'var(--body-bg)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Audit Système Profond</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '2px 0 0' }}>
            Scanne réellement tous les routes HTTP, les tables DB et les plugins
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => autoFixMutation.mutate()}
            disabled={autoFixMutation.isPending || isRunning}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: '1px solid #D97706', background: '#FEF3C7', color: '#D97706', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: autoFixMutation.isPending ? .6 : 1 }}>
            {autoFixMutation.isPending ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Wrench size={13} />}
            Auto-fix
          </button>
          <button
            onClick={() => runAuditMutation.mutate()}
            disabled={isRunning}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: isRunning ? 'default' : 'pointer', opacity: isRunning ? .7 : 1 }}>
            {isRunning ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />Analyse…</> : <><Zap size={13} />Lancer l'audit</>}
          </button>
        </div>
      </div>

      {!report && !isRunning && (
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
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Appels HTTP réels sur toutes les routes · Scan des {20} tables DB · Vérification des plugins</p>
        </div>
      )}

      {report && !isRunning && (
        <>
          {/* Score + stats strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16, marginBottom: 20, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: 20, alignItems: 'center' }}>
            <HealthGauge score={report.healthScore} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
              {[
                { l: 'Routes testées', v: report.backend.routesTested, color: 'var(--color-primary)', bg: '#EEF2FF', icon: <Globe size={13}/> },
                { l: 'Routes OK', v: report.backend.routesOk, color: '#059669', bg: '#ECFDF5', icon: <CheckCircle size={13}/> },
                { l: 'Erreurs 5xx', v: report.backend.routes5xx, color: report.backend.routes5xx > 0 ? '#DC2626' : '#6B7280', bg: report.backend.routes5xx > 0 ? '#FEF2F2' : '#F9FAFB', icon: <XCircle size={13}/> },
                { l: 'Latence moy.', v: `${report.backend.avgLatencyMs}ms`, color: '#D97706', bg: '#FEF3C7', icon: <Clock size={13}/> },
                { l: 'Tables OK', v: `${report.database.tablesOk}/${report.database.tablesOk + report.database.tablesMissing.length}`, color: '#059669', bg: '#ECFDF5', icon: <Database size={13}/> },
                { l: 'Plugins actifs', v: report.plugins.active, color: '#4F46E5', bg: '#EEF2FF', icon: <Puzzle size={13}/> },
                { l: 'Total lignes DB', v: report.database.totalRows.toLocaleString(), color: 'var(--text-secondary)', bg: 'var(--body-bg)', icon: <Database size={13}/> },
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

          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
            Audit du {new Date(report.timestamp).toLocaleString('fr-FR')} {data?.cached && '— (résultat mis en cache, cliquez "Lancer" pour relancer)'}
          </div>

          {/* Broken routes */}
          <CollapsibleSection title="Routes en erreur (5xx / timeout)" icon={<XCircle size={16}/>}
            count={report.backend.brokenRoutes.length}
            countColor={report.backend.brokenRoutes.length > 0 ? '#DC2626' : '#059669'}
            defaultOpen={report.backend.brokenRoutes.length > 0}>
            {report.backend.brokenRoutes.length === 0 ? (
              <div style={{ paddingTop: 14, display: 'flex', alignItems: 'center', gap: 8, color: '#059669', fontSize: 13 }}>
                <CheckCircle size={16} />Toutes les routes répondent correctement
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
                      <td style={{ padding: '8px 10px' }}><StatusBadge status={r.status} /></td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{r.latencyMs}ms</td>
                      <td style={{ padding: '8px 10px', color: '#DC2626', maxWidth: 280, fontSize: 11 }}>{r.error ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CollapsibleSection>

          {/* DB tables */}
          <CollapsibleSection title="État des tables DB" icon={<Database size={16}/>}
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
                        <td style={{ padding: '7px 10px' }}><StatusBadge status={r.status} /></td>
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
