import { useState, useEffect } from 'react';
import {
  Clock, Plus, Mail, Phone, Calendar, FileText, CheckCircle,
  Loader2, Trash2, X, Filter,
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

const TYPES = [
  { value: 'all', label: 'Toutes' },
  { value: 'note', label: 'Notes', icon: <FileText size={13} />, color: '#6B7280', bg: '#F3F4F6' },
  { value: 'call', label: 'Appels', icon: <Phone size={13} />, color: '#2563EB', bg: '#EFF6FF' },
  { value: 'email', label: 'Emails', icon: <Mail size={13} />, color: '#7C3AED', bg: '#EDE9FE' },
  { value: 'meeting', label: 'Réunions', icon: <Calendar size={13} />, color: '#059669', bg: '#ECFDF5' },
  { value: 'task', label: 'Tâches', icon: <CheckCircle size={13} />, color: '#D97706', bg: '#FEF3C7' },
];

function CreateModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ type: 'note', title: '', description: '', status: 'done' });
  const [loading, setLoading] = useState(false);
  const s = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title) return;
    setLoading(true);
    try {
      await apiClient.post('/activities', form);
      onSaved(); onClose(); toast.success('Activité créée');
    } catch { toast.error('Erreur'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Nouvelle activité</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
            <div className="flex gap-2 flex-wrap">
              {TYPES.filter(t => t.value !== 'all').map(t => (
                <button key={t.value} onClick={() => s('type', t.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${form.type === t.value ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                  {t.icon}{t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Titre *</label>
            <input value={form.title} onChange={e => s('title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Résumé de l'activité..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <textarea value={form.description} onChange={e => s('description', e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              placeholder="Détails..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Statut</label>
            <select value={form.status} onChange={e => s('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="done">Fait</option>
              <option value="planned">Planifié</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Annuler</button>
          <button onClick={save} disabled={!form.title || loading}
            className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}Créer
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (typeFilter !== 'all') params.type = typeFilter;
      const data = await apiClient.get('/activities', { params }) as any[];
      setActivities(Array.isArray(data) ? data : []);
    } catch { setActivities([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [typeFilter]);

  const deleteActivity = async (id: string) => {
    await apiClient.delete(`/activities/${id}`);
    setActivities(a => a.filter(x => x.id !== id));
    toast.success('Activité supprimée');
  };

  const counts = TYPES.reduce((acc, t) => {
    if (t.value !== 'all') acc[t.value] = activities.filter(a => a.type === t.value).length;
    return acc;
  }, {} as Record<string, number>);

  const typeMap = TYPES.reduce((acc, t) => { acc[t.value] = t; return acc; }, {} as any);

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--body-bg)' }}>
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onSaved={fetch} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Activités</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {activities.length} activité{activities.length > 1 ? 's' : ''} au total
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: 'var(--color-primary)' }}>
          <Plus size={14} />Nouvelle activité
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {TYPES.filter(t => t.value !== 'all').map(t => (
          <div key={t.value} className="rounded-2xl border p-4 flex items-center gap-3 cursor-pointer transition-all"
            onClick={() => setTypeFilter(t.value === typeFilter ? 'all' : t.value)}
            style={{ background: typeFilter === t.value ? t.bg : 'var(--card-bg)', borderColor: typeFilter === t.value ? t.color : 'var(--card-border)' }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: t.bg, color: t.color }}>
              {t.icon}
            </div>
            <div>
              <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{counts[t.value] || 0}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5">
        {TYPES.map(t => (
          <button key={t.value} onClick={() => setTypeFilter(t.value)}
            className="px-3 py-1.5 rounded-xl text-sm font-medium transition-all"
            style={typeFilter === t.value
              ? { background: 'var(--color-primary)', color: '#fff' }
              : { background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>
            {t.label}{t.value !== 'all' && counts[t.value] > 0 ? ` (${counts[t.value]})` : ''}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-primary)' }} /></div>
        ) : activities.length === 0 ? (
          <div className="text-center py-16">
            <Clock size={40} className="mx-auto mb-3" style={{ color: 'var(--card-border)' }} />
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Aucune activité enregistrée</p>
            <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-xl text-sm text-white" style={{ background: 'var(--color-primary)' }}>
              + Créer une activité
            </button>
          </div>
        ) : (
          <div>
            {activities.map((act, i) => {
              const t = typeMap[act.type] || typeMap.note;
              return (
                <div key={act.id} className="flex items-start gap-4 p-4 border-b last:border-b-0 hover:bg-opacity-50 transition-colors"
                  style={{ borderColor: 'var(--card-border)' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: t.bg, color: t.color }}>
                    {t.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{act.title}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{
                        background: act.status === 'done' ? '#ECFDF5' : '#FEF3C7',
                        color: act.status === 'done' ? '#059669' : '#D97706',
                      }}>{act.status === 'done' ? 'Fait' : 'Planifié'}</span>
                    </div>
                    {act.description && <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{act.description}</p>}
                    <div className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                      {t.label} · {new Date(act.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <button onClick={() => deleteActivity(act.id)} className="text-red-400 hover:text-red-600 flex-shrink-0 mt-1">
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
