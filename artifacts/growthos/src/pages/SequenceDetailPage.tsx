import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import {
  ArrowLeft, Save, Play, Pause, Plus, Trash2, Loader2, Mail,
  Clock, ChevronDown, ChevronUp, Edit2, X, GripVertical,
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

interface Step {
  id: string;
  type: 'email' | 'delay' | 'condition';
  subject?: string;
  body?: string;
  delayDays?: number;
  delayHours?: number;
  condition?: string;
}

function StepCard({ step, onUpdate, onDelete, index }: {
  step: Step; onUpdate: (s: Step) => void; onDelete: () => void; index: number;
}) {
  const [expanded, setExpanded] = useState(index === 0);

  if (step.type === 'delay') {
    return (
      <div className="flex items-center gap-3 py-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#FEF3C7' }}>
          <Clock size={14} style={{ color: '#D97706' }} />
        </div>
        <div className="flex-1 flex items-center gap-2">
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Attendre</span>
          <input type="number" min={0} value={step.delayDays || 0}
            onChange={e => onUpdate({ ...step, delayDays: parseInt(e.target.value) || 0 })}
            className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-500" />
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>jour(s)</span>
          <input type="number" min={0} max={23} value={step.delayHours || 0}
            onChange={e => onUpdate({ ...step, delayHours: parseInt(e.target.value) || 0 })}
            className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-500" />
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>heure(s)</span>
        </div>
        <button onClick={onDelete} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--card-border)', background: 'var(--card-bg)' }}>
      <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <GripVertical size={14} style={{ color: 'var(--text-muted)' }} />
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#EDE9FE' }}>
          <Mail size={14} style={{ color: '#7C3AED' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {step.subject || 'Email sans objet'}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Étape {index + 1} · Email</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-red-400 hover:text-red-600"><Trash2 size={13} /></button>
          {expanded ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--card-border)' }}>
          <div className="pt-3 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Objet de l'email</label>
              <input value={step.subject || ''} onChange={e => onUpdate({ ...step, subject: e.target.value })}
                placeholder="Ex: [Prénom], question rapide sur {{company}}"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Corps du message</label>
              <textarea value={step.body || ''} onChange={e => onUpdate({ ...step, body: e.target.value })} rows={6}
                placeholder={'Bonjour {{first_name}},\n\nJ\'ai vu que vous travaillez chez {{company}}...\n\nCordialement,\n{{sender_name}}'}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
              <div className="flex gap-1 mt-1 flex-wrap">
                {['{{first_name}}', '{{last_name}}', '{{company}}', '{{job_title}}', '{{sender_name}}'].map(v => (
                  <button key={v} onClick={() => onUpdate({ ...step, body: (step.body || '') + v })}
                    className="text-xs px-2 py-0.5 rounded-md" style={{ background: 'var(--body-bg)', color: 'var(--color-primary)', border: '1px solid var(--card-border)' }}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SequenceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const isNew = id === 'new';
  const [, navigate] = useLocation();
  const [sequence, setSequence] = useState<any>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) {
      setSequence({ status: 'draft', enrolled: 0, openRate: 0, replyRate: 0 });
      setName('Nouvelle séquence');
      setSteps([{ id: crypto.randomUUID(), type: 'email', subject: '', body: '' }]);
      return;
    }
    apiClient.get(`/sequences/${id}`)
      .then((data: any) => {
        setSequence(data);
        setName(data.name || '');
        setDescription(data.description || '');
        setSteps(Array.isArray(data.steps) && data.steps.length > 0 ? data.steps : [{ id: crypto.randomUUID(), type: 'email', subject: '', body: '' }]);
      })
      .catch(() => { toast.error('Séquence introuvable'); navigate('/sequences'); })
      .finally(() => setLoading(false));
  }, [id]);

  const addStep = (type: 'email' | 'delay') => {
    const newStep: Step = type === 'email'
      ? { id: crypto.randomUUID(), type: 'email', subject: '', body: '' }
      : { id: crypto.randomUUID(), type: 'delay', delayDays: 2, delayHours: 0 };
    setSteps(s => [...s, newStep]);
  };

  const updateStep = (idx: number, updated: Step) => setSteps(s => s.map((st, i) => i === idx ? updated : st));
  const deleteStep = (idx: number) => setSteps(s => s.filter((_, i) => i !== idx));

  const save = async () => {
    if (!name.trim()) { toast.error('Donnez un nom à la séquence'); return; }
    setSaving(true);
    try {
      if (isNew) {
        const created: any = await apiClient.post('/sequences', { name, description, steps, status: 'draft' });
        toast.success('Séquence créée');
        navigate(`/sequences/${created.id}`);
      } else {
        await apiClient.patch(`/sequences/${id}`, { name, description, steps });
        toast.success('Séquence enregistrée');
      }
    } catch { toast.error('Erreur lors de la sauvegarde'); }
    finally { setSaving(false); }
  };

  const toggleStatus = async () => {
    if (isNew) return;
    const updated: any = await apiClient.post(`/sequences/${id}/toggle`, {});
    setSequence((s: any) => ({ ...s, status: updated.status }));
    toast.success(updated.status === 'active' ? 'Séquence activée' : 'Séquence mise en pause');
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--body-bg)' }}>
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-primary)' }} />
    </div>
  );

  const statusColor = sequence?.status === 'active' ? '#059669' : sequence?.status === 'paused' ? '#D97706' : '#6B7280';

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--body-bg)' }}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/sequences')} className="p-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft size={20} style={{ color: 'var(--text-muted)' }} />
        </button>
        <div className="flex-1">
          <input value={name} onChange={e => setName(e.target.value)}
            className="text-xl font-bold bg-transparent border-none outline-none w-full"
            style={{ color: 'var(--text-primary)' }} placeholder="Nom de la séquence" />
          <input value={description} onChange={e => setDescription(e.target.value)}
            className="text-sm bg-transparent border-none outline-none w-full"
            style={{ color: 'var(--text-muted)' }} placeholder="Description (optionnel)" />
        </div>
        <div className="flex items-center gap-2">
          {!isNew && sequence && (
            <button onClick={toggleStatus}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border"
              style={{ background: `${statusColor}15`, color: statusColor, borderColor: `${statusColor}40` }}>
              {sequence.status === 'active' ? <><Pause size={14} />Pause</> : <><Play size={14} />Activer</>}
            </button>
          )}
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
            style={{ background: 'var(--color-primary)' }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isNew ? 'Créer' : 'Enregistrer'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Steps editor */}
        <div className="col-span-2">
          <div className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-sm" style={{ color: 'var(--text-muted)' }}>
                ÉTAPES ({steps.filter(s => s.type === 'email').length} email{steps.filter(s => s.type === 'email').length > 1 ? 's' : ''})
              </h2>
              <div className="flex gap-2">
                <button onClick={() => addStep('delay')} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border"
                  style={{ borderColor: 'var(--card-border)', color: 'var(--text-secondary)', background: 'var(--body-bg)' }}>
                  <Clock size={12} />Délai
                </button>
                <button onClick={() => addStep('email')} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl text-white"
                  style={{ background: 'var(--color-primary)' }}>
                  <Plus size={12} />Email
                </button>
              </div>
            </div>

            {steps.length === 0 ? (
              <div className="text-center py-12">
                <Mail size={40} className="mx-auto mb-3" style={{ color: 'var(--card-border)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Ajoutez votre premier email</p>
                <button onClick={() => addStep('email')} className="mt-3 px-4 py-2 rounded-xl text-sm text-white" style={{ background: 'var(--color-primary)' }}>
                  + Premier email
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {steps.map((step, i) => (
                  <div key={step.id}>
                    <StepCard step={step} index={i} onUpdate={(s) => updateStep(i, s)} onDelete={() => deleteStep(i)} />
                    {i < steps.length - 1 && (
                      <div className="flex justify-center my-1">
                        <div className="w-0.5 h-4" style={{ background: 'var(--card-border)' }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats sidebar */}
        <div className="space-y-4">
          {!isNew && sequence && (
            <div className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
              <h2 className="font-semibold mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>PERFORMANCE</h2>
              <div className="space-y-3">
                {[
                  { l: 'Statut', v: sequence.status === 'active' ? 'Actif' : sequence.status === 'paused' ? 'En pause' : 'Brouillon', color: statusColor },
                  { l: 'Inscrits', v: sequence.enrolled || 0 },
                  { l: 'Terminés', v: sequence.completed || 0 },
                  { l: 'Taux ouverture', v: `${sequence.openRate || 0}%` },
                  { l: 'Taux de réponse', v: `${sequence.replyRate || 0}%` },
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
            <h2 className="font-semibold mb-3 text-sm" style={{ color: 'var(--text-muted)' }}>VARIABLES DISPONIBLES</h2>
            <div className="space-y-1">
              {[
                { v: '{{first_name}}', l: 'Prénom' },
                { v: '{{last_name}}', l: 'Nom' },
                { v: '{{company}}', l: 'Entreprise' },
                { v: '{{job_title}}', l: 'Poste' },
                { v: '{{sender_name}}', l: 'Expéditeur' },
                { v: '{{unsubscribe_link}}', l: 'Désabonnement' },
              ].map(({ v, l }) => (
                <div key={v} className="flex justify-between items-center py-1">
                  <code className="text-xs" style={{ color: 'var(--color-primary)' }}>{v}</code>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
