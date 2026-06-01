import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import {
  ArrowLeft, Save, Play, Pause, Plus, Trash2, Loader2, Mail,
  Clock, ChevronDown, ChevronUp, GripVertical, Eye, BarChart2,
  Users, TrendingUp, MessageSquare, CheckCircle2, Send,
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';
import EmailEditor from '@/components/common/EmailEditor';

/* ─────────────────── types ─────────────────── */

interface Step {
  id: string;
  type: 'email' | 'delay' | 'condition';
  subject?: string;
  body?: string;
  delayDays?: number;
  delayHours?: number;
  condition?: string;
}

/* ─────────────────── vars ─────────────────── */

const EMAIL_VARS = [
  { key: 'first_name',      label: 'Prénom' },
  { key: 'last_name',       label: 'Nom' },
  { key: 'company',         label: 'Entreprise' },
  { key: 'job_title',       label: 'Poste' },
  { key: 'sender_name',     label: 'Expéditeur' },
  { key: 'unsubscribe_link',label: 'Désabonnement' },
];

const PREVIEW_DATA: Record<string, string> = {
  first_name: 'Jean', last_name: 'Dupont', company: 'Acme SAS',
  job_title: 'Dir. Commercial', sender_name: 'Alice Martin', unsubscribe_link: '#',
};

function subjectPreview(subject: string): string {
  return subject.replace(/\{\{(\w+)\}\}/g, (_, k) => PREVIEW_DATA[k] || `{{${k}}}`);
}

/* ─────────────────── delay step ─────────────────── */

function DelayCard({ step, onUpdate, onDelete }: { step: Step; onUpdate: (s: Step) => void; onDelete: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, border: '1px dashed var(--card-border)', background: 'var(--card-bg)' }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Clock size={14} color="#D97706" />
      </div>
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Attendre</span>
      <input type="number" min={0} value={step.delayDays || 0}
        onChange={e => onUpdate({ ...step, delayDays: parseInt(e.target.value) || 0 })}
        style={{ width: 52, padding: '4px 8px', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 13, textAlign: 'center', background: 'var(--body-bg)', color: 'var(--text-primary)', outline: 'none' }} />
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>j</span>
      <input type="number" min={0} max={23} value={step.delayHours || 0}
        onChange={e => onUpdate({ ...step, delayHours: parseInt(e.target.value) || 0 })}
        style={{ width: 52, padding: '4px 8px', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 13, textAlign: 'center', background: 'var(--body-bg)', color: 'var(--text-primary)', outline: 'none' }} />
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>h</span>
      <div style={{ flex: 1 }} />
      <button onClick={onDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', display: 'flex', padding: 4 }}><Trash2 size={13} /></button>
    </div>
  );
}

/* ─────────────────── email step card ─────────────────── */

function EmailCard({ step, onUpdate, onDelete, index, active, onActivate }: {
  step: Step; onUpdate: (s: Step) => void; onDelete: () => void;
  index: number; active: boolean; onActivate: () => void;
}) {
  const hasContent = !!(step.subject || step.body);

  return (
    <div style={{ borderRadius: 14, border: `1.5px solid ${active ? 'var(--color-primary)' : 'var(--card-border)'}`, overflow: 'hidden', background: 'var(--card-bg)', transition: 'border-color .2s, box-shadow .2s', boxShadow: active ? '0 0 0 3px rgba(109,40,217,.1)' : 'none' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: active ? 'var(--body-bg)' : 'transparent' }} onClick={onActivate}>
        <GripVertical size={13} color="var(--text-muted)" style={{ flexShrink: 0, opacity: 0.5 }} />
        <div style={{ width: 28, height: 28, borderRadius: 8, background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Mail size={12} color="#7C3AED" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {step.subject ? subjectPreview(step.subject) : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Sans objet</span>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Email {index + 1}{hasContent ? '' : ' — cliquez pour rédiger'}</div>
        </div>
        {hasContent && (
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', flexShrink: 0 }} title="Contenu rédigé" />
        )}
        <button onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', display: 'flex', padding: 4, flexShrink: 0 }}>
          <Trash2 size={12} />
        </button>
        {active ? <ChevronUp size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} /> : <ChevronDown size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />}
      </div>

      {/* Editor body */}
      {active && (
        <div style={{ borderTop: '1px solid var(--card-border)' }}>
          {/* Subject */}
          <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--card-border)', padding: '0 14px' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', width: 52, flexShrink: 0 }}>Objet</span>
            <input
              value={step.subject || ''}
              onChange={e => onUpdate({ ...step, subject: e.target.value })}
              placeholder="Ex: {{first_name}}, question rapide…"
              style={{ flex: 1, padding: '10px 0', border: 'none', outline: 'none', fontSize: 13, background: 'transparent', color: 'var(--text-primary)' }}
            />
          </div>

          {/* WYSIWYG editor */}
          <EmailEditor
            value={step.body || ''}
            onChange={body => onUpdate({ ...step, body })}
            placeholder="Bonjour {{first_name}},&#10;&#10;J'ai vu que vous travaillez chez {{company}}…"
            minHeight={220}
            variables={EMAIL_VARS}
          />
        </div>
      )}
    </div>
  );
}

/* ─────────────────── connector ─────────────────── */

function Connector() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '2px 0' }}>
      <div style={{ width: 1.5, height: 16, background: 'var(--card-border)' }} />
    </div>
  );
}

/* ─────────────────── main page ─────────────────── */

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
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [rightPanel, setRightPanel] = useState<'stats' | 'preview'>('stats');

  useEffect(() => {
    if (isNew) {
      const firstId = crypto.randomUUID();
      setSequence({ status: 'draft', enrolled: 0, openRate: 0, replyRate: 0 });
      setName('Nouvelle séquence');
      setSteps([{ id: firstId, type: 'email', subject: '', body: '' }]);
      setActiveStepId(firstId);
      return;
    }
    apiClient.get(`/sequences/${id}`)
      .then((data: any) => {
        setSequence(data);
        setName(data.name || '');
        setDescription(data.description || '');
        const loaded = Array.isArray(data.steps) && data.steps.length > 0
          ? data.steps
          : [{ id: crypto.randomUUID(), type: 'email', subject: '', body: '' }];
        setSteps(loaded);
        setActiveStepId(loaded[0]?.id || null);
      })
      .catch(() => { toast.error('Séquence introuvable'); navigate('/sequences'); })
      .finally(() => setLoading(false));
  }, [id]);

  const addStep = (type: 'email' | 'delay') => {
    const newStep: Step = type === 'email'
      ? { id: crypto.randomUUID(), type: 'email', subject: '', body: '' }
      : { id: crypto.randomUUID(), type: 'delay', delayDays: 2, delayHours: 0 };
    setSteps(s => [...s, newStep]);
    if (type === 'email') setActiveStepId(newStep.id);
  };

  const updateStep = (idx: number, updated: Step) => setSteps(s => s.map((st, i) => i === idx ? updated : st));
  const deleteStep = (idx: number) => {
    setSteps(s => {
      const next = s.filter((_, i) => i !== idx);
      if (s[idx]?.id === activeStepId) setActiveStepId(next[Math.max(0, idx - 1)]?.id || null);
      return next;
    });
  };

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
    try {
      const updated: any = await apiClient.post(`/sequences/${id}/toggle`, {});
      setSequence((s: any) => ({ ...s, status: updated.status }));
      toast.success(updated.status === 'active' ? 'Séquence activée' : 'Séquence mise en pause');
    } catch { toast.error('Erreur'); }
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--body-bg)' }}>
      <Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
    </div>
  );

  const statusColor = sequence?.status === 'active' ? '#059669' : sequence?.status === 'paused' ? '#D97706' : '#6B7280';
  const emailSteps = steps.filter(s => s.type === 'email');
  const activeEmailStep = steps.find(s => s.id === activeStepId && s.type === 'email');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--body-bg)' }}>
      {/* ── Top bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 24px', borderBottom: '1px solid var(--card-border)', background: 'var(--card-bg)' }}>
        <button onClick={() => navigate('/sequences')} style={{ padding: 8, borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--body-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>
          <ArrowLeft size={16} />
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <input value={name} onChange={e => setName(e.target.value)}
            style={{ fontSize: 17, fontWeight: 700, background: 'transparent', border: 'none', outline: 'none', width: '100%', color: 'var(--text-primary)' }}
            placeholder="Nom de la séquence" />
          <input value={description} onChange={e => setDescription(e.target.value)}
            style={{ fontSize: 12, background: 'transparent', border: 'none', outline: 'none', width: '100%', color: 'var(--text-muted)' }}
            placeholder="Description (optionnel)" />
        </div>

        {/* Status badge */}
        {!isNew && sequence && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 9999, background: `${statusColor}15`, border: `1px solid ${statusColor}40` }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: statusColor }}>
              {sequence.status === 'active' ? 'Active' : sequence.status === 'paused' ? 'En pause' : 'Brouillon'}
            </span>
          </div>
        )}

        {!isNew && sequence && (
          <button onClick={toggleStatus} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: `1px solid ${statusColor}40`, background: `${statusColor}10`, color: statusColor, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {sequence.status === 'active' ? <><Pause size={13} />Pause</> : <><Play size={13} />Activer</>}
          </button>
        )}

        <button onClick={save} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          {isNew ? 'Créer' : 'Enregistrer'}
        </button>
      </div>

      {/* ── Body ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 0, minHeight: 'calc(100vh - 73px)' }}>

        {/* Left — flow editor */}
        <div style={{ padding: '20px 24px', borderRight: '1px solid var(--card-border)', overflowY: 'auto' }}>
          {/* Add buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', margin: 0 }}>
              Étapes — {emailSteps.length} email{emailSteps.length > 1 ? 's' : ''}
            </h2>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => addStep('delay')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 9, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>
                <Clock size={11} />Délai
              </button>
              <button onClick={() => addStep('email')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 9, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                <Plus size={11} />Email
              </button>
            </div>
          </div>

          {/* Steps */}
          {steps.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <Mail size={40} style={{ color: 'var(--card-border)', margin: '0 auto 12px' }} />
              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 12 }}>Ajoutez votre premier email</p>
              <button onClick={() => addStep('email')} style={{ padding: '8px 20px', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                + Premier email
              </button>
            </div>
          ) : (
            <div>
              {steps.map((step, i) => (
                <div key={step.id}>
                  {step.type === 'delay' ? (
                    <DelayCard step={step} onUpdate={s => updateStep(i, s)} onDelete={() => deleteStep(i)} />
                  ) : (
                    <EmailCard
                      step={step}
                      index={emailSteps.indexOf(step)}
                      onUpdate={s => updateStep(i, s)}
                      onDelete={() => deleteStep(i)}
                      active={activeStepId === step.id}
                      onActivate={() => setActiveStepId(activeStepId === step.id ? null : step.id)}
                    />
                  )}
                  {i < steps.length - 1 && <Connector />}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right — stats + preview panel */}
        <div style={{ background: 'var(--card-bg)', padding: 0, overflowY: 'auto' }}>
          {/* Tab switcher */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--card-border)' }}>
            {(['stats', 'preview'] as const).map(tab => (
              <button key={tab} onClick={() => setRightPanel(tab)}
                style={{ flex: 1, padding: '11px 0', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: rightPanel === tab ? 'var(--color-primary)' : 'var(--text-muted)', borderBottom: `2px solid ${rightPanel === tab ? 'var(--color-primary)' : 'transparent'}`, transition: 'all .15s' }}>
                {tab === 'stats' ? '📊 Stats' : '👁 Aperçu'}
              </button>
            ))}
          </div>

          {/* STATS panel */}
          {rightPanel === 'stats' && (
            <div style={{ padding: 18 }}>
              {!isNew && sequence ? (
                <>
                  {/* KPI grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                    {[
                      { icon: <Users size={14} />, label: 'Inscrits', value: sequence.enrolled || 0, color: '#2563EB', bg: '#EFF6FF' },
                      { icon: <CheckCircle2 size={14} />, label: 'Terminés', value: sequence.completed || 0, color: '#059669', bg: '#ECFDF5' },
                      { icon: <Eye size={14} />, label: 'Ouvertures', value: `${sequence.openRate || 0}%`, color: '#D97706', bg: '#FFFBEB' },
                      { icon: <MessageSquare size={14} />, label: 'Réponses', value: `${sequence.replyRate || 0}%`, color: '#7C3AED', bg: '#EDE9FE' },
                    ].map(m => (
                      <div key={m.label} style={{ borderRadius: 12, padding: '10px 12px', background: m.bg, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ color: m.color, display: 'flex', alignItems: 'center', gap: 4 }}>{m.icon}<span style={{ fontSize: 11, fontWeight: 600 }}>{m.label}</span></div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: m.color }}>{m.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Email steps mini list */}
                  <div style={{ marginBottom: 14 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Étapes email</p>
                    {emailSteps.map((s, i) => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, marginBottom: 4, background: activeStepId === s.id ? 'var(--body-bg)' : 'transparent', cursor: 'pointer', border: activeStepId === s.id ? '1px solid var(--card-border)' : '1px solid transparent' }}
                        onClick={() => { setActiveStepId(s.id); }}>
                        <div style={{ width: 20, height: 20, borderRadius: 6, background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 10, fontWeight: 700, color: '#7C3AED' }}>{i + 1}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.subject || 'Sans objet'}</div>
                        </div>
                        {!!(s.subject || s.body) && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#22C55E', flexShrink: 0 }} />}
                      </div>
                    ))}
                  </div>

                  {/* Send simulation */}
                  <button onClick={() => toast.info('Envoi de test… (simulation)')}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    <Send size={13} />Envoyer un test
                  </button>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                  <BarChart2 size={36} style={{ margin: '0 auto 10px', color: 'var(--card-border)' }} />
                  <p style={{ fontSize: 13 }}>Les statistiques apparaîtront<br />une fois la séquence créée</p>
                </div>
              )}

              {/* Variables reference */}
              <div style={{ marginTop: 16, borderRadius: 12, border: '1px solid var(--card-border)', padding: '12px 14px', background: 'var(--body-bg)' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Variables disponibles</p>
                {EMAIL_VARS.map(v => (
                  <div key={v.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
                    <code style={{ fontSize: 11, color: 'var(--color-primary)' }}>{`{{${v.key}}}`}</code>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PREVIEW panel */}
          {rightPanel === 'preview' && (
            <div style={{ padding: 16 }}>
              {activeEmailStep ? (
                <>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>
                    Email {emailSteps.indexOf(activeEmailStep) + 1} — Aperçu
                  </p>

                  {/* Email chrome */}
                  <div style={{ borderRadius: 12, border: '1px solid var(--card-border)', overflow: 'hidden', background: '#fff', marginBottom: 12 }}>
                    {/* Window chrome */}
                    <div style={{ padding: '7px 12px', background: '#F1F5F9', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {['#FC5F57', '#FEBC2E', '#28C840'].map(c => (
                        <div key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />
                      ))}
                      <span style={{ fontSize: 10, color: '#94A3B8', marginLeft: 4, fontWeight: 500 }}>Boîte de réception</span>
                    </div>

                    {/* Email header */}
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', background: '#FAFAFA' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>AM</div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Alice Martin</div>
                          <div style={{ fontSize: 11, color: '#9CA3AF' }}>alice@acme.fr → jean.dupont@prospect.fr</div>
                        </div>
                        <div style={{ fontSize: 10, color: '#9CA3AF', marginLeft: 'auto' }}>Maintenant</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                        {activeEmailStep.subject
                          ? activeEmailStep.subject.replace(/\{\{(\w+)\}\}/g, (_, k) => PREVIEW_DATA[k] || `{{${k}}}`)
                          : <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>Sans objet</span>}
                      </div>
                    </div>

                    {/* Email body */}
                    <div
                      style={{ padding: '16px 18px', fontSize: 13, lineHeight: 1.7, color: '#374151', minHeight: 120, fontFamily: 'Georgia, "Times New Roman", serif' }}
                      dangerouslySetInnerHTML={{
                        __html: activeEmailStep.body
                          ? activeEmailStep.body.replace(/\{\{(\w+)\}\}/g, (_, k) => {
                            const val = PREVIEW_DATA[k];
                            return val
                              ? `<span style="background:#EDE9FE;color:#6D28D9;padding:1px 4px;border-radius:4px;font-size:inherit">${val}</span>`
                              : `<span style="background:#FEE2E2;color:#DC2626;padding:1px 4px;border-radius:4px">{{${k}}}</span>`;
                          })
                          : '<p style="color:#9CA3AF;font-style:italic">Corps du message vide — rédigez l\'email dans l\'éditeur.</p>',
                      }}
                    />

                    {/* Footer */}
                    <div style={{ padding: '10px 16px', borderTop: '1px solid #F1F5F9', background: '#FAFAFA' }}>
                      <p style={{ fontSize: 10, color: '#9CA3AF', textAlign: 'center', margin: 0 }}>
                        Vous recevez cet email car vous êtes inscrit à notre liste. <a href="#" style={{ color: '#6D28D9' }}>Se désabonner</a>
                      </p>
                    </div>
                  </div>

                  <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                    Variables substituées avec des données de démo
                  </p>

                  {/* Step selector */}
                  {emailSteps.length > 1 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 10 }}>
                      {emailSteps.map((s, i) => (
                        <button key={s.id} onClick={() => setActiveStepId(s.id)}
                          style={{ padding: '4px 10px', borderRadius: 9999, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: activeStepId === s.id ? 'var(--color-primary)' : 'var(--body-bg)', color: activeStepId === s.id ? '#fff' : 'var(--text-muted)' }}>
                          Email {i + 1}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                  <Eye size={36} style={{ margin: '0 auto 10px', color: 'var(--card-border)' }} />
                  <p style={{ fontSize: 13 }}>Sélectionnez un email<br />pour voir son aperçu</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
