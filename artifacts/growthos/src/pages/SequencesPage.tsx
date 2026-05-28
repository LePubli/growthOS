import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Mail, Play, Pause, Plus, Loader2, Users } from 'lucide-react';

const MOCK = [
  { id:'1', name:'Onboarding SaaS', description:'Séquence de bienvenue', status:'active', steps:[{},{},{}], enrolled:47, completed:12, openRate:48.2, replyRate:8.4 },
  { id:'2', name:'Relance Cold B2B', description:'Prospection froide PME', status:'paused', steps:[{},{}], enrolled:23, completed:5, openRate:32.1, replyRate:4.2 },
  { id:'3', name:'Nurturing Qualifiés', description:'Suivi prospects 30j', status:'draft', steps:[{},{},{},{},{}], enrolled:0, completed:0, openRate:0, replyRate:0 },
];

export default function SequencesPage() {
  const [, navigate] = useLocation();
  const [sequences, setSequences] = useState(MOCK);
  const [toggling, setToggling] = useState<string|null>(null);
  const API = (import.meta.env.VITE_API_URL as string) || '';

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
    <div className="min-h-screen p-6" style={{background:'var(--body-bg)'}}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>Séquences Email</h1>
          <p className="text-sm" style={{color:'var(--text-muted)'}}>{sequences.filter(s=>s.status==='active').length} actives</p>
        </div>
        <button onClick={()=>navigate('/sequences/new')} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{background:'var(--color-primary)'}}>
          <Plus className="w-4 h-4"/>Nouvelle séquence
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          {label:'Inscrits',value:sequences.reduce((s,x)=>s+x.enrolled,0),icon:<Users className="w-5 h-5"/>,color:'text-blue-600 bg-blue-50'},
          {label:'Taux ouverture',value:`${(sequences.filter(s=>s.openRate>0).reduce((s,x,_,a)=>s+x.openRate/a.length,0)||0).toFixed(1)}%`,icon:<Mail className="w-5 h-5"/>,color:'text-purple-600 bg-purple-50'},
          {label:'Actives',value:sequences.filter(s=>s.status==='active').length,icon:<Play className="w-5 h-5"/>,color:'text-teal-600 bg-teal-50'},
        ].map((s,i)=>(
          <div key={i} className="rounded-2xl border p-5 flex items-center gap-4" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>{s.icon}</div>
            <div><div className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>{s.value}</div><div className="text-sm" style={{color:'var(--text-muted)'}}>{s.label}</div></div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {sequences.map(seq=>(
          <div key={seq.id} onClick={()=>navigate(`/sequences/${seq.id}`)}
            className="rounded-2xl border p-5 hover:shadow-md cursor-pointer transition-all"
            style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}
            onMouseEnter={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--color-primary)'}
            onMouseLeave={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--card-border)'}>
            <div className="flex items-center gap-4">
              <div style={{width:40,height:40,borderRadius:10,background:'#F5F3FF',display:'flex',alignItems:'center',justifyContent:'center',color:'#6D28D9'}}>
                <Mail className="w-5 h-5"/>
              </div>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:2}}>
                  <h3 style={{fontWeight:600,fontSize:14,color:'var(--text-primary)',margin:0}}>{seq.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${seq.status==='active'?'bg-green-50 text-green-600':seq.status==='paused'?'bg-amber-50 text-amber-600':'bg-gray-100 text-gray-500'}`}>{seq.status}</span>
                </div>
                <p style={{fontSize:12,color:'var(--text-muted)',margin:'0 0 4px'}}>{seq.description}</p>
                <div style={{display:'flex',gap:20,fontSize:12,color:'var(--text-muted)'}}>
                  <span>{seq.steps.length} étapes</span>
                  <span style={{display:'flex',alignItems:'center',gap:4}}><Users size={11}/>{seq.enrolled}</span>
                  {seq.openRate>0&&<span>{seq.openRate}% ouv.</span>}
                  {seq.replyRate>0&&<span>{seq.replyRate}% rép.</span>}
                </div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <button onClick={e=>toggle(seq.id,e)} disabled={!!toggling||seq.status==='draft'}
                  style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:10,fontSize:13,fontWeight:500,border:'none',cursor:seq.status==='draft'?'not-allowed':'pointer',opacity:seq.status==='draft'?0.5:1,
                    background:seq.status==='active'?'#FFFBEB':'#ECFDF5',color:seq.status==='active'?'#D97706':'#059669'}}>
                  {toggling===seq.id?<Loader2 size={14} className="animate-spin"/>:seq.status==='active'?<><Pause size={14}/>Pause</>:<><Play size={14}/>Lancer</>}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
