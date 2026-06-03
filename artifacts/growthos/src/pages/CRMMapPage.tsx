import { useState, useEffect } from 'react';
import { MapPin, Navigation, Route, Search, Phone, Mail, X, RotateCcw, List, Map as MapIcon } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import apiClient from '@/lib/api-client';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Fix Leaflet default icon paths broken by Vite bundling
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

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

const MOCK_PROSPECTS: Prospect[] = [
  { id: '1', name: 'TechCorp', contact: 'Sophie Martin', address: '12 Rue de la Paix, Paris', lat: 48.8698, lng: 2.3309, score: 92, status: 'qualified', phone: '+33 1 23 45 67 89', email: 'sophie@techcorp.fr', value: 12500 },
  { id: '2', name: 'StartupX', contact: 'Emma Leroy', address: '5 Boulevard Haussmann, Paris', lat: 48.8742, lng: 2.3293, score: 74, status: 'proposal', phone: '+33 1 34 56 78 90', email: 'emma@startupx.io', value: 4800 },
  { id: '3', name: 'BigSales SAS', contact: 'Paul Dupont', address: '23 Avenue Montaigne, Paris', lat: 48.8668, lng: 2.3059, score: 88, status: 'negotiation', phone: '+33 1 45 67 89 01', email: 'paul@bigsales.fr', value: 8200 },
  { id: '4', name: 'DataInc', contact: 'Camille Bernard', address: '7 Rue du Faubourg Saint-Antoine, Paris', lat: 48.8527, lng: 2.3717, score: 61, status: 'lead', phone: '+33 1 56 78 90 12', email: 'camille@datainc.com', value: 3600 },
  { id: '5', name: 'GrowthCo', contact: 'Luc Moreau', address: '45 Rue de Rivoli, Paris', lat: 48.8601, lng: 2.3458, score: 95, status: 'won', phone: '+33 1 67 89 01 23', email: 'luc@growthco.fr', value: 9600 },
  { id: '6', name: 'AlphaTech', contact: 'Marie Dubois', address: '18 Quai de la Marne, Paris', lat: 48.8839, lng: 2.3816, score: 79, status: 'proposal', phone: '+33 1 78 90 12 34', email: 'marie@alphatech.io', value: 22000 },
  { id: '7', name: 'WebAgency', contact: 'Thomas Leclerc', address: '3 Rue des Abbesses, Paris', lat: 48.8845, lng: 2.3384, score: 55, status: 'lead', phone: '+33 1 89 01 23 45', email: 'thomas@webagency.fr', value: 5500 },
  { id: '8', name: 'InnovStart', contact: 'Julie Petit', address: '67 Av. de la République, Paris', lat: 48.8631, lng: 2.3789, score: 83, status: 'qualified', phone: '+33 1 90 12 34 56', email: 'julie@innovstart.com', value: 7200 },
];

interface Prospect {
  id: string; name: string; contact: string; address: string;
  lat: number; lng: number; score: number; status: string;
  phone: string; email: string; value: number;
}

/** Creates a coloured SVG divIcon for each prospect marker */
function makeIcon(color: string, routeOrder: number, isSelected: boolean) {
  const size = isSelected ? 44 : 36;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + 8}" viewBox="0 0 44 52">
      <circle cx="22" cy="20" r="${isSelected ? 19 : 16}" fill="${color}" stroke="white" stroke-width="3"
        filter="drop-shadow(0 2px 6px ${color}80)"/>
      ${routeOrder > 0
        ? `<text x="22" y="25" text-anchor="middle" font-size="13" font-weight="bold" fill="white" font-family="system-ui">${routeOrder}</text>`
        : `<circle cx="22" cy="20" r="6" fill="white" opacity="0.9"/>`}
      <polygon points="22,${isSelected ? 40 : 37} 16,28 28,28" fill="${color}"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [size, size + 8],
    iconAnchor: [size / 2, size + 8],
    popupAnchor: [0, -(size + 8)],
  });
}

/** Fly to a prospect when selected */
function FlyTo({ prospect }: { prospect: Prospect | null }) {
  const map = useMap();
  useEffect(() => {
    if (prospect) map.flyTo([prospect.lat, prospect.lng], 15, { duration: 0.8 });
  }, [prospect]);
  return null;
}

export default function CRMMapPage() {
  const [prospects, setProspects] = useState<Prospect[]>(MOCK_PROSPECTS);
  const [selected, setSelected] = useState<Prospect | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('tous');
  const [route, setRoute] = useState<string[]>([]);
  const [routeMode, setRouteMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    apiClient.get('/prospects').then((d: any) => {
      const list = Array.isArray(d) ? d : d?.data || [];
      const withCoords = list.filter((p: any) => p.lat && p.lng);
      if (withCoords.length > 0) {
        setProspects(withCoords.map((p: any) => ({
          id: p.id, name: p.company_name || p.name || 'Prospect',
          contact: `${p.firstName || ''} ${p.lastName || ''}`.trim(),
          address: p.address || '', lat: p.lat, lng: p.lng,
          score: p.score || 0, status: p.status || 'lead',
          phone: p.phone || '', email: p.email || '', value: p.value || 0,
        })));
      }
    }).catch(() => {});
  }, []);

  const filtered = prospects.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || `${p.name} ${p.contact} ${p.address}`.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'tous' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const toggleRoute = (id: string) =>
    setRoute(r => r.includes(id) ? r.filter(x => x !== id) : [...r, id]);

  const routeProspects = route.map(id => prospects.find(p => p.id === id)).filter(Boolean) as Prospect[];
  const totalRouteValue = routeProspects.reduce((s, p) => s + p.value, 0);

  const center: [number, number] = [48.8566, 2.3522]; // Paris

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 48px)', background: 'var(--body-bg)', position: 'relative' }}>

      {/* ── SIDEBAR ──────────────────────────────────── */}
      <div style={{
        width: sidebarOpen ? 300 : 0,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--card-bg)',
        borderRight: '1px solid var(--card-border)',
        overflow: 'hidden',
        transition: 'width 0.25s ease',
        position: 'relative',
        zIndex: 500,
      }}>
        {/* Header */}
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--card-border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
              <MapPin size={15} color="var(--color-primary)" />CRM Map
            </h1>
            <button onClick={() => setRouteMode(r => !r)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: routeMode ? 'var(--color-primary)' : 'var(--body-bg)', color: routeMode ? '#fff' : 'var(--text-secondary)', boxShadow: '0 0 0 1px var(--card-border)' }}>
              <Route size={12} />Tournée
            </button>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom, entreprise…"
              style={{ width: '100%', paddingLeft: 28, paddingRight: 8, paddingTop: 7, paddingBottom: 7, borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
          </div>

          {/* Status pills */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {['tous', 'lead', 'qualified', 'proposal', 'negotiation', 'won'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                style={{ padding: '2px 8px', borderRadius: 6, border: 'none', fontSize: 10, fontWeight: 600, cursor: 'pointer', background: statusFilter === s ? (s === 'tous' ? 'var(--color-primary)' : STATUS_COLORS[s]) : 'var(--body-bg)', color: statusFilter === s ? '#fff' : 'var(--text-muted)', boxShadow: '0 0 0 1px var(--card-border)' }}>
                {s === 'tous' ? 'Tous' : STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Route summary */}
        {routeMode && route.length > 0 && (
          <div style={{ padding: '8px 14px', background: `color-mix(in srgb, var(--color-primary) 8%, transparent)`, borderBottom: '1px solid var(--card-border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)' }}>Tournée · {route.length} arrêts</span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{totalRouteValue.toLocaleString()}€</span>
                <button onClick={() => setRoute([])} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', lineHeight: 1 }}><RotateCcw size={11} /></button>
              </div>
            </div>
            {routeProspects.map((p, i) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
              </div>
            ))}
            <button style={{ marginTop: 8, width: '100%', padding: '6px', borderRadius: 7, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <Navigation size={12} />Démarrer la tournée
            </button>
          </div>
        )}

        {/* Prospect list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.map(p => {
            const color = STATUS_COLORS[p.status] || '#6B7280';
            const inRoute = route.includes(p.id);
            const routeIdx = route.indexOf(p.id);
            const isActive = selected?.id === p.id;
            return (
              <div key={p.id} onClick={() => setSelected(isActive ? null : p)}
                style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 14px', borderBottom: '1px solid var(--card-border)', cursor: 'pointer', background: isActive ? `color-mix(in srgb, ${color} 10%, transparent)` : 'transparent', transition: 'background 0.1s' }}>
                {/* Color dot */}
                <div style={{ width: 30, height: 30, borderRadius: 7, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                  <MapPin size={14} color={color} />
                  {inRoute && (
                    <div style={{ position: 'absolute', top: -4, right: -4, width: 13, height: 13, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--card-bg)' }}>
                      {routeIdx + 1}
                    </div>
                  )}
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.address.split(',')[0]}</div>
                </div>
                {/* Value + score */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)' }}>{p.value.toLocaleString()}€</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color, background: `${color}18`, padding: '1px 5px', borderRadius: 4 }}>{p.score}</span>
                </div>
                {/* Route toggle */}
                {routeMode && (
                  <button onClick={e => { e.stopPropagation(); toggleRoute(p.id); }}
                    style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${inRoute ? 'var(--color-primary)' : 'var(--card-border)'}`, background: inRoute ? 'var(--color-primary)' : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {inRoute && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer stats */}
        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--card-border)', display: 'flex', gap: 10, fontSize: 11, flexShrink: 0 }}>
          <span style={{ color: 'var(--text-muted)' }}>{filtered.length} prospects</span>
          <span style={{ color: 'var(--text-muted)' }}>·</span>
          <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{filtered.reduce((s, p) => s + p.value, 0).toLocaleString()}€</span>
        </div>
      </div>

      {/* ── MAP ──────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {/* Toggle sidebar button */}
        <button onClick={() => setSidebarOpen(o => !o)}
          style={{ position: 'absolute', top: 12, left: 12, zIndex: 1000, width: 34, height: 34, borderRadius: 8, border: 'none', background: 'var(--card-bg)', boxShadow: '0 2px 8px rgba(0,0,0,.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
          <List size={16} />
        </button>

        {/* Legend */}
        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 1000, background: 'var(--card-bg)', borderRadius: 10, padding: '10px 12px', boxShadow: '0 2px 10px rgba(0,0,0,.12)', minWidth: 130 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Statut</div>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: STATUS_COLORS[k], flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Leaflet map — wrapped in ErrorBoundary so a Leaflet crash doesn't blank the page */}
        <ErrorBoundary
          label="Carte indisponible pour ce compte"
          fallback={
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--text-muted)' }}>
              <MapIcon size={36} style={{ opacity: 0.3 }} />
              <span style={{ fontSize: 13 }}>Carte indisponible — rechargez la page</span>
            </div>
          }>
        <MapContainer
          center={center}
          zoom={13}
          style={{ width: '100%', height: '100%', minHeight: 400 }}
          zoomControl={false}
        >
          {/* OpenStreetMap tiles — 100% open source, no API key needed */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Fly-to when prospect selected */}
          <FlyTo prospect={selected} />

          {/* Markers */}
          {filtered.map(p => {
            const color = STATUS_COLORS[p.status] || '#6B7280';
            const routeOrder = route.indexOf(p.id) + 1;
            const isSelected = selected?.id === p.id;
            return (
              <Marker
                key={p.id}
                position={[p.lat, p.lng]}
                icon={makeIcon(color, routeOrder, isSelected)}
                eventHandlers={{ click: () => setSelected(sel => sel?.id === p.id ? null : p) }}
              >
                <Popup>
                  <div style={{ minWidth: 200, fontFamily: 'system-ui' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>{p.contact}</div>
                    <div style={{ fontSize: 12, color: '#374151', marginBottom: 6 }}>📍 {p.address}</div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <div style={{ flex: 1, textAlign: 'center', padding: '6px 0', borderRadius: 8, background: '#F3F4F6' }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#2563EB' }}>{p.value.toLocaleString()}€</div>
                        <div style={{ fontSize: 10, color: '#6B7280' }}>Valeur</div>
                      </div>
                      <div style={{ flex: 1, textAlign: 'center', padding: '6px 0', borderRadius: 8, background: '#F3F4F6' }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: p.score >= 80 ? '#059669' : '#D97706' }}>{p.score}</div>
                        <div style={{ fontSize: 10, color: '#6B7280' }}>Score</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {p.phone && (
                        <a href={`tel:${p.phone}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '6px', borderRadius: 7, background: '#EFF6FF', color: '#2563EB', fontSize: 12, textDecoration: 'none', fontWeight: 500 }}>
                          📞 Appeler
                        </a>
                      )}
                      {p.email && (
                        <a href={`mailto:${p.email}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '6px', borderRadius: 7, background: '#F3F4F6', color: '#374151', fontSize: 12, textDecoration: 'none', fontWeight: 500 }}>
                          ✉️ Email
                        </a>
                      )}
                    </div>
                    {routeMode && (
                      <button
                        onClick={() => toggleRoute(p.id)}
                        style={{ marginTop: 8, width: '100%', padding: '7px', borderRadius: 7, border: 'none', background: route.includes(p.id) ? '#ECFDF5' : color, color: route.includes(p.id) ? '#059669' : '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        {route.includes(p.id) ? '✓ Dans la tournée' : '+ Ajouter à la tournée'}
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
        </ErrorBoundary>

        {/* Selected prospect card (bottom center) */}
        {selected && (
          <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', width: 320, background: 'var(--card-bg)', borderRadius: 16, padding: 16, border: '1px solid var(--card-border)', boxShadow: '0 8px 32px rgba(0,0,0,.18)', zIndex: 1000 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{selected.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selected.contact}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 9999, background: `${STATUS_COLORS[selected.status]}18`, color: STATUS_COLORS[selected.status] }}>
                  {STATUS_LABELS[selected.status]}
                </span>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }}><X size={15} /></button>
              </div>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
              <MapPin size={11} />{selected.address}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1, padding: '8px 0', borderRadius: 10, background: 'var(--body-bg)', textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary)' }}>{selected.value.toLocaleString()}€</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Valeur</div>
              </div>
              <div style={{ flex: 1, padding: '8px 0', borderRadius: 10, background: 'var(--body-bg)', textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: selected.score >= 80 ? '#10B981' : '#F59E0B' }}>{selected.score}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Score</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {selected.phone && (
                <a href={`tel:${selected.phone}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '8px', borderRadius: 9, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-secondary)', fontSize: 12, textDecoration: 'none' }}>
                  <Phone size={12} />Appeler
                </a>
              )}
              {selected.email && (
                <a href={`mailto:${selected.email}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '8px', borderRadius: 9, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-secondary)', fontSize: 12, textDecoration: 'none' }}>
                  <Mail size={12} />Email
                </a>
              )}
              {routeMode && (
                <button onClick={() => toggleRoute(selected.id)}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '8px', borderRadius: 9, border: 'none', background: route.includes(selected.id) ? '#ECFDF5' : 'var(--color-primary)', color: route.includes(selected.id) ? '#059669' : '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  <Route size={12} />{route.includes(selected.id) ? 'Retirer' : 'Ajouter'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
