import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  Crown, TrendingUp, Target, ShieldAlert, Zap, DollarSign, Loader2,
  Trophy, ChevronRight, Activity, BarChart2, Star, AlertTriangle,
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { AIAssistantChat } from './AIAssistantChat';

interface CommandOverview {
  totalActiveDeals: number;
  totalPipelineValue: number;
  atRiskDeals: number;
  atRiskValue: number;
  forecast90d: number;
  winRate: number;
  avgHealthScore: number;
  topSignals: { id: string; company: string; title: string; type: string; score: number; detectedAt: string }[];
  recentWins: { title: string; company: string | null; value: number; closedAt: string }[];
  pluginActivity: { pluginId: string; pluginName: string; action: string; createdAt: string }[];
  averageReputationScore: number;
  activeReputationAlerts: number;
  reputationCrisisCount: number;
}

const SIGNAL_TYPE_COLORS: Record<string, string> = {
  funding: '#059669', hiring: '#2563EB', news: '#D97706', expansion: '#7C3AED', default: '#6B7280',
};

function fmt(v: number) {
  return v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j`;
}

interface KPICardProps { icon: React.ReactNode; iconBg: string; label: string; value: string; sub?: string; href?: string; alert?: boolean }

function KPICard({ icon, iconBg, label, value, sub, href, alert }: KPICardProps) {
  const inner = (
    <div style={{ background: alert ? '#FEF2F2' : 'var(--card-bg)', border: `1.5px solid ${alert ? '#FECACA' : 'var(--card-border)'}`, borderRadius: 16, padding: '18px 20px', cursor: href ? 'pointer' : 'default', transition: 'all 0.15s' }}
      onMouseEnter={e => href && ((e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)')}
      onMouseLeave={e => href && ((e.currentTarget as HTMLElement).style.transform = 'none')}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: iconBg }}>{icon}</div>
        {href && <ChevronRight size={14} color="var(--text-muted)" />}
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color: alert ? '#DC2626' : 'var(--text-primary)', marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: alert ? '#DC2626' : 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: 'none' }}>{inner}</Link> : inner;
}

export default function CommandCenterPage() {
  const { data: overview, isLoading } = useQuery<CommandOverview>({
    queryKey: ['executive-overview'],
    queryFn: () => apiClient.get('/executive/overview'),
    refetchInterval: 60000,
  });

  return (
    <div style={{ padding: '28px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,#1E1B4B,#4F46E5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Crown size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Command Center</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Vue exécutive · Tous plugins agrégés · Mise à jour automatique</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/revenue"><button style={{ padding: '8px 16px', borderRadius: 10, border: '1.5px solid var(--card-border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><BarChart2 size={13} />Revenue</button></Link>
          <Link href="/deal-coach"><button style={{ padding: '8px 16px', borderRadius: 10, border: '1.5px solid var(--card-border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><Target size={13} />Deal Coach</button></Link>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} color="var(--color-primary)" />
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <KPICard
              icon={<TrendingUp size={17} color="#fff" />} iconBg="linear-gradient(135deg,#059669,#10B981)"
              label="Forecast 90j pondéré" value={fmt(overview?.forecast90d ?? 0)}
              sub={`Pipeline : ${fmt(overview?.totalPipelineValue ?? 0)}`} href="/revenue"
            />
            <KPICard
              icon={<DollarSign size={17} color="#fff" />} iconBg="linear-gradient(135deg,#2563EB,#3B82F6)"
              label="Deals actifs" value={String(overview?.totalActiveDeals ?? 0)}
              sub={`Win Rate : ${(overview?.winRate ?? 0).toFixed(1)}%`} href="/pipeline"
            />
            <KPICard
              icon={<ShieldAlert size={17} color="#fff" />} iconBg="linear-gradient(135deg,#DC2626,#EF4444)"
              label="Deals à risque" value={String(overview?.atRiskDeals ?? 0)}
              sub={overview?.atRiskDeals ? `${fmt(overview.atRiskValue)} menacés` : 'Pipeline sain ✓'} href="/deal-coach"
              alert={(overview?.atRiskDeals ?? 0) > 0}
            />
            <KPICard
              icon={<Zap size={17} color="#fff" />} iconBg="linear-gradient(135deg,#D97706,#F59E0B)"
              label="Top signal" value={overview?.topSignals[0]?.company ?? '—'}
              sub={overview?.topSignals[0]?.title?.slice(0, 45) ?? 'Aucun signal récent'} href="/signals"
            />
          </div>

          {/* E-Réputation row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            {/* Score moyen */}
            <Link href="/ereputation" style={{ textDecoration: 'none' }}>
              <div style={{ background: 'var(--card-bg)', border: '1.5px solid var(--card-border)', borderRadius: 16, padding: '16px 20px', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.transform = 'none')}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg,#7C3AED,#A855F7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Star size={15} color="#fff" />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>Score E-Réputation</span>
                  </div>
                  <ChevronRight size={13} color="var(--text-muted)" />
                </div>
                {(() => {
                  const score = overview?.averageReputationScore ?? 50;
                  const color = score >= 70 ? '#059669' : score >= 40 ? '#D97706' : '#DC2626';
                  return (
                    <>
                      <div style={{ fontSize: 26, fontWeight: 900, color, marginBottom: 4 }}>{score}/100</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {score >= 70 ? '🟢 Réputation excellente' : score >= 40 ? '🟡 Réputation à surveiller' : '🔴 Réputation critique'}
                      </div>
                      <div style={{ marginTop: 8, height: 4, borderRadius: 4, background: 'var(--card-border)' }}>
                        <div style={{ height: 4, borderRadius: 4, width: `${score}%`, background: color, transition: 'width 0.5s' }} />
                      </div>
                    </>
                  );
                })()}
              </div>
            </Link>

            {/* Alertes actives */}
            <Link href="/ereputation" style={{ textDecoration: 'none' }}>
              <div style={{
                background: (overview?.activeReputationAlerts ?? 0) > 0 ? '#FEF2F2' : 'var(--card-bg)',
                border: `1.5px solid ${(overview?.activeReputationAlerts ?? 0) > 0 ? '#FECACA' : 'var(--card-border)'}`,
                borderRadius: 16, padding: '16px 20px', cursor: 'pointer', transition: 'all 0.15s',
              }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.transform = 'none')}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: (overview?.activeReputationAlerts ?? 0) > 0 ? 'linear-gradient(135deg,#DC2626,#EF4444)' : 'linear-gradient(135deg,#6B7280,#9CA3AF)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <AlertTriangle size={15} color="#fff" />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>Alertes E-Rep actives</span>
                  </div>
                  <ChevronRight size={13} color="var(--text-muted)" />
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, color: (overview?.activeReputationAlerts ?? 0) > 0 ? '#DC2626' : 'var(--text-primary)', marginBottom: 4 }}>
                  {overview?.activeReputationAlerts ?? 0}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {(overview?.activeReputationAlerts ?? 0) === 0 ? 'Aucune alerte en cours ✓' : `dont ${overview?.reputationCrisisCount ?? 0} crises HIGH`}
                </div>
              </div>
            </Link>

            {/* Lien portail client */}
            <Link href="/client/ereputation" style={{ textDecoration: 'none' }}>
              <div style={{ background: 'linear-gradient(135deg,#1E1B4B 0%,#312E81 100%)', border: '1.5px solid #4338CA', borderRadius: 16, padding: '16px 20px', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.transform = 'none')}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Crown size={15} color="#fff" />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>Portail Client</span>
                  </div>
                  <ChevronRight size={13} color="rgba(255,255,255,0.6)" />
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 4 }}>E-Réputation</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Vue client · Approbations · Rapports</div>
              </div>
            </Link>
          </div>

          {/* Main grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }}>
            {/* Left column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Signaux */}
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Zap size={15} color="#D97706" />
                    <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Top Signaux Business</h2>
                  </div>
                  <Link href="/signals"><button style={{ fontSize: 11, padding: '5px 12px', borderRadius: 20, border: '1px solid var(--card-border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 600 }}>Voir tout →</button></Link>
                </div>
                {(overview?.topSignals ?? []).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>Aucun signal détecté</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(overview?.topSignals ?? []).map(s => {
                      const c = SIGNAL_TYPE_COLORS[s.type] ?? SIGNAL_TYPE_COLORS.default;
                      return (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: 'var(--body-bg)', border: '1px solid var(--card-border)' }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{s.company}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.title}</div>
                          </div>
                          <div style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 20, background: c + '18', color: c }}>Score {s.score}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recent Wins + Plugin Activity */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <Trophy size={15} color="#D97706" />
                    <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Deals Gagnés</h2>
                  </div>
                  {(overview?.recentWins ?? []).length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>Aucun deal gagné récent</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(overview?.recentWins ?? []).map((w, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 10, background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#065F46' }}>{w.title}</div>
                            <div style={{ fontSize: 10, color: '#059669' }}>{w.company ?? '—'}</div>
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 900, color: '#059669' }}>{fmt(w.value)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <Activity size={15} color="#4F46E5" />
                    <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Activité Plugins</h2>
                  </div>
                  {(overview?.pluginActivity ?? []).length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>Aucune activité récente</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {(overview?.pluginActivity ?? []).slice(0, 5).map((a, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, padding: '7px 0', borderBottom: i < 4 ? '1px solid var(--card-border)' : 'none' }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4F46E5', flexShrink: 0 }} />
                          <div style={{ flex: 1, color: 'var(--text-primary)', fontWeight: 600 }}>{a.pluginName}</div>
                          <div style={{ color: 'var(--text-muted)' }}>{a.action}</div>
                          <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{timeAgo(a.createdAt)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right column — AI Assistant */}
            <div style={{ height: 560 }}>
              <AIAssistantChat />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
