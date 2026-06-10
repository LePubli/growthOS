import React from 'react';
import { Link, useLocation } from 'wouter';
import { Star, LayoutDashboard, Megaphone, CheckSquare, FileBarChart, ArrowLeft, LogOut } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

const NAV: { href: string; label: string; icon: React.ReactNode }[] = [
  { href: '/client/ereputation', label: 'Tableau de bord', icon: <LayoutDashboard size={16} /> },
  { href: '/client/ereputation/campaigns', label: 'Mes campagnes', icon: <Megaphone size={16} /> },
  { href: '/client/ereputation/approvals', label: 'Approbations', icon: <CheckSquare size={16} /> },
  { href: '/client/ereputation/reports', label: 'Rapports', icon: <FileBarChart size={16} /> },
];

interface ClientShellProps {
  children: React.ReactNode;
}

export function ClientShell({ children }: ClientShellProps) {
  const [location] = useLocation();
  const { user, logout } = useAuthStore();

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--body-bg)' }}>
      {/* Sidebar */}
      <aside style={{
        width: 240,
        background: 'linear-gradient(180deg, #1E1B4B 0%, #312E81 100%)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 40,
        overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Star size={18} color="#F59E0B" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>Portail Client</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>E-Réputation</div>
            </div>
          </div>
          {user && (
            <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.email}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                {(user as any).firstName ? `${(user as any).firstName} ${(user as any).lastName ?? ''}` : 'Client'}
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(item => {
            const active = location === item.href || (item.href !== '/client/ereputation' && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 12px',
                  borderRadius: 10,
                  background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                  color: active ? '#fff' : 'rgba(255,255,255,0.6)',
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  transition: 'all 0.15s',
                  cursor: 'pointer',
                }}
                  onMouseEnter={e => !active && ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)')}
                  onMouseLeave={e => !active && ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                >
                  {item.icon}
                  {item.label}
                  {item.href === '/client/ereputation/approvals' && (
                    <span style={{ marginLeft: 'auto', fontSize: 10, padding: '1px 6px', borderRadius: 20, background: '#EF4444', color: '#fff', fontWeight: 800 }}>
                      •
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Link href="/ereputation" style={{ textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.8)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)')}>
              <ArrowLeft size={14} />
              Retour GrowthOS
            </div>
          </Link>
          <button
            onClick={() => { logout(); window.location.href = '/login'; }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer', width: '100%', textAlign: 'left' }}
          >
            <LogOut size={14} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ marginLeft: 240, flex: 1, minHeight: '100vh', background: 'var(--body-bg)' }}>
        {children}
      </main>
    </div>
  );
}
