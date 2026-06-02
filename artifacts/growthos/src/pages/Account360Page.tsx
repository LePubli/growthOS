import React, { useState } from 'react';
import { Link, useParams } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building, ChevronLeft, Loader2, AlertCircle, Video,
  Brain, User, RefreshCw, Activity, TrendingUp, Users,
  Calendar, Zap, Star, Clock,
} from 'lucide-react';
import apiClient from '@/lib/api-client';

/* ─── Types ──────────────────────────────────────────────── */
interface ScoreBreakdown {
  prospectsCount: number;
  prospectsScore: number;
  meetingsCount: number;
  meetingsScore: number;
  memorySignalsCount: number;
  memoryScore: number;
  recencyScore: number;
  total: number;
}

interface AccountMetrics {
  accountId: string;
  healthScore: number;
  engagementLevel: 'low' | 'medium' | 'high' | 'very_high';
  lastActivityAt: string | null;
  scoreBreakdown: ScoreBreakdown;
  updatedAt: string;
}

interface TimelineEvent {
  id: string;
  type: 'meeting' | 'memory' | 'prospect' | 'activity';
  title: string;
  description: string | null;
  date: string;
  icon: string;
}

interface Account360 {
  accountId: string;
  name: string;
  domain: string;
  contacts: { name: string; email: string; role: string }[];
  metrics: AccountMetrics;
  timeline: TimelineEvent[];
  recentMeetings: { id: string; title: string; status: string; createdAt: string; summary: string | null }[];
  memorySignals: { id: string; content: string; sourceType: string; createdAt: string }[];
}

/* ─── Health Score Gauge ─────────────────────────────────── */
function HealthGauge({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s >= 75) return { main: '#059669', bg: '#ECFDF5', border: '#059669', label: 'Excellent', labelColor: '#059669' };
    if (s >= 50) return { main: '#2563EB', bg: '#EFF6FF', border: '#2563EB', label: 'Bon', labelColor: '#2563EB' };
    if (s >= 25) return { main: '#D97706', bg: '#FFFBEB', border: '#D97706', label: 'Modéré', labelColor: '#D97706' };
    return { main: '#DC2626', bg: '#FEF2F2', border: '#DC2626', label: 'Faible', labelColor: '#DC2626' };
  };
  const c = getColor(score);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ position: 'relative', width: 148, height: 148 }}>
        <svg width="148" height="148" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="74" cy="74" r={radius} fill="none" stroke="var(--card-border)" strokeWidth="10" />
          <circle
            cx="74" cy="74" r={radius}
            fill="none"
            stroke={c.main}
            strokeWidth="10"
            strokeDasharray={`${progress} ${circumference}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.8s ease' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 36, fontWeight: 900, color: c.main, lineHeight: 1 }}>{score}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>/100</span>
        </div>
      </div>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700, padding: '4px 12px', borderRadius: 9999, background: c.bg, color: c.labelColor, border: `1px solid ${c.border}33` }}>
        <Star size={11} />{c.label}
      </span>
    </div>
  );
}

/* ─── Metric Pill ────────────────────────────────────────── */
function MetricPill({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: 'var(--body-bg)', border: '1px solid var(--card-border)' }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{value}</div>
      </div>
    </div>
  );
}

/* ─── Score Bar ──────────────────────────────────────────── */
function ScoreBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{value}/{max}</span>
      </div>
      <div style={{ height: 6, borderRadius: 9999, background: 'var(--card-border)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 9999, background: color, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}

/* ─── Section Card ───────────────────────────────────────── */
function SectionCard({ icon, title, children, extra }: { icon: React.ReactNode; title: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--card-border)', background: 'var(--body-bg)' }}>
        {icon}
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', flex: 1 }}>{title}</span>
        {extra}
      </div>
      <div style={{ padding: '16px 18px' }}>{children}</div>
    </div>
  );
}

/* ─── Timeline Item ──────────────────────────────────────── */
function TimelineItem({ event }: { event: TimelineEvent }) {
  const cfg: Record<string, { color: string; bg: string; Icon: React.ComponentType<any> }> = {
    meeting:  { color: '#2563EB', bg: '#EFF6FF', Icon: Video },
    memory:   { color: '#6D28D9', bg: '#F5F3FF', Icon: Brain },
    prospect: { color: '#059669', bg: '#ECFDF5', Icon: User },
    activity: { color: '#D97706', bg: '#FFFBEB', Icon: Activity },
  };
  const c = cfg[event.type] ?? cfg.activity;
  const Icon = c.Icon;
  const fmt = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ width: 32, height: 32, borderRadius: 9999, background: c.bg, border: `2px solid ${c.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: c.color }}>
        <Icon size={14} />
      </div>
      <div style={{ flex: 1, paddingBottom: 14, borderBottom: '1px solid var(--card-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{event.title}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{fmt(event.date)}</span>
        </div>
        {event.description && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0', lineHeight: 1.5 }}>{event.description}</p>
        )}
      </div>
    </div>
  );
}

/* ─── Engagement Badge ───────────────────────────────────── */
function EngagementBadge({ level }: { level: string }) {
  const cfg: Record<string, { label: string; color: string; bg: string }> = {
    very_high: { label: 'Très engagé', color: '#059669', bg: '#ECFDF5' },
    high:      { label: 'Engagé',      color: '#2563EB', bg: '#EFF6FF' },
    medium:    { label: 'Modéré',      color: '#D97706', bg: '#FFFBEB' },
    low:       { label: 'Faible',      color: '#6B7280', bg: '#F9FAFB' },
  };
  const c = cfg[level] ?? cfg.low;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 9999, background: c.bg, color: c.color, border: `1px solid ${c.color}33` }}>
      <Zap size={10} />{c.label}
    </span>
  );
}

/* ─── Main page ──────────────────────────────────────────── */
export default function Account360Page() {
  const params = useParams<{ accountId: string }>();
  const accountId = decodeURIComponent(params.accountId ?? '');
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError } = useQuery<Account360>({
    queryKey: ['account360', accountId],
    queryFn: () => apiClient.get(`/accounts/${encodeURIComponent(accountId)}/360`),
    enabled: !!accountId,
  });

  const refreshMutation = useMutation({
    mutationFn: () => apiClient.post(`/accounts/${encodeURIComponent(accountId)}/refresh`, {}),
    onMutate: () => setRefreshing(true),
    onSettled: () => {
      setRefreshing(false);
      queryClient.invalidateQueries({ queryKey: ['account360', accountId] });
    },
  });

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12, color: 'var(--text-muted)' }}>
        <Loader2 size={22} className="animate-spin" />
        <span style={{ fontSize: 15 }}>Chargement du compte…</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 14 }}>
        <AlertCircle size={36} color="#DC2626" />
        <p style={{ fontSize: 15, color: '#DC2626', fontWeight: 600, margin: 0 }}>Compte introuvable</p>
        <Link href="/accounts"><a style={{ fontSize: 13, color: 'var(--text-muted)' }}>← Retour aux comptes</a></Link>
      </div>
    );
  }

  const bd = data.metrics.scoreBreakdown;

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1000, margin: '0 auto' }}>
      {/* Back */}
      <Link href="/accounts">
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: '0 0 16px', fontFamily: 'inherit' }}>
          <ChevronLeft size={14} />Retour aux comptes
        </button>
      </Link>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 28 }}>
        <div style={{ width: 54, height: 54, borderRadius: 14, background: 'linear-gradient(135deg,#0F172A,#1E3A5F)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 14px rgba(15,23,42,.3)' }}>
          <Building size={24} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>{data.name}</h1>
            <EngagementBadge level={data.metrics.engagementLevel} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            {data.domain && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>🌐 {data.domain}</span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
              <Clock size={11} />Dernière activité : {fmt(data.metrics.lastActivityAt)}
            </span>
          </div>
        </div>
        <button
          onClick={() => refreshMutation.mutate()}
          disabled={refreshing}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: refreshing ? 'not-allowed' : 'pointer', opacity: refreshing ? 0.7 : 1, fontFamily: 'inherit' }}
        >
          <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          {refreshing ? 'Calcul…' : 'Recalculer'}
        </button>
      </div>

      {/* Top grid: gauge + breakdown + metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Health Score Gauge */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Health Score</span>
          <HealthGauge score={data.metrics.healthScore} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Mis à jour {fmt(data.metrics.updatedAt)}</span>
        </div>

        {/* Score breakdown */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '18px 20px' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 14 }}>Décomposition du score</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ScoreBar label="Prospects & contacts" value={bd.prospectsScore} max={30} color="#059669" />
            <ScoreBar label="Réunions" value={bd.meetingsScore} max={25} color="#2563EB" />
            <ScoreBar label="Signaux mémoire" value={bd.memoryScore} max={20} color="#6D28D9" />
            <ScoreBar label="Récence d'activité" value={bd.recencyScore} max={25} color="#D97706" />
          </div>
        </div>

        {/* Key metrics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <MetricPill icon={<Users size={15} />} label="Contacts" value={bd.prospectsCount} color="#059669" />
          <MetricPill icon={<Video size={15} />} label="Réunions" value={bd.meetingsCount} color="#2563EB" />
          <MetricPill icon={<Brain size={15} />} label="Signaux mémoire" value={bd.memorySignalsCount} color="#6D28D9" />
          <MetricPill icon={<TrendingUp size={15} />} label="Score global" value={`${data.metrics.healthScore}/100`} color="#D97706" />
        </div>
      </div>

      {/* Main content: timeline + right column */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
        {/* Timeline */}
        <SectionCard icon={<Activity size={16} color="#6B7280" />} title={`Timeline (${data.timeline.length} événements)`}>
          {data.timeline.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0', margin: 0 }}>
              Aucun événement trouvé pour ce compte.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {data.timeline.map((event) => (
                <TimelineItem key={event.id} event={event} />
              ))}
            </div>
          )}
        </SectionCard>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Contacts */}
          <SectionCard icon={<Users size={15} color="#059669" />} title={`Contacts (${data.contacts.length})`}>
            {data.contacts.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Aucun contact</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.contacts.slice(0, 6).map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 9999, background: 'linear-gradient(135deg,#0F172A,#1E3A5F)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{(c.name[0] || '?').toUpperCase()}</span>
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.role || c.email}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Recent Meetings */}
          <SectionCard icon={<Video size={15} color="#2563EB" />} title={`Réunions récentes (${data.recentMeetings.length})`}>
            {data.recentMeetings.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Aucune réunion associée</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.recentMeetings.map((m) => (
                  <Link key={m.id} href={`/meetings/${m.id}`}>
                    <div style={{ padding: '8px 10px', borderRadius: 9, border: '1px solid var(--card-border)', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</span>
                        <span style={{ fontSize: 10, color: m.status === 'completed' ? '#059669' : '#D97706', fontWeight: 600, flexShrink: 0 }}>
                          {m.status === 'completed' ? '✓' : '⏳'}
                        </span>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {new Date(m.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Memory Signals */}
          <SectionCard icon={<Brain size={15} color="#6D28D9" />} title={`Signaux mémoire (${data.memorySignals.length})`}>
            {data.memorySignals.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Aucun signal mémoire</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.memorySignals.slice(0, 4).map((s) => (
                  <div key={s.id} style={{ padding: '8px 10px', borderRadius: 9, background: '#F5F3FF', border: '1px solid #6D28D933' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#6D28D9', background: '#EDE9FE', padding: '1px 6px', borderRadius: 4 }}>{s.sourceType}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {new Date(s.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: '#4C1D95', margin: 0, lineHeight: 1.5 }}>{s.content}</p>
                  </div>
                ))}
                {data.memorySignals.length > 4 && (
                  <Link href="/memory">
                    <button style={{ width: '100%', padding: '6px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'transparent', color: '#6D28D9', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      Voir tout dans Memory →
                    </button>
                  </Link>
                )}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
