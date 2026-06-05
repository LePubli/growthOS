import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Trash2, Download, Filter, RefreshCw, User, Clock, Tag } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';

const ACTION_COLORS: Record<string, string> = {
  create: '#10B981', update: '#3B82F6', delete: '#EF4444',
  login: '#8B5CF6', export: '#F59E0B', view: '#6B7280',
};
const ACTION_ICONS: Record<string, string> = {
  create: '✚', update: '✎', delete: '✕', login: '→', export: '↓', view: '◎',
};

export default function AuditTrailPage() {
  const qc = useQueryClient();
  const [entityType, setEntityType] = useState('');
  const [userId, setUserId] = useState('');
  const [days, setDays] = useState('30');

  const { data: stats } = useQuery({
    queryKey: ['audit-stats', days],
    queryFn: () => apiClient.get(`/collaboration/audit-logs/stats?days=${days}`) as Promise<any>,
    staleTime: 30_000,
  });
  const { data: logsData, isFetching, refetch } = useQuery({
    queryKey: ['audit-logs', entityType, userId],
    queryFn: () => {
      const p = new URLSearchParams({ limit: '100' });
      if (entityType) p.set('entityType', entityType);
      if (userId) p.set('userId', userId);
      return apiClient.get(`/collaboration/audit-logs?${p}`) as Promise<any>;
    },
    staleTime: 15_000,
  });

  const purgeMut = useMutation({
    mutationFn: (olderThanDays: number) =>
      apiClient.delete(`/collaboration/audit-logs?olderThanDays=${olderThanDays}`) as Promise<any>,
    onSuccess: (d) => {
      toast.success(`${d.deleted} entrées supprimées`);
      qc.invalidateQueries({ queryKey: ['audit-logs'] });
      qc.invalidateQueries({ queryKey: ['audit-stats'] });
    },
  });

  const logs: any[] = logsData?.logs ?? [];
  const ENTITY_TYPES = ['prospect', 'deal', 'signal', 'activity', 'task', 'sequence', 'account', 'user', 'plugin'];

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={22} style={{ color: '#3B82F6' }} /> Audit Trail
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Historique complet de toutes les actions dans GrowthOS</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => refetch()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />Rafraîchir
          </button>
          <button onClick={() => {
            if (confirm('Supprimer les logs de plus de 90 jours ?')) purgeMut.mutate(90);
          }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', fontSize: 13, cursor: 'pointer' }}>
            <Trash2 size={14} />Purger (90j+)
          </button>
        </div>
      </div>

      {/* Stats strip */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{stats.total?.toLocaleString()}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Actions ({days}j)</div>
          </div>
          {(stats.byAction ?? []).slice(0, 3).map((a: any) => (
            <div key={a.action} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '14px 18px' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: ACTION_COLORS[a.action] ?? '#3B82F6' }}>{Number(a.count).toLocaleString()}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{a.action}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <Filter size={14} style={{ color: 'var(--text-muted)' }} />
        <select value={entityType} onChange={e => setEntityType(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-secondary)', fontSize: 13, outline: 'none' }}>
          <option value="">Toutes les entités</option>
          {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={days} onChange={e => setDays(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-secondary)', fontSize: 13, outline: 'none' }}>
          {['7','14','30','60','90'].map(d => <option key={d} value={d}>{d} derniers jours</option>)}
        </select>
      </div>

      {/* Stats by entity & user */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Tag size={14} />Par entité</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(stats.byEntity ?? []).map((e: any) => (
                <div key={e.entity_type} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', width: 100, textTransform: 'capitalize' }}>{e.entity_type}</div>
                  <div style={{ flex: 1, height: 6, background: 'var(--body-bg)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#3B82F6', borderRadius: 3, width: `${Math.min(100, (Number(e.count) / Math.max(1, Number(stats.byEntity?.[0]?.count ?? 1))) * 100)}%` }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', width: 30, textAlign: 'right' }}>{e.count}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><User size={14} />Par utilisateur</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(stats.byUser ?? []).map((u: any) => (
                <div key={u.email} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#EDE9FE', color: '#7C3AED', fontWeight: 800, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {(u.first_name?.[0] ?? u.email?.[0] ?? '?').toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{u.first_name} {u.last_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.email}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{u.count}</div>
                </div>
              ))}
              {(stats.byUser ?? []).length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Aucune donnée</div>}
            </div>
          </div>
        </div>
      )}

      {/* Timeline logs */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={14} />Timeline ({logs.length} entrées)</span>
          {logs.length > 0 && (
            <button onClick={() => {
              const csv = ['date,user,action,entity_type,entity_id'].concat(
                logs.map(l => `${l.created_at},${l.user_email ?? ''},${l.action},${l.entity_type},${l.entity_id ?? ''}`)
              ).join('\n');
              const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'audit-trail.csv'; a.click();
            }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>
              <Download size={12} />Export CSV
            </button>
          )}
        </div>
        {logs.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            <Shield size={32} style={{ marginBottom: 8, opacity: .3, display: 'block', margin: '0 auto 12px' }} />
            Aucun log d'audit pour l'instant.<br />Les actions des utilisateurs apparaîtront ici automatiquement.
          </div>
        ) : (
          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            {logs.map((log, i) => {
              const color = ACTION_COLORS[log.action] ?? '#6B7280';
              const icon = ACTION_ICONS[log.action] ?? '·';
              return (
                <div key={log.id ?? i} style={{ display: 'flex', gap: 14, padding: '12px 18px', borderBottom: i < logs.length - 1 ? '1px solid var(--card-border)' : 'none', alignItems: 'flex-start' }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: `${color}18`, border: `1.5px solid ${color}`, color, fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>{icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{log.first_name} {log.last_name}</span>
                      <span style={{ fontSize: 11, background: `${color}18`, color, padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>{log.action}</span>
                      <span style={{ fontSize: 11, background: 'var(--body-bg)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: 6 }}>{log.entity_type}</span>
                      {log.entity_id && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{String(log.entity_id).slice(0, 8)}…</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{new Date(log.created_at).toLocaleString('fr-FR')}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
