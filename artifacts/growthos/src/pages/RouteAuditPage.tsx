import { useState, useMemo, useCallback } from 'react';
import { Shield, Globe, Search, Copy, Check, RefreshCw, AlertCircle, Activity, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

interface RouteEntry { method: string; path: string; auth: boolean; }
interface AuditData {
  total: number;
  byMethod: Record<string, number>;
  authRequired: number;
  public: number;
  routes: RouteEntry[];
  generatedAt: string;
}

type HealthStatus = 'ok' | 'auth' | 'warn' | 'error' | 'skip' | 'pending';
interface HealthResult { status: HealthStatus; code: number | null; ms: number | null; }

const METHOD_COLORS: Record<string, { bg: string; text: string }> = {
  GET:    { bg: '#DBEAFE', text: '#1D4ED8' },
  POST:   { bg: '#D1FAE5', text: '#065F46' },
  PATCH:  { bg: '#FEF3C7', text: '#92400E' },
  PUT:    { bg: '#EDE9FE', text: '#5B21B6' },
  DELETE: { bg: '#FEE2E2', text: '#991B1B' },
};

function statusMeta(s: HealthStatus): { icon: React.ReactNode; color: string; label: string } {
  switch (s) {
    case 'ok':      return { icon: <CheckCircle2 size={11} />, color: '#059669', label: '2xx' };
    case 'auth':    return { icon: <Shield size={11} />,       color: '#2563EB', label: '401' };
    case 'warn':    return { icon: <AlertCircle size={11} />,  color: '#D97706', label: '4xx' };
    case 'error':   return { icon: <XCircle size={11} />,      color: '#DC2626', label: '5xx' };
    case 'pending': return { icon: <Clock size={11} />,        color: '#9CA3AF', label: '…'   };
    default:        return { icon: null,                        color: '#9CA3AF', label: '—'   };
  }
}

function codeToStatus(code: number): HealthStatus {
  if (code >= 200 && code < 300) return 'ok';
  if (code === 401 || code === 403) return 'auth';
  if (code >= 400 && code < 500) return 'warn';
  if (code >= 500) return 'error';
  return 'warn';
}

function MethodBadge({ method }: { method: string }) {
  const c = METHOD_COLORS[method] ?? { bg: '#F3F4F6', text: '#374151' };
  return (
    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800, fontFamily: 'monospace', background: c.bg, color: c.text, flexShrink: 0, letterSpacing: '0.04em' }}>
      {method}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button onClick={copy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 4px', opacity: 0 }} className="copy-btn">
      {copied ? <Check size={11} color="#10B981" /> : <Copy size={11} />}
    </button>
  );
}

/** Returns true if the route has dynamic path segments like :id */
function hasParams(path: string): boolean {
  return path.includes(':') || path.includes('*');
}

export default function RouteAuditPage() {
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [authFilter, setAuthFilter] = useState<'all' | 'auth' | 'public'>('all');
  const [healthMap, setHealthMap] = useState<Record<string, HealthResult>>({});
  const [isChecking, setIsChecking] = useState(false);
  const [checkProgress, setCheckProgress] = useState(0);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<AuditData>({
    queryKey: ['route-audit'],
    queryFn: () => apiClient.get('/route-audit/scan') as Promise<AuditData>,
    staleTime: 30_000,
  });

  const methods = useMemo(() => {
    if (!data) return [];
    return ['ALL', ...Object.keys(data.byMethod).sort()];
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.routes.filter((r) => {
      const q = search.toLowerCase();
      const matchSearch = !q || r.path.toLowerCase().includes(q) || r.method.toLowerCase().includes(q);
      const matchMethod = methodFilter === 'ALL' || r.method === methodFilter;
      const matchAuth = authFilter === 'all' || (authFilter === 'auth' ? r.auth : !r.auth);
      return matchSearch && matchMethod && matchAuth;
    });
  }, [data, search, methodFilter, authFilter]);

  /** Probe all GET routes without dynamic params */
  const runHealthCheck = useCallback(async () => {
    if (!data || isChecking) return;
    const probeRoutes = data.routes.filter(r => r.method === 'GET' && !hasParams(r.path));
    setIsChecking(true);
    setCheckProgress(0);
    const newMap: Record<string, HealthResult> = {};

    // Mark all as pending
    for (const r of probeRoutes) {
      newMap[`${r.method}:${r.path}`] = { status: 'pending', code: null, ms: null };
    }
    setHealthMap({ ...newMap });

    // Probe sequentially to avoid flooding the server
    for (let i = 0; i < probeRoutes.length; i++) {
      const r = probeRoutes[i];
      const key = `${r.method}:${r.path}`;
      const t0 = performance.now();
      try {
        const res = await fetch(r.path.startsWith('/api') ? r.path : `/api${r.path}`, {
          method: 'GET',
          headers: {
            Authorization: (() => {
              try {
                const raw = localStorage.getItem('growthos-auth');
                const token = JSON.parse(raw ?? '{}')?.state?.accessToken ?? '';
                return token ? `Bearer ${token}` : '';
              } catch { return ''; }
            })(),
          },
        });
        const ms = Math.round(performance.now() - t0);
        newMap[key] = { status: codeToStatus(res.status), code: res.status, ms };
      } catch {
        newMap[key] = { status: 'error', code: null, ms: null };
      }
      setHealthMap({ ...newMap });
      setCheckProgress(Math.round(((i + 1) / probeRoutes.length) * 100));
    }

    setIsChecking(false);
  }, [data, isChecking]);

  // Summary of health results
  const healthSummary = useMemo(() => {
    const results = Object.values(healthMap);
    if (results.length === 0) return null;
    return {
      total: results.length,
      ok:    results.filter(r => r.status === 'ok').length,
      auth:  results.filter(r => r.status === 'auth').length,
      warn:  results.filter(r => r.status === 'warn').length,
      error: results.filter(r => r.status === 'error').length,
    };
  }, [healthMap]);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Audit des Routes API
          </h1>
          {data && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Généré le {new Date(data.generatedAt).toLocaleString('fr-FR')} · {data.total} routes enregistrées
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => refetch()} disabled={isFetching}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
            <RefreshCw size={13} style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} />
            Actualiser
          </button>
          <button onClick={runHealthCheck} disabled={isChecking || !data}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 10, border: 'none', background: isChecking ? '#E5E7EB' : 'var(--color-primary)', color: isChecking ? 'var(--text-muted)' : '#fff', fontSize: 13, cursor: isChecking ? 'default' : 'pointer', fontWeight: 600 }}>
            <Activity size={13} style={{ animation: isChecking ? 'spin 1.5s linear infinite' : 'none' }} />
            {isChecking ? `Vérification… ${checkProgress}%` : 'Vérifier la santé'}
          </button>
        </div>
      </div>

      {/* Health summary bar */}
      {healthSummary && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, padding: '12px 16px', borderRadius: 12, background: 'var(--card-bg)', border: '1px solid var(--card-border)', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginRight: 4 }}>Résultats :</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#059669', background: '#ECFDF5', padding: '3px 10px', borderRadius: 8, fontWeight: 600 }}><CheckCircle2 size={12} />{healthSummary.ok} OK</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#2563EB', background: '#EFF6FF', padding: '3px 10px', borderRadius: 8, fontWeight: 600 }}><Shield size={12} />{healthSummary.auth} Auth requis</span>
          {healthSummary.warn > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#D97706', background: '#FEF3C7', padding: '3px 10px', borderRadius: 8, fontWeight: 600 }}><AlertCircle size={12} />{healthSummary.warn} Avertissement</span>}
          {healthSummary.error > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#DC2626', background: '#FEF2F2', padding: '3px 10px', borderRadius: 8, fontWeight: 600 }}><XCircle size={12} />{healthSummary.error} Erreur 5xx</span>}
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>sur {healthSummary.total} routes GET sondées</span>
        </div>
      )}

      {/* Stats cards */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
          <div style={{ padding: '14px 18px', borderRadius: 14, background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)' }}>{data.total}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Routes totales</div>
          </div>
          <div style={{ padding: '14px 18px', borderRadius: 14, background: '#EFF6FF', border: '1px solid #DBEAFE' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#1D4ED8' }}>{data.authRequired}</div>
            <div style={{ fontSize: 11, color: '#3B82F6', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}><Shield size={10} />Protégées JWT</div>
          </div>
          <div style={{ padding: '14px 18px', borderRadius: 14, background: '#F0FDF4', border: '1px solid #D1FAE5' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#065F46' }}>{data.public}</div>
            <div style={{ fontSize: 11, color: '#10B981', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}><Globe size={10} />Publiques</div>
          </div>
          {Object.entries(data.byMethod).sort().map(([m, n]) => {
            const c = METHOD_COLORS[m] ?? { bg: '#F3F4F6', text: '#374151' };
            return (
              <div key={m} style={{ padding: '14px 18px', borderRadius: 14, background: c.bg }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: c.text }}>{n}</div>
                <div style={{ fontSize: 11, color: c.text, marginTop: 2, fontFamily: 'monospace', fontWeight: 700 }}>{m}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filtrer par chemin…"
            style={{ width: '100%', paddingLeft: 28, paddingRight: 10, paddingTop: 8, paddingBottom: 8, borderRadius: 9, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {methods.map(m => (
            <button key={m} onClick={() => setMethodFilter(m)}
              style={{ padding: '4px 10px', borderRadius: 7, border: 'none', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: m === 'ALL' ? 'inherit' : 'monospace', background: methodFilter === m ? (METHOD_COLORS[m]?.bg ?? '#E5E7EB') : 'var(--body-bg)', color: methodFilter === m ? (METHOD_COLORS[m]?.text ?? '#374151') : 'var(--text-muted)', boxShadow: '0 0 0 1px var(--card-border)' }}>
              {m}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'auth', 'public'] as const).map(f => (
            <button key={f} onClick={() => setAuthFilter(f)}
              style={{ padding: '4px 10px', borderRadius: 7, border: 'none', fontSize: 10, cursor: 'pointer', fontWeight: 600, background: authFilter === f ? 'var(--color-primary)' : 'var(--body-bg)', color: authFilter === f ? '#fff' : 'var(--text-muted)', boxShadow: '0 0 0 1px var(--card-border)' }}>
              {f === 'all' ? 'Toutes' : f === 'auth' ? '🔒 Auth' : '🌐 Public'}
            </button>
          ))}
        </div>
      </div>

      {/* Loading / error states */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 13 }}>
          Chargement des routes…
        </div>
      )}
      {isError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 16, borderRadius: 12, background: '#FEF2F2', border: '1px solid #FEE2E2', color: '#DC2626', fontSize: 13 }}>
          <AlertCircle size={15} />Impossible de charger l'audit des routes.
        </div>
      )}

      {/* Route table */}
      {!isLoading && !isError && (
        <>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
            {filtered.length} route{filtered.length !== 1 ? 's' : ''} affichée{filtered.length !== 1 ? 's' : ''}
            {Object.keys(healthMap).length > 0 && ' · hover pour voir le temps de réponse'}
          </div>
          <div style={{ borderRadius: 14, border: '1px solid var(--card-border)', overflow: 'hidden' }}>
            {filtered.length === 0
              ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Aucune route ne correspond.</div>
              : filtered.map((r, i) => {
                  const key = `${r.method}:${r.path}`;
                  const health = healthMap[key];
                  const meta = health ? statusMeta(health.status) : null;
                  const isSkipped = r.method !== 'GET' || hasParams(r.path);
                  return (
                    <div key={`${key}:${i}`}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: i < filtered.length - 1 ? '1px solid var(--card-border)' : 'none', background: health?.status === 'error' ? '#FFF5F5' : i % 2 === 0 ? 'var(--card-bg)' : 'transparent', transition: 'background 0.1s' }}
                      className="route-row"
                      onMouseEnter={e => { const btn = e.currentTarget.querySelector('.copy-btn') as HTMLElement; if (btn) btn.style.opacity = '1'; }}
                      onMouseLeave={e => { const btn = e.currentTarget.querySelector('.copy-btn') as HTMLElement; if (btn) btn.style.opacity = '0'; }}>
                      <MethodBadge method={r.method} />
                      <code style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.path}
                      </code>
                      {/* Health badge */}
                      {meta && !isSkipped ? (
                        <span title={health?.ms ? `${health.ms}ms` : undefined}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: meta.color, background: `${meta.color}18`, padding: '2px 7px', borderRadius: 6, flexShrink: 0, fontWeight: 700, cursor: health?.ms ? 'help' : 'default' }}>
                          {meta.icon}{meta.label}{health?.ms ? ` · ${health.ms}ms` : ''}
                        </span>
                      ) : Object.keys(healthMap).length > 0 && isSkipped ? (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', padding: '2px 7px', borderRadius: 6, background: 'var(--body-bg)', flexShrink: 0 }}>Ignoré</span>
                      ) : null}
                      {/* Auth badge */}
                      {r.auth
                        ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#1D4ED8', background: '#EFF6FF', padding: '2px 7px', borderRadius: 6, flexShrink: 0, fontWeight: 600 }}><Shield size={9} />JWT</span>
                        : <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#059669', background: '#F0FDF4', padding: '2px 7px', borderRadius: 6, flexShrink: 0, fontWeight: 600 }}><Globe size={9} />Public</span>
                      }
                      <CopyButton text={`${r.method} ${r.path}`} />
                    </div>
                  );
                })
            }
          </div>
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
