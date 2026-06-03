import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'wouter';
import {
  LayoutDashboard, Building2, GitBranch, Search, Bell,
  Settings, Puzzle, Palette, Mail, Target, RefreshCw,
  Bot, User, Webhook, BarChart2, Download, Zap,
  ChevronDown, LogOut, Plus, HelpCircle,
  Globe, Activity, Store, FileText, Menu, X, Map, Upload, Users, Trophy, Calendar as CalIcon, Share2, Brain, Video,
  Sparkles, TrendingUp, LineChart, BookOpen, Crown, Route,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useTheme } from '@/providers/theme-provider';
import { CommandPalette } from '@/components/command/CommandPalette';
import { NotificationsDrawer } from '@/components/common/NotificationsDrawer';
import { useRuntimePlugins } from '@/hooks/use-plugins';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  exact?: boolean;
  /** If set, this item is only shown when the given plugin is ACTIVE */
  pluginId?: string;
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
      { href: '/accounts', label: 'Comptes', icon: <Users size={16} /> },
      { href: '/pipeline', label: 'Pipeline', icon: <GitBranch size={16} /> },
      { href: '/activities', label: 'Activités', icon: <Activity size={16} /> },
    ],
  },
  {
    label: 'Sourcing',
    items: [
      { href: '/sourcing', label: 'Scraping', icon: <Search size={16} /> },
      { href: '/signals', label: 'Signaux', icon: <Zap size={16} />, pluginId: 'ai-signals' },
      { href: '/contacts', label: 'Contact Intel', icon: <User size={16} /> },
      { href: '/map', label: 'Carte & Tournée', icon: <Map size={16} /> },
      { href: '/import', label: 'Import CSV', icon: <Upload size={16} /> },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { href: '/sequences', label: 'Séquences Email', icon: <Mail size={16} /> },
      { href: '/proposals', label: 'Propositions', icon: <FileText size={16} /> },
      { href: '/inbound', label: 'Inbound', icon: <Download size={16} /> },
      { href: '/abm', label: 'ABM / TAM', icon: <Target size={16} /> },
      { href: '/templates', label: 'Templates Email', icon: <FileText size={16} /> },
      { href: '/crm-sync', label: 'CRM Sync', icon: <RefreshCw size={16} />, pluginId: 'crm-sync' },
    ],
  },
  {
    label: 'IA & Revenue',
    items: [
      { href: '/ai-sdr', label: 'AI SDR', icon: <Sparkles size={16} />, pluginId: 'ai-sdr' },
      { href: '/deal-coach', label: 'Deal Coach', icon: <TrendingUp size={16} />, pluginId: 'ai-deal-coach' },
      { href: '/revenue', label: 'Revenue Intel.', icon: <LineChart size={16} />, pluginId: 'revenue-intelligence' },
      { href: '/knowledge', label: 'Base de Connais.', icon: <BookOpen size={16} />, pluginId: 'knowledge-base' },
      { href: '/executive', label: 'Command Center', icon: <Crown size={16} />, pluginId: 'executive-command' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/memory', label: 'Mémoire', icon: <Brain size={16} />, pluginId: 'growth-memory' },
      { href: '/meetings', label: 'Réunions', icon: <Video size={16} />, pluginId: 'meeting-intelligence' },
      { href: '/ai', label: 'Agent IA', icon: <Bot size={16} /> },
      { href: '/workflows', label: 'Workflows', icon: <Globe size={16} /> },
      { href: '/calendar', label: 'Calendrier', icon: <CalIcon size={16} /> },
    ],
  },
  {
    label: 'Équipe',
    items: [
      { href: '/shared-dashboards', label: 'Dashboards Partagés', icon: <Share2 size={16} /> },
      { href: '/team', label: 'Métriques Équipe', icon: <Trophy size={16} /> },
    ],
  },
  {
    label: 'Système',
    items: [
      { href: '/marketplace', label: 'Marketplace', icon: <Store size={16} />, badge: 1 },
      { href: '/plugins', label: 'Plugins', icon: <Puzzle size={16} /> },
      { href: '/themes', label: 'Thèmes', icon: <Palette size={16} /> },
      { href: '/webhooks', label: 'Webhooks', icon: <Webhook size={16} /> },
      { href: '/route-audit', label: 'Audit Routes', icon: <Route size={16} /> },
      { href: '/settings', label: 'Paramètres', icon: <Settings size={16} /> },
    ],
  },
];

function useMobile() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

function SidebarContent({
  collapsed,
  onNavClick,
  location,
  isActive,
  user,
  tenant,
  userInitials,
  onUserMenu,
  activePluginIds,
}: {
  collapsed: boolean;
  onNavClick?: () => void;
  location: string;
  isActive: (item: NavItem) => boolean;
  user: any;
  tenant: any;
  userInitials: string;
  onUserMenu: () => void;
  /** null = still loading (show everything); Set = filter by plugin state */
  activePluginIds: Set<string> | null;
}) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 14px 12px', borderBottom: '1px solid rgba(255,255,255,.06)', flexShrink: 0 }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0, background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14 }}>G</div>
        {!collapsed && (
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
        {NAV_SECTIONS.map(section => {
          // Filter out items whose controlling plugin is not active
          const visibleItems = section.items.filter(item =>
            !item.pluginId ||
            !activePluginIds ||
            activePluginIds.has(item.pluginId)
          );
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.label}>
              {!collapsed && (
                <div style={{ padding: '12px 14px 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)' }}>
                  {section.label}
                </div>
              )}
              {visibleItems.map(item => {
                const active = isActive(item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    onClick={onNavClick}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: collapsed ? '8px 0' : '7px 12px',
                      margin: '1px 6px', borderRadius: 8, textDecoration: 'none',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      transition: 'background 0.15s',
                      background: active ? 'var(--color-primary)' : 'transparent',
                      color: active ? '#fff' : 'var(--sidebar-text)',
                    }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover)'; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <span style={{ flexShrink: 0, opacity: active ? 1 : 0.8 }}>{item.icon}</span>
                    {!collapsed && (
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
          );
        })}
      </nav>

      {!collapsed && (
        <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,.06)', flexShrink: 0 }}>
          <button
            onClick={onUserMenu}
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
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, tenant, logout } = useAuthStore();
  const { theme: _theme } = useTheme();
  const isMobile = useMobile();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Live plugin state — sidebar items with a pluginId are hidden when that plugin is DISABLED
  const { data: pluginsData } = useRuntimePlugins();
  const activePluginIds: Set<string> | null = pluginsData
    ? new Set((pluginsData.plugins ?? []).filter(p => p.state === 'ACTIVE').map(p => p.id))
    : null; // null while loading → show all items (no flash)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(p => !p); }
      if (e.key === 'Escape') { setCmdOpen(false); setUserMenuOpen(false); setMobileSidebarOpen(false); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location]);

  // Close mobile sidebar on resize to desktop
  useEffect(() => {
    if (!isMobile) setMobileSidebarOpen(false);
  }, [isMobile]);

  const isActive = useCallback((item: NavItem) =>
    item.exact ? location === item.href : location.startsWith(item.href), [location]);

  const userInitials = [user?.firstName?.[0], user?.lastName?.[0]]
    .filter(Boolean).join('').toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U';

  const currentPageLabel = NAV_SECTIONS.flatMap(s => s.items).find(i => isActive(i))?.label || 'Dashboard';

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--body-bg)', fontFamily: 'var(--font-sans)' }}>

      {/* MOBILE BACKDROP */}
      {isMobile && mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 299, backdropFilter: 'blur(2px)' }}
        />
      )}

      {/* SIDEBAR — desktop fixed, mobile drawer overlay */}
      <aside
        style={{
          width: isMobile ? 240 : (sidebarCollapsed ? 56 : 220),
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          flexShrink: 0,
          overflow: 'hidden',
          transition: 'width 0.2s ease, transform 0.25s ease',
          background: 'var(--sidebar-bg)',
          borderRight: '1px solid rgba(255,255,255,.06)',
          // Mobile: drawer overlay
          ...(isMobile ? {
            position: 'fixed',
            top: 0,
            left: 0,
            zIndex: 300,
            transform: mobileSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
            boxShadow: mobileSidebarOpen ? '8px 0 32px rgba(0,0,0,0.3)' : 'none',
          } : {}),
        }}
      >
        {/* Close button on mobile */}
        {isMobile && (
          <button
            onClick={() => setMobileSidebarOpen(false)}
            style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 6, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--sidebar-text)', zIndex: 1 }}
          >
            <X size={14} />
          </button>
        )}

        <SidebarContent
          collapsed={!isMobile && sidebarCollapsed}
          onNavClick={isMobile ? () => setMobileSidebarOpen(false) : undefined}
          location={location}
          isActive={isActive}
          user={user}
          tenant={tenant}
          userInitials={userInitials}
          onUserMenu={() => setUserMenuOpen(o => !o)}
          activePluginIds={activePluginIds}
        />
      </aside>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* HEADER */}
        <header style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: isMobile ? '0 12px' : '0 16px',
          height: 48, flexShrink: 0,
          background: 'var(--card-bg)', borderBottom: '1px solid var(--card-border)',
        }}>
          {/* Hamburger (mobile) or collapse (desktop) */}
          <button
            onClick={() => isMobile ? setMobileSidebarOpen(o => !o) : setSidebarCollapsed(c => !c)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', flexShrink: 0 }}
          >
            <Menu size={18} />
          </button>

          {/* Breadcrumb */}
          {!isMobile && <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>/</span>}
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: isMobile ? 120 : 'none' }}>
            {currentPageLabel}
          </span>

          <div style={{ flex: 1 }} />

          {/* Search — hidden on small mobile */}
          {!isMobile && (
            <button
              onClick={() => setCmdOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', background: 'var(--body-bg)', border: '1px solid var(--card-border)', borderRadius: 8, cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, flexShrink: 0 }}
            >
              <Search size={13} />
              <span>Rechercher...</span>
              <kbd style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 4, padding: '1px 5px', fontSize: 11, color: 'var(--text-muted)' }}>⌘K</kbd>
            </button>
          )}

          {/* Search icon only on mobile */}
          {isMobile && (
            <button onClick={() => setCmdOpen(true)} style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--body-bg)', border: '1px solid var(--card-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexShrink: 0 }}>
              <Search size={15} />
            </button>
          )}

          {/* New button — icon only on mobile */}
          <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: isMobile ? '0' : '5px 12px', width: isMobile ? 32 : 'auto', height: isMobile ? 32 : 'auto', justifyContent: 'center', fontSize: 13, fontWeight: 500, background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', flexShrink: 0 }}>
            <Plus size={13} />
            {!isMobile && 'Nouveau'}
          </button>

          {/* Notifications */}
          <div style={{ flexShrink: 0 }}>
            <NotificationsDrawer
              trigger={
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--body-bg)', border: '1px solid var(--card-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                  <Bell size={15} />
                </div>
              }
            />
          </div>

          {/* Help — hidden on mobile */}
          {!isMobile && (
            <button style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--body-bg)', border: '1px solid var(--card-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexShrink: 0 }}>
              <HelpCircle size={15} />
            </button>
          )}

          {/* User menu */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setUserMenuOpen(o => !o)}
              style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 0 : 8, padding: isMobile ? 0 : '4px 8px 4px 4px', background: isMobile ? 'transparent' : 'var(--body-bg)', border: isMobile ? 'none' : '1px solid var(--card-border)', borderRadius: 8, cursor: 'pointer' }}
            >
              <div style={{ width: 28, height: 28, borderRadius: isMobile ? '50%' : 5, background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 11 }}>{userInitials}</div>
              {!isMobile && (
                <>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{user?.firstName || user?.email?.split('@')[0]}</span>
                  <ChevronDown size={12} color="var(--text-muted)" />
                </>
              )}
            </button>
            {userMenuOpen && (
              <div style={{ position: 'fixed', top: 56, right: 12, width: 210, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,.12)', zIndex: 200, overflow: 'hidden' }}>
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
