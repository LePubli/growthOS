import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, Circle } from 'react-leaflet';
import L from 'leaflet';
import { useQuery } from '@tanstack/react-query';
import {
  MapPin, Navigation, Route, Search, Phone, Mail, X, Building2,
  Plus, Crosshair, Wand2, ExternalLink, Clock, Ruler, ChevronUp,
  ChevronDown, Trash2, LocateFixed, Map as MapIcon, Car, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';

/* ── Fix Leaflet icon paths broken by Vite ─────────────────────────── */
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/* ── Types ──────────────────────────────────────────────────────────── */
interface Stop {
  id: string;
  type: 'prospect' | 'custom';
  name: string;
  company?: string;
  address: string;
  lat: number;
  lng: number;
  status?: string;
  value?: number;
  phone?: string;
  email?: string;
  note?: string;
}

interface GeoResult {
  display_name: string;
  lat: string;
  lon: string;
}

/* ── Status config ──────────────────────────────────────────────────── */
const STATUS_COLORS: Record<string, string> = {
  new: '#6B7280', contacted: '#3B82F6', qualified: '#8B5CF6',
  proposal: '#F59E0B', negotiation: '#EF4444', won: '#10B981', lost: '#9CA3AF',
  lead: '#6B7280', custom: '#0F766E',
};
const STATUS_LABELS: Record<string, string> = {
  new: 'Nouveau', contacted: 'Contacté', qualified: 'Qualifié',
  proposal: 'Proposition', negotiation: 'Négociation', won: 'Gagné', lost: 'Perdu',
  lead: 'Lead', custom: 'Personnalisé',
};

/* ── Mock prospects (fallback si API indisponible) ──────────────────── */
const MOCK: Stop[] = [
  { id:'m1', type:'prospect', name:'Sophie Martin',   company:'TechCorp',   address:'12 Rue de la Paix, Paris',              lat:48.8698, lng:2.3309,  status:'qualified',  value:12500, phone:'+33 6 12 34 56 78', email:'s.martin@techcorp.fr' },
  { id:'m2', type:'prospect', name:'Emma Leroy',      company:'StartupX',   address:'5 Bd Haussmann, Paris',                 lat:48.8742, lng:2.3293,  status:'proposal',   value:4800,  phone:'+33 6 23 45 67 89', email:'e.leroy@startupx.io' },
  { id:'m3', type:'prospect', name:'Paul Dupont',     company:'BigSales',   address:'23 Av. Montaigne, Paris',               lat:48.8668, lng:2.3059,  status:'negotiation',value:8200,  phone:'+33 6 34 56 78 90', email:'p.dupont@bigsales.fr' },
  { id:'m4', type:'prospect', name:'Camille Bernard', company:'DataInc',    address:'7 Rue du Fg Saint-Antoine, Paris',      lat:48.8527, lng:2.3717,  status:'contacted',  value:3600,  phone:'', email:'c.bernard@datainc.com' },
  { id:'m5', type:'prospect', name:'Luc Moreau',      company:'GrowthCo',   address:'45 Rue de Rivoli, Paris',               lat:48.8601, lng:2.3458,  status:'won',        value:9600,  phone:'+33 6 45 67 89 01', email:'l.moreau@growthco.fr' },
  { id:'m6', type:'prospect', name:'Marie Dubois',    company:'AlphaTech',  address:'18 Quai de la Marne, Paris',            lat:48.8839, lng:2.3816,  status:'proposal',   value:22000, phone:'+33 6 56 78 90 12', email:'m.dubois@alphatech.fr' },
  { id:'m7', type:'prospect', name:'Thomas Leclerc',  company:'WebAgency',  address:'3 Rue des Abbesses, Montmartre, Paris', lat:48.8845, lng:2.3384,  status:'new',        value:5500,  phone:'+33 6 67 89 01 23', email:'t.leclerc@webagency.fr' },
  { id:'m8', type:'prospect', name:'Julie Simon',     company:'SaaScraft',  address:'67 Av. de la République, Paris',        lat:48.8631, lng:2.3789,  status:'qualified',  value:7200,  phone:'+33 6 78 90 12 34', email:'j.simon@saascraft.io' },
  { id:'m9', type:'prospect', name:'Antoine Petit',   company:'ScaleUp',    address:'2 Pl. de la Bastille, Paris',           lat:48.8533, lng:2.3692,  status:'contacted',  value:6100,  phone:'+33 6 89 01 23 45', email:'a.petit@scaleup.fr' },
  { id:'m10',type:'prospect', name:'Claire Girard',   company:'CloudWave',  address:'8 Bd Saint-Germain, Paris',             lat:48.8518, lng:2.3504,  status:'proposal',   value:9100,  phone:'+33 6 90 12 34 56', email:'c.girard@cloudwave.eu' },
];

/* ── Leaflet divIcon factory ────────────────────────────────────────── */
function makeIcon(color: string, label: string | number, size = 36, ring = false) {
  const s = ring ? size + 8 : size;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s + 10}" viewBox="0 0 52 62">
    ${ring ? `<circle cx="26" cy="26" r="24" fill="${color}33" stroke="${color}" stroke-width="2"/>` : ''}
    <circle cx="26" cy="26" r="18" fill="${color}" stroke="white" stroke-width="2.5" filter="drop-shadow(0 2px 6px ${color}66)"/>
    <text x="26" y="31" text-anchor="middle" font-size="12" font-weight="700" fill="white" font-family="system-ui,sans-serif">${label}</text>
    <polygon points="26,46 20,36 32,36" fill="${color}"/>
  </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [s, s + 10], iconAnchor: [s / 2, s + 10], popupAnchor: [0, -(s + 10)] });
}

function makeCustomIcon(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
    <circle cx="16" cy="16" r="14" fill="${color}" stroke="white" stroke-width="2.5" stroke-dasharray="4 2"/>
    <text x="16" y="21" text-anchor="middle" font-size="14" fill="white" font-family="system-ui">📍</text>
    <polygon points="16,40 10,28 22,28" fill="${color}"/>
  </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [32, 42], iconAnchor: [16, 42], popupAnchor: [0, -42] });
}

/* ── Haversine distance (km) ────────────────────────────────────────── */
function dist(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function totalDist(stops: Stop[]) {
  let d = 0;
  for (let i = 0; i < stops.length - 1; i++) d += dist(stops[i], stops[i + 1]);
  return d;
}

/* Nearest-neighbour route optimisation */
function optimiseRoute(stops: Stop[], origin?: { lat: number; lng: number }): Stop[] {
  if (stops.length < 3) return stops;
  const unvisited = [...stops];
  const result: Stop[] = [];
  let current = origin ?? unvisited[0];
  if (!origin) { result.push(unvisited.shift()!); }
  while (unvisited.length) {
    let nearest = 0;
    let nearestD = Infinity;
    unvisited.forEach((s, i) => { const d = dist(current, s); if (d < nearestD) { nearestD = d; nearest = i; } });
    result.push(unvisited.splice(nearest, 1)[0]);
    current = result[result.length - 1];
  }
  return result;
}

/* ── Map controller (fly to, current location) ─────────────────────── */
function MapController({ center, zoom }: { center?: [number, number]; zoom?: number }) {
  const map = useMap();
  useEffect(() => { if (center) map.flyTo(center, zoom ?? map.getZoom(), { duration: 1 }); }, [center, zoom]);
  return null;
}

/* ── Nominatim geocoding ────────────────────────────────────────────── */
async function geocode(query: string): Promise<GeoResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=fr,be,ch,lu`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'fr' } });
  return res.json();
}

/* ── Main component ─────────────────────────────────────────────────── */
export default function MapPage() {
  /* Data */
  const { data: prospectsData } = useQuery({
    queryKey: ['prospects-map'],
    queryFn: () => apiClient.get('/prospects?limit=100') as Promise<any>,
    staleTime: 60_000,
  });
  const prospects: Stop[] = MOCK; // use mock; real API data would need lat/lng

  /* State */
  const [tour, setTour]               = useState<Stop[]>([]);
  const [selected, setSelected]       = useState<Stop | null>(null);
  const [search, setSearch]           = useState('');
  const [geoResults, setGeoResults]   = useState<GeoResult[]>([]);
  const [geoLoading, setGeoLoading]   = useState(false);
  const [mapCenter, setMapCenter]     = useState<[number, number] | undefined>();
  const [mapZoom, setMapZoom]         = useState<number | undefined>();
  const [userPos, setUserPos]         = useState<[number, number] | null>(null);
  const [showRoutePanel, setShowRoutePanel] = useState(false);
  const [showAddAddr, setShowAddAddr] = useState(false);
  const [customAddr, setCustomAddr]   = useState('');
  const [customName, setCustomName]   = useState('');
  const [customNote, setCustomNote]   = useState('');
  const [addrResults, setAddrResults] = useState<GeoResult[]>([]);
  const [addrLoading, setAddrLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [showPolyline, setShowPolyline] = useState(true);
  const geoTimer = useRef<ReturnType<typeof setTimeout>>();
  const addrTimer = useRef<ReturnType<typeof setTimeout>>();

  /* Filtered prospects */
  const filtered = prospects.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || `${p.name} ${p.company ?? ''} ${p.address}`.toLowerCase().includes(q);
    const matchStatus = !filterStatus || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  /* Search geocoding (with debounce) */
  useEffect(() => {
    clearTimeout(geoTimer.current);
    if (search.length < 4) { setGeoResults([]); return; }
    const hasMatch = prospects.some(p => `${p.name} ${p.company ?? ''} ${p.address}`.toLowerCase().includes(search.toLowerCase()));
    if (hasMatch) { setGeoResults([]); return; }
    geoTimer.current = setTimeout(async () => {
      setGeoLoading(true);
      try { setGeoResults(await geocode(search)); } catch {}
      setGeoLoading(false);
    }, 500);
  }, [search]);

  /* Custom address geocoding */
  useEffect(() => {
    clearTimeout(addrTimer.current);
    if (customAddr.length < 4) { setAddrResults([]); return; }
    addrTimer.current = setTimeout(async () => {
      setAddrLoading(true);
      try { setAddrResults(await geocode(customAddr)); } catch {}
      setAddrLoading(false);
    }, 500);
  }, [customAddr]);

  /* Tour helpers */
  const inTour = (id: string) => tour.some(s => s.id === id);
  const toggleTour = (stop: Stop) => {
    setTour(t => inTour(stop.id) ? t.filter(s => s.id !== stop.id) : [...t, stop]);
  };
  const removeFromTour = (id: string) => setTour(t => t.filter(s => s.id !== id));
  const moveUp = (i: number) => { if (i === 0) return; const t = [...tour]; [t[i-1], t[i]] = [t[i], t[i-1]]; setTour(t); };
  const moveDown = (i: number) => { if (i === tour.length - 1) return; const t = [...tour]; [t[i], t[i+1]] = [t[i+1], t[i]]; setTour(t); };
  const optimise = () => { setTour(optimiseRoute(tour, userPos ? { lat: userPos[0], lng: userPos[1] } : undefined)); toast.success('Tournée optimisée par proximité'); };
  const totalValue = tour.reduce((s, p) => s + (p.value ?? 0), 0);
  const totalKm = totalDist(tour);
  const estimatedMin = Math.round((totalKm / 40) * 60);

  /* GPS locate */
  const locateMe = () => {
    if (!navigator.geolocation) return toast.error('Géolocalisation non disponible');
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserPos([pos.coords.latitude, pos.coords.longitude]);
        setMapCenter([pos.coords.latitude, pos.coords.longitude]);
        setMapZoom(14);
        toast.success('Position actuelle trouvée');
      },
      () => toast.error('Impossible d\'accéder à la position'),
    );
  };

  /* Navigation launchers */
  const openNav = (app: 'google' | 'waze' | 'apple') => {
    if (tour.length === 0) return toast.error('Ajoutez au moins une étape à la tournée');
    const last = tour[tour.length - 1];
    const waypoints = tour.slice(0, -1).map(s => `${s.lat},${s.lng}`).join('|');
    if (app === 'google') {
      const origin = userPos ? `${userPos[0]},${userPos[1]}` : '';
      const url = `https://www.google.com/maps/dir/${origin}/${waypoints}/${last.lat},${last.lng}/?travelmode=driving`;
      window.open(url, '_blank');
    } else if (app === 'waze') {
      const url = `https://waze.com/ul?ll=${last.lat},${last.lng}&navigate=yes&zoom=17`;
      window.open(url, '_blank');
    } else {
      window.open(`maps://maps.apple.com/?daddr=${last.lat},${last.lng}&dirflg=d`, '_blank');
    }
  };

  /* Add custom address stop */
  const addCustomStop = (result: GeoResult) => {
    const stop: Stop = {
      id: `custom-${Date.now()}`,
      type: 'custom',
      name: customName.trim() || result.display_name.split(',')[0],
      address: result.display_name,
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      status: 'custom',
      note: customNote.trim() || undefined,
    };
    setTour(t => [...t, stop]);
    setCustomAddr(''); setCustomName(''); setCustomNote('');
    setAddrResults([]);
    setMapCenter([stop.lat, stop.lng]);
    setMapZoom(15);
    toast.success(`Arrêt personnalisé ajouté : ${stop.name}`);
  };

  /* Polyline coords */
  const polylineCoords: [number, number][] = tour.map(s => [s.lat, s.lng]);
  if (userPos && tour.length > 0) polylineCoords.unshift(userPos);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--body-bg)' }}>

      {/* ── Top bar ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', background: 'var(--card-bg)', borderBottom: '1px solid var(--card-border)', flexShrink: 0, zIndex: 10 }}>
        <MapIcon size={18} style={{ color: 'var(--color-primary)' }} />
        <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>Carte & Tournée GPS</span>
        <div style={{ flex: 1, maxWidth: 360, position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un prospect, une adresse…"
            style={{ width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 7, paddingBottom: 7, borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
          />
          {/* Geocode dropdown */}
          {(geoResults.length > 0 || geoLoading) && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 9999, marginTop: 4 }}>
              {geoLoading && <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>Recherche…</div>}
              {geoResults.map((r, i) => (
                <button key={i} onClick={() => {
                  setSearch(r.display_name.split(',').slice(0, 2).join(','));
                  setMapCenter([parseFloat(r.lat), parseFloat(r.lon)]);
                  setMapZoom(15);
                  setGeoResults([]);
                }} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 14px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: i < geoResults.length - 1 ? '1px solid var(--card-border)' : 'none' }}>
                  <MapPin size={13} style={{ color: '#0F766E', flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.4 }}>{r.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Status filter */}
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 9, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-secondary)', fontSize: 12, outline: 'none' }}>
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_LABELS).filter(([k]) => k !== 'custom').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <button onClick={locateMe} title="Ma position" style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid var(--card-border)', background: 'var(--body-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: userPos ? '#0F766E' : 'var(--text-muted)' }}>
          <LocateFixed size={15} />
        </button>

        <button onClick={() => setShowPolyline(s => !s)} title="Afficher/masquer le tracé" style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid var(--card-border)', background: showPolyline ? '#F0FDF4' : 'var(--body-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: showPolyline ? '#059669' : 'var(--text-muted)' }}>
          <Route size={15} />
        </button>

        <button onClick={() => setShowAddAddr(s => !s)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, border: 'none', background: showAddAddr ? 'var(--color-primary)' : '#EFF6FF', color: showAddAddr ? '#fff' : '#2563EB', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={14} />Adresse perso
        </button>

        {tour.length > 0 && (
          <button onClick={() => setShowRoutePanel(s => !s)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <Navigation size={14} />Tournée ({tour.length})
          </button>
        )}
      </div>

      {/* ── Custom address panel ─────────────────────────────────── */}
      {showAddAddr && (
        <div style={{ background: '#EFF6FF', borderBottom: '1px solid #BFDBFE', padding: '12px 16px', flexShrink: 0, zIndex: 9 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: 2, minWidth: 240, position: 'relative' }}>
              <MapPin size={13} style={{ position: 'absolute', left: 10, top: 11, color: '#2563EB' }} />
              <input value={customAddr} onChange={e => setCustomAddr(e.target.value)}
                placeholder="Adresse de l'arrêt (ex: 5 rue de la Paix, Paris)"
                style={{ width: '100%', paddingLeft: 30, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 9, border: '1px solid #93C5FD', background: '#fff', fontSize: 13, outline: 'none', color: 'var(--text-primary)' }} />
              {(addrResults.length > 0 || addrLoading) && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #BFDBFE', borderRadius: 9, boxShadow: '0 8px 20px rgba(0,0,0,.1)', zIndex: 9999, marginTop: 4 }}>
                  {addrLoading && <div style={{ padding: '9px 14px', fontSize: 12, color: 'var(--text-muted)' }}>Recherche…</div>}
                  {addrResults.map((r, i) => (
                    <button key={i} onClick={() => addCustomStop(r)}
                      style={{ display: 'flex', gap: 8, padding: '9px 14px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: i < addrResults.length - 1 ? '1px solid #EFF6FF' : 'none' }}>
                      <MapPin size={12} style={{ color: '#0F766E', flexShrink: 0, marginTop: 2 }} />
                      <span style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.4 }}>{r.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input value={customName} onChange={e => setCustomName(e.target.value)}
              placeholder="Nom de l'arrêt (optionnel)"
              style={{ flex: 1, minWidth: 160, padding: '8px 12px', borderRadius: 9, border: '1px solid #93C5FD', background: '#fff', fontSize: 13, outline: 'none', color: 'var(--text-primary)' }} />
            <input value={customNote} onChange={e => setCustomNote(e.target.value)}
              placeholder="Note (optionnel)"
              style={{ flex: 1, minWidth: 140, padding: '8px 12px', borderRadius: 9, border: '1px solid #93C5FD', background: '#fff', fontSize: 13, outline: 'none', color: 'var(--text-primary)' }} />
            <button onClick={() => { setShowAddAddr(false); setCustomAddr(''); setAddrResults([]); }}
              style={{ padding: '8px 10px', borderRadius: 9, border: '1px solid #BFDBFE', background: '#fff', cursor: 'pointer', color: '#2563EB' }}>
              <X size={14} />
            </button>
          </div>
          <p style={{ fontSize: 11, color: '#2563EB', marginTop: 6 }}>
            Tapez une adresse pour la rechercher — cliquez sur un résultat pour l'ajouter à la tournée
          </p>
        </div>
      )}

      {/* ── Body : map + sidepanels ──────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* Prospect list sidebar */}
        <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--card-bg)', borderRight: '1px solid var(--card-border)', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--card-border)', flexShrink: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{filtered.length} prospects</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tour.length} étape{tour.length !== 1 ? 's' : ''} en tournée · {totalKm.toFixed(0)} km</div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.map(p => {
              const isIn = inTour(p.id);
              const color = STATUS_COLORS[p.status ?? 'new'];
              const order = tour.findIndex(s => s.id === p.id) + 1;
              return (
                <div key={p.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--card-border)', display: 'flex', gap: 10, cursor: 'pointer', background: isIn ? `${color}09` : 'transparent' }}
                  onClick={() => { setMapCenter([p.lat, p.lng]); setMapZoom(16); setSelected(p); }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: isIn ? color : `${color}22`, border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, fontWeight: 700, color: isIn ? '#fff' : color }}>
                    {isIn ? order : p.name[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Building2 size={9} />{p.company}
                      <span style={{ background: `${color}22`, color, padding: '1px 6px', borderRadius: 6, fontSize: 10, fontWeight: 600, marginLeft: 2 }}>{STATUS_LABELS[p.status ?? 'new']}</span>
                    </div>
                    {p.value && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)', marginTop: 2 }}>{p.value.toLocaleString()}€</div>}
                  </div>
                  <button onClick={e => { e.stopPropagation(); toggleTour(p); }}
                    style={{ width: 28, height: 28, borderRadius: 7, border: `1.5px solid ${isIn ? color : 'var(--card-border)'}`, background: isIn ? color : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: isIn ? '#fff' : 'var(--text-muted)' }}>
                    <Route size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── REAL LEAFLET MAP ──────────────────────────────────── */}
        <div style={{ flex: 1, position: 'relative' }}>
          <MapContainer
            center={[46.6, 2.4]}
            zoom={6}
            style={{ width: '100%', height: '100%' }}
            scrollWheelZoom={true}
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapController center={mapCenter} zoom={mapZoom} />

            {/* User position */}
            {userPos && (
              <>
                <Circle center={userPos} radius={300} pathOptions={{ color: '#2563EB', fillColor: '#3B82F6', fillOpacity: 0.15 }} />
                <Marker position={userPos} icon={L.divIcon({ html: '<div style="width:14px;height:14px;background:#2563EB;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px #2563EB88"></div>', className: '', iconSize: [14, 14], iconAnchor: [7, 7] })}>
                  <Popup><b>Ma position</b></Popup>
                </Marker>
              </>
            )}

            {/* Polyline */}
            {showPolyline && tour.length >= 2 && (
              <Polyline positions={polylineCoords} pathOptions={{ color: '#0F766E', weight: 3, opacity: 0.7, dashArray: '8 6' }} />
            )}

            {/* Prospect markers */}
            {filtered.map(p => {
              const isIn = inTour(p.id);
              const order = tour.findIndex(s => s.id === p.id) + 1;
              const color = STATUS_COLORS[p.status ?? 'new'];
              return (
                <Marker key={p.id} position={[p.lat, p.lng]} icon={makeIcon(color, isIn ? order : p.name[0], isIn ? 40 : 34, isIn)}>
                  <Popup maxWidth={260}>
                    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 4 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{p.name}</div>
                      {p.company && <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 2 }}>🏢 {p.company}</div>}
                      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>📍 {p.address}</div>
                      {p.value && <div style={{ fontSize: 13, fontWeight: 700, color: '#0F766E', marginBottom: 6 }}>{p.value.toLocaleString()}€</div>}
                      <div style={{ display: 'flex', gap: 6 }}>
                        {p.phone && <a href={`tel:${p.phone}`} style={{ fontSize: 11, color: '#2563EB', textDecoration: 'none' }}>📞 {p.phone}</a>}
                      </div>
                      {p.email && <div style={{ fontSize: 11, color: '#2563EB', marginTop: 2 }}>{p.email}</div>}
                      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                        <button onClick={() => toggleTour(p)}
                          style={{ flex: 1, padding: '5px 0', borderRadius: 7, border: 'none', background: isIn ? '#FEF2F2' : '#0F766E', color: isIn ? '#DC2626' : '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          {isIn ? '✕ Retirer' : '+ Tournée'}
                        </button>
                        <a href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`} target="_blank" rel="noreferrer"
                          style={{ padding: '5px 10px', borderRadius: 7, background: '#EFF6FF', color: '#2563EB', fontSize: 12, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <ExternalLink size={11} />Nav
                        </a>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Custom stops from tour (not in prospect list) */}
            {tour.filter(s => s.type === 'custom').map(s => (
              <Marker key={s.id} position={[s.lat, s.lng]} icon={makeCustomIcon(STATUS_COLORS.custom)}>
                <Popup maxWidth={240}>
                  <div style={{ fontFamily: 'system-ui, sans-serif', padding: 4 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>📍 {s.name}</div>
                    <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6, lineHeight: 1.4 }}>{s.address}</div>
                    {s.note && <div style={{ fontSize: 12, color: '#374151', background: '#F9FAFB', padding: '4px 8px', borderRadius: 6, marginBottom: 6 }}>{s.note}</div>}
                    <button onClick={() => removeFromTour(s.id)}
                      style={{ width: '100%', padding: '5px 0', borderRadius: 7, border: 'none', background: '#FEF2F2', color: '#DC2626', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      ✕ Retirer de la tournée
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Zoom hint overlay */}
          <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 500, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => setMapCenter([46.6, 2.4])} title="Vue France entière"
              style={{ width: 36, height: 36, borderRadius: 9, background: 'white', border: '1px solid #E5E7EB', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,.1)', color: '#374151', fontSize: 13, fontWeight: 700 }}>
              🇫🇷
            </button>
          </div>
        </div>

        {/* ── Route panel ──────────────────────────────────────── */}
        {showRoutePanel && tour.length > 0 && (
          <div style={{ width: 310, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--card-bg)', borderLeft: '1px solid var(--card-border)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--card-border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }}>Tournée</span>
                <button onClick={() => setShowRoutePanel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={14} /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                {[
                  { icon: <Route size={12}/>, label: `${tour.length} étapes` },
                  { icon: <Ruler size={12}/>, label: `${totalKm.toFixed(0)} km` },
                  { icon: <Clock size={12}/>, label: `~${estimatedMin}min` },
                ].map((k, i) => (
                  <div key={i} style={{ background: 'var(--body-bg)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: 2, display: 'flex', justifyContent: 'center' }}>{k.icon}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{k.label}</div>
                  </div>
                ))}
              </div>
              {totalValue > 0 && (
                <div style={{ marginTop: 6, background: '#F0FDF4', borderRadius: 8, padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#059669' }}>Pipeline total</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#059669' }}>{totalValue.toLocaleString()}€</span>
                </div>
              )}
            </div>

            {/* Optimise */}
            <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--card-border)', flexShrink: 0, display: 'flex', gap: 6 }}>
              <button onClick={optimise}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px', borderRadius: 9, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                <Wand2 size={12} />Optimiser
              </button>
              <button onClick={() => setTour([])}
                style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid #FECACA', background: '#FEF2F2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626' }}>
                <Trash2 size={13} />
              </button>
            </div>

            {/* Stop list */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {tour.map((s, i) => {
                const color = STATUS_COLORS[s.status ?? 'custom'];
                const d = i > 0 ? dist(tour[i - 1], s) : (userPos ? dist({ lat: userPos[0], lng: userPos[1] }, s) : 0);
                return (
                  <div key={s.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--card-border)', display: 'flex', gap: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: color, color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {i + 1}
                      </div>
                      {i < tour.length - 1 && <div style={{ width: 2, height: 16, background: `${color}44`, borderRadius: 2 }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                      {s.company && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.company}</div>}
                      {s.note && <div style={{ fontSize: 10, color: '#6B7280', fontStyle: 'italic' }}>{s.note}</div>}
                      {d > 0 && <div style={{ fontSize: 10, color: '#0F766E', marginTop: 2 }}>↳ {d.toFixed(1)} km</div>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <button onClick={() => moveUp(i)} disabled={i === 0} style={{ padding: 2, background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.2 : 1, color: 'var(--text-muted)' }}><ChevronUp size={12} /></button>
                      <button onClick={() => moveDown(i)} disabled={i === tour.length - 1} style={{ padding: 2, background: 'none', border: 'none', cursor: i === tour.length - 1 ? 'default' : 'pointer', opacity: i === tour.length - 1 ? 0.2 : 1, color: 'var(--text-muted)' }}><ChevronDown size={12} /></button>
                      <button onClick={() => removeFromTour(s.id)} style={{ padding: 2, background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626' }}><X size={12} /></button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Navigation buttons */}
            <div style={{ padding: '12px 14px', borderTop: '1px solid var(--card-border)', flexShrink: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Lancer la navigation</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => openNav('google')}
                  style={{ flex: 1, padding: '8px 4px', borderRadius: 9, border: 'none', background: '#4285F4', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <Car size={12} />Google Maps
                </button>
                <button onClick={() => openNav('waze')}
                  style={{ flex: 1, padding: '8px 4px', borderRadius: 9, border: 'none', background: '#33CCFF', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <Navigation size={12} />Waze
                </button>
                <button onClick={() => openNav('apple')}
                  style={{ flex: 1, padding: '8px 4px', borderRadius: 9, border: 'none', background: '#1C1C1E', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  🗺 Apple
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar when tour exists but panel hidden */}
      {tour.length > 0 && !showRoutePanel && (
        <div style={{ flexShrink: 0, background: '#0F766E', color: '#fff', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 14, zIndex: 10 }}>
          <Navigation size={16} />
          <span style={{ fontWeight: 700, fontSize: 14 }}>{tour.length} étape{tour.length > 1 ? 's' : ''} · {totalKm.toFixed(0)} km · ~{estimatedMin} min</span>
          {totalValue > 0 && <span style={{ fontSize: 13, opacity: .85 }}>{totalValue.toLocaleString()}€ pipeline</span>}
          <div style={{ flex: 1 }} />
          <button onClick={optimise}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid rgba(255,255,255,.4)', background: 'transparent', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Wand2 size={12} />Optimiser
          </button>
          <button onClick={() => openNav('google')}
            style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,.15)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Car size={12} />Google Maps
          </button>
          <button onClick={() => openNav('waze')}
            style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,.15)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Navigation size={12} />Waze
          </button>
          <button onClick={() => setShowRoutePanel(true)}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid rgba(255,255,255,.4)', background: 'transparent', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Détails
          </button>
        </div>
      )}
    </div>
  );
}
