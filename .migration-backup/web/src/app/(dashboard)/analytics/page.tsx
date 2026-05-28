'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart2, TrendingUp, Users, DollarSign, Mail, Target, Download, RefreshCw, Loader2, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react';

export default function AnalyticsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');
  const API = process.env.NEXT_PUBLIC_API_URL || '';

  const fetchStats = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token')||'';
      const res = await fetch(`${API}/api/v1/dashboard/stats?period=${period}`, { headers:{ Authorization:`Bearer ${token}` } });
      if (res.ok) setStats(await res.json());
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchStats(); }, [period]);

  const o = stats?.overview || {};
  const pipeline = stats?.pipeline_stages || [];
  const signals = stats?.signals_by_type || [];
  const convRate = o.total_prospects>0 ? ((o.won||0)/o.total_prospects*100).toFixed(1) : '0.0';

  const exportCSV = () => {
    const rows = [['Métrique','Valeur'],['Total prospects',o.total_prospects||0],['Pipeline (€)',o.pipeline_value||0],['CA gagné (€)',o.won_value||0],['Taux conversion (%)',convRate],['Séquences actives',o.active_sequences||0],['Taux ouverture (%)',o.open_rate||0]];
    const csv = rows.map(r=>r.join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download=`analytics_${period}_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  const KPI_CARDS = [
    { label:'Prospects total', value:o.total_prospects||0, icon:<Users className="w-5 h-5"/>, href:'/prospects', trend:o.prospects_this_week>0?`+${o.prospects_this_week} cette semaine`:null, positive:true },
    { label:'Pipeline (€)', value:`${((o.pipeline_value||0)/1000).toFixed(0)}k€`, icon:<DollarSign className="w-5 h-5"/>, href:'/pipeline', trend:null },
    { label:'CA gagné (€)', value:`${((o.won_value||0)/1000).toFixed(0)}k€`, icon:<TrendingUp className="w-5 h-5"/>, href:'/pipeline?stage=won', trend:null },
    { label:'Taux conversion', value:`${convRate}%`, icon:<Target className="w-5 h-5"/>, href:'/pipeline', trend:null },
    { label:'Signaux', value:o.total_signals||0, icon:<BarChart2 className="w-5 h-5"/>, href:'/signals', trend:o.unread_signals>0?`${o.unread_signals} non lus`:null, positive:false },
    { label:'Séquences', value:o.active_sequences||0, icon:<Mail className="w-5 h-5"/>, href:'/sequences', trend:null },
    { label:'Taux ouverture', value:`${o.open_rate||0}%`, icon:<Mail className="w-5 h-5"/>, href:'/sequences', trend:null },
    { label:'Taux réponse', value:`${o.reply_rate||0}%`, icon:<Target className="w-5 h-5"/>, href:'/sequences', trend:null },
  ];

  return (
    <div className="min-h-screen p-6" style={{background:'var(--body-bg)'}}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>Analytics</h1>
          <p className="text-sm" style={{color:'var(--text-muted)'}}>Performance commerciale — Cliquez sur un KPI pour voir les détails</p>
        </div>
        <div className="flex gap-2">
          {/* Sélecteur période FONCTIONNEL */}
          <div className="flex gap-1 p-1 rounded-xl" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)'}}>
            {['7d','30d','90d'].map(p=>(
              <button key={p} onClick={()=>setPeriod(p)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={period===p?{background:'var(--color-primary)',color:'#fff'}:{color:'var(--text-muted)'}}>
                {p}
              </button>
            ))}
          </div>
          <button onClick={fetchStats} disabled={loading} className="p-2 rounded-xl border" style={{background:'var(--card-bg)',borderColor:'var(--card-border)',color:'var(--text-secondary)'}}>
            <RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`}/>
          </button>
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm" style={{background:'var(--card-bg)',borderColor:'var(--card-border)',color:'var(--text-secondary)'}}>
            <Download className="w-4 h-4"/>Export CSV
          </button>
        </div>
      </div>

      {/* KPIs cliquables */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[...Array(8)].map((_,i)=><div key={i} className="rounded-2xl p-5 animate-pulse h-24" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)'}}/>)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {KPI_CARDS.map((k,i)=>(
            <button key={i} onClick={()=>router.push(k.href)}
              className="rounded-2xl p-5 text-left hover:shadow-md transition-all hover:-translate-y-0.5 group"
              style={{background:'var(--card-bg)',border:'1px solid var(--card-border)'}}>
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:'var(--color-primary-light)',color:'var(--color-primary)'}}>{k.icon}</div>
                <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{color:'var(--color-primary)'}}/>
              </div>
              <div className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>{k.value}</div>
              <div className="text-sm mt-0.5" style={{color:'var(--text-muted)'}}>{k.label}</div>
              {k.trend && (
                <div className="flex items-center gap-1 mt-1 text-xs">
                  {k.positive?<ArrowUp className="w-3 h-3 text-green-500"/>:<ArrowDown className="w-3 h-3 text-red-400"/>}
                  <span style={{color:k.positive?'#22C55E':'#EF4444'}}>{k.trend}</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-5 mb-5">
        {/* Pipeline par étape — cliquable */}
        <div className="rounded-2xl p-6" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)'}}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{color:'var(--text-primary)'}}>Répartition pipeline</h2>
            <button onClick={()=>router.push('/pipeline')} className="text-sm flex items-center gap-1" style={{color:'var(--color-primary)'}}>Voir<ChevronRight className="w-4 h-4"/></button>
          </div>
          {pipeline.length===0 ? (
            <div className="text-center py-8">
              <BarChart2 className="w-10 h-10 mx-auto mb-2" style={{color:'var(--card-border)'}}/>
              <p className="text-sm" style={{color:'var(--text-muted)'}}>Aucun deal</p>
              <button onClick={()=>router.push('/pipeline')} className="mt-2 text-sm px-4 py-2 rounded-xl text-white" style={{background:'var(--color-primary)'}}>Créer un deal</button>
            </div>
          ) : (
            <div className="space-y-3">
              {pipeline.map((s:any,i:number)=>(
                <button key={i} onClick={()=>router.push(`/pipeline?stage=${s.stage}`)} className="w-full text-left hover:opacity-80 transition-all">
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{color:'var(--text-secondary)'}} className="capitalize">{s.stage}</span>
                    <div className="flex gap-3">
                      <span className="font-semibold" style={{color:'var(--text-primary)'}}>{s.count} deals</span>
                      {s.value>0&&<span style={{color:'var(--text-muted)'}}>{s.value.toLocaleString()}€</span>}
                    </div>
                  </div>
                  <div className="w-full rounded-full h-2" style={{background:'var(--card-border)'}}>
                    <div className="h-2 rounded-full transition-all" style={{width:`${Math.min((s.count/(o.total_deals||1))*100,100)}%`,background:'var(--color-primary)'}}/>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Signaux par type — cliquable */}
        <div className="rounded-2xl p-6" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)'}}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{color:'var(--text-primary)'}}>Signaux détectés</h2>
            <button onClick={()=>router.push('/signals')} className="text-sm flex items-center gap-1" style={{color:'var(--color-primary)'}}>Voir<ChevronRight className="w-4 h-4"/></button>
          </div>
          {signals.length===0 ? (
            <div className="text-center py-8">
              <Target className="w-10 h-10 mx-auto mb-2" style={{color:'var(--card-border)'}}/>
              <p className="text-sm" style={{color:'var(--text-muted)'}}>Aucun signal</p>
            </div>
          ) : (
            <div className="space-y-3">
              {signals.map((s:any,i:number)=>{
                const total=signals.reduce((sum:number,x:any)=>sum+x.count,0);
                const pct=total>0?Math.round((s.count/total)*100):0;
                return (
                  <button key={i} onClick={()=>router.push(`/signals?type=${s.type}`)} className="w-full text-left hover:opacity-80 transition-all">
                    <div className="flex justify-between text-sm mb-1">
                      <span style={{color:'var(--text-secondary)'}} className="capitalize">{s.type}</span>
                      <span style={{color:'var(--text-primary)'}} className="font-semibold">{s.count} ({pct}%)</span>
                    </div>
                    <div className="w-full rounded-full h-2" style={{background:'var(--card-border)'}}>
                      <div className="h-2 rounded-full" style={{width:`${pct}%`,background:'var(--color-accent)'}}/>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Performance email */}
      <div className="rounded-2xl p-6" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)'}}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold" style={{color:'var(--text-primary)'}}>Performance email · période {period}</h2>
          <button onClick={()=>router.push('/sequences')} className="text-sm flex items-center gap-1" style={{color:'var(--color-primary)'}}>Détails<ChevronRight className="w-4 h-4"/></button>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[
            {l:'Emails envoyés',v:o.emails_sent||0,href:'/sequences'},
            {l:'Séquences actives',v:o.active_sequences||0,href:'/sequences'},
            {l:'Taux ouverture',v:`${o.open_rate||0}%`,href:'/sequences'},
            {l:'Taux réponse',v:`${o.reply_rate||0}%`,href:'/sequences'},
          ].map((k,i)=>(
            <button key={i} onClick={()=>router.push(k.href)} className="rounded-xl p-4 text-center hover:opacity-80 transition-all" style={{background:'var(--color-primary-light)'}}>
              <div className="text-2xl font-bold" style={{color:'var(--color-primary)'}}>{k.v}</div>
              <div className="text-xs mt-1" style={{color:'var(--text-muted)'}}>{k.l}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
