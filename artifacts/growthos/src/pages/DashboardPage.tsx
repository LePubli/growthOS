import { useState, useEffect, useCallback } from 'react';
import { Link } from 'wouter';
import { Users, DollarSign, TrendingUp, Target, Zap, RefreshCw, Plus, ChevronRight, CheckCircle, BarChart2, Mail } from 'lucide-react';

const ALL_WIDGETS = [
  { id:'prospects',  label:'Total Prospects',     icon:'👥', color:'blue',   href:'/prospects' },
  { id:'pipeline',   label:'Pipeline (€)',         icon:'💰', color:'green',  href:'/pipeline' },
  { id:'won',        label:'CA Gagné (€)',          icon:'🏆', color:'teal',   href:'/pipeline' },
  { id:'conversion', label:'Taux Conversion',       icon:'🎯', color:'purple', href:'/analytics' },
  { id:'signals',    label:'Signaux Non Lus',       icon:'⚡', color:'amber',  href:'/signals' },
  { id:'sequences',  label:'Séquences Actives',     icon:'📧', color:'pink',   href:'/sequences' },
  { id:'openrate',   label:'Taux Ouverture',        icon:'📊', color:'indigo', href:'/analytics' },
];

const COLOR_MAP: Record<string,{bg:string;text:string}> = {
  blue:  {bg:'#EFF6FF',text:'#1D4ED8'}, green: {bg:'#ECFDF5',text:'#065F46'},
  teal:  {bg:'#F0FDFA',text:'#0F766E'}, purple:{bg:'#F5F3FF',text:'#6D28D9'},
  amber: {bg:'#FFFBEB',text:'#92400E'}, pink:  {bg:'#FDF2F8',text:'#9D174D'},
  indigo:{bg:'#EEF2FF',text:'#3730A3'},
};

function DashboardWidget({ wid, value, onRemove, href }: any) {
  const w = ALL_WIDGETS.find(x=>x.id===wid);
  if (!w) return null;
  const c = COLOR_MAP[w.color]||COLOR_MAP.blue;
  return (
    <Link href={href||w.href} style={{ display: 'block', textDecoration: 'none' }}>
      <div className="group" style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius: 16, padding: 20, cursor:'pointer', position:'relative', transition:'all 0.15s' }}
        onMouseEnter={e=>(e.currentTarget as HTMLElement).style.boxShadow='0 4px 16px rgba(0,0,0,.08)'}
        onMouseLeave={e=>(e.currentTarget as HTMLElement).style.boxShadow='none'}>
        <button onClick={e=>{e.preventDefault();e.stopPropagation();onRemove(wid);}}
          style={{ position:'absolute',top:12,right:12,width:20,height:20,borderRadius:'50%',background:'#f3f4f6',border:'none',color:'#9ca3af',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12 }}>×</button>
        <div style={{ display:'flex', alignItems:'start', justifyContent:'space-between', marginBottom:16 }}>
          <div style={{ width:40,height:40,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,background:c.bg }}>{w.icon}</div>
          <ChevronRight size={16} color="var(--color-primary)" style={{opacity:0}}/>
        </div>
        <div style={{ fontSize:24,fontWeight:700,marginBottom:4,color:'var(--text-primary)' }}>{value}</div>
        <div style={{ fontSize:14,color:'var(--text-muted)' }}>{w.label}</div>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [activeWidgets, setActiveWidgets] = useState(['prospects','pipeline','won','conversion','signals','sequences']);
  const [greeting, setGreeting] = useState('Bonjour');
  const [recentProspects, setRecentProspects] = useState<any[]>([]);
  const API = (import.meta.env.VITE_API_URL as string) || '';

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token')||'';
      const res = await fetch(`${API}/api/v1/dashboard/stats`,{headers:{Authorization:`Bearer ${token}`}});
      if (res.ok) {
        const d = await res.json();
        setStats(d.overview||{});
        setRecentProspects(d.recent_prospects||[]);
      }
    } catch {} finally { setLoading(false); }
  },[API]);

  useEffect(()=>{
    const h=new Date().getHours();
    setGreeting(h<12?'Bonjour':h<18?'Bon après-midi':'Bonsoir');
    fetchStats();
  },[]);

  const o = stats;
  const fmt=(n:number)=>n>=1000?`${(n/1000).toFixed(1)}k`:String(n||0);
  const fmtEur=(n:number)=>n>=1000?`${(n/1000).toFixed(0)}k€`:`${n||0}€`;

  const widgetValues: Record<string,string> = {
    prospects: fmt(o.total_prospects||0),
    pipeline:  fmtEur(o.pipeline_value||0),
    won:       fmtEur(o.won_value||0),
    conversion:`${o.total_prospects>0?((o.won||0)/o.total_prospects*100).toFixed(1):0}%`,
    signals:   fmt(o.unread_signals||0),
    sequences: String(o.active_sequences||0),
    openrate:  `${o.open_rate||0}%`,
  };

  const availableToAdd = ALL_WIDGETS.filter(w=>!activeWidgets.includes(w.id));

  return (
    <div className="min-h-screen p-6" style={{background:'var(--body-bg)'}}>
      <div style={{display:'flex',alignItems:'start',justifyContent:'space-between',marginBottom:24}}>
        <div>
          <h1 style={{fontSize:24,fontWeight:700,color:'var(--text-primary)',margin:0}}>{greeting} 👋</h1>
          <p style={{fontSize:14,color:'var(--text-muted)',marginTop:4}}>{new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}</p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{display:'flex',gap:4,padding:4,borderRadius:12,background:'var(--card-bg)',border:'1px solid var(--card-border)'}}>
            <button onClick={()=>setCustomizing(c=>!c)} style={{padding:'6px 12px',borderRadius:8,fontSize:13,fontWeight:500,border:'none',cursor:'pointer',background:customizing?'var(--color-primary)':'transparent',color:customizing?'#fff':'var(--text-muted)'}}>
              ✏️ Personnaliser
            </button>
          </div>
          <button onClick={fetchStats} disabled={loading} style={{padding:8,borderRadius:12,background:'var(--card-bg)',border:'1px solid var(--card-border)',cursor:'pointer',color:'var(--text-muted)',display:'flex',alignItems:'center'}}>
            <RefreshCw size={16} className={loading?'animate-spin':''}/>
          </button>
        </div>
      </div>

      {customizing && availableToAdd.length > 0 && (
        <div style={{marginBottom:20,padding:16,borderRadius:16,background:'var(--card-bg)',border:'1px solid var(--card-border)'}}>
          <p style={{fontSize:13,fontWeight:600,color:'var(--text-primary)',marginBottom:12}}>Ajouter des widgets</p>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {availableToAdd.map(w=>(
              <button key={w.id} onClick={()=>setActiveWidgets(a=>[...a,w.id])}
                style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:8,background:'var(--body-bg)',border:'1px solid var(--card-border)',fontSize:13,cursor:'pointer',color:'var(--text-secondary)'}}>
                <Plus size={12}/>{w.icon} {w.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:16,marginBottom:24}}>
        {activeWidgets.map(wid=>(
          <DashboardWidget key={wid} wid={wid} value={widgetValues[wid]||'—'} onRemove={(id:string)=>setActiveWidgets(a=>a.filter(x=>x!==id))}/>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 280px',gap:20}}>
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div style={{borderRadius:16,padding:20,background:'var(--card-bg)',border:'1px solid var(--card-border)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <h2 style={{fontWeight:600,color:'var(--text-primary)',margin:0,fontSize:15}}>Prospects récents</h2>
              <Link href="/prospects" style={{fontSize:13,color:'var(--color-primary)',textDecoration:'none'}}>Voir tout →</Link>
            </div>
            {recentProspects.length === 0 ? (
              <div style={{textAlign:'center',padding:'32px 0',color:'var(--text-muted)',fontSize:14}}>
                <Users size={32} style={{margin:'0 auto 8px',display:'block',opacity:0.3}}/>
                Aucun prospect récent
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {recentProspects.slice(0,5).map((p:any,i:number)=>(
                  <Link key={i} href={`/prospects/${p.id}`} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',borderRadius:10,background:'var(--body-bg)',textDecoration:'none'}}>
                    <div style={{width:32,height:32,borderRadius:8,background:'var(--color-primary)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:12,fontWeight:700,flexShrink:0}}>
                      {(p.firstName?.[0]||p.company?.[0]||'?').toUpperCase()}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:600,color:'var(--text-primary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.firstName} {p.lastName} {p.company && `· ${p.company}`}</div>
                      <div style={{fontSize:12,color:'var(--text-muted)'}}>{p.email}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div style={{borderRadius:16,padding:20,background:'var(--card-bg)',border:'1px solid var(--card-border)'}}>
            <h2 style={{fontWeight:600,color:'var(--text-primary)',margin:'0 0 12px',fontSize:15}}>Actions rapides</h2>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {[
                {l:'+ Nouveau prospect',href:'/prospects',icon:'👤'},
                {l:'+ Créer une séquence',href:'/sequences/new',icon:'📧'},
                {l:'+ Lancer un scraping',href:'/sourcing',icon:'🔍'},
                {l:'Voir les signaux',href:'/signals',icon:'⚡'},
                {l:'Installer un plugin',href:'/plugins',icon:'🧩'},
              ].map((a,i)=>(
                <Link key={i} href={a.href} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',borderRadius:10,background:'var(--body-bg)',color:'var(--color-primary)',textDecoration:'none',fontSize:13,fontWeight:500}}>
                  <span>{a.icon}</span><span style={{flex:1}}>{a.l}</span>
                </Link>
              ))}
            </div>
          </div>
          <div style={{borderRadius:16,padding:16,background:'var(--card-bg)',border:'1px solid var(--card-border)'}}>
            <h3 style={{fontWeight:600,fontSize:13,marginBottom:12,color:'var(--text-primary)'}}>Système</h3>
            {[{l:'API NestJS',v:'✅'},{l:'PostgreSQL',v:'✅'},{l:'Redis',v:'✅'},{l:'Plugins VM',v:'✅'}].map((s,i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'4px 0',color:'var(--text-secondary)'}}><span>{s.l}</span><span>{s.v}</span></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
