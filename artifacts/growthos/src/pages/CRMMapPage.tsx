import { useState, useEffect, useCallback } from 'react';
import { MapPin, Navigation, Route, Search, Phone, Mail, X, RotateCcw, List, Map as MapIcon, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { useQuery } from '@tanstack/react-query';
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
  new: '#9CA3AF',
  lead: '#6B7280',
  contacted: '#60A5FA',
  qualified: '#3B82F6',
  proposal: '#8B5CF6',
  negotiation: '#F59E0B',
  won: '#10B981',
  lost: '#EF4444',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'Nouveau',
  lead: 'Lead',
  contacted: 'Contacté',
  qualified: 'Qualifié',
  proposal: 'Proposition',
  negotiation: 'Négociation',
  won: 'Gagné',
  lost: 'Perdu',
};

interface MapProspect {
  id: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  address: string | null;
  lat: number;
  lng: number;
  status: string;
  score: number | null;
  phone: string | null;
  email: string | null;
}

interface MapApiResponse { data: MapProspect[]; total: number; hasGeo: boolean; }

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
  return L.divIcon({ html: svg, className: '', iconSize: [size, size + 8], iconAnchor: [size / 2, size + 8], popupAnchor: [0, -(size + 8)] });
}

function FlyTo({ prospect }: { prospect: MapProspect | null }) {
  const map = useMap();
  useEffect(() => {
    if (prospect) map.flyTo([prospect.lat, prospect.lng], 15, { duration: 0.8 });
  }, [prospect]);
  return null;
}

function displayName(p: MapProspect): string {
  return p.company || `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || 'Prospect';
}

function contactName(p: MapProspect): string {
  return `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();
}

export default function CRMMapPage() {
  const [selected, setSelected] = useState<MapProspect | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('tous');
  const [route, setRoute] = useState<string[]>([]);
  const [routeMode, setRouteMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showRoute, setShowRoute] = useState(true);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<MapApiResponse>({
    queryKey: ['prospects-map'],
    queryFn: () => apiClient.get('/prospects/map') as Promise<MapApiResponse>,
    staleTime: 60_000,
  });

  const allProspects = data?.data ?? [];

  const filtered = allProspects.filter(p => {
    const q = search.toLowerCase();
    const name = displayName(p).toLowerCase();
    const matchSearch = !q || name.includes(q) || (p.address ?? '').toLowerCase().includes(q) || contactName(p).toLowerCase().includes(q);
    const matchStatus = statusFilter === 'tous' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const toggleRoute = useCallback((id: string) =>
    setRoute(r => r.includes(id) ? r.filter(x => x !== id) : [...r, id]), []);

  const routeProspects = route.map(id => allProspects.find(p => p.id === id)).filter(Boolean) as MapProspect[];

  const routePolyline = routeProspects.map(p => [p.lat, p.lng] as [number, number]);

  // Nearest-neighbour optimisation
  const optimiseRoute = useCallback(() => {
    if (routeProspects.length < 2) return;
    const unvisited = [...routeProspects];
    const optimised: MapProspect[] = [unvisited.shift()!];
    while (unvisited.length > 0) {
      const last = optimised[optimised.length - 1];
      let nearestIdx = 0;
      let nearestDist = Infinity;
      for (let i = 0; i < unvisited.length; i++) {
        const d = Math.hypot(unvisited[i].lat - last.lat, unvisited[i].lng - last.lng);
        if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
      }
      optimised.push(unvisited.splice(nearestIdx, 1)[0]);
    }
    setRoute(optimised.map(p => p.id));
  }, [routeProspects]);

  const openGoogleMaps = useCallback(() => {
    if (routeProspects.length === 0) return;
    const waypoints = routeProspects.map(p => `${p.lat},${p.lng}`).join('/');
    window.open(`https://www.google.com/maps/dir/${waypoints}`, '_blank');
  }, [routeProspects]);

  const center: [number, number] = allProspects.length > 0
    ? [allProspects[0].lat, allProspects[0].lng]
    : [48.8566, 2.3522];

  const hasData = allProspects.length > 0;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 48px)', background: 'var(--body-bg)', position: 'relative' }}>

      {/* ── SIDEBAR ──────────────────────────────────── */}
      <div style={{ width: sidebarOpen ? 300 : 0, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--card-bg)', borderRight: '1px solid var(--card-border)', overflow: 'hidden', transition: 'width 0.25s ease', position: 'relative', zIndex: 500 }}>

        {/* Header */}
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--card-border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
              <MapPin size={15} color="var(--color-primary)" />CRM Map
            </h1>
            <div style={{ display: 'flex', gap: 5 }}>
              <button onClick={() => refetch()} disabled={isFetching}
                style={{ display: 'flex', alignItems: 'center', padding: '3px 6px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}>
                <RefreshCw size={11} style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} />
              </button>
              <button onClick={() => setRouteMode(r => !r)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: routeMode ? 'var(--color-primary)' : 'var(--body-bg)', color: routeMode ? '#fff' : 'var(--text-secondary)', boxShadow: '0 0 0 1px var(--card-border)' }}>
                <Route size={11} />Tournée
              </button>
            </div>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom, entreprise, adresse…"
              style={{ width: '100%', paddingLeft: 28, paddingRight: 8, paddingTop: 6, paddingBottom: 6, borderRadius: 7, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
          </div>

          {/* Status pills */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {['tous', 'new', 'qualified', 'proposal', 'negotiation', 'won'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                style={{ padding: '2px 7px', borderRadius: 5, border: 'none', fontSize: 10, fontWeight: 600, cursor: 'pointer', background: statusFilter === s ? (s === 'tous' ? 'var(--color-primary)' : STATUS_COLORS[s]) : 'var(--body-bg)', color: statusFilter === s ? '#fff' : 'var(--text-muted)', boxShadow: '0 0 0 1px var(--card-border)' }}>
                {s === 'tous' ? 'Tous' : STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Route summary */}
        {routeMode && route.length > 0 && (
          <div style={{ padding: '8px 12px', background: `color-mix(in srgb, var(--color-primary) 8%, transparent)`, borderBottom: '1px solid var(--card-border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)' }}>Tournée · {route.length} arrêt{route.length > 1 ? 's' : ''}</span>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                <button onClick={optimiseRoute} title="Optimiser" style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, border: 'none', background: 'var(--card-bg)', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600 }}>⚡ Optimiser</button>
                <button onClick={() => setRoute([])} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', lineHeight: 1 }}><RotateCcw size={11} /></button>
              </div>
            </div>
            {routeProspects.map((p, i) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>
                <div style={{ width: 15, height: 15, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{displayName(p)}</span>
                <button onClick={() => toggleRoute(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', lineHeight: 1, padding: 0 }}><X size={10} /></button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
              <button onClick={() => setShowRoute(s => !s)}
                style={{ flex: 1, padding: '5px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>
                {showRoute ? '👁 Cacher tracé' : '👁 Afficher tracé'}
              </button>
              <button onClick={openGoogleMaps}
                style={{ flex: 1, padding: '5px', borderRadius: 6, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <Navigation size={11} />Google Maps
              </button>
            </div>
          </div>
        )}

        {/* Loading / empty states */}
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 10, color: 'var(--text-muted)' }}>
            <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 12 }}>Chargement des prospects…</span>
          </div>
        )}

        {isError && (
          <div style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, background: '#FEF2F2', border: '1px solid #FEE2E2', color: '#DC2626', fontSize: 12 }}>
              <AlertCircle size={13} />Erreur de chargement
            </div>
          </div>
        )}

        {!isLoading && !isError && !hasData && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 10, padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
            <MapPin size={28} style={{ opacity: 0.3 }} />
            <div style={{ fontSize: 13, fontWeight: 600 }}>Aucun prospect géolocalisé</div>
            <div style={{ fontSize: 11, lineHeight: 1.5 }}>
              Ajoutez une adresse lors de la création d'un prospect — les coordonnées GPS seront calculées automatiquement.
            </div>
          </div>
        )}

        {/* Prospect list */}
        {!isLoading && hasData && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>Aucun résultat</div>
            ) : filtered.map(p => {
              const color = STATUS_COLORS[p.status] || '#6B7280';
              const inRoute = route.includes(p.id);
              const routeIdx = route.indexOf(p.id);
              const isActive = selected?.id === p.id;
              return (
                <div key={p.id} onClick={() => setSelected(isActive ? null : p)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderBottom: '1px solid var(--card-border)', cursor: 'pointer', background: isActive ? `color-mix(in srgb, ${color} 10%, transparent)` : 'transparent', transition: 'background 0.1s' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                    <MapPin size={13} color={color} />
                    {inRoute && (
                      <div style={{ position: 'absolute', top: -4, right: -4, width: 13, height: 13, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--card-bg)' }}>
                        {routeIdx + 1}
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName(p)}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.address?.split(',')[0] ?? '—'}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color, background: `${color}18`, padding: '1px 5px', borderRadius: 4 }}>{p.score ?? 0}</span>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{STATUS_LABELS[p.status] ?? p.status}</span>
                  </div>
                  {routeMode && (
                    <button onClick={e => { e.stopPropagation(); toggleRoute(p.id); }}
                      style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${inRoute ? 'var(--color-primary)' : 'var(--card-border)'}`, background: inRoute ? 'var(--color-primary)' : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {inRoute && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer stats */}
        {!isLoading && hasData && (
          <div style={{ padding: '7px 12px', borderTop: '1px solid var(--card-border)', display: 'flex', gap: 8, fontSize: 11, flexShrink: 0, alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>{filtered.length} / {allProspects.length} prospects</span>
            {data && !data.hasGeo && (
              <span style={{ fontSize: 10, color: '#F59E0B', marginLeft: 'auto' }}>⚠️ Aucun géocodé</span>
            )}
          </div>
        )}
      </div>

      {/* ── MAP ──────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <button onClick={() => setSidebarOpen(o => !o)}
          style={{ position: 'absolute', top: 12, left: 12, zIndex: 1000, width: 34, height: 34, borderRadius: 8, border: 'none', background: 'var(--card-bg)', boxShadow: '0 2px 8px rgba(0,0,0,.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
          <List size={16} />
        </button>

        {/* Legend */}
        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 1000, background: 'var(--card-bg)', borderRadius: 10, padding: '10px 12px', boxShadow: '0 2px 10px rgba(0,0,0,.12)', minWidth: 120 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Statut</div>
          {Object.entries(STATUS_LABELS).filter(([k]) => ['qualified', 'proposal', 'negotiation', 'won', 'new'].includes(k)).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[k], flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{v}</span>
            </div>
          ))}
        </div>

        <ErrorBoundary
          label="Carte indisponible"
          fallback={
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--text-muted)' }}>
              <MapIcon size={36} style={{ opacity: 0.3 }} />
              <span style={{ fontSize: 13 }}>Carte indisponible — rechargez la page</span>
            </div>
          }>
          <MapContainer
            center={center}
            zoom={hasData ? 12 : 6}
            style={{ width: '100%', height: '100%', minHeight: 400 }}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <FlyTo prospect={selected} />

            {/* Route polyline */}
            {routeMode && showRoute && routePolyline.length > 1 && (
              <Polyline
                positions={routePolyline}
                pathOptions={{ color: 'var(--color-primary)', weight: 3, opacity: 0.7, dashArray: '8, 6' }}
              />
            )}

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
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{displayName(p)}</div>
                      {contactName(p) && <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>{contactName(p)}</div>}
                      {p.address && <div style={{ fontSize: 12, color: '#374151', marginBottom: 8 }}>📍 {p.address}</div>}
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <div style={{ flex: 1, textAlign: 'center', padding: '5px 0', borderRadius: 7, background: '#F3F4F6' }}>
                          <div style={{ fontWeight: 700, fontSize: 12, color: STATUS_COLORS[p.status] ?? '#6B7280' }}>{STATUS_LABELS[p.status] ?? p.status}</div>
                          <div style={{ fontSize: 10, color: '#6B7280' }}>Statut</div>
                        </div>
                        <div style={{ flex: 1, textAlign: 'center', padding: '5px 0', borderRadius: 7, background: '#F3F4F6' }}>
                          <div style={{ fontWeight: 700, fontSize: 12, color: (p.score ?? 0) >= 80 ? '#059669' : '#D97706' }}>{p.score ?? 0}</div>
                          <div style={{ fontSize: 10, color: '#6B7280' }}>Score</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {p.phone && (
                          <a href={`tel:${p.phone}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '5px', borderRadius: 6, background: '#EFF6FF', color: '#2563EB', fontSize: 11, textDecoration: 'none', fontWeight: 500 }}>
                            📞 Appeler
                          </a>
                        )}
                        {p.email && (
                          <a href={`mailto:${p.email}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '5px', borderRadius: 6, background: '#F3F4F6', color: '#374151', fontSize: 11, textDecoration: 'none', fontWeight: 500 }}>
                            ✉️ Email
                          </a>
                        )}
                      </div>
                      {routeMode && (
                        <button onClick={() => toggleRoute(p.id)}
                          style={{ marginTop: 8, width: '100%', padding: '6px', borderRadius: 6, border: 'none', background: route.includes(p.id) ? '#ECFDF5' : color, color: route.includes(p.id) ? '#059669' : '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
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

        {/* Selected prospect card */}
        {selected && (
          <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', width: 310, background: 'var(--card-bg)', borderRadius: 16, padding: 14, border: '1px solid var(--card-border)', boxShadow: '0 8px 32px rgba(0,0,0,.18)', zIndex: 1000 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{displayName(selected)}</div>
                {contactName(selected) && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{contactName(selected)}</div>}
              </div>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 9999, background: `${STATUS_COLORS[selected.status] ?? '#6B7280'}18`, color: STATUS_COLORS[selected.status] ?? '#6B7280' }}>
                  {STATUS_LABELS[selected.status] ?? selected.status}
                </span>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }}><X size={14} /></button>
              </div>
            </div>
            {selected.address && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={10} />{selected.address}
              </div>
            )}
            <div style={{ display: 'flex', gap: 7 }}>
              {selected.phone && (
                <a href={`tel:${selected.phone}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '7px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-secondary)', fontSize: 12, textDecoration: 'none' }}>
                  <Phone size={11} />Appeler
                </a>
              )}
              {selected.email && (
                <a href={`mailto:${selected.email}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '7px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-secondary)', fontSize: 12, textDecoration: 'none' }}>
                  <Mail size={11} />Email
                </a>
              )}
              {routeMode && (
                <button onClick={() => toggleRoute(selected.id)}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '7px', borderRadius: 8, border: 'none', background: route.includes(selected.id) ? '#ECFDF5' : 'var(--color-primary)', color: route.includes(selected.id) ? '#059669' : '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  <Route size={11} />{route.includes(selected.id) ? 'Retirer' : 'Ajouter'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
