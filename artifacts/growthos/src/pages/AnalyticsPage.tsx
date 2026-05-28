import { useState, useEffect } from 'react';
import { BarChart2, TrendingUp, Users, DollarSign, Mail, Target, Download, Loader2 } from 'lucide-react';

export default function AnalyticsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');
  const API = (import.meta.env.VITE_API_URL as string) || '';

  useEffect(() => {
    const fetch_ = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('access_token')||'';
        const res = await fetch(`${API}/api/v1/dashboard/stats`,{headers:{Authorization:`Bearer ${token}`}});
        if (res.ok) setStats(await res.json());
      } catch {} finally { setLoading(false); }
    };
    fetch_();
  }, [period]);

  const o = stats?.overview || {};
  const pipeline = stats?.pipeline_stages || [];
  const signals = stats?.signals_by_type || [];
  const convRate = o.total_prospects>0 ? ((o.won||0)/o.total_prospects*100).toFixed(1) : '0.0';

  const exportCSV = () => {
    const rows = [
      ['Métrique','Valeur'],
      ['Total prospects',o.total_prospects||0],
      ['Pipeline total (€)',o.pipeline_value||0],
      ['CA gagné (€)',o.won_value||0],
      ['Taux de conversion (%)',convRate],
      ['Séquences actives',o.active_sequences||0],
      ['Taux ouverture (%)',o.open_rate||0],
      ['Signaux non lus',o.unread_signals||0],
    ];
    const csv = rows.map(r=>r.join(',')).join('\n');
    const blob = new Blob([csv],{type:'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `analytics_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh'}}><Loader2 className="w-8 h-8 animate-spin" style={{color:'var(--color-primary)'}}/></div>;

  return (
    <div className="min-h-screen p-6" style={{background:'var(--body-bg)'}}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>Analytics</h1>
          <p className="text-sm" style={{color:'var(--text-muted)'}}>Vue d'ensemble de vos performances commerciales</p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1 p-1 rounded-xl" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)'}}>
            {['7d','30d','90d'].map(p=><button key={p} onClick={()=>setPeriod(p)} className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all" style={period===p?{background:'var(--color-primary)',color:'#fff'}:{color:'var(--text-muted)'}}>{p}</button>)}
          </div>
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)',color:'var(--text-secondary)'}}>
            <Download className="w-4 h-4"/>Exporter CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          {l:'Prospects total',v:o.total_prospects||0,icon:<Users className="w-5 h-5"/>,color:'text-blue-600 bg-blue-50'},
          {l:'Pipeline (€)',v:`${((o.pipeline_value||0)/1000).toFixed(0)}k`,icon:<DollarSign className="w-5 h-5"/>,color:'text-green-600 bg-green-50'},
          {l:'CA gagné (€)',v:`${((o.won_value||0)/1000).toFixed(0)}k`,icon:<TrendingUp className="w-5 h-5"/>,color:'text-teal-600 bg-teal-50'},
          {l:'Taux conversion',v:`${convRate}%`,icon:<Target className="w-5 h-5"/>,color:'text-purple-600 bg-purple-50'},
        ].map((k,i)=>(
          <div key={i} className="rounded-2xl border p-5 flex items-center gap-4" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${k.color}`}>{k.icon}</div>
            <div><div className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>{k.v}</div><div className="text-xs" style={{color:'var(--text-muted)'}}>{k.l}</div></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5 mb-5">
        <div className="rounded-2xl border p-6" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
          <h2 className="font-semibold mb-4" style={{color:'var(--text-primary)'}}>Répartition pipeline</h2>
          {pipeline.length === 0 ? (
            <div className="text-center py-8">
              <BarChart2 className="w-10 h-10 mx-auto mb-2" style={{color:'var(--card-border)'}}/>
              <p className="text-sm" style={{color:'var(--text-muted)'}}>Aucun deal</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pipeline.map((s:any,i:number)=>(
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{color:'var(--text-secondary)'}} className="capitalize">{s.stage}</span>
                    <div className="flex gap-3">
                      <span className="font-semibold" style={{color:'var(--text-primary)'}}>{s.count} deals</span>
                      {s.value>0&&<span style={{color:'var(--text-muted)'}}>{s.value.toLocaleString()}€</span>}
                    </div>
                  </div>
                  <div className="w-full rounded-full h-2" style={{background:'var(--body-bg)'}}>
                    <div className="h-2 rounded-full transition-all" style={{width:`${Math.min((s.count/(o.total_deals||1))*100,100)}%`,background:'var(--color-primary)'}}/>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border p-6" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
          <h2 className="font-semibold mb-4" style={{color:'var(--text-primary)'}}>Email Performance</h2>
          <div className="space-y-4">
            {[
              {l:'Taux ouverture',v:o.open_rate||0,color:'var(--color-primary)'},
              {l:'Taux de réponse',v:o.reply_rate||0,color:'#6366F1'},
              {l:'Taux de clic',v:o.click_rate||0,color:'#F97316'},
            ].map((m,i)=>(
              <div key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span style={{color:'var(--text-secondary)'}}>{m.l}</span>
                  <span className="font-semibold" style={{color:'var(--text-primary)'}}>{m.v}%</span>
                </div>
                <div className="w-full rounded-full h-2" style={{background:'var(--body-bg)'}}>
                  <div className="h-2 rounded-full transition-all" style={{width:`${Math.min(m.v,100)}%`,background:m.color}}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border p-6" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
        <h2 className="font-semibold mb-4" style={{color:'var(--text-primary)'}}>Métriques clés</h2>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          {[
            {l:'Leads chauds',v:o.hot_leads||0},{l:'Deals en cours',v:o.total_deals||0},
            {l:'Séquences actives',v:o.active_sequences||0},{l:'Signaux non lus',v:o.unread_signals||0},
            {l:'Taux réponse',v:`${o.reply_rate||0}%`},{l:'Taux clic',v:`${o.click_rate||0}%`},
          ].map((m,i)=>(
            <div key={i} className="text-center p-4 rounded-xl" style={{background:'var(--body-bg)'}}>
              <div className="text-2xl font-bold" style={{color:'var(--color-primary)'}}>{m.v}</div>
              <div className="text-xs mt-1" style={{color:'var(--text-muted)'}}>{m.l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
