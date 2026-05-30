import { useState, useEffect } from 'react';
import { Plus, FileText, Loader2, Trash2, X, Copy, CheckCircle, Edit2, Save } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

const CATEGORIES = [
  { value: 'all', label: 'Tous' },
  { value: 'outreach', label: 'Prospection', color: '#7C3AED' },
  { value: 'followup', label: 'Relance', color: '#2563EB' },
  { value: 'closing', label: 'Closing', color: '#059669' },
  { value: 'nurturing', label: 'Nurturing', color: '#D97706' },
  { value: 'other', label: 'Autre', color: '#6B7280' },
];
const CAT_COLORS: Record<string, string> = {
  outreach: '#7C3AED', followup: '#2563EB', closing: '#059669', nurturing: '#D97706', other: '#6B7280',
};

const DEFAULT_TEMPLATES = [
  {
    name: 'Email de prospection froid',
    subject: '{{first_name}}, question sur {{company}}',
    body: `Bonjour {{first_name}},

J'ai vu que vous travaillez chez {{company}} en tant que {{job_title}}.

Nous aidons des entreprises comme la vôtre à [valeur ajoutée].

Seriez-vous disponible pour un rapide échange de 15 min cette semaine ?

Cordialement,
{{sender_name}}`,
    category: 'outreach',
    variables: ['first_name', 'company', 'job_title', 'sender_name'],
  },
  {
    name: 'Relance J+3',
    subject: 'Re: {{first_name}}, question sur {{company}}',
    body: `Bonjour {{first_name}},

Je me permets de revenir vers vous suite à mon email de la semaine dernière.

Je comprends que vous êtes certainement très occupé(e). Je reste disponible si vous souhaitez qu'on en discute.

Cordialement,
{{sender_name}}`,
    category: 'followup',
    variables: ['first_name', 'company', 'sender_name'],
  },
];

function TemplateModal({ template, onClose, onSaved }: { template?: any; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!template;
  const [form, setForm] = useState({
    name: template?.name || '',
    subject: template?.subject || '',
    body: template?.body || '',
    category: template?.category || 'outreach',
  });
  const [loading, setLoading] = useState(false);
  const s = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name || !form.subject || !form.body) { toast.error('Remplissez tous les champs'); return; }
    setLoading(true);
    try {
      const variables = (form.body + ' ' + form.subject).match(/\{\{(\w+)\}\}/g)?.map(v => v.slice(2, -2)) || [];
      if (isEdit) {
        await apiClient.patch(`/templates/${template.id}`, { ...form, variables });
        toast.success('Template mis à jour');
      } else {
        await apiClient.post('/templates', { ...form, variables });
        toast.success('Template créé');
      }
      onSaved(); onClose();
    } catch { toast.error('Erreur lors de la sauvegarde'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'Modifier le template' : 'Nouveau template'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nom du template *</label>
              <input value={form.name} onChange={e => s('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="Ex: Prospection LinkedIn" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Catégorie</label>
              <select value={form.category} onChange={e => s('category', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                {CATEGORIES.filter(c => c.value !== 'all').map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Objet *</label>
            <input value={form.subject} onChange={e => s('subject', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Objet de l'email avec {{variables}}" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Corps du message *</label>
            <textarea value={form.body} onChange={e => s('body', e.target.value)} rows={8}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              placeholder="Contenu avec {{first_name}}, {{company}}, etc." />
            <div className="flex gap-1 mt-1 flex-wrap">
              {['{{first_name}}', '{{last_name}}', '{{company}}', '{{job_title}}', '{{sender_name}}'].map(v => (
                <button key={v} onClick={() => s('body', form.body + v)}
                  className="text-xs px-2 py-0.5 rounded-md bg-gray-100 text-teal-700 hover:bg-teal-50">{v}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Annuler</button>
          <button onClick={save} disabled={loading}
            className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEdit ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [editTemplate, setEditTemplate] = useState<any>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [preview, setPreview] = useState<any>(null);

  const fetch = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (category !== 'all') params.category = category;
      const data = await apiClient.get('/templates', { params }) as any[];
      setTemplates(Array.isArray(data) ? data : []);
    } catch { setTemplates([]); }
    finally { setLoading(false); }
  };

  const seedDefaults = async () => {
    for (const t of DEFAULT_TEMPLATES) {
      try { await apiClient.post('/templates', t); } catch { }
    }
    fetch();
  };

  useEffect(() => { fetch(); }, [category]);

  const deleteTemplate = async (id: string) => {
    await apiClient.delete(`/templates/${id}`);
    setTemplates(t => t.filter(x => x.id !== id));
    toast.success('Template supprimé');
  };

  const copySubject = (id: string, subject: string) => {
    navigator.clipboard.writeText(subject);
    setCopied(id); setTimeout(() => setCopied(null), 2000);
    toast.success('Objet copié');
  };

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--body-bg)' }}>
      {showCreate && <TemplateModal onClose={() => setShowCreate(false)} onSaved={fetch} />}
      {editTemplate && <TemplateModal template={editTemplate} onClose={() => setEditTemplate(null)} onSaved={fetch} />}

      {preview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">{preview.name}</h2>
              <button onClick={() => setPreview(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 mb-3">
              <span className="text-xs font-medium text-gray-500">Objet : </span>
              <span className="text-sm font-medium text-gray-900">{preview.subject}</span>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap font-mono">{preview.body}</div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setPreview(null)} className="flex-1 py-2 border border-gray-200 rounded-xl text-sm text-gray-600">Fermer</button>
              <button onClick={() => { setEditTemplate(preview); setPreview(null); }} className="flex-1 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium">Modifier</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Templates Email</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{templates.length} template{templates.length > 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          {templates.length === 0 && !loading && (
            <button onClick={seedDefaults} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-teal-300">
              Charger des exemples
            </button>
          )}
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: 'var(--color-primary)' }}>
            <Plus size={14} />Nouveau template
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-5">
        {CATEGORIES.map(c => (
          <button key={c.value} onClick={() => setCategory(c.value)}
            className="px-3 py-1.5 rounded-xl text-sm font-medium transition-all"
            style={category === c.value
              ? { background: 'var(--color-primary)', color: '#fff' }
              : { background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-primary)' }} /></div>
      ) : templates.length === 0 ? (
        <div className="text-center py-16">
          <FileText size={40} className="mx-auto mb-3" style={{ color: 'var(--card-border)' }} />
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Aucun template. Créez le vôtre ou chargez des exemples.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={seedDefaults} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600">Charger des exemples</button>
            <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-xl text-sm text-white" style={{ background: 'var(--color-primary)' }}>Créer un template</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {templates.map(t => {
            const color = CAT_COLORS[t.category] || '#6B7280';
            const catLabel = CATEGORIES.find(c => c.value === t.category)?.label || t.category;
            return (
              <div key={t.id} className="rounded-2xl border p-5 hover:shadow-sm transition-all"
                style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: `${color}15`, color }}>{catLabel}</span>
                      {t.usedCount > 0 && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Utilisé {t.usedCount}×</span>}
                    </div>
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t.name}</h3>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => copySubject(t.id, t.subject)} className="p-1.5 rounded-lg hover:bg-gray-100" style={{ color: 'var(--text-muted)' }}>
                      {copied === t.id ? <CheckCircle size={14} className="text-green-500" /> : <Copy size={14} />}
                    </button>
                    <button onClick={() => setEditTemplate(t)} className="p-1.5 rounded-lg hover:bg-gray-100" style={{ color: 'var(--text-muted)' }}>
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => deleteTemplate(t.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="text-xs font-medium mb-2 px-2 py-1 rounded-lg" style={{ background: 'var(--body-bg)', color: 'var(--text-secondary)' }}>
                  📌 {t.subject}
                </div>
                <p className="text-xs line-clamp-3" style={{ color: 'var(--text-muted)', fontFamily: 'monospace', whiteSpace: 'pre-line' }}>
                  {t.body?.slice(0, 150)}{t.body?.length > 150 ? '...' : ''}
                </p>
                {t.variables?.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {t.variables.slice(0, 4).map((v: string) => (
                      <span key={v} className="text-xs px-1.5 py-0.5 rounded-md" style={{ background: `${color}10`, color }}>{'{{' + v + '}}'}</span>
                    ))}
                  </div>
                )}
                <button onClick={() => setPreview(t)} className="mt-3 text-xs font-medium" style={{ color: 'var(--color-primary)' }}>
                  Aperçu complet →
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
