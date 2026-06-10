import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileBarChart, Loader2, TrendingUp, TrendingDown, BarChart2,
  MessageCircle, Star, Download,
} from 'lucide-react';
import apiClient from '@/lib/api-client';

interface ReportData {
  generatedAt: string;
  summary: { campaignCount: number; averageReputationScore: number; scoreColor: string };
  campaigns: { id: string; name: string; targetName: string; reputationScore: number; status: string }[];
  alerts: { active: number; resolved: number; crisis: number; warnings: number };
  serp: { keywords: { keyword: string; avg_position: number; date: string }[] };
  sentiment: { positive: number; negative: number; neutral: number; total: number };
}

function KPITile({ value, label, color, icon }: { value: string | number; label: string; color: string; icon: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--card-bg)', border: '1.5px solid var(--card-border)', borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
          {icon}
        </div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>{label}</div>
    </div>
  );
}

function SentimentBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color }}>{pct}% ({count})</span>
      </div>
      <div style={{ height: 8, borderRadius: 6, background: 'var(--card-border)' }}>
        <div style={{ height: 8, borderRadius: 6, width: `${pct}%`, background: color, transition: 'width 0.6s' }} />
      </div>
    </div>
  );
}

export default function ClientReportsPage() {
  const { data, isLoading, error, dataUpdatedAt } = useQuery<ReportData>({
    queryKey: ['client-erep-reports'],
    queryFn: () => apiClient.get('/client/ereputation/reports'),
    refetchInterval: 120000,
  });

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <Loader2 size={28} color="#7C3AED" style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  );

  if (!data) return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Chargement du rapport…</div>;

  const avgScore = data.summary.averageReputationScore;
  const scoreColor = avgScore >= 70 ? '#059669' : avgScore >= 40 ? '#D97706' : '#DC2626';
  const totalMentions = data.sentiment.total;

  const handleDownload = () => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport-ereputation-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Rapport E-Réputation</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Généré le {new Date(data.generatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <button onClick={handleDownload}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 12, background: 'linear-gradient(135deg,#7C3AED,#A855F7)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          <Download size={14} /> Exporter JSON
        </button>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        <KPITile value={`${avgScore}/100`} label="Score moyen" color={scoreColor} icon={<Star size={14} />} />
        <KPITile value={data.summary.campaignCount} label="Campagnes" color="#7C3AED" icon={<BarChart2 size={14} />} />
        <KPITile value={data.alerts.active} label="Alertes actives" color={data.alerts.active > 0 ? '#DC2626' : '#059669'} icon={<TrendingDown size={14} />} />
        <KPITile value={totalMentions} label="Mentions analysées" color="#2563EB" icon={<MessageCircle size={14} />} />
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Campagnes */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Star size={15} color="#7C3AED" />
            <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Performance par campagne</h2>
          </div>
          {data.campaigns.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>Aucune campagne</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.campaigns.map(c => {
                const c_score = c.reputationScore;
                const c_color = c_score >= 70 ? '#059669' : c_score >= 40 ? '#D97706' : '#DC2626';
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{c.name}</div>
                      <div style={{ height: 6, borderRadius: 4, background: 'var(--card-border)' }}>
                        <div style={{ height: 6, borderRadius: 4, width: `${c_score}%`, background: c_color, transition: 'width 0.5s' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 50 }}>
                      {c_score >= 50 ? <TrendingUp size={12} color="#059669" /> : <TrendingDown size={12} color="#DC2626" />}
                      <span style={{ fontSize: 13, fontWeight: 900, color: c_color }}>{c_score}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sentiment analysis */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <MessageCircle size={15} color="#2563EB" />
            <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Analyse de sentiment</h2>
          </div>
          {totalMentions === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>Aucune mention analysée</div>
          ) : (
            <>
              <SentimentBar label="Positif 😊" count={data.sentiment.positive} total={totalMentions} color="#059669" />
              <SentimentBar label="Neutre 😐" count={data.sentiment.neutral} total={totalMentions} color="#6B7280" />
              <SentimentBar label="Négatif 😤" count={data.sentiment.negative} total={totalMentions} color="#DC2626" />
              <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, background: 'var(--body-bg)', border: '1px solid var(--card-border)', fontSize: 12, color: 'var(--text-secondary)' }}>
                <strong>{totalMentions}</strong> mentions analysées — ratio positif/négatif :{' '}
                <strong style={{ color: '#059669' }}>
                  {data.sentiment.negative > 0
                    ? (data.sentiment.positive / data.sentiment.negative).toFixed(1) + ':1'
                    : '∞'}
                </strong>
              </div>
            </>
          )}
        </div>

        {/* Alertes */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <FileBarChart size={15} color="#D97706" />
            <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Récapitulatif alertes</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Actives', value: data.alerts.active, color: '#DC2626', bg: '#FEF2F2' },
              { label: 'Résolues', value: data.alerts.resolved, color: '#059669', bg: '#F0FDF4' },
              { label: 'Crises', value: data.alerts.crisis, color: '#7C3AED', bg: '#EDE9FE' },
              { label: 'Avertissements', value: data.alerts.warnings, color: '#D97706', bg: '#FEF3C7' },
            ].map(item => (
              <div key={item.label} style={{ background: item.bg, borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: item.color }}>{item.value}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: item.color + 'cc' }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* SERP keywords */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <BarChart2 size={15} color="#2563EB" />
            <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Top mots-clés SERP</h2>
          </div>
          {data.serp.keywords.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>Aucune donnée SERP disponible</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.serp.keywords.slice(0, 6).map((kw, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, background: 'var(--body-bg)' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{kw.keyword}</span>
                  <span style={{ fontSize: 12, fontWeight: 900, color: kw.avg_position <= 3 ? '#059669' : kw.avg_position <= 10 ? '#D97706' : '#DC2626', marginLeft: 10 }}>
                    #{kw.avg_position}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
