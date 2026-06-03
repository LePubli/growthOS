import React, { useState } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Target, Flame, ShieldAlert, CheckCircle, Loader2, Zap,
  AlertTriangle, TrendingUp, ChevronRight, X, Bot, RefreshCw,
  Building, DollarSign, Calendar, Sparkles, BarChart2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';

/* ─── Types ──────────────────────────────────────────────── */
interface RiskFactor {
  code: string;
  label: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detail: string;
}

interface Deal {
  id: string;
  title: string;
  company: string | null;
  value: string | null;
  stage: string;
  probability: number | null;
  health_score: number;
  risk_factors: RiskFactor[];
  ai_recommendations: string | null;
  last_coached_at: string | null;
  created_at: string;
}

interface PipelineHealth {
  totalDeals: number;
  avgHealthScore: number;
  atRiskCount: number;
  healthyCount: number;
  byStage: { stage: string; count: number; avgScore: number }[];
  totalValue: number;
  atRiskValue: number;
}

interface ForecastPoint {
  period: string;
  label: string;
  weightedValue: number;
  bestCase: number;
  worstCase: number;
  dealCount: number;
}

/* ─── Config ─────────────────────────────────────────────── */
const STAGE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  lead:         { label: 'Lead',          color: '#6B7280', bg: '#F3F4F6' },
  qualified:    { label: 'Qualifié',      color: '#2563EB', bg: '#EFF6FF' },
  proposal:     { label: 'Proposition',   color: '#7C3AED', bg: '#F5F3FF' },
  negotiation:  { label: 'Négociation',   color: '#D97706', bg: '#FFFBEB' },
  closed_won:   { label: 'Gagné',         color: '#059669', bg: '#ECFDF5' },
  closed_lost:  { label: 'Perdu',         color: '#DC2626', bg: '#FEF2F2' },
};

const SEVERITY_CONFIG = {
  critical: { color: '#DC2626', bg: '#FEF2F2', icon: <Flame size={11} />, label: 'Critique' },
  high:     { color: '#D97706', bg: '#FFFBEB', icon: <AlertTriangle size={11} />, label: 'Élevé' },
  medium:   { color: '#2563EB', bg: '#EFF6FF', icon: <ShieldAlert size={11} />, label: 'Moyen' },
  low:      { color: '#6B7280', bg: '#F3F4F6', icon: <CheckCircle size={11} />, label: 'Faible' },
};

function scoreColor(s: number) {
  if (s >= 70) return '#059669';
  if (s >= 40) return '#D97706';
  return '#DC2626';
}
function scoreBg(s: number) {
  if (s >= 70) return '#ECFDF5';
  if (s >= 40) return '#FFFBEB';
  return '#FEF2F2';
}
function scoreLabel(s: number) {
  if (s >= 70) return '✅ Sain';
  if (s >= 40) return '⚠️ À surveiller';
  return '🔴 À risque';
}

function fmtMoney(v: string | number | null) {
  const n = parseFloat(String(v ?? 0));
  if (!n) return '—';
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 });
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

/* ─── Health Gauge ───────────────────────────────────────── */
function HealthGauge({ score }: { score: number }) {
  const c = scoreColor(score);
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width={56} height={56} viewBox="0 0 56 56" style={{ flexShrink: 0 }}>
      <circle cx={28} cy={28} r={r} fill="none" stroke="var(--card-border)" strokeWidth={5} />
      <circle cx={28} cy={28} r={r} fill="none" stroke={c} strokeWidth={5}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 28 28)" />
      <text x={28} y={32} textAnchor="middle" fontSize={12} fontWeight={800} fill={c}>{score}</text>
    </svg>
  );
}

/* ─── Deal Card ──────────────────────────────────────────── */
function DealCard({ deal, onSelect, onAnalyze, analyzing }: {
  deal: Deal;
  onSelect: (d: Deal) => void;
  onAnalyze: (id: string) => void;
  analyzing: boolean;
}) {
  const stage = STAGE_LABELS[deal.stage] ?? STAGE_LABELS.lead;
  const hs = deal.health_score;
  const topRisk = deal.risk_factors?.sort((a, b) => {
    const ord = { critical: 0, high: 1, medium: 2, low: 3 };
    return ord[a.severity] - ord[b.severity];
  })[0];

  return (
    <div
      onClick={() => onSelect(deal)}
      style={{
        background: 'var(--card-bg)', border: `1px solid ${hs < 40 ? '#DC262644' : 'var(--card-border)'}`,
        borderRadius: 14, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <HealthGauge score={hs} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deal.title}</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, background: stage.bg, color: stage.color }}>{stage.label}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
            {deal.company && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#2563EB', fontWeight: 600 }}>
                <Building size={10} />{deal.company}
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
              <DollarSign size={10} />{fmtMoney(deal.value)}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, color: scoreColor(hs) }}>{scoreLabel(hs)}</span>
          </div>
          {topRisk && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600,
              padding: '3px 8px', borderRadius: 7, background: SEVERITY_CONFIG[topRisk.severity].bg,
              color: SEVERITY_CONFIG[topRisk.severity].color, width: 'fit-content',
            }}>
              {SEVERITY_CONFIG[topRisk.severity].icon}
              {topRisk.label}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          onClick={e => { e.stopPropagation(); onAnalyze(deal.id); }}
          disabled={analyzing}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700,
            padding: '5px 12px', borderRadius: 8, border: 'none', cursor: analyzing ? 'not-allowed' : 'pointer',
            background: 'linear-gradient(135deg,#0F172A,#1E3A5F)', color: '#fff', opacity: analyzing ? 0.7 : 1,
          }}
        >
          {analyzing ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={10} />}
          {analyzing ? 'Analyse…' : 'Analyser'}
        </button>
        <Link href={`/ai-sdr?account=${encodeURIComponent(deal.company ?? deal.title)}&goal=book a demo meeting`}>
          <button
            onClick={e => e.stopPropagation()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 8, border: '1px solid #7C3AED44', background: '#F5F3FF', color: '#7C3AED', cursor: 'pointer' }}
          >
            <Bot size={10} />Draft IA
          </button>
        </Link>
      </div>
    </div>
  );
}

/* ─── Insights Panel ─────────────────────────────────────── */
function InsightsPanel({ deal, onClose, onAnalyze, analyzing }: {
  deal: Deal;
  onClose: () => void;
  onAnalyze: (id: string) => void;
  analyzing: boolean;
}) {
  const hs = deal.health_score;
  const risksSorted = [...(deal.risk_factors ?? [])].sort((a, b) => {
    const ord = { critical: 0, high: 1, medium: 2, low: 3 };
    return ord[a.severity] - ord[b.severity];
  });

  function renderRecommendations(md: string | null) {
    if (!md) return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Cliquez sur "Analyser" pour générer des recommandations.</p>;
    return md.split('\n\n').map((para, i) => {
      const bold = para.replace(/\*\*(.*?)\*\*/g, (_m, t) => `<strong style="color:var(--text-primary)">${t}</strong>`);
      return <p key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 12px' }} dangerouslySetInnerHTML={{ __html: bold }} />;
    });
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
      display: 'flex', justifyContent: 'flex-end',
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 480, height: '100%', background: 'var(--card-bg)', boxShadow: '-4px 0 40px rgba(0,0,0,0.15)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* Panel header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <HealthGauge score={hs} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deal.title}</h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {deal.company && <span style={{ fontSize: 12, color: '#2563EB', fontWeight: 600 }}>{deal.company}</span>}
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtMoney(deal.value)}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: scoreColor(hs) }}>{scoreLabel(hs)}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Panel body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Meta */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Phase',       value: STAGE_LABELS[deal.stage]?.label ?? deal.stage },
              { label: 'Health Score', value: `${hs}/100` },
              { label: 'Valeur',       value: fmtMoney(deal.value) },
              { label: 'Dernière analyse', value: fmtDate(deal.last_coached_at) },
            ].map(m => (
              <div key={m.label} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--body-bg)', border: '1px solid var(--card-border)' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 3 }}>{m.label}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Risk Factors */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Facteurs de risque ({risksSorted.length})
            </div>
            {risksSorted.length === 0 ? (
              <p style={{ fontSize: 13, color: '#059669' }}>✅ Aucun risque détecté — deal en bonne santé</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {risksSorted.map(r => {
                  const cfg = SEVERITY_CONFIG[r.severity];
                  return (
                    <div key={r.code} style={{ padding: '10px 12px', borderRadius: 10, background: cfg.bg, border: `1px solid ${cfg.color}33` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ color: cfg.color }}>{cfg.icon}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>{r.label}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 9999, background: 'white', color: cfg.color, marginLeft: 'auto' }}>{cfg.label}</span>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{r.detail}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recommendations */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={11} />Recommandations IA
            </div>
            <div style={{ padding: '14px', borderRadius: 12, background: 'var(--body-bg)', border: '1px solid var(--card-border)' }}>
              {renderRecommendations(deal.ai_recommendations)}
            </div>
          </div>

          {/* Last coached */}
          {deal.last_coached_at && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
              Dernière analyse : {fmtDate(deal.last_coached_at)}
            </p>
          )}
        </div>

        {/* Panel footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--card-border)', display: 'flex', gap: 10 }}>
          <button
            onClick={() => onAnalyze(deal.id)}
            disabled={analyzing}
            style={{
              flex: 1, padding: '11px', borderRadius: 11, border: 'none', cursor: analyzing ? 'not-allowed' : 'pointer',
              background: 'linear-gradient(135deg,#0F172A,#1E3A5F)', color: '#fff', fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: analyzing ? 0.7 : 1,
            }}
          >
            {analyzing ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={14} />}
            {analyzing ? 'Analyse en cours…' : 'Analyser maintenant'}
          </button>
          <Link href={`/ai-sdr?account=${encodeURIComponent(deal.company ?? deal.title)}&goal=book a demo meeting`}>
            <button style={{
              padding: '11px 16px', borderRadius: 11, border: '1px solid #7C3AED44', background: '#F5F3FF',
              color: '#7C3AED', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Bot size={14} />Draft IA
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────── */
export default function DealCoachPage() {
  const queryClient = useQueryClient();
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState('');

  const { data: health } = useQuery<PipelineHealth>({
    queryKey: ['deal-coach-health'],
    queryFn: () => apiClient.get('/deal-coach/pipeline/health'),
  });

  const { data: deals = [], isLoading } = useQuery<Deal[]>({
    queryKey: ['deal-coach-deals'],
    queryFn: () => apiClient.get('/deal-coach/deals'),
    refetchInterval: 30000,
  });

  const { data: forecast = [] } = useQuery<ForecastPoint[]>({
    queryKey: ['revenue-forecast'],
    queryFn: () => apiClient.get('/revenue/forecast'),
    refetchInterval: 60000,
  });

  const analyzeMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/deal-coach/deals/${id}/analyze`, {}),
    onMutate: (id) => setAnalyzingId(id),
    onSuccess: (result: any) => {
      toast.success(`Health Score: ${result.healthScore}/100 — ${result.riskFactors?.length ?? 0} risque(s) détecté(s)`);
      queryClient.invalidateQueries({ queryKey: ['deal-coach-deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal-coach-health'] });
      if (selectedDeal?.id === result.dealId) {
        setSelectedDeal(prev => prev ? { ...prev, ...result, health_score: result.healthScore, risk_factors: result.riskFactors, ai_recommendations: result.aiRecommendations, last_coached_at: result.lastCoachedAt } : null);
      }
    },
    onError: () => toast.error('Erreur lors de l\'analyse'),
    onSettled: () => setAnalyzingId(null),
  });

  const handleAnalyze = (id: string) => analyzeMutation.mutate(id);

  const atRisk = deals.filter(d => d.health_score < 40);
  const filtered = stageFilter ? deals.filter(d => d.stage === stageFilter) : deals;

  // Group by stage for pipeline view
  const byStage = filtered.reduce<Record<string, Deal[]>>((acc, d) => {
    if (!acc[d.stage]) acc[d.stage] = [];
    acc[d.stage].push(d);
    return acc;
  }, {});

  const stages = ['lead', 'qualified', 'proposal', 'negotiation'];

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 24 }}>
        <div style={{ width: 50, height: 50, borderRadius: 14, background: 'linear-gradient(135deg,#7F1D1D,#DC2626)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Target size={24} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 4px' }}>AI Deal Coach</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Health Score, détection de risques et recommandations pour chaque deal actif</p>
        </div>
      </div>

      {/* Pipeline Health Stats */}
      {health && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Deals actifs',       value: health.totalDeals,                                          color: '#6B7280', bg: '#F9FAFB', icon: <Target size={15} /> },
            { label: 'Score moyen',        value: `${health.avgHealthScore}/100`,                             color: scoreColor(health.avgHealthScore), bg: scoreBg(health.avgHealthScore), icon: <TrendingUp size={15} /> },
            { label: 'À risque',           value: health.atRiskCount,                                        color: '#DC2626', bg: '#FEF2F2', icon: <Flame size={15} /> },
            { label: 'Valeur à risque',    value: fmtMoney(health.atRiskValue),                              color: '#D97706', bg: '#FFFBEB', icon: <AlertTriangle size={15} /> },
          ].map(m => (
            <div key={m.label} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: m.bg, color: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{m.icon}</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{m.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* At-Risk Section */}
      {atRisk.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Flame size={16} color="#DC2626" />
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#DC2626', margin: 0 }}>Deals à risque critique ({atRisk.length})</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {atRisk.map(d => (
              <DealCard
                key={d.id} deal={d}
                onSelect={setSelectedDeal}
                onAnalyze={handleAnalyze}
                analyzing={analyzingId === d.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Stage filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Pipeline</span>
        {['', ...stages].map(s => (
          <button
            key={s || 'all'}
            onClick={() => setStageFilter(s)}
            style={{
              fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 9999, cursor: 'pointer',
              border: `1.5px solid ${stageFilter === s ? 'var(--color-primary)' : 'var(--card-border)'}`,
              background: stageFilter === s ? 'var(--color-primary)' : 'transparent',
              color: stageFilter === s ? '#fff' : 'var(--text-muted)',
            }}
          >
            {s ? (STAGE_LABELS[s]?.label ?? s) : 'Tous'}
          </button>
        ))}
      </div>

      {/* Pipeline columns */}
      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '30vh', gap: 12, color: 'var(--text-muted)' }}>
          <Loader2 size={20} className="animate-spin" /><span>Chargement du pipeline…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <Target size={48} color="var(--card-border)" style={{ margin: '0 auto 16px' }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Aucun deal actif trouvé</p>
          <Link href="/pipeline">
            <button style={{ padding: '10px 20px', borderRadius: 12, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Créer un deal →
            </button>
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {(stageFilter ? [stageFilter] : stages).map(stageName => {
            const stageDeals = byStage[stageName] ?? [];
            if (stageDeals.length === 0) return null;
            const cfg = STAGE_LABELS[stageName] ?? STAGE_LABELS.lead;
            return (
              <div key={stageName}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 9999, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{stageDeals.length} deal{stageDeals.length > 1 ? 's' : ''}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {stageDeals.map(d => (
                    <DealCard
                      key={d.id} deal={d}
                      onSelect={setSelectedDeal}
                      onAnalyze={handleAnalyze}
                      analyzing={analyzingId === d.id}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pipeline Forecast */}
      {forecast.length > 0 && (
        <div style={{ marginTop: 28, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#064E3B,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BarChart2 size={14} color="#fff" />
              </div>
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Forecast Pipeline</h2>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>Revenus pondérés par Health Score × Probabilité · 30/60/90 jours</p>
              </div>
            </div>
            <Link href="/revenue">
              <button style={{ fontSize: 11, fontWeight: 700, padding: '6px 14px', borderRadius: 9999, border: '1.5px solid #05996933', background: '#ECFDF5', color: '#059669', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <TrendingUp size={11} />Revenue Intelligence →
              </button>
            </Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'start' }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={forecast} margin={{ left: 0, right: 10, top: 5, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  content={({ active, payload, label }: any) => active && payload?.length ? (
                    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
                      <p style={{ fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>{label}</p>
                      {payload.map((p: any) => <p key={p.dataKey} style={{ margin: '2px 0', color: p.color }}>{p.name}: <strong>{(p.value as number).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })}</strong></p>)}
                    </div>
                  ) : null}
                  cursor={{ fill: 'var(--card-border)' }}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-muted)' }} />
                <Bar dataKey="bestCase" name="Meilleur cas" fill="#059669" opacity={0.35} radius={[4, 4, 0, 0]} />
                <Bar dataKey="weightedValue" name="Forecast pondéré" fill="#2563EB" radius={[4, 4, 0, 0]} />
                <Bar dataKey="worstCase" name="Pire cas" fill="#DC2626" opacity={0.45} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {forecast.map((f, i) => (
                <div key={i} style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--body-bg)', border: '1px solid var(--card-border)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>{f.period}</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#2563EB' }}>
                    {f.weightedValue.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{f.dealCount} deal{f.dealCount !== 1 ? 's' : ''} avec close date</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Insights panel */}
      {selectedDeal && (
        <InsightsPanel
          deal={selectedDeal}
          onClose={() => setSelectedDeal(null)}
          onAnalyze={handleAnalyze}
          analyzing={analyzingId === selectedDeal.id}
        />
      )}
    </div>
  );
}
