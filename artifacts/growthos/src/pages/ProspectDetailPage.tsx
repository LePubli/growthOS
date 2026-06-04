import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import {
  ArrowLeft, Edit2, Save, X, Star, Mail, Phone, Globe, Building2,
  Briefcase, Loader2, Plus, Trash2, CheckCircle, AlertCircle,
  MessageSquare, Phone as PhoneIcon, Calendar, FileText, Clock,
  Archive, RotateCcw, Brain, TrendingUp, TrendingDown, Minus, MapPin,
  ExternalLink, Navigation, Zap, BadgeCheck,
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';
import { CommentsPanel } from '@/components/common/CommentsPanel';
import { AddressAutocomplete } from '@/components/common/AddressAutocomplete';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Teal custom marker (no image needed)
const tealIcon = L.divIcon({
  className: '',
  html: `<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:#0d9488;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);transform:rotate(-45deg)"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 22],
  popupAnchor: [0, -24],
});

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const prev = useRef<string>('');
  useEffect(() => {
    const key = `${lat},${lng}`;
    if (key !== prev.current) { map.setView([lat, lng], 14); prev.current = key; }
  }, [lat, lng, map]);
  return null;
}

function ProspectMiniMap({ lat, lng, label, address }: { lat: number; lng: number; label: string; address?: string }) {
  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', height: 200, position: 'relative', border: '1px solid var(--card-border)' }}>
      <MapContainer center={[lat, lng]} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FlyTo lat={lat} lng={lng} />
        <Marker position={[lat, lng]} icon={tealIcon}>
          <Popup>
            <strong style={{ fontSize: 13 }}>{label}</strong>
            {address && <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{address}</div>}
          </Popup>
        </Marker>
      </MapContainer>
      {/* overlay gradient bottom */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 36, background: 'linear-gradient(transparent, rgba(0,0,0,.08))', pointerEvents: 'none' }} />
      {/* coords badge */}
      <div style={{ position: 'absolute', bottom: 8, left: 10, fontSize: 10, color: '#fff', background: 'rgba(0,0,0,.45)', borderRadius: 6, padding: '2px 7px', pointerEvents: 'none' }}>
        {lat.toFixed(4)}, {lng.toFixed(4)}
      </div>
    </div>
  );
}

const STATUS_OPTIONS = [
  { value: 'new', label: 'Nouveau' }, { value: 'contacted', label: 'Contacté' },
  { value: 'qualified', label: 'Qualifié' }, { value: 'negotiation', label: 'Négociation' },
  { value: 'won', label: 'Gagné' }, { value: 'lost', label: 'Perdu' },
];
const STATUS_COLORS: Record<string, string> = {
  new: '#6B7280', contacted: '#2563EB', qualified: '#7C3AED',
  negotiation: '#D97706', won: '#059669', lost: '#EF4444',
};

const ACTIVITY_TYPES = [
  { value: 'note', label: 'Note', icon: <FileText size={14} /> },
  { value: 'call', label: 'Appel', icon: <PhoneIcon size={14} /> },
  { value: 'email', label: 'Email', icon: <Mail size={14} /> },
  { value: 'meeting', label: 'Réunion', icon: <Calendar size={14} /> },
  { value: 'task', label: 'Tâche', icon: <CheckCircle size={14} /> },
];

const TYPE_ICONS: Record<string, React.ReactElement> = {
  note: <FileText size={14} />, call: <PhoneIcon size={14} />,
  email: <Mail size={14} />, meeting: <Calendar size={14} />, task: <CheckCircle size={14} />,
};
const TYPE_COLORS: Record<string, string> = {
  note: '#6B7280', call: '#2563EB', email: '#7C3AED', meeting: '#059669', task: '#D97706',
};

function AddActivityModal({ prospectId, onClose, onSaved }: { prospectId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ type: 'note', title: '', description: '', status: 'done' });
  const [loading, setLoading] = useState(false);
  const s = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title) return;
    setLoading(true);
    try {
      await apiClient.post('/activities', { ...form, prospectId });
      onSaved(); onClose(); toast.success('Activité ajoutée');
    } catch { toast.error('Erreur lors de la création'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Nouvelle activité</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
            <div className="flex gap-2 flex-wrap">
              {ACTIVITY_TYPES.map(t => (
                <button key={t.value} onClick={() => s('type', t.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${form.type === t.value ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                  {t.icon}{t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Titre</label>
            <input value={form.title} onChange={e => s('title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Ex: Appel découverte, Note de réunion..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
            <textarea value={form.description} onChange={e => s('description', e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              placeholder="Détails..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Statut</label>
            <select value={form.status} onChange={e => s('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="done">Fait</option>
              <option value="planned">Planifié</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Annuler</button>
          <button onClick={save} disabled={!form.title || loading}
            className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProspectDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [, navigate] = useLocation();
  const [prospect, setProspect] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [lastEnrichedAt, setLastEnrichedAt] = useState<Date | null>(null);

  const fetchProspect = async () => {
    try {
      const data = await apiClient.get(`/prospects/${id}`);
      setProspect(data);
      setForm(data);
    } catch { toast.error('Prospect introuvable'); navigate('/prospects'); }
    finally { setLoading(false); }
  };

  const fetchActivities = async () => {
    try {
      const data = await apiClient.get('/activities', { params: { prospectId: id } }) as any[];
      setActivities(Array.isArray(data) ? data : []);
    } catch { setActivities([]); }
  };

  const fetchEnrichmentHistory = async () => {
    try {
      const history = await apiClient.get(`/plugins/enrichment/history/${id}`) as any[];
      if (Array.isArray(history) && history.length > 0) {
        setLastEnrichedAt(new Date(history[0].createdAt));
      }
    } catch { /* plugin may not be active */ }
  };

  const handleEnrich = async () => {
    setEnriching(true);
    try {
      const result = await apiClient.post(`/plugins/enrichment/${id}`, {}) as any;
      const count = result.sourcesSucceeded ?? result.sourcesAttempted ?? 0;
      setLastEnrichedAt(new Date());
      await fetchProspect();
      toast.success(`Enrichissement terminé — ${count} source${count > 1 ? 's' : ''} mise${count > 1 ? 's' : ''} à jour`);
    } catch {
      toast.error("Erreur lors de l'enrichissement");
    } finally {
      setEnriching(false);
    }
  };

  const isRecentlyEnriched = lastEnrichedAt
    ? (Date.now() - lastEnrichedAt.getTime()) < 7 * 24 * 60 * 60 * 1000
    : false;

  useEffect(() => { fetchProspect(); fetchActivities(); fetchEnrichmentHistory(); }, [id]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form, ...(geoCoords ?? {}) };
      const updated = await apiClient.patch(`/prospects/${id}`, payload);
      setProspect(updated);
      setGeoCoords(null);
      setEditing(false);
      toast.success('Prospect mis à jour');
    } catch { toast.error('Erreur lors de la mise à jour'); }
    finally { setSaving(false); }
  };

  const toggleStar = async () => {
    const newVal = !prospect.isStarred;
    setProspect((p: any) => ({ ...p, isStarred: newVal }));
    await apiClient.patch(`/prospects/${id}`, { isStarred: newVal });
  };

  const deleteActivity = async (actId: string) => {
    await apiClient.delete(`/activities/${actId}`);
    setActivities(a => a.filter(x => x.id !== actId));
    toast.success('Activité supprimée');
  };

  const sf = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));

  const geocodeNow = async () => {
    if (!prospect.address || geocoding) return;
    setGeocoding(true);
    try {
      // PATCH with the same address → triggers background geocoding on server
      await apiClient.patch(`/prospects/${id}`, { address: prospect.address });
      toast.success('Géocodage lancé — la carte apparaîtra dans quelques secondes');
      // Poll for coordinates up to 8s
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const data = await apiClient.get(`/prospects/${id}`) as any;
          if (data.lat) {
            setProspect(data);
            setForm(data);
            clearInterval(poll);
            setGeocoding(false);
            toast.success('Prospect géolocalisé ✓');
          } else if (attempts >= 8) {
            clearInterval(poll);
            setGeocoding(false);
            toast.error('Adresse introuvable sur la carte');
          }
        } catch { clearInterval(poll); setGeocoding(false); }
      }, 1000);
    } catch {
      toast.error('Erreur lors du géocodage');
      setGeocoding(false);
    }
  };

  const archiveProspect = async () => {
    const isArchived = prospect.status === 'archived';
    try {
      const updated = await apiClient.patch(`/prospects/${id}`, { status: isArchived ? 'new' : 'archived' });
      setProspect(updated);
      toast.success(isArchived ? 'Prospect restauré' : 'Prospect archivé');
      if (!isArchived) navigate('/prospects');
    } catch { toast.error('Erreur lors de l\'archivage'); }
  };

  // AI Scoring: compute a breakdown from available fields
  const computeScoring = (p: any) => {
    const criteria = [
      { label: 'Email renseigné', weight: 20, met: !!p.email },
      { label: 'Téléphone renseigné', weight: 15, met: !!p.phone },
      { label: 'Entreprise identifiée', weight: 15, met: !!p.company },
      { label: 'Poste / rôle décisionnel', weight: 15, met: !!p.jobTitle },
      { label: 'En cours de négociation', weight: 20, met: ['negotiation', 'qualified'].includes(p.status) },
      { label: 'Adresse géolocalisée', weight: 10, met: !!p.address && !!p.lat },
      { label: 'Mis en favori', weight: 5, met: !!p.isStarred },
    ];
    const computedScore = criteria.reduce((s, c) => s + (c.met ? c.weight : 0), 0);
    return { criteria, computedScore };
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--body-bg)' }}>
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-primary)' }} />
    </div>
  );
  if (!prospect) return null;

  const initials = ((prospect.firstName || prospect.company || '?')[0]).toUpperCase();
  const fullName = [prospect.firstName, prospect.lastName].filter(Boolean).join(' ') || prospect.company || 'Sans nom';
  const statusColor = STATUS_COLORS[prospect.status] || '#6B7280';

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--body-bg)' }}>
      {showAddActivity && (
        <AddActivityModal prospectId={id} onClose={() => setShowAddActivity(false)} onSaved={fetchActivities} />
      )}

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/prospects')} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft size={20} style={{ color: 'var(--text-muted)' }} />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-xl font-bold"
            style={{ background: 'var(--color-primary)' }}>{initials}</div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{fullName}</h1>
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{prospect.jobTitle || '—'}</span>
              {prospect.company && <span className="text-sm" style={{ color: 'var(--text-muted)' }}>· {prospect.company}</span>}
              <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium" style={{ background: statusColor }}>
                {STATUS_OPTIONS.find(s => s.value === prospect.status)?.label}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={toggleStar} className={`p-2 rounded-xl ${prospect.isStarred ? 'bg-amber-50' : 'hover:bg-gray-100'}`}>
            <Star size={18} className={prospect.isStarred ? 'fill-amber-400 text-amber-400' : 'text-gray-400'} />
          </button>
          <button onClick={archiveProspect} title={prospect.status === 'archived' ? 'Restaurer' : 'Archiver'}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
            style={{ color: prospect.status === 'archived' ? '#059669' : 'var(--text-muted)' }}>
            {prospect.status === 'archived' ? <RotateCcw size={18} /> : <Archive size={18} />}
          </button>
          {editing ? (
            <>
              <button onClick={() => setEditing(false)} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600">Annuler</button>
              <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ background: 'var(--color-primary)' }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}Enregistrer
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-teal-300">
              <Edit2 size={14} />Modifier
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Left — Info */}
        <div className="col-span-2 space-y-4">
          {/* Coordonnées */}
          <div className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <h2 className="font-semibold mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>COORDONNÉES</h2>
            <div className="grid grid-cols-2 gap-4">
              {editing ? (
                <>
                  {[
                    { k: 'firstName', l: 'Prénom' }, { k: 'lastName', l: 'Nom' },
                    { k: 'email', l: 'Email' }, { k: 'phone', l: 'Téléphone' },
                    { k: 'company', l: 'Entreprise' }, { k: 'jobTitle', l: 'Poste' },
                    { k: 'website', l: 'Site web' }, { k: 'linkedinUrl', l: 'LinkedIn' },
                  ].map(f => (
                    <div key={f.k} className={f.k === 'website' || f.k === 'linkedinUrl' ? 'col-span-2' : ''}>
                      <label className="block text-xs font-medium text-gray-500 mb-1">{f.l}</label>
                      <input value={form[f.k] || ''} onChange={e => sf(f.k, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                    </div>
                  ))}

                  {/* Address with Nominatim autocomplete — full width */}
                  <div className="col-span-2">
                    <AddressAutocomplete
                      value={form.address || ''}
                      label="Adresse"
                      placeholder="Ex: 12 Rue de la Paix, Paris…"
                      onChange={(address, c) => {
                        sf('address', address);
                        setGeoCoords(c ?? null);
                      }}
                    />
                    {/* Geo status */}
                    <div className="flex items-center gap-3 mt-1.5" style={{ fontSize: 11 }}>
                      {geoCoords ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <MapPin size={11} />Géolocalisé · {geoCoords.lat.toFixed(4)}, {geoCoords.lng.toFixed(4)}
                        </span>
                      ) : prospect.lat ? (
                        <span className="flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                          <MapPin size={11} />Déjà géolocalisé ({(prospect.lat as number).toFixed(4)}, {(prospect.lng as number).toFixed(4)})
                        </span>
                      ) : form.address ? (
                        <span style={{ color: '#D97706' }}>Géocodage en arrière-plan après sauvegarde…</span>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Statut</label>
                    <select value={form.status || 'new'} onChange={e => sf('status', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                      {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Score</label>
                    <input type="number" min={0} max={100} value={form.score || 0} onChange={e => sf('score', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                </>
              ) : (
                <>
                  {[
                    { l: 'Email', v: prospect.email, icon: <Mail size={14} />, href: prospect.email ? `mailto:${prospect.email}` : undefined },
                    { l: 'Téléphone', v: prospect.phone, icon: <Phone size={14} />, href: prospect.phone ? `tel:${prospect.phone}` : undefined },
                    { l: 'Entreprise', v: prospect.company, icon: <Building2 size={14} /> },
                    { l: 'Poste', v: prospect.jobTitle, icon: <Briefcase size={14} /> },
                    { l: 'Site web', v: prospect.website, icon: <Globe size={14} />, href: prospect.website },
                    { l: 'LinkedIn', v: prospect.linkedinUrl, icon: <Globe size={14} />, href: prospect.linkedinUrl },
                  ].map(f => (
                    <div key={f.l}>
                      <div className="flex items-center gap-1.5 text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                        {f.icon}{f.l}
                      </div>
                      {f.v ? (
                        f.href ? <a href={f.href} target="_blank" rel="noreferrer" className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>{f.v}</a>
                          : <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{f.v}</span>
                      ) : <span className="text-sm" style={{ color: 'var(--text-muted)' }}>—</span>}
                    </div>
                  ))}

                  {/* Address + geo badge — spans full width */}
                  <div className="col-span-2">
                    <div className="flex items-center gap-1.5 text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                      <MapPin size={14} />Adresse
                      {prospect.lat && (
                        <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: '#ECFDF5', color: '#059669' }}>
                          🗺 Géolocalisé
                        </span>
                      )}
                    </div>
                    {prospect.address ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-start gap-2">
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{prospect.address}</span>
                          {prospect.lat && (
                            <a
                              href={`https://www.google.com/maps?q=${prospect.lat},${prospect.lng}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs flex-shrink-0 mt-0.5"
                              style={{ color: 'var(--color-primary)' }}
                            >
                              Voir sur Maps ↗
                            </a>
                          )}
                        </div>
                        {/* Geocode button — only when address exists but no coordinates yet */}
                        {!prospect.lat && (
                          <button
                            onClick={geocodeNow}
                            disabled={geocoding}
                            className="flex items-center gap-1.5 self-start mt-0.5 px-2.5 py-1 rounded-lg text-xs font-medium disabled:opacity-60 transition-all"
                            style={{ background: geocoding ? '#F3F4F6' : '#F0FDF4', color: geocoding ? '#9CA3AF' : '#059669', border: '1px solid', borderColor: geocoding ? '#E5E7EB' : '#86EFAC' }}
                          >
                            {geocoding
                              ? <><Loader2 size={11} className="animate-spin" />Géocodage en cours…</>
                              : <><MapPin size={11} />Géocoder maintenant</>}
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>— (cliquez Modifier pour ajouter)</span>
                    )}
                  </div>

                  <div>
                    <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Score</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 rounded-full h-2" style={{ background: 'var(--body-bg)' }}>
                        <div className="h-2 rounded-full" style={{ width: `${prospect.score || 0}%`, background: 'var(--color-primary)' }} />
                      </div>
                      <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{prospect.score || 0}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Mini-map — only when geocoded and not editing */}
          {!editing && prospect.lat && prospect.lng && (
            <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <h2 className="font-semibold text-sm flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                  <MapPin size={13} />LOCALISATION
                </h2>
                <div className="flex items-center gap-3">
                  <a
                    href={`/crm-map`}
                    className="flex items-center gap-1 text-xs font-medium"
                    style={{ color: 'var(--color-primary)' }}
                    onClick={e => { e.preventDefault(); navigate('/crm-map'); }}
                  >
                    <Navigation size={11} />Voir sur la carte CRM
                  </a>
                  <a
                    href={`https://www.google.com/maps?q=${prospect.lat},${prospect.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <ExternalLink size={11} />Google Maps
                  </a>
                </div>
              </div>
              <div className="px-5 pb-5">
                <ProspectMiniMap
                  lat={prospect.lat}
                  lng={prospect.lng}
                  label={[prospect.firstName, prospect.lastName].filter(Boolean).join(' ') || prospect.company || 'Prospect'}
                  address={prospect.address}
                />
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <h2 className="font-semibold mb-3 text-sm" style={{ color: 'var(--text-muted)' }}>NOTES</h2>
            {editing ? (
              <textarea value={form.notes || ''} onChange={e => sf('notes', e.target.value)} rows={4}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                placeholder="Notes internes sur ce prospect..." />
            ) : (
              <p className="text-sm" style={{ color: prospect.notes ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {prospect.notes || 'Aucune note. Cliquez sur Modifier pour en ajouter.'}
              </p>
            )}
          </div>

          {/* Activités */}
          <div className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-sm" style={{ color: 'var(--text-muted)' }}>ACTIVITÉS ({activities.length})</h2>
              <button onClick={() => setShowAddActivity(true)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl text-white" style={{ background: 'var(--color-primary)' }}>
                <Plus size={12} />Ajouter
              </button>
            </div>
            {activities.length === 0 ? (
              <div className="text-center py-8">
                <Clock size={32} className="mx-auto mb-2" style={{ color: 'var(--card-border)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Aucune activité</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activities.map(act => (
                  <div key={act.id} className="flex gap-3 p-3 rounded-xl" style={{ background: 'var(--body-bg)' }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs"
                      style={{ background: TYPE_COLORS[act.type] || '#6B7280' }}>
                      {TYPE_ICONS[act.type] || <FileText size={12} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{act.title}</div>
                      {act.description && <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{act.description}</div>}
                      <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        {new Date(act.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    <button onClick={() => deleteActivity(act.id)} className="text-red-400 hover:text-red-600 flex-shrink-0">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right — Métadonnées */}
        <div className="space-y-4">
          <div className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <h2 className="font-semibold mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>INFORMATIONS</h2>
            <div className="space-y-3">
              <div>
                <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Statut</div>
                <span className="text-xs px-2.5 py-1 rounded-full text-white font-medium" style={{ background: statusColor }}>
                  {STATUS_OPTIONS.find(s => s.value === prospect.status)?.label}
                </span>
              </div>
              <div>
                <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Favoris</div>
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{prospect.isStarred ? '⭐ Oui' : 'Non'}</span>
              </div>
              <div>
                <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Créé le</div>
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {new Date(prospect.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
              <div>
                <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Mis à jour</div>
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {new Date(prospect.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>

          {/* AI Scoring Panel */}
          {(() => {
            const { criteria, computedScore } = computeScoring(prospect);
            const score = prospect.score || computedScore;
            const color = score >= 70 ? '#059669' : score >= 40 ? '#D97706' : '#DC2626';
            const label = score >= 70 ? 'Chaud 🔥' : score >= 40 ? 'Tiède' : 'Froid';
            const TrendIcon = score >= 70 ? TrendingUp : score >= 40 ? Minus : TrendingDown;
            return (
              <div className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <Brain size={14} style={{ color: 'var(--color-primary)' }} />
                  <h2 className="font-semibold text-sm" style={{ color: 'var(--text-muted)' }}>SCORING IA</h2>
                </div>
                {/* Score ring */}
                <div className="flex items-center gap-4 mb-4">
                  <div style={{ position: 'relative', width: 60, height: 60, flexShrink: 0 }}>
                    <svg viewBox="0 0 60 60" style={{ transform: 'rotate(-90deg)', width: 60, height: 60 }}>
                      <circle cx="30" cy="30" r="24" fill="none" stroke="var(--body-bg)" strokeWidth="6" />
                      <circle cx="30" cy="30" r="24" fill="none" stroke={color} strokeWidth="6"
                        strokeDasharray={`${2 * Math.PI * 24 * score / 100} ${2 * Math.PI * 24 * (1 - score / 100)}`}
                        strokeLinecap="round" />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color }}>
                      {score}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color }} className="flex items-center gap-1.5">
                      <TrendIcon size={16} />{label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Score de qualification</div>
                  </div>
                </div>
                {/* Criteria */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {criteria.map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: c.met ? '#ECFDF5' : 'var(--body-bg)', border: `1.5px solid ${c.met ? '#059669' : 'var(--card-border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {c.met && <CheckCircle size={9} style={{ color: '#059669' }} />}
                      </div>
                      <span style={{ flex: 1, color: c.met ? 'var(--text-primary)' : 'var(--text-muted)' }}>{c.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: c.met ? '#059669' : 'var(--text-muted)' }}>+{c.weight}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          <div className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <h2 className="font-semibold mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>ACTIONS RAPIDES</h2>
            <div className="space-y-2">
              {prospect.email && (
                <a href={`mailto:${prospect.email}`}
                  className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm border transition-all hover:border-teal-300"
                  style={{ background: 'var(--body-bg)', borderColor: 'var(--card-border)', color: 'var(--text-secondary)' }}>
                  <Mail size={14} style={{ color: 'var(--color-primary)' }} />Envoyer un email
                </a>
              )}
              {prospect.phone && (
                <a href={`tel:${prospect.phone}`}
                  className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm border transition-all hover:border-teal-300"
                  style={{ background: 'var(--body-bg)', borderColor: 'var(--card-border)', color: 'var(--text-secondary)' }}>
                  <PhoneIcon size={14} style={{ color: '#2563EB' }} />Appeler
                </a>
              )}
              <button onClick={() => setShowAddActivity(true)}
                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm border transition-all hover:border-teal-300"
                style={{ background: 'var(--body-bg)', borderColor: 'var(--card-border)', color: 'var(--text-secondary)' }}>
                <Plus size={14} style={{ color: '#7C3AED' }} />Ajouter une activité
              </button>
              <button onClick={() => navigate('/pipeline')}
                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm border transition-all hover:border-teal-300"
                style={{ background: 'var(--body-bg)', borderColor: 'var(--card-border)', color: 'var(--text-secondary)' }}>
                <MessageSquare size={14} style={{ color: '#D97706' }} />Créer un deal
              </button>

              {isRecentlyEnriched ? (
                <div className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm border"
                  style={{ background: '#F0FDF4', borderColor: '#86EFAC', color: '#059669' }}>
                  <BadgeCheck size={14} />
                  <span className="flex-1 font-medium">Données récentes</span>
                  <span style={{ fontSize: 11, color: '#059669', opacity: 0.7 }}>
                    {lastEnrichedAt ? `il y a ${Math.floor((Date.now() - lastEnrichedAt.getTime()) / 86400000)}j` : ''}
                  </span>
                </div>
              ) : (
                <button
                  onClick={handleEnrich}
                  disabled={enriching}
                  className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm font-medium border transition-all disabled:opacity-60"
                  style={{
                    background: enriching ? 'var(--body-bg)' : 'linear-gradient(135deg,#4C1D95,#7C3AED)',
                    borderColor: enriching ? 'var(--card-border)' : 'transparent',
                    color: enriching ? 'var(--text-muted)' : '#fff',
                  }}
                >
                  {enriching
                    ? <><Loader2 size={14} className="animate-spin" />Enrichissement…</>
                    : <><Zap size={14} />Enrichir</>}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Collaboration & Activité */}
        <div className="px-6 pb-6">
          <div className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <CommentsPanel entityType="prospect" entityId={prospect.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
