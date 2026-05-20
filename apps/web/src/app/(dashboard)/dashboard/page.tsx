'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Building2, TrendingUp, Mail, Zap, Users, Target,
  RefreshCw, ArrowUpRight, Search, BarChart2, Activity,
  GitBranch, CheckCircle2,
} from 'lucide-react';

const ODOO_COLORS = ['#017E84', '#714B67', '#28A745', '#F0AD4E', '#DC3545', '#17A2B8', '#FD7E14'];

const TOOLTIP_STYLE = {
  background: '#fff',
  border: '1px solid #DEE2E6',
  borderRadius: 8,
  padding: '10px 14px',
  boxShadow: '0 2px 8px rgba(0,0,0,.1)',
  fontSize: 13,
};

type DashView = 'commercial' | 'sourcing' | 'ops';

export default function DashboardPage() {
  const [view, setView] = useState<DashView>('commercial');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => apiClient.get<any>('/dashboard/stats'),
    refetchInterval: 60_000,
  });

  const stats = data?.overview || {};
  const stages = data?.pipeline_stages || [];
  const topProspects = data?.recent_prospects || [];
  const signalTypes = data?.signals_by_type || [];
  const sourcingJobs = data?.sourcing_jobs || [];

  const VIEWS = [
    { id: 'commercial' as DashView, label: 'Commercial', icon: <TrendingUp size={13} /> },
    { id: 'sourcing' as DashView, label: 'Sourcing', icon: <Search size={13} /> },
    { id: 'ops' as DashView, label: 'Opérations', icon: <Activity size={13} /> },
  ];

  const KPI_CARDS = [
    { icon: <Building2 size={20} />, cls: 'o-stat-icon-primary', value: (stats.total_prospects || 0).toLocaleString('fr-FR'), label: 'Prospects total', trend: stats.prospects_this_week > 0 ? `+${stats.prospects_this_week} cette semaine` : undefined, up: true },
    { icon: <Zap size={20} />, cls: 'o-stat-icon-danger', value: stats.hot_leads || 0, label: 'Leads HOT 🔥', trend: stats.total_prospects > 0 ? `${Math.round((stats.hot_leads || 0) / (stats.total_prospects || 1) * 100)}% du total` : undefined, up: true },
    { icon: <Mail size={20} />, cls: 'o-stat-icon-success', value: `${stats.email_coverage || 0}%`, label: 'Couverture email', trend: `${(stats.with_email || 0).toLocaleString('fr-FR')} emails trouvés`, up: true },
    { icon: <Target size={20} />, cls: 'o-stat-icon-warning', value: stats.unread_signals || 0, label: 'Signaux non lus', trend: `${stats.total_signals || 0} total`, up: false },
    { icon: <Mail size={20} />, cls: 'o-stat-icon-brand', value: stats.emails_sent || 0, label: 'Emails envoyés', trend: stats.open_rate > 0 ? `${stats.open_rate}% ouvertures` : undefined, up: true },
    { icon: <Users size={20} />, cls: 'o-stat-icon-info', value: stats.active_sequences || 0, label: 'Séquences actives', trend: `${stats.reply_rate || 0}% de réponses`, up: true },
  ];

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px', background: 'var(--bg-app)', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Tableau de bord</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {/* View switcher style Odoo */}
          <div style={{ display: 'flex', background: '#fff', border: '1px solid var(--border-color)', borderRadius: 6, overflow: 'hidden' }}>
            {VIEWS.map(v => (
              <button key={v.id} onClick={() => setView(v.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', border: 'none', fontSize: 13, cursor: 'pointer', fontWeight: view === v.id ? 600 : 400, background: view === v.id ? 'var(--color-primary)' : 'transparent', color: view === v.id ? '#fff' : 'var(--text-secondary)', transition: 'all .15s' }}>
                {v.icon} {v.label}
              </button>
            ))}
          </div>
          <button onClick={() => refetch()} disabled={isFetching} className="o-btn o-btn-secondary o-btn-sm">
            <RefreshCw size={13} style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} />
            Actualiser
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="o-skeleton" style={{ height: 88, borderRadius: 8 }} />)
          : KPI_CARDS.map((kpi, i) => (
            <div key={i} className="o-stat-card">
              <div className={`o-stat-icon ${kpi.cls}`}>{kpi.icon}</div>
              <div>
                <div className="o-stat-value">{kpi.value}</div>
                <div className="o-stat-label">{kpi.label}</div>
                {kpi.trend && (
                  <div className={`o-stat-trend ${kpi.up ? 'o-stat-trend-up' : ''}`}>
                    {kpi.up && <ArrowUpRight size={11} style={{ verticalAlign: 'middle' }} />} {kpi.trend}
                  </div>
                )}
              </div>
            </div>
          ))
        }
      </div>

      {/* ── Vue Commerciale ── */}
      {view === 'commercial' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            {/* Pipeline funnel */}
            <div className="o-card" style={{ padding: '20px' }}>
              <div className="o-card-header">
                <div>
                  <div className="o-card-title">Pipeline commercial</div>
                  <div className="o-card-subtitle">Prospects par étape</div>
                </div>
                <a href="/pipeline" style={{ fontSize: 12, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  Voir <GitBranch size={12} />
                </a>
              </div>
              {isLoading ? <div className="o-skeleton" style={{ height: 200, borderRadius: 6 }} /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stages.filter((s: any) => !s.is_lost)} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6C757D' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#6C757D' }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="count" name="Prospects" radius={[4, 4, 0, 0]}>
                      {stages.map((s: any, i: number) => (
                        <Cell key={i} fill={s.color || ODOO_COLORS[i % ODOO_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Distribution scores */}
            <div className="o-card">
              <div className="o-card-header">
                <div className="o-card-title">Scores</div>
              </div>
              {isLoading ? <div className="o-skeleton" style={{ height: 200, borderRadius: 6 }} /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: '🔥 HOT', value: stats.hot_leads || 0 },
                        { name: '🌡 WARM', value: stats.warm_leads || 0 },
                        { name: '❄️ COLD', value: Math.max(0, (stats.total_prospects || 0) - (stats.hot_leads || 0) - (stats.warm_leads || 0)) },
                      ]}
                      cx="50%" cy="50%" innerRadius={50} outerRadius={75}
                      dataKey="value" paddingAngle={3}
                    >
                      <Cell fill="#DC3545" />
                      <Cell fill="#F0AD4E" />
                      <Cell fill="#017E84" />
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Top prospects */}
            <div className="o-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="o-card-title">🏆 Top Prospects</div>
                <a href="/prospects" style={{ fontSize: 12, color: 'var(--color-primary)' }}>Voir tous →</a>
              </div>
              <table className="o-table">
                <thead>
                  <tr>
                    <th>Entreprise</th>
                    <th>Ville</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={3}><div className="o-skeleton" style={{ height: 14, borderRadius: 4 }} /></td>
                      </tr>
                    ))
                    : topProspects.slice(0, 8).map((p: any) => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 500, color: 'var(--text-primary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.company_name}
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{p.city || '—'}</td>
                        <td>
                          <span className={`o-badge o-badge-${p.propensity_category === 'HOT' ? 'danger' : p.propensity_category === 'WARM' ? 'warning' : 'primary'}`}>
                            {Math.round(p.propensity_score || 0)}
                          </span>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>

            {/* Signaux */}
            <div className="o-card">
              <div className="o-card-header">
                <div className="o-card-title">⚡ Signaux (30j)</div>
                <a href="/signals" style={{ fontSize: 12, color: 'var(--color-primary)' }}>Voir tous →</a>
              </div>
              {isLoading ? <div className="o-skeleton" style={{ height: 200, borderRadius: 6 }} /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={signalTypes} layout="vertical" margin={{ left: 100, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#6C757D' }} />
                    <YAxis dataKey="type" type="category" tick={{ fontSize: 10, fill: '#6C757D' }} width={100} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="count" fill="#017E84" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Vue Sourcing ── */}
      {view === 'sourcing' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { label: 'Email Coverage', value: `${stats.email_coverage || 0}%`, sub: `${(stats.with_email || 0).toLocaleString('fr-FR')} / ${(stats.total_prospects || 0).toLocaleString('fr-FR')}`, color: '#28A745' },
              { label: 'Phone Coverage', value: `${stats.total_prospects > 0 ? Math.round((stats.with_phone || 0) / stats.total_prospects * 100) : 0}%`, sub: `${(stats.with_phone || 0).toLocaleString('fr-FR')} avec téléphone`, color: '#017E84' },
              { label: 'Sans email', value: ((stats.total_prospects || 0) - (stats.with_email || 0)).toLocaleString('fr-FR'), sub: 'Prêts pour enrichissement', color: '#F0AD4E' },
            ].map((m, i) => (
              <div key={i} className="o-card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: m.color, marginBottom: 4 }}>{m.value}</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Jobs récents */}
            <div className="o-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between' }}>
                <div className="o-card-title">🔍 Jobs de scraping récents</div>
                <a href="/sourcing" style={{ fontSize: 12, color: 'var(--color-primary)' }}>Nouveau job →</a>
              </div>
              {sourcingJobs.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  Aucun job de scraping
                </div>
              ) : (
                <table className="o-table">
                  <thead>
                    <tr><th>Nom</th><th>Statut</th><th>Trouvés</th></tr>
                  </thead>
                  <tbody>
                    {sourcingJobs.map((j: any) => (
                      <tr key={j.id}>
                        <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{j.name}</td>
                        <td>
                          <span className={`o-badge o-badge-${j.status === 'completed' ? 'success' : j.status === 'running' ? 'primary' : j.status === 'failed' ? 'danger' : 'muted'}`}>
                            {j.status}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>{j.found_count || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Qualité données */}
            <div className="o-card">
              <div className="o-card-title" style={{ marginBottom: 20 }}>🎯 Qualité des données</div>
              {[
                { label: 'Email', pct: stats.email_coverage || 0, color: '#28A745' },
                { label: 'Téléphone', pct: stats.total_prospects > 0 ? Math.round((stats.with_phone || 0) / stats.total_prospects * 100) : 0, color: '#017E84' },
                { label: 'SIREN', pct: 90, color: '#714B67' },
                { label: 'Site web', pct: 55, color: '#17A2B8' },
              ].map(item => (
                <div key={item.label} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.pct}%</span>
                  </div>
                  <div style={{ height: 6, background: '#F0F0F0', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${item.pct}%`, background: item.color, borderRadius: 3, transition: 'width .5s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions rapides */}
          <div className="o-card">
            <div className="o-card-title" style={{ marginBottom: 16 }}>🚀 Actions rapides</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {[
                { href: '/sourcing', icon: '🔍', label: 'Nouveau scraping', color: '#017E84' },
                { href: '/contacts', icon: '📧', label: 'Enrichir emails', color: '#28A745' },
                { href: '/signals', icon: '⚡', label: 'Voir les signaux', color: '#F0AD4E' },
                { href: '/prospects?has_email=false', icon: '📞', label: 'Sans email', color: '#DC3545' },
              ].map(a => (
                <a key={a.href} href={a.href}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderRadius: 8, background: `${a.color}12`, border: `1px solid ${a.color}30`, color: a.color, fontWeight: 600, fontSize: 14, textDecoration: 'none', transition: 'all .15s' }}>
                  <span style={{ fontSize: 18 }}>{a.icon}</span>
                  {a.label}
                </a>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Vue Opérations ── */}
      {view === 'ops' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[
              { label: 'Séquences actives', value: stats.active_sequences || 0, color: '#017E84' },
              { label: 'Emails envoyés', value: (stats.emails_sent || 0).toLocaleString('fr-FR'), color: '#28A745' },
              { label: "Taux d'ouverture", value: `${stats.open_rate || 0}%`, color: '#F0AD4E' },
              { label: 'Taux de réponse', value: `${stats.reply_rate || 0}%`, color: '#714B67' },
            ].map((m, i) => (
              <div key={i} className="o-card" style={{ textAlign: 'center', padding: '20px 16px' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: m.color, marginBottom: 4 }}>{m.value}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{m.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="o-card">
              <div className="o-card-title" style={{ marginBottom: 16 }}>📧 Funnel séquences</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={[
                  { name: 'Inscrits', value: stats.emails_sent || 0 },
                  { name: 'Envoyés', value: Math.round((stats.emails_sent || 0) * 0.92) },
                  { name: 'Ouverts', value: Math.round((stats.emails_sent || 0) * (stats.open_rate || 0) / 100) },
                  { name: 'Cliqués', value: Math.round((stats.emails_sent || 0) * 0.05) },
                  { name: 'Réponses', value: Math.round((stats.emails_sent || 0) * (stats.reply_rate || 0) / 100) },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6C757D' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6C757D' }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="value" fill="#017E84" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="o-card">
              <div className="o-card-title" style={{ marginBottom: 16 }}>⚡ Signaux par sévérité</div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={[
                    { name: 'Critical', value: 5 },
                    { name: 'High', value: stats.unread_signals || 0 },
                    { name: 'Medium', value: Math.max(0, (stats.total_signals || 0) - (stats.unread_signals || 0)) },
                    { name: 'Low', value: Math.round((stats.total_signals || 0) * 0.3) },
                  ]}
                    cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                    dataKey="value" paddingAngle={2}
                  >
                    <Cell fill="#DC3545" />
                    <Cell fill="#FD7E14" />
                    <Cell fill="#017E84" />
                    <Cell fill="#28A745" />
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
