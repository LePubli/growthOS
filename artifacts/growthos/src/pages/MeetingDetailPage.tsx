import React from 'react';
import { Link, useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import {
  Video, ChevronLeft, CheckCircle2, Clock, Loader2, AlertCircle,
  Brain, Zap, FileText, User, Calendar,
} from 'lucide-react';
import apiClient from '@/lib/api-client';

/* ─── Types ──────────────────────────────────────────────── */
type MeetingStatus = 'pending' | 'processing' | 'completed' | 'error';

interface ActionItem {
  owner: string;
  task: string;
  deadline?: string;
}

interface Meeting {
  id: string;
  title: string;
  status: MeetingStatus;
  transcript: string | null;
  summary: string | null;
  actionItems: ActionItem[];
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

/* ─── Status banner ──────────────────────────────────────── */
function StatusBanner({ status }: { status: MeetingStatus }) {
  if (status === 'completed') return null;

  const cfg: Record<string, { icon: React.ReactNode; text: string; color: string; bg: string }> = {
    pending:    { icon: <Clock size={16} />,        text: 'En attente de traitement…',   color: '#D97706', bg: '#FFFBEB' },
    processing: { icon: <Loader2 size={16} className="animate-spin" />, text: 'Analyse IA en cours, merci de patienter…', color: '#2563EB', bg: '#EFF6FF' },
    error:      { icon: <AlertCircle size={16} />,  text: 'Erreur lors du traitement.',   color: '#DC2626', bg: '#FEF2F2' },
  };

  const c = cfg[status];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, background: c.bg, border: `1px solid ${c.color}33`, marginBottom: 24, color: c.color, fontWeight: 600, fontSize: 14 }}>
      {c.icon}{c.text}
    </div>
  );
}

/* ─── Section card ───────────────────────────────────────── */
function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--card-border)', background: 'var(--body-bg)' }}>
        {icon}
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{title}</span>
      </div>
      <div style={{ padding: '16px 18px' }}>{children}</div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────── */
export default function MeetingDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data: meeting, isLoading, isError } = useQuery<Meeting>({
    queryKey: ['meeting', id],
    queryFn: () => apiClient.get(`/meetings/${id}`),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'pending' || status === 'processing' ? 2000 : false;
    },
    enabled: !!id,
  });

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12, color: 'var(--text-muted)' }}>
        <Loader2 size={22} className="animate-spin" />
        <span style={{ fontSize: 15 }}>Chargement…</span>
      </div>
    );
  }

  if (isError || !meeting) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 14 }}>
        <AlertCircle size={36} color="#DC2626" />
        <p style={{ fontSize: 15, color: '#DC2626', fontWeight: 600, margin: 0 }}>Réunion introuvable</p>
        <Link href="/meetings"><a style={{ fontSize: 13, color: 'var(--text-muted)' }}>← Retour aux réunions</a></Link>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 860, margin: '0 auto' }}>
      {/* Back */}
      <Link href="/meetings">
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: '0 0 16px', fontFamily: 'inherit' }}>
          <ChevronLeft size={14} />Retour aux réunions
        </button>
      </Link>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg,#0F172A,#1E3A5F)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 14px rgba(15,23,42,.3)' }}>
          <Video size={22} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px', lineHeight: 1.2 }}>{meeting.title}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)' }}>
              <Calendar size={11} />{fmt(meeting.createdAt)}
            </span>
            {meeting.status === 'completed' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 8px', borderRadius: 9999, background: '#ECFDF5', color: '#059669', fontWeight: 600, border: '1px solid #05996933' }}>
                <CheckCircle2 size={10} />Terminé
              </span>
            )}
            {meeting.status === 'completed' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 8px', borderRadius: 9999, background: '#F5F3FF', color: '#6D28D9', fontWeight: 600, border: '1px solid #6D28D933' }}>
                <Brain size={10} />Indexé dans Growth Memory
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Status banner for non-completed */}
      <StatusBanner status={meeting.status} />

      {/* Content — only when completed */}
      {meeting.status === 'completed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Summary */}
          {meeting.summary && (
            <SectionCard icon={<Zap size={16} color="#D97706" />} title="Résumé exécutif">
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>{meeting.summary}</p>
            </SectionCard>
          )}

          {/* Action Items */}
          {meeting.actionItems?.length > 0 && (
            <SectionCard icon={<CheckCircle2 size={16} color="#059669" />} title={`Actions à suivre (${meeting.actionItems.length})`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {meeting.actionItems.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 12px', borderRadius: 10, background: 'var(--body-bg)', border: '1px solid var(--card-border)' }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: '#ECFDF5', border: '1px solid #05996933', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <CheckCircle2 size={12} color="#059669" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>{item.task}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                          <User size={10} />{item.owner}
                        </span>
                        {item.deadline && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#D97706' }}>
                            <Calendar size={10} />{item.deadline}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Transcript */}
          {meeting.transcript && (
            <SectionCard icon={<FileText size={16} color="#6B7280" />} title="Transcript complet">
              <pre style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, monospace', background: 'var(--body-bg)', padding: 14, borderRadius: 8, border: '1px solid var(--card-border)', maxHeight: 400, overflowY: 'auto' }}>
                {meeting.transcript}
              </pre>
            </SectionCard>
          )}

          {/* Memory indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderRadius: 12, background: 'linear-gradient(135deg,#F5F3FF,#EDE9FE)', border: '1px solid #6D28D933' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#6D28D9,#4F46E5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Brain size={16} color="#fff" />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#4C1D95', margin: '0 0 2px' }}>Transcript mémorisé</p>
              <p style={{ fontSize: 12, color: '#6D28D9', margin: 0 }}>Ce transcript est maintenant searchable dans Growth Memory avec la source <code style={{ fontFamily: 'monospace', background: '#EDE9FE', padding: '1px 5px', borderRadius: 4 }}>meeting</code>.</p>
            </div>
            <Link href="/memory" style={{ marginLeft: 'auto', flexShrink: 0 }}>
              <button style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #6D28D933', background: 'white', color: '#6D28D9', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Voir dans Memory →
              </button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
