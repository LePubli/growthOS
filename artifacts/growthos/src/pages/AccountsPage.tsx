import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Building2, Users, DollarSign, TrendingUp, Search, Plus, ChevronRight, Mail, Phone, MapPin, BarChart2 } from 'lucide-react';
import apiClient from '@/lib/api-client';

interface Account {
  id: string;
  name: string;
  domain: string;
  industry: string;
  size: string;
  city: string;
  contactCount: number;
  dealValue: number;
  dealCount: number;
  status: 'active' | 'prospect' | 'customer' | 'churned';
  lastActivity: string;
  score: number;
  contacts: { name: string; email: string; phone: string; role: string }[];
}

const MOCK_ACCOUNTS: Account[] = [
  { id: '1', name: 'TechCorp', domain: 'techcorp.fr', industry: 'SaaS', size: '51-200', city: 'Paris', contactCount: 3, dealValue: 12500, dealCount: 2, status: 'active', lastActivity: 'il y a 2h', score: 92, contacts: [{ name: 'Sophie Martin', email: 'sophie@techcorp.fr', phone: '+33 6 12 34 56 78', role: 'Dir. Commercial' }] },
  { id: '2', name: 'StartupX', domain: 'startupx.io', industry: 'Fintech', size: '11-50', city: 'Lyon', contactCount: 1, dealValue: 4800, dealCount: 1, status: 'prospect', lastActivity: 'il y a 1j', score: 74, contacts: [{ name: 'Emma Leroy', email: 'emma@startupx.io', phone: '', role: 'CEO' }] },
  { id: '3', name: 'BigSales SAS', domain: 'bigsales.fr', industry: 'Distribution', size: '200+', city: 'Bordeaux', contactCount: 5, dealValue: 28200, dealCount: 3, status: 'customer', lastActivity: 'il y a 3h', score: 88, contacts: [{ name: 'Paul Dupont', email: 'paul@bigsales.fr', phone: '+33 6 34 56 78 90', role: 'Head of Sales' }] },
  { id: '4', name: 'DataInc', domain: 'datainc.com', industry: 'Data & IA', size: '11-50', city: 'Nantes', contactCount: 2, dealValue: 3600, dealCount: 1, status: 'prospect', lastActivity: 'il y a 5j', score: 61, contacts: [{ name: 'Camille Bernard', email: 'camille@datainc.com', phone: '', role: 'CTO' }] },
  { id: '5', name: 'GrowthCo', domain: 'growthco.fr', industry: 'Marketing', size: '11-50', city: 'Paris', contactCount: 2, dealValue: 9600, dealCount: 1, status: 'customer', lastActivity: 'il y a 30 min', score: 95, contacts: [{ name: 'Luc Moreau', email: 'luc@growthco.fr', phone: '+33 6 56 78 90 12', role: 'VP Marketing' }] },
  { id: '6', name: 'AlphaTech', domain: 'alphatech.io', industry: 'SaaS', size: '51-200', city: 'Paris', contactCount: 4, dealValue: 22000, dealCount: 2, status: 'active', lastActivity: 'il y a 1h', score: 79, contacts: [{ name: 'Marie Dubois', email: 'marie@alphatech.io', phone: '+33 6 78 90 12 34', role: 'Dir. Achats' }] },
];

const STATUS_CONFIG = {
  active:   { l: 'Actif',    c: '#2563EB', bg: '#EFF6FF' },
  prospect: { l: 'Prospect', c: '#D97706', bg: '#FEF3C7' },
  customer: { l: 'Client',   c: '#059669', bg: '#ECFDF5' },
  churned:  { l: 'Churné',   c: '#DC2626', bg: '#FEF2F2' },
};

const SIZES = ['Tous', '1-10', '11-50', '51-200', '200+'];
const INDUSTRIES = ['Tous', 'SaaS', 'Fintech', 'Distribution', 'Data & IA', 'Marketing'];

export default function AccountsPage() {
  const [, navigate] = useLocation();
  const [accounts, setAccounts] = useState<Account[]>(MOCK_ACCOUNTS);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Tous');
  const [industryFilter, setIndustryFilter] = useState('Tous');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get('/accounts').then((d: any) => {
      const list = Array.isArray(d) ? d : d?.data || [];
      if (list.length > 0) setAccounts(list);
    }).catch(() => {});
  }, []);

  const filtered = accounts.filter(a => {
    const q = search.toLowerCase();
    const matchQ = !q || `${a.name} ${a.domain} ${a.industry} ${a.city}`.toLowerCase().includes(q);
    const matchS = statusFilter === 'Tous' || a.status === statusFilter.toLowerCase();
    const matchI = industryFilter === 'Tous' || a.industry === industryFilter;
    return matchQ && matchS && matchI;
  });

  const totalValue = accounts.reduce((s, a) => s + a.dealValue, 0);
  const customers = accounts.filter(a => a.status === 'customer').length;
  const totalContacts = accounts.reduce((s, a) => s + a.contactCount, 0);

  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: 'var(--body-bg)' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Comptes</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{accounts.length} entreprises · vue Account-Based</p>
        </div>
        <div className="flex gap-2">
          <div className="flex p-1 rounded-xl gap-1" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
            {(['grid', 'list'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{ padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, background: view === v ? 'var(--color-primary)' : 'transparent', color: view === v ? '#fff' : 'var(--text-muted)' }}>
                {v === 'grid' ? '⊞ Grille' : '≡ Liste'}
              </button>
            ))}
          </div>
          <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 12, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={14} />Nouveau compte
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { l: 'Comptes', v: accounts.length, icon: <Building2 size={16} />, c: 'text-blue-600 bg-blue-50' },
          { l: 'Clients actifs', v: customers, icon: <TrendingUp size={16} />, c: 'text-green-600 bg-green-50' },
          { l: 'Contacts', v: totalContacts, icon: <Users size={16} />, c: 'text-purple-600 bg-purple-50' },
          { l: 'Pipeline total', v: `${(totalValue / 1000).toFixed(0)}k€`, icon: <DollarSign size={16} />, c: 'text-amber-600 bg-amber-50' },
        ].map((k, i) => (
          <div key={i} className="rounded-2xl border p-4 flex items-center gap-3" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${k.c} flex-shrink-0`}>{k.icon}</div>
            <div>
              <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{k.v}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{k.l}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un compte…"
            style={{ width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 9, paddingBottom: 9, borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}>
          {['Tous', 'Prospect', 'Active', 'Customer', 'Churned'].map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={industryFilter} onChange={e => setIndustryFilter(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}>
          {INDUSTRIES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Grid view */}
      {view === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {filtered.map(acc => {
            const st = STATUS_CONFIG[acc.status];
            const isExp = expanded === acc.id;
            return (
              <div key={acc.id}
                style={{ borderRadius: 16, border: '1px solid var(--card-border)', background: 'var(--card-bg)', overflow: 'hidden', transition: 'all 0.15s', cursor: 'pointer' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,.08)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-primary)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--card-border)'; }}>
                <div style={{ padding: '16px 16px 12px' }}>
                  {/* Account header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: `var(--color-primary)18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0 }}>
                      {acc.name.charAt(0)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 2 }}>{acc.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{acc.domain} · {acc.industry}</div>
                    </div>
                    <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 9999, background: st.bg, color: st.c, fontWeight: 600, flexShrink: 0 }}>{st.l}</span>
                  </div>

                  {/* Meta */}
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, flexWrap: 'wrap' }}>
                    {acc.city && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={11} />{acc.city}</span>}
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={11} />{acc.size}</span>
                    <span>{acc.lastActivity}</span>
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    {[
                      { l: 'Contacts', v: acc.contactCount },
                      { l: 'Deals', v: acc.dealCount },
                      { l: 'Pipeline', v: `${(acc.dealValue / 1000).toFixed(0)}k€` },
                    ].map((s, i) => (
                      <div key={i} style={{ textAlign: 'center', padding: '7px 0', borderRadius: 8, background: 'var(--body-bg)' }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary)' }}>{s.v}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 0, borderTop: '1px solid var(--card-border)' }}>
                  <button onClick={() => setExpanded(isExp ? null : acc.id)}
                    style={{ flex: 1, padding: '10px 0', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', borderRight: '1px solid var(--card-border)' }}>
                    {isExp ? 'Masquer' : `👥 ${acc.contactCount} contact${acc.contactCount > 1 ? 's' : ''}`}
                  </button>
                  <button onClick={() => navigate(`/prospects?company=${encodeURIComponent(acc.name)}`)}
                    style={{ flex: 1, padding: '10px 0', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--color-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    Voir <ChevronRight size={12} />
                  </button>
                </div>

                {/* Expanded contacts */}
                {isExp && (
                  <div style={{ borderTop: '1px solid var(--card-border)', padding: '12px 16px', background: 'var(--body-bg)' }}>
                    {acc.contacts.map((c, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: i < acc.contacts.length - 1 ? 8 : 0 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                          {c.name.charAt(0)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.role}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {c.email && <a href={`mailto:${c.email}`} style={{ color: 'var(--text-muted)', display: 'flex' }}><Mail size={13} /></a>}
                          {c.phone && <a href={`tel:${c.phone}`} style={{ color: 'var(--text-muted)', display: 'flex' }}><Phone size={13} /></a>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* List view */
        <div style={{ background: 'var(--card-bg)', borderRadius: 16, border: '1px solid var(--card-border)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: 12, padding: '10px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', borderBottom: '1px solid var(--card-border)', background: 'var(--body-bg)' }}>
            <span>Compte</span><span>Secteur</span><span>Contacts</span><span>Pipeline</span><span>Score</span><span>Statut</span>
          </div>
          {filtered.map(acc => {
            const st = STATUS_CONFIG[acc.status];
            return (
              <div key={acc.id} onClick={() => navigate(`/prospects?company=${encodeURIComponent(acc.name)}`)}
                style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: 12, alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--card-border)', cursor: 'pointer', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--body-bg)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: `var(--color-primary)18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0 }}>{acc.name.charAt(0)}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{acc.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{acc.domain}</div>
                  </div>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{acc.industry}</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{acc.contactCount}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)' }}>{acc.dealValue.toLocaleString()}€</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: acc.score >= 80 ? '#059669' : '#F59E0B' }}>{acc.score}</span>
                <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 9999, background: st.bg, color: st.c, fontWeight: 600, whiteSpace: 'nowrap' }}>{st.l}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
