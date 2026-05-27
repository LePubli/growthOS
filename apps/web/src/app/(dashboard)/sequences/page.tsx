'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Play, Pause, Plus, Loader2, Users, TrendingUp, RefreshCw, ChevronRight } from 'lucide-react';
const MOCK = [
  { id:'1', name:'Onboarding SaaS', description:'Séquence de bienvenue', status:'active', steps:[{},{},{}], enrolled:47, completed:12, openRate:48.2, replyRate:8.4 },
  { id:'2', name:'Relance Cold B2B', description:'Prospection froide PME', status:'paused', steps:[{},{}], enrolled:23, completed:5, openRate:32.1, replyRate:4.2 },
  { id:'3', name:'Nurturing Qualifiés', description:'Suivi prospects 30j', status:'draft', steps:[{},{},{},{},{}], enrolled:0, completed:0, openRate:0, replyRate:0 },
];
export default function SequencesPage() {
  const router = useRouter();
  const [sequences, setSequences] = useState(MOCK);
  const [toggling, setToggling] = useState<string|null>(null);
  const API = process.env.NEXT_PUBLIC_API_URL || '';
  useEffect(()=>{
    fetch(`${API}/api/v1/sequences`,{headers:{Authorization:`Bearer ${localStorage.getItem('access_token')||''}`}})
      .then(r=>r.ok?r.json():null).then(d=>{if(d){const l=Array.isArray(d)?d:d.data||[];if(l.length>0)setSequences(l);}}).catch(()=>{});
  },[]);
  const toggle = async (id:string, e:React.MouseEvent) => {
    e.stopPropagation(); setToggling(id);
    try {
      await fetch(`${API}/api/v1/sequences/${id}/toggle`,{method:'POST',headers:{Authorization:`Bearer ${localStorage.getItem('access_token')||''}`}});
      setSequences(s=>s.map(x=>x.id===id?{...x,status:x.status==='active'?'paused':'active'}:x));
    } catch {} finally { setToggling(null); }
  };
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Séquences Email</h1>
          <p className="text-sm text-gray-400">{sequences.filter(s=>s.status==='active').length} actives</p></div>
        <button onClick={()=>router.push('/sequences/new')} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700">
          <Plus className="w-4 h-4"/>Nouvelle séquence
        </button>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[{label:'Inscrits',value:sequences.reduce((s,x)=>s+x.enrolled,0),icon:<Users className="w-5 h-5"/>,color:'text-blue-600 bg-blue-50'},{label:'Taux ouverture',value:`${(sequences.filter(s=>s.openRate>0).reduce((s,x,_,a)=>s+x.openRate/a.length,0)||0).toFixed(1)}%`,icon:<Mail className="w-5 h-5"/>,color:'text-purple-600 bg-purple-50'},{label:'Actives',value:sequences.filter(s=>s.status==='active').length,icon:<Play className="w-5 h-5"/>,color:'text-teal-600 bg-teal-50'}].map((s,i)=>(
          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>{s.icon}</div>
            <div><div className="text-2xl font-bold text-gray-900">{s.value}</div><div className="text-sm text-gray-400">{s.label}</div></div>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {sequences.map(seq=>(
          <div key={seq.id} onClick={()=>router.push(`/sequences/${seq.id}`)} className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md hover:border-teal-200 cursor-pointer transition-all">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600"><Mail className="w-5 h-5"/></div>
              <div className="flex-1">
                <div className="flex items-center gap-3"><h3 className="font-semibold text-gray-900">{seq.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${seq.status==='active'?'bg-green-50 text-green-600':seq.status==='paused'?'bg-amber-50 text-amber-600':'bg-gray-100 text-gray-500'}`}>{seq.status}</span>
                </div>
                <p className="text-xs text-gray-400">{seq.description}</p>
                <div className="flex gap-5 mt-1 text-xs text-gray-400">
                  <span>{seq.steps.length} étapes</span><span><Users className="w-3 h-3 inline mr-1"/>{seq.enrolled}</span>
                  {seq.openRate>0&&<span>{seq.openRate}% ouv.</span>}{seq.replyRate>0&&<span>{seq.replyRate}% rép.</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={e=>toggle(seq.id,e)} disabled={!!toggling||seq.status==='draft'} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium ${seq.status==='active'?'bg-amber-50 text-amber-600':'bg-green-50 text-green-600'} disabled:opacity-50`}>
                  {toggling===seq.id?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:seq.status==='active'?<><Pause className="w-3.5 h-3.5"/>Pause</>:<><Play className="w-3.5 h-3.5"/>Lancer</>}
                </button>
                <ChevronRight className="w-4 h-4 text-gray-300"/>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
