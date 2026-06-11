import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Shield, Download, RefreshCw, Search, Filter, User,
  ChevronLeft, ChevronRight, Activity, Loader2, Clock,
  FileText, Users, TrendingUp, BarChart2, X,
} from 'lucide-react';
import apiClient from '@/lib/api-client';

/* ─── Types ─── */
interface AuditLog {
  id: string; action: string; entityType: string; entityId?: string;
  oldValue?: unknown; newValue?: unknown; metadata?: Record<string, unknown>;
  ipAddress?: string; createdAt: string;
  user?: { id: string; email: string; name?: string } | null;
  tenantName?: string;
}
interface AuditStats {
  total30d: number;
  byAction: { action: string; count: number }[];
  byEntity: { entityType: string; count: number }[];
  byUser: { email: string; name?: string; count: number }[];
  daily: { day: string; count: number }[];
}
interface AuditResponse {
  logs: AuditLog[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

/* ─── Action colors ─── */
const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  create: { bg: '#D1FAE5', text: '#059669' },
  created: { bg: '#D1FAE5', text: '#059669' },
  update: { bg: '#DBEAFE', text: '#2563EB' },
  updated: { bg: '#DBEAFE', text: '#2563EB' },
  delete: { bg: '#FEE2E2', text: '#DC2626' },
  deleted: { bg: '#FEE2E2', text: '#DC2626' },
  login: { bg: '#EDE9FE', text: '#7C3AED' },
  logout: { bg: '#F3F4F6', text: '#6B7280' },
  password_reset: { bg: '#FEF3C7', text: '#D97706' },
  plan_change: { bg: '#FEE2E2', text: '#DC2626' },
  role_assigned: { bg: '#EDE9FE', text: '#7C3AED' },
  activate: { bg: '#D1FAE5', text: '#059669' },
  deactivate: { bg: '#FEE2E2', text: '#DC2626' },
};

function actionStyle(action: string) {
  const key = Object.keys(ACTION_COLORS).find(k => action.toLowerCase().includes(k)) ?? '_';
  return ACTION_COLORS[key] ?? { bg: '#F3F4F6', text: '#6B7280' };
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'À l\'instant';
  if (m < 60) return `il y a ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  return `il y a ${d}j`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/* ─── Mini bar chart ─── */
function MiniBar({ items, colorKey }: { items: { label: string; count: number }[]; colorKey?: string }) {
  const max = Math.max(...items.map(i => i.count), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.slice(0, 6).map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <span style={{ width: 120, flexShrink: 0, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.label}>{item.label}</span>
          <div style={{ flex: 1, background: 'var(--body-bg)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
            <div style={{ width: `${(item.count / max) * 100}%`, height: '100%', background: 'var(--color-primary)', borderRadius: 4 }} />
          </div>
          <span style={{ width: 32, textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>{item.count}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Page principale ─── */
export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState({ action: '', entityType: '', from: '', to: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    clearTimeout((window as any).__auditSearch);
    (window as any).__auditSearch = setTimeout(() => { setDebouncedSearch(val); setPage(1); }, 350);
  }, []);

  const queryParams = new URLSearchParams({
    page: String(page), limit: '50',
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(filters.action && { action: filters.action }),
    ...(filters.entityType && { entityType: filters.entityType }),
    ...(filters.from && { from: filters.from }),
    ...(filters.to && { to: filters.to }),
  });

  const { data, isLoading, refetch, isFetching } = useQuery<AuditResponse>({
    queryKey: ['admin-audit-logs', queryParams.toString()],
    queryFn: () => apiClient.get(`/admin/audit-logs?${queryParams}`) as Promise<AuditResponse>,
    staleTime: 30_000,
  });

  const { data: stats } = useQuery<AuditStats>({
    queryKey: ['admin-audit-stats'],
    queryFn: () => apiClient.get('/admin/audit-logs/stats') as Promise<AuditStats>,
    staleTime: 60_000,
  });

  const { data: actions = [] } = useQuery<string[]>({
    queryKey: ['admin-audit-actions'],
    queryFn: () => apiClient.get('/admin/audit-logs/actions') as Promise<string[]>,
    staleTime: 300_000,
  });

  const handleExportCsv = () => {
    const token = localStorage.getItem('auth_token') ?? sessionStorage.getItem('auth_token') ?? '';
    const url = `/api/v1/admin/audit-logs/csv?${queryParams}`;
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', `audit-${Date.now()}.csv`);
    a.click();
  };

  const logs = data?.logs ?? [];
  const pagination = data?.pagination;
  const activeFilters = [filters.action, filters.entityType, filters.from, filters.to].filter(Boolean).length;

  const cardStyle = { background: 'var(--card-bg)', borderRadius: 14, border: '1px solid var(--card-border)', padding: 18 };
  const inputStyle = { padding: '8px 12px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 13, width: '100%', boxSizing: 'border-box' as const };

  return (
    <div style={{ padding: 28, maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={22} /> Journal d'audit RBAC
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Traçabilité complète des accès et modifications · 30 derniers jours
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => refetch()} disabled={isFetching}
            style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /> Actualiser
          </button>
          <button onClick={handleExportCsv}
            style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#059669', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13 }}>
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Activity size={16} style={{ color: 'var(--color-primary)' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>ÉVÉNEMENTS (30j)</span>
            </div>
            <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>{stats.total30d.toLocaleString('fr-FR')}</p>
          </div>
          <div style={{ ...cardStyle, gridColumn: 'span 2' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <BarChart2 size={16} style={{ color: 'var(--color-primary)' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>TOP ACTIONS</span>
            </div>
            <MiniBar items={stats.byAction.map(a => ({ label: a.action, count: a.count }))} />
          </div>
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Users size={16} style={{ color: 'var(--color-primary)' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>TOP UTILISATEURS</span>
            </div>
            <MiniBar items={stats.byUser.map(u => ({ label: u.name ?? u.email, count: u.count }))} />
          </div>
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <FileText size={16} style={{ color: 'var(--color-primary)' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>PAR ENTITÉ</span>
            </div>
            <MiniBar items={stats.byEntity.map(e => ({ label: e.entityType, count: e.count }))} />
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input value={search} onChange={e => handleSearch(e.target.value)} placeholder="Rechercher par action, entité, utilisateur…"
              style={{ ...inputStyle, paddingLeft: 32 }} />
          </div>
          <button onClick={() => setShowFilters(f => !f)}
            style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${activeFilters > 0 ? 'var(--color-primary)' : 'var(--card-border)'}`, background: activeFilters > 0 ? 'var(--color-primary)20' : 'var(--card-bg)', cursor: 'pointer', color: activeFilters > 0 ? 'var(--color-primary)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
            <Filter size={14} /> Filtres {activeFilters > 0 ? `(${activeFilters})` : ''}
          </button>
          {activeFilters > 0 && (
            <button onClick={() => { setFilters({ action: '', entityType: '', from: '', to: '' }); setPage(1); }}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', cursor: 'pointer', color: '#DC2626' }}>
              <X size={14} />
            </button>
          )}
        </div>

        {showFilters && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--card-border)' }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>ACTION</label>
              <select value={filters.action} onChange={e => { setFilters(f => ({ ...f, action: e.target.value })); setPage(1); }} style={inputStyle}>
                <option value="">Toutes</option>
                {actions.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>TYPE D'ENTITÉ</label>
              <select value={filters.entityType} onChange={e => { setFilters(f => ({ ...f, entityType: e.target.value })); setPage(1); }} style={inputStyle}>
                <option value="">Tous</option>
                {(stats?.byEntity ?? []).map(e => <option key={e.entityType} value={e.entityType}>{e.entityType}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>DU</label>
              <input type="datetime-local" value={filters.from} onChange={e => { setFilters(f => ({ ...f, from: e.target.value })); setPage(1); }} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>AU</label>
              <input type="datetime-local" value={filters.to} onChange={e => { setFilters(f => ({ ...f, to: e.target.value })); setPage(1); }} style={inputStyle} />
            </div>
          </div>
        )}
      </div>

      {/* Log timeline */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            {isLoading ? '…' : `${pagination?.total?.toLocaleString('fr-FR') ?? 0} entrée${(pagination?.total ?? 0) !== 1 ? 's' : ''}`}
          </span>
          {pagination && pagination.pages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--card-bg)', cursor: 'pointer', color: page === 1 ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{page} / {pagination.pages}</span>
              <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}
                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--card-bg)', cursor: 'pointer', color: page === pagination.pages ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}><Loader2 size={24} className="animate-spin" /></div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
            <Shield size={32} style={{ marginBottom: 10, opacity: 0.3 }} />
            <p style={{ margin: 0 }}>Aucun événement d'audit trouvé</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {logs.map(log => {
              const style = actionStyle(log.action);
              const isExpanded = expandedLog === log.id;
              return (
                <div key={log.id}
                  onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                  style={{ padding: '10px 12px', borderRadius: 8, cursor: 'pointer', background: isExpanded ? 'var(--body-bg)' : 'transparent', transition: 'background 0.1s', display: 'flex', flexDirection: 'column', gap: isExpanded ? 10 : 0 }}
                  onMouseEnter={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = 'var(--body-bg)'; }}
                  onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Action badge */}
                    <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: style.bg, color: style.text, flexShrink: 0, minWidth: 70, textAlign: 'center' }}>
                      {log.action}
                    </span>

                    {/* Entity */}
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace', background: 'var(--body-bg)', padding: '1px 6px', borderRadius: 4 }}>
                      {log.entityType}
                    </span>

                    {/* User */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1, minWidth: 0 }}>
                      {log.user ? (
                        <>
                          <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--color-primary)20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <User size={11} style={{ color: 'var(--color-primary)' }} />
                          </div>
                          <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {log.user.name ?? log.user.email}
                          </span>
                          {log.user.name && <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>({log.user.email})</span>}
                        </>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Système</span>
                      )}
                    </div>

                    {/* IP */}
                    {log.ipAddress && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', flexShrink: 0 }}>{log.ipAddress}</span>
                    )}

                    {/* Time */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }} title={formatDate(log.createdAt)}>
                      <Clock size={11} style={{ color: 'var(--text-muted)' }} />
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{timeAgo(log.createdAt)}</span>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div style={{ paddingLeft: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        <strong>Date :</strong> {formatDate(log.createdAt)}
                        {log.entityId && <> · <strong>ID :</strong> <code style={{ fontSize: 11 }}>{log.entityId}</code></>}
                        {log.tenantName && <> · <strong>Tenant :</strong> {log.tenantName}</>}
                      </div>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div>
                          <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>MÉTADONNÉES</p>
                          <pre style={{ margin: 0, padding: '8px 10px', background: 'var(--body-bg)', borderRadius: 6, fontSize: 11, color: 'var(--text-secondary)', overflow: 'auto', maxHeight: 120 }}>
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                      {(log.oldValue || log.newValue) && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          {log.oldValue && (
                            <div>
                              <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#DC2626' }}>AVANT</p>
                              <pre style={{ margin: 0, padding: '8px 10px', background: '#FEF2F2', borderRadius: 6, fontSize: 11, color: '#DC2626', overflow: 'auto', maxHeight: 120 }}>
                                {JSON.stringify(log.oldValue, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.newValue && (
                            <div>
                              <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#059669' }}>APRÈS</p>
                              <pre style={{ margin: 0, padding: '8px 10px', background: '#F0FDF4', borderRadius: 6, fontSize: 11, color: '#059669', overflow: 'auto', maxHeight: 120 }}>
                                {JSON.stringify(log.newValue, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
