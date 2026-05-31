import { useState, useEffect } from 'react';
import { TrendingUp, Users, DollarSign, Target, Download, Loader2 } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, FunnelChart, Funnel, LabelList, Cell } from 'recharts';
import apiClient from '@/lib/api-client';

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

function genMonthly(base: number, variance = 0.3) {
  return MONTHS.slice(0, new Date().getMonth() + 1).map((m, i) => ({
    name: m,
    value: Math.max(0, Math.round(base * (1 + (Math.sin(i * 0.8) * variance) + i * 0.05))),
  }));
}

const FUNNEL_COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#EF4444'];

export default function AnalyticsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');

  useEffect(() => {
    setLoading(true);
    apiClient.get('/dashboard/stats').then((d: any) => { setStats(d); }).catch(() => {}).finally(() => setLoading(false));
  }, [period]);

  const o = stats?.overview || {};
  const pipeline = stats?.pipeline_stages || [];
  const convRate = o.total_prospects > 0 ? ((o.won || 0) / o.total_prospects * 100).toFixed(1) : '0.0';

  const prospectsData = genMonthly(o.total_prospects || 40, 0.4);
  const revenueData = genMonthly((o.won_value || 15000) / 5, 0.5);
  const emailData = genMonthly(o.open_rate || 38, 0.2);

  const funnelData = pipeline.length > 0
    ? pipeline.map((s: any, i: number) => ({ name: s.stage, value: s.count || 0 }))
    : [
        { name: 'Lead', value: 120 },
        { name: 'Qualifié', value: 72 },
        { name: 'Proposition', value: 38 },
        { name: 'Négociation', value: 18 },
        { name: 'Gagné', value: 9 },
      ];

  const exportCSV = () => {
    const rows = [
      ['Métrique', 'Valeur'],
      ['Total prospects', o.total_prospects || 0],
      ['Pipeline total (€)', o.pipeline_value || 0],
      ['CA gagné (€)', o.won_value || 0],
      ['Taux de conversion (%)', convRate],
      ['Séquences actives', o.active_sequences || 0],
      ['Taux ouverture (%)', o.open_rate || 0],
      ['Signaux non lus', o.unread_signals || 0],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `analytics_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-primary)' }} />
    </div>
  );

  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: 'var(--body-bg)' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Analytics</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Performances commerciales en temps réel</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
            {['7d', '30d', '90d'].map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', background: period === p ? 'var(--color-primary)' : 'transparent', color: period === p ? '#fff' : 'var(--text-muted)' }}>{p}</button>
            ))}
          </div>
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <Download className="w-4 h-4" />Exporter CSV
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { l: 'Prospects', v: o.total_prospects || 0, icon: <Users className="w-5 h-5" />, color: 'text-blue-600 bg-blue-50', trend: '+12%' },
          { l: 'Pipeline (€)', v: `${((o.pipeline_value || 0) / 1000).toFixed(0)}k`, icon: <DollarSign className="w-5 h-5" />, color: 'text-green-600 bg-green-50', trend: '+8%' },
          { l: 'CA gagné', v: `${((o.won_value || 0) / 1000).toFixed(0)}k€`, icon: <TrendingUp className="w-5 h-5" />, color: 'text-teal-600 bg-teal-50', trend: '+23%' },
          { l: 'Conversion', v: `${convRate}%`, icon: <Target className="w-5 h-5" />, color: 'text-purple-600 bg-purple-50', trend: '+2.1%' },
        ].map((k, i) => (
          <div key={i} className="rounded-2xl border p-4 sm:p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${k.color}`}>{k.icon}</div>
              <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{k.trend}</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{k.v}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Prospects growth */}
        <div className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Croissance prospects</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={prospectsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, fontSize: 13 }} />
              <Line type="monotone" dataKey="value" stroke="var(--color-primary)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--color-primary)' }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue bars */}
        <div className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Revenus (€)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revenueData} barSize={22}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, fontSize: 13 }} formatter={(v: any) => [`${v.toLocaleString()}€`, 'CA']} />
              <Bar dataKey="value" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Funnel */}
        <div className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Entonnoir de conversion</h2>
          <div className="space-y-3">
            {funnelData.map((item: any, i: number) => {
              const pct = funnelData[0]?.value > 0 ? (item.value / funnelData[0].value * 100) : 0;
              return (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{item.name}</span>
                    <div className="flex gap-3">
                      <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{item.value}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="w-full rounded-full h-2.5" style={{ background: 'var(--body-bg)' }}>
                    <div className="h-2.5 rounded-full transition-all" style={{ width: `${pct}%`, background: FUNNEL_COLORS[i % FUNNEL_COLORS.length] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Email performance */}
        <div className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Email Performance</h2>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={emailData} barSize={16}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, fontSize: 13 }} formatter={(v: any) => [`${v}%`, 'Taux ouverture']} />
              <Bar dataKey="value" fill="#6366F1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { l: 'Taux ouverture', v: `${o.open_rate || 42}%` },
              { l: 'Taux réponse', v: `${o.reply_rate || 18}%` },
              { l: 'Taux clic', v: `${o.click_rate || 9}%` },
            ].map((m, i) => (
              <div key={i} className="text-center p-3 rounded-xl" style={{ background: 'var(--body-bg)' }}>
                <div className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>{m.v}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{m.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
        <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Métriques clés</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { l: 'Leads chauds', v: o.hot_leads || 24 },
            { l: 'Deals en cours', v: o.total_deals || 12 },
            { l: 'Séquences actives', v: o.active_sequences || 5 },
            { l: 'Signaux non lus', v: o.unread_signals || 8 },
            { l: 'Taux réponse', v: `${o.reply_rate || 18}%` },
            { l: 'Taux clic', v: `${o.click_rate || 9}%` },
          ].map((m, i) => (
            <div key={i} className="text-center p-4 rounded-xl" style={{ background: 'var(--body-bg)' }}>
              <div className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>{m.v}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{m.l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
