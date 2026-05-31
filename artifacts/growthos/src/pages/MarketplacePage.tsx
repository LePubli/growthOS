import { useState } from 'react';
import { useLocation } from 'wouter';
import { Star, Download, CheckCircle, Search, Zap, Map, Users, Mail, BarChart2, Bot, Globe, Puzzle, Shield } from 'lucide-react';

const MARKETPLACE_PLUGINS = [
  {
    id: 'crm-map',
    name: 'CRM Map & Tournée',
    slug: 'crm-map',
    description: 'Visualisez vos prospects sur une carte interactive. Planifiez vos tournées commerciales avec optimisation de trajets et zones géographiques.',
    version: '1.0.0',
    category: 'crm',
    rating: 4.9,
    installs: 3800,
    price: 'Gratuit',
    icon: '🗺️',
    featured: true,
    tags: ['carte', 'tournée', 'géolocalisation'],
  },
  {
    id: 'linkedin-enricher',
    name: 'LinkedIn Enricher',
    slug: 'linkedin-enricher',
    description: 'Enrichissement automatique des profils prospects avec données LinkedIn — poste, entreprise, ancienneté, réseau.',
    version: '2.1.0',
    category: 'enrichment',
    rating: 4.8,
    installs: 1240,
    price: '29€/mois',
    icon: '💼',
    featured: true,
    tags: ['linkedin', 'enrichissement', 'b2b'],
  },
  {
    id: 'ai-email-composer',
    name: 'AI Email Composer',
    slug: 'ai-email-composer',
    description: "Génère des emails de prospection personnalisés avec GPT-4o. Adapte le ton, la longueur et le contexte à chaque prospect.",
    version: '1.3.2',
    category: 'ai',
    rating: 4.9,
    installs: 3200,
    price: '19€/mois',
    icon: '🤖',
    featured: false,
    tags: ['ia', 'email', 'gpt-4'],
  },
  {
    id: 'hunter-io',
    name: 'Hunter.io Integration',
    slug: 'hunter-io',
    description: 'Trouve et vérifie les emails professionnels via Hunter.io. Enrichissement en masse depuis une liste de domaines.',
    version: '1.0.5',
    category: 'enrichment',
    rating: 4.5,
    installs: 890,
    price: '15€/mois',
    icon: '🎯',
    featured: false,
    tags: ['email', 'vérification', 'enrichissement'],
  },
  {
    id: 'clearbit',
    name: 'Clearbit Reveal',
    slug: 'clearbit',
    description: 'Identifie les visiteurs anonymes de votre site et les convertit en leads qualifiés avec données firmographiques.',
    version: '3.0.1',
    category: 'analytics',
    rating: 4.7,
    installs: 650,
    price: '49€/mois',
    icon: '🔍',
    featured: false,
    tags: ['analytics', 'leads', 'firmographie'],
  },
  {
    id: 'slack-notify',
    name: 'Slack Notifications',
    slug: 'slack-notify',
    description: "Notifications en temps réel dans vos channels Slack — nouveaux signaux, deals gagnés, alertes de séquences.",
    version: '1.2.0',
    category: 'notifications',
    rating: 4.6,
    installs: 2100,
    price: 'Gratuit',
    icon: '💬',
    featured: false,
    tags: ['slack', 'notifications', 'alertes'],
  },
  {
    id: 'zapier-connect',
    name: 'Zapier Connect',
    slug: 'zapier-connect',
    description: "Connectez GrowthOS à 5000+ applications via Zapier. Automatisez vos workflows sans code.",
    version: '2.0.0',
    category: 'automation',
    rating: 4.4,
    installs: 1800,
    price: 'Gratuit',
    icon: '⚡',
    featured: false,
    tags: ['automatisation', 'zapier', 'intégration'],
  },
  {
    id: 'email-verifier',
    name: 'Email Verifier Pro',
    slug: 'email-verifier',
    description: "Vérification en temps réel de la validité des emails. Réduit le bounce rate et améliore la délivrabilité de vos séquences.",
    version: '1.1.0',
    category: 'enrichment',
    rating: 4.6,
    installs: 720,
    price: '12€/mois',
    icon: '✅',
    featured: false,
    tags: ['email', 'vérification', 'délivrabilité'],
  },
];

const CATEGORIES = [
  { id: 'tous', label: 'Tous', icon: <Puzzle size={14} /> },
  { id: 'crm', label: 'CRM', icon: <Users size={14} /> },
  { id: 'enrichment', label: 'Enrichissement', icon: <Zap size={14} /> },
  { id: 'ai', label: 'IA', icon: <Bot size={14} /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart2 size={14} /> },
  { id: 'notifications', label: 'Notifications', icon: <Globe size={14} /> },
  { id: 'automation', label: 'Automation', icon: <Shield size={14} /> },
];

export default function MarketplacePage() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('tous');
  const [installed, setInstalled] = useState<Set<string>>(new Set(['linkedin-enricher', 'ai-email-composer', 'slack-notify']));
  const [installing, setInstalling] = useState<string | null>(null);

  const filtered = MARKETPLACE_PLUGINS.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || `${p.name} ${p.description} ${p.tags.join(' ')}`.toLowerCase().includes(q);
    const matchCat = category === 'tous' || p.category === category;
    return matchSearch && matchCat;
  });

  const featured = filtered.filter(p => p.featured);
  const rest = filtered.filter(p => !p.featured);

  const install = async (slug: string) => {
    setInstalling(slug);
    await new Promise(r => setTimeout(r, 1200));
    setInstalled(s => new Set([...s, slug]));
    setInstalling(null);
  };

  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: 'var(--body-bg)' }}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Marketplace</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Étendez GrowthOS avec des plugins et connecteurs — {installed.size} installés</p>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un plugin..."
          style={{ width: '100%', paddingLeft: 36, paddingRight: 12, paddingTop: 10, paddingBottom: 10, borderRadius: 12, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
      </div>

      {/* Categories */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {CATEGORIES.map(c => (
          <button key={c.id} onClick={() => setCategory(c.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', background: category === c.id ? 'var(--color-primary)' : 'var(--card-bg)', color: category === c.id ? '#fff' : 'var(--text-secondary)', boxShadow: category === c.id ? 'none' : '0 0 0 1px var(--card-border)' }}>
            {c.icon}{c.label}
          </button>
        ))}
      </div>

      {/* Featured */}
      {featured.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold mb-3 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>⭐ À la une</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {featured.map(plugin => (
              <div key={plugin.id}
                style={{ borderRadius: 16, border: '2px solid var(--color-primary)', background: 'var(--card-bg)', overflow: 'hidden', transition: 'all 0.15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,.1)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}>
                <div style={{ padding: 20, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ width: 52, height: 52, borderRadius: 12, background: 'var(--body-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>{plugin.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <h3 style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', margin: 0 }}>{plugin.name}</h3>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 9999, background: 'var(--color-primary)', color: '#fff', fontWeight: 600 }}>Featured</span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 10px', lineHeight: 1.5 }}>{plugin.description}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Star size={12} fill="#F59E0B" color="#F59E0B" />{plugin.rating}</span>
                      <span>{plugin.installs.toLocaleString()} installs</span>
                      <span style={{ fontWeight: 600, color: plugin.price === 'Gratuit' ? '#10B981' : 'var(--text-primary)' }}>{plugin.price}</span>
                    </div>
                  </div>
                </div>
                <div style={{ padding: '12px 20px', borderTop: '1px solid var(--card-border)', display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => !installed.has(plugin.slug) && install(plugin.slug)}
                    disabled={installed.has(plugin.slug) || installing === plugin.slug}
                    style={{ flex: 1, padding: '9px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 600, cursor: installed.has(plugin.slug) ? 'default' : 'pointer', background: installed.has(plugin.slug) ? '#ECFDF5' : 'var(--color-primary)', color: installed.has(plugin.slug) ? '#059669' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    {installing === plugin.slug ? '⏳ Installation...' : installed.has(plugin.slug) ? <><CheckCircle size={14} />Installé</> : <><Download size={14} />Installer</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All plugins */}
      <div>
        <h2 className="text-sm font-bold mb-3 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Tous les plugins</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {rest.map(plugin => (
            <div key={plugin.id}
              style={{ borderRadius: 14, border: '1px solid var(--card-border)', background: 'var(--card-bg)', overflow: 'hidden', transition: 'all 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,.08)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-primary)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--card-border)'; }}>
              <div style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--body-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{plugin.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>{plugin.name}</div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 8px', lineHeight: 1.5 }}>{plugin.description}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--text-muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}><Star size={11} fill="#F59E0B" color="#F59E0B" />{plugin.rating}</span>
                    <span>{plugin.installs.toLocaleString()} installs</span>
                    <span style={{ fontWeight: 600, color: plugin.price === 'Gratuit' ? '#10B981' : 'var(--text-primary)' }}>{plugin.price}</span>
                  </div>
                </div>
              </div>
              <div style={{ padding: '10px 16px', borderTop: '1px solid var(--card-border)' }}>
                <button
                  onClick={() => !installed.has(plugin.slug) && install(plugin.slug)}
                  disabled={installed.has(plugin.slug) || installing === plugin.slug}
                  style={{ width: '100%', padding: '8px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 500, cursor: installed.has(plugin.slug) ? 'default' : 'pointer', background: installed.has(plugin.slug) ? '#ECFDF5' : 'var(--color-primary)', color: installed.has(plugin.slug) ? '#059669' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {installing === plugin.slug ? '⏳ Installation...' : installed.has(plugin.slug) ? <><CheckCircle size={13} />Installé</> : <><Download size={13} />Installer</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
