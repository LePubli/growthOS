import { useState, useEffect } from 'react';
import { Plus, Link, Loader2, Trash2, X, Copy, CheckCircle, Play, Pause, Eye, EyeOff } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

const ALL_EVENTS = [
  { value: 'prospect.created', label: 'Prospect créé' },
  { value: 'prospect.updated', label: 'Prospect mis à jour' },
  { value: 'deal.created', label: 'Deal créé' },
  { value: 'deal.stage_changed', label: 'Stade deal changé' },
  { value: 'sequence.enrolled', label: 'Inscrit à une séquence' },
  { value: 'signal.created', label: 'Signal créé' },
];

function CreateModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', url: '', events: [] as string[] });
  const [loading, setLoading] = useState(false);
  const s = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const toggleEvent = (e: string) => {
    setForm(f => ({
      ...f, events: f.events.includes(e) ? f.events.filter(x => x !== e) : [...f.events, e],
    }));
  };

  const save = async () => {
    if (!form.name || !form.url || form.events.length === 0) {
      toast.error('Remplissez tous les champs et sélectionnez au moins un événement');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/webhooks', form);
      toast.success('Webhook créé'); onSaved(); onClose();
    } catch { toast.error('Erreur lors de la création'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Nouveau webhook</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nom *</label>
            <input value={form.name} onChange={e => s('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Ex: Zapier · Nouveau prospect" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">URL *</label>
            <input value={form.url} onChange={e => s('url', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="https://hooks.zapier.com/..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Événements *</label>
            <div className="space-y-1.5">
              {ALL_EVENTS.map(ev => (
                <label key={ev.value} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.events.includes(ev.value)} onChange={() => toggleEvent(ev.value)}
                    className="rounded border-gray-300 text-teal-600" />
                  <span className="text-sm text-gray-700">{ev.label}</span>
                  <code className="text-xs text-gray-400 ml-auto">{ev.value}</code>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Annuler</button>
          <button onClick={save} disabled={loading}
            className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}Créer
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const fetch = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get('/webhooks') as any[];
      setWebhooks(Array.isArray(data) ? data : []);
    } catch { setWebhooks([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const toggle = async (id: string) => {
    const updated: any = await apiClient.post(`/webhooks/${id}/toggle`, {});
    setWebhooks(w => w.map(x => x.id === id ? updated : x));
    toast.success(updated.status === 'active' ? 'Webhook activé' : 'Webhook mis en pause');
  };

  const deleteWebhook = async (id: string) => {
    if (!confirm('Supprimer ce webhook ?')) return;
    await apiClient.delete(`/webhooks/${id}`);
    setWebhooks(w => w.filter(x => x.id !== id));
    toast.success('Webhook supprimé');
  };

  const copy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id); setTimeout(() => setCopied(null), 2000);
    toast.success('Copié');
  };

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--body-bg)' }}>
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onSaved={fetch} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Webhooks</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Intégrez GrowthOS à vos outils (Zapier, Make, n8n…)</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: 'var(--color-primary)' }}>
          <Plus size={14} />Nouveau webhook
        </button>
      </div>

      {/* Info box */}
      <div className="rounded-2xl border p-4 mb-5 flex items-start gap-3" style={{ background: '#EFF6FF', borderColor: '#BFDBFE' }}>
        <Link size={18} style={{ color: '#2563EB', flexShrink: 0, marginTop: 2 }} />
        <div>
          <p className="text-sm font-medium" style={{ color: '#1E40AF' }}>Comment ça fonctionne</p>
          <p className="text-xs mt-0.5" style={{ color: '#3B82F6' }}>
            À chaque événement sélectionné, GrowthOS envoie une requête POST en JSON à votre URL. Utilisez le secret pour vérifier l'authenticité.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-primary)' }} /></div>
      ) : webhooks.length === 0 ? (
        <div className="text-center py-16">
          <Link size={40} className="mx-auto mb-3" style={{ color: 'var(--card-border)' }} />
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Aucun webhook configuré</p>
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-xl text-sm text-white" style={{ background: 'var(--color-primary)' }}>
            + Créer un webhook
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {webhooks.map(wh => (
            <div key={wh.id} className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{wh.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: wh.status === 'active' ? '#ECFDF5' : '#FEF3C7', color: wh.status === 'active' ? '#059669' : '#D97706' }}>
                      {wh.status === 'active' ? 'Actif' : 'En pause'}
                    </span>
                    {wh.deliveries > 0 && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{wh.deliveries} envois</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs" style={{ color: 'var(--color-primary)' }}>{wh.url}</code>
                    <button onClick={() => copy(wh.id + '_url', wh.url)} style={{ color: 'var(--text-muted)' }}>
                      {copied === wh.id + '_url' ? <CheckCircle size={12} className="text-green-500" /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  <button onClick={() => toggle(wh.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border"
                    style={wh.status === 'active'
                      ? { background: '#FEF3C7', color: '#D97706', borderColor: '#FDE68A' }
                      : { background: '#ECFDF5', color: '#059669', borderColor: '#A7F3D0' }}>
                    {wh.status === 'active' ? <><Pause size={11} />Pause</> : <><Play size={11} />Activer</>}
                  </button>
                  <button onClick={() => deleteWebhook(wh.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Événements ({(wh.events || []).length})</p>
                  <div className="flex flex-wrap gap-1">
                    {(wh.events || []).map((ev: string) => (
                      <span key={ev} className="text-xs px-2 py-0.5 rounded-lg" style={{ background: 'var(--body-bg)', color: 'var(--text-secondary)', border: '1px solid var(--card-border)' }}>
                        {ALL_EVENTS.find(e => e.value === ev)?.label || ev}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Secret de signature</p>
                  <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--body-bg)' }}>
                    <code className="text-xs flex-1" style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                      {showSecret[wh.id] ? wh.secret : '•'.repeat(24)}
                    </code>
                    <button onClick={() => setShowSecret(s => ({ ...s, [wh.id]: !s[wh.id] }))} style={{ color: 'var(--text-muted)' }}>
                      {showSecret[wh.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                    <button onClick={() => copy(wh.id + '_secret', wh.secret)} style={{ color: 'var(--text-muted)' }}>
                      {copied === wh.id + '_secret' ? <CheckCircle size={12} className="text-green-500" /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
