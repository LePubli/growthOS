'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, Star, CheckCircle, Filter, RefreshCw, TrendingUp, Users, DollarSign, Newspaper, Cpu, AlertCircle } from 'lucide-react';

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  funding:    { label:'Financement',   color:'text-green-700',  bg:'bg-green-50',  icon:<DollarSign className="w-4 h-4"/> },
  hiring:     { label:'Recrutement',   color:'text-blue-700',   bg:'bg-blue-50',   icon:<Users className="w-4 h-4"/> },
  news:       { label:'Actualité',     color:'text-purple-700', bg:'bg-purple-50', icon:<Newspaper className="w-4 h-4"/> },
  technology: { label:'Technologie',   color:'text-yellow-700', bg:'bg-yellow-50', icon:<Cpu className="w-4 h-4"/> },
  intent:     { label:'Intention',     color:'text-red-700',    bg:'bg-red-50',    icon:<TrendingUp className="w-4 h-4"/> },
};

const MOCK_SIGNALS = [
  { id:'1', type:'funding',    company:'TechVision', title:'Levée de fonds Série A — 5M€', score:92, isRead:false, isStarred:false, createdAt:'il y a 5 min' },
  { id:'2', type:'hiring',     company:'BigCorp',    title:'Recrute 5 commerciaux B2B',      score:78, isRead:false, isStarred:true,  createdAt:'il y a 30 min' },
  { id:'3', type:'intent',     company:'StartupX',   title:'Visite répétée page pricing (×7)',score:88, isRead:true,  isStarred:false, createdAt:'il y a 1h' },
  { id:'4', type:'news',       company:'Acme Corp',  title:'Acme Corp ouvre un bureau à Paris',score:65, isRead:true,  isStarred:false, createdAt:'il y a 2h' },
  { id:'5', type:'technology', company:'GrowthCo',   title:'Migration vers Salesforce CRM',   score:71, isRead:false, isStarred:false, createdAt:'il y a 3h' },
];

export default function SignalsPage() {
  const router = useRouter();
  const [signals, setSignals] = useState(MOCK_SIGNALS);
  const [filter, setFilter] = useState('all');
  const [fetching, setFetching] = useState(false);
  const API = process.env.NEXT_PUBLIC_API_URL || '';

  useEffect(()=>{
    const fetch_ = async () => {
      setFetching(true);
      try {
        const token = localStorage.getItem('access_token')||'';
        const res = await fetch(`${API}/api/v1/signals`,{headers:{Authorization:`Bearer ${token}`}});
        if (res.ok) { const d=await res.json(); const l=Array.isArray(d)?d:d.data||[]; if(l.length>0) setSignals(l); }
      } catch {} finally { setFetching(false); }
    };
    fetch_();
  },[]);

  const markAllRead = () => setSignals(s=>s.map(x=>({...x,isRead:true})));
  const toggleStar = (id:string, e:React.MouseEvent) => { e.stopPropagation(); setSignals(s=>s.map(x=>x.id===id?{...x,isStarred:!x.isStarred}:x)); };
  const markRead = (id:string) => setSignals(s=>s.map(x=>x.id===id?{...x,isRead:true}:x));

  const filtered = signals.filter(s=>{
    if(filter==='unread') return !s.isRead;
    if(filter==='starred') return s.isStarred;
    if(filter!=='all') return s.type===filter;
    return true;
  });
  const unread = signals.filter(s=>!s.isRead).length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Signaux d'intention</h1>
          <p className="text-sm text-gray-400">{unread} non lu{unread>1?'s':''}</p></div>
        <div className="flex gap-2">
          <button onClick={()=>{}} disabled={fetching} className="p-2 bg-white border border-gray-200 rounded-xl text-gray-500">
            <RefreshCw className={`w-4 h-4 ${fetching?'animate-spin':''}`}/>
          </button>
          <button onClick={markAllRead} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-500 hover:border-teal-300">
            <CheckCircle className="w-4 h-4"/>Tout marquer lu
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {[{k:'all',l:'Tous'},{k:'unread',l:`Non lus (${unread})`},{k:'starred',l:'⭐ Favoris'},...Object.entries(TYPE_CONFIG).map(([k,v])=>({k,l:v.label}))].map(f=>(
          <button key={f.k} onClick={()=>setFilter(f.k)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${filter===f.k?'bg-teal-600 text-white':'bg-white border border-gray-200 text-gray-500 hover:border-teal-300'}`}>{f.l}</button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map(signal=>{
          const type = TYPE_CONFIG[signal.type]||TYPE_CONFIG.news;
          return (
            <div key={signal.id} onClick={()=>{markRead(signal.id);router.push(`/signals/${signal.id}`);}}
              className={`bg-white rounded-2xl border p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-all ${!signal.isRead?'border-teal-200':'border-gray-200'}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${type.bg} ${type.color}`}>{type.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 text-sm">{signal.company}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${type.bg} ${type.color}`}>{type.label}</span>
                  {!signal.isRead&&<span className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0"/>}
                </div>
                <p className="text-sm text-gray-700 mt-0.5 truncate">{signal.title}</p>
                <p className="text-xs text-gray-400">{signal.createdAt}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`text-sm font-bold px-2.5 py-1 rounded-xl ${signal.score>=80?'bg-green-50 text-green-600':'bg-amber-50 text-amber-600'}`}>{signal.score}</span>
                <button onClick={e=>toggleStar(signal.id,e)} className={signal.isStarred?'text-amber-400':'text-gray-300 hover:text-amber-400'}>
                  <Star className={`w-4 h-4 ${signal.isStarred?'fill-amber-400':''}`}/>
                </button>
              </div>
            </div>
          );
        })}
        {filtered.length===0&&<div className="text-center py-16"><Zap className="w-10 h-10 text-gray-200 mx-auto mb-3"/><p className="text-gray-400">Aucun signal</p></div>}
      </div>
    </div>
  );
}
