import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Megaphone, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, ExternalLink, Loader2 } from 'lucide-react';
import apiClient from '@/lib/api-client';

interface Campaign {
  id: string;
  name: string;
  targetName: string;
  targetUrl: string | null;
  targetType: string;
  keywords: string[];
  status: string;
  reputationScore: number;
  activeAlerts: number;
  totalPosts: number;
  publishedPosts: number;
  createdAt: string;
  updatedAt: string;
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? '#059669' : score >= 40 ? '#D97706' : '#DC2626';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 4, background: 'var(--card-border)' }}>
        <div style={{ height: 6, borderRadius: 4, width: `${score}%`, background: color, transition: 'width 0.5s' }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 900, color, minWidth: 40, textAlign: 'right' }}>{score}/100</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string }> = {
    active: { bg: '#F0FDF4', color: '#059669' },
    paused: { bg: '#FEF3C7', color: '#D97706' },
    archived: { bg: '#F3F4F6', color: '#6B7280' },
  };
  const { bg, color } = cfg[status] ?? cfg.archived;
  return (
    <span style={{ padding: '3px 10px', borderRadius: 20, background: bg, color, fontSize: 11, fontWeight: 700 }}>
      {status === 'active' ? 'Active' : status === 'paused' ? 'En pause' : 'Archivée'}
    </span>
  );
}

export default function ClientCampaignsPage() {
  const { data: campaigns = [], isLoading, error } = useQuery<Campaign[]>({
    queryKey: ['client-erep-campaigns'],
    queryFn: () => apiClient.get('/client/ereputation/campaigns'),
    refetchInterval: 30000,
  });

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <Loader2 size={28} color="#7C3AED" style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  );

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Mes campagnes E-Réputation</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            {campaigns.length} campagne{campaigns.length > 1 ? 's' : ''} · suivi de votre réputation en ligne
          </p>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
          <Megaphone size={40} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Aucune campagne active</div>
          <div style={{ fontSize: 13 }}>Votre gestionnaire va créer vos premières campagnes sous peu.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {campaigns.map(c => {
            const scoreColor = c.reputationScore >= 70 ? '#059669' : c.reputationScore >= 40 ? '#D97706' : '#DC2626';
            return (
              <div key={c.id} style={{
                background: 'var(--card-bg)',
                border: '1.5px solid var(--card-border)',
                borderRadius: 16,
                padding: '20px 24px',
                transition: 'all 0.15s',
              }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = '#7C3AED')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--card-border)')}>

                {/* Top row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#7C3AED,#A855F7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Megaphone size={15} color="#fff" />
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{c.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          Cible : {c.targetName}
                          {c.targetUrl && (
                            <a href={c.targetUrl} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 6, color: '#7C3AED' }}>
                              <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <StatusBadge status={c.status} />
                    {c.reputationScore >= 50 ? <TrendingUp size={16} color="#059669" /> : <TrendingDown size={16} color="#DC2626" />}
                  </div>
                </div>

                {/* Score bar */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Score de réputation</div>
                  <ScoreBar score={c.reputationScore} />
                </div>

                {/* Stats + Keywords */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ display: 'flex', items: 'center', gap: 6 }}>
                    {c.activeAlerts > 0 ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#DC2626', fontWeight: 700 }}>
                        <AlertTriangle size={13} /> {c.activeAlerts} alerte{c.activeAlerts > 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#059669', fontWeight: 600 }}>
                        <CheckCircle size={13} /> Aucune alerte
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.publishedPosts}/{c.totalPosts} posts publiés</div>
                  {(c.keywords as any[]).slice(0, 3).map((kw: string) => (
                    <span key={kw} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#EDE9FE', color: '#7C3AED', fontWeight: 600 }}>{kw}</span>
                  ))}
                  {(c.keywords as any[]).length > 3 && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{(c.keywords as any[]).length - 3}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
