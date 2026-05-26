'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Mail, Phone, Globe, Building2, Star, Edit2, Save, X, Loader2, CheckCircle, Tag, Calendar, Clock, Zap, MessageSquare, TrendingUp, MoreHorizontal } from 'lucide-react';

const STATUS = { new:{label:'Nouveau',color:'bg-gray-100 text-gray-700'}, contacted:{label:'Contacté',color:'bg-blue-50 text-blue-700'}, qualified:{label:'Qualifié',color:'bg-purple-50 text-purple-700'}, negotiation:{label:'Négociation',color:'bg-amber-50 text-amber-700'}, won:{label:'Gagné',color:'bg-green-50 text-green-700'}, lost:{label:'Perdu',color:'bg-red-50 text-red-700'} };

const MOCK_ACTIVITIES = [
  { id:'1', type:'email', title:'Email envoyé', desc:'Objet: Présentation de notre solution', time:'il y a 2h', icon:'📧' },
  { id:'2', type:'note', title:'Note ajoutée', desc:'Intéressé par notre offre Enterprise, rappeler vendredi', time:'il y a 1j', icon:'📝' },
  { id:'3', type:'call', title:'Appel effectué', desc:'Durée: 8 minutes — positif', time:'il y a 3j', icon:'📞' },
  { id:'4', type:'created', title:'Prospect créé', desc:'Ajouté via import LinkedIn', time:'il y a 1 sem.', icon:'✨' },
];

export default function ProspectDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [prospect, setProspect] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');
  const API = process.env.NEXT_PUBLIC_API_URL || '';

  useEffect(() => {
    const fetchProspect = async () => {
      try {
        const token = localStorage.getItem('access_token') || '';
        const res = await fetch(`${API}/api/v1/prospects/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) { const d = await res.json(); setProspect(d); setForm(d); }
        else throw new Error();
      } catch {
        setProspect({ id, firstName:'Sophie', lastName:'Martin', email:'s.martin@acmecorp.fr', phone:'+33 6 12 34 56 78', company:'Acme Corp', jobTitle:'Directrice Générale', website:'https://acmecorp.fr', linkedinUrl:'linkedin.com/in/sophie-martin', status:'qualified', score:87, tags:['SaaS','Chaud','Enterprise'], isStarred:true, notes:'Très intéressée par la fonctionnalité de prospection automatique. A demandé une démo pour la semaine prochaine.', createdAt:'2026-05-20' });
        setForm({ id, firstName:'Sophie', lastName:'Martin', email:'s.martin@acmecorp.fr', phone:'+33 6 12 34 56 78', company:'Acme Corp', jobTitle:'Directrice Générale', website:'https://acmecorp.fr', linkedinUrl:'linkedin.com/in/sophie-martin', status:'qualified', score:87, tags:['SaaS','Chaud','Enterprise'], isStarred:true, notes:'Très intéressée.', createdAt:'2026-05-20' });
      } finally { setLoading(false); }
    };
    fetchProspect();
  }, [id]);

  const save = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('access_token') || '';
      const res = await fetch(`${API}/api/v1/prospects/${id}`, { method:'PATCH', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify(form) });
      if (res.ok) { setProspect(form); setEditing(false); }
    } catch {} finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div>;
  if (!prospect) return null;

  const st = (STATUS as any)[prospect.status] || STATUS.new;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-200 rounded-xl transition-colors"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{prospect.firstName} {prospect.lastName}</h1>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${st.color}`}>{st.label}</span>
            {prospect.score && <span className={`text-xs font-bold px-2 py-1 rounded-full ${prospect.score>=80?'bg-green-50 text-green-600':'bg-amber-50 text-amber-600'}`}>{prospect.score}</span>}
          </div>
          <p className="text-sm text-gray-400">{prospect.jobTitle} · {prospect.company}</p>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button onClick={() => setEditing(false)} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600"><X className="w-4 h-4 inline mr-1" />Annuler</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium flex items-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Sauvegarder
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-teal-300"><Edit2 className="w-4 h-4 inline mr-1" />Modifier</button>
              <button className="px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium"><Mail className="w-4 h-4 inline mr-1" />Envoyer email</button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Colonne principale */}
        <div className="col-span-2 space-y-4">
          {/* Infos */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Informations</h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { key:'firstName', label:'Prénom' }, { key:'lastName', label:'Nom' },
                { key:'email', label:'Email' }, { key:'phone', label:'Téléphone' },
                { key:'company', label:'Entreprise' }, { key:'jobTitle', label:'Poste' },
                { key:'website', label:'Site web' }, { key:'linkedinUrl', label:'LinkedIn' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-gray-400 mb-1">{f.label}</label>
                  {editing ? (
                    <input value={form[f.key]||''} onChange={e => setForm((x:any) => ({...x,[f.key]:e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  ) : (
                    <p className="text-sm text-gray-900">{(prospect as any)[f.key] || '—'}</p>
                  )}
                </div>
              ))}
            </div>
            {/* Statut */}
            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-400 mb-1">Statut</label>
              {editing ? (
                <select value={form.status} onChange={e => setForm((x:any) => ({...x,status:e.target.value}))}
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                  {Object.entries(STATUS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              ) : (
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${st.color}`}>{st.label}</span>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Notes</h2>
            {editing ? (
              <textarea value={form.notes||''} onChange={e => setForm((x:any) => ({...x,notes:e.target.value}))} rows={4}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            ) : (
              <p className="text-sm text-gray-700 leading-relaxed">{prospect.notes || 'Aucune note'}</p>
            )}
            {!editing && (
              <div className="mt-3 flex gap-2">
                <input value={note} onChange={e => setNote(e.target.value)} placeholder="Ajouter une note..."
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                <button onClick={() => { if(note) { setProspect((p:any) => ({...p, notes:`${p.notes||''}\n${note}`})); setNote(''); }}}
                  className="px-4 py-2 bg-teal-600 text-white rounded-xl text-sm">Ajouter</button>
              </div>
            )}
          </div>

          {/* Activités */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Activités récentes</h2>
            <div className="space-y-3">
              {MOCK_ACTIVITIES.map(a => (
                <div key={a.id} className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-xl">
                  <span className="text-lg">{a.icon}</span>
                  <div className="flex-1"><div className="text-sm font-medium text-gray-900">{a.title}</div><div className="text-xs text-gray-500">{a.desc}</div></div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{a.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Score & Tags */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Score & Tags</h3>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 bg-gray-100 rounded-full h-2"><div className="h-2 rounded-full bg-teal-500" style={{ width:`${prospect.score}%` }} /></div>
              <span className="font-bold text-teal-600">{prospect.score}/100</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(prospect.tags||[]).map((t:string) => <span key={t} className="text-xs bg-teal-50 text-teal-700 px-2 py-1 rounded-full">{t}</span>)}
            </div>
          </div>

          {/* Actions rapides */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Actions rapides</h3>
            <div className="space-y-2">
              {[
                { icon:'📧', label:'Envoyer un email', color:'text-purple-600 bg-purple-50' },
                { icon:'📞', label:'Appel planifié', color:'text-blue-600 bg-blue-50' },
                { icon:'📅', label:'RDV agenda', color:'text-green-600 bg-green-50' },
                { icon:'⚡', label:'Ajouter séquence', color:'text-yellow-600 bg-yellow-50' },
                { icon:'🎯', label:'Convertir en deal', color:'text-teal-600 bg-teal-50' },
              ].map((a,i) => (
                <button key={i} className={`w-full flex items-center gap-3 p-2.5 rounded-xl hover:opacity-80 transition-all ${a.color}`}>
                  <span>{a.icon}</span><span className="text-sm font-medium">{a.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Infos enrichies (plugin SEO/CRM) */}
          {prospect.metadata?.seo && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-600" /> SEO Score</h3>
              <div className="text-3xl font-bold text-green-600 mb-1">{prospect.metadata.seo.score}/100</div>
              <div className="text-xs text-gray-400">Analysé par SEO Analyzer Pro</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
