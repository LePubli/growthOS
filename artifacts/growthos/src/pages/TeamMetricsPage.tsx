import { useState } from 'react';
import { Trophy, TrendingUp, Target, Users, Mail, Phone, DollarSign, ChevronUp, ChevronDown, BarChart2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const TEAM = [
  { id: '1', name: 'Sophie Martin', avatar: 'SM', role: 'Account Executive', quota: 50000, achieved: 47200, deals: 8, calls: 34, emails: 127, prospects: 42, rank: 1, trend: '+12%' },
  { id: '2', name: 'Paul Dupont',   avatar: 'PD', role: 'Sales Manager',     quota: 80000, achieved: 71400, deals: 12, calls: 48, emails: 198, prospects: 67, rank: 2, trend: '+8%' },
  { id: '3', name: 'Alice Moreau',  avatar: 'AM', role: 'SDR',               quota: 30000, achieved: 31500, deals: 5,  calls: 62, emails: 241, prospects: 89, rank: 3, trend: '+23%' },
  { id: '4', name: 'Marc Bernard',  avatar: 'MB', role: 'Account Executive', quota: 50000, achieved: 38900, deals: 6,  calls: 27, emails: 96,  prospects: 31, rank: 4, trend: '-3%' },
  { id: '5', name: 'Lucie Petit',   avatar: 'LP', role: 'SDR',               quota: 30000, achieved: 22100, deals: 3,  calls: 41, emails: 173, prospects: 58, rank: 5, trend: '+5%' },
];

const MONTHLY = [
  { name: 'Jan', Sophie: 8200, Paul: 12400, Alice: 5100, Marc: 7800, Lucie: 3200 },
  { name: 'Fév', Sophie: 9100, Paul: 11800, Alice: 6200, Marc: 6900, Lucie: 4100 },
  { name: 'Mar', Sophie: 10400, Paul: 14200, Alice: 7800, Marc: 8200, Lucie: 5300 },
  { name: 'Avr', Sophie: 11200, Paul: 13600, Alice: 6900, Marc: 7100, Lucie: 4800 },
  { name: 'Mai', Sophie: 12300, Paul: 15400, Alice: 9100, Marc: 9200, Lucie: 5600 },
  { name: 'Jun', Sophie: 8700, Paul: 11800, Alice: 7900, Marc: 7100, Lucie: 4300 },
];

const COLORS = ['#3B82F6', '#7C3AED', '#059669', '#F59E0B', '#EF4444'];

const MEDALS = ['🥇', '🥈', '🥉', '4.', '5.'];

export default function TeamMetricsPage() {
  const [metric, setMetric] = useState<'achieved' | 'deals' | 'calls' | 'emails'>('achieved');
  const [period, setPeriod] = useState('month');

  const totalRevenue = TEAM.reduce((s, m) => s + m.achieved, 0);
  const totalQuota = TEAM.reduce((s, m) => s + m.quota, 0);
  const attainment = ((totalRevenue / totalQuota) * 100).toFixed(0);

  const sorted = [...TEAM].sort((a, b) => b[metric] - a[metric]);

  const metricLabel: Record<string, string> = {
    achieved: 'CA réalisé (€)', deals: 'Deals signés', calls: 'Appels passés', emails: 'Emails envoyés',
  };

  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: 'var(--body-bg)' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Métriques équipe</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Leaderboard et performance commerciale — {TEAM.length} commerciaux</p>
        </div>
        <div style={{ display: 'flex', gap: 6, padding: '4px', borderRadius: 12, background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
          {['week', 'month', 'quarter'].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{ padding: '6px 14px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', background: period === p ? 'var(--color-primary)' : 'transparent', color: period === p ? '#fff' : 'var(--text-muted)' }}>
              {p === 'week' ? 'Sem.' : p === 'month' ? 'Mois' : 'Trim.'}
            </button>
          ))}
        </div>
      </div>

      {/* Team KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { l: 'CA Total', v: `${(totalRevenue / 1000).toFixed(0)}k€`, icon: <DollarSign size={16} />, c: 'text-green-600 bg-green-50' },
          { l: 'Quota Atteignement', v: `${attainment}%`, icon: <Target size={16} />, c: parseInt(attainment) >= 80 ? 'text-green-600 bg-green-50' : 'text-amber-600 bg-amber-50' },
          { l: 'Total Deals', v: TEAM.reduce((s, m) => s + m.deals, 0), icon: <Trophy size={16} />, c: 'text-blue-600 bg-blue-50' },
          { l: 'Prospects Actifs', v: TEAM.reduce((s, m) => s + m.prospects, 0), icon: <Users size={16} />, c: 'text-purple-600 bg-purple-50' },
        ].map((k, i) => (
          <div key={i} className="rounded-2xl border p-4 flex items-center gap-3" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${k.c} flex-shrink-0`}>{k.icon}</div>
            <div>
              <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{k.v}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{k.l}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Leaderboard */}
        <div className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>🏆 Leaderboard</h2>
            <select value={metric} onChange={e => setMetric(e.target.value as any)}
              style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }}>
              <option value="achieved">CA réalisé</option>
              <option value="deals">Deals</option>
              <option value="calls">Appels</option>
              <option value="emails">Emails</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sorted.map((member, i) => {
              const pct = metric === 'achieved'
                ? Math.min(100, (member.achieved / member.quota) * 100)
                : Math.min(100, (member[metric] / Math.max(...TEAM.map(m => m[metric]))) * 100);
              const isFirst = i === 0;
              return (
                <div key={member.id} style={{ padding: '12px 14px', borderRadius: 12, background: isFirst ? `color-mix(in srgb, var(--color-primary) 8%, transparent)` : 'var(--body-bg)', border: `1px solid ${isFirst ? 'var(--color-primary)' : 'transparent'}`, transition: 'all 0.15s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 16, minWidth: 24, textAlign: 'center' }}>{MEDALS[i]}</span>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: COLORS[i], color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                      {member.avatar}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{member.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{member.role}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: isFirst ? 'var(--color-primary)' : 'var(--text-primary)' }}>
                        {metric === 'achieved' ? `${member.achieved.toLocaleString()}€` : member[metric]}
                      </div>
                      <div style={{ fontSize: 11, color: member.trend.startsWith('+') ? '#059669' : '#DC2626', fontWeight: 600 }}>
                        {member.trend}
                      </div>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div style={{ height: 6, borderRadius: 9999, background: 'var(--card-border)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: COLORS[i], borderRadius: 9999, transition: 'width 0.5s ease' }} />
                  </div>
                  {metric === 'achieved' && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
                      {pct.toFixed(0)}% du quota ({member.quota.toLocaleString()}€)
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Revenue trend chart */}
        <div className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>CA par commercial (6 mois)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={MONTHLY} barSize={10}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, fontSize: 12 }} formatter={(v: any) => [`${v.toLocaleString()}€`]} />
              {TEAM.map((m, i) => (
                <Bar key={m.id} dataKey={m.name.split(' ')[0]} fill={COLORS[i]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Activity breakdown */}
      <div className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
        <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Activité détaillée</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--body-bg)' }}>
                {['Commercial', 'Rôle', 'CA réalisé', 'Quota', 'Atteint', 'Deals', 'Appels', 'Emails', 'Prospects'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--card-border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TEAM.map((m, i) => {
                const att = Math.round((m.achieved / m.quota) * 100);
                return (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: COLORS[i], color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{m.avatar}</div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{m.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{m.role}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>{m.achieved.toLocaleString()}€</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{m.quota.toLocaleString()}€</td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ height: 6, width: 60, borderRadius: 9999, background: 'var(--card-border)', overflow: 'hidden', flexShrink: 0 }}>
                          <div style={{ height: '100%', width: `${Math.min(100, att)}%`, background: att >= 100 ? '#059669' : att >= 75 ? '#F59E0B' : '#EF4444' }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: att >= 100 ? '#059669' : att >= 75 ? '#D97706' : '#DC2626' }}>{att}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center' }}>{m.deals}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>{m.calls}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>{m.emails}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>{m.prospects}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
