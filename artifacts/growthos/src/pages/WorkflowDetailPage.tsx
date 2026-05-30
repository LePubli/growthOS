import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { ArrowLeft, Save, Play, Pause, Plus, Trash2, Loader2, Zap, ChevronDown, ChevronRight } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

const TRIGGERS = [
  { value: 'prospect_created', label: 'Prospect créé', icon: '👤', desc: 'Se déclenche quand un nouveau prospect est ajouté' },
  { value: 'prospect_status', label: 'Statut prospect changé', icon: '🔄', desc: 'Se déclenche quand le statut d\'un prospect change' },
  { value: 'deal_stage', label: 'Stade deal changé', icon: '📊', desc: 'Se déclenche quand un deal change de stade' },
  { value: 'email_opened', label: 'Email ouvert', icon: '📧', desc: 'Se déclenche quand un prospect ouvre un email' },
  { value: 'score_threshold', label: 'Score atteint', icon: '🎯', desc: 'Se déclenche quand le score d\'un prospect dépasse un seuil' },
  { value: 'signal_created', label: 'Signal détecté', icon: '⚡', desc: 'Se déclenche quand un nouveau signal est créé' },
  { value: 'schedule', label: 'Planifié', icon: '⏰', desc: 'Se déclenche selon un planning régulier' },
];

const ACTIONS = [
  { value: 'send_email', label: 'Envoyer un email', icon: '📧', color: '#7C3AED' },
  { value: 'add_sequence', label: 'Ajouter à une séquence', icon: '📋', color: '#2563EB' },
  { value: 'update_status', label: 'Mettre à jour le statut', icon: '🔄', color: '#059669' },
  { value: 'add_tag', label: 'Ajouter un tag', icon: '🏷️', color: '#D97706' },
  { value: 'notify_slack', label: 'Notifier Slack', icon: '💬', color: '#6366F1' },
  { value: 'webhook', label: 'Déclencher un webhook', icon: '🔗', color: '#EF4444' },
  { value: 'create_deal', label: 'Créer un deal', icon: '💼', color: '#0891B2' },
  { value: 'assign_user', label: 'Assigner un utilisateur', icon: '👥', color: '#7C3AED' },
];

interface Action {
  id: string;
  type: string;
  config: Record<string, string>;
}

export default function WorkflowDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const isNew = id === 'new';
  const [, navigate] = useLocation();
  const [workflow, setWorkflow] = useState<any>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [trigger, setTrigger] = useState('prospect_created');
  const [triggerConfig, setTriggerConfig] = useState<Record<string, string>>({});
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [showTriggers, setShowTriggers] = useState(false);

  useEffect(() => {
    if (isNew) {
      setName('Nouveau workflow');
      setWorkflow({ status: 'draft', executions: 0 });
      return;
    }
    apiClient.get(`/workflows/${id}`)
      .then((data: any) => {
        setWorkflow(data);
        setName(data.name || '');
        setDescription(data.description || '');
        setTrigger(data.trigger || 'prospect_created');
        setTriggerConfig(data.triggerConfig || {});
        setActions(Array.isArray(data.actions) ? data.actions.map((a: any, i: number) => ({
          id: a.id || `action-${i}`,
          type: a.type || a,
          config: a.config || {},
        })) : []);
      })
      .catch(() => { toast.error('Workflow introuvable'); navigate('/workflows'); })
      .finally(() => setLoading(false));
  }, [id]);

  const addAction = (type: string) => {
    setActions(a => [...a, { id: crypto.randomUUID(), type, config: {} }]);
  };

  const removeAction = (idx: number) => setActions(a => a.filter((_, i) => i !== idx));

  const updateActionConfig = (idx: number, key: string, value: string) => {
    setActions(a => a.map((act, i) => i === idx ? { ...act, config: { ...act.config, [key]: value } } : act));
  };

  const save = async () => {
    if (!name.trim()) { toast.error('Donnez un nom au workflow'); return; }
    setSaving(true);
    try {
      const payload = { name, description, trigger, triggerConfig, actions, status: workflow?.status || 'draft' };
      if (isNew) {
        const created: any = await apiClient.post('/workflows', payload);
        toast.success('Workflow créé');
        navigate(`/workflows/${created.id}`);
      } else {
        await apiClient.patch(`/workflows/${id}`, payload);
        toast.success('Workflow enregistré');
      }
    } catch { toast.error('Erreur lors de la sauvegarde'); }
    finally { setSaving(false); }
  };

  const toggleStatus = async () => {
    if (isNew) return;
    const updated: any = await apiClient.post(`/workflows/${id}/toggle`, {});
    setWorkflow((w: any) => ({ ...w, status: updated.status }));
    toast.success(updated.status === 'active' ? 'Workflow activé' : 'Mis en pause');
  };

  const triggerInfo = TRIGGERS.find(t => t.value === trigger) || TRIGGERS[0];
  const statusColor = workflow?.status === 'active' ? '#059669' : workflow?.status === 'paused' ? '#D97706' : '#6B7280';

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--body-bg)' }}>
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-primary)' }} />
    </div>
  );

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--body-bg)' }}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/workflows')} className="p-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft size={20} style={{ color: 'var(--text-muted)' }} />
        </button>
        <div className="flex-1">
          <input value={name} onChange={e => setName(e.target.value)}
            className="text-xl font-bold bg-transparent border-none outline-none w-full"
            style={{ color: 'var(--text-primary)' }} placeholder="Nom du workflow" />
          <input value={description} onChange={e => setDescription(e.target.value)}
            className="text-sm bg-transparent border-none outline-none w-full"
            style={{ color: 'var(--text-muted)' }} placeholder="Description (optionnel)" />
        </div>
        <div className="flex items-center gap-2">
          {!isNew && workflow && (
            <button onClick={toggleStatus} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border"
              style={{ background: `${statusColor}15`, color: statusColor, borderColor: `${statusColor}40` }}>
              {workflow.status === 'active' ? <><Pause size={14} />Pause</> : <><Play size={14} />Activer</>}
            </button>
          )}
          <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ background: 'var(--color-primary)' }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isNew ? 'Créer' : 'Enregistrer'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Builder */}
        <div className="col-span-2 space-y-4">
          {/* Trigger */}
          <div className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <h2 className="font-semibold mb-3 text-sm flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
              <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 text-xs flex items-center justify-center font-bold">1</span>
              DÉCLENCHEUR
            </h2>
            <button onClick={() => setShowTriggers(!showTriggers)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border transition-all hover:border-teal-300"
              style={{ background: 'var(--body-bg)', borderColor: 'var(--card-border)' }}>
              <span className="text-2xl">{triggerInfo.icon}</span>
              <div className="flex-1 text-left">
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{triggerInfo.label}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{triggerInfo.desc}</div>
              </div>
              {showTriggers ? <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />}
            </button>
            {showTriggers && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {TRIGGERS.map(t => (
                  <button key={t.value} onClick={() => { setTrigger(t.value); setShowTriggers(false); }}
                    className="flex items-center gap-2 p-3 rounded-xl border text-left transition-all hover:border-teal-300"
                    style={trigger === t.value
                      ? { background: 'var(--color-primary)', borderColor: 'var(--color-primary)' }
                      : { background: 'var(--body-bg)', borderColor: 'var(--card-border)' }}>
                    <span className="text-lg">{t.icon}</span>
                    <div>
                      <div className="text-xs font-semibold" style={{ color: trigger === t.value ? '#fff' : 'var(--text-primary)' }}>{t.label}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {trigger === 'score_threshold' && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Score supérieur à</span>
                <input type="number" min={0} max={100} value={triggerConfig.threshold || '70'}
                  onChange={e => setTriggerConfig(c => ({ ...c, threshold: e.target.value }))}
                  className="w-20 px-2 py-1 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
            )}
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-4" style={{ background: 'var(--card-border)' }} />
              <Zap size={16} style={{ color: 'var(--color-primary)' }} />
              <div className="w-0.5 h-4" style={{ background: 'var(--card-border)' }} />
            </div>
          </div>

          {/* Actions */}
          <div className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <h2 className="font-semibold mb-3 text-sm flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
              <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-600 text-xs flex items-center justify-center font-bold">2</span>
              ACTIONS ({actions.length})
            </h2>
            {actions.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed rounded-xl" style={{ borderColor: 'var(--card-border)' }}>
                <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>Aucune action</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Ajoutez des actions ci-dessous</p>
              </div>
            ) : (
              <div className="space-y-2 mb-4">
                {actions.map((action, i) => {
                  const actionInfo = ACTIONS.find(a => a.value === action.type) || ACTIONS[0];
                  return (
                    <div key={action.id} className="flex items-center gap-3 p-3 rounded-xl border"
                      style={{ background: 'var(--body-bg)', borderColor: 'var(--card-border)' }}>
                      <span className="text-lg">{actionInfo.icon}</span>
                      <div className="flex-1">
                        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{actionInfo.label}</div>
                        {(action.type === 'send_email' || action.type === 'add_sequence') && (
                          <input value={action.config.target || ''} onChange={e => updateActionConfig(i, 'target', e.target.value)}
                            className="mt-1.5 w-full px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
                            placeholder={action.type === 'send_email' ? 'Sujet ou ID template...' : 'Nom de la séquence...'} />
                        )}
                        {action.type === 'update_status' && (
                          <select value={action.config.status || 'contacted'} onChange={e => updateActionConfig(i, 'status', e.target.value)}
                            className="mt-1.5 px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none">
                            {['new', 'contacted', 'qualified', 'negotiation', 'won', 'lost'].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        )}
                        {action.type === 'webhook' && (
                          <input value={action.config.url || ''} onChange={e => updateActionConfig(i, 'url', e.target.value)}
                            className="mt-1.5 w-full px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
                            placeholder="https://..." />
                        )}
                      </div>
                      <button onClick={() => removeAction(i)} className="text-red-400 hover:text-red-600 flex-shrink-0"><Trash2 size={14} /></button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="border-t pt-3" style={{ borderColor: 'var(--card-border)' }}>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Ajouter une action :</p>
              <div className="flex flex-wrap gap-2">
                {ACTIONS.map(a => (
                  <button key={a.value} onClick={() => addAction(a.value)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border hover:shadow-sm transition-all"
                    style={{ background: `${a.color}10`, color: a.color, borderColor: `${a.color}30` }}>
                    <span>{a.icon}</span>{a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {!isNew && workflow && (
            <div className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
              <h2 className="font-semibold mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>STATISTIQUES</h2>
              <div className="space-y-3">
                {[
                  { l: 'Statut', v: workflow.status === 'active' ? 'Actif' : workflow.status === 'paused' ? 'Pause' : 'Brouillon', color: statusColor },
                  { l: 'Exécutions totales', v: workflow.executions || 0 },
                  { l: 'Dernière exécution', v: workflow.lastRunAt ? new Date(workflow.lastRunAt).toLocaleDateString('fr-FR') : '—' },
                  { l: 'Créé le', v: new Date(workflow.createdAt).toLocaleDateString('fr-FR') },
                ].map(m => (
                  <div key={m.l} className="flex justify-between items-center">
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{m.l}</span>
                    <span className="text-sm font-semibold" style={{ color: (m as any).color || 'var(--text-primary)' }}>{m.v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <h2 className="font-semibold mb-3 text-sm" style={{ color: 'var(--text-muted)' }}>CONSEILS</h2>
            <ul className="space-y-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <li>💡 Commencez simple : 1 déclencheur + 1-2 actions</li>
              <li>🧪 Testez en brouillon avant d'activer</li>
              <li>📊 Vérifiez les stats après activation</li>
              <li>⚠️ Un workflow actif s'exécute en temps réel</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
