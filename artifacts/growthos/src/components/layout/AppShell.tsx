import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import {
  LayoutDashboard, Building2, GitBranch, Search, Bell,
  Settings, Puzzle, Palette, Mail, Target, RefreshCw,
  Bot, User, Webhook, BarChart2, Download, Zap,
  ChevronDown, LogOut, Plus, HelpCircle,
  Globe, Activity, Store, FileText,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useTheme } from '@/providers/theme-provider';
import { CommandPalette } from '@/components/command/CommandPalette';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  exact?: boolean;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Tableau de bord',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} />, exact: true },
      { href: '/analytics', label: 'Analytics', icon: <BarChart2 size={16} /> },
    ],
  },
  {
    label: 'CRM & Pipeline',
    items: [
      { href: '/prospects', label: 'Prospects', icon: <Building2 size={16} /> },
      { href: '/pipeline', label: 'Pipeline', icon: <GitBranch size={16} /> },
      { href: '/activities', label: 'Activités', icon: <Activity size={16} /> },
    ],
  },
  {
    label: 'Sourcing',
    items: [
      { href: '/sourcing', label: 'Scraping', icon: <Search size={16} /> },
      { href: '/signals', label: 'Signaux', icon: <Zap size={16} /> },
      { href: '/contacts', label: 'Contact Intel', icon: <User size={16} /> },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { href: '/sequences', label: 'Séquences Email', icon: <Mail size={16} /> },
      { href: '/inbound', label: 'Inbound', icon: <Download size={16} /> },
      { href: '/abm', label: 'ABM / TAM', icon: <Target size={16} /> },
      { href: '/templates', label: 'Templates Email', icon: <FileText size={16} /> },
      { href: '/crm-sync', label: 'CRM Sync', icon: <RefreshCw size={16} /> },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/ai', label: 'Agent IA', icon: <Bot size={16} /> },
      { href: '/workflows', label: 'Workflows', icon: <Globe size={16} /> },
    ],
  },
  {
    label: 'Système',
    items: [
      { href: '/marketplace', label: 'Marketplace', icon: <Store size={16} /> },
      { href: '/plugins', label: 'Plugins', icon: <Puzzle size={16} /> },
      { href: '/themes', label: 'Thèmes', icon: <Palette size={16} /> },
      { href: '/webhooks', label: 'Webhooks', icon: <Webhook size={16} /> },
      { href: '/settings', label: 'Paramètres', icon: <Settings size={16} /> },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, tenant, logout } = useAuthStore();
  const { theme: _theme } = useTheme();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(p => !p); }
      if (e.key === 'Escape') { setCmdOpen(false); setUserMenuOpen(false); setNotifOpen(false); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const isActive = (item: NavItem) => item.exact ? location === item.href : location.startsWith(item.href);

  const userInitials = [user?.firstName?.[0], user?.lastName?.[0]]
    .filter(Boolean).join('').toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U';

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--body-bg)', fontFamily: 'var(--font-sans)' }}>
      {/* SIDEBAR */}
      <aside
        data-sidebar
        style={{
          width: sidebarCollapsed ? 56 : 220,
          display: 'flex', flexDirection: 'column', height: '100vh', flexShrink: 0,
          overflow: 'hidden', transition: 'width 0.2s ease',
          background: 'var(--sidebar-bg)', borderRight: '1px solid rgba(255,255,255,.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 14px 12px', borderBottom: '1px solid rgba(255,255,255,.06)', flexShrink: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0, background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14 }}>G</div>
          {!sidebarCollapsed && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--sidebar-text)', lineHeight: 1.2 }}>
                {(tenant?.branding as any)?.companyName || 'GrowthOS'}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', lineHeight: 1 }}>
                {user?.email?.split('@')[1] || 'workspace'}
              </div>
            </div>
          )}
        </div>

        <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 0' }}>
          {NAV_SECTIONS.map(section => (
            <div key={section.label}>
              {!sidebarCollapsed && (
                <div style={{ padding: '12px 14px 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)' }}>
                  {section.label}
                </div>
              )}
              {section.items.map(item => {
                const active = isActive(item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={sidebarCollapsed ? item.label : undefined}
                    data-sidebar-item
                    data-sidebar-item-active={active ? '' : undefined}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: sidebarCollapsed ? '8px 0' : '7px 12px',
                      margin: '1px 6px', borderRadius: 8, textDecoration: 'none',
                      justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                      transition: 'background 0.15s',
                      background: active ? 'var(--color-primary)' : 'transparent',
                      color: active ? '#fff' : 'var(--sidebar-text)',
                    }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover)'; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <span style={{ flexShrink: 0, opacity: active ? 1 : 0.8 }}>{item.icon}</span>
                    {!sidebarCollapsed && (
                      <>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: active ? 600 : 400 }}>{item.label}</span>
                        {item.badge !== undefined && item.badge > 0 && (
                          <span style={{ background: '#DC3545', color: '#fff', borderRadius: 9999, padding: '1px 6px', fontSize: 11, fontWeight: 700 }}>{item.badge}</span>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {!sidebarCollapsed && (
          <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,.06)', flexShrink: 0 }}>
            <button
              onClick={() => setUserMenuOpen(o => !o)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'rgba(255,255,255,.05)', border: 'none', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', color: 'var(--sidebar-text)' }}
            >
              <div style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0, background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12 }}>{userInitials}</div>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--sidebar-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.firstName || user?.email?.split('@')[0]}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)' }}>En ligne</div>
              </div>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#28A745', flexShrink: 0 }} />
            </button>
          </div>
        )}
      </aside>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Header */}
        <header style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', height: 48, flexShrink: 0, background: 'var(--card-bg)', borderBottom: '1px solid var(--card-border)' }}>
          <button onClick={() => setSidebarCollapsed(c => !c)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            <LayoutDashboard size={16} />
          </button>
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {NAV_SECTIONS.flatMap(s => s.items).find(i => isActive(i))?.label || 'Dashboard'}
          </span>
          <div style={{ flex: 1 }} />
          <button onClick={() => setCmdOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', background: 'var(--body-bg)', border: '1px solid var(--card-border)', borderRadius: 8, cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13 }}>
            <Search size={13} />
            <span>Rechercher...</span>
            <kbd style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 4, padding: '1px 5px', fontSize: 11, color: 'var(--text-muted)' }}>⌘K</kbd>
          </button>
          <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', fontSize: 13, fontWeight: 500, background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
            <Plus size={13} /> Nouveau
          </button>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setNotifOpen(o => !o)} style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--body-bg)', border: '1px solid var(--card-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', position: 'relative' }}>
              <Bell size={15} />
              <span style={{ position: 'absolute', top: 6, right: 6, width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', border: '2px solid var(--card-bg)' }} />
            </button>
            {notifOpen && (
              <div style={{ position: 'absolute', top: 40, right: 0, width: 300, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,.12)', zIndex: 200, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Notifications</span>
                  <button style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 12, cursor: 'pointer' }}>Tout lire</button>
                </div>
                {[
                  { icon: <Search size={14} />, text: 'Scraping terminé — 47 prospects', time: 'Il y a 5 min', unread: true },
                  { icon: <Zap size={14} />, text: '3 signaux détectés', time: 'Il y a 12 min', unread: true },
                  { icon: <Mail size={14} />, text: '8 emails envoyés', time: 'Il y a 1h', unread: false },
                ].map((n, i) => (
                  <div key={i} style={{ padding: '10px 16px', display: 'flex', gap: 10, background: n.unread ? 'rgba(13,148,136,.04)' : 'transparent', borderBottom: '1px solid var(--card-border)', cursor: 'pointer' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', flexShrink: 0 }}>{n.icon}</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4 }}>{n.text}</p>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{n.time}</span>
                    </div>
                    {n.unread && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-primary)', marginTop: 6 }} />}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--body-bg)', border: '1px solid var(--card-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            <HelpCircle size={15} />
          </button>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setUserMenuOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px 4px 4px', background: 'var(--body-bg)', border: '1px solid var(--card-border)', borderRadius: 8, cursor: 'pointer' }}>
              <div style={{ width: 26, height: 26, borderRadius: 5, background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 11 }}>{userInitials}</div>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{user?.firstName || user?.email?.split('@')[0]}</span>
              <ChevronDown size={12} color="var(--text-muted)" />
            </button>
            {userMenuOpen && (
              <div style={{ position: 'absolute', top: 40, right: 0, width: 210, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,.12)', zIndex: 200, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--card-border)' }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{user?.firstName} {user?.lastName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user?.email}</div>
                </div>
                {[
                  { icon: <User size={14} />, label: 'Mon profil', href: '/settings' },
                  { icon: <Puzzle size={14} />, label: 'Plugins', href: '/plugins' },
                  { icon: <Palette size={14} />, label: 'Thèmes', href: '/themes' },
                ].map(item => (
                  <Link key={item.href} href={item.href} onClick={() => setUserMenuOpen(false)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', color: 'var(--text-secondary)', fontSize: 13, textDecoration: 'none' }}
                  >
                    {item.icon} {item.label}
                  </Link>
                ))}
                <div style={{ borderTop: '1px solid var(--card-border)' }}>
                  <button onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 16px', background: 'none', border: 'none', color: '#EF4444', fontSize: 13, cursor: 'pointer' }}>
                    <LogOut size={14} /> Se déconnecter
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        <main style={{ flex: 1, overflow: 'auto', background: 'var(--body-bg)' }}>
          {children}
        </main>
      </div>

      {cmdOpen && <CommandPalette onClose={() => setCmdOpen(false)} navSections={NAV_SECTIONS} />}
    </div>
  );
}
