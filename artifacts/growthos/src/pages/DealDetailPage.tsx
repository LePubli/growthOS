import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { ArrowLeft, Edit2, Save, Loader2, Trash2, CheckCircle } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

const STAGES = [
  { value: 'lead', label: 'Lead', color: '#6B7280', prob: 10 },
  { value: 'qualified', label: 'Qualifié', color: '#2563EB', prob: 25 },
  { value: 'proposal', label: 'Proposition', color: '#7C3AED', prob: 50 },
  { value: 'negotiation', label: 'Négociation', color: '#D97706', prob: 75 },
  { value: 'won', label: 'Gagné', color: '#059669', prob: 100 },
  { value: 'lost', label: 'Perdu', color: '#EF4444', prob: 0 },
];

export default function DealDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [, navigate] = useLocation();
  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient.get(`/pipeline/${id}`)
      .then(d => { setDeal(d); setForm(d); })
      .catch(() => { toast.error('Deal introuvable'); navigate('/pipeline'); })
      .finally(() => setLoading(false));
  }, [id]);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await apiClient.patch(`/pipeline/${id}`, {
        title: form.title, company: form.company,
        value: Number(form.value), stage: form.stage,
        probability: Number(form.probability), closeDate: form.closeDate,
        prospect: form.prospect, notes: form.notes,
      });
      setDeal(updated); setEditing(false); toast.success('Deal mis à jour');
    } catch { toast.error('Erreur lors de la mise à jour'); }
    finally { setSaving(false); }
  };

  const deleteDeal = async () => {
    if (!confirm('Supprimer ce deal ?')) return;
    await apiClient.delete(`/pipeline/${id}`);
    toast.success('Deal supprimé');
    navigate('/pipeline');
  };

  const sf = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));
  const stageIdx = STAGES.findIndex(s => s.value === (deal?.stage || 'lead'));
  const stageInfo = STAGES.find(s => s.value === (deal?.stage || 'lead')) || STAGES[0];

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--body-bg)' }}>
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-primary)' }} />
    </div>
  );
  if (!deal) return null;

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--body-bg)' }}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/pipeline')} className="p-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft size={20} style={{ color: 'var(--text-muted)' }} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{deal.title}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm font-semibold" style={{ color: stageInfo.color }}>{stageInfo.label}</span>
            {deal.company && <span className="text-sm" style={{ color: 'var(--text-muted)' }}>· {deal.company}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={deleteDeal} className="p-2 rounded-xl hover:bg-red-50 text-red-400"><Trash2 size={16} /></button>
          {editing ? (
            <>
              <button onClick={() => setEditing(false)} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600">Annuler</button>
              <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ background: 'var(--color-primary)' }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}Enregistrer
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-teal-300">
              <Edit2 size={14} />Modifier
            </button>
          )}
        </div>
      </div>

      {/* Stage pipeline */}
      <div className="rounded-2xl border p-5 mb-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
        <h2 className="font-semibold mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>PROGRESSION DU DEAL</h2>
        <div className="flex items-center gap-1 mb-3">
          {STAGES.filter(s => s.value !== 'lost').map((s, i) => {
            const isActive = i <= stageIdx && deal.stage !== 'lost';
            const isCurrent = s.value === deal.stage;
            return (
              <div key={s.value} className="flex items-center flex-1">
                <button onClick={() => editing && sf('stage', s.value)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium text-center transition-all ${isCurrent ? 'text-white' : 'hover:opacity-80'}`}
                  style={{ background: isCurrent ? s.color : isActive ? `${s.color}22` : 'var(--body-bg)', color: isCurrent ? '#fff' : isActive ? s.color : 'var(--text-muted)' }}>
                  {s.label}
                </button>
                {i < STAGES.length - 2 && <div className="w-2 h-0.5 flex-shrink-0" style={{ background: 'var(--card-border)' }} />}
              </div>
            );
          })}
        </div>
        {deal.stage === 'lost' && (
          <div className="text-center py-2 rounded-xl text-sm font-medium text-white" style={{ background: '#EF4444' }}>❌ Deal perdu</div>
        )}
        <div className="flex gap-6 mt-3">
          <div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Valeur</div>
            <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{(deal.value || 0).toLocaleString('fr-FR')} €</div>
          </div>
          <div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Probabilité</div>
            <div className="text-xl font-bold" style={{ color: stageInfo.color }}>{deal.probability || 0}%</div>
          </div>
          <div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Valeur pondérée</div>
            <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {((deal.value || 0) * (deal.probability || 0) / 100).toLocaleString('fr-FR')} €
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-4">
          <div className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <h2 className="font-semibold mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>DÉTAILS</h2>
            {editing ? (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { k: 'title', l: 'Titre', type: 'text' }, { k: 'company', l: 'Entreprise', type: 'text' },
                  { k: 'value', l: 'Valeur (€)', type: 'number' }, { k: 'probability', l: 'Probabilité (%)', type: 'number' },
                  { k: 'closeDate', l: 'Date de clôture', type: 'date' }, { k: 'prospect', l: 'Prospect', type: 'text' },
                ].map(f => (
                  <div key={f.k}>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{f.l}</label>
                    <input type={f.type} value={form[f.k] || ''} onChange={e => sf(f.k, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Stade</label>
                  <div className="flex gap-2 flex-wrap">
                    {STAGES.map(s => (
                      <button key={s.value} onClick={() => sf('stage', s.value)}
                        className="px-3 py-1.5 rounded-xl text-xs font-medium border transition-all"
                        style={form.stage === s.value ? { background: s.color, color: '#fff', borderColor: s.color } : { background: 'transparent', color: s.color, borderColor: s.color }}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {[
                  { l: 'Entreprise', v: deal.company }, { l: 'Prospect', v: deal.prospect },
                  { l: 'Date de clôture', v: deal.closeDate }, { l: 'ID', v: deal.id?.slice(0, 8) + '...' },
                ].map(f => (
                  <div key={f.l}>
                    <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{f.l}</div>
                    <div className="text-sm font-medium" style={{ color: f.v ? 'var(--text-primary)' : 'var(--text-muted)' }}>{f.v || '—'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <h2 className="font-semibold mb-3 text-sm" style={{ color: 'var(--text-muted)' }}>NOTES</h2>
            {editing ? (
              <textarea value={form.notes || ''} onChange={e => sf('notes', e.target.value)} rows={4}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                placeholder="Notes internes sur ce deal..." />
            ) : (
              <p className="text-sm" style={{ color: deal.notes ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {deal.notes || 'Aucune note. Cliquez sur Modifier pour en ajouter.'}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <h2 className="font-semibold mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>TIMELINE</h2>
            <div className="space-y-3">
              <div className="flex gap-3 items-start">
                <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'var(--color-primary)' }} />
                <div>
                  <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Deal créé</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {new Date(deal.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: stageInfo.color }} />
                <div>
                  <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Stade actuel : {stageInfo.label}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {new Date(deal.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
