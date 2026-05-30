import { useState } from 'react';
import { Target, Plus, Building2, TrendingUp, Users, Star, ChevronRight, Loader2 } from 'lucide-react';

const MOCK_ACCOUNTS = [
  { id: '1', company: 'Schneider Electric', industry: 'Energie', size: '10000+', tam: 2800000, status: 'target', contacts: 12, engaged: 8, score: 92 },
  { id: '2', company: 'Dassault Systèmes', industry: 'Logiciel', size: '1000-5000', tam: 1500000, status: 'engaged', contacts: 5, engaged: 3, score: 78 },
  { id: '3', company: 'Bureau Veritas', industry: 'Services', size: '5000-10000', tam: 950000, status: 'target', contacts: 9, engaged: 2, score: 65 },
  { id: '4', company: 'Veolia', industry: 'Environnement', size: '10000+', tam: 3200000, status: 'engaged', contacts: 7, engaged: 6, score: 87 },
  { id: '5', company: 'Arkema', industry: 'Chimie', size: '1000-5000', tam: 720000, status: 'prospect', contacts: 3, engaged: 1, score: 45 },
];

const TIERS = [
  { value: 'all', label: 'Tous les comptes' },
  { value: 'target', label: 'Tier 1 — Cibles', color: '#7C3AED' },
  { value: 'engaged', label: 'Tier 2 — Engagés', color: '#2563EB' },
  { value: 'prospect', label: 'Tier 3 — Prospects', color: '#6B7280' },
];

export default function ABMPage() {
  const [tier, setTier] = useState('all');

  const filtered = tier === 'all' ? MOCK_ACCOUNTS : MOCK_ACCOUNTS.filter(a => a.status === tier);
  const totalTam = MOCK_ACCOUNTS.reduce((s, a) => s + a.tam, 0);
  const engagedCount = MOCK_ACCOUNTS.filter(a => a.status === 'engaged').length;

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--body-bg)' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>ABM / TAM</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Account-Based Marketing — Marché adressable total</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: 'var(--color-primary)' }}>
          <Plus size={14} />Ajouter un compte
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { l: 'TAM total', v: `${(totalTam / 1000000).toFixed(1)}M€`, icon: <Target size={18} />, color: 'text-teal-600 bg-teal-50' },
          { l: 'Comptes cibles', v: MOCK_ACCOUNTS.filter(a => a.status === 'target').length, icon: <Building2 size={18} />, color: 'text-purple-600 bg-purple-50' },
          { l: 'Comptes engagés', v: engagedCount, icon: <TrendingUp size={18} />, color: 'text-blue-600 bg-blue-50' },
          { l: 'Contacts totaux', v: MOCK_ACCOUNTS.reduce((s, a) => s + a.contacts, 0), icon: <Users size={18} />, color: 'text-green-600 bg-green-50' },
        ].map((m, i) => (
          <div key={i} className="rounded-2xl border p-4 flex items-center gap-3" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${m.color}`}>{m.icon}</div>
            <div>
              <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{m.v}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.l}</div>
            </div>
          </div>
        ))}
      </div>

      {/* TAM visualization */}
      <div className="rounded-2xl border p-5 mb-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
        <h2 className="font-semibold mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>RÉPARTITION PAR INDUSTRIE</h2>
        <div className="space-y-3">
          {[
            { l: 'Energie', v: 2800000, color: '#7C3AED' },
            { l: 'Environnement', v: 3200000, color: '#059669' },
            { l: 'Logiciel', v: 1500000, color: '#2563EB' },
            { l: 'Services', v: 950000, color: '#D97706' },
            { l: 'Chimie', v: 720000, color: '#6B7280' },
          ].map(m => (
            <div key={m.l}>
              <div className="flex justify-between text-sm mb-1">
                <span style={{ color: 'var(--text-secondary)' }}>{m.l}</span>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{(m.v / 1000000).toFixed(1)}M€</span>
              </div>
              <div className="w-full rounded-full h-2" style={{ background: 'var(--body-bg)' }}>
                <div className="h-2 rounded-full" style={{ width: `${(m.v / totalTam) * 100}%`, background: m.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {TIERS.map(t => (
          <button key={t.value} onClick={() => setTier(t.value)}
            className="px-3 py-1.5 rounded-xl text-sm font-medium transition-all"
            style={tier === t.value
              ? { background: 'var(--color-primary)', color: '#fff' }
              : { background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Accounts list */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
        {filtered.map(account => {
          const tierInfo = TIERS.find(t => t.value === account.status);
          return (
            <div key={account.id} className="flex items-center gap-4 p-4 border-b last:border-b-0 hover:opacity-80 cursor-pointer transition-opacity"
              style={{ borderColor: 'var(--card-border)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                style={{ background: 'var(--color-primary)' }}>{account.company[0]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{account.company}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
                    background: tierInfo?.color ? `${tierInfo.color}15` : '#F3F4F6',
                    color: tierInfo?.color || '#6B7280',
                  }}>{tierInfo?.label?.split('—')[1]?.trim() || account.status}</span>
                </div>
                <div className="flex gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span>{account.industry}</span>
                  <span>{account.size} employés</span>
                  <span>{account.contacts} contact{account.contacts > 1 ? 's' : ''}</span>
                  <span>{account.engaged} engagé{account.engaged > 1 ? 's' : ''}</span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{(account.tam / 1000).toFixed(0)}k€</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>TAM</div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <div className="w-12 rounded-full h-1.5" style={{ background: 'var(--body-bg)' }}>
                  <div className="h-1.5 rounded-full" style={{
                    width: `${account.score}%`,
                    background: account.score >= 80 ? '#059669' : account.score >= 60 ? '#D97706' : '#6B7280',
                  }} />
                </div>
                <span className="text-xs font-bold w-6" style={{ color: 'var(--text-primary)' }}>{account.score}</span>
              </div>
              <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
