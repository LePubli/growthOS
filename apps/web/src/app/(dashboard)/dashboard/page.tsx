'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users, Mail, TrendingUp, DollarSign, BarChart2, Zap, Activity,
  ArrowUp, ArrowDown, RefreshCw, Plus, ChevronRight, Calendar,
  Target, CheckCircle, Clock, AlertCircle, Play
} from 'lucide-react';

interface DashboardStats {
  overview: {
    total_prospects: number; hot_leads: number; warm_leads: number;
    new_leads: number; won: number; with_email: number;
    prospects_this_week: number; total_deals: number;
    pipeline_value: number; won_value: number;
    total_signals: number; unread_signals: number;
    total_sequences: number; active_sequences: number;
    emails_sent: number; open_rate: number; reply_rate: number;
  };
  pipeline_stages: Array<{ stage: string; count: number; value: number }>;
  recent_prospects: Array<{ id: string; company_name: string; full_name: string; email: string; propensity_score: number; propensity_category: string; created_at: string }>;
  signals_by_type: Array<{ type: string; count: number }>;
}

const MOCK_STATS: DashboardStats = {
  overview: { total_prospects:0, hot_leads:0, warm_leads:0, new_leads:0, won:0, with_email:0, prospects_this_week:0, total_deals:0, pipeline_value:0, won_value:0, total_signals:0, unread_signals:0, total_sequences:0, active_sequences:0, emails_sent:0, open_rate:0, reply_rate:0 },
  pipeline_stages: [], recent_prospects: [], signals_by_type: [],
};

const STAGE_LABELS: Record<string,string> = { lead:'Lead', contact:'Contacté', qualified:'Qualifié', proposal:'Proposition', negotiation:'Négociation', won:'Gagné', lost:'Perdu' };
const STAGE_COLORS: Record<string,string> = { lead:'bg-gray-400', contact:'bg-blue-400', qualified:'bg-purple-500', proposal:'bg-yellow-400', negotiation:'bg-amber-500', won:'bg-green-500', lost:'bg-red-400' };

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>(MOCK_STATS);
  const [fetching, setFetching] = useState(false);
  const [tab, setTab] = useState<'commercial'|'sourcing'|'operations'>('commercial');
  const [greeting, setGreeting] = useState('Bonjour');
  const API = process.env.NEXT_PUBLIC_API_URL || '';

  const fetchStats = async () => {
    setFetching(true);
    try {
      const token = localStorage.getItem('access_token') || '';
      const res = await fetch(`${API}/api/v1/dashboard/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.overview) setStats(data);
      }
    } catch {} finally { setFetching(false); }
  };

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir');
    fetchStats();
  }, []);

  const o = stats.overview;
  const fmt = (n: number) => n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n);
  const fmtEur = (n: number) => n >= 1000 ? `${(n/1000).toFixed(0)}k€` : `${n}€`;

  const KPIS = {
    commercial: [
      { label:'Prospects total', value:fmt(o.total_prospects), change:o.prospects_this_week, changeLabel:`+${o.prospects_this_week} cette semaine`, icon:<Users className="w-5 h-5"/>, color:'text-blue-600 bg-blue-50', href:'/prospects' },
      { label:'Leads chauds', value:fmt(o.hot_leads), icon:<Target className="w-5 h-5"/>, color:'text-red-600 bg-red-50', href:'/prospects?status=qualified' },
      { label:'Pipeline', value:fmtEur(o.pipeline_value), icon:<DollarSign className="w-5 h-5"/>, color:'text-green-600 bg-green-50', href:'/pipeline' },
      { label:'Deals gagnés', value:fmtEur(o.won_value), icon:<CheckCircle className="w-5 h-5"/>, color:'text-teal-600 bg-teal-50', href:'/pipeline' },
    ],
    sourcing: [
      { label:'Signaux détectés', value:fmt(o.total_signals), icon:<Zap className="w-5 h-5"/>, color:'text-purple-600 bg-purple-50', href:'/signals' },
      { label:'Non lus', value:fmt(o.unread_signals), icon:<AlertCircle className="w-5 h-5"/>, color:'text-amber-600 bg-amber-50', href:'/signals?unread=true' },
      { label:'Avec email', value:fmt(o.with_email), icon:<Mail className="w-5 h-5"/>, color:'text-blue-600 bg-blue-50', href:'/prospects' },
      { label:'Nouveaux', value:fmt(o.new_leads), icon:<Plus className="w-5 h-5"/>, color:'text-gray-600 bg-gray-100', href:'/prospects?status=new' },
    ],
    operations: [
      { label:'Séquences actives', value:String(o.active_sequences), icon:<Play className="w-5 h-5"/>, color:'text-purple-600 bg-purple-50', href:'/sequences' },
      { label:'Emails envoyés', value:fmt(o.emails_sent), icon:<Mail className="w-5 h-5"/>, color:'text-blue-600 bg-blue-50', href:'/sequences' },
      { label:'Taux ouverture', value:`${o.open_rate}%`, icon:<BarChart2 className="w-5 h-5"/>, color:'text-teal-600 bg-teal-50', href:'/analytics' },
      { label:'Taux réponse', value:`${o.reply_rate}%`, icon:<TrendingUp className="w-5 h-5"/>, color:'text-green-600 bg-green-50', href:'/analytics' },
    ],
  };

  return (
    <div className="min-h-screen p-6 space-y-5" style={{background:'var(--body-bg)'}}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>{greeting} 👋</h1>
          <p className="text-sm mt-0.5" style={{color:'var(--text-muted)'}}>{new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 p-1 rounded-xl" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)'}}>
            {(['commercial','sourcing','operations'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all"
                style={tab===t?{background:'var(--color-primary)',color:'#fff'}:{color:'var(--text-muted)'}}>
                {t==='commercial'?'📈 Commercial':t==='sourcing'?'🔍 Sourcing':'⚙️ Opérations'}
              </button>
            ))}
          </div>
          <button onClick={fetchStats} disabled={fetching}
            className="flex items-center gap-2 text-sm px-3 py-2 rounded-xl transition-all"
            style={{background:'var(--card-bg)',border:'1px solid var(--card-border)',color:'var(--text-secondary)'}}>
            <RefreshCw className={`w-4 h-4 ${fetching?'animate-spin':''}`}/>
          </button>
        </div>
      </div>

      {/* KPIs cliquables */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {KPIS[tab].map((kpi, i) => (
          <Link key={i} href={kpi.href}
            className="rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md block"
            style={{background:'var(--card-bg)',border:'1px solid var(--card-border)'}}>
            <div className="flex items-start justify-between mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${kpi.color}`}>{kpi.icon}</div>
              {kpi.change !== undefined && kpi.change > 0 && (
                <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-600">
                  <ArrowUp className="w-3 h-3"/>+{kpi.change}
                </span>
              )}
            </div>
            <div className="text-2xl font-bold mb-1" style={{color:'var(--text-primary)'}}>{kpi.value}</div>
            <div className="text-sm" style={{color:'var(--text-muted)'}}>{kpi.label}</div>
            {kpi.changeLabel && <div className="text-xs mt-1" style={{color:'var(--text-muted)'}}>{kpi.changeLabel}</div>}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Pipeline */}
        <div className="rounded-2xl p-6" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)'}}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold" style={{color:'var(--text-primary)'}}>Pipeline commercial</h2>
            <Link href="/pipeline" className="text-sm flex items-center gap-1" style={{color:'var(--color-primary)'}}>Voir<ChevronRight className="w-4 h-4"/></Link>
          </div>
          {stats.pipeline_stages.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign className="w-10 h-10 mx-auto mb-2" style={{color:'var(--card-border)'}}/>
              <p className="text-sm" style={{color:'var(--text-muted)'}}>Aucun deal en cours</p>
              <Link href="/pipeline" className="mt-2 inline-block text-sm font-medium px-4 py-2 rounded-xl text-white" style={{background:'var(--color-primary)'}}>
                + Créer un deal
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.pipeline_stages.map((s, i) => (
                <Link key={i} href={`/pipeline?stage=${s.stage}`} className="block">
                  <div className="flex items-center justify-between mb-1 text-sm">
                    <span style={{color:'var(--text-secondary)'}}>{STAGE_LABELS[s.stage]||s.stage}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold" style={{color:'var(--text-primary)'}}>{s.count}</span>
                      {s.value > 0 && <span className="text-xs" style={{color:'var(--text-muted)'}}>{fmtEur(s.value)}</span>}
                    </div>
                  </div>
                  <div className="w-full rounded-full h-1.5" style={{background:'var(--card-border)'}}>
                    <div className={`h-1.5 rounded-full ${STAGE_COLORS[s.stage]||'bg-gray-400'}`} style={{width:`${Math.min((s.count/(o.total_deals||1))*100,100)}%`}}/>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Prospects récents */}
        <div className="rounded-2xl p-6" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)'}}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold" style={{color:'var(--text-primary)'}}>Prospects récents</h2>
            <Link href="/prospects" className="text-sm flex items-center gap-1" style={{color:'var(--color-primary)'}}>Tous<ChevronRight className="w-4 h-4"/></Link>
          </div>
          {stats.recent_prospects.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-10 h-10 mx-auto mb-2" style={{color:'var(--card-border)'}}/>
              <p className="text-sm" style={{color:'var(--text-muted)'}}>Aucun prospect</p>
              <Link href="/prospects" className="mt-2 inline-block text-sm font-medium px-4 py-2 rounded-xl text-white" style={{background:'var(--color-primary)'}}>
                + Ajouter un prospect
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.recent_prospects.slice(0,5).map((p,i) => (
                <Link key={i} href={`/prospects/${p.id}`} className="flex items-center gap-3 p-2 rounded-xl hover:opacity-80 transition-all block" style={{background:'var(--body-bg)'}}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{background:'var(--color-primary)'}}>
                    {(p.full_name||p.company_name||'?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{color:'var(--text-primary)'}}>{p.full_name||p.company_name}</div>
                    <div className="text-xs truncate" style={{color:'var(--text-muted)'}}>{p.company_name||p.email}</div>
                  </div>
                  {p.propensity_score > 0 && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.propensity_score>=80?'bg-green-50 text-green-600':p.propensity_score>=50?'bg-amber-50 text-amber-600':'bg-gray-100 text-gray-500'}`}>
                      {p.propensity_score}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Actions rapides + Signaux */}
        <div className="space-y-4">
          <div className="rounded-2xl p-5" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)'}}>
            <h2 className="font-semibold mb-3" style={{color:'var(--text-primary)'}}>Actions rapides</h2>
            <div className="space-y-2">
              {[
                { label:'+ Nouveau prospect', href:'/prospects', icon:'👤', color:'var(--color-primary)' },
                { label:'+ Créer une séquence', href:'/sequences', icon:'📧', color:'var(--color-primary)' },
                { label:'+ Nouveau workflow', href:'/workflows', icon:'⚡', color:'var(--color-primary)' },
                { label:'Installer un plugin', href:'/plugins', icon:'🧩', color:'var(--color-primary)' },
                { label:'Voir les signaux', href:'/signals', icon:'🔔', color:o.unread_signals>0?'#EF4444':'var(--color-primary)' },
              ].map((a,i) => (
                <Link key={i} href={a.href} className="flex items-center gap-3 p-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80 block">
                  <span>{a.icon}</span>
                  <span style={{color:a.color}}>{a.label}</span>
                  {a.href==='/signals' && o.unread_signals>0 && <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full bg-red-500 text-white">{o.unread_signals}</span>}
                </Link>
              ))}
            </div>
          </div>

          {/* Santé système */}
          <div className="rounded-2xl p-5" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)'}}>
            <h2 className="font-semibold mb-3" style={{color:'var(--text-primary)'}}>Santé système</h2>
            <div className="space-y-2">
              {[{label:'API NestJS',v:'✅'},{label:'PostgreSQL',v:'✅'},{label:'Redis',v:'✅'},{label:'Plugin System',v:'✅'},{label:'Sandbox VM',v:'✅'}].map((s,i)=>(
                <div key={i} className="flex items-center justify-between text-sm">
                  <span style={{color:'var(--text-secondary)'}}>{s.label}</span>
                  <span>{s.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
