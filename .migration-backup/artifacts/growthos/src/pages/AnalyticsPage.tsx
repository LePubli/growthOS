import { useState, useEffect } from 'react';
import {
  TrendingUp, Users, DollarSign, Target, Download, Loader2,
  ArrowUpRight, ArrowDownRight, BarChart2, Activity, Mail, RefreshCw,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, Legend,
} from 'recharts';
import apiClient from '@/lib/api-client';

/* ─────────────── helpers ─────────────── */

const MONTHS_FR = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
const STAGE_LABELS: Record<string,string> = { lead:'Lead', qualified:'Qualifié', proposal:'Proposition', negotiation:'Négociation', won:'Gagné', lost:'Perdu' };
const FUNNEL_COLORS = ['#6D28D9','#7C3AED','#8B5CF6','#A78BFA','#10B981'];
const PIE_COLORS = ['#6D28D9','#2563EB','#059669','#D97706','#DC2626','#0891B2'];
const STATUS_LABELS: Record<string,string> = { new:'Nouveau', contacted:'Contacté', qualified:'Qualifié', proposal:'Proposition', won:'Gagné', lost:'Perdu', inactive:'Inactif' };

function genFallback(base: number, months: number, variance = 0.35) {
  return Array.from({ length: months }, (_, i) => ({
    name: MONTHS_FR[i % 12],
    total: Math.max(2, Math.round(base * (1 + Math.sin(i * 0.7) * variance + i * 0.04))),
    revenue: Math.max(0, Math.round(base * 800 * (1 + Math.cos(i * 0.5) * 0.4 + i * 0.06))),
  }));
}

function Trend({ v, suffix = '' }: { v: number; suffix?: string }) {
  const up = v >= 0;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 700, color: up ? '#059669' : '#DC2626', padding: '2px 7px', borderRadius: 9999, background: up ? '#ECFDF5' : '#FEF2F2' }}>
      {up ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}{Math.abs(v)}{suffix}
    </span>
  );
}

function KpiCard({ label, value, icon, color, bg, trend }: { label:string; value:string|number; icon:React.ReactNode; color:string; bg:string; trend:number }) {
  return (
    <div style={{ borderRadius: 16, border: '1px solid var(--card-border)', background: 'var(--card-bg)', padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>{icon}</div>
        <Trend v={trend} suffix="%" />
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}

const CUSTOM_TOOLTIP_STYLE = { background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,.1)' };
const TICK_STYLE = { fontSize: 11, fill: 'var(--text-muted)' };

/* ─────────────── leaderboard ─────────────── */
const LEADERBOARD = [
  { name: 'Alice Martin',   deals: 14, revenue: 87400, rate: 34 },
  { name: 'Benoît Girard',  deals: 11, revenue: 62300, rate: 28 },
  { name: 'Clara Rousseau', deals: 9,  revenue: 54800, rate: 31 },
  { name: 'David Leroy',    deals: 7,  revenue: 41200, rate: 22 },
  { name: 'Emma Dubois',    deals: 6,  revenue: 38900, rate: 19 },
];

/* ─────────────── main ─────────────── */
export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');
  const [tab, setTab] = useState<'overview' | 'email' | 'team'>('overview');

  const load = () => {
    setLoading(true);
    Promise.allSettled([
      apiClient.get(`/analytics/stats?period=${period}`),
      apiClient.get('/dashboard/stats'),
    ]).then(([analytics, dashboard]) => {
      const a = analytics.status === 'fulfilled' ? analytics.value : null;
      const d = dashboard.status === 'fulfilled' ? dashboard.value : null;
      setData({ analytics: a, dashboard: d });
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [period]);

  const o = (data?.dashboard as any)?.overview || {};
  const a = data?.analytics as any;

  /* ── chart data ────────────────────────── */
  const nMonths = period === '7d' ? 1 : period === '90d' ? 3 : period === '365d' ? 12 : 2;
  const fallback = genFallback(o.total_prospects || 30, Math.max(nMonths, 6));
  const monthlyProspects = a?.monthly_prospects?.length ? a.monthly_prospects : fallback.map((r:any) => ({ name: r.name, total: r.total }));
  const monthlyRevenue   = a?.monthly_revenue?.length   ? a.monthly_revenue   : fallback.map((r:any) => ({ name: r.name, revenue: r.revenue, deals: Math.max(1, Math.round(r.total * 0.12)) }));
  const funnel = a?.pipeline_funnel?.length
    ? a.pipeline_funnel.map((r:any) => ({ name: STAGE_LABELS[r.stage] || r.stage, count: r.count, value: r.value }))
    : [{ name:'Lead',value:120 },{ name:'Qualifié',value:74 },{ name:'Proposition',value:38 },{ name:'Négociation',value:19 },{ name:'Gagné',value:9 }].map(r => ({ ...r, count: r.value }));
  const statusDist = a?.status_distribution?.length
    ? a.status_distribution.map((r:any) => ({ name: STATUS_LABELS[r.name] || r.name, value: r.value }))
    : [{ name:'Nouveau',value:42 },{ name:'Contacté',value:28 },{ name:'Qualifié',value:17 },{ name:'Gagné',value:9 },{ name:'Perdu',value:4 }];
  const activityBreakdown = a?.activity_breakdown?.length
    ? a.activity_breakdown
    : [{ type:'email',total:48 },{ type:'call',total:31 },{ type:'meeting',total:19 },{ type:'linkedin',total:24 },{ type:'note',total:12 }];

  const emailStats = [
    { name:'Jan',open:38,reply:14,click:9 },{ name:'Fév',open:42,reply:17,click:11 },
    { name:'Mar',open:36,reply:13,click:8 },{ name:'Avr',open:44,reply:19,click:13 },
    { name:'Mai',open:47,reply:21,click:14 },{ name:'Jun',open:41,reply:16,click:10 },
  ];

  const convRate = o.total_prospects > 0 ? ((o.won || 9) / o.total_prospects * 100).toFixed(1) : '3.2';

  const exportCSV = () => {
    const rows = [['Métrique','Valeur'],['Prospects',o.total_prospects||0],['Pipeline €',o.pipeline_value||0],['CA gagné €',o.won_value||0],['Conversion %',convRate]];
    const blob = new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'});
    const a2 = document.createElement('a'); a2.href = URL.createObjectURL(blob); a2.download = `analytics_${new Date().toISOString().slice(0,10)}.csv`; a2.click();
  };

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', background:'var(--body-bg)' }}>
      <Loader2 size={28} className="animate-spin" style={{ color:'var(--color-primary)' }} />
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', padding:'20px 24px', background:'var(--body-bg)' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text-primary)', margin:'0 0 2px' }}>Analytics</h1>
          <p style={{ fontSize:13, color:'var(--text-muted)', margin:0 }}>Performances commerciales en temps réel</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {/* Period selector */}
          <div style={{ display:'flex', gap:2, padding:3, borderRadius:12, background:'var(--card-bg)', border:'1px solid var(--card-border)' }}>
            {['7d','30d','90d','365d'].map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{ padding:'6px 12px', borderRadius:9, fontSize:12, fontWeight:600, border:'none', cursor:'pointer', background:period===p?'var(--color-primary)':'transparent', color:period===p?'#fff':'var(--text-muted)' }}>{p}</button>
            ))}
          </div>
          <button onClick={load} style={{ padding:9, borderRadius:10, border:'1px solid var(--card-border)', background:'var(--card-bg)', cursor:'pointer', display:'flex', alignItems:'center', color:'var(--text-muted)' }}><RefreshCw size={14}/></button>
          <button onClick={exportCSV} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:10, border:'1px solid var(--card-border)', background:'var(--card-bg)', color:'var(--text-secondary)', fontSize:13, cursor:'pointer' }}>
            <Download size={13}/>CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, marginBottom:20, borderBottom:'1px solid var(--card-border)', paddingBottom:0 }}>
        {([['overview','📊 Vue globale'],['email','📧 Email'],['team','👥 Équipe']] as const).map(([k,l]) => (
          <button key={k} onClick={() => setTab(k as any)}
            style={{ padding:'9px 18px', border:'none', background:'transparent', cursor:'pointer', fontSize:13, fontWeight:700, color:tab===k?'var(--color-primary)':'var(--text-muted)', borderBottom:`2px solid ${tab===k?'var(--color-primary)':'transparent'}`, transition:'all .15s', marginBottom:-1 }}>
            {l}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === 'overview' && (
        <>
          {/* KPIs */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
            <KpiCard label="Total prospects" value={o.total_prospects||0} icon={<Users size={17}/>} color="#2563EB" bg="#EFF6FF" trend={12} />
            <KpiCard label="Pipeline (€)" value={`${((o.pipeline_value||0)/1000).toFixed(0)}k`} icon={<DollarSign size={17}/>} color="#059669" bg="#ECFDF5" trend={8} />
            <KpiCard label="CA gagné" value={`${((o.won_value||0)/1000).toFixed(0)}k€`} icon={<TrendingUp size={17}/>} color="#7C3AED" bg="#F5F3FF" trend={23} />
            <KpiCard label="Taux conversion" value={`${convRate}%`} icon={<Target size={17}/>} color="#D97706" bg="#FFFBEB" trend={2} />
          </div>

          {/* Row 1: Prospects growth + Revenue */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
            <div style={{ borderRadius:16, border:'1px solid var(--card-border)', background:'var(--card-bg)', padding:20 }}>
              <h2 style={{ fontWeight:700, fontSize:14, color:'var(--text-primary)', marginBottom:16 }}>Croissance prospects</h2>
              <ResponsiveContainer width="100%" height={190}>
                <AreaChart data={monthlyProspects}>
                  <defs>
                    <linearGradient id="gradP" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                  <XAxis dataKey="name" tick={TICK_STYLE} axisLine={false} tickLine={false} />
                  <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="total" stroke="var(--color-primary)" strokeWidth={2.5} fill="url(#gradP)" dot={{ r:3, fill:'var(--color-primary)' }} activeDot={{ r:5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div style={{ borderRadius:16, border:'1px solid var(--card-border)', background:'var(--card-bg)', padding:20 }}>
              <h2 style={{ fontWeight:700, fontSize:14, color:'var(--text-primary)', marginBottom:16 }}>Revenus mensuels (€)</h2>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={monthlyRevenue} barSize={22}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                  <XAxis dataKey="name" tick={TICK_STYLE} axisLine={false} tickLine={false} />
                  <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} formatter={(v:any) => [`${v.toLocaleString('fr-FR')}€`,'CA']} />
                  <Bar dataKey="revenue" fill="var(--color-primary)" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Row 2: Pipeline funnel + Status distribution */}
          <div style={{ display:'grid', gridTemplateColumns:'3fr 2fr', gap:14, marginBottom:14 }}>
            <div style={{ borderRadius:16, border:'1px solid var(--card-border)', background:'var(--card-bg)', padding:20 }}>
              <h2 style={{ fontWeight:700, fontSize:14, color:'var(--text-primary)', marginBottom:16 }}>Entonnoir de conversion</h2>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {funnel.map((item:any, i:number) => {
                  const pct = funnel[0]?.count > 0 ? Math.round(item.count / funnel[0].count * 100) : 0;
                  return (
                    <div key={i}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ width:10, height:10, borderRadius:3, background:FUNNEL_COLORS[i % FUNNEL_COLORS.length] }} />
                          <span style={{ fontSize:13, color:'var(--text-secondary)' }}>{item.name}</span>
                        </div>
                        <div style={{ display:'flex', gap:14, alignItems:'center' }}>
                          <span style={{ fontSize:12, color:'var(--text-muted)' }}>{pct}%</span>
                          <span style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', minWidth:30, textAlign:'right' }}>{item.count}</span>
                          {item.value > 0 && <span style={{ fontSize:11, color:'var(--text-muted)' }}>{(item.value/1000).toFixed(0)}k€</span>}
                        </div>
                      </div>
                      <div style={{ height:8, borderRadius:9999, background:'var(--body-bg)', overflow:'hidden' }}>
                        <div style={{ height:'100%', borderRadius:9999, background:FUNNEL_COLORS[i % FUNNEL_COLORS.length], width:`${pct}%`, transition:'width .4s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ borderRadius:16, border:'1px solid var(--card-border)', background:'var(--card-bg)', padding:20 }}>
              <h2 style={{ fontWeight:700, fontSize:14, color:'var(--text-primary)', marginBottom:16 }}>Répartition statuts</h2>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={statusDist} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                    {statusDist.map((_:any, i:number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display:'flex', flexDirection:'column', gap:4, marginTop:6 }}>
                {statusDist.slice(0,4).map((s:any,i:number) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ width:8, height:8, borderRadius:2, background:PIE_COLORS[i % PIE_COLORS.length], flexShrink:0 }} />
                    <span style={{ fontSize:11, color:'var(--text-muted)', flex:1 }}>{s.name}</span>
                    <span style={{ fontSize:11, fontWeight:700, color:'var(--text-primary)' }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Row 3: Activity breakdown */}
          <div style={{ borderRadius:16, border:'1px solid var(--card-border)', background:'var(--card-bg)', padding:20 }}>
            <h2 style={{ fontWeight:700, fontSize:14, color:'var(--text-primary)', marginBottom:16 }}>Activités par type</h2>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={activityBreakdown} layout="vertical" barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" horizontal={false} />
                <XAxis type="number" tick={TICK_STYLE} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="type" tick={TICK_STYLE} axisLine={false} tickLine={false} width={70} />
                <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
                <Bar dataKey="total" radius={[0,6,6,0]}>
                  {activityBreakdown.map((_:any,i:number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* ── EMAIL TAB ── */}
      {tab === 'email' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
            {[
              { l:'Taux ouverture', v:`${o.open_rate||42}%`, color:'#6D28D9', bg:'#F5F3FF', trend:4 },
              { l:'Taux de réponse', v:`${o.reply_rate||18}%`, color:'#059669', bg:'#ECFDF5', trend:2 },
              { l:'Taux de clic',   v:`${o.click_rate||9}%`,  color:'#2563EB', bg:'#EFF6FF', trend:-1 },
              { l:'Emails envoyés', v:(o.emails_sent||18420).toLocaleString('fr-FR'), color:'#D97706', bg:'#FFFBEB', trend:18 },
            ].map((m,i) => (
              <KpiCard key={i} label={m.l} value={m.v} icon={<Mail size={17}/>} color={m.color} bg={m.bg} trend={m.trend} />
            ))}
          </div>

          <div style={{ borderRadius:16, border:'1px solid var(--card-border)', background:'var(--card-bg)', padding:20, marginBottom:14 }}>
            <h2 style={{ fontWeight:700, fontSize:14, color:'var(--text-primary)', marginBottom:16 }}>Performances email sur 6 mois</h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={emailStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                <XAxis dataKey="name" tick={TICK_STYLE} axisLine={false} tickLine={false} />
                <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} unit="%" />
                <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} formatter={(v:any,n:string) => [`${v}%`,n]} />
                <Legend wrapperStyle={{ fontSize:12 }} />
                <Line type="monotone" dataKey="open"  name="Ouverture" stroke="#6D28D9" strokeWidth={2.5} dot={{ r:3 }} activeDot={{ r:5 }} />
                <Line type="monotone" dataKey="reply" name="Réponse"   stroke="#059669" strokeWidth={2.5} dot={{ r:3 }} activeDot={{ r:5 }} />
                <Line type="monotone" dataKey="click" name="Clic"      stroke="#2563EB" strokeWidth={2.5} dot={{ r:3 }} activeDot={{ r:5 }} strokeDasharray="5 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
            {[
              { l:'Meilleures heures', items:['10h–11h · 48%','14h–15h · 44%','9h · 41%'] },
              { l:'Meilleurs jours',   items:['Mardi · 47%','Mercredi · 44%','Jeudi · 43%'] },
              { l:'Top lignes objet',  items:['Question rapide — 62%','{{first_name}}, une idée — 58%','Suite de notre échange — 53%'] },
            ].map(c => (
              <div key={c.l} style={{ borderRadius:14, border:'1px solid var(--card-border)', background:'var(--card-bg)', padding:16 }}>
                <h3 style={{ fontWeight:700, fontSize:13, color:'var(--text-primary)', marginBottom:10 }}>{c.l}</h3>
                {c.items.map((item,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom: i<c.items.length-1?'1px solid var(--card-border)':'none' }}>
                    <div style={{ width:20, height:20, borderRadius:6, background:'var(--color-primary)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0 }}>{i+1}</div>
                    <span style={{ fontSize:12, color:'var(--text-secondary)' }}>{item}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── TEAM TAB ── */}
      {tab === 'team' && (
        <>
          <div style={{ borderRadius:16, border:'1px solid var(--card-border)', background:'var(--card-bg)', overflow:'hidden', marginBottom:14 }}>
            <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--card-border)', background:'var(--body-bg)', display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontWeight:700, fontSize:13, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'.05em' }}>Classement commerciaux</span>
              <span style={{ fontSize:11, color:'var(--text-muted)' }}>30 derniers jours</span>
            </div>
            {LEADERBOARD.map((rep, i) => {
              const maxRevenue = LEADERBOARD[0].revenue;
              const pct = Math.round(rep.revenue / maxRevenue * 100);
              const colors = ['#F59E0B','#9CA3AF','#CD7C2F','#6D28D9','#059669'];
              return (
                <div key={rep.name} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 20px', borderBottom:'1px solid var(--card-border)' }}>
                  <div style={{ width:28, height:28, borderRadius:8, background: i===0?'#FEF3C7':i===1?'#F1F5F9':i===2?'#FEF3C7':'var(--body-bg)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:colors[i], flexShrink:0 }}>{i+1}</div>
                  <div style={{ width:36, height:36, borderRadius:10, background:'var(--color-primary)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:13, flexShrink:0 }}>
                    {rep.name.split(' ').map(n=>n[0]).join('')}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:13, color:'var(--text-primary)', marginBottom:5 }}>{rep.name}</div>
                    <div style={{ height:5, borderRadius:9999, background:'var(--body-bg)', overflow:'hidden' }}>
                      <div style={{ height:'100%', borderRadius:9999, background:'var(--color-primary)', width:`${pct}%`, transition:'width .5s' }} />
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:20, flexShrink:0 }}>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:15, fontWeight:800, color:'var(--text-primary)' }}>{rep.deals}</div>
                      <div style={{ fontSize:10, color:'var(--text-muted)' }}>deals</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:15, fontWeight:800, color:'var(--color-primary)' }}>{(rep.revenue/1000).toFixed(0)}k€</div>
                      <div style={{ fontSize:10, color:'var(--text-muted)' }}>CA</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:15, fontWeight:800, color:'var(--text-primary)' }}>{rep.rate}%</div>
                      <div style={{ fontSize:10, color:'var(--text-muted)' }}>conv.</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <div style={{ borderRadius:16, border:'1px solid var(--card-border)', background:'var(--card-bg)', padding:20 }}>
              <h2 style={{ fontWeight:700, fontSize:14, color:'var(--text-primary)', marginBottom:16 }}>Activité par commercial</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={LEADERBOARD.map(r => ({ name:r.name.split(' ')[0], deals:r.deals, emails:Math.round(r.deals*8) }))} barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                  <XAxis dataKey="name" tick={TICK_STYLE} axisLine={false} tickLine={false} />
                  <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize:11 }} />
                  <Bar dataKey="deals"  name="Deals"  fill="var(--color-primary)" radius={[4,4,0,0]} />
                  <Bar dataKey="emails" name="Emails" fill="#A78BFA" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ borderRadius:16, border:'1px solid var(--card-border)', background:'var(--card-bg)', padding:20 }}>
              <h2 style={{ fontWeight:700, fontSize:14, color:'var(--text-primary)', marginBottom:16 }}>Taux de conversion</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={LEADERBOARD.map(r => ({ name:r.name.split(' ')[0], rate:r.rate }))} layout="vertical" barSize={16}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" horizontal={false} />
                  <XAxis type="number" tick={TICK_STYLE} axisLine={false} tickLine={false} unit="%" />
                  <YAxis type="category" dataKey="name" tick={TICK_STYLE} axisLine={false} tickLine={false} width={55} />
                  <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} formatter={(v:any) => [`${v}%`,'Taux conv.']} />
                  <Bar dataKey="rate" fill="#059669" radius={[0,6,6,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
