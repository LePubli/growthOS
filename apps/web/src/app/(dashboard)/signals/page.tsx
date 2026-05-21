'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Zap, CheckCheck, Filter, RefreshCw, AlertTriangle, Info, AlertCircle, XCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface Signal {
  id: string; prospect_id: string; prospect_name: string;
  type: string; title: string; description?: string;
  source: string; severity: 'low' | 'medium' | 'high' | 'critical';
  is_read: boolean; signal_date?: string; created_at: string;
}

interface Summary {
  total: number; unread: number; last_7_days: number;
  by_severity: Record<string, number>; by_type: Record<string, number>;
}

const SEV_CONFIG = {
  critical: { icon: <XCircle size={14} />,       color: '#DC3545', bg: 'rgba(220,53,69,.08)',  label: 'Critique'  },
  high:     { icon: <AlertCircle size={14} />,   color: '#FD7E14', bg: 'rgba(253,126,20,.08)', label: 'Haut'      },
  medium:   { icon: <AlertTriangle size={14} />, color: '#F0AD4E', bg: 'rgba(240,173,78,.08)', label: 'Moyen'     },
  low:      { icon: <Info size={14} />,          color: '#017E84', bg: 'rgba(1,126,132,.06)',  label: 'Bas'       },
};

const TYPE_ICONS: Record<string, string> = {
  bodacc_new_company: '🆕',   bodacc_capital_change: '💰',
  bodacc_sale: '🤝',          bodacc_cessation: '⚠️',
  director_change: '👤',       job_posting_detected: '👥',
  no_contact: '📭',           no_website: '🌐',
  hot_lead_no_contact: '🔥',  ai_hot_lead: '🤖',
};

export default function SignalsPage() {
  const qc = useQueryClient();
  const [filterSev, setFilterSev] = useState('');
  const [filterType, setFilterType] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['signals', filterSev, filterType, unreadOnly],
    queryFn: () => apiClient.get<any>('/signals', {
      severity: filterSev || undefined,
      signal_type: filterType || undefined,
      unread_only: unreadOnly || undefined,
      limit: 200,
    }),
    refetchInterval: 30_000,
  });

  const { data: summary } = useQuery<Summary>({
    queryKey: ['signals-summary'],
    queryFn: () => apiClient.get('/signals/summary'),
    refetchInterval: 30_000,
  });

  const markReadMutation = useMutation({
    mutationFn: (ids: string[]) => apiClient.post('/signals/mark-read', ids),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['signals'] }); qc.invalidateQueries({ queryKey: ['signals-summary'] }); setSelected(new Set()); toast.success('Marqué comme lu'); },
  });

  const detectMutation = useMutation({
    mutationFn: () => apiClient.post('/signals/detect', {}),
    onSuccess: (data: any) => { qc.invalidateQueries({ queryKey: ['signals'] }); toast.success(`${data.detected || 0} nouveaux signaux détectés`); },
  });

  const signals: Signal[] = data?.items || [];
  const types = Object.keys(summary?.by_type || {});

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const markAllUnreadRead = () => {
    const unread = signals.filter(s => !s.is_read).map(s => s.id);
    if (unread.length) markReadMutation.mutate(unread);
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: 'var(--bg-app)' }}>

      {/* Sidebar summary */}
      <div style={{ width: 240, borderRight: '1px solid var(--border-color)', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Signaux</h2>
          {summary && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              {summary.unread} non lus · {summary.total} total
            </p>
          )}
        </div>

        <div style={{ padding: '12px', flex: 1, overflow: 'auto' }}>
          {/* Sévérité filters */}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Sévérité</div>
          {Object.entries(SEV_CONFIG).map(([sev, cfg]) => (
            <button key={sev} onClick={() => setFilterSev(filterSev === sev ? '' : sev)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '7px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', marginBottom: 3, background: filterSev === sev ? cfg.bg : 'transparent', transition: 'background .1s' }}
              onMouseEnter={e => { if (filterSev !== sev) (e.currentTarget.style.background = '#F8F9FA'); }}
              onMouseLeave={e => { if (filterSev !== sev) (e.currentTarget.style.background = 'transparent'); }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: filterSev === sev ? cfg.color : 'var(--text-secondary)', fontSize: 13 }}>
                <span style={{ color: cfg.color }}>{cfg.icon}</span> {cfg.label}
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
                {summary?.by_severity?.[sev] || 0}
              </span>
            </button>
          ))}

          {/* Type filters */}
          {types.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '16px 0 8px' }}>Type</div>
              {types.slice(0, 8).map(type => (
                <button key={type} onClick={() => setFilterType(filterType === type ? '' : type)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', marginBottom: 2, background: filterType === type ? 'rgba(1,126,132,.08)' : 'transparent', fontSize: 12, color: filterType === type ? 'var(--color-primary)' : 'var(--text-secondary)' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>
                    {TYPE_ICONS[type] || '📌'} {type.replace(/_/g, ' ')}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>{(summary?.by_type || {})[type]}</span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Toolbar */}
        <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={unreadOnly} onChange={e => setUnreadOnly(e.target.checked)}
              style={{ accentColor: 'var(--color-primary)', cursor: 'pointer' }} />
            Non lus seulement
          </label>
          <div style={{ flex: 1 }} />
          {selected.size > 0 && (
            <button onClick={() => markReadMutation.mutate(Array.from(selected))} className="o-btn o-btn-secondary o-btn-sm">
              <CheckCheck size={13} /> Marquer lu ({selected.size})
            </button>
          )}
          <button onClick={markAllUnreadRead} className="o-btn o-btn-secondary o-btn-sm">
            <CheckCheck size={13} /> Tout lire
          </button>
          <button onClick={() => detectMutation.mutate()} disabled={detectMutation.isPending} className="o-btn o-btn-primary o-btn-sm">
            <Zap size={13} />
            {detectMutation.isPending ? 'Détection...' : 'Détecter signaux'}
          </button>
          <button onClick={() => refetch()} className="o-btn o-btn-ghost o-btn-sm"><RefreshCw size={13} /></button>
        </div>

        {/* Feed */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {isLoading ? (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="o-skeleton" style={{ height: 72, borderRadius: 8 }} />)}
            </div>
          ) : signals.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
              <Zap size={48} style={{ opacity: .2, marginBottom: 16 }} />
              <p style={{ fontSize: 15, fontWeight: 500 }}>Aucun signal</p>
              <p style={{ fontSize: 13 }}>Lancez une détection pour trouver des opportunités</p>
            </div>
          ) : (
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {signals.map(signal => {
                const sev = SEV_CONFIG[signal.severity] || SEV_CONFIG.medium;
                const isSelected = selected.has(signal.id);
                return (
                  <div key={signal.id}
                    style={{ display: 'flex', gap: 12, padding: '14px 16px', background: signal.is_read ? 'var(--bg-card)' : 'rgba(1,126,132,.03)', border: `1px solid ${isSelected ? 'var(--color-primary)' : signal.is_read ? 'var(--border-color)' : 'rgba(1,126,132,.2)'}`, borderRadius: 8, cursor: 'pointer', transition: 'all .12s', boxShadow: 'var(--shadow-card)' }}
                    onClick={() => toggleSelect(signal.id)}>

                    {/* Checkbox */}
                    <div style={{ paddingTop: 2, flexShrink: 0 }}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(signal.id)}
                        style={{ accentColor: 'var(--color-primary)', cursor: 'pointer' }} onClick={e => e.stopPropagation()} />
                    </div>

                    {/* Severity icon */}
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: sev.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: sev.color, flexShrink: 0 }}>
                      {sev.icon}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontWeight: signal.is_read ? 500 : 700, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {TYPE_ICONS[signal.type] || '📌'} {signal.title}
                        </span>
                        {!signal.is_read && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0 }} />}
                      </div>
                      <div style={{ display: 'flex', gap: 10, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{signal.prospect_name}</span>
                        <span>·</span>
                        <span style={{ padding: '1px 7px', borderRadius: 20, background: sev.bg, color: sev.color, fontSize: 11, fontWeight: 600 }}>{sev.label}</span>
                        <span>·</span>
                        <span>{signal.source}</span>
                        <span>·</span>
                        <span>{new Date(signal.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {signal.description && (
                        <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{signal.description}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'flex-start' }} onClick={e => e.stopPropagation()}>
                      {!signal.is_read && (
                        <button onClick={() => markReadMutation.mutate([signal.id])} className="o-btn o-btn-ghost o-btn-sm" title="Marquer comme lu">
                          <CheckCheck size={12} />
                        </button>
                      )}
                      <a href={`/prospects/${signal.prospect_id}`} className="o-btn o-btn-ghost o-btn-sm" title="Voir le prospect">
                        →
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
