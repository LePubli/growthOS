'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Building2, GitBranch, Search, Bell,
  Settings, Puzzle, Palette, Mail, Target, RefreshCw,
  Bot, User, Webhook, BarChart2, Download, Zap,
  ChevronDown, LogOut, Plus, Command, HelpCircle,
  Globe, Activity,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import { NotificationsPopover } from '@/components/notifications/NotificationsPopover';
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
      { href: '/crm-sync', label: 'CRM Sync', icon: <RefreshCw size={16} /> },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/agent', label: 'Agent IA', icon: <Bot size={16} /> },
      { href: '/workflows', label: 'Workflows', icon: <Globe size={16} /> },
    ],
  },
  {
    label: 'Système',
    items: [
      { href: '/plugins', label: 'Plugins', icon: <Puzzle size={16} /> },
      { href: '/themes', label: 'Thèmes', icon: <Palette size={16} /> },
      { href: '/webhooks', label: 'Webhooks', icon: <Webhook size={16} /> },
      { href: '/settings', label: 'Paramètres', icon: <Settings size={16} /> },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, tenant, logout } = useAuthStore();
  const { theme } = useTheme();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Keyboard shortcut ⌘K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(p => !p);
      }
      if (e.key === 'Escape') {
        setCmdOpen(false);
        setUserMenuOpen(false);
        setNotifOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const isActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  };

  const userInitials = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join('').toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U';

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-app)' }}>

      {/* ── Sidebar Odoo ─────────────────────────────────── */}
      <aside className="o-sidebar" style={{ width: sidebarCollapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width)' }}>

        {/* Logo */}
        <div className="o-sidebar-logo">
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'linear-gradient(135deg, #017E84, #714B67)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: 14, flexShrink: 0,
          }}>G</div>
          {!sidebarCollapsed && (
            <div style={{ marginLeft: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#fff', lineHeight: 1.2 }}>
                {(tenant?.branding as any)?.companyName || 'GrowthOS'}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', lineHeight: 1 }}>
                {user?.email?.split('@')[1] || 'workspace'}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="o-sidebar-nav">
          {NAV_SECTIONS.map(section => (
            <div key={section.label}>
              {!sidebarCollapsed && (
                <div className="o-nav-section">{section.label}</div>
              )}
              {section.items.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn('o-nav-item', isActive(item) && 'active')}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <span className="o-nav-icon">{item.icon}</span>
                  {!sidebarCollapsed && (
                    <>
                      <span style={{ flex: 1, fontSize: 14 }}>{item.label}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span style={{
                          background: '#DC3545', color: '#fff',
                          borderRadius: 9999, padding: '1px 6px',
                          fontSize: 11, fontWeight: 700, lineHeight: 1.4,
                        }}>{item.badge}</span>
                      )}
                    </>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer sidebar */}
        {!sidebarCollapsed && (
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid rgba(255,255,255,.08)',
            flexShrink: 0,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 0', cursor: 'pointer',
            }}
              onClick={() => setUserMenuOpen(o => !o)}
            >
              <div style={{
                width: 30, height: 30, borderRadius: 6,
                background: 'linear-gradient(135deg, #017E84, #714B67)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0,
              }}>{userInitials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.firstName || user?.email?.split('@')[0] || 'Utilisateur'}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>En ligne</div>
              </div>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#28A745', flexShrink: 0 }} />
            </div>
          </div>
        )}
      </aside>

      {/* ── Main ─────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* ── Header Odoo ──────────────────────────────── */}
        <header className="o-header">
          {/* Breadcrumb */}
          <div className="o-header-breadcrumb" style={{ flex: 1 }}>
            <button
              onClick={() => setSidebarCollapsed(c => !c)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
            >
              <LayoutDashboard size={16} />
            </button>
            <span className="o-header-breadcrumb-sep">/</span>
            <span className="o-header-breadcrumb-current">
              {NAV_SECTIONS.flatMap(s => s.items).find(i => isActive(i))?.label || 'Dashboard'}
            </span>
          </div>

          {/* Actions header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>

            {/* Search ⌘K */}
            <button
              onClick={() => setCmdOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 12px',
                background: 'var(--bg-app)', border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: 13,
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-color)')}
            >
              <Search size={13} />
              <span>Rechercher...</span>
              <kbd style={{
                background: '#fff', border: '1px solid var(--border-color)',
                borderRadius: 4, padding: '1px 5px', fontSize: 11,
                color: 'var(--text-muted)', boxShadow: '0 1px 2px rgba(0,0,0,.05)',
              }}>⌘K</kbd>
            </button>

            {/* Nouveau */}
            <button className="o-btn o-btn-primary" style={{ padding: '5px 12px', fontSize: 13 }}>
              <Plus size={13} /> Nouveau
            </button>

            {/* Notifications */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setNotifOpen(o => !o)}
                style={{
                  width: 32, height: 32, borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-app)', border: '1px solid var(--border-color)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative', transition: 'all 0.15s',
                  color: 'var(--text-secondary)',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-primary)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)'; }}
              >
                <Bell size={15} />
                <span style={{
                  position: 'absolute', top: 5, right: 5,
                  width: 7, height: 7, borderRadius: '50%',
                  background: 'var(--color-danger)', border: '2px solid #fff',
                }} />
              </button>

              {notifOpen && (
                <div style={{
                  position: 'absolute', top: 40, right: 0,
                  width: 320, background: '#fff',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
                  zIndex: 200, animation: 'fadeIn .15s ease', overflow: 'hidden',
                }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Notifications</span>
                    <button style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>Tout lire</button>
                  </div>
                  {[
                    { icon: <Search size={14} />, text: 'Scraping terminé — 47 prospects', time: 'Il y a 5 min', unread: true },
                    { icon: <Zap size={14} />, text: '3 signaux BODACC détectés', time: 'Il y a 12 min', unread: true },
                    { icon: <Mail size={14} />, text: '8 emails envoyés via séquence', time: 'Il y a 1h', unread: false },
                  ].map((n, i) => (
                    <div key={i} style={{ padding: '10px 16px', display: 'flex', gap: 12, alignItems: 'flex-start', background: n.unread ? 'rgba(1,126,132,.03)' : 'transparent', borderBottom: '1px solid var(--border-light)', cursor: 'pointer' }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', flexShrink: 0 }}>
                        {n.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4 }}>{n.text}</p>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{n.time}</span>
                      </div>
                      {n.unread && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0, marginTop: 6 }} />}
                    </div>
                  ))}
                  <div style={{ padding: '10px', textAlign: 'center' }}>
                    <button style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>Voir toutes les notifications</button>
                  </div>
                </div>
              )}
            </div>

            {/* Aide */}
            <button style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: 'var(--bg-app)', border: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              <HelpCircle size={15} />
            </button>

            {/* User dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setUserMenuOpen(o => !o)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '4px 8px 4px 4px',
                  background: 'var(--bg-app)', border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-color)')}
              >
                <div style={{
                  width: 26, height: 26, borderRadius: 5,
                  background: 'linear-gradient(135deg, #017E84, #714B67)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 700, fontSize: 11,
                }}>{userInitials}</div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                    {user?.firstName || user?.email?.split('@')[0]}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {(tenant?.branding as any)?.companyName || tenant?.name}
                  </div>
                </div>
                <ChevronDown size={12} color="var(--text-muted)" />
              </button>

              {userMenuOpen && (
                <div style={{
                  position: 'absolute', top: 40, right: 0,
                  width: 220, background: '#fff',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
                  zIndex: 200, overflow: 'hidden', animation: 'fadeIn .15s ease',
                }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)' }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
                      {user?.firstName} {user?.lastName}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user?.email}</div>
                  </div>
                  {[
                    { icon: <User size={14} />, label: 'Mon profil', href: '/settings/profile' },
                    { icon: <Settings size={14} />, label: 'Paramètres', href: '/settings' },
                    { icon: <Puzzle size={14} />, label: 'Plugins', href: '/plugins' },
                  ].map(item => (
                    <Link key={item.href} href={item.href}
                      onClick={() => setUserMenuOpen(false)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', color: 'var(--text-secondary)', fontSize: 13, textDecoration: 'none', transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {item.icon} {item.label}
                    </Link>
                  ))}
                  <div style={{ borderTop: '1px solid var(--border-light)' }}>
                    <button
                      onClick={logout}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 16px', background: 'none', border: 'none', color: 'var(--color-danger)', fontSize: 13, cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-danger-light)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <LogOut size={14} /> Se déconnecter
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── Content ────────────────────────────────────── */}
        <main style={{ flex: 1, overflow: 'hidden' }}>
          {children}
        </main>
      </div>

      {/* ── Command Palette ───────────────────────────────── */}
      {cmdOpen && (
        <CommandPalette onClose={() => setCmdOpen(false)} navSections={NAV_SECTIONS} />
      )}
    </div>
  );
}
