import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  Star, AlertTriangle, Megaphone, CheckSquare, TrendingUp, TrendingDown,
  ChevronRight, Loader2, Shield, Zap,
} from 'lucide-react';
import apiClient from '@/lib/api-client';

interface DashboardData {
  summary: {
    averageReputationScore: number;
    totalCampaigns: number;
    activeAlerts: number;
    crisisAlerts: number;
    publishedPosts: number;
    scoreColor: string;
    scoreLabel: string;
  };
  recentCampaigns: { id: string; name: string; targetName: string; reputationScore: number; status: string; updatedAt: string }[];
  recentAlerts: { id: string; type: string; severity: string; title: string; score: number; createdAt: string }[];
}

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 70 ? '#059669' : score >= 40 ? '#D97706' : '#DC2626';
  const label = score >= 70 ? 'Excellente' : score >= 40 ? 'Correcte' : 'Critique';
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={120} height={80} viewBox="0 0 120 80">
        <path d="M10 70 A50 50 0 0 1 110 70" fill="none" stroke="var(--card-border)" strokeWidth={10} strokeLinecap="round" />
        <path
          d="M10 70 A50 50 0 0 1 110 70"
          fill="none" stroke={color} strokeWidth={10} strokeLinecap="round"
          strokeDasharray={`${(score / 100) * 157} 157`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        <text x={60} y={72} textAnchor="middle" fontSize={22} fontWeight={900} fill={color}>{score}</text>
      </svg>
      <div style={{ fontSize: 12, fontWeight: 700, color, marginTop: -4 }}>{label}</div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    high: { bg: '#FEF2F2', color: '#DC2626', label: 'Critique' },
    medium: { bg: '#FFFBEB', color: '#D97706', label: 'Avertissement' },
    low: { bg: '#F0FDF4', color: '#059669', label: 'Info' },
  };
  const { bg, color, label } = cfg[severity] ?? cfg.low;
  return (
    <span style={{ padding: '2px 8px', borderRadius: 20, background: bg, color, fontSize: 10, fontWeight: 800 }}>{label}</span>
  );
}

function timeAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return "Aujourd'hui";
  if (d === 1) return "Hier";
  return `Il y a ${d}j`;
}

export default function ClientDashboardPage() {
  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['client-erep-dashboard'],
    queryFn: () => apiClient.get('/client/ereputation/dashboard'),
    refetchInterval: 60000,
  });

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <Loader2 size={28} color="#7C3AED" style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  );

  if (error) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#DC2626' }}>Erreur de chargement du tableau de bord.</div>
  );

  const s = data?.summary;

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
          Tableau de bord E-Réputation
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
          Vue synthétique de votre réputation en ligne · Mis à jour en temps réel
        </p>
      </div>

      {/* Score + KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: 16, marginBottom: 28, alignItems: 'stretch' }}>
        {/* Score gauge */}
        <div style={{ background: 'var(--card-bg)', border: '1.5px solid var(--card-border)', borderRadius: 16, padding: '20px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Score Global</div>
          <ScoreGauge score={s?.averageReputationScore ?? 50} />
        </div>

        {/* Campagnes */}
        <Link href="/client/ereputation/campaigns" style={{ textDecoration: 'none' }}>
          <div style={{ background: 'var(--card-bg)', border: '1.5px solid var(--card-border)', borderRadius: 16, padding: '20px 24px', height: '100%', cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.transform = 'none')}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(135deg,#7C3AED,#A855F7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Megaphone size={17} color="#fff" />
              </div>
              <ChevronRight size={14} color="var(--text-muted)" />
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 2 }}>{s?.totalCampaigns ?? 0}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>Campagnes actives</div>
          </div>
        </Link>

        {/* Alertes */}
        <Link href="/client/ereputation/approvals" style={{ textDecoration: 'none' }}>
          <div style={{
            background: (s?.activeAlerts ?? 0) > 0 ? '#FEF2F2' : 'var(--card-bg)',
            border: `1.5px solid ${(s?.activeAlerts ?? 0) > 0 ? '#FECACA' : 'var(--card-border)'}`,
            borderRadius: 16, padding: '20px 24px', height: '100%', cursor: 'pointer', transition: 'all 0.15s',
          }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.transform = 'none')}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: (s?.activeAlerts ?? 0) > 0 ? 'linear-gradient(135deg,#DC2626,#EF4444)' : 'linear-gradient(135deg,#6B7280,#9CA3AF)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={17} color="#fff" />
              </div>
              <ChevronRight size={14} color="var(--text-muted)" />
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: (s?.activeAlerts ?? 0) > 0 ? '#DC2626' : 'var(--text-primary)', marginBottom: 2 }}>{s?.activeAlerts ?? 0}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>Alertes actives</div>
            {(s?.crisisAlerts ?? 0) > 0 && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 2 }}>{s?.crisisAlerts} critique{(s?.crisisAlerts ?? 0) > 1 ? 's' : ''}</div>}
          </div>
        </Link>

        {/* Approbations */}
        <Link href="/client/ereputation/approvals" style={{ textDecoration: 'none' }}>
          <div style={{ background: 'var(--card-bg)', border: '1.5px solid var(--card-border)', borderRadius: 16, padding: '20px 24px', height: '100%', cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.transform = 'none')}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(135deg,#059669,#10B981)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckSquare size={17} color="#fff" />
              </div>
              <ChevronRight size={14} color="var(--text-muted)" />
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 2 }}>{s?.publishedPosts ?? 0}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>Publications approuvées</div>
          </div>
        </Link>
      </div>

      {/* Bottom grid : Campagnes + Alertes récentes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Campagnes récentes */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Star size={15} color="#7C3AED" />
              <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Campagnes</h2>
            </div>
            <Link href="/client/ereputation/campaigns"><button style={{ fontSize: 11, padding: '5px 12px', borderRadius: 20, border: '1px solid var(--card-border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 600 }}>Voir tout →</button></Link>
          </div>
          {(data?.recentCampaigns ?? []).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              Aucune campagne active
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(data?.recentCampaigns ?? []).slice(0, 4).map(c => {
                const scoreColor = c.reputationScore >= 70 ? '#059669' : c.reputationScore >= 40 ? '#D97706' : '#DC2626';
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, background: 'var(--body-bg)', border: '1px solid var(--card-border)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: scoreColor, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.targetName}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: scoreColor }}>{c.reputationScore}/100</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      {c.reputationScore >= 50 ? <TrendingUp size={12} color="#059669" /> : <TrendingDown size={12} color="#DC2626" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Alertes récentes */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={15} color="#DC2626" />
              <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Alertes récentes</h2>
            </div>
          </div>
          {(data?.recentAlerts ?? []).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              <Shield size={24} color="#059669" style={{ margin: '0 auto 8px', display: 'block' }} />
              Aucune alerte active ✓
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(data?.recentAlerts ?? []).map(a => (
                <div key={a.id} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--body-bg)', border: '1px solid var(--card-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <SeverityBadge severity={a.severity} />
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{timeAgo(a.createdAt)}</span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>{a.title}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
