import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Zap, Star, CheckCircle, RefreshCw, TrendingUp, Users, DollarSign, Newspaper, Cpu } from 'lucide-react';
import apiClient from '@/lib/api-client';

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  funding:    { label:'Financement',   color:'text-green-700',  bg:'bg-green-50',  icon:<DollarSign size={14}/> },
  hiring:     { label:'Recrutement',   color:'text-blue-700',   bg:'bg-blue-50',   icon:<Users size={14}/> },
  news:       { label:'Actualité',     color:'text-purple-700', bg:'bg-purple-50', icon:<Newspaper size={14}/> },
  technology: { label:'Technologie',   color:'text-yellow-700', bg:'bg-yellow-50', icon:<Cpu size={14}/> },
  intent:     { label:'Intention',     color:'text-red-700',    bg:'bg-red-50',    icon:<TrendingUp size={14}/> },
};

const MOCK_SIGNALS = [
  { id:'1', type:'funding',    company:'TechVision', title:'Levée de fonds Série A — 5M€', score:92, isRead:false, isStarred:false, createdAt:'il y a 5 min' },
  { id:'2', type:'hiring',     company:'BigCorp',    title:'Recrute 5 commerciaux B2B',      score:78, isRead:false, isStarred:true,  createdAt:'il y a 30 min' },
  { id:'3', type:'intent',     company:'StartupX',   title:'Visite répétée page pricing (×7)',score:88, isRead:true,  isStarred:false, createdAt:'il y a 1h' },
  { id:'4', type:'news',       company:'Acme Corp',  title:'Acme Corp ouvre un bureau à Paris',score:65, isRead:true,  isStarred:false, createdAt:'il y a 2h' },
  { id:'5', type:'technology', company:'GrowthCo',   title:'Migration vers Salesforce CRM',   score:71, isRead:false, isStarred:false, createdAt:'il y a 3h' },
];

export default function SignalsPage() {
  const [, navigate] = useLocation();
  const [signals, setSignals] = useState(MOCK_SIGNALS);
  const [filter, setFilter] = useState('all');
  const [fetching, setFetching] = useState(false);

  useEffect(()=>{
    setFetching(true);
    apiClient.get('/signals').then((d: any) => {
      const l = Array.isArray(d) ? d : d.data || [];
      if (l.length > 0) setSignals(l);
    }).catch(()=>{}).finally(()=>setFetching(false));
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
    <div className="min-h-screen p-6" style={{background:'var(--body-bg)'}}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>Signaux d'intention</h1>
          <p className="text-sm" style={{color:'var(--text-muted)'}}>{unread} non lu{unread>1?'s':''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>{}} disabled={fetching} className="p-2 rounded-xl" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)',color:'var(--text-secondary)'}}>
            <RefreshCw className={`w-4 h-4 ${fetching?'animate-spin':''}`}/>
          </button>
          <button onClick={markAllRead} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)',color:'var(--text-secondary)'}}>
            <CheckCircle className="w-4 h-4"/>Tout marquer lu
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {[{k:'all',l:'Tous'},{k:'unread',l:`Non lus (${unread})`},{k:'starred',l:'⭐ Favoris'},...Object.entries(TYPE_CONFIG).map(([k,v])=>({k,l:v.label}))].map(f=>(
          <button key={f.k} onClick={()=>setFilter(f.k)}
            className="px-3 py-1.5 rounded-xl text-sm font-medium transition-all"
            style={filter===f.k?{background:'var(--color-primary)',color:'#fff'}:{background:'var(--card-bg)',border:'1px solid var(--card-border)',color:'var(--text-muted)'}}>
            {f.l}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map(signal=>{
          const type = TYPE_CONFIG[signal.type]||TYPE_CONFIG.news;
          return (
            <div key={signal.id} onClick={()=>{markRead(signal.id);navigate(`/signals/${signal.id}`);}}
              className={`rounded-2xl border p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-all`}
              style={{background:'var(--card-bg)',borderColor:!signal.isRead?'var(--color-primary)':'var(--card-border)'}}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${type.bg} ${type.color}`}>{type.icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
                  <span style={{fontWeight:600,fontSize:13,color:'var(--text-primary)'}}>{signal.company}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${type.bg} ${type.color}`}>{type.label}</span>
                  {!signal.isRead&&<span style={{width:8,height:8,borderRadius:'50%',background:'var(--color-primary)',display:'inline-block'}}/>}
                </div>
                <p style={{fontSize:13,color:'var(--text-secondary)',margin:'0 0 2px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{signal.title}</p>
                <p style={{fontSize:11,color:'var(--text-muted)',margin:0}}>{signal.createdAt}</p>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
                <span style={{fontSize:13,fontWeight:700,padding:'4px 10px',borderRadius:10,background:signal.score>=80?'#ECFDF5':'#FFFBEB',color:signal.score>=80?'#059669':'#D97706'}}>{signal.score}</span>
                <button onClick={e=>toggleStar(signal.id,e)} style={{background:'none',border:'none',cursor:'pointer',color:signal.isStarred?'#F59E0B':'var(--card-border)'}}>
                  <Star size={16} fill={signal.isStarred?'#F59E0B':'none'}/>
                </button>
              </div>
            </div>
          );
        })}
        {filtered.length===0&&<div style={{textAlign:'center',padding:'64px 0'}}>
          <Zap size={40} style={{margin:'0 auto 12px',display:'block',opacity:0.2}}/>
          <p style={{fontSize:14,color:'var(--text-muted)'}}>Aucun signal</p>
        </div>}
      </div>
    </div>
  );
}
