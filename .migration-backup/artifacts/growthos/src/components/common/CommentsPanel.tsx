import { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, Loader2, Phone, Mail, Calendar, FileText, CheckCircle, AtSign } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';

export type ActivityType = 'comment' | 'call' | 'email' | 'meeting' | 'note' | 'status_change';

export interface Activity {
  id: string;
  type: ActivityType;
  content: string;
  author: string;
  authorInitial: string;
  createdAt: string;
  mentions?: string[];
}

const TYPE_META: Record<ActivityType, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  comment:       { icon: <MessageSquare size={13} />, color: '#6366F1', bg: '#EEF2FF', label: 'Commentaire' },
  call:          { icon: <Phone size={13} />,         color: '#059669', bg: '#ECFDF5', label: 'Appel' },
  email:         { icon: <Mail size={13} />,          color: '#7C3AED', bg: '#EDE9FE', label: 'Email' },
  meeting:       { icon: <Calendar size={13} />,      color: '#2563EB', bg: '#EFF6FF', label: 'Réunion' },
  note:          { icon: <FileText size={13} />,      color: '#D97706', bg: '#FEF3C7', label: 'Note' },
  status_change: { icon: <CheckCircle size={13} />,   color: '#059669', bg: '#ECFDF5', label: 'Changement' },
};

const MOCK_ACTIVITIES: Activity[] = [
  { id: '1', type: 'call', content: 'Appel de 20 min — intéressé par le plan Pro. Rappel prévu la semaine prochaine.', author: 'Vous', authorInitial: 'V', createdAt: 'il y a 2h', mentions: [] },
  { id: '2', type: 'email', content: 'Envoi de la proposition commerciale — devis 12 500€/an.', author: 'Vous', authorInitial: 'V', createdAt: 'il y a 1j', mentions: [] },
  { id: '3', type: 'comment', content: 'À suivre en priorité cette semaine. Le budget est validé côté client.', author: 'Alice Moreau', authorInitial: 'A', createdAt: 'il y a 2j', mentions: [] },
  { id: '4', type: 'meeting', content: 'Demo produit — 45 min. Très bon retour sur les fonctionnalités de scraping.', author: 'Vous', authorInitial: 'V', createdAt: 'il y a 3j', mentions: [] },
];

const QUICK_TYPES: { type: ActivityType; icon: React.ReactNode; label: string }[] = [
  { type: 'comment', icon: <MessageSquare size={13} />, label: 'Note' },
  { type: 'call',    icon: <Phone size={13} />,         label: 'Appel' },
  { type: 'email',   icon: <Mail size={13} />,          label: 'Email' },
  { type: 'meeting', icon: <Calendar size={13} />,      label: 'RDV' },
];

interface Props {
  entityType: 'deal' | 'prospect';
  entityId: string;
}

export function CommentsPanel({ entityType, entityId }: Props) {
  const { user } = useAuthStore();
  const [activities, setActivities] = useState<Activity[]>(MOCK_ACTIVITIES);
  const [content, setContent] = useState('');
  const [type, setType] = useState<ActivityType>('comment');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    apiClient.get(`/activities?entityType=${entityType}&entityId=${entityId}`)
      .then((d: any) => {
        const list = Array.isArray(d) ? d : d?.data || [];
        if (list.length > 0) {
          setActivities(list.map((a: any) => ({
            id: a.id, type: a.type || 'comment', content: a.description || a.content || '',
            author: a.userName || 'Vous', authorInitial: (a.userName || 'V').charAt(0).toUpperCase(),
            createdAt: a.createdAt ? new Date(a.createdAt).toLocaleDateString('fr-FR') : '—',
          })));
        }
      }).catch(() => {});
  }, [entityId, entityType]);

  const send = async () => {
    if (!content.trim()) return;
    setSending(true);
    const newActivity: Activity = {
      id: Date.now().toString(),
      type,
      content: content.trim(),
      author: user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Vous',
      authorInitial: (user?.firstName || 'V').charAt(0).toUpperCase(),
      createdAt: 'à l\'instant',
    };
    try {
      await apiClient.post('/activities', {
        type, title: TYPE_META[type].label, description: content.trim(),
        entityType, entityId, status: 'done',
      });
    } catch {}
    setActivities(prev => [newActivity, ...prev]);
    setContent('');
    setSending(false);
    setType('comment');
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
        <MessageSquare size={15} color="var(--color-primary)" />
        Activité & Collaboration
        <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 9999, background: 'var(--body-bg)', color: 'var(--text-muted)', border: '1px solid var(--card-border)' }}>{activities.length}</span>
      </h3>

      {/* Composer */}
      <div style={{ borderRadius: 14, border: '1px solid var(--card-border)', background: 'var(--body-bg)', overflow: 'hidden', marginBottom: 20 }}>
        {/* Type selector */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--card-border)' }}>
          {QUICK_TYPES.map(qt => (
            <button key={qt.type} onClick={() => { setType(qt.type); textareaRef.current?.focus(); }}
              style={{ flex: 1, padding: '9px 0', border: 'none', background: type === qt.type ? 'var(--card-bg)' : 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: type === qt.type ? TYPE_META[qt.type].color : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, borderBottom: type === qt.type ? `2px solid ${TYPE_META[qt.type].color}` : '2px solid transparent' }}>
              {qt.icon}{qt.label}
            </button>
          ))}
        </div>
        {/* Textarea */}
        <div style={{ position: 'relative' }}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={onKey}
            placeholder={`Ajouter une ${TYPE_META[type].label.toLowerCase()}… (⌘+Entrée pour envoyer)`}
            rows={3}
            style={{ width: '100%', padding: '12px 14px', border: 'none', background: 'transparent', resize: 'none', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderTop: '1px solid var(--card-border)' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>⌘+Entrée pour envoyer · @mention un collègue</span>
            <button onClick={send} disabled={!content.trim() || sending}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: 'none', background: content.trim() ? TYPE_META[type].color : 'var(--card-border)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: content.trim() ? 'pointer' : 'not-allowed', transition: 'all 0.15s' }}>
              {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              Envoyer
            </button>
          </div>
        </div>
      </div>

      {/* Activity feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {activities.map((act, i) => {
          const meta = TYPE_META[act.type] || TYPE_META.comment;
          return (
            <div key={act.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              {/* Timeline line */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: act.type === 'comment' || act.type === 'note' ? 'var(--body-bg)' : meta.bg, border: `1px solid var(--card-border)`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, overflow: 'hidden' }}>
                  {act.type === 'comment' || act.type === 'note' ? (
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700 }}>
                      {act.authorInitial}
                    </div>
                  ) : (
                    <div style={{ color: meta.color }}>{meta.icon}</div>
                  )}
                </div>
                {i < activities.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--card-border)', minHeight: 16, marginTop: 4 }} />}
              </div>
              {/* Content */}
              <div style={{ flex: 1, paddingBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                  <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 9999, background: meta.bg, color: meta.color, fontWeight: 600 }}>{meta.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{act.author}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {act.createdAt}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, padding: '10px 12px', borderRadius: 10, background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                  {act.content}
                </div>
              </div>
            </div>
          );
        })}
        {activities.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
            <MessageSquare size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
            <div style={{ fontSize: 13 }}>Aucune activité — ajoutez une note ou un appel</div>
          </div>
        )}
      </div>
    </div>
  );
}
