import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, AreaChart, Area, Cell,
} from 'recharts';
import {
  TrendingUp, DollarSign, Target, Zap, ShieldAlert, Flame, Loader2,
  Sparkles, ChevronRight, BarChart2, Activity, CheckCircle, AlertTriangle,
  Info,
} from 'lucide-react';
import { Link } from 'wouter';
import { KPICard } from './KPICard';
import apiClient from '@/lib/api-client';

/* ─── Types ──────────────────────────────────────────────── */
interface CoreKPIs {
  totalPipelineValue: number;
  totalPipelineCount: number;
  winRate: number;
  avgDealSize: number;
  avgSalesCycleDays: number;
  closedWonRevenue: number;
  closedWonCount: number;
  mrrEstimate: number;
  arrEstimate: number;
  atRiskValue: number;
  atRiskCount: number;
  avgHealthScore: number;
  vs30d: { pipelineValue: number; winRate: number; avgDealSize: number };
}

interface FunnelStage {
  stage: string;
  label: string;
  count: number;
  value: number;
  conversionRate: number | null;
}

interface ForecastPoint {
  period: string;
  label: string;
  weightedValue: number;
  bestCase: number;
  worstCase: number;
  dealCount: number;
}

interface TrendPoint {
  month: string;
  label: string;
  wonRevenue: number;
  lostRevenue: number;
  newPipeline: number;
  wonCount: number;
}

interface AIForecastSummary {
  targetQuarter: string;
  projectedRevenue: number;
  confidencePercent: number;
  atRiskPercent: number;
  narrativeFr: string;
  signals: { label: string; sentiment: 'positive' | 'neutral' | 'negative' }[];
}

/* ─── Helpers ────────────────────────────────────────────── */
function fmtMoney(v: number, compact = false) {
  if (!v) return '0 €';
  if (compact && v >= 1000000) return `${(v / 1000000).toFixed(1)}M €`;
  if (compact && v >= 1000) return `${(v / 1000).toFixed(0)}k €`;
  return v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 });
}

function pctChange(current: number, previous: number): number {
  if (!previous) return 0;
  return Math.round(((current - previous) / previous) * 100);
}

const SENTIMENT_CONFIG = {
  positive: { color: '#059669', bg: '#ECFDF5', icon: <CheckCircle size={11} /> },
  neutral:  { color: '#D97706', bg: '#FFFBEB', icon: <Info size={11} /> },
  negative: { color: '#DC2626', bg: '#FEF2F2', icon: <AlertTriangle size={11} /> },
};

const FUNNEL_COLORS = ['#0EA5E9', '#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#EF4444'];

/* ─── Custom Tooltip ─────────────────────────────────────── */
function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}>
      <p style={{ fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ margin: '2px 0', color: p.color }}>
          {p.name}: <strong>{typeof p.value === 'number' ? fmtMoney(p.value, true) : p.value}</strong>
        </p>
      ))}
    </div>
  );
}

/* ─── Section Header ─────────────────────────────────────── */
function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#0F172A,#1E3A5F)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {React.cloneElement(icon as React.ReactElement, { size: 14, color: '#fff' })}
      </div>
      <div>
        <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
        {subtitle && <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>{subtitle}</p>}
      </div>
    </div>
  );
}

/* ─── Main Dashboard ─────────────────────────────────────── */
export default function RevenueDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'forecast' | 'trends'>('overview');

  const { data: kpis, isLoading: kpiLoading } = useQuery<CoreKPIs>({
    queryKey: ['revenue-kpis'],
    queryFn: () => apiClient.get('/revenue/kpis'),
    refetchInterval: 60000,
  });

  const { data: funnel = [], isLoading: funnelLoading } = useQuery<FunnelStage[]>({
    queryKey: ['revenue-funnel'],
    queryFn: () => apiClient.get('/revenue/funnel'),
  });

  const { data: forecast = [], isLoading: forecastLoading } = useQuery<ForecastPoint[]>({
    queryKey: ['revenue-forecast'],
    queryFn: () => apiClient.get('/revenue/forecast'),
  });

  const { data: trends = [], isLoading: trendsLoading } = useQuery<TrendPoint[]>({
    queryKey: ['revenue-trends'],
    queryFn: () => apiClient.get('/revenue/trends'),
  });

  const { data: aiSummary, isLoading: aiLoading } = useQuery<AIForecastSummary>({
    queryKey: ['revenue-ai-summary'],
    queryFn: () => apiClient.get('/revenue/ai-summary'),
  });

  const isLoading = kpiLoading || funnelLoading || forecastLoading || trendsLoading || aiLoading;

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1240, margin: '0 auto' }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 24 }}>
        <div style={{ width: 50, height: 50, borderRadius: 14, background: 'linear-gradient(135deg,#064E3B,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <TrendingUp size={24} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 4px' }}>Revenue Intelligence</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>KPIs, Funnel de conversion, Forecast IA — mise à jour en temps réel depuis le pipeline</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['overview', 'forecast', 'trends'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                fontSize: 12, fontWeight: 700, padding: '7px 14px', borderRadius: 9999, cursor: 'pointer',
                border: `1.5px solid ${activeTab === tab ? 'var(--color-primary)' : 'var(--card-border)'}`,
                background: activeTab === tab ? 'var(--color-primary)' : 'transparent',
                color: activeTab === tab ? '#fff' : 'var(--text-muted)',
              }}
            >
              {{ overview: 'Vue d\'ensemble', forecast: 'Forecast', trends: 'Tendances' }[tab]}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <KPICard
          label="Pipeline Total"
          value={kpis ? fmtMoney(kpis.totalPipelineValue, true) : '—'}
          subValue={kpis ? `${kpis.totalPipelineCount} deals actifs` : undefined}
          change={kpis ? pctChange(kpis.totalPipelineValue, kpis.vs30d.pipelineValue) : undefined}
          changeLabel="vs mois dernier"
          icon={<DollarSign size={16} />}
          accentColor="#059669" accentBg="#ECFDF5"
          loading={kpiLoading}
        />
        <KPICard
          label="Taux de Victoire"
          value={kpis ? `${kpis.winRate}%` : '—'}
          subValue={kpis ? `${kpis.closedWonCount} deals gagnés` : undefined}
          change={kpis ? kpis.winRate - kpis.vs30d.winRate : undefined}
          changeLabel="pts vs mois dernier"
          icon={<Target size={16} />}
          accentColor="#2563EB" accentBg="#EFF6FF"
          loading={kpiLoading}
        />
        <KPICard
          label="Taille Moy. Deal"
          value={kpis ? fmtMoney(kpis.avgDealSize, true) : '—'}
          subValue={kpis ? `Cycle: ${kpis.avgSalesCycleDays}j en moy.` : undefined}
          change={kpis ? pctChange(kpis.avgDealSize, kpis.vs30d.avgDealSize) : undefined}
          changeLabel="vs mois dernier"
          icon={<BarChart2 size={16} />}
          accentColor="#7C3AED" accentBg="#F5F3FF"
          loading={kpiLoading}
        />
        <KPICard
          label="Forecast IA (90j)"
          value={aiSummary ? fmtMoney(aiSummary.projectedRevenue, true) : '—'}
          subValue={aiSummary ? `Confiance: ${aiSummary.confidencePercent}%` : undefined}
          icon={<Sparkles size={16} />}
          accentColor="#D97706" accentBg="#FFFBEB"
          loading={aiLoading}
        />
      </div>

      {/* ── Secondary KPIs ───────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'ARR Estimé',       value: kpis ? fmtMoney(kpis.arrEstimate, true) : '—',        icon: <Activity size={13} />,    color: '#059669', bg: '#ECFDF5' },
          { label: 'MRR Estimé',       value: kpis ? fmtMoney(kpis.mrrEstimate, true) : '—',        icon: <TrendingUp size={13} />,  color: '#2563EB', bg: '#EFF6FF' },
          { label: 'Valeur à Risque',  value: kpis ? fmtMoney(kpis.atRiskValue, true) : '—',       icon: <Flame size={13} />,       color: '#DC2626', bg: '#FEF2F2' },
          { label: 'Score Santé Moy.', value: kpis ? `${kpis.avgHealthScore}/100` : '—',           icon: <ShieldAlert size={13} />, color: kpis?.avgHealthScore && kpis.avgHealthScore >= 60 ? '#059669' : kpis?.avgHealthScore && kpis.avgHealthScore >= 40 ? '#D97706' : '#DC2626', bg: kpis?.avgHealthScore && kpis.avgHealthScore >= 60 ? '#ECFDF5' : kpis?.avgHealthScore && kpis.avgHealthScore >= 40 ? '#FFFBEB' : '#FEF2F2' },
        ].map(m => (
          <div key={m.label} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: m.bg, color: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{m.icon}</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{m.value}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Overview Tab ─────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

          {/* Funnel Chart */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '20px' }}>
            <SectionHeader icon={<BarChart2 />} title="Funnel de Conversion" subtitle="Nombre de deals par étape" />
            {funnelLoading ? (
              <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Loader2 size={20} color="var(--text-muted)" style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={funnel} layout="vertical" margin={{ left: 10, right: 20, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                  <YAxis dataKey="label" type="category" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} width={90} />
                  <Tooltip content={<RevenueTooltip />} cursor={{ fill: 'var(--card-border)' }} />
                  <Bar dataKey="count" name="Deals" radius={[0, 5, 5, 0]}>
                    {funnel.map((_, i) => (
                      <Cell key={i} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            {!funnelLoading && funnel.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 12 }}>
                {funnel.filter(s => s.conversionRate !== null).slice(0, 3).map(s => (
                  <div key={s.stage} style={{ textAlign: 'center', padding: '6px', borderRadius: 8, background: 'var(--body-bg)', border: '1px solid var(--card-border)' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{s.conversionRate}%</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Forecast Summary */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '20px' }}>
            <SectionHeader icon={<Sparkles />} title="Analyse IA du Pipeline" subtitle={aiSummary?.targetQuarter} />
            {aiLoading ? (
              <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Loader2 size={20} color="var(--text-muted)" style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            ) : aiSummary ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Confidence meter */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Indice de confiance</span>
                    <span style={{ fontWeight: 800, color: aiSummary.confidencePercent >= 70 ? '#059669' : aiSummary.confidencePercent >= 50 ? '#D97706' : '#DC2626' }}>{aiSummary.confidencePercent}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 9999, background: 'var(--card-border)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${aiSummary.confidencePercent}%`, borderRadius: 9999, background: aiSummary.confidencePercent >= 70 ? '#059669' : aiSummary.confidencePercent >= 50 ? '#D97706' : '#DC2626', transition: 'width 0.5s ease' }} />
                  </div>
                </div>

                {/* Narrative */}
                <div style={{ padding: '12px', borderRadius: 10, background: 'var(--body-bg)', border: '1px solid var(--card-border)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  {aiSummary.narrativeFr}
                </div>

                {/* Signals */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {aiSummary.signals.map((s, i) => {
                    const cfg = SENTIMENT_CONFIG[s.sentiment];
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: cfg.bg, border: `1px solid ${cfg.color}22` }}>
                        <span style={{ color: cfg.color }}>{cfg.icon}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color }}>{s.label}</span>
                      </div>
                    );
                  })}
                </div>

                <Link href="/deal-coach">
                  <button style={{ width: '100%', padding: '9px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#0F172A,#1E3A5F)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Target size={12} />Ouvrir AI Deal Coach <ChevronRight size={12} />
                  </button>
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Forecast Tab ─────────────────────────────────────── */}
      {activeTab === 'forecast' && (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '20px', marginBottom: 20 }}>
          <SectionHeader icon={<Zap />} title="Forecast 30 / 60 / 90 jours" subtitle="Revenus pondérés par Health Score × Probabilité de closing" />
          {forecastLoading ? (
            <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Loader2 size={20} color="var(--text-muted)" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'start' }}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={forecast} margin={{ left: 10, right: 20, top: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<RevenueTooltip />} cursor={{ fill: 'var(--card-border)' }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-muted)' }} />
                  <Bar dataKey="bestCase" name="Meilleur cas" fill="#059669" opacity={0.4} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="weightedValue" name="Forecast pondéré" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="worstCase" name="Pire cas" fill="#DC2626" opacity={0.5} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {forecast.map((f, i) => (
                  <div key={i} style={{ padding: '14px', borderRadius: 12, background: 'var(--body-bg)', border: '1px solid var(--card-border)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>{f.period}</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#2563EB', marginBottom: 4 }}>{fmtMoney(f.weightedValue, true)}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{f.dealCount} deal{f.dealCount !== 1 ? 's' : ''} avec close date</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: '#ECFDF5', color: '#059669' }}>↑ {fmtMoney(f.bestCase, true)}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: '#FEF2F2', color: '#DC2626' }}>↓ {fmtMoney(f.worstCase, true)}</span>
                    </div>
                  </div>
                ))}
                <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                  Forecast = Valeur × Probabilité × (Health Score / 100)
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Trends Tab ───────────────────────────────────────── */}
      {activeTab === 'trends' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>

          {/* Revenue trend */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '20px' }}>
            <SectionHeader icon={<TrendingUp />} title="Tendance Revenue (6 mois)" subtitle="Won Revenue vs New Pipeline" />
            {trendsLoading ? (
              <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Loader2 size={20} color="var(--text-muted)" style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={trends} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="wonGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="pipeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<RevenueTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-muted)' }} />
                  <Area type="monotone" dataKey="wonRevenue" name="Revenue gagné" stroke="#059669" strokeWidth={2} fill="url(#wonGrad)" />
                  <Area type="monotone" dataKey="newPipeline" name="Nouveau pipeline" stroke="#2563EB" strokeWidth={2} fill="url(#pipeGrad)" strokeDasharray="5 3" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Monthly deal stats */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '20px' }}>
            <SectionHeader icon={<Activity />} title="Deals gagnés / mois" />
            {trendsLoading ? (
              <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Loader2 size={20} color="var(--text-muted)" style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={trends} margin={{ left: 0, right: 0, top: 5, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                    <Tooltip content={<RevenueTooltip />} cursor={{ fill: 'var(--card-border)' }} />
                    <Bar dataKey="wonCount" name="Deals gagnés" fill="#059669" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
                  {trends.slice(-3).reverse().map(t => (
                    <div key={t.month} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '4px 8px', borderRadius: 6, background: 'var(--body-bg)' }}>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{t.label}</span>
                      <span style={{ color: '#059669', fontWeight: 800 }}>{fmtMoney(t.wonRevenue, true)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Quick Links ──────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        {[
          { label: '→ Pipeline', href: '/pipeline', color: '#2563EB' },
          { label: '→ Deal Coach', href: '/deal-coach', color: '#DC2626' },
          { label: '→ Signaux', href: '/signals', color: '#7C3AED' },
          { label: '→ Account 360°', href: '/accounts', color: '#059669' },
        ].map(l => (
          <Link key={l.href} href={l.href}>
            <button style={{ fontSize: 11, fontWeight: 700, padding: '6px 14px', borderRadius: 9999, border: `1.5px solid ${l.color}33`, background: 'transparent', color: l.color, cursor: 'pointer' }}>
              {l.label}
            </button>
          </Link>
        ))}
      </div>
    </div>
  );
}
