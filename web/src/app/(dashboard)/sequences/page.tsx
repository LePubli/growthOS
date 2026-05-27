'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Play, Pause, Plus, Loader2, Users, TrendingUp, RefreshCw, ChevronRight, Eye, MousePointer } from 'lucide-react';

export default function SequencesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sequences, setSequences] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState<string|null>(null);
  const [toast, setToast] = useState<string|null>(null);
  const API = process.env.NEXT_PUBLIC_API_URL || '';

  const showToast = (msg:string) => { setToast(msg); setTimeout(()=>setToast(null),3000); };

  const fetchSeq = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token')||'';
      const res = await fetch(`${API}/api/v1/sequences`,{headers:{Authorization:`Bearer ${token}`}});
      if (res.ok) { const d=await res.json(); const l=Array.isArray(d)?d:d.data||[]; setSequences(l); }
    } catch {} finally { setLoading(false); }
  },[]);

  useEffect(()=>{ fetchSeq(); },[]);

  const toggle = async (id:string, e:React.MouseEvent) => {
    e.stopPropagation(); setToggling(id);
    try {
      const token=localStorage.getItem('access_token')||'';
      await fetch(`${API}/api/v1/sequences/${id}/toggle`,{method:'POST',headers:{Authorization:`Bearer ${token}`}});
      setSequences(s=>s.map(x=>x.id===id?{...x,status:x.status==='active'?'paused':'active'}:x));
    } catch {} finally { setToggling(null); }
  };

  const activeCount = sequences.filter(s=>s.status==='active').length;
  const totalEnrolled = sequences.reduce((s,x)=>s+x.enrolled,0);
  const avgOpenRate = sequences.filter(s=>s.openRate>0).reduce((s,x,_,a)=>s+x.openRate/a.length,0).toFixed(1);

  return (
    <div className="min-h-screen p-6" style={{background:'var(--body-bg)'}}>
      {toast&&<div className="fixed top-6 right-6 z-50 text-white px-4 py-3 rounded-xl shadow-lg text-sm" style={{background:'var(--color-primary)'}}>{toast}</div>}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>Séquences Email</h1>
          <p className="text-sm" style={{color:'var(--text-muted)'}}>{activeCount} actives · {totalEnrolled} inscrits · Cliquez sur une carte pour l'éditer</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchSeq} disabled={loading} className="p-2 rounded-xl border" style={{background:'var(--card-bg)',borderColor:'var(--card-border)',color:'var(--text-secondary)'}}>
            <RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`}/>
          </button>
          <button onClick={()=>router.push('/sequences/new')} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white hover:opacity-90" style={{background:'var(--color-primary)'}}>
            <Plus className="w-4 h-4"/>Nouvelle séquence
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          {l:'Inscrits total',v:totalEnrolled,icon:<Users className="w-5 h-5"/>},
          {l:'Taux ouverture moy.',v:`${avgOpenRate}%`,icon:<Eye className="w-5 h-5"/>},
          {l:'Séquences actives',v:activeCount,icon:<Play className="w-5 h-5"/>},
        ].map((s,i)=>(
          <div key={i} className="rounded-2xl border p-5 flex items-center gap-4" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:'var(--color-primary-light)',color:'var(--color-primary)'}}>{s.icon}</div>
            <div><div className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>{s.v}</div><div className="text-sm" style={{color:'var(--text-muted)'}}>{s.l}</div></div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin mx-auto" style={{color:'var(--color-primary)'}}/></div>
      ) : sequences.length===0 ? (
        <div className="text-center py-16 rounded-2xl border" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
          <Mail className="w-12 h-12 mx-auto mb-3" style={{color:'var(--card-border)'}}/>
          <p className="mb-2" style={{color:'var(--text-muted)'}}>Aucune séquence email</p>
          <p className="text-sm mb-4" style={{color:'var(--text-muted)'}}>Créez votre première séquence pour automatiser vos relances</p>
          <button onClick={()=>router.push('/sequences/new')} className="px-4 py-2 rounded-xl text-sm text-white" style={{background:'var(--color-primary)'}}>
            + Nouvelle séquence
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sequences.map(seq=>(
            <div key={seq.id} onClick={()=>router.push(`/sequences/${seq.id}`)}
              className="rounded-2xl border p-5 cursor-pointer hover:shadow-md transition-all"
              style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}
              onMouseEnter={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--color-primary)'}
              onMouseLeave={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--card-border)'}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:'var(--color-primary-light)'}}>
                  <Mail className="w-5 h-5" style={{color:'var(--color-primary)'}}/>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-sm" style={{color:'var(--text-primary)'}}>{seq.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${seq.status==='active'?'bg-green-50 text-green-600':seq.status==='paused'?'bg-amber-50 text-amber-600':'bg-gray-100 text-gray-500'}`}>
                      {seq.status==='active'?'● Active':seq.status==='paused'?'⏸ En pause':'○ Brouillon'}
                    </span>
                  </div>
                  {seq.description&&<p className="text-xs mt-0.5" style={{color:'var(--text-muted)'}}>{seq.description}</p>}
                  <div className="flex gap-5 mt-1.5 text-xs" style={{color:'var(--text-muted)'}}>
                    <span>{seq.steps?.length||0} étapes</span>
                    <span><Users className="w-3 h-3 inline mr-1"/>{seq.enrolled||0} inscrits</span>
                    {seq.openRate>0&&<span><Eye className="w-3 h-3 inline mr-1"/>{seq.openRate}% ouverture</span>}
                    {seq.replyRate>0&&<span><MousePointer className="w-3 h-3 inline mr-1"/>{seq.replyRate}% réponse</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={e=>e.stopPropagation()}>
                  <button onClick={e=>toggle(seq.id,e)} disabled={!!toggling||seq.status==='draft'}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium ${seq.status==='active'?'bg-amber-50 text-amber-600':'bg-green-50 text-green-600'} disabled:opacity-50`}>
                    {toggling===seq.id?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:seq.status==='active'?<><Pause className="w-3.5 h-3.5"/>Pause</>:<><Play className="w-3.5 h-3.5"/>Activer</>}
                  </button>
                  <ChevronRight className="w-4 h-4" style={{color:'var(--text-muted)'}}/>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
