'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Zap, Play, Pause, Plus, ChevronRight, CheckCircle, Clock, Loader2, RefreshCw, AlertCircle } from 'lucide-react';

const MOCK = [
  { id:'1', name:'Nurturing Cold Leads', trigger:'prospect.created', status:'active', runs:234, lastRun:'il y a 5 min', steps:4 },
  { id:'2', name:'Relance J+3 Email Ouvert', trigger:'email.opened', status:'active', runs:89, lastRun:'il y a 1h', steps:3 },
  { id:'3', name:'Alerte Lead Chaud', trigger:'score_threshold', status:'paused', runs:12, lastRun:'il y a 2j', steps:2 },
];

export default function WorkflowsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [workflows, setWorkflows] = useState(MOCK);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState<string|null>(null);
  const [toast, setToast] = useState<string|null>(null);
  const API = process.env.NEXT_PUBLIC_API_URL || '';

  const showToast = (msg:string) => { setToast(msg); setTimeout(()=>setToast(null),3000); };

  const fetchWorkflows = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token')||'';
      const res = await fetch(`${API}/api/v1/workflows`,{headers:{Authorization:`Bearer ${token}`}});
      if (res.ok) { const d=await res.json(); const l=Array.isArray(d)?d:d.data||[]; if(l.length>0) setWorkflows(l); }
    } catch {} finally { setLoading(false); }
  },[]);

  useEffect(()=>{ fetchWorkflows(); },[]);

  // Ouvrir modal création si ?new=1
  useEffect(()=>{ if(searchParams.get('new')==='1') router.push('/workflows/new'); },[searchParams]);

  const toggle = async (id:string) => {
    setToggling(id);
    try {
      const token = localStorage.getItem('access_token')||'';
      await fetch(`${API}/api/v1/workflows/${id}/toggle`,{method:'POST',headers:{Authorization:`Bearer ${token}`}});
      setWorkflows(w=>w.map(x=>x.id===id?{...x,status:x.status==='active'?'paused':'active'}:x));
      const wf = workflows.find(w=>w.id===id);
      showToast(`Workflow "${wf?.name}" ${wf?.status==='active'?'mis en pause':'activé'} ✓`);
    } catch { showToast('Erreur'); }
    finally { setToggling(null); }
  };

  return (
    <div className="min-h-screen p-6" style={{background:'var(--body-bg)'}}>
      {toast&&<div className="fixed top-6 right-6 z-50 text-white px-4 py-3 rounded-xl shadow-lg text-sm flex items-center gap-2" style={{background:'var(--color-primary)'}}><CheckCircle className="w-4 h-4"/>{toast}</div>}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>Workflows</h1>
          <p className="text-sm" style={{color:'var(--text-muted)'}}>{workflows.filter(w=>w.status==='active').length} actifs</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchWorkflows} disabled={loading} className="p-2 rounded-xl border" style={{background:'var(--card-bg)',borderColor:'var(--card-border)',color:'var(--text-secondary)'}}>
            <RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`}/>
          </button>
          <button onClick={()=>router.push('/workflows/new')} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white hover:opacity-90" style={{background:'var(--color-primary)'}}>
            <Plus className="w-4 h-4"/>Nouveau workflow
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {workflows.map(wf=>(
          <div key={wf.id} onClick={()=>router.push(`/workflows/${wf.id}`)}
            className="rounded-2xl border p-5 flex items-center gap-4 cursor-pointer hover:shadow-md transition-all"
            style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}
            onMouseEnter={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--color-primary)'}
            onMouseLeave={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--card-border)'}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:'var(--color-primary-light)'}}>
              <Zap className="w-5 h-5" style={{color:'var(--color-primary)'}}/>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-sm" style={{color:'var(--text-primary)'}}>{wf.name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${wf.status==='active'?'bg-green-50 text-green-600':'bg-amber-50 text-amber-600'}`}>{wf.status}</span>
              </div>
              <div className="flex items-center gap-5 mt-1 text-xs" style={{color:'var(--text-muted)'}}>
                <span>Trigger: <code className="bg-gray-100 px-1 rounded">{wf.trigger}</code></span>
                <span>{wf.steps} étapes</span>
                <span><CheckCircle className="w-3 h-3 inline mr-1 text-green-500"/>{wf.runs} exéc.</span>
                <span><Clock className="w-3 h-3 inline mr-1"/>Dernière: {wf.lastRun}</span>
              </div>
            </div>
            <div className="flex items-center gap-2" onClick={e=>e.stopPropagation()}>
              <button onClick={()=>toggle(wf.id)} disabled={!!toggling}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium ${wf.status==='active'?'bg-amber-50 text-amber-600':'bg-green-50 text-green-600'} disabled:opacity-50`}>
                {toggling===wf.id?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:wf.status==='active'?<><Pause className="w-3.5 h-3.5"/>Pause</>:<><Play className="w-3.5 h-3.5"/>Activer</>}
              </button>
              <ChevronRight className="w-4 h-4" style={{color:'var(--text-muted)'}}/>
            </div>
          </div>
        ))}
        {workflows.length===0&&(
          <div className="text-center py-16 rounded-2xl border" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
            <Zap className="w-10 h-10 mx-auto mb-3" style={{color:'var(--card-border)'}}/>
            <p style={{color:'var(--text-muted)'}}>Aucun workflow</p>
            <button onClick={()=>router.push('/workflows/new')} className="mt-3 px-4 py-2 rounded-xl text-sm text-white" style={{background:'var(--color-primary)'}}>Créer le premier</button>
          </div>
        )}
      </div>
    </div>
  );
}
