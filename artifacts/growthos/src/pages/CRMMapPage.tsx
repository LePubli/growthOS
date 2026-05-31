import { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Route, Filter, Search, Phone, Mail, ChevronRight, X, Play, RotateCcw } from 'lucide-react';

const MOCK_PROSPECTS_MAP = [
  { id: '1', name: 'TechCorp', contact: 'Sophie Martin', address: '12 Rue de la Paix, Paris 75001', lat: 48.8698, lng: 2.3309, score: 92, status: 'qualified', phone: '+33 1 23 45 67 89', email: 'sophie@techcorp.fr', value: 12500 },
  { id: '2', name: 'StartupX', contact: 'Emma Leroy', address: '5 Boulevard Haussmann, Paris 75009', lat: 48.8742, lng: 2.3293, score: 74, status: 'proposal', phone: '+33 1 34 56 78 90', email: 'emma@startupx.io', value: 4800 },
  { id: '3', name: 'BigSales SAS', contact: 'Paul Dupont', address: '23 Avenue Montaigne, Paris 75008', lat: 48.8668, lng: 2.3059, score: 88, status: 'negotiation', phone: '+33 1 45 67 89 01', email: 'paul@bigsales.fr', value: 8200 },
  { id: '4', name: 'DataInc', contact: 'Camille Bernard', address: '7 Rue du Faubourg Saint-Antoine, Paris 75011', lat: 48.8527, lng: 2.3717, score: 61, status: 'lead', phone: '+33 1 56 78 90 12', email: 'camille@datainc.com', value: 3600 },
  { id: '5', name: 'GrowthCo', contact: 'Luc Moreau', address: '45 Rue de Rivoli, Paris 75001', lat: 48.8601, lng: 2.3458, score: 95, status: 'won', phone: '+33 1 67 89 01 23', email: 'luc@growthco.fr', value: 9600 },
  { id: '6', name: 'AlphaTech', contact: 'Marie Dubois', address: '18 Quai de la Marne, Paris 75019', lat: 48.8839, lng: 2.3816, score: 79, status: 'proposal', phone: '+33 1 78 90 12 34', email: 'marie@alphatech.io', value: 22000 },
  { id: '7', name: 'WebAgency', contact: 'Thomas Leclerc', address: '3 Rue des Abbesses, Paris 75018', lat: 48.8845, lng: 2.3384, score: 55, status: 'lead', phone: '+33 1 89 01 23 45', email: 'thomas@webagency.fr', value: 5500 },
  { id: '8', name: 'InnovStart', contact: 'Julie Petit', address: '67 Avenue de la République, Paris 75011', lat: 48.8631, lng: 2.3789, score: 83, status: 'qualified', phone: '+33 1 90 12 34 56', email: 'julie@innovstart.com', value: 7200 },
];

const STATUS_COLORS: Record<string, string> = {
  lead: '#6B7280',
  qualified: '#3B82F6',
  proposal: '#8B5CF6',
  negotiation: '#F59E0B',
  won: '#10B981',
  lost: '#EF4444',
};

const STATUS_LABELS: Record<string, string> = {
  lead: 'Lead', qualified: 'Qualifié', proposal: 'Proposition',
  negotiation: 'Négociation', won: 'Gagné', lost: 'Perdu',
};

function ProspectPin({ p, isSelected, isInRoute, routeOrder, onClick }: { p: typeof MOCK_PROSPECTS_MAP[0]; isSelected: boolean; isInRoute: boolean; routeOrder: number; onClick: () => void }) {
  const color = STATUS_COLORS[p.status] || '#6B7280';
  return (
    <div
      onClick={onClick}
      style={{
        position: 'absolute',
        left: `${((p.lng - 2.29) / 0.12) * 100}%`,
        top: `${((48.895 - p.lat) / 0.06) * 100}%`,
        transform: 'translate(-50%, -100%)',
        cursor: 'pointer',
        zIndex: isSelected ? 20 : 10,
        transition: 'all 0.15s',
      }}
    >
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {isInRoute && (
          <div style={{ position: 'absolute', top: -18, width: 18, height: 18, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, border: '2px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,.2)' }}>
            {routeOrder}
          </div>
        )}
        <div style={{
          width: isSelected ? 36 : 28,
          height: isSelected ? 36 : 28,
          borderRadius: '50% 50% 50% 0',
          background: color,
          transform: 'rotate(-45deg)',
          border: `3px solid ${isSelected ? '#fff' : 'rgba(255,255,255,0.8)'}`,
          boxShadow: isSelected ? `0 4px 16px ${color}80` : '0 2px 8px rgba(0,0,0,.2)',
          transition: 'all 0.15s',
        }} />
        {isSelected && (
          <div style={{ marginTop: 2, background: color, color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6, whiteSpace: 'nowrap' }}>
            {p.name}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CRMMapPage() {
  const [selected, setSelected] = useState<typeof MOCK_PROSPECTS_MAP[0] | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('tous');
  const [route, setRoute] = useState<string[]>([]);
  const [routeMode, setRouteMode] = useState(false);

  const filtered = MOCK_PROSPECTS_MAP.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || `${p.name} ${p.contact} ${p.address}`.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'tous' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const toggleRoute = (id: string) => {
    setRoute(r => r.includes(id) ? r.filter(x => x !== id) : [...r, id]);
  };

  const routeProspects = route.map(id => MOCK_PROSPECTS_MAP.find(p => p.id === id)).filter(Boolean) as typeof MOCK_PROSPECTS_MAP;
  const totalRouteValue = routeProspects.reduce((s, p) => s + p.value, 0);

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 'calc(100vh - 48px)', background: 'var(--body-bg)' }}>
      {/* Left panel */}
      <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--card-border)', background: 'var(--card-bg)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--card-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <MapPin size={16} color="var(--color-primary)" /> CRM Map
            </h1>
            <button onClick={() => setRouteMode(r => !r)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: routeMode ? 'var(--color-primary)' : 'var(--body-bg)', color: routeMode ? '#fff' : 'var(--text-secondary)', boxShadow: '0 0 0 1px var(--card-border)' }}>
              <Route size={12} />Tournée
            </button>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
              style={{ width: '100%', paddingLeft: 30, paddingRight: 10, paddingTop: 8, paddingBottom: 8, borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>

          {/* Status filter */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {['tous', 'lead', 'qualified', 'proposal', 'negotiation', 'won'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                style={{ padding: '3px 8px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 500, cursor: 'pointer', background: statusFilter === s ? (s === 'tous' ? 'var(--color-primary)' : STATUS_COLORS[s]) : 'var(--body-bg)', color: statusFilter === s ? '#fff' : 'var(--text-muted)', boxShadow: '0 0 0 1px var(--card-border)' }}>
                {s === 'tous' ? 'Tous' : STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Route summary */}
        {routeMode && route.length > 0 && (
          <div style={{ padding: '10px 16px', background: `var(--color-primary)10`, borderBottom: '1px solid var(--card-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)' }}>Tournée · {route.length} arrêts</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{totalRouteValue.toLocaleString()}€</span>
                <button onClick={() => setRoute([])} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444' }}><RotateCcw size={12} /></button>
              </div>
            </div>
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {routeProspects.map((p, i) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                  {p.name} — {p.address.split(',')[0]}
                </div>
              ))}
            </div>
            <button style={{ marginTop: 8, width: '100%', padding: '7px', borderRadius: 8, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Navigation size={12} />Démarrer la tournée
            </button>
          </div>
        )}

        {/* Prospect list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.map(p => {
            const color = STATUS_COLORS[p.status];
            const inRoute = route.includes(p.id);
            const routeIdx = route.indexOf(p.id);
            return (
              <div key={p.id}
                onClick={() => setSelected(selected?.id === p.id ? null : p)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--card-border)', cursor: 'pointer', background: selected?.id === p.id ? `${color}10` : 'transparent', transition: 'background 0.1s' }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                  <MapPin size={16} color={color} />
                  {inRoute && (
                    <div style={{ position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--card-bg)' }}>
                      {routeIdx + 1}
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.address.split(',')[0]}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)' }}>{p.value.toLocaleString()}€</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color, background: `${color}18`, padding: '1px 6px', borderRadius: 4 }}>{p.score}</span>
                </div>
                {routeMode && (
                  <button onClick={e => { e.stopPropagation(); toggleRoute(p.id); }}
                    style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${inRoute ? 'var(--color-primary)' : 'var(--card-border)'}`, background: inRoute ? 'var(--color-primary)' : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {inRoute && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Stats bar */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--card-border)', display: 'flex', gap: 12, fontSize: 12 }}>
          <span style={{ color: 'var(--text-muted)' }}>{filtered.length} prospects</span>
          <span style={{ color: 'var(--text-muted)' }}>·</span>
          <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{filtered.reduce((s, p) => s + p.value, 0).toLocaleString()}€</span>
        </div>
      </div>

      {/* Map area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#E8F0FE' }}>
        {/* Map background — stylized city grid */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.15 }} viewBox="0 0 800 600">
          {/* Streets horizontal */}
          {[50, 120, 190, 260, 330, 400, 470, 540].map((y, i) => (
            <line key={`h${i}`} x1={0} y1={y} x2={800} y2={y} stroke="#1D4ED8" strokeWidth={i % 3 === 0 ? 2 : 0.5} />
          ))}
          {/* Streets vertical */}
          {[80, 160, 240, 320, 400, 480, 560, 640, 720].map((x, i) => (
            <line key={`v${i}`} x1={x} y1={0} x2={x} y2={600} stroke="#1D4ED8" strokeWidth={i % 3 === 0 ? 2 : 0.5} />
          ))}
          {/* Seine river */}
          <path d="M 0 320 Q 200 300 400 330 Q 600 360 800 340" stroke="#3B82F6" strokeWidth={8} fill="none" opacity={0.5} />
          <text x="350" y="310" fill="#3B82F6" fontSize="12" fontWeight="bold" opacity={0.6}>La Seine</text>
          {/* Paris label */}
          <text x="380" y="180" fill="#1D4ED8" fontSize="18" fontWeight="bold" opacity={0.4}>Paris</text>
        </svg>

        {/* Pins */}
        <div style={{ position: 'absolute', inset: 0 }}>
          {filtered.map(p => (
            <ProspectPin
              key={p.id}
              p={p}
              isSelected={selected?.id === p.id}
              isInRoute={route.includes(p.id)}
              routeOrder={route.indexOf(p.id) + 1}
              onClick={() => setSelected(selected?.id === p.id ? null : p)}
            />
          ))}
        </div>

        {/* Legend */}
        <div style={{ position: 'absolute', top: 16, right: 16, background: 'var(--card-bg)', borderRadius: 12, padding: '10px 14px', border: '1px solid var(--card-border)', boxShadow: '0 4px 16px rgba(0,0,0,.08)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Légende</div>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLORS[k] }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Selected prospect card */}
        {selected && (
          <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', width: 340, background: 'var(--card-bg)', borderRadius: 16, padding: 18, border: '1px solid var(--card-border)', boxShadow: '0 8px 32px rgba(0,0,0,.15)', zIndex: 30 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{selected.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selected.contact}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 9999, background: `${STATUS_COLORS[selected.status]}18`, color: STATUS_COLORS[selected.status] }}>{STATUS_LABELS[selected.status]}</span>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <MapPin size={12} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selected.address}</span>
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1, padding: '8px 12px', borderRadius: 10, background: 'var(--body-bg)', textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary)' }}>{selected.value.toLocaleString()}€</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Valeur</div>
              </div>
              <div style={{ flex: 1, padding: '8px 12px', borderRadius: 10, background: 'var(--body-bg)', textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: selected.score >= 80 ? '#10B981' : '#F59E0B' }}>{selected.score}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Score</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <a href={`tel:${selected.phone}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-secondary)', fontSize: 12, textDecoration: 'none', cursor: 'pointer' }}>
                <Phone size={13} />Appeler
              </a>
              <a href={`mailto:${selected.email}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-secondary)', fontSize: 12, textDecoration: 'none', cursor: 'pointer' }}>
                <Mail size={13} />Email
              </a>
              {routeMode && (
                <button onClick={() => toggleRoute(selected.id)}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', borderRadius: 10, border: 'none', background: route.includes(selected.id) ? '#ECFDF5' : 'var(--color-primary)', color: route.includes(selected.id) ? '#059669' : '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                  <Route size={13} />{route.includes(selected.id) ? 'Retirer' : 'Ajouter'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* No map note */}
        <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', fontSize: 11, color: 'rgba(29,78,216,0.4)', whiteSpace: 'nowrap' }}>
          Aperçu carte — Paris (intégrez Mapbox/Google Maps pour la production)
        </div>
      </div>
    </div>
  );
}
