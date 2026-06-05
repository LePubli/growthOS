import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Webhook, Plus, Trash2, Play, Pause, TestTube2, ExternalLink,
  CheckCircle2, XCircle, Clock, RefreshCw, ChevronDown, ChevronRight,
  AlertTriangle, Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';

const ALL_EVENTS = [
  'prospect.created', 'prospect.updated', 'prospect.deleted',
  'deal.created', 'deal.stage_changed', 'deal.won', 'deal.lost',
  'sequence.enrolled', 'sequence.completed',
  'signal.created', 'task.created', 'task.completed',
];

type WebhookItem = {
  id: string; name: string; url: string; events: string[];
  status: 'active' | 'paused'; deliveries: number;
  last_triggered_at: string | null; secret?: string;
};

type WebhookLog = {
  id: string; webhook_id: string; webhook_name: string; url: string;
  event_type: string; status: 'delivered' | 'failed' | 'pending';
  response_code: number | null; created_at: string; error_message: string | null;
};

export default function IntegrationsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', url: '', events: [] as string[] });

  const { data: webhooks = [], isLoading } = useQuery<WebhookItem[]>({
    queryKey: ['integrations-webhooks'],
    queryFn: () => apiClient.get('/integrations/webhooks') as Promise<WebhookItem[]>,
    staleTime: 15_000,
  });

  const { data: logs = [] } = useQuery<WebhookLog[]>({
    queryKey: ['webhook-logs'],
    queryFn: () => apiClient.get('/integrations/webhooks/logs?limit=100') as Promise<WebhookLog[]>,
    staleTime: 15_000,
  });

  const createMut = useMutation({
    mutationFn: (data: typeof form) => apiClient.post('/integrations/webhooks', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['integrations-webhooks'] }); setShowForm(false); setForm({ name: '', url: '', events: [] }); toast.success('Webhook créé'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: (id: string) => apiClient.post(`/integrations/webhooks/${id}/toggle`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations-webhooks'] }),
  });

  const testMut = useMutation({
    mutationFn: (id: string) => apiClient.post(`/integrations/webhooks/${id}/test`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['webhook-logs'] }); toast.success('Ping envoyé'); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/integrations/webhooks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations-webhooks'] }),
  });

  const toggleEvent = (ev: string) => {
    setForm(f => ({
      ...f,
      events: f.events.includes(ev) ? f.events.filter(e => e !== ev) : [...f.events, ev],
    }));
  };

  const statusColor = (s: string) =>
    s === 'delivered' ? '#22C55E' : s === 'failed' ? '#EF4444' : '#F59E0B';

  const statusIcon = (s: string) => {
    if (s === 'delivered') return <CheckCircle2 size={13} color="#22C55E" />;
    if (s === 'failed') return <XCircle size={13} color="#EF4444" />;
    return <Clock size={13} color="#F59E0B" />;
  };

  return (
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Webhook size={22} color="var(--color-primary)" />
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Intégrations & Webhooks</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
            Envoyez des événements GrowthOS vers vos outils externes (Zapier, Make, Slack…)
          </p>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
        >
          <Plus size={14} /> Nouveau webhook
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>Configurer un webhook</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Nom</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Mon webhook Zapier"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>URL de destination</label>
              <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                placeholder="https://hooks.zapier.com/..."
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>Événements à écouter</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ALL_EVENTS.map(ev => (
                <label key={ev} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '4px 10px', borderRadius: 20, border: `1px solid ${form.events.includes(ev) ? 'var(--color-primary)' : 'var(--card-border)'}`, background: form.events.includes(ev) ? 'rgba(var(--color-primary-rgb),0.08)' : 'transparent', fontSize: 12 }}>
                  <input type="checkbox" checked={form.events.includes(ev)} onChange={() => toggleEvent(ev)} style={{ display: 'none' }} />
                  <span style={{ color: form.events.includes(ev) ? 'var(--color-primary)' : 'var(--text-secondary)' }}>{ev}</span>
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => createMut.mutate(form)}
              disabled={!form.name || !form.url || form.events.length === 0 || createMut.isPending}
              style={{ padding: '8px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, opacity: createMut.isPending ? 0.7 : 1 }}
            >
              {createMut.isPending ? 'Création…' : 'Créer le webhook'}
            </button>
            <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', background: 'var(--body-bg)', color: 'var(--text-secondary)', border: '1px solid var(--card-border)', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Webhooks list */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, marginBottom: 24 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Webhook size={16} color="var(--text-muted)" />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Webhooks configurés ({webhooks.length})</span>
        </div>
        {isLoading && <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Chargement…</div>}
        {!isLoading && webhooks.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Aucun webhook configuré. Ajoutez-en un pour commencer.
          </div>
        )}
        {webhooks.map(wh => {
          const whLogs = logs.filter(l => l.webhook_id === wh.id);
          const expanded = expandedId === wh.id;
          return (
            <div key={wh.id} style={{ borderBottom: '1px solid var(--card-border)' }}>
              <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={() => setExpandedId(expanded ? null : wh.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                  {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{wh.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wh.url}</div>
                </div>
                <span style={{ padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: wh.status === 'active' ? 'rgba(34,197,94,0.1)' : 'rgba(156,163,175,0.15)', color: wh.status === 'active' ? '#22C55E' : 'var(--text-muted)' }}>
                  {wh.status === 'active' ? '● Actif' : '○ Pause'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{wh.deliveries} envois</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => testMut.mutate(wh.id)} title="Envoyer un ping test" style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--card-border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    <TestTube2 size={13} />
                  </button>
                  <button onClick={() => toggleMut.mutate(wh.id)} title={wh.status === 'active' ? 'Mettre en pause' : 'Activer'} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--card-border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    {wh.status === 'active' ? <Pause size={13} /> : <Play size={13} />}
                  </button>
                  <button onClick={() => deleteMut.mutate(wh.id)} title="Supprimer" style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--card-border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              {expanded && (
                <div style={{ padding: '0 20px 16px 20px', background: 'var(--body-bg)' }}>
                  <div style={{ marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Événements</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                      {wh.events.map(ev => (
                        <span key={ev} style={{ padding: '2px 8px', borderRadius: 12, background: 'rgba(var(--color-primary-rgb),0.08)', color: 'var(--color-primary)', fontSize: 11, fontWeight: 500 }}>{ev}</span>
                      ))}
                    </div>
                  </div>
                  {wh.secret && (
                    <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                      Secret HMAC: <code style={{ background: 'var(--card-bg)', padding: '2px 6px', borderRadius: 4 }}>{wh.secret.slice(0, 16)}…</code>
                    </div>
                  )}
                  {whLogs.length > 0 && (
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Derniers envois</span>
                      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {whLogs.slice(0, 5).map(log => (
                          <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--card-bg)', borderRadius: 6, fontSize: 12 }}>
                            {statusIcon(log.status)}
                            <span style={{ color: statusColor(log.status), fontWeight: 600 }}>{log.status}</span>
                            <span style={{ color: 'var(--text-muted)' }}>{log.event_type}</span>
                            {log.response_code && <span style={{ color: 'var(--text-muted)' }}>HTTP {log.response_code}</span>}
                            <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>{new Date(log.created_at).toLocaleTimeString('fr-FR')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Global logs */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={16} color="var(--text-muted)" />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Journal des livraisons</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>100 dernières</span>
        </div>
        {logs.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Aucun envoi enregistré.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--body-bg)' }}>
                {['Statut', 'Événement', 'Webhook', 'Code HTTP', 'Date'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} style={{ borderTop: '1px solid var(--card-border)' }}>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {statusIcon(log.status)}
                      <span style={{ color: statusColor(log.status), fontWeight: 600 }}>{log.status}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>{log.event_type}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--text-muted)', fontSize: 12 }}>{log.webhook_name}</td>
                  <td style={{ padding: '10px 16px' }}>
                    {log.response_code ? (
                      <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 12, background: log.response_code < 300 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: log.response_code < 300 ? '#22C55E' : '#EF4444' }}>
                        {log.response_code}
                      </span>
                    ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--text-muted)', fontSize: 12 }}>
                    {new Date(log.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
