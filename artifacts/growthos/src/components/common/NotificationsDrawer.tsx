import { useState, useEffect, useRef } from 'react';
import { Bell, X, CheckCheck, Zap, DollarSign, Mail, Users, AlertCircle, TrendingUp, ChevronRight } from 'lucide-react';
import { useLocation } from 'wouter';

export interface Notification {
  id: string;
  type: 'signal' | 'deal' | 'email' | 'team' | 'system';
  title: string;
  body: string;
  href?: string;
  read: boolean;
  at: string;
}

const TYPE_META = {
  signal: { icon: <Zap size={14} />,        color: '#F59E0B', bg: '#FEF3C7' },
  deal:   { icon: <DollarSign size={14} />,  color: '#059669', bg: '#ECFDF5' },
  email:  { icon: <Mail size={14} />,        color: '#7C3AED', bg: '#EDE9FE' },
  team:   { icon: <Users size={14} />,       color: '#2563EB', bg: '#EFF6FF' },
  system: { icon: <AlertCircle size={14} />, color: '#6B7280', bg: '#F3F4F6' },
};

const MOCK_NOTIFS: Notification[] = [
  { id: '1', type: 'signal', title: 'Signal chaud détecté', body: 'TechCorp vient de lever des fonds — moment idéal pour contacter Sophie Martin.', href: '/signals', read: false, at: 'il y a 5 min' },
  { id: '2', type: 'deal', title: 'Deal gagné 🎉', body: 'GrowthCo — Luc Moreau — 9 600€ marqué comme Gagné.', href: '/pipeline', read: false, at: 'il y a 30 min' },
  { id: '3', type: 'email', title: 'Email ouvert ×3', body: 'Emma Leroy (StartupX) a ouvert votre email 3 fois en 1h. Appelez maintenant.', href: '/sequences', read: false, at: 'il y a 1h' },
  { id: '4', type: 'team', title: 'Alice a commenté un deal', body: 'AlphaTech — "Budget validé, relancer Marie Dubois cette semaine".', href: '/pipeline/6', read: true, at: 'il y a 2h' },
  { id: '5', type: 'signal', title: 'Nouveau recrutement détecté', body: 'BigSales SAS recherche un VP Sales — signal d\'expansion budget.', href: '/signals', read: true, at: 'il y a 3h' },
  { id: '6', type: 'email', title: 'Réponse reçue', body: 'Paul Dupont (BigSales) a répondu à votre séquence "Follow-up J+5".', href: '/sequences', read: true, at: 'il y a 5h' },
  { id: '7', type: 'system', title: 'Import CSV terminé', body: '127 prospects importés avec succès depuis LinkedIn Sales Navigator.', href: '/prospects', read: true, at: 'hier' },
];

const STORAGE_KEY = 'growthos_notifications';

interface Props {
  trigger: React.ReactNode;
}

export function NotificationsDrawer({ trigger }: Props) {
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || MOCK_NOTIFS; }
    catch { return MOCK_NOTIFS; }
  });
  const ref = useRef<HTMLDivElement>(null);
  const unread = notifs.filter(n => !n.read).length;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifs));
  }, [notifs]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markAllRead = () => setNotifs(ns => ns.map(n => ({ ...n, read: true })));
  const markRead = (id: string) => setNotifs(ns => ns.map(n => n.id === id ? { ...n, read: true } : n));
  const dismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifs(ns => ns.filter(n => n.id !== id));
  };

  const go = (notif: Notification) => {
    markRead(notif.id);
    setOpen(false);
    if (notif.href) navigate(notif.href);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger with badge */}
      <div onClick={() => setOpen(o => !o)} style={{ position: 'relative', cursor: 'pointer' }}>
        {trigger}
        {unread > 0 && (
          <div style={{ position: 'absolute', top: -4, right: -4, width: 17, height: 17, borderRadius: '50%', background: '#EF4444', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--sidebar-bg)' }}>
            {unread > 9 ? '9+' : unread}
          </div>
        )}
      </div>

      {/* Dropdown panel */}
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 360, background: 'var(--card-bg)', borderRadius: 16, border: '1px solid var(--card-border)', boxShadow: '0 12px 40px rgba(0,0,0,.15)', zIndex: 700, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--card-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bell size={15} style={{ color: 'var(--color-primary)' }} />
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Notifications</span>
              {unread > 0 && <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 9999, background: '#FEF2F2', color: '#DC2626', fontWeight: 700 }}>{unread} nouvelles</span>}
            </div>
            {unread > 0 && (
              <button onClick={markAllRead} style={{ fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCheck size={13} />Tout lire
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {notifs.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Bell size={32} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
                <div style={{ fontSize: 13 }}>Aucune notification</div>
              </div>
            ) : (
              notifs.map(notif => {
                const meta = TYPE_META[notif.type];
                return (
                  <div key={notif.id} onClick={() => go(notif)}
                    style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 16px', borderBottom: '1px solid var(--card-border)', cursor: 'pointer', background: notif.read ? 'transparent' : `color-mix(in srgb, var(--color-primary) 4%, transparent)`, transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--body-bg)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = notif.read ? 'transparent' : `color-mix(in srgb, var(--color-primary) 4%, transparent)`}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: meta.bg, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {meta.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: notif.read ? 500 : 700, color: 'var(--text-primary)' }}>{notif.title}</span>
                        {!notif.read && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0 }} />}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: 3 }}>{notif.body}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{notif.at}</div>
                    </div>
                    <button onClick={e => dismiss(notif.id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', opacity: 0, flexShrink: 0 }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '0'}>
                      <X size={13} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--card-border)', textAlign: 'center' }}>
            <button onClick={() => { setOpen(false); navigate('/activities'); }} style={{ fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              Voir toutes les activités →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
