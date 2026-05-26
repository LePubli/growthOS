'use client';
import { useState, useEffect } from 'react';
import { Mail, Play, Pause, Plus, Loader2, CheckCircle, AlertCircle, Clock, Users, TrendingUp, RefreshCw, X } from 'lucide-react';

interface Sequence { id:string; name:string; description?:string; status:string; steps:any[]; enrolled:number; completed:number; openRate:number; replyRate:number; createdAt:string; }

const MOCK: Sequence[] = [
  { id:'1', name:'Onboarding SaaS', description:'Séquence de bienvenue pour les nouveaux leads SaaS', status:'active', steps:[{},{},{}], enrolled:47, completed:12, openRate:48.2, replyRate:8.4, createdAt:'2026-05-01' },
  { id:'2', name:'Relance Cold B2B', description:'Séquence de prospection froide pour les PME', status:'paused', steps:[{},{}], enrolled:23, completed:5, openRate:32.1, replyRate:4.2, createdAt:'2026-05-10' },
  { id:'3', name:'Nurturing Qualifiés', description:'Suivi des prospects qualifiés sur 30 jours', status:'draft', steps:[{},{},{},{},{}], enrolled:0, completed:0, openRate:0, replyRate:0, createdAt:'2026-05-15' },
];

export default function SequencesPage() {
  const [sequences, setSequences] = useState<Sequence[]>(MOCK);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState<string|null>(null);
  const API = process.env.NEXT_PUBLIC_API_URL || '';

  const fetchSequences = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token') || '';
      const res = await fetch(`${API}/api/v1/sequences`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); const list = Array.isArray(d) ? d : d.data||[]; if (list.length > 0) setSequences(list); }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchSequences(); }, []);

  const toggle = async (id: string) => {
    setToggling(id);
    try {
      const token = localStorage.getItem('access_token') || '';
      await fetch(`${API}/api/v1/sequences/${id}/toggle`, { method:'POST', headers:{ Authorization:`Bearer ${token}` } });
      setSequences(s => s.map(x => x.id === id ? { ...x, status: x.status === 'active' ? 'paused' : 'active' } : x));
    } catch {} finally { setToggling(null); }
  };

  const totalEnrolled = sequences.reduce((s,x) => s+x.enrolled, 0);
  const avgOpen = sequences.filter(s=>s.openRate>0).reduce((s,x,_,a) => s + x.openRate/a.length, 0);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Séquences Email</h1><p className="text-sm text-gray-400 mt-0.5">{sequences.filter(s=>s.status==='active').length} actives</p></div>
        <div className="flex gap-2">
          <button onClick={fetchSequences} className="p-2 bg-white border border-gray-200 rounded-xl text-gray-500"><RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`} /></button>
          <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium"><Plus className="w-4 h-4" /> Nouvelle séquence</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label:'Contacts inscrits', value:totalEnrolled, icon:<Users className="w-5 h-5" />, color:'text-blue-600 bg-blue-50' },
          { label:'Taux ouverture moyen', value:`${avgOpen.toFixed(1)}%`, icon:<Mail className="w-5 h-5" />, color:'text-purple-600 bg-purple-50' },
          { label:'Séquences actives', value:sequences.filter(s=>s.status==='active').length, icon:<Play className="w-5 h-5" />, color:'text-teal-600 bg-teal-50' },
        ].map((s,i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>{s.icon}</div>
            <div><div className="text-2xl font-bold text-gray-900">{s.value}</div><div className="text-sm text-gray-400">{s.label}</div></div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {sequences.map(seq => (
          <div key={seq.id} className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-all">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 flex-shrink-0"><Mail className="w-5 h-5" /></div>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-gray-900">{seq.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${seq.status==='active'?'bg-green-50 text-green-600':seq.status==='paused'?'bg-amber-50 text-amber-600':'bg-gray-100 text-gray-500'}`}>{seq.status}</span>
                </div>
                {seq.description && <p className="text-xs text-gray-400 mt-0.5">{seq.description}</p>}
                <div className="flex items-center gap-6 mt-2 text-xs text-gray-400">
                  <span>{seq.steps.length} étapes</span>
                  <span><Users className="w-3 h-3 inline mr-1" />{seq.enrolled} inscrits</span>
                  <span><CheckCircle className="w-3 h-3 inline mr-1" />{seq.completed} terminés</span>
                  {seq.openRate > 0 && <span><Mail className="w-3 h-3 inline mr-1" />{seq.openRate}% ouverture</span>}
                  {seq.replyRate > 0 && <span><TrendingUp className="w-3 h-3 inline mr-1" />{seq.replyRate}% réponse</span>}
                </div>
              </div>
              <button onClick={() => toggle(seq.id)} disabled={!!toggling || seq.status==='draft'}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${seq.status==='active'?'bg-amber-50 text-amber-600 hover:bg-amber-100':'bg-green-50 text-green-600 hover:bg-green-100'} disabled:opacity-50`}>
                {toggling===seq.id ? <Loader2 className="w-4 h-4 animate-spin" /> : seq.status==='active' ? <><Pause className="w-4 h-4"/>Pause</> : <><Play className="w-4 h-4"/>Lancer</>}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
