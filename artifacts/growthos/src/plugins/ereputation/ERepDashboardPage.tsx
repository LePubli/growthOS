import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield, TrendingUp, AlertTriangle, Link2, Loader2,
  Plus, Zap, RefreshCw, ChevronRight, Target,
} from 'lucide-react';
import { Link } from 'wouter';
import { toast } from 'sonner';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import apiClient from '@/lib/api-client';

interface Campaign {
  id: string;
  name: string;
  targetType: 'B2B' | 'B2C';
  targetName: string;
  reputationScore: number;
  status: string;
  createdAt: string;
}

const PIE_COLORS = { pos: '#059669', neg: '#DC2626', neu: '#9CA3AF' };
const SCORE_COLOR = (s: number) => s >= 70 ? '#059669' : s >= 40 ? '#D97706' : '#DC2626';
const SCORE_LABEL = (s: number) => s >= 70 ? 'Excellente' : s >= 40 ? 'Correcte' : 'Faible';

function ScoreGauge({ score }: { score: number }) {
  const color = SCORE_COLOR(score);
  const r = 54;
  const circ = 2 * Math.PI * r;
  const progress = circ * score / 100;
  return (
    <div style={{ position: 'relative', width: 140, height: 140 }}>
      <svg viewBox="0 0 140 140" style={{ width: 140, height: 140, transform: 'rotate(-90deg)' }}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--body-bg)" strokeWidth="14" />
        <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="14"
          strokeDasharray={`${progress} ${circ}`} strokeLinecap="round" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 900, color }}>{score}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{SCORE_LABEL(score)}</div>
      </div>
    </div>
  );
}

export default function ERepDashboardPage() {
  const qc = useQueryClient();

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['erep-campaigns'],
    queryFn: () => apiClient.get('/ereputation/campaigns') as Promise<Campaign[]>,
  });

  const globalScore = campaigns.length
    ? Math.round(campaigns.reduce((s, c) => s + c.reputationScore, 0) / campaigns.length)
    : 0;

  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;

  const mockSerpEvolution = Array.from({ length: 8 }, (_, i) => ({
    date: new Date(Date.now() - (7 - i) * 86400000 * 4).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
    score: Math.floor(Math.random() * 20 + 55),
  }));

  const sentimentData = [
    { name: 'Positif', value: 62, color: PIE_COLORS.pos },
    { name: 'Négatif', value: 18, color: PIE_COLORS.neg },
    { name: 'Neutre', value: 20, color: PIE_COLORS.neu },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#1E3A5F,#2563EB)' }}>
            <Shield size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>E-Réputation & SEO/GEO</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Gestion de votre présence digitale</p>
          </div>
        </div>
        <Link href="/ereputation/campaigns">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
            style={{ background: 'linear-gradient(135deg,#1E3A5F,#2563EB)' }}>
            <Plus size={14} />Nouvelle campagne
          </button>
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Score Global', value: globalScore, suffix: '/100', icon: <Shield size={18} />, color: SCORE_COLOR(globalScore) },
          { label: 'Campagnes actives', value: activeCampaigns, suffix: '', icon: <Target size={18} />, color: '#2563EB' },
          { label: 'Mentions négatives (24h)', value: 3, suffix: '', icon: <AlertTriangle size={18} />, color: '#DC2626' },
          { label: 'Backlinks actifs', value: 47, suffix: '', icon: <Link2 size={18} />, color: '#059669' },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: kpi.color + '20', color: kpi.color }}>
                {kpi.icon}
              </div>
            </div>
            <div className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}{kpi.suffix}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Score gauge */}
        <div className="rounded-2xl border p-6 flex flex-col items-center justify-center" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-muted)' }}>SCORE DE RÉPUTATION GLOBAL</h2>
          <ScoreGauge score={globalScore} />
          <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>Basé sur {campaigns.length} campagne{campaigns.length > 1 ? 's' : ''}</p>
        </div>

        {/* Score evolution */}
        <div className="rounded-2xl border p-6 col-span-2" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-muted)' }}>ÉVOLUTION DU SCORE</h2>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={mockSerpEvolution}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="score" stroke="#2563EB" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sentiment pie */}
        <div className="rounded-2xl border p-6" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-muted)' }}>RÉPARTITION DES SENTIMENTS</h2>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie data={sentimentData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={3}>
                  {sentimentData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {sentimentData.map(d => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: d.color }} />
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{d.name}</span>
                  <span className="text-sm font-bold ml-auto" style={{ color: d.color }}>{d.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Campaigns list */}
        <div className="rounded-2xl border p-6" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>CAMPAGNES RÉCENTES</h2>
            <Link href="/ereputation/campaigns">
              <span className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--color-primary)' }}>
                Voir tout <ChevronRight size={12} />
              </span>
            </Link>
          </div>
          {campaigns.length === 0 ? (
            <div className="text-center py-8">
              <Shield size={32} className="mx-auto mb-2" style={{ color: 'var(--card-border)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Aucune campagne — commencez par en créer une</p>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.slice(0, 4).map(c => (
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--body-bg)' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: c.targetType === 'B2B' ? '#2563EB' : '#7C3AED' }}>
                    {c.targetType}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{c.name}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.targetName}</div>
                  </div>
                  <div className="text-sm font-bold flex-shrink-0" style={{ color: SCORE_COLOR(c.reputationScore) }}>
                    {c.reputationScore}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
