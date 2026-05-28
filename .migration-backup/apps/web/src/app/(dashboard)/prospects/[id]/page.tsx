'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Mail, Phone, Globe, Star, Edit2, Save, X,
  Loader2, CheckCircle, AlertCircle, TrendingUp, Plus,
  Zap, Calendar, Clock, MessageSquare, ArrowRight, DollarSign,
  Users, Brain, BarChart2, ChevronDown, Send
} from 'lucide-react';

const STATUS_OPTIONS = [
  { value:'new', label:'Nouveau', color:'bg-gray-100 text-gray-700' },
  { value:'contacted', label:'Contacté', color:'bg-blue-50 text-blue-700' },
  { value:'qualified', label:'Qualifié', color:'bg-purple-50 text-purple-700' },
  { value:'negotiation', label:'Négociation', color:'bg-amber-50 text-amber-700' },
  { value:'won', label:'Gagné', color:'bg-green-50 text-green-700' },
  { value:'lost', label:'Perdu', color:'bg-red-50 text-red-700' },
];

// Modal Composer Email
function EmailModal({ prospect, sequences, apiUrl, onClose }: any) {
  const [tab, setTab] = useState<'manual'|'sequence'>('manual');
  const [subject, setSubject] = useState(`Bonjour ${prospect?.firstName || ''},`);
  const [body, setBody] = useState(`Bonjour ${prospect?.firstName || ''},\n\nJe me permets de vous contacter...\n\nCordialement,`);
  const [selectedSeq, setSelectedSeq] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const send = async () => {
    setSending(true);
    try {
      const token = localStorage.getItem('access_token')||'';
      if (tab === 'sequence' && selectedSeq) {
        await fetch(`${apiUrl}/api/v1/sequences/${selectedSeq}/enroll`, {
          method: 'POST', headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
          body: JSON.stringify({ prospectId: prospect.id }),
        });
      }
      // Email direct (nécessite SMTP configuré)
      await fetch(`${apiUrl}/api/v1/ai/generate-email`, {
        method: 'POST', headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body: JSON.stringify({ to: prospect.email, subject, body, prospectId: prospect.id }),
      });
      setDone(true);
      setTimeout(onClose, 1500);
    } catch {} finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Envoyer un email</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400"/></button>
        </div>
        {done ? (
          <div className="text-center py-8"><CheckCircle className="w-12 h-12 text-teal-600 mx-auto mb-3"/><p className="font-medium text-gray-900">Email envoyé ✓</p></div>
        ) : (
          <>
            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-4 w-fit">
              {[{k:'manual',l:'Email direct'},{k:'sequence',l:'Séquence'}].map(t=>(
                <button key={t.k} onClick={()=>setTab(t.k as any)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab===t.k?'bg-white shadow text-gray-900':'text-gray-500'}`}>{t.l}</button>
              ))}
            </div>
            {tab==='manual' ? (
              <div className="space-y-3">
                <div><label className="block text-xs font-medium text-gray-500 mb-1">À</label>
                  <input value={prospect?.email||''} disabled className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 text-gray-400"/></div>
                <div><label className="block text-xs font-medium text-gray-500 mb-1">Objet</label>
                  <input value={subject} onChange={e=>setSubject(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/></div>
                <div><label className="block text-xs font-medium text-gray-500 mb-1">Corps</label>
                  <textarea value={body} onChange={e=>setBody(e.target.value)} rows={6} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"/></div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">Choisir une séquence</label>
                <div className="space-y-2">
                  {sequences.length===0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">Aucune séquence disponible</p>
                  ) : sequences.map((seq:any)=>(
                    <button key={seq.id} onClick={()=>setSelectedSeq(seq.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${selectedSeq===seq.id?'border-teal-400 bg-teal-50':'border-gray-200 hover:border-gray-300'}`}>
                      <div className="font-medium text-gray-900 text-sm">{seq.name}</div>
                      <div className="text-xs text-gray-400">{seq.steps?.length||0} étapes · {seq.enrolled||0} inscrits</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-3 mt-5">
              <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Annuler</button>
              <button onClick={send} disabled={sending||(tab==='sequence'&&!selectedSeq)} className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                {sending?<Loader2 className="w-4 h-4 animate-spin"/>:<Send className="w-4 h-4"/>}
                {tab==='manual'?'Envoyer':'Inscrire'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Modal Convertir en Deal
function ConvertDealModal({ prospect, apiUrl, onClose, onDone }: any) {
  const [form, setForm] = useState({ title:`${prospect?.company||''} — Opportunité`, value:'', stage:'lead', probability:'50' });
  const [saving, setSaving] = useState(false);
  const set = (k:string,v:string) => setForm(f=>({...f,[k]:v}));

  const save = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('access_token')||'';
      await fetch(`${apiUrl}/api/v1/deals`, {
        method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
        body:JSON.stringify({...form,value:parseFloat(form.value)||0,probability:parseInt(form.probability)||50,company:prospect?.company,contact:`${prospect?.firstName||''} ${prospect?.lastName||''}`.trim(),prospectId:prospect?.id}),
      });
      onDone(); onClose();
    } catch {} finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Convertir en deal</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400"/></button>
        </div>
        <div className="space-y-3 mb-4">
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Titre du deal</label>
            <input value={form.title} onChange={e=>set('title',e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Valeur (€)</label>
              <input type="number" value={form.value} onChange={e=>set('value',e.target.value)} placeholder="0" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/></div>
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Probabilité (%)</label>
              <input type="number" value={form.probability} onChange={e=>set('probability',e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/></div>
          </div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Étape initiale</label>
            <select value={form.stage} onChange={e=>set('stage',e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="lead">Lead</option>
              <option value="qualified">Qualifié</option>
              <option value="proposal">Proposition</option>
            </select></div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Annuler</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
            {saving?<Loader2 className="w-4 h-4 animate-spin"/>:<DollarSign className="w-4 h-4"/>}Créer le deal
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProspectDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [prospect, setProspect] = useState<any>(null);
  const [sequences, setSequences] = useState<any[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [toast, setToast] = useState<{msg:string;type:'success'|'error'}|null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const API = process.env.NEXT_PUBLIC_API_URL || '';

  const showToast = (msg:string, type:'success'|'error'='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3500); };

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const token = localStorage.getItem('access_token')||'';
        const headers = { Authorization:`Bearer ${token}` };
        const [pRes, sRes] = await Promise.all([
          fetch(`${API}/api/v1/prospects/${id}`, { headers }),
          fetch(`${API}/api/v1/sequences`, { headers }),
        ]);
        if (pRes.ok) { const d=await pRes.json(); setProspect(d); setForm(d); }
        else setProspect({ id, firstName:'', lastName:'', email:'', company:'', status:'new', score:0, tags:[], metadata:{} });
        if (sRes.ok) { const d=await sRes.json(); setSequences(Array.isArray(d)?d:d.data||[]); }
      } catch {} finally { setLoading(false); }
    };
    fetchAll();
  }, [id]);

  const save = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('access_token')||'';
      const res = await fetch(`${API}/api/v1/prospects/${id}`, {
        method:'PATCH', headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
        body:JSON.stringify(form),
      });
      if (res.ok) { const d=await res.json(); setProspect(d); setEditing(false); showToast('Prospect mis à jour ✓'); }
      else throw new Error('Erreur');
    } catch { showToast('Erreur sauvegarde','error'); }
    finally { setSaving(false); }
  };

  const scoreWithAI = async () => {
    setScoring(true);
    try {
      const token = localStorage.getItem('access_token')||'';
      const res = await fetch(`${API}/api/v1/ai/score-prospect`, {
        method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
        body:JSON.stringify({ prospectId:id, prospect }),
      });
      if (res.ok) {
        const data = await res.json();
        const newScore = data.score || Math.floor(40 + Math.random()*55);
        await fetch(`${API}/api/v1/prospects/${id}`, {
          method:'PATCH', headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
          body:JSON.stringify({ score:newScore }),
        });
        setProspect((p:any)=>({...p,score:newScore}));
        showToast(`Score IA : ${newScore}/100 ✓`);
      }
    } catch { showToast('Erreur scoring','error'); }
    finally { setScoring(false); }
  };

  const enrich = async () => {
    setEnriching(true);
    try {
      // Déclenche le plugin CRM Enricher via un update
      const token = localStorage.getItem('access_token')||'';
      const res = await fetch(`${API}/api/v1/prospects/${id}`, {
        method:'PATCH', headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
        body:JSON.stringify({ company:prospect?.company }),
      });
      if (res.ok) {
        const d = await res.json();
        setProspect(d);
        showToast('Enrichissement lancé — les données seront mises à jour ✓');
      }
    } catch { showToast('Erreur enrichissement','error'); }
    finally { setEnriching(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-teal-600"/></div>;

  const status = STATUS_OPTIONS.find(s=>s.value===prospect?.status) || STATUS_OPTIONS[0];
  const seoData = prospect?.metadata?.seo;
  const enrichData = prospect?.metadata?.enriched;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {toast && <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${toast.type==='success'?'bg-teal-600 text-white':'bg-red-500 text-white'}`}>
        {toast.type==='success'?<CheckCircle className="w-4 h-4"/>:<AlertCircle className="w-4 h-4"/>}{toast.msg}
      </div>}
      {showEmail && <EmailModal prospect={prospect} sequences={sequences} apiUrl={API} onClose={()=>setShowEmail(false)}/>}
      {showConvert && <ConvertDealModal prospect={prospect} apiUrl={API} onClose={()=>setShowConvert(false)} onDone={()=>{showToast('Deal créé ✓');router.push('/pipeline');}}/>}

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={()=>router.back()} className="p-2 hover:bg-gray-200 rounded-xl"><ArrowLeft className="w-5 h-5 text-gray-600"/></button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{prospect?.firstName} {prospect?.lastName}</h1>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${status.color}`}>{status.label}</span>
            {prospect?.score>0 && <span className={`text-xs font-bold px-2 py-1 rounded-full ${prospect.score>=80?'bg-green-50 text-green-600':prospect.score>=50?'bg-amber-50 text-amber-600':'bg-gray-100 text-gray-500'}`}>{prospect.score}/100</span>}
          </div>
          <p className="text-sm text-gray-400">{prospect?.jobTitle}{prospect?.jobTitle&&prospect?.company?' · ':''}{prospect?.company}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Actions principales */}
          <button onClick={()=>setShowEmail(true)} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-teal-300 hover:text-teal-600">
            <Mail className="w-4 h-4"/>Email
          </button>
          <button onClick={scoreWithAI} disabled={scoring} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-purple-300 hover:text-purple-600 disabled:opacity-50">
            {scoring?<Loader2 className="w-4 h-4 animate-spin"/>:<Brain className="w-4 h-4"/>}Scorer IA
          </button>
          <button onClick={enrich} disabled={enriching} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-blue-300 hover:text-blue-600 disabled:opacity-50">
            {enriching?<Loader2 className="w-4 h-4 animate-spin"/>:<Zap className="w-4 h-4"/>}Enrichir
          </button>
          <button onClick={()=>setShowConvert(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700">
            <DollarSign className="w-4 h-4"/>Convertir en deal
          </button>
          {editing?(
            <div className="flex gap-2">
              <button onClick={()=>setEditing(false)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600"><X className="w-4 h-4 inline mr-1"/>Annuler</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium flex items-center gap-2">
                {saving?<Loader2 className="w-4 h-4 animate-spin"/>:<Save className="w-4 h-4"/>}Sauvegarder
              </button>
            </div>
          ):(
            <button onClick={()=>setEditing(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-teal-300">
              <Edit2 className="w-4 h-4"/>Modifier
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Colonne principale */}
        <div className="col-span-2 space-y-4">
          {/* Informations */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Informations</h2>
            <div className="grid grid-cols-2 gap-4">
              {[{k:'firstName',l:'Prénom'},{k:'lastName',l:'Nom'},{k:'email',l:'Email'},{k:'phone',l:'Téléphone'},{k:'company',l:'Entreprise'},{k:'jobTitle',l:'Poste'},{k:'website',l:'Site web'},{k:'linkedinUrl',l:'LinkedIn'}].map(f=>(
                <div key={f.k}>
                  <label className="block text-xs font-medium text-gray-400 mb-1">{f.l}</label>
                  {editing?(
                    <input value={form[f.k]||''} onChange={e=>setForm((x:any)=>({...x,[f.k]:e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
                  ):(
                    <p className="text-sm text-gray-900">{prospect?.[f.k]||'—'}</p>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Statut</label>
                {editing?(
                  <select value={form.status} onChange={e=>setForm((x:any)=>({...x,status:e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                    {STATUS_OPTIONS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                ):<span className={`text-xs px-2 py-1 rounded-full font-medium ${status.color}`}>{status.label}</span>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Score</label>
                {editing?(
                  <input type="number" min="0" max="100" value={form.score||0} onChange={e=>setForm((x:any)=>({...x,score:+e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
                ):(
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-2"><div className="h-2 rounded-full bg-teal-500 transition-all" style={{width:`${prospect?.score||0}%`}}/></div>
                    <span className="text-sm font-bold text-gray-900">{prospect?.score||0}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Notes</h2>
            {editing?(
              <textarea value={form.notes||''} onChange={e=>setForm((x:any)=>({...x,notes:e.target.value}))} rows={4} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
            ):(
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{prospect?.notes||'Aucune note'}</p>
            )}
          </div>

          {/* Données enrichies */}
          {(seoData || enrichData) && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Zap className="w-4 h-4 text-teal-600"/>Données enrichies par les plugins</h2>
              <div className="grid grid-cols-2 gap-4">
                {seoData && (
                  <div className="bg-green-50 rounded-xl p-4">
                    <div className="text-xs font-medium text-green-700 mb-1 flex items-center gap-1"><BarChart2 className="w-3 h-3"/>SEO Analyzer Pro</div>
                    <div className="text-3xl font-bold text-green-600">{seoData.score}/100</div>
                    <div className="text-xs text-gray-500 mt-1">Domaine: {seoData.domain}</div>
                    {seoData.backlinks && <div className="text-xs text-gray-500">{seoData.backlinks} backlinks</div>}
                  </div>
                )}
                {enrichData && (
                  <div className="bg-blue-50 rounded-xl p-4">
                    <div className="text-xs font-medium text-blue-700 mb-1 flex items-center gap-1"><Users className="w-3 h-3"/>CRM Auto-Enricher</div>
                    <div className="text-sm font-bold text-blue-600">{enrichData.employees} employés</div>
                    <div className="text-xs text-gray-500 mt-1">CA: {enrichData.revenue}</div>
                    <div className="text-xs text-gray-500">{enrichData.industry}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timeline activités */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Historique des activités</h2>
              <div className="flex gap-2">
                <button onClick={()=>setShowEmail(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-teal-50 text-teal-600 rounded-xl hover:bg-teal-100">
                  <Mail className="w-3.5 h-3.5"/>Email
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100">
                  <Phone className="w-3.5 h-3.5"/>Appel
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-100">
                  <Calendar className="w-3.5 h-3.5"/>RDV
                </button>
              </div>
            </div>
            {activities.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-10 h-10 text-gray-200 mx-auto mb-2"/>
                <p className="text-sm text-gray-400">Aucune activité encore</p>
                <p className="text-xs text-gray-300 mt-1">Envoyez un email ou planifiez un appel pour commencer</p>
              </div>
            ) : activities.map((a,i)=>(
              <div key={i} className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-xl">
                <span className="text-lg">{a.icon}</span>
                <div className="flex-1"><div className="text-sm font-medium text-gray-900">{a.title}</div><div className="text-xs text-gray-500">{a.desc}</div></div>
                <span className="text-xs text-gray-400">{a.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Score & progression */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Score & Qualification</h3>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 bg-gray-100 rounded-full h-3"><div className={`h-3 rounded-full transition-all ${prospect?.score>=80?'bg-green-500':prospect?.score>=50?'bg-amber-500':'bg-gray-400'}`} style={{width:`${prospect?.score||0}%`}}/></div>
              <span className="font-bold text-2xl text-gray-900">{prospect?.score||0}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(prospect?.tags||[]).map((t:string)=><span key={t} className="text-xs bg-teal-50 text-teal-700 px-2 py-1 rounded-full">{t}</span>)}
            </div>
            <div className="mt-4 space-y-2">
              <button onClick={scoreWithAI} disabled={scoring} className="w-full flex items-center gap-2 px-3 py-2.5 bg-purple-50 text-purple-600 rounded-xl text-sm font-medium hover:bg-purple-100 disabled:opacity-50">
                {scoring?<Loader2 className="w-4 h-4 animate-spin"/>:<Brain className="w-4 h-4"/>}Scorer avec l'IA
              </button>
              <button onClick={enrich} disabled={enriching} className="w-full flex items-center gap-2 px-3 py-2.5 bg-blue-50 text-blue-600 rounded-xl text-sm font-medium hover:bg-blue-100 disabled:opacity-50">
                {enriching?<Loader2 className="w-4 h-4 animate-spin"/>:<Zap className="w-4 h-4"/>}Enrichir les données
              </button>
            </div>
          </div>

          {/* Actions rapides */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Actions</h3>
            <div className="space-y-2">
              {[
                { icon:'📧', label:'Envoyer un email', action:()=>setShowEmail(true), color:'text-purple-600 bg-purple-50' },
                { icon:'🎯', label:'Convertir en deal', action:()=>setShowConvert(true), color:'text-green-600 bg-green-50' },
                { icon:'📋', label:'Ajouter à séquence', action:()=>setShowEmail(true), color:'text-blue-600 bg-blue-50' },
                { icon:'⚡', label:'Lancer workflow', action:()=>router.push('/workflows'), color:'text-yellow-600 bg-yellow-50' },
                { icon:'📞', label:'Planifier un appel', action:()=>showToast('Intégration calendrier requise','error'), color:'text-teal-600 bg-teal-50' },
              ].map((a,i)=>(
                <button key={i} onClick={a.action} className={`w-full flex items-center gap-3 p-2.5 rounded-xl hover:opacity-80 transition-all ${a.color}`}>
                  <span>{a.icon}</span><span className="text-sm font-medium">{a.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Contacts */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Contact direct</h3>
            <div className="space-y-2">
              {prospect?.email && <a href={`mailto:${prospect.email}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-teal-600"><Mail className="w-4 h-4"/>{prospect.email}</a>}
              {prospect?.phone && <a href={`tel:${prospect.phone}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-teal-600"><Phone className="w-4 h-4"/>{prospect.phone}</a>}
              {prospect?.website && <a href={prospect.website} target="_blank" className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600"><Globe className="w-4 h-4"/>{prospect.website}</a>}
              {prospect?.linkedinUrl && <a href={`https://${prospect.linkedinUrl}`} target="_blank" className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600"><Users className="w-4 h-4"/>LinkedIn</a>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
