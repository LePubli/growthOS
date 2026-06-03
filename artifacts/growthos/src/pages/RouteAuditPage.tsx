import { useState, useMemo } from 'react';
import { Shield, Globe, Search, Copy, Check, RefreshCw, AlertCircle } from 'lucide-react';
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

const METHOD_COLORS: Record<string, { bg: string; text: string }> = {
  GET:    { bg: '#DBEAFE', text: '#1D4ED8' },
  POST:   { bg: '#D1FAE5', text: '#065F46' },
  PATCH:  { bg: '#FEF3C7', text: '#92400E' },
  PUT:    { bg: '#EDE9FE', text: '#5B21B6' },
  DELETE: { bg: '#FEE2E2', text: '#991B1B' },
};

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

export default function RouteAuditPage() {
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [authFilter, setAuthFilter] = useState<'all' | 'auth' | 'public'>('all');

  const { data, isLoading, isError, refetch, isFetching } = useQuery<AuditData>({
    queryKey: ['route-audit'],
    queryFn: () => apiClient.get('/admin/route-audit') as Promise<AuditData>,
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

  return (
    <div style={{ padding: '28px 32px', maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Audit des Routes API
          </h1>
          {data && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Généré le {new Date(data.generatedAt).toLocaleString('fr-FR')}
            </p>
          )}
        </div>
        <button onClick={() => refetch()} disabled={isFetching}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
          <RefreshCw size={13} style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} />
          Actualiser
        </button>
      </div>

      {/* Stats cards */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
          <div style={{ padding: '16px 20px', borderRadius: 14, background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>{data.total}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Routes totales</div>
          </div>
          <div style={{ padding: '16px 20px', borderRadius: 14, background: '#EFF6FF', border: '1px solid #DBEAFE' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#1D4ED8' }}>{data.authRequired}</div>
            <div style={{ fontSize: 12, color: '#3B82F6', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}><Shield size={11} />Protégées (JWT)</div>
          </div>
          <div style={{ padding: '16px 20px', borderRadius: 14, background: '#F0FDF4', border: '1px solid #D1FAE5' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#065F46' }}>{data.public}</div>
            <div style={{ fontSize: 12, color: '#10B981', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}><Globe size={11} />Publiques</div>
          </div>
          {Object.entries(data.byMethod).sort().map(([m, n]) => {
            const c = METHOD_COLORS[m] ?? { bg: '#F3F4F6', text: '#374151' };
            return (
              <div key={m} style={{ padding: '16px 20px', borderRadius: 14, background: c.bg, border: `1px solid ${c.bg}` }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: c.text }}>{n}</div>
                <div style={{ fontSize: 12, color: c.text, marginTop: 2, fontFamily: 'monospace', fontWeight: 700 }}>{m}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Filtrer par chemin…"
            style={{ width: '100%', paddingLeft: 30, paddingRight: 10, paddingTop: 9, paddingBottom: 9, borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {methods.map(m => (
            <button key={m} onClick={() => setMethodFilter(m)}
              style={{ padding: '5px 12px', borderRadius: 8, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: m === 'ALL' ? 'inherit' : 'monospace', background: methodFilter === m ? (METHOD_COLORS[m]?.bg ?? '#E5E7EB') : 'var(--body-bg)', color: methodFilter === m ? (METHOD_COLORS[m]?.text ?? '#374151') : 'var(--text-muted)', boxShadow: '0 0 0 1px var(--card-border)' }}>
              {m}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {(['all', 'auth', 'public'] as const).map(f => (
            <button key={f} onClick={() => setAuthFilter(f)}
              style={{ padding: '5px 12px', borderRadius: 8, border: 'none', fontSize: 11, cursor: 'pointer', fontWeight: 600, background: authFilter === f ? 'var(--color-primary)' : 'var(--body-bg)', color: authFilter === f ? '#fff' : 'var(--text-muted)', boxShadow: '0 0 0 1px var(--card-border)' }}>
              {f === 'all' ? 'Toutes' : f === 'auth' ? '🔒 Auth' : '🌐 Public'}
            </button>
          ))}
        </div>
      </div>

      {/* Route list */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 13 }}>
          Chargement des routes…
        </div>
      )}

      {isError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 20, borderRadius: 12, background: '#FEF2F2', border: '1px solid #FEE2E2', color: '#DC2626', fontSize: 13 }}>
          <AlertCircle size={16} />Impossible de charger l'audit des routes.
        </div>
      )}

      {!isLoading && !isError && (
        <>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
            {filtered.length} route{filtered.length !== 1 ? 's' : ''} affichée{filtered.length !== 1 ? 's' : ''}
          </div>
          <div style={{ borderRadius: 14, border: '1px solid var(--card-border)', overflow: 'hidden' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Aucune route ne correspond aux filtres.</div>
            ) : (
              filtered.map((r, i) => (
                <div key={`${r.method}:${r.path}:${i}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: i < filtered.length - 1 ? '1px solid var(--card-border)' : 'none', background: i % 2 === 0 ? 'var(--card-bg)' : 'transparent' }}
                  className="route-row"
                  onMouseEnter={e => { const btn = e.currentTarget.querySelector('.copy-btn') as HTMLElement; if (btn) btn.style.opacity = '1'; }}
                  onMouseLeave={e => { const btn = e.currentTarget.querySelector('.copy-btn') as HTMLElement; if (btn) btn.style.opacity = '0'; }}>
                  <MethodBadge method={r.method} />
                  <code style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.path}
                  </code>
                  {r.auth
                    ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#1D4ED8', background: '#EFF6FF', padding: '2px 7px', borderRadius: 6, flexShrink: 0, fontWeight: 600 }}><Shield size={9} />JWT</span>
                    : <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#059669', background: '#F0FDF4', padding: '2px 7px', borderRadius: 6, flexShrink: 0, fontWeight: 600 }}><Globe size={9} />Public</span>
                  }
                  <CopyButton text={`${r.method} ${r.path}`} />
                </div>
              ))
            )}
          </div>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
