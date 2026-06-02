import React, { useState } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Video, Plus, X, Loader2, CheckCircle2, Clock, AlertCircle,
  Mic, Trash2, ChevronRight, Zap, Brain,
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

/* ─── Types ──────────────────────────────────────────────── */
type MeetingStatus = 'pending' | 'processing' | 'completed' | 'error';

interface Meeting {
  id: string;
  title: string;
  status: MeetingStatus;
  transcript: string | null;
  summary: string | null;
  actionItems: { owner: string; task: string; deadline?: string }[];
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

/* ─── Status badge ───────────────────────────────────────── */
const STATUS_CFG: Record<MeetingStatus, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  pending:    { label: 'En attente',    icon: <Clock size={11} />,        color: '#D97706', bg: '#FFFBEB' },
  processing: { label: 'Traitement…',  icon: <Loader2 size={11} className="animate-spin" />, color: '#2563EB', bg: '#EFF6FF' },
  completed:  { label: 'Terminé',       icon: <CheckCircle2 size={11} />, color: '#059669', bg: '#ECFDF5' },
  error:      { label: 'Erreur',        icon: <AlertCircle size={11} />,  color: '#DC2626', bg: '#FEF2F2' },
};

function StatusBadge({ status }: { status: MeetingStatus }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.pending;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 9px', borderRadius: 9999, background: cfg.bg, color: cfg.color, fontWeight: 600, border: `1px solid ${cfg.color}33` }}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

/* ─── New Meeting Modal ──────────────────────────────────── */
function NewMeetingModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [fileName, setFileName] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: { title: string; simulatedFileName?: string }) =>
      apiClient.post('/meetings', data),
    onSuccess: () => {
      toast.success('Réunion créée — traitement IA en cours…');
      qc.invalidateQueries({ queryKey: ['meetings'] });
      onClose();
    },
    onError: () => toast.error('Échec de la création'),
  });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'relative', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: 28, width: 500, maxWidth: '95vw', boxShadow: '0 24px 64px rgba(0,0,0,.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#0F172A,#1E3A5F)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Video size={18} color="#fff" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>Nouvelle réunion</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Titre de la réunion</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="ex: Review Pipeline Q3 — Équipe Commerciale"
              autoFocus
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Fichier audio simulé (optionnel)</label>
            <div style={{ position: 'relative' }}>
              <Mic size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                value={fileName}
                onChange={e => setFileName(e.target.value)}
                placeholder="meeting-2026-06-02.mp4"
                style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>La transcription sera simulée automatiquement par l'IA mock.</p>
          </div>

          <div style={{ background: 'linear-gradient(135deg,#EDE9FE22,#DBEAFE22)', border: '1px solid #6D28D933', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <Brain size={14} color="#6D28D9" style={{ marginTop: 1, flexShrink: 0 }} />
            <p style={{ fontSize: 12, color: '#6D28D9', margin: 0, lineHeight: 1.5 }}>
              Le transcript sera automatiquement indexé dans <strong>Growth Memory</strong> après traitement.
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
            <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>Annuler</button>
            <button
              disabled={!title.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate({ title: title.trim(), simulatedFileName: fileName || undefined })}
              style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#0F172A,#1E3A5F)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: !title.trim() ? 0.5 : 1 }}>
              {createMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Video size={13} />}
              Créer et analyser
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Meeting row ────────────────────────────────────────── */
function MeetingRow({ meeting, onDelete }: { meeting: Meeting; onDelete: (id: string) => void }) {
  const fmt = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: meeting.status === 'completed' ? 'linear-gradient(135deg,#0F172A,#1E3A5F)' : 'var(--body-bg)', border: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Video size={18} color={meeting.status === 'completed' ? '#fff' : 'var(--text-muted)'} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meeting.title}</span>
          <StatusBadge status={meeting.status} />
          {meeting.status === 'completed' && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#6D28D9', fontWeight: 600 }}>
              <Brain size={10} />Mémorisé
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmt(meeting.createdAt)}</span>
          {meeting.status === 'completed' && meeting.actionItems?.length > 0 && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Zap size={10} />{meeting.actionItems.length} actions
            </span>
          )}
          {meeting.status === 'completed' && meeting.summary && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>
              {meeting.summary.slice(0, 80)}…
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button onClick={() => onDelete(meeting.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', opacity: 0.6 }}
          title="Supprimer">
          <Trash2 size={14} />
        </button>
        {meeting.status === 'completed' && (
          <Link href={`/meetings/${meeting.id}`}>
            <button style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>
              Voir <ChevronRight size={12} />
            </button>
          </Link>
        )}
      </div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────── */
export default function MeetingListPage() {
  const [showModal, setShowModal] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery<{ meetings: Meeting[]; total: number }>({
    queryKey: ['meetings'],
    queryFn: () => apiClient.get('/meetings'),
    refetchInterval: (query) => {
      const meetings = query.state.data?.meetings ?? [];
      const hasActive = meetings.some(m => m.status === 'pending' || m.status === 'processing');
      return hasActive ? 2000 : false;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/meetings/${id}`),
    onSuccess: () => {
      toast.success('Réunion supprimée');
      qc.invalidateQueries({ queryKey: ['meetings'] });
    },
    onError: () => toast.error('Échec de la suppression'),
  });

  const meetings = data?.meetings ?? [];
  const completedCount = meetings.filter(m => m.status === 'completed').length;
  const processingCount = meetings.filter(m => m.status === 'processing' || m.status === 'pending').length;

  return (
    <div style={{ padding: '24px 28px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#0F172A,#1E3A5F)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 14px rgba(15,23,42,.3)' }}>
            <Video size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>Meeting Intelligence</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '2px 0 0' }}>Transcription IA et extraction d'insights</p>
          </div>
        </div>
        <button onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#0F172A,#1E3A5F)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(15,23,42,.25)' }}>
          <Plus size={14} /> Nouvelle réunion
        </button>
      </div>

      {/* Stats */}
      {meetings.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Total',      value: meetings.length,  color: '#1E3A5F' },
            { label: 'Terminées',  value: completedCount,   color: '#059669' },
            { label: 'En cours',   value: processingCount,  color: '#2563EB' },
          ].map(stat => (
            <div key={stat.label} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '12px 16px' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '60px 0', color: 'var(--text-muted)' }}>
          <Loader2 size={20} className="animate-spin" />
          <span style={{ fontSize: 14 }}>Chargement des réunions…</span>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '60px 0' }}>
          <AlertCircle size={32} color="#DC2626" />
          <p style={{ fontSize: 14, color: '#DC2626', fontWeight: 600, margin: 0 }}>Impossible de charger les réunions</p>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && meetings.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: 'linear-gradient(135deg,#E2E8F0,#CBD5E1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Video size={30} color="#475569" />
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>Aucune réunion</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 20px' }}>Créez votre première réunion pour commencer l'analyse</p>
          <button onClick={() => setShowModal(true)}
            style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#0F172A,#1E3A5F)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={13} />Créer une réunion</span>
          </button>
        </div>
      )}

      {/* List */}
      {!isLoading && !isError && meetings.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {meetings.map(m => (
            <MeetingRow key={m.id} meeting={m} onDelete={id => deleteMutation.mutate(id)} />
          ))}
        </div>
      )}

      {showModal && <NewMeetingModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
