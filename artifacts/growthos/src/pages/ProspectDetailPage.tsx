import { ConnectorEnrichmentReturn } from '@/components/ConnectorEnrichmentReturn';
import { ProspectProfessionalSources } from '@/components/ProspectProfessionalSources';
import { ProspectCompanyProfile } from '@/components/ProspectCompanyProfile';
import { SocieteEnrichmentDialog } from '@/components/SocieteEnrichment';
import { EditNote } from '@/components/EditNote';
import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams, useLocation } from 'wouter';
import {
  ArrowLeft, Edit2, Save, X, Star, Mail, Phone, Globe, Building2,
  Briefcase, Loader2, Plus, Trash2, CheckCircle, AlertCircle,
  MessageSquare, Phone as PhoneIcon, Calendar, FileText, Clock,
  Archive, RotateCcw, RefreshCw, Brain, TrendingUp, TrendingDown, Minus, MapPin,
  ExternalLink, Navigation, Zap, BadgeCheck, ChevronDown, ChevronUp,
  Building, Database, BarChart2, Users, Newspaper, GitMerge, Copy,
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { enrichLocalPagesJaunes } from '@/lib/pagesjaunes-device';
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
  { value: 'converted', label: 'Converti en deal' },
];
const STATUS_COLORS: Record<string, string> = {
  new: '#6B7280', contacted: '#2563EB', qualified: '#7C3AED',
  negotiation: '#D97706', won: '#059669', lost: '#EF4444', converted: '#059669',
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

/* ─── Panneau Données Enrichies ──────────────────────────── */
function EnrichedDataPanel({ prospectId }: { prospectId: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (data) { setOpen(o => !o); return; }
    setLoading(true);
    setOpen(true);
    try {
      const res = await apiClient.get(`/enrich/data/${prospectId}`) as any;
      setData(res);
    } catch { setData({}); }
    finally { setLoading(false); }
  };

  const Row = ({ label, value }: { label: string; value?: string | number | null }) =>
    value ? (
      <div className="flex items-start gap-2 py-1.5" style={{ borderBottom: '1px solid var(--card-border)' }}>
        <span className="text-xs w-32 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span className="text-xs font-medium flex-1" style={{ color: 'var(--text-primary)' }}>{value}</span>
      </div>
    ) : null;

  const legal = data?.legal;
  const financial = data?.financial;
  const digital = data?.digital;
  const social = data?.social;
  const news = data?.news;

  const hasData = !!(legal || financial || digital || social || news);

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
      <button onClick={load} className="flex items-center justify-between w-full px-5 py-4 text-left hover:opacity-80 transition-opacity">
        <h2 className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
          <Database size={13} />DONNÉES ENRICHIES
          {hasData && <span className="text-xs px-2 py-0.5 rounded-full font-normal" style={{ background: '#EFF6FF', color: '#2563EB' }}>Disponibles</span>}
        </h2>
        {loading ? <Loader2 size={14} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
          : open ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} />
          : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={20} className="animate-spin mr-2" style={{ color: 'var(--color-primary)' }} />
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Chargement des données…</span>
            </div>
          )}

          {!loading && !hasData && (
            <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
              Aucune donnée enrichie — cliquez sur "Enrichir" dans les actions rapides.
            </p>
          )}

          {!loading && legal && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Building size={12} style={{ color: '#2563EB' }} />
                <span className="text-xs font-semibold" style={{ color: '#2563EB' }}>DONNÉES LÉGALES</span>
              </div>
              <Row label="SIREN/SIRET" value={legal.siren ?? legal.siret} />
              <Row label="Forme juridique" value={legal.formeJuridique ?? legal.legalForm} />
              <Row label="Date création" value={legal.dateCreation ?? legal.creationDate} />
              <Row label="Effectif" value={legal.effectif ?? legal.headcount} />
              <Row label="Tranche effectif" value={legal.trancheEffectifEtab} />
              <Row label="Code NAF" value={legal.codeNaf ?? legal.nafCode} />
              <Row label="Adresse siège" value={legal.adresse ?? legal.address} />
            </div>
          )}

          {!loading && financial && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <BarChart2 size={12} style={{ color: '#059669' }} />
                <span className="text-xs font-semibold" style={{ color: '#059669' }}>DONNÉES FINANCIÈRES</span>
              </div>
              <Row label="Chiffre d'affaires" value={financial.revenue ? `${(financial.revenue / 1000000).toFixed(1)} M€` : null} />
              <Row label="Résultat net" value={financial.netIncome ? `${(financial.netIncome / 1000).toFixed(0)} k€` : null} />
              <Row label="Effectif" value={financial.employees} />
              <Row label="Cotation" value={financial.rating} />
              <Row label="Notation ESG" value={financial.esgScore ? `${financial.esgScore}/100` : null} />
            </div>
          )}

          {!loading && digital && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Globe size={12} style={{ color: '#7C3AED' }} />
                <span className="text-xs font-semibold" style={{ color: '#7C3AED' }}>PRÉSENCE DIGITALE</span>
              </div>
              <Row label="DA (Autorité)" value={digital.domainAuthority ? `${digital.domainAuthority}/100` : null} />
              <Row label="Trafic mensuel" value={digital.monthlyVisits ? `${(digital.monthlyVisits / 1000).toFixed(0)}k visites` : null} />
              <Row label="Technologies" value={Array.isArray(digital.technologies) ? digital.technologies.slice(0, 4).join(', ') : null} />
              <Row label="SSL" value={digital.hasSSL === true ? '✅ Actif' : digital.hasSSL === false ? '❌ Absent' : null} />
              <Row label="Score perf." value={digital.performanceScore ? `${digital.performanceScore}/100` : null} />
            </div>
          )}

          {!loading && social && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Users size={12} style={{ color: '#D97706' }} />
                <span className="text-xs font-semibold" style={{ color: '#D97706' }}>RÉSEAUX SOCIAUX</span>
              </div>
              <Row label="LinkedIn" value={social.linkedinFollowers ? `${social.linkedinFollowers.toLocaleString('fr-FR')} abonnés` : null} />
              <Row label="Twitter/X" value={social.twitterFollowers ? `${social.twitterFollowers.toLocaleString('fr-FR')} abonnés` : null} />
              <Row label="Engagement" value={social.engagementRate ? `${social.engagementRate}%` : null} />
            </div>
          )}

          {!loading && news?.articles?.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Newspaper size={12} style={{ color: '#DC2626' }} />
                <span className="text-xs font-semibold" style={{ color: '#DC2626' }}>ACTUALITÉS RÉCENTES</span>
              </div>
              {news.articles.slice(0, 3).map((article: any, i: number) => (
                <div key={i} className="py-1.5 border-b last:border-0" style={{ borderColor: 'var(--card-border)' }}>
                  <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{article.title}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {article.source} · {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString('fr-FR') : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
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
  const [returnProcessing,setReturnProcessing]=useState(false);
  const [form, setForm] = useState<any>({});
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [enrichingPagesJaunes, setEnrichingPagesJaunes] = useState(false);
  const [showSocieteEnrichment, setShowSocieteEnrichment] = useState(false);
  const [enrichingActivity, setEnrichingActivity] = useState(false);
  const [lastEnrichedAt, setLastEnrichedAt] = useState<Date | null>(null);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertLoading, setConvertLoading] = useState(false);
  const [linkedDeals, setLinkedDeals] = useState<{ id: string; title: string; stage: string }[]>([]);
  const [convertForm, setConvertForm] = useState({ title: '', value: '0', stage: 'lead', closeDate: '' });

  const fetchProspect = async () => {
    try {
      const data = await apiClient.get(`/prospects/${id}`);
      setProspect(data);
      setForm(data);
    } catch { toast.error('Prospect introuvable'); navigate('/prospects'); }
    finally { setLoading(false); }
  };

  const enrichFromPagesJaunes = async () => {
    if (!prospect?.sourceUrl) return;
    setEnrichingPagesJaunes(true);
    try {
      toast.info('Ouverture de la fiche PagesJaunes dans votre navigateur…');
      const profile = await enrichLocalPagesJaunes(prospect.sourceUrl);
      const updated = await apiClient.post<any>(`/sourcing/device/prospects/${id}/enrich`,
        {profile}, {timeoutMs: 60000});
      setProspect(updated);
      setForm(updated);
      toast.success('Fiche PagesJaunes consultée : informations disponibles enregistrées.');
    } catch (error: any) {
      toast.error(error.message || 'Enrichissement PagesJaunes impossible', {duration:10000});
    } finally {setEnrichingPagesJaunes(false);}
  };

  const enrichOfficialActivity = async () => {
    setEnrichingActivity(true);
    try {
      const updated = await apiClient.post<any>(`/prospects/${id}/activity-enrich`, {});
      setProspect(updated);
      setForm(updated);
      toast.success('Code APE / NAF complété depuis l’Annuaire officiel.');
    } catch (error:any) {
      toast.error(error.message || 'Activité officielle indisponible');
    } finally {setEnrichingActivity(false);}
  };

  const fetchActivities = async () => {
    try {
      const data = await apiClient.get('/activities', { params: { prospectId: id, scope: 'history' } }) as any[];
      setActivities(Array.isArray(data) ? data : []);
    } catch { setActivities([]); }
  };

  const fetchEnrichmentHistory = async () => {
    try {
      const history = await apiClient.get(`/enrich/history/${id}`) as any[];
      if (Array.isArray(history) && history.length > 0) {
        setLastEnrichedAt(new Date(history[0].createdAt));
      }
    } catch { /* plugin may not be active */ }
  };

  const handleEnrich = async () => {
    setEnriching(true);
    try {
      const result = await apiClient.post(`/enrich/${id}`, {}) as any;
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

  const fetchLinkedDeals = async () => {
    try {
      const linked = await apiClient.get<{ id: string; title: string; stage: string }[]>('/pipeline', { params: { prospectId: id } });
      setLinkedDeals(Array.isArray(linked) ? linked : []);
    } catch {
      setLinkedDeals([]);
    }
  };

  useEffect(() => { fetchProspect(); fetchActivities(); fetchEnrichmentHistory(); fetchLinkedDeals(); }, [id]);

  const save = async () => {
    setSaving(true);
    try {
      const editableFields = ['firstName','lastName','email','phone','company','siren','siret','apeCode',
        'nafLabel','nafVersion','postalCode','city','linkedinUrl','jobTitle','website','address','lat','lng','status','score','isStarred'];
      const changedFields = Object.fromEntries(editableFields
        .filter(field => form[field] !== undefined && !Object.is(form[field],prospect[field]))
        .map(field => [field,form[field]]));
      const payload = { ...changedFields, ...(geoCoords ?? {}) };
      const updated = await apiClient.patch(`/prospects/${id}`, payload);
      setProspect(updated);
      setForm(updated);
      setGeoCoords(null);
      setEditing(false);
      toast.success('Prospect mis à jour');
    } catch (error:any) { toast.error(error.message || 'Erreur lors de la mise à jour'); }
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

  const openConvertModal = () => {
    const daysFrom30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    setConvertForm({
      title: `Deal ${prospect.company || fullName}`,
      value: '0',
      stage: ['qualified', 'negotiation'].includes(prospect.status) ? prospect.status : 'lead',
      closeDate: daysFrom30,
    });
    setShowConvertModal(true);
  };

  const convertToDeal = async () => {
    setConvertLoading(true);
    try {
      const deal = await apiClient.post('/pipeline/from-prospect', {
        prospectId: id,
        title: convertForm.title,
        company: prospect.company || '',
        value: Number(convertForm.value) || 0,
        stage: convertForm.stage,
        closeDate: convertForm.closeDate || undefined,
      }) as any;
      setProspect((p: any) => ({ ...p, status: 'converted' }));
      setLinkedDeals(previous => [{ id: deal.id, title: deal.title, stage: deal.stage }, ...previous]);
      setShowConvertModal(false);
      toast.success('Prospect converti en deal ✓');
      navigate(`/pipeline/${deal.id}`);
    } catch (e: any) {
      toast.error(e?.error || 'Erreur lors de la conversion');
    } finally {
      setConvertLoading(false);
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
    // Informations présentes, sans prétendre à un modèle IA.
    const criteria = [
      { label: 'Entreprise identifiée', weight: 15, met: !!p.company },
      { label: 'SIREN renseigné', weight: 15, met: !!p.siren },
      { label: 'SIRET renseigné', weight: 10, met: !!p.siret },
      { label: 'Adresse renseignée', weight: 10, met: !!p.address },
      { label: 'Code postal renseigné', weight: 10, met: !!p.postalCode },
      { label: 'Email renseigné', weight: 15, met: !!p.email },
      { label: 'Téléphone renseigné', weight: 10, met: !!p.phone },
      { label: 'Site web renseigné', weight: 15, met: !!p.website },
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
  const contactName = [prospect.firstName, prospect.lastName].filter(Boolean).join(' ');
  const fullName = contactName || prospect.company || 'Sans nom';
  const statusColor = STATUS_COLORS[prospect.status] || '#6B7280';
  const pagesJaunesDetails = prospect.sourceDetails?.pagesjaunes || null;
  const pagesJaunesProfile = /^https:\/\/(?:www\.)?pagesjaunes\.fr\/pros\/\d+\/?(?:\?.*)?$/.test(prospect.sourceUrl || '');
  const pjHours = String(pagesJaunesDetails?.openingHours || '').split('\n')
    .map((line: string) => line.trim()).filter((line: string) =>
      /^(Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche)\s*:/i.test(line) && line.length < 100);
  const pjReviews = Array.isArray(pagesJaunesDetails?.reviews) ?
    pagesJaunesDetails.reviews.filter((review: any) => typeof review?.text === 'string' && review.text.length <= 800).slice(0,5) : [];
  const pjDescription = typeof pagesJaunesDetails?.description === 'string'
    && pagesJaunesDetails.description.length < 700
    && !/informations pratiques.*horaires|professionnels, appelez|avis négatifs.*avis positifs/i.test(pagesJaunesDetails.description)
    ? pagesJaunesDetails.description : null;
  const pjServices = typeof pagesJaunesDetails?.services === 'string'
    && pagesJaunesDetails.services.length < 1050
    && !/avis négatifs.*avis positifs|informations pratiques.*horaires/i.test(pagesJaunesDetails.services)
    ? pagesJaunesDetails.services : null;
  const pjWebsite = prospect.website || pagesJaunesDetails?.website;
  const pjWebsiteValid = typeof pjWebsite === 'string' && /^https?:\/\//i.test(pjWebsite);
  const pendingConflicts=Array.isArray(prospect.sourceDetails?.crossSource?.conflicts)
    ? prospect.sourceDetails.crossSource.conflicts as Array<{
      id:string;field:string;existing:string;incoming:string;source:string;sourceUrl?:string|null;capturedAt:string;
    }> : [];
  const sourceHistory=Array.isArray(prospect.sourceDetails?.crossSource?.observations)
    ? prospect.sourceDetails.crossSource.observations as Array<{
      captureId:string;source:string;sourceUrl?:string|null;capturedAt:string;fieldsFilled?:string[];
    }> : [];
  const conflictLabels:Record<string,string>={address:'Adresse',postalCode:'Code postal',city:'Ville',
    phone:'Téléphone',email:'Email',website:'Site web',linkedinUrl:'LinkedIn',siret:'SIRET',siren:'SIREN',
    apeCode:'Code APE / NAF',nafLabel:'Libellé NAF',nafVersion:'Nomenclature'};
  const resolveConflict=async(conflictId:string,decision:'keep_existing'|'use_incoming')=>{
    try{
      const result=await apiClient.post(`/sourcing/device/prospects/${id}/resolve-conflict`,{conflictId,decision}) as {prospect:any};
      setProspect(result.prospect);
      toast.success(decision==='use_incoming'?'Nouvelle valeur appliquée':'Valeur actuelle conservée');
    }catch(error:any){toast.error(error?.message||'Impossible de résoudre ce conflit');}
  };

  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: 'var(--body-bg)' }}>
      <ConnectorEnrichmentReturn prospectId={id!} onSaved={() => fetchProspect()} onBusyChange={setReturnProcessing}/>
      {!!prospect.identityConflicts?.length && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 text-amber-950 p-4 mb-4">
        <p className="font-semibold">SIRET déjà utilisé sur une autre fiche prospect</p>
        <p className="text-sm">Vérifiez ces fiches avant de poursuivre l’enrichissement.</p>
        {prospect.identityConflicts.map((other:any) => <Link key={other.id} className="block underline mt-1" to={'/prospects/' + other.id}>{other.company || 'Prospect sans nom'} · {other.siret}</Link>)}
      </div>}
      {prospect.identityMismatch && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 text-red-900 p-4 mb-4">Le SIREN et le SIRET de cette fiche ne correspondent pas. Vérifiez les identifiants avant de poursuivre.</p>}
      <SocieteEnrichmentDialog key={id} open={showSocieteEnrichment} onOpenChange={setShowSocieteEnrichment}
        prospect={prospect} onSaved={() => void fetchProspect()}/>

      {showAddActivity && (
        <AddActivityModal prospectId={id} onClose={() => setShowAddActivity(false)} onSaved={fetchActivities} />
      )}

      {showConvertModal && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:16 }} onClick={()=>setShowConvertModal(false)}>
          <div style={{ background:'var(--card-bg)',borderRadius:20,padding:28,width:'100%',maxWidth:480,boxShadow:'0 20px 60px rgba(0,0,0,.25)' }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20 }}>
              <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                <div style={{ width:36,height:36,borderRadius:10,background:'#6366F1',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff' }}><GitMerge size={16}/></div>
                <div>
                  <h2 style={{ margin:0,fontSize:16,fontWeight:700,color:'var(--text-primary)' }}>Convertir en Deal</h2>
                  <p style={{ margin:0,fontSize:12,color:'var(--text-muted)' }}>{fullName} · {prospect.company}</p>
                </div>
              </div>
              <button onClick={()=>setShowConvertModal(false)} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)' }}><X size={18}/></button>
            </div>
            <div style={{ display:'flex',flexDirection:'column',gap:12,marginBottom:20 }}>
              {[
                { k:'title', l:'Titre du deal *', type:'text' },
                { k:'value', l:'Valeur estimée (€)', type:'number' },
                { k:'closeDate', l:'Date de closing estimée', type:'date' },
              ].map(f=>(
                <div key={f.k}>
                  <label style={{ display:'block',fontSize:12,fontWeight:600,color:'var(--text-secondary)',marginBottom:4 }}>{f.l}</label>
                  <input type={f.type} value={(convertForm as any)[f.k]} onChange={e=>setConvertForm(p=>({...p,[f.k]:e.target.value}))}
                    style={{ width:'100%',padding:'9px 12px',border:'1px solid var(--card-border)',borderRadius:10,fontSize:13,background:'var(--body-bg)',color:'var(--text-primary)',outline:'none',boxSizing:'border-box' }}/>
                </div>
              ))}
              <div>
                <label style={{ display:'block',fontSize:12,fontWeight:600,color:'var(--text-secondary)',marginBottom:4 }}>Étape</label>
                <select value={convertForm.stage} onChange={e=>setConvertForm(p=>({...p,stage:e.target.value}))}
                  style={{ width:'100%',padding:'9px 12px',border:'1px solid var(--card-border)',borderRadius:10,fontSize:13,background:'var(--body-bg)',color:'var(--text-primary)',outline:'none' }}>
                  <option value="lead">Lead</option>
                  <option value="qualified">Qualifié</option>
                  <option value="proposal">Proposition</option>
                  <option value="negotiation">Négociation</option>
                </select>
              </div>
            </div>
            <div style={{ display:'flex',gap:10 }}>
              <button onClick={()=>setShowConvertModal(false)} style={{ flex:1,padding:11,borderRadius:12,border:'1px solid var(--card-border)',background:'transparent',color:'var(--text-secondary)',fontSize:14,cursor:'pointer' }}>Annuler</button>
              <button onClick={convertToDeal} disabled={!convertForm.title||convertLoading} style={{ flex:2,padding:11,borderRadius:12,border:'none',background:'#6366F1',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,opacity:!convertForm.title||convertLoading?0.6:1 }}>
                {convertLoading?<Loader2 size={14} className="animate-spin"/>:<GitMerge size={14}/>}Convertir en Deal
              </button>
            </div>
          </div>
        </div>
      )}

      {prospect.sourceDetails?.browserDraft?.incomplete && !prospect.postalCode &&
        <div role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong>Prospect importé avec des informations incomplètes.</strong> La fiche provient d’une capture Google/Bing.
          L’adresse exacte, le code postal, le SIREN et le SIRET n’ont pas été vérifiés. Complétez les données avant de démarrer une campagne.
        </div>}
      {pendingConflicts.length>0&&
        <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <h2 className="text-base font-bold text-amber-950 flex gap-2 items-center"><GitMerge size={18}/>
            {pendingConflicts.length} donnée(s) contradictoire(s) à vérifier</h2>
          <p className="text-xs text-amber-900 my-2">Les valeurs déjà présentes dans le CRM n'ont pas été remplacées.
            Pour chaque désaccord, choisissez celle que vous souhaitez conserver.</p>
          <div className="space-y-3 mt-3">
            {pendingConflicts.map(conflict=><div key={conflict.id} className="bg-white rounded-xl border border-amber-200 p-3">
              <div className="font-semibold text-sm text-gray-800">{conflictLabels[conflict.field]||conflict.field}
                <span className="ml-2 text-xs text-gray-500 font-normal">Source : {conflict.source}</span></div>
              <div className="grid gap-3 sm:grid-cols-2 my-2 text-sm">
                <div className="rounded-lg bg-gray-50 p-2"><span className="text-xs text-gray-500">Dans le CRM</span>
                  <p className="break-all font-medium">{conflict.existing}</p></div>
                <div className="rounded-lg bg-teal-50 p-2"><span className="text-xs text-teal-800">Nouvelle information</span>
                  <p className="break-all font-medium">{conflict.incoming}</p></div>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <button type="button" onClick={()=>void resolveConflict(conflict.id,'keep_existing')}
                  className="px-3 py-2 rounded-lg bg-gray-100 text-gray-800 text-xs font-semibold">Conserver le CRM</button>
                <button type="button" onClick={()=>void resolveConflict(conflict.id,'use_incoming')}
                  className="px-3 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold">Utiliser la nouvelle valeur</button>
                {conflict.sourceUrl&&<a href={conflict.sourceUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-teal-700 underline">Vérifier la source ↗</a>}
              </div>
            </div>)}
          </div>
        </div>}
      {sourceHistory.length>0&&<details className="mb-5 rounded-xl border border-gray-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-gray-800">
          Historique des enrichissements · {sourceHistory.length} capture(s)
        </summary>
        <div className="mt-3 space-y-2">
          {[...sourceHistory].reverse().map((entry,index)=><div key={`${entry.captureId}-${index}`}
            className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-700">
            <strong>{entry.source.replaceAll('_',' ')}</strong>
            <span className="mx-2 text-gray-400">·</span>
            <time>{new Date(entry.capturedAt).toLocaleString('fr-FR')}</time>
            {Array.isArray(entry.fieldsFilled)&&entry.fieldsFilled.length>0&&<p className="mt-1">Données ajoutées : {entry.fieldsFilled.map(f=>conflictLabels[f]||f).join(', ')}</p>}
            {entry.sourceUrl&&<a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer"
              className="text-teal-700 underline inline-block mt-1">Consulter la fiche source</a>}
          </div>)}
        </div>
      </details>}
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button onClick={() => navigate('/prospects')} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft size={20} style={{ color: 'var(--text-muted)' }} />
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-[220px]">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-xl font-bold"
            style={{ background: 'var(--color-primary)' }}>{initials}</div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{fullName}</h1>
            <div className="flex items-center gap-2">
              {contactName && prospect.jobTitle && <span className="text-sm text-gray-500">{prospect.jobTitle} ·</span>}
              {contactName && prospect.company && <span className="text-sm text-gray-500">{prospect.company}</span>}
              {!contactName && <span className="text-sm text-gray-500">Entreprise prospectée</span>}
              <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium" style={{ background: statusColor }}>
                {STATUS_OPTIONS.find(s => s.value === prospect.status)?.label}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={editing||returnProcessing} onClick={() => navigate(`/outils?mode=enrich&prospectId=${id}`)} className="px-3 py-2 bg-teal-700 text-white rounded-xl text-sm font-medium disabled:opacity-50">Enrichir</button>
          <button type="button" disabled={editing||returnProcessing} onClick={() => setShowSocieteEnrichment(true)} className="px-3 py-2 border rounded-xl text-sm font-medium text-teal-700">
            Enrichir via Societe.com
          </button>
          <button onClick={toggleStar} className={`p-2 rounded-xl ${prospect.isStarred ? 'bg-amber-50' : 'hover:bg-gray-100'}`}>
            <Star size={18} className={prospect.isStarred ? 'fill-amber-400 text-amber-400' : 'text-gray-400'} />
          </button>
          <button onClick={archiveProspect} title={prospect.status === 'archived' ? 'Restaurer' : 'Archiver'}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
            style={{ color: prospect.status === 'archived' ? '#059669' : 'var(--text-muted)' }}>
            {prospect.status === 'archived' ? <RotateCcw size={18} /> : <Archive size={18} />}
          </button>
          {(
            <button onClick={() => linkedDeals.length > 0 ? navigate(`/pipeline/${linkedDeals[0].id}`) : openConvertModal()}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
              style={{ background:'#EEF2FF',color:'#6366F1',border:'1px solid #C7D2FE' }}
              title={linkedDeals.length > 0 ? 'Voir le deal lié à ce prospect' : 'Créer un deal lié à ce prospect'}>
              <GitMerge size={14}/>{linkedDeals.length > 0 ? 'Voir le deal' : 'Créer un deal'}
            </button>
          )}
          {editing ? (
            <>
              <button onClick={() => setEditing(false)} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600">Annuler</button>
              <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ background: 'var(--color-primary)' }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}Enregistrer
              </button>
            </>
          ) : (
            <button disabled={returnProcessing} onClick={() => setEditing(true)} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-teal-300 disabled:opacity-50">
              <Edit2 size={14} />Modifier
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left — Info */}
        <div className="lg:col-span-2 space-y-4">
          <ProspectCompanyProfile key={id} prospect={prospect} />
          {/* Informations légales structurées, accessibles sans enrichissement */}
          <section className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <div className="flex flex-wrap gap-3 justify-between items-center mb-4">
              <h2 className="font-semibold text-base flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><Building2 size={17} className="text-teal-600"/>Identité de l’entreprise</h2>
              <div className="flex items-center gap-2 flex-wrap">
                {(prospect.siren || prospect.siret) && <button type="button" onClick={()=>void enrichOfficialActivity()} disabled={enrichingActivity}
                  className="text-xs inline-flex items-center gap-1 px-3 py-2 border border-teal-200 rounded-lg text-teal-700 disabled:opacity-50">
                  {enrichingActivity ? <Loader2 size={12} className="animate-spin"/> : <RefreshCw size={12}/>}
                  {enrichingActivity ? 'Vérification APE…' : 'Compléter l’activité (INSEE)'}
                </button>}
                {prospect.siren && <a href={`https://annuaire-entreprises.data.gouv.fr/entreprise/${prospect.siren}`} target="_blank" rel="noreferrer" className="text-xs inline-flex items-center gap-1 text-teal-700 hover:underline"><ExternalLink size={12}/>Annuaire officiel</a>}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {editing ? (
                <>
                  {[
                    { key: 'company', label: 'Raison sociale', maxLength: 160 },
                    { key: 'siren', label: 'SIREN (9 chiffres)', maxLength: 9 },
                    { key: 'siret', label: 'SIRET de l’établissement (14 chiffres)', maxLength: 14 },
                    { key: 'apeCode', label: 'Code APE / NAF (ex. 43.22A)', maxLength: 6 },
                    { key: 'nafLabel', label: 'Secteur d’activité · libellé NAF', maxLength: 250 },
                    { key: 'nafVersion', label: 'Nomenclature (ex. NAFRev2)', maxLength: 32 },
                    { key: 'postalCode', label: 'Code postal (5 chiffres)', maxLength: 5 },
                    { key: 'city', label: 'Ville', maxLength: 120 },
                  ].map(field => <div key={field.key}>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{field.label}</label>
                    <input maxLength={field.maxLength} value={form[field.key] ?? ''} onChange={e => sf(field.key, e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
                  </div>)}
                </>
              ) : (
                <>
                  {[
                    { key: 'company', label: 'Raison sociale', value: prospect.company },
                    { key: 'siren', label: 'SIREN', value: prospect.siren },
                    { key: 'siret', label: 'SIRET de l’établissement', value: prospect.siret },
                    { key: 'apeCode', label: 'Code APE / NAF', value: prospect.apeCode },
                    { key: 'nafLabel', label: 'Secteur d’activité · libellé NAF', value: prospect.nafLabel },
                    { key: 'nafVersion', label: 'Nomenclature', value: prospect.nafVersion },
                    { key: 'postalCode', label: 'Code postal', value: prospect.postalCode },
                    { key: 'city', label: 'Ville', value: prospect.city },
                  ].map(field => <div key={field.key} className="min-w-0">
                    <div className="text-xs mb-1 text-gray-500">{field.label}</div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold break-all ${field.value ? 'text-gray-900' : 'text-gray-400'}`}>{field.value || 'Non renseigné'}</span>
                      {field.value && (field.key === 'siren' || field.key === 'siret') && <button type="button" onClick={() => { void navigator.clipboard.writeText(field.value); toast.success(`${field.label} copié`); }} aria-label={`Copier ${field.label}`} className="text-gray-400 hover:text-teal-700"><Copy size={13}/></button>}
                    </div>
                  </div>)}
                </>
              )}
            </div>
            {!editing && prospect.sourceDetails?.annuaire?.apeScope === 'unite_legale' && prospect.apeCode &&
              <p className="text-xs text-amber-700 mt-3">Code APE de l’unité légale : l’activité propre à cet établissement n’a pas été confirmée.</p>}
            {!editing && !prospect.apeCode && <p className="text-xs text-gray-500 mt-3">Code APE non communiqué par la source. Renseignez-le après vérification ou lors d’un enrichissement officiel.</p>}
            {!editing && (!prospect.siren || !prospect.siret) && <p className="text-xs text-amber-700 mt-4 bg-amber-50 rounded-lg p-2.5">Identifiant absent de cette fiche. GrowthOS ne l’invente pas : vous pouvez le renseigner après vérification.</p>}
          </section>

          {prospect.source && <div className="rounded-xl border px-4 py-3 flex flex-wrap items-center gap-2 text-xs" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--text-muted)' }}>
            <span className="font-semibold">Source :</span>
            <span>{prospect.source === 'pagesjaunes' ? 'PagesJaunes.fr' : prospect.source === 'annuaire-entreprises' ? 'Annuaire des entreprises' : prospect.source}</span>
            {pagesJaunesProfile && <a href={prospect.sourceUrl} target="_blank" rel="noreferrer" className="text-teal-700 underline">Voir la fiche source</a>}
            {pagesJaunesProfile && <button onClick={enrichFromPagesJaunes} disabled={enrichingPagesJaunes}
              className="ml-auto px-3 py-2 rounded-lg bg-teal-600 text-white font-semibold disabled:opacity-50 flex gap-1.5 items-center">
              {enrichingPagesJaunes ? <Loader2 size={13} className="animate-spin"/> : <RefreshCw size={13}/>}
              {enrichingPagesJaunes ? 'Lecture de la fiche…' : 'Compléter depuis PagesJaunes'}
            </button>}
          </div>}
          {pagesJaunesDetails && <section className="rounded-2xl border p-4 sm:p-5 space-y-4" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-teal-600"/>
                <h2 className="text-sm font-bold" style={{color:'var(--text-primary)'}}>DONNÉES PAGESJAUNES</h2>
              </div>
              <span className="text-xs text-gray-500">
                Relevé : {pagesJaunesDetails.capturedAt ? new Date(pagesJaunesDetails.capturedAt).toLocaleString('fr-FR') : 'date inconnue'}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border p-4 space-y-3" style={{borderColor:'var(--card-border)'}}>
                <div className="flex items-center gap-2 font-semibold text-sm" style={{color:'var(--text-primary)'}}>
                  <Building2 size={15} className="text-teal-600"/> Coordonnées et INSEE
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><div className="text-xs text-gray-500">SIREN</div><div className="font-medium" style={{color:'var(--text-primary)'}}>{prospect.siren || pagesJaunesDetails.siren || 'Non indiqué'}</div></div>
                  <div><div className="text-xs text-gray-500">SIRET</div><div className="font-medium" style={{color:'var(--text-primary)'}}>{prospect.siret || pagesJaunesDetails.siret || 'Non indiqué'}</div></div>
                </div>
                {pjWebsiteValid && <a href={pjWebsite} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 break-all text-sm text-teal-700 hover:underline">
                  <Globe size={15} className="shrink-0"/> {new URL(pjWebsite).hostname.replace(/^www\./,'')} <ExternalLink size={13} className="shrink-0"/>
                </a>}
                {!pjWebsiteValid && <p className="text-xs text-gray-500">Site web non identifié sur la fiche source.</p>}
                {pagesJaunesDetails.socials && <div className="flex gap-3 flex-wrap">
                  {Object.entries(pagesJaunesDetails.socials as Record<string,string>)
                    .filter(([,url]) => /^https?:\/\//i.test(url))
                    .map(([site,url]) => <a key={site} href={url} rel="noopener noreferrer" target="_blank"
                      className="text-sm text-teal-700 underline">{site}</a>)}
                </div>}
              </div>
              <div className="rounded-xl border p-4 space-y-3" style={{borderColor:'var(--card-border)'}}>
                <div className="flex items-center gap-2 font-semibold text-sm" style={{color:'var(--text-primary)'}}>
                  <Clock size={15} className="text-teal-600"/> Horaires d'ouverture
                </div>
                {pjHours.length > 0 ? <div className="space-y-1.5">
                  {pjHours.map((line: string) => {
                    const parts = line.split(/\s*:\s*/);
                    return <div key={parts[0]} className="flex justify-between gap-3 text-xs sm:text-sm py-1 border-b last:border-0"
                      style={{borderColor:'var(--card-border)'}}>
                      <span className="text-gray-500">{parts[0]}</span>
                      <span className="font-medium text-right" style={{color:'var(--text-primary)'}}>{parts.slice(1).join(' : ')}</span>
                    </div>;
                  })}
                </div> : <p className="text-sm text-gray-500">Horaires non disponibles ou à relever de nouveau.</p>}
              </div>
              <div className="rounded-xl border p-4 space-y-3" style={{borderColor:'var(--card-border)'}}>
                <div className="flex items-center gap-2 font-semibold text-sm" style={{color:'var(--text-primary)'}}>
                  <Star size={15} className="text-amber-500"/> Avis clients
                </div>
                {pagesJaunesDetails.rating != null ? <div className="flex items-end gap-2">
                  <span className="font-bold text-2xl" style={{color:'var(--text-primary)'}}>{pagesJaunesDetails.rating}/5</span>
                  <span className="text-sm text-gray-500 pb-1">{pagesJaunesDetails.reviewCount != null ? '(' + pagesJaunesDetails.reviewCount + ' avis)' : 'Note affichée'}</span>
                </div> : <p className="text-sm text-gray-500">Aucune note relevée.</p>}
                {pjReviews.length ? <div className="space-y-3">
                  {pjReviews.map((review: any, index: number) => <div key={index} className="border-t pt-2" style={{borderColor:'var(--card-border)'}}>
                    <div className="flex gap-2 justify-between text-xs text-gray-500">
                      <span className="font-medium">{review.author || 'Auteur non précisé'}</span>
                      <span>{review.date || ''}</span>
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-wrap break-words" style={{color:'var(--text-primary)'}}>{review.text}</p>
                  </div>)}
                </div> : <p className="text-xs text-gray-500">Le texte des avis n'est affiché que s'il a pu être lu distinctement.</p>}
              </div>
              {(pjDescription || pjServices) && <div className="rounded-xl border p-4 space-y-3" style={{borderColor:'var(--card-border)'}}>
                <div className="font-semibold text-sm" style={{color:'var(--text-primary)'}}>Activité et présentation</div>
                {pjDescription && <p className="text-sm break-words" style={{color:'var(--text-primary)'}}>{pjDescription}</p>}
                {pjServices && <div><div className="text-xs text-gray-500 mb-1">Prestations</div>
                  <p className="text-sm break-words" style={{color:'var(--text-primary)'}}>{pjServices}</p>
                </div>}
              </div>}
            </div>
            <p className="text-xs text-gray-500">
              SIREN/SIRET non renseignés tant qu'une identification INSEE fiable n'est pas visible. Les champs absents ne sont pas inventés.
            </p>
          </section>}
          {/* Coordonnées */}
          <div className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <h2 className="font-semibold mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>CONTACT ET COORDONNÉES</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {editing ? (
                <>
                  {[
                    { k: 'firstName', l: 'Prénom' }, { k: 'lastName', l: 'Nom' },
                    { k: 'email', l: 'Email' }, { k: 'phone', l: 'Téléphone' },
                    { k: 'jobTitle', l: 'Poste' },
                    { k: 'website', l: 'Site web' }, { k: 'linkedinUrl', l: 'LinkedIn' },
                  ].map(f => (
                    <div key={f.k} className={f.k === 'website' || f.k === 'linkedinUrl' ? 'sm:col-span-2' : ''}>
                      <label className="block text-xs font-medium text-gray-500 mb-1">{f.l}</label>
                      <input value={form[f.k] || ''} onChange={e => sf(f.k, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                    </div>
                  ))}

                  {/* Address with Nominatim autocomplete — full width */}
                  <div className="sm:col-span-2">
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
                    <input type="number" min={0} max={100} value={form.score ?? 0} onChange={e => sf('score', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                </>
              ) : (
                <>
                  {[
                    { l: 'Email', v: prospect.email, icon: <Mail size={14} />, href: prospect.email ? `mailto:${prospect.email}` : undefined },
                    { l: 'Téléphone', v: prospect.phone, icon: <Phone size={14} />, href: prospect.phone ? `tel:${prospect.phone}` : undefined },
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
                  <div className="sm:col-span-2">
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

          {!editing && <ProspectProfessionalSources prospect={prospect} />}

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

          {/* Données enrichies */}
          <EnrichedDataPanel prospectId={prospect.id} />

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
                      {act.dealId && act.dealTitle && <button className="text-xs text-teal-700 underline" onClick={() => navigate(`/pipeline/${act.dealId}`)}>Deal · {act.dealTitle}</button>}
                      {act.description && <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{act.description}</div>}
                      <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        {new Date(act.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    {act.type === 'note' && <EditNote note={act} onSaved={fetchActivities} />}
                    <button onClick={() => deleteActivity(act.id)} className="text-red-400 hover:text-red-600 flex-shrink-0">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <h2 className="font-semibold text-sm mb-3" style={{ color: 'var(--text-muted)' }}>COMMENTAIRES D’ÉQUIPE</h2>
            <CommentsPanel entityType="prospect" entityId={prospect.id} />
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

          {/* Indicateur de complétude explicite, pas un score IA */}
          {(() => {
            const { criteria, computedScore } = computeScoring(prospect);
            const score = computedScore;
            const color = score >= 70 ? '#059669' : score >= 40 ? '#D97706' : '#DC2626';
            const label = score >= 70 ? 'Bien renseignée' : score >= 40 ? 'À compléter' : 'Incomplète';
            const TrendIcon = score >= 70 ? TrendingUp : score >= 40 ? Minus : TrendingDown;
            return (
              <div className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <FileText size={14} style={{ color: 'var(--color-primary)' }} />
                  <h2 className="font-semibold text-sm" style={{ color: 'var(--text-muted)' }}>COMPLÉTUDE DE LA FICHE</h2>
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
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Champs renseignés · pas un score IA</div>
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
              <button onClick={() => linkedDeals.length > 0 ? navigate(`/pipeline/${linkedDeals[0].id}`) : openConvertModal()}
                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm border transition-all hover:border-teal-300"
                style={{ background: 'var(--body-bg)', borderColor: 'var(--card-border)', color: 'var(--text-secondary)' }}>
                <MessageSquare size={14} style={{ color: '#D97706' }} />{linkedDeals.length > 0 ? 'Voir le deal lié' : 'Créer un deal lié'}
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
      </div>
    </div>
  );
}
