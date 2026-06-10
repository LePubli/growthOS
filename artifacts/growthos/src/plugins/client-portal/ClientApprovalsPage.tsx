import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, Clock, Loader2, MessageSquare, Filter } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

interface Approval {
  id: string;
  status: string;
  reviewerNote: string | null;
  campaignName: string;
  targetName: string;
  post: {
    platform: string;
    contentText: string;
    scheduledAt: string | null;
    publishedAt: string | null;
  };
  submittedByEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

const PLATFORM_COLORS: Record<string, string> = {
  linkedin: '#0A66C2',
  twitter: '#1DA1F2',
  instagram: '#E1306C',
  facebook: '#1877F2',
  default: '#6B7280',
};

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  twitter: 'Twitter/X',
  instagram: 'Instagram',
  facebook: 'Facebook',
  default: 'Réseau social',
};

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string; icon: React.ReactNode; label: string }> = {
    pending_approval: { bg: '#FEF3C7', color: '#D97706', icon: <Clock size={11} />, label: 'En attente' },
    approved: { bg: '#F0FDF4', color: '#059669', icon: <CheckCircle size={11} />, label: 'Approuvé' },
    rejected: { bg: '#FEF2F2', color: '#DC2626', icon: <XCircle size={11} />, label: 'Refusé' },
    scheduled: { bg: '#EDE9FE', color: '#7C3AED', icon: <Clock size={11} />, label: 'Planifié' },
  };
  const { bg, color, icon, label } = cfg[status] ?? cfg.pending_approval;
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, background: bg, color, fontSize: 11, fontWeight: 700 }}>
      {icon}{label}
    </span>
  );
}

function ApprovalCard({ approval, onApprove, onReject, isLoading }: {
  approval: Approval;
  onApprove: (id: string, note?: string) => void;
  onReject: (id: string, note?: string) => void;
  isLoading: boolean;
}) {
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const platformColor = PLATFORM_COLORS[approval.post.platform] ?? PLATFORM_COLORS.default;
  const platformLabel = PLATFORM_LABELS[approval.post.platform] ?? approval.post.platform;
  const isPending = approval.status === 'pending_approval';

  return (
    <div style={{ background: 'var(--card-bg)', border: '1.5px solid var(--card-border)', borderRadius: 16, overflow: 'hidden', transition: 'all 0.15s' }}>
      {/* Platform header */}
      <div style={{ padding: '12px 20px', background: platformColor + '18', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: platformColor }}>📢 {platformLabel}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>— {approval.campaignName}</span>
        </div>
        <StatusBadge status={approval.status} />
      </div>

      {/* Content */}
      <div style={{ padding: '16px 20px' }}>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7, marginBottom: 14, whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {approval.post.contentText}
        </div>

        {/* Meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: isPending ? 14 : 0 }}>
          {approval.post.scheduledAt && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              📅 Planifié : {new Date(approval.post.scheduledAt).toLocaleDateString('fr-FR')}
            </span>
          )}
          {approval.submittedByEmail && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Par : {approval.submittedByEmail}</span>
          )}
        </div>

        {/* Reviewer note */}
        {approval.reviewerNote && (
          <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: '#F9FAFB', border: '1px solid var(--card-border)', fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
            <MessageSquare size={11} style={{ marginRight: 6 }} />
            Note : {approval.reviewerNote}
          </div>
        )}

        {/* Actions */}
        {isPending && (
          <div style={{ marginTop: 14 }}>
            {showNote ? (
              <div>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Note optionnelle pour l'équipe..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 12, resize: 'vertical', minHeight: 60, boxSizing: 'border-box', marginBottom: 10, outline: 'none' }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => { onApprove(approval.id, note); setShowNote(false); }}
                    disabled={isLoading}
                    style={{ flex: 1, padding: '9px 0', borderRadius: 10, background: 'linear-gradient(135deg,#059669,#10B981)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <CheckCircle size={13} /> Approuver
                  </button>
                  <button
                    onClick={() => { onReject(approval.id, note); setShowNote(false); }}
                    disabled={isLoading}
                    style={{ flex: 1, padding: '9px 0', borderRadius: 10, background: 'linear-gradient(135deg,#DC2626,#EF4444)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <XCircle size={13} /> Refuser
                  </button>
                  <button onClick={() => setShowNote(false)} style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => onApprove(approval.id)}
                  disabled={isLoading}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 10, background: '#F0FDF4', border: '1.5px solid #BBF7D0', color: '#059669', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <CheckCircle size={13} /> Approuver
                </button>
                <button
                  onClick={() => onReject(approval.id)}
                  disabled={isLoading}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 10, background: '#FEF2F2', border: '1.5px solid #FECACA', color: '#DC2626', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <XCircle size={13} /> Refuser
                </button>
                <button
                  onClick={() => setShowNote(true)}
                  style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
                  <MessageSquare size={13} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClientApprovalsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('pending_approval');

  const { data: approvals = [], isLoading } = useQuery<Approval[]>({
    queryKey: ['client-erep-approvals', statusFilter],
    queryFn: () => apiClient.get(`/client/ereputation/approvals?status=${statusFilter}`),
    refetchInterval: 15000,
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      apiClient.post(`/client/ereputation/approvals/${id}/approve`, { note }),
    onSuccess: () => {
      toast.success('Contenu approuvé et planifié ✓');
      qc.invalidateQueries({ queryKey: ['client-erep-approvals'] });
      qc.invalidateQueries({ queryKey: ['client-erep-dashboard'] });
    },
    onError: () => toast.error('Erreur lors de l\'approbation'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      apiClient.post(`/client/ereputation/approvals/${id}/reject`, { note }),
    onSuccess: () => {
      toast.info('Contenu refusé — l\'équipe sera notifiée');
      qc.invalidateQueries({ queryKey: ['client-erep-approvals'] });
    },
    onError: () => toast.error('Erreur lors du refus'),
  });

  const isActing = approveMutation.isPending || rejectMutation.isPending;

  const FILTERS = [
    { value: 'pending_approval', label: 'En attente' },
    { value: 'approved', label: 'Approuvés' },
    { value: 'rejected', label: 'Refusés' },
    { value: 'all', label: 'Tous' },
  ];

  return (
    <div style={{ padding: '32px 36px', maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Approbations de contenu</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
          Validez ou refusez les contenus soumis par votre gestionnaire e-réputation.
        </p>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <Filter size={14} color="var(--text-muted)" style={{ alignSelf: 'center' }} />
        {FILTERS.map(f => (
          <button key={f.value} onClick={() => setStatusFilter(f.value)}
            style={{ padding: '6px 14px', borderRadius: 20, border: '1.5px solid', borderColor: statusFilter === f.value ? '#7C3AED' : 'var(--card-border)', background: statusFilter === f.value ? '#EDE9FE' : 'transparent', color: statusFilter === f.value ? '#7C3AED' : 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh' }}>
          <Loader2 size={28} color="#7C3AED" style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : approvals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <CheckCircle size={36} color="#059669" style={{ margin: '0 auto 12px', display: 'block' }} />
          <div style={{ fontSize: 15, fontWeight: 700 }}>
            {statusFilter === 'pending_approval' ? 'Aucun contenu en attente d\'approbation ✓' : 'Aucun contenu dans ce filtre'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {approvals.map(a => (
            <ApprovalCard
              key={a.id}
              approval={a}
              isLoading={isActing}
              onApprove={(id, note) => approveMutation.mutate({ id, note })}
              onReject={(id, note) => rejectMutation.mutate({ id, note })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
