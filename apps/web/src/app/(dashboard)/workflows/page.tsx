'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Play, Pause, Trash2, Settings, Zap, Clock, Globe, Bot, Mail, Bell } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface Workflow {
  id: string; name: string; description: string;
  trigger_type: string; trigger_config: any;
  is_active: boolean; run_count: number;
  last_run_at: string; created_at: string;
}

const TRIGGER_ICONS: Record<string, React.ReactNode> = {
  event:    <Zap size={16} />,
  schedule: <Clock size={16} />,
  webhook:  <Globe size={16} />,
  manual:   <Play size={16} />,
};

const TRIGGER_LABELS: Record<string, string> = {
  event: 'Événement', schedule: 'Planifié', webhook: 'Webhook', manual: 'Manuel',
};

const STEP_TYPES = [
  { type: 'condition', icon: '🔀', label: 'Condition' },
  { type: 'action_email', icon: <Mail size={14} />, label: 'Envoyer email' },
  { type: 'action_notify', icon: <Bell size={14} />, label: 'Notification' },
  { type: 'action_webhook', icon: <Globe size={14} />, label: 'Webhook' },
  { type: 'action_ai', icon: <Bot size={14} />, label: 'Action IA' },
  { type: 'action_stage', icon: '📋', label: 'Changer étape' },
  { type: 'action_tag', icon: '🏷', label: 'Ajouter tag' },
  { type: 'delay', icon: <Clock size={14} />, label: 'Délai' },
];

export default function WorkflowsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Workflow | null>(null);
  const [form, setForm] = useState({ name: '', description: '', trigger_type: 'event', trigger_event: 'prospect.created' });

  const { data: workflows = [], isLoading } = useQuery<Workflow[]>({
    queryKey: ['workflows'],
    queryFn: () => apiClient.get('/workflows'),
  });

  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ['workflow-templates'],
    queryFn: () => apiClient.get('/workflows/templates/list'),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/workflows/${id}/toggle`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['workflows'] }); toast.success('Workflow mis à jour'); },
  });

  const triggerMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/workflows/${id}/trigger`, {}),
    onSuccess: (data: any) => toast.success(`Workflow déclenché — Run: ${data.runId?.slice(0, 8)}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/workflows/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['workflows'] }); setSelected(null); toast.success('Workflow supprimé'); },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiClient.post('/workflows', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['workflows'] }); setShowCreate(false); toast.success('Workflow créé'); },
  });

  const createFromTemplate = useMutation({
    mutationFn: (tpl: any) => apiClient.post('/workflows', {
      name: tpl.name, description: tpl.description,
      trigger_type: tpl.trigger_type, trigger_config: tpl.trigger_config,
      steps: tpl.steps, is_active: false,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['workflows'] }); toast.success('Workflow créé depuis le template'); },
  });

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-app)' }}>

      {/* Header */}
      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', padding: '16px 24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Workflows</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
              Automatisations intelligentes — {workflows.filter(w => w.is_active).length} actives sur {workflows.length}
            </p>
          </div>
          <button onClick={() => setShowCreate(true)} className="o-btn o-btn-primary o-btn-sm">
            <Plus size={13} /> Nouveau workflow
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', display: 'flex' }}>

        {/* Liste */}
        <div style={{ flex: 1, padding: 24, overflow: 'auto' }}>

          {/* Templates */}
          {templates.length > 0 && workflows.length === 0 && (
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                🚀 Templates prêts à l'emploi
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {templates.map(tpl => (
                  <div key={tpl.id} className="o-card" style={{ cursor: 'pointer', transition: 'all .15s' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-color)')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(1,126,132,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
                        {TRIGGER_ICONS[tpl.trigger_type]}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{tpl.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tpl.steps?.length || 0} étapes</div>
                      </div>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: 12 }}>{tpl.description}</p>
                    <button onClick={() => createFromTemplate.mutate(tpl)} className="o-btn o-btn-secondary o-btn-sm" style={{ width: '100%' }}>
                      Utiliser ce template
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Workflows list */}
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="o-skeleton" style={{ height: 72, borderRadius: 8 }} />)}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {workflows.map(wf => (
                <div key={wf.id}
                  onClick={() => setSelected(wf)}
                  style={{ background: 'var(--bg-card)', border: `1px solid ${selected?.id === wf.id ? 'var(--color-primary)' : 'var(--border-color)'}`, borderRadius: 8, padding: '14px 16px', cursor: 'pointer', transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 14, boxShadow: 'var(--shadow-card)' }}>

                  {/* Trigger icon */}
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: wf.is_active ? 'rgba(1,126,132,.1)' : '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center', color: wf.is_active ? 'var(--color-primary)' : 'var(--text-muted)', flexShrink: 0 }}>
                    {TRIGGER_ICONS[wf.trigger_type] || <Zap size={16} />}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wf.name}</span>
                      <span className={`o-badge o-badge-${wf.is_active ? 'success' : 'muted'}`}>
                        {wf.is_active ? '● Actif' : '○ Inactif'}
                      </span>
                      <span className="o-badge o-badge-muted">{TRIGGER_LABELS[wf.trigger_type] || wf.trigger_type}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {wf.run_count} exécutions
                      {wf.last_run_at && ` · Dernière: ${new Date(wf.last_run_at).toLocaleDateString('fr-FR')}`}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => triggerMutation.mutate(wf.id)} className="o-btn o-btn-secondary o-btn-sm" title="Déclencher">
                      <Play size={12} />
                    </button>
                    <button onClick={() => toggleMutation.mutate(wf.id)}
                      className={`o-btn o-btn-sm ${wf.is_active ? 'o-btn-danger' : 'o-btn-secondary'}`}>
                      {wf.is_active ? <Pause size={12} /> : <Play size={12} />}
                      {wf.is_active ? 'Pause' : 'Activer'}
                    </button>
                  </div>
                </div>
              ))}

              {workflows.length === 0 && !isLoading && (
                <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>
                  <Zap size={48} style={{ opacity: .2, marginBottom: 16 }} />
                  <p style={{ fontSize: 15, fontWeight: 500 }}>Aucun workflow créé</p>
                  <p style={{ fontSize: 13, marginTop: 4 }}>Utilisez un template ou créez votre premier workflow</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Panel détail */}
        {selected && (
          <div style={{ width: 360, borderLeft: '1px solid var(--border-color)', background: 'var(--bg-card)', overflow: 'auto', flexShrink: 0 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{selected.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                  {TRIGGER_LABELS[selected.trigger_type]} · {selected.run_count} runs
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
            </div>

            <div style={{ padding: '16px 20px' }}>
              {/* Steps visual */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>Étapes</div>
                <div style={{ position: 'relative', paddingLeft: 28 }}>
                  <div style={{ position: 'absolute', left: 11, top: 0, bottom: 0, width: 2, background: 'var(--border-light)' }} />
                  {(selected as any).steps?.map((step: any, i: number) => (
                    <div key={step.id || i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12, position: 'relative' }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--color-primary-light)', border: '2px solid var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--color-primary)', fontSize: 11, fontWeight: 700, marginLeft: -28 }}>
                        {i + 1}
                      </div>
                      <div style={{ flex: 1, background: '#F8F9FA', borderRadius: 6, padding: '8px 10px' }}>
                        <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-primary)' }}>{step.label || step.type}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{step.type}</div>
                      </div>
                    </div>
                  )) || <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucune étape configurée</p>}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={() => triggerMutation.mutate(selected.id)} className="o-btn o-btn-primary o-btn-sm" style={{ width: '100%' }}>
                  <Play size={13} /> Déclencher maintenant
                </button>
                <button onClick={() => toggleMutation.mutate(selected.id)} className={`o-btn o-btn-sm ${selected.is_active ? 'o-btn-secondary' : 'o-btn-secondary'}`} style={{ width: '100%' }}>
                  {selected.is_active ? <><Pause size={13} /> Mettre en pause</> : <><Play size={13} /> Activer</>}
                </button>
                <button onClick={() => { if (confirm('Supprimer ce workflow ?')) deleteMutation.mutate(selected.id); }}
                  style={{ width: '100%', padding: '5px', borderRadius: 5, background: 'rgba(220,53,69,.06)', border: '1px solid rgba(220,53,69,.2)', color: '#DC3545', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                  <Trash2 size={12} /> Supprimer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal create */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 460, maxWidth: '95vw', boxShadow: 'var(--shadow-lg)', animation: 'popIn .15s ease' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 20px', color: 'var(--text-primary)' }}>Nouveau workflow</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="o-form-group" style={{ margin: 0 }}>
                <label className="o-form-label required">Nom</label>
                <input className="o-form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Notification lead chaud" />
              </div>
              <div className="o-form-group" style={{ margin: 0 }}>
                <label className="o-form-label">Déclencheur</label>
                <select className="o-form-control" value={form.trigger_type} onChange={e => setForm(f => ({ ...f, trigger_type: e.target.value }))}>
                  <option value="event">Événement système</option>
                  <option value="manual">Manuel</option>
                  <option value="schedule">Planifié (cron)</option>
                  <option value="webhook">Webhook entrant</option>
                </select>
              </div>
              {form.trigger_type === 'event' && (
                <div className="o-form-group" style={{ margin: 0 }}>
                  <label className="o-form-label">Événement</label>
                  <select className="o-form-control" value={form.trigger_event} onChange={e => setForm(f => ({ ...f, trigger_event: e.target.value }))}>
                    <option value="prospect.created">prospect.created</option>
                    <option value="prospect.scored">prospect.scored</option>
                    <option value="prospect.updated">prospect.updated</option>
                    <option value="email.sent">email.sent</option>
                    <option value="email.opened">email.opened</option>
                    <option value="email.replied">email.replied</option>
                    <option value="signal.detected">signal.detected</option>
                    <option value="sourcing.completed">sourcing.completed</option>
                  </select>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowCreate(false)} className="o-btn o-btn-secondary o-btn-sm">Annuler</button>
              <button disabled={!form.name || createMutation.isPending}
                onClick={() => createMutation.mutate({
                  name: form.name, trigger_type: form.trigger_type,
                  trigger_config: { event: form.trigger_event },
                  steps: [], is_active: false,
                })} className="o-btn o-btn-primary o-btn-sm">
                {createMutation.isPending ? 'Création...' : 'Créer le workflow'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes popIn { from{opacity:0;transform:scale(.96)} to{opacity:1;transform:scale(1)} }`}</style>
    </div>
  );
}
