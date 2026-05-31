import { useState, useEffect, useCallback } from 'react';
import { Link } from 'wouter';
import { Users, DollarSign, RefreshCw, Plus, ChevronRight, Zap, Mail, Phone, Trophy, FileText, Activity } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { OnboardingWizard } from '@/components/common/OnboardingWizard';

const MOCK_FEED = [
  { id:'f1', type:'deal',    icon:<Trophy size={12}/>,   color:'#10B981', bg:'#ECFDF5', text:'GrowthCo · Deal gagné 🎉 9 600€', time:'il y a 5 min' },
  { id:'f2', type:'email',   icon:<Mail size={12}/>,     color:'#7C3AED', bg:'#EDE9FE', text:'Emma Leroy a ouvert votre email ×3', time:'il y a 18 min' },
  { id:'f3', type:'signal',  icon:<Zap size={12}/>,      color:'#F59E0B', bg:'#FEF3C7', text:'TechCorp vient de lever des fonds', time:'il y a 32 min' },
  { id:'f4', type:'call',    icon:<Phone size={12}/>,    color:'#2563EB', bg:'#EFF6FF', text:'Appel terminé · Paul Dupont · BigSales', time:'il y a 1h' },
  { id:'f5', type:'note',    icon:<FileText size={12}/>, color:'#6B7280', bg:'#F3F4F6', text:'Alice a ajouté une note sur AlphaTech', time:'il y a 2h' },
  { id:'f6', type:'signal',  icon:<Zap size={12}/>,      color:'#F59E0B', bg:'#FEF3C7', text:'BigSales SAS recrute un VP Sales', time:'il y a 3h' },
];

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

function DashboardWidget({ wid, value, onRemove }: {wid:string;value:string;onRemove:(id:string)=>void}) {
  const w = ALL_WIDGETS.find(x=>x.id===wid);
  if (!w) return null;
  const c = COLOR_MAP[w.color]||COLOR_MAP.blue;
  return (
    <Link href={w.href} style={{ display:'block', textDecoration:'none' }}>
      <div style={{background:'var(--card-bg)',border:'1px solid var(--card-border)',borderRadius:16,padding:20,cursor:'pointer',position:'relative',transition:'all 0.15s'}}
        onMouseEnter={e=>(e.currentTarget as HTMLElement).style.boxShadow='0 4px 16px rgba(0,0,0,.08)'}
        onMouseLeave={e=>(e.currentTarget as HTMLElement).style.boxShadow='none'}>
        <button onClick={e=>{e.preventDefault();e.stopPropagation();onRemove(wid);}}
          style={{position:'absolute',top:12,right:12,width:20,height:20,borderRadius:'50%',background:'#f3f4f6',border:'none',color:'#9ca3af',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12}}>×</button>
        <div style={{display:'flex',alignItems:'start',justifyContent:'space-between',marginBottom:16}}>
          <div style={{width:40,height:40,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,background:c.bg}}>{w.icon}</div>
          <ChevronRight size={16} color="var(--color-primary)" style={{opacity:0}}/>
        </div>
        <div style={{fontSize:24,fontWeight:700,marginBottom:4,color:'var(--text-primary)'}}>{value}</div>
        <div style={{fontSize:14,color:'var(--text-muted)'}}>{w.label}</div>
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
  const [pipelineStages, setPipelineStages] = useState<any[]>([]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const d: any = await apiClient.get('/dashboard/stats');
      setStats(d.overview||{});
      setRecentProspects(d.recent_prospects||[]);
      setPipelineStages(d.pipeline_stages||[]);
    } catch {} finally { setLoading(false); }
  },[]);

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
    <>
    <div className="min-h-screen p-6" style={{background:'var(--body-bg)'}}>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>{greeting} 👋</h1>
          <p className="text-sm mt-0.5" style={{color:'var(--text-muted)'}}>{new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 p-1 rounded-xl" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)'}}>
            <button onClick={()=>setCustomizing(c=>!c)}
              style={{padding:'6px 12px',borderRadius:8,fontSize:13,fontWeight:500,border:'none',cursor:'pointer',
                background:customizing?'var(--color-primary)':'transparent',
                color:customizing?'#fff':'var(--text-muted)'}}>
              ✏️ Personnaliser
            </button>
          </div>
          <button onClick={fetchStats} disabled={loading}
            style={{padding:8,borderRadius:12,background:'var(--card-bg)',border:'1px solid var(--card-border)',cursor:'pointer',color:'var(--text-muted)',display:'flex',alignItems:'center'}}>
            <RefreshCw size={16} className={loading?'animate-spin':''}/>
          </button>
          <Link href="/prospects" style={{display:'flex',alignItems:'center',gap:8,padding:'8px 16px',borderRadius:12,fontSize:14,fontWeight:500,color:'#fff',background:'var(--color-primary)',textDecoration:'none'}}>
            <Plus size={16}/>Nouveau
          </Link>
        </div>
      </div>

      {/* Mode personnalisation */}
      {customizing && (
        <div className="rounded-2xl border p-5 mb-5" style={{background:'var(--color-primary-light)',borderColor:'var(--color-primary)'}}>
          <h3 className="font-semibold text-sm mb-3" style={{color:'var(--color-primary)'}}>Personnalisation du dashboard — cliquez × pour retirer, ou ajoutez des widgets</h3>
          <div className="flex flex-wrap gap-2">
            {availableToAdd.map(w=>(
              <button key={w.id} onClick={()=>setActiveWidgets(a=>[...a,w.id])}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm border"
                style={{background:'var(--card-bg)',borderColor:'var(--card-border)',color:'var(--text-secondary)'}}>
                <span>{w.icon}</span><span>+ {w.label}</span>
              </button>
            ))}
            {availableToAdd.length===0&&<span className="text-sm" style={{color:'var(--color-primary)'}}>Tous les widgets sont affichés ✓</span>}
          </div>
          <button onClick={()=>setCustomizing(false)} className="mt-3 text-sm underline" style={{color:'var(--color-primary)'}}>Terminer la personnalisation</button>
        </div>
      )}

      {/* Widgets grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        {activeWidgets.map(wid=>(
          <DashboardWidget key={wid} wid={wid} value={widgetValues[wid]||'—'} onRemove={(id:string)=>setActiveWidgets(a=>a.filter(x=>x!==id))}/>
        ))}
      </div>

      {/* Bottom grid: Pipeline | Prospects récents | Actions rapides | Activité */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

        {/* Pipeline */}
        <div className="rounded-2xl p-6" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)'}}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{color:'var(--text-primary)'}}>Pipeline</h2>
            <Link href="/pipeline" className="text-sm flex items-center gap-1" style={{color:'var(--color-primary)',textDecoration:'none'}}>
              Voir<ChevronRight className="w-4 h-4"/>
            </Link>
          </div>
          {pipelineStages.length===0 ? (
            <div className="text-center py-8">
              <DollarSign className="w-10 h-10 mx-auto mb-2" style={{color:'var(--card-border)'}}/>
              <p className="text-sm mb-2" style={{color:'var(--text-muted)'}}>Aucun deal</p>
              <Link href="/pipeline" className="text-sm px-4 py-2 rounded-xl text-white inline-block" style={{background:'var(--color-primary)',textDecoration:'none'}}>+ Créer un deal</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {pipelineStages.map((s:any,i:number)=>(
                <Link key={i} href={`/pipeline?stage=${s.stage}`} style={{display:'block',textDecoration:'none'}}>
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{color:'var(--text-secondary)'}} className="capitalize">{s.stage}</span>
                    <span className="font-semibold" style={{color:'var(--text-primary)'}}>{s.count} ({s.value?.toLocaleString()||0}€)</span>
                  </div>
                  <div className="w-full rounded-full h-1.5" style={{background:'var(--card-border)'}}>
                    <div className="h-1.5 rounded-full" style={{width:`${Math.min((s.count/(o.total_deals||1))*100,100)}%`,background:'var(--color-primary)'}}/>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Prospects récents */}
        <div className="rounded-2xl p-6" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)'}}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{color:'var(--text-primary)'}}>Prospects récents</h2>
            <Link href="/prospects" className="text-sm flex items-center gap-1" style={{color:'var(--color-primary)',textDecoration:'none'}}>
              Tous<ChevronRight className="w-4 h-4"/>
            </Link>
          </div>
          {recentProspects.length===0 ? (
            <div className="text-center py-8">
              <Users className="w-10 h-10 mx-auto mb-2" style={{color:'var(--card-border)'}}/>
              <p className="text-sm mb-2" style={{color:'var(--text-muted)'}}>Aucun prospect</p>
              <Link href="/prospects" className="text-sm px-4 py-2 rounded-xl text-white inline-block" style={{background:'var(--color-primary)',textDecoration:'none'}}>+ Ajouter</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentProspects.slice(0,6).map((p:any,i:number)=>(
                <Link key={i} href={`/prospects/${p.id}`} className="flex items-center gap-3 p-2 rounded-xl hover:opacity-80 transition-all" style={{background:'var(--body-bg)',textDecoration:'none'}}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{background:'var(--color-primary)'}}>
                    {(p.full_name||p.firstName||p.company_name||'?')[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{color:'var(--text-primary)'}}>{p.full_name||`${p.firstName||''} ${p.lastName||''}`.trim()||p.company_name}</div>
                    <div className="text-xs truncate" style={{color:'var(--text-muted)'}}>{p.company_name||p.company||p.email}</div>
                  </div>
                  {(p.propensity_score||p.score)>0 && (
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${(p.propensity_score||p.score)>=80?'bg-green-50 text-green-600':'bg-amber-50 text-amber-600'}`}>
                      {p.propensity_score||p.score}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Actions rapides + Système */}
        <div className="space-y-4">
          <div className="rounded-2xl p-5" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)'}}>
            <h2 className="font-semibold mb-3" style={{color:'var(--text-primary)'}}>Actions rapides</h2>
            <div className="space-y-2">
              {[
                {l:'+ Nouveau prospect',href:'/prospects',icon:'👤'},
                {l:'+ Créer une séquence',href:'/sequences/new',icon:'📧'},
                {l:'+ Lancer un scraping',href:'/sourcing',icon:'🔍'},
                {l:'Voir les signaux',href:'/signals',icon:'⚡',badge:o.unread_signals},
                {l:'Installer un plugin',href:'/plugins',icon:'🧩'},
              ].map((a,i)=>(
                <Link key={i} href={a.href} className="flex items-center gap-3 p-2.5 rounded-xl hover:opacity-80 transition-all text-sm font-medium"
                  style={{background:'var(--body-bg)',color:'var(--color-primary)',textDecoration:'none'}}>
                  <span>{a.icon}</span>
                  <span className="flex-1">{a.l}</span>
                  {a.badge&&a.badge>0&&<span className="text-xs px-1.5 py-0.5 rounded-full bg-red-500 text-white">{a.badge}</span>}
                </Link>
              ))}
            </div>
          </div>
          <div className="rounded-2xl p-4" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)'}}>
            <h3 className="font-semibold text-sm mb-3" style={{color:'var(--text-primary)'}}>Système</h3>
            {[{l:'API',v:'✅'},{l:'PostgreSQL',v:'✅'},{l:'Redis',v:'✅'},{l:'Plugins VM',v:'✅'}].map((s,i)=>(
              <div key={i} className="flex justify-between text-xs py-1" style={{color:'var(--text-secondary)'}}><span>{s.l}</span><span>{s.v}</span></div>
            ))}
          </div>
        </div>

      </div>

      {/* Activity feed row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Fil d'activité */}
        <div className="rounded-2xl p-5" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)'}}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity size={16} style={{color:'var(--color-primary)'}}/>
              <h2 className="font-semibold" style={{color:'var(--text-primary)'}}>Activité récente</h2>
            </div>
            <Link href="/activities" className="text-sm flex items-center gap-1" style={{color:'var(--color-primary)',textDecoration:'none'}}>
              Toutes<ChevronRight className="w-4 h-4"/>
            </Link>
          </div>
          <div className="relative">
            <div className="absolute left-3.5 top-0 bottom-0 w-px" style={{background:'var(--card-border)'}}/>
            <div className="space-y-0">
              {MOCK_FEED.map((item,i)=>(
                <div key={item.id} className="relative flex items-start gap-3 pb-4 last:pb-0 pl-8">
                  <div className="absolute left-0 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{background:item.bg,color:item.color,border:`2px solid var(--card-bg)`}}>
                    {item.icon}
                  </div>
                  <div className="flex-1 pt-0.5">
                    <div className="text-sm" style={{color:'var(--text-primary)'}}>{item.text}</div>
                    <div className="text-xs mt-0.5" style={{color:'var(--text-muted)'}}>{item.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Performance hebdo */}
        <div className="rounded-2xl p-5" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)'}}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{color:'var(--text-primary)'}}>Performance hebdo</h2>
            <Link href="/analytics" className="text-sm flex items-center gap-1" style={{color:'var(--color-primary)',textDecoration:'none'}}>
              Voir<ChevronRight className="w-4 h-4"/>
            </Link>
          </div>
          <div className="space-y-3">
            {[
              { label:'Emails envoyés',   value:48,  max:60,  color:'#7C3AED', icon:'📧' },
              { label:'Appels passés',    value:12,  max:20,  color:'#2563EB', icon:'📞' },
              { label:'Prospects ajoutés',value:23,  max:30,  color:'#0F766E', icon:'👤' },
              { label:'Deals créés',      value:5,   max:10,  color:'#D97706', icon:'💰' },
              { label:'RDV planifiés',    value:8,   max:15,  color:'#059669', icon:'📅' },
            ].map(m=>(
              <div key={m.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 text-sm" style={{color:'var(--text-secondary)'}}>
                    <span>{m.icon}</span>{m.label}
                  </div>
                  <span className="text-sm font-bold" style={{color:'var(--text-primary)'}}>{m.value}<span className="font-normal text-xs" style={{color:'var(--text-muted)'}}>/{m.max}</span></span>
                </div>
                <div className="w-full rounded-full h-2" style={{background:'var(--body-bg)'}}>
                  <div className="h-2 rounded-full transition-all" style={{width:`${Math.round(m.value/m.max*100)}%`,background:m.color}}/>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
    <OnboardingWizard />
    </>
  );
}
