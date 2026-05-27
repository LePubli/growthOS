'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Users, DollarSign, TrendingUp, Target, Zap, RefreshCw, Plus, ChevronRight, Bell, Clock, CheckCircle, BarChart2, Mail, GripVertical, X, AlertCircle, Loader2 } from 'lucide-react';

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
    <Link href={href||w.href} className="block rounded-2xl p-5 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all group relative" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)'}}>
      <button onClick={e=>{e.preventDefault();e.stopPropagation();onRemove(wid);}} className="absolute top-3 right-3 w-5 h-5 rounded-full bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-400 hidden group-hover:flex items-center justify-center text-xs">×</button>
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{background:c.bg}}>{w.icon}</div>
        <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{color:'var(--color-primary)'}}/>
      </div>
      <div className="text-2xl font-bold mb-1" style={{color:'var(--text-primary)'}}>{value}</div>
      <div className="text-sm" style={{color:'var(--text-muted)'}}>{w.label}</div>
    </Link>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [activeWidgets, setActiveWidgets] = useState(['prospects','pipeline','won','conversion','signals','sequences']);
  const [greeting, setGreeting] = useState('Bonjour');
  const [recentProspects, setRecentProspects] = useState<any[]>([]);
  const [pipelineStages, setPipelineStages] = useState<any[]>([]);
  const API = process.env.NEXT_PUBLIC_API_URL||'';

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token')||'';
      const res = await fetch(`${API}/api/v1/dashboard/stats`,{headers:{Authorization:`Bearer ${token}`}});
      if (res.ok) {
        const d = await res.json();
        setStats(d.overview||{});
        setRecentProspects(d.recent_prospects||[]);
        setPipelineStages(d.pipeline_stages||[]);
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
    prospects: fmt(o.total_prospects),
    pipeline:  fmtEur(o.pipeline_value),
    won:       fmtEur(o.won_value),
    conversion:`${o.total_prospects>0?((o.won||0)/o.total_prospects*100).toFixed(1):0}%`,
    signals:   fmt(o.unread_signals),
    sequences: String(o.active_sequences||0),
    openrate:  `${o.open_rate||0}%`,
  };

  const availableToAdd = ALL_WIDGETS.filter(w=>!activeWidgets.includes(w.id));

  return (
    <div className="min-h-screen p-6" style={{background:'var(--body-bg)'}}>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>{greeting} 👋</h1>
          <p className="text-sm mt-0.5" style={{color:'var(--text-muted)'}}>{new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 p-1 rounded-xl" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)'}}>
            <button onClick={()=>setCustomizing(c=>!c)} className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all" style={customizing?{background:'var(--color-primary)',color:'#fff'}:{color:'var(--text-muted)'}}>
              ✏️ Personnaliser
            </button>
          </div>
          <button onClick={fetchStats} disabled={loading} className="p-2 rounded-xl border" style={{background:'var(--card-bg)',borderColor:'var(--card-border)',color:'var(--text-secondary)'}}>
            <RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`}/>
          </button>
          <Link href="/prospects?new=1" className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{background:'var(--color-primary)'}}>
            <Plus className="w-4 h-4"/>Nouveau
          </Link>
        </div>
      </div>

      {/* Mode personnalisation */}
      {customizing && (
        <div className="rounded-2xl border p-5 mb-5" style={{background:'var(--color-primary-light)',borderColor:'var(--color-primary)'}}>
          <h3 className="font-semibold text-sm mb-3" style={{color:'var(--color-primary)'}}>Personnalisation du dashboard — Cliquez × pour retirer, ou ajoutez des widgets</h3>
          <div className="flex flex-wrap gap-2">
            {availableToAdd.map(w=>(
              <button key={w.id} onClick={()=>setActiveWidgets(a=>[...a,w.id])}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm border" style={{background:'var(--card-bg)',borderColor:'var(--card-border)',color:'var(--text-secondary)'}}>
                <span>{w.icon}</span><span>+ {w.label}</span>
              </button>
            ))}
            {availableToAdd.length===0&&<span className="text-sm" style={{color:'var(--color-primary)'}}>Tous les widgets sont affichés ✓</span>}
          </div>
          <button onClick={()=>setCustomizing(false)} className="mt-3 text-sm underline" style={{color:'var(--color-primary)'}}>Terminer la personnalisation</button>
        </div>
      )}

      {/* Widgets */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        {activeWidgets.map(wid=>(
          <DashboardWidget key={wid} wid={wid} value={widgetValues[wid]||'—'} onRemove={(id:string)=>setActiveWidgets(a=>a.filter(x=>x!==id))}/>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Pipeline */}
        <div className="rounded-2xl p-6" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)'}}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{color:'var(--text-primary)'}}>Pipeline</h2>
            <Link href="/pipeline" className="text-sm flex items-center gap-1" style={{color:'var(--color-primary)'}}>Voir<ChevronRight className="w-4 h-4"/></Link>
          </div>
          {pipelineStages.length===0?(
            <div className="text-center py-8">
              <DollarSign className="w-10 h-10 mx-auto mb-2" style={{color:'var(--card-border)'}}/>
              <p className="text-sm mb-2" style={{color:'var(--text-muted)'}}>Aucun deal</p>
              <Link href="/pipeline?new=1" className="text-sm px-4 py-2 rounded-xl text-white inline-block" style={{background:'var(--color-primary)'}}>+ Créer un deal</Link>
            </div>
          ):(
            <div className="space-y-3">
              {pipelineStages.map((s:any,i:number)=>(
                <Link key={i} href={`/pipeline?stage=${s.stage}`} className="block">
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
            <Link href="/prospects" className="text-sm flex items-center gap-1" style={{color:'var(--color-primary)'}}>Tous<ChevronRight className="w-4 h-4"/></Link>
          </div>
          {recentProspects.length===0?(
            <div className="text-center py-8">
              <Users className="w-10 h-10 mx-auto mb-2" style={{color:'var(--card-border)'}}/>
              <p className="text-sm mb-2" style={{color:'var(--text-muted)'}}>Aucun prospect</p>
              <Link href="/prospects?new=1" className="text-sm px-4 py-2 rounded-xl text-white inline-block" style={{background:'var(--color-primary)'}}>+ Ajouter</Link>
            </div>
          ):(
            <div className="space-y-2">
              {recentProspects.slice(0,6).map((p:any,i:number)=>(
                <Link key={i} href={`/prospects/${p.id}`} className="flex items-center gap-3 p-2 rounded-xl hover:opacity-80 transition-all" style={{background:'var(--body-bg)'}}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{background:'var(--color-primary)'}}>
                    {(p.full_name||p.company_name||'?')[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{color:'var(--text-primary)'}}>{p.full_name||p.company_name}</div>
                    <div className="text-xs truncate" style={{color:'var(--text-muted)'}}>{p.company_name||p.email}</div>
                  </div>
                  {p.propensity_score>0&&<span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${p.propensity_score>=80?'bg-green-50 text-green-600':'bg-amber-50 text-amber-600'}`}>{p.propensity_score}</span>}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Actions rapides */}
        <div className="space-y-4">
          <div className="rounded-2xl p-5" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)'}}>
            <h2 className="font-semibold mb-3" style={{color:'var(--text-primary)'}}>Actions rapides</h2>
            <div className="space-y-2">
              {[
                {l:'+ Nouveau prospect',href:'/prospects?new=1',icon:'👤'},
                {l:'+ Créer une séquence',href:'/sequences/new',icon:'📧'},
                {l:'+ Lancer un scraping',href:'/sourcing',icon:'🔍'},
                {l:'Voir les signaux',href:'/signals',icon:'⚡',badge:o.unread_signals},
                {l:'Installer un plugin',href:'/plugins',icon:'🧩'},
              ].map((a,i)=>(
                <Link key={i} href={a.href} className="flex items-center gap-3 p-2.5 rounded-xl hover:opacity-80 transition-all text-sm font-medium" style={{background:'var(--body-bg)',color:'var(--color-primary)'}}>
                  <span>{a.icon}</span><span className="flex-1">{a.l}</span>
                  {a.badge&&a.badge>0&&<span className="text-xs px-1.5 py-0.5 rounded-full bg-red-500 text-white">{a.badge}</span>}
                </Link>
              ))}
            </div>
          </div>
          <div className="rounded-2xl p-4" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)'}}>
            <h3 className="font-semibold text-sm mb-3" style={{color:'var(--text-primary)'}}>Système</h3>
            {[{l:'API NestJS',v:'✅'},{l:'PostgreSQL',v:'✅'},{l:'Redis',v:'✅'},{l:'Plugins VM',v:'✅'}].map((s,i)=>(
              <div key={i} className="flex justify-between text-xs py-1" style={{color:'var(--text-secondary)'}}><span>{s.l}</span><span>{s.v}</span></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
