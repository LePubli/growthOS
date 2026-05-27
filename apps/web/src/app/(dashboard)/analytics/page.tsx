'use client';
import { useState, useEffect } from 'react';
import { BarChart2, TrendingUp, Users, DollarSign, Mail, Target, Download, RefreshCw, Loader2 } from 'lucide-react';

export default function AnalyticsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');
  const API = process.env.NEXT_PUBLIC_API_URL || '';

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
      ['Leads chauds',o.hot_leads||0],
      ['Deals en cours',o.total_deals||0],
      ['Pipeline total (€)',o.pipeline_value||0],
      ['CA gagné (€)',o.won_value||0],
      ['Taux de conversion (%)',convRate],
      ['Séquences actives',o.active_sequences||0],
      ['Taux ouverture (%)',o.open_rate||0],
      ['Taux réponse (%)',o.reply_rate||0],
      ['Signaux non lus',o.unread_signals||0],
    ];
    const csv = rows.map(r=>r.join(',')).join('\n');
    const blob = new Blob([csv],{type:'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `analytics_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  if (loading) return <div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-teal-600"/></div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Analytics</h1><p className="text-sm text-gray-400">Vue d'ensemble de vos performances commerciales</p></div>
        <div className="flex gap-2">
          <div className="flex gap-1 p-1 bg-white border border-gray-200 rounded-xl">
            {['7d','30d','90d'].map(p=><button key={p} onClick={()=>setPeriod(p)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${period===p?'bg-teal-600 text-white':'text-gray-500 hover:text-gray-700'}`}>{p}</button>)}
          </div>
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-teal-300">
            <Download className="w-4 h-4"/>Exporter CSV
          </button>
        </div>
      </div>

      {/* KPIs principaux */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          {l:'Prospects total',v:o.total_prospects||0,icon:<Users className="w-5 h-5"/>,color:'text-blue-600 bg-blue-50'},
          {l:'Pipeline (€)',v:`${((o.pipeline_value||0)/1000).toFixed(0)}k`,icon:<DollarSign className="w-5 h-5"/>,color:'text-green-600 bg-green-50'},
          {l:'CA gagné (€)',v:`${((o.won_value||0)/1000).toFixed(0)}k`,icon:<TrendingUp className="w-5 h-5"/>,color:'text-teal-600 bg-teal-50'},
          {l:'Taux conversion',v:`${convRate}%`,icon:<Target className="w-5 h-5"/>,color:'text-purple-600 bg-purple-50'},
        ].map((k,i)=>(
          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${k.color}`}>{k.icon}</div>
            <div><div className="text-2xl font-bold text-gray-900">{k.v}</div><div className="text-xs text-gray-400">{k.l}</div></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5 mb-5">
        {/* Pipeline par étape */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Répartition pipeline</h2>
          {pipeline.length === 0 ? (
            <div className="text-center py-8"><BarChart2 className="w-10 h-10 text-gray-200 mx-auto mb-2"/><p className="text-sm text-gray-400">Aucun deal</p></div>
          ) : (
            <div className="space-y-3">
              {pipeline.map((s:any,i:number)=>(
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 capitalize">{s.stage}</span>
                    <div className="flex gap-3">
                      <span className="font-semibold text-gray-900">{s.count} deals</span>
                      {s.value>0&&<span className="text-gray-400">{s.value.toLocaleString()}€</span>}
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="h-2 rounded-full bg-teal-500 transition-all" style={{width:`${Math.min((s.count/(o.total_deals||1))*100,100)}%`}}/>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Signaux par type */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Signaux détectés</h2>
          {signals.length === 0 ? (
            <div className="text-center py-8"><BarChart2 className="w-10 h-10 text-gray-200 mx-auto mb-2"/><p className="text-sm text-gray-400">Aucun signal</p></div>
          ) : (
            <div className="space-y-3">
              {signals.map((s:any,i:number)=>{
                const total = signals.reduce((sum:number,x:any)=>sum+x.count,0);
                const pct = total>0?Math.round((s.count/total)*100):0;
                const colors: Record<string,string> = {funding:'bg-green-500',hiring:'bg-blue-500',intent:'bg-red-500',news:'bg-purple-500',technology:'bg-yellow-500'};
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 capitalize">{s.type}</span>
                      <div className="flex gap-2">
                        <span className="font-semibold text-gray-900">{s.count}</span>
                        <span className="text-gray-400">{pct}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className={`h-2 rounded-full ${colors[s.type]||'bg-gray-400'}`} style={{width:`${pct}%`}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Email performance */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Performance email</h2>
        <div className="grid grid-cols-4 gap-4">
          {[
            {l:'Emails envoyés',v:o.emails_sent||0,color:'text-blue-600 bg-blue-50',icon:<Mail className="w-5 h-5"/>},
            {l:'Séquences actives',v:o.active_sequences||0,color:'text-purple-600 bg-purple-50',icon:<BarChart2 className="w-5 h-5"/>},
            {l:'Taux ouverture',v:`${o.open_rate||0}%`,color:'text-teal-600 bg-teal-50',icon:<TrendingUp className="w-5 h-5"/>},
            {l:'Taux réponse',v:`${o.reply_rate||0}%`,color:'text-green-600 bg-green-50',icon:<Target className="w-5 h-5"/>},
          ].map((k,i)=>(
            <div key={i} className={`rounded-xl p-4 flex items-center gap-3 ${k.color}`}>
              {k.icon}<div><div className="text-2xl font-bold">{k.v}</div><div className="text-xs opacity-70">{k.l}</div></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
