import React, { useState } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Radar, DollarSign, Users, Newspaper, Cpu, UserCheck,
  Loader2, RefreshCw, Filter, CheckCircle, Eye, Zap,
  Flame, Thermometer, Wind, Building, ChevronRight, X, Bot,
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

/* ─── Types ──────────────────────────────────────────────── */
type SignalType = 'funding' | 'hiring' | 'news' | 'tech_change' | 'leadership_change';
type SignalStatus = 'new' | 'read' | 'actioned';

interface Signal {
  id: string;
  type: SignalType;
  company: string;
  title: string;
  description: string | null;
  score: number;
  status: SignalStatus;
  isRead: boolean;
  isStarred: boolean;
  detectedAt: string;
  createdAt: string;
}

/* ─── Config ─────────────────────────────────────────────── */
const TYPE_CONFIG: Record<SignalType, { label: string; color: string; bg: string; icon: React.ReactNode; emoji: string }> = {
  funding:           { label: 'Financement',         color: '#059669', bg: '#ECFDF5', icon: <DollarSign size={14} />, emoji: '💰' },
  hiring:            { label: 'Recrutement',          color: '#2563EB', bg: '#EFF6FF', icon: <Users size={14} />,      emoji: '💼' },
  news:              { label: 'Actualité',            color: '#7C3AED', bg: '#F5F3FF', icon: <Newspaper size={14} />,  emoji: '📰' },
  tech_change:       { label: 'Changement Tech',      color: '#D97706', bg: '#FFFBEB', icon: <Cpu size={14} />,        emoji: '⚙️' },
  leadership_change: { label: 'Changement Direction', color: '#DC2626', bg: '#FEF2F2', icon: <UserCheck size={14} />,  emoji: '🧑‍💼' },
};

function impactLabel(score: number): { text: string; color: string; bg: string; icon: React.ReactNode } {
  if (score >= 85) return { text: 'Hot',  color: '#DC2626', bg: '#FEF2F2', icon: <Flame size={11} /> };
  if (score >= 65) return { text: 'Warm', color: '#D97706', bg: '#FFFBEB', icon: <Thermometer size={11} /> };
  return               { text: 'Low',  color: '#6B7280', bg: '#F3F4F6', icon: <Wind size={11} /> };
}

function fmt(iso: string) {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60000)  return 'à l\'instant';
  if (diff < 3600000) return `il y a ${Math.round(diff / 60000)} min`;
  if (diff < 86400000) return `il y a ${Math.round(diff / 3600000)}h`;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

/* ─── Signal Card ────────────────────────────────────────── */
function SignalCard({ signal, onStatusChange }: { signal: Signal; onStatusChange: (id: string, status: SignalStatus) => void }) {
  const [expanded, setExpanded] = useState(false);
  const tc = TYPE_CONFIG[signal.type] ?? TYPE_CONFIG.news;
  const il = impactLabel(signal.score);
  const isNew = signal.status === 'new';

  return (
    <div style={{
      background: 'var(--card-bg)',
      border: `1px solid ${isNew ? tc.color + '44' : 'var(--card-border)'}`,
      borderRadius: 14,
      overflow: 'hidden',
      transition: 'all 0.15s',
      opacity: signal.status === 'actioned' ? 0.65 : 1,
    }}>
      <div style={{ padding: '14px 16px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          {/* Type icon */}
          <div style={{ width: 38, height: 38, borderRadius: 10, background: tc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: tc.color }}>
            {tc.icon}
          </div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              {isNew && (
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: tc.color, display: 'inline-block', flexShrink: 0 }} />
              )}
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>{signal.title}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {/* Company */}
              <Link href={`/accounts/${encodeURIComponent(signal.company)}`}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#2563EB', fontWeight: 600, cursor: 'pointer' }}>
                  <Building size={10} />{signal.company}
                </span>
              </Link>

              {/* Type badge */}
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 9999, background: tc.bg, color: tc.color }}>
                {tc.emoji} {tc.label}
              </span>

              {/* Impact badge */}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 9999, background: il.bg, color: il.color }}>
                {il.icon} {il.text} · {signal.score}
              </span>

              {/* Time */}
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{fmt(signal.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Expandable description */}
        {signal.description && (
          <div style={{ marginTop: 10, marginLeft: 50 }}>
            <button
              onClick={() => setExpanded(e => !e)}
              style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
            >
              {expanded ? 'Réduire ▲' : 'Voir détails ▼'}
            </button>
            {expanded && (
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '6px 0 0', padding: '10px 12px', background: 'var(--body-bg)', borderRadius: 8, border: '1px solid var(--card-border)' }}>
                {signal.description}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, marginLeft: 50 }}>
          {signal.status === 'new' && (
            <button
              onClick={() => onStatusChange(signal.id, 'read')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <Eye size={11} />Marquer lu
            </button>
          )}
          {signal.status !== 'actioned' && (
            <button
              onClick={() => onStatusChange(signal.id, 'actioned')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 8, border: `1px solid ${tc.color}44`, background: tc.bg, color: tc.color, cursor: 'pointer' }}
            >
              <CheckCircle size={11} />Actionné
            </button>
          )}
          <Link href={`/accounts/${encodeURIComponent(signal.company)}`}>
            <button style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 8, border: '1px solid #2563EB44', background: '#EFF6FF', color: '#2563EB', cursor: 'pointer' }}>
              <ChevronRight size={11} />Vue 360°
            </button>
          </Link>
          <Link href={`/ai-sdr?account=${encodeURIComponent(signal.company)}&goal=${encodeURIComponent('book a demo meeting')}`}>
            <button style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 8, border: '1px solid #7C3AED44', background: '#F5F3FF', color: '#7C3AED', cursor: 'pointer' }}>
              <Bot size={11} />Rédiger draft
            </button>
          </Link>
          {signal.status === 'actioned' && (
            <span style={{ fontSize: 11, color: '#059669', display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle size={11} />Actionné
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Filter bar ─────────────────────────────────────────── */
function FilterBar({ type, onType, status, onStatus, minScore, onMinScore }: {
  type: string; onType: (t: string) => void;
  status: string; onStatus: (s: string) => void;
  minScore: number; onMinScore: (n: number) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <Filter size={14} color="var(--text-muted)" />

      {/* Type filter */}
      <select
        value={type}
        onChange={e => onType(e.target.value)}
        style={{ fontSize: 12, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', cursor: 'pointer' }}
      >
        <option value="">Tous les types</option>
        {Object.entries(TYPE_CONFIG).map(([k, v]) => (
          <option key={k} value={k}>{v.emoji} {v.label}</option>
        ))}
      </select>

      {/* Status filter */}
      <select
        value={status}
        onChange={e => onStatus(e.target.value)}
        style={{ fontSize: 12, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', cursor: 'pointer' }}
      >
        <option value="">Tous statuts</option>
        <option value="new">Nouveaux</option>
        <option value="read">Lus</option>
        <option value="actioned">Actionnés</option>
      </select>

      {/* Min score */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Impact min :</span>
        <input
          type="range" min={0} max={100} step={5} value={minScore}
          onChange={e => onMinScore(Number(e.target.value))}
          style={{ width: 80, accentColor: 'var(--color-primary)' }}
        />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', minWidth: 28 }}>{minScore}</span>
      </div>

      {(type || status || minScore > 0) && (
        <button
          onClick={() => { onType(''); onStatus(''); onMinScore(0); }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <X size={11} />Réinitialiser
        </button>
      )}
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────── */
export default function SignalFeedPage() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [minScore, setMinScore] = useState(0);
  const [generating, setGenerating] = useState(false);

  const params = new URLSearchParams();
  if (typeFilter)  params.set('type', typeFilter);
  if (statusFilter) params.set('status', statusFilter);
  if (minScore > 0) params.set('minScore', String(minScore));

  const { data: signals = [], isLoading } = useQuery<Signal[]>({
    queryKey: ['signals', typeFilter, statusFilter, minScore],
    queryFn: () => apiClient.get(`/signals${params.toString() ? `?${params}` : ''}`),
    refetchInterval: 15000,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: SignalStatus }) =>
      apiClient.patch(`/signals/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['signals'] }),
  });

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result: any = await apiClient.post('/signals/generate', {});
      const count = result?.generated ?? result?.length ?? 0;
      toast.success(`${count} signal(s) généré(s) — EventBus notifié`);
      queryClient.invalidateQueries({ queryKey: ['signals'] });
    } catch {
      toast.error('Erreur lors de la génération');
    } finally {
      setGenerating(false);
    }
  };

  const newCount     = signals.filter(s => s.status === 'new').length;
  const hotCount     = signals.filter(s => s.score >= 85).length;
  const actionedCount = signals.filter(s => s.status === 'actioned').length;

  const filtered = signals.filter(s => {
    if (typeFilter && s.type !== typeFilter) return false;
    if (statusFilter && s.status !== statusFilter) return false;
    if (s.score < minScore) return false;
    return true;
  });

  return (
    <div style={{ padding: '24px 28px', maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 24 }}>
        <div style={{ width: 50, height: 50, borderRadius: 14, background: 'linear-gradient(135deg,#0F172A,#1E3A5F)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Radar size={24} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 4px' }}>Signal Intelligence</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Radar business en temps réel — financement, recrutement, actualités, changements tech & direction</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#0F172A,#1E3A5F)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer', opacity: generating ? 0.7 : 1 }}
        >
          <RefreshCw size={14} style={{ animation: generating ? 'spin 1s linear infinite' : 'none' }} />
          {generating ? 'Génération…' : 'Générer Signaux Mock'}
        </button>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total signaux',  value: signals.length, color: '#6B7280', bg: '#F9FAFB', icon: <Zap size={15} /> },
          { label: 'Nouveaux',       value: newCount,       color: '#2563EB', bg: '#EFF6FF', icon: <Zap size={15} /> },
          { label: 'Hot (≥85)',      value: hotCount,       color: '#DC2626', bg: '#FEF2F2', icon: <Flame size={15} /> },
          { label: 'Actionnés',      value: actionedCount,  color: '#059669', bg: '#ECFDF5', icon: <CheckCircle size={15} /> },
        ].map(m => (
          <div key={m.label} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: m.bg, color: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {m.icon}
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{m.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* EventBus indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'linear-gradient(135deg,#ECFDF5,#F0FDF4)', border: '1px solid #05996933', marginBottom: 20 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669', boxShadow: '0 0 0 3px #05996933', animation: 'pulse 2s infinite' }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: '#059669' }}>EventBus actif</span>
        <span style={{ fontSize: 12, color: '#059669', opacity: 0.8 }}>— Chaque signal déclenche <code style={{ background: '#DCFCE7', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>signal.received</code> vers Workflow AI</span>
      </div>

      {/* Filters */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
        <FilterBar
          type={typeFilter} onType={setTypeFilter}
          status={statusFilter} onStatus={setStatusFilter}
          minScore={minScore} onMinScore={setMinScore}
        />
      </div>

      {/* Feed */}
      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh', gap: 12, color: 'var(--text-muted)' }}>
          <Loader2 size={20} className="animate-spin" />
          <span>Chargement des signaux…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <Radar size={48} color="var(--card-border)" style={{ margin: '0 auto 16px' }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Aucun signal détecté</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Cliquez sur "Générer Signaux Mock" pour simuler des signaux business.</p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{ padding: '10px 20px', borderRadius: 12, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            {generating ? 'Génération…' : '⚡ Générer maintenant'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
            {filtered.length} signal{filtered.length > 1 ? 's' : ''} affiché{filtered.length > 1 ? 's' : ''}
            {filtered.length < signals.length ? ` (sur ${signals.length} total)` : ''}
          </div>
          {filtered.map(signal => (
            <SignalCard
              key={signal.id}
              signal={signal}
              onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
