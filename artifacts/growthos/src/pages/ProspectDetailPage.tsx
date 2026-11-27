import {ProspectContactPoints} from '@/components/ProspectContactPoints';
import {prospectBusinessNames,previousProspectDisplayName} from '../../../../lib/api-zod/src/prospect-names';
import {collectedRelationships} from '@/lib/prospect-relationships';
import {type EnrichmentRun} from '@/components/ProspectEnrichmentStatus';
import {ProspectEnrichmentsTab} from '@/components/ProspectEnrichmentsTab';
import {enrichmentSourceLabel,prospectEnrichmentUrl,prospectViewFromSearch} from '@/lib/prospect-enrichment';
import { ConnectorEnrichmentReturn } from '@/components/ConnectorEnrichmentReturn';
import { ProspectProfessionalSources } from '@/components/ProspectProfessionalSources';
import { ProspectCompanyProfile } from '@/components/ProspectCompanyProfile';
import { ProspectRelationshipMap, ProspectPappersDossier } from '@/components/atlas/ProspectRelationshipMap';
import { Prospect360Dashboard, ProspectOrbitBanner } from '@/components/atlas/Prospect360Dashboard';
import { CompanyLogo, SourceLogo } from '@/components/atlas/ProspectLogos';
import { collectProspectPeople } from '@/lib/prospect-people';
import { hasValidGeoPosition } from '@/lib/prospect-completeness';
import { EditNote } from '@/components/EditNote';
import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams, useLocation,useSearch } from 'wouter';
import {
  ArrowLeft, Edit2, Save, X, Star, Mail, Phone, Globe, Building2,
  Briefcase, Loader2, Plus, Trash2, CheckCircle, AlertCircle,
  MessageSquare, Phone as PhoneIcon, Calendar, FileText, Clock,
  Archive, RotateCcw, RefreshCw, Brain, MapPin,
  ExternalLink, Navigation, Zap, BadgeCheck, ChevronDown, ChevronUp,
  Building, Database, BarChart2, Users, Newspaper, GitMerge, Copy, Network, LayoutGrid, MoreHorizontal,
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';
import { CommentsPanel } from '@/components/common/CommentsPanel';
import { AddressAutocomplete } from '@/components/common/AddressAutocomplete';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Marqueur bleu ATLAS, sans image externe.
const atlasLocationIcon = L.divIcon({
  className: '',
  html: `<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:#176bee;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);transform:rotate(-45deg)"></div>`,
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

function ProspectMiniMap({ lat, lng, label, address, height = 200 }: { lat: number; lng: number; label: string; address?: string; height?: number }) {
  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', height, position: 'relative', border: '1px solid var(--card-border)' }}>
      <MapContainer center={[lat, lng]} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={false} scrollWheelZoom={true} attributionControl={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FlyTo lat={lat} lng={lng} />
        <Marker position={[lat, lng]} icon={atlasLocationIcon}>
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
    <div className="atlas-360-detail-module atlas-360-enriched-data rounded-2xl border overflow-hidden" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
      <button onClick={load} className="flex items-center justify-between w-full px-5 py-4 text-left hover:opacity-80 transition-opacity">
        <h2 className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
          <Database size={16} />Données enrichies
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
              Aucune donnée enrichie — utilisez les outils de sourcing ou le panneau d'enrichissement du dossier.
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
  const search=useSearch();
  const [active360View,setActive360ViewState]=useState(()=>prospectViewFromSearch(search));
  useEffect(()=>setActive360ViewState(prospectViewFromSearch(search)),[id,search]);
  const setActive360View=(view:'overview'|'relations'|'enrichments')=>{setActive360ViewState(view);const p=new URLSearchParams(search);p.set('view',view);navigate('/prospects/'+id+'?'+p.toString(),{replace:true});};
  const [sourceSavedNotice,setSourceSavedNotice]=useState('');
  useEffect(()=>{let alive=true;setSourceSavedNotice('');const jobId=new URLSearchParams(search).get('reviewedJob');if(!jobId)return;void apiClient.get<any>('/browser/jobs/'+jobId).then(job=>{if(alive&&job.prospect_id===id&&job.status==='completed'&&job.result?.applied)setSourceSavedNotice('Enregistré depuis '+enrichmentSourceLabel(job.result.captures?.[0]?.source||'la source')+' · '+(job.result.applied.filled?.length||0)+' champ(s) mis à jour.');}).catch(()=>{});return()=>{alive=false;};},[id,search]);
  const legacyDetailsRef = useRef<HTMLDetailsElement>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const editingRef=useRef(editing);editingRef.current=editing;
  const editBaseline=useRef<any>(null);
  const [returnProcessing,setReturnProcessing]=useState(false);
  const [form, setForm] = useState<any>({});
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [resolvingConflict,setResolvingConflict]=useState<string|null>(null);
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [enrichmentRun,setEnrichmentRun]=useState<EnrichmentRun|null>(null);
  const enrichmentStamp=useRef('');
  const [enrichingActivity, setEnrichingActivity] = useState(false);
  const [lastEnrichedAt, setLastEnrichedAt] = useState<Date | null>(null);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertLoading, setConvertLoading] = useState(false);
  const [linkedDeals, setLinkedDeals] = useState<{ id: string; title: string; stage: string }[]>([]);
  const [officialManagers,setOfficialManagers] = useState<string[]>([]);
  const [convertForm, setConvertForm] = useState({ title: '', value: '0', stage: 'lead', closeDate: '' });

  const fetchProspect = async () => {
    try {
      const data = await apiClient.get(`/prospects/${id}`);
      setProspect(data);
      if(!editingRef.current)setForm(data);
    } catch { toast.error('Prospect introuvable'); navigate('/prospects'); }
    finally { setLoading(false); }
  };

  const openSourceEnrichment=(source='societe_com')=>{
    if(saving)return;
    if(editing&&!window.confirm('Les modifications non enregistrées seront abandonnées. Ouvrir l’enrichissement par sources ?'))return;
    navigate(prospectEnrichmentUrl(id,source));
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
      const lastCompleted = Array.isArray(history) ? history.find(entry =>
        entry?.status === 'completed' || (!entry?.status && (entry?.createdAt || entry?.created_at))) : null;
      const timestamp = lastCompleted?.completed_at || lastCompleted?.started_at || lastCompleted?.createdAt || lastCompleted?.created_at;
      const date = timestamp ? new Date(timestamp) : null;
      setLastEnrichedAt(date && Number.isFinite(date.getTime()) ? date : null);
    } catch { /* plugin may not be active */ }
  };

  useEffect(()=>{
    let alive=true,pending=false;
    const read=async()=>{
      if(pending)return;pending=true;
      try{
        const run=await apiClient.get<EnrichmentRun|null>('/prospects/'+id+'/enrichment');
        if(!alive)return;
        setEnrichmentRun(run);setEnriching(!!run&&['queued','running'].includes(run.status));
        const stamp=JSON.stringify(Object.values(run?.steps||{}).map(step=>[step.status,step.filled]));
        if(enrichmentStamp.current&&enrichmentStamp.current!==stamp){void fetchProspect();void fetchActivities();}
        enrichmentStamp.current=stamp;
        if(run?.summary.sourcesDone)setLastEnrichedAt(new Date(run.updated_at));
      }catch{/* Une panne de suivi n'efface pas le dernier résultat connu. */}finally{pending=false;}
    };
    enrichmentStamp.current='';setEnrichmentRun(null);void read();
    const timer=window.setInterval(()=>void read(),3500);
    return()=>{alive=false;window.clearInterval(timer);};
  },[id]);
  const handleEnrich = async () => {
    if(saving||enriching)return;
    if(editing){toast.info('Enregistrez les modifications de la fiche avant l’enrichissement automatique.');return;}
    setEnriching(true);
    try {
      const run=await apiClient.post<EnrichmentRun>('/prospects/'+id+'/enrichment',{});
      setEnrichmentRun(run);setActive360View('enrichments');
      toast.info('Enrichissement lancé : les sources disponibles sont recherchées et croisées en arrière-plan.');
    } catch(error:any) {setEnriching(false);toast.error(error.message||'Enrichissement indisponible');}
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

  const fetchOfficialManagers = async () => {
    if (!id) return;
    try {
      const response = await apiClient.get<{snapshot?:{managers?:string[]}|null}>(`/prospects/${id}/monitoring`);
      setOfficialManagers(Array.isArray(response?.snapshot?.managers)?response.snapshot.managers:[]);
    } catch { setOfficialManagers([]); }
  };

  useEffect(() => {setOfficialManagers([]);fetchProspect();fetchActivities();fetchEnrichmentHistory();fetchLinkedDeals();void fetchOfficialManagers();}, [id]);

  const save = async () => {
    setSaving(true);
    try {
      const editableFields = ['firstName','lastName','email','phone','company','siren','siret','apeCode',
        'nafLabel','nafVersion','postalCode','city','linkedinUrl','jobTitle','website','address','lat','lng','status','score','isStarred'];
      const changedFields = Object.fromEntries(editableFields
        .filter(field => form[field] !== undefined && !Object.is(form[field],(editBaseline.current||prospect)[field]))
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

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--body-bg)' }}>
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-primary)' }} />
    </div>
  );
  if (!prospect) return null;
  const prospectPeople = collectProspectPeople(prospect,officialManagers);
  const hasLocationPoint = hasValidGeoPosition(prospect.lat,prospect.lng);

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
  const businessNames=prospectBusinessNames(prospect);
  const previousDisplayName=previousProspectDisplayName(prospect.company,activities);
  const restoreDisplayName=async()=>{if(!previousDisplayName||resolvingConflict)return;setResolvingConflict('display-name');try{const result=await apiClient.post<{prospect:any}>('/sourcing/device/prospects/'+id+'/display-name',{name:previousDisplayName,expectedCurrentValue:prospect.company||null});setProspect(result.prospect);await fetchActivities();toast.success('Nom affiché rétabli ; raison sociale conservée.');}catch(e:any){await fetchProspect();toast.error(e.message);}finally{setResolvingConflict(null);}};
  const conflictLabels:Record<string,string>={company:'Nom affiché',address:'Adresse',postalCode:'Code postal',city:'Ville',
    phone:'Téléphone',email:'Email',website:'Site web',linkedinUrl:'LinkedIn',siret:'SIRET',siren:'SIREN',
    apeCode:'Code APE / NAF',nafLabel:'Libellé NAF',nafVersion:'Nomenclature'};
  const resolveConflict=async(conflictId:string,decision:'keep_existing'|'use_incoming')=>{
    if(resolvingConflict)return;setResolvingConflict(conflictId);
    const conflict=pendingConflicts.find(c=>c.id===conflictId);
    try{
      const result=await apiClient.post(`/sourcing/device/prospects/${id}/resolve-conflict`,{conflictId,decision,expectedCurrentValue:conflict?(prospect as any)[conflict.field]??null:null}) as {prospect:any;alreadyResolved?:boolean};
      setProspect(result.prospect);
      void fetchActivities();
      toast.success(result.alreadyResolved?'Cette information a déjà été traitée':decision==='use_incoming'?'Nouvelle valeur appliquée':'Valeur actuelle conservée');
    }catch(error:any){if(error?.status===409){await fetchProspect();toast.info('Les valeurs ont été actualisées. Vérifiez-les puis choisissez celle à conserver.');}else toast.error(error?.message||'Impossible de résoudre ce conflit');}finally{setResolvingConflict(null);}
  };

  const openDetailedSection = (sectionId?:string) => {
    setActive360View('overview');
    window.setTimeout(()=>{
      if(legacyDetailsRef.current)legacyDetailsRef.current.open=true;
      if(sectionId)window.setTimeout(()=>document.getElementById(sectionId)?.scrollIntoView({behavior:'smooth',block:'start'}),60);
    },0);
  };
  const openEditor = (sectionId = 'atlas-prospect-contacts') => {
    editBaseline.current=prospect;
    setForm(prospect);
    setEditing(true);
    openDetailedSection(sectionId);
  };
  const updateOpportunityStatus = async (status:string) => {
    try {
      const updated=await apiClient.patch<any>(`/prospects/${id}`,{status});
      setProspect(updated);
      if(!editingRef.current)setForm(updated);
      toast.success('Statut du prospect mis à jour');
    }catch{toast.error('Impossible de modifier le statut du prospect');}
  };

  return (
    <div className="atlas-prospect-360 min-h-screen p-4 sm:p-6" style={{ background: 'var(--body-bg)' }}>
      {!!prospect.identityConflicts?.length && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 text-amber-950 p-4 mb-4">
        <p className="font-semibold">SIRET déjà utilisé sur une autre fiche prospect</p>
        <p className="text-sm">Vérifiez ces fiches avant de poursuivre l’enrichissement.</p>
        {prospect.identityConflicts.map((other:any) => <Link key={other.id} className="block underline mt-1" to={'/prospects/' + other.id}>{other.company || 'Prospect sans nom'} · {other.siret}</Link>)}
      </div>}
      {prospect.identityMismatch && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 text-red-900 p-4 mb-4">Le SIREN et le SIRET de cette fiche ne correspondent pas. Vérifiez les identifiants avant de poursuivre.</p>}

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
          Certaines coordonnées restent à compléter ou à vérifier. Les identifiants déjà affichés ci-dessous sont conservés.
        </div>}
      {pendingConflicts.length>0&&
        <div id="enrichment-conflicts" className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <h2 className="text-base font-bold text-amber-950 flex gap-2 items-center"><GitMerge size={18}/>
            {pendingConflicts.length} donnée(s) contradictoire(s) à vérifier</h2>
          <p className="text-xs text-amber-900 my-2">L’entreprise a été rapprochée. Les valeurs différentes sont proposées ci-dessous, sans remplacement silencieux.
            Pour chaque désaccord, choisissez celle que vous souhaitez conserver.</p>
          <div className="space-y-3 mt-3">
            {pendingConflicts.map(conflict=><div key={conflict.id} className="bg-white rounded-xl border border-amber-200 p-3">
              <div className="font-semibold text-sm text-gray-800 flex items-center flex-wrap gap-2"><SourceLogo source={conflict.source} size="sm"/>{conflictLabels[conflict.field]||conflict.field}
                <span className="ml-2 text-xs text-gray-500 font-normal">Source : {conflict.source}</span></div>
              <div className="grid gap-3 sm:grid-cols-2 my-2 text-sm">
                <div className="rounded-lg bg-gray-50 p-2"><span className="text-xs text-gray-500">Dans le CRM</span>
                  <p className="break-all font-medium">{String((prospect as any)[conflict.field]??'Non renseigné')}</p></div>
                <div className="rounded-lg bg-teal-50 p-2"><span className="text-xs text-teal-800">Nouvelle information</span>
                  <p className="break-all font-medium">{conflict.incoming}</p></div>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <button type="button" disabled={editing||returnProcessing||!!resolvingConflict} onClick={()=>void resolveConflict(conflict.id,'keep_existing')}
                  className="px-3 py-2 rounded-lg bg-gray-100 text-gray-800 text-xs font-semibold">Conserver le CRM</button>
                <button type="button" disabled={editing||returnProcessing||!!resolvingConflict} onClick={()=>void resolveConflict(conflict.id,'use_incoming')}
                  className="px-3 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold">Utiliser la nouvelle valeur</button>
                {conflict.sourceUrl&&<a href={conflict.sourceUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-teal-700 underline">Vérifier la source ↗</a>}
              </div>
            </div>)}
          </div>
        </div>}
      {/* Header */}
      <div className="atlas-360-breadcrumb"><button onClick={()=>navigate('/prospects')}>Prospects</button><span>/</span><strong>{fullName}</strong></div>
      <div className="atlas-360-hero flex flex-wrap items-center gap-3 mb-6">
        <button onClick={() => navigate('/prospects')} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft size={20} style={{ color: 'var(--text-muted)' }} />
        </button>
        <div className="atlas-360-hero-identity flex items-center gap-3 flex-1 min-w-[220px]">
          <div className="atlas-360-hero-icon w-12 h-12 rounded-2xl flex items-center justify-center text-white text-xl font-bold"
            style={{ background: 'var(--color-primary)' }}>
            <CompanyLogo name={prospect.company||fullName} website={prospect.website}
              logoUrl={prospect.sourceDetails?.logoUrl||null} size="lg" />
          </div>
          <div>
            <div className="atlas-360-hero-title"><h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{fullName}</h1>
              {prospect.sourceDetails?.annuaire && <span className="atlas-360-company-active"><CheckCircle size={14}/> Identité vérifiée</span>}</div>
            <div className="atlas-360-hero-meta flex items-center gap-2">
              {contactName && prospect.jobTitle && <span className="text-sm text-gray-500">{prospect.jobTitle} ·</span>}
              {contactName && prospect.company && <span className="text-sm text-gray-500">{prospect.company}</span>}
              {!contactName && <span className="text-sm text-gray-500">Entreprise prospectée</span>}
              {businessNames.legalName&&businessNames.legalName!==prospect.company&&<span className="text-sm text-gray-500">Raison sociale : {businessNames.legalName}</span>}
              {previousDisplayName&&<button type="button" className="atlas-360-text-button" disabled={!!resolvingConflict||editing} onClick={()=>void restoreDisplayName()}>Rétablir le nom précédent : {previousDisplayName}</button>}
              <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium" style={{ background: statusColor }}>
                {STATUS_OPTIONS.find(s => s.value === prospect.status)?.label}
              </span>
              {prospect.updatedAt&&<span className="atlas-360-source-caption">Mis à jour le {new Date(prospect.updatedAt).toLocaleDateString('fr-FR')}</span>}
            </div>
          </div>
        </div>
        <div className="atlas-360-hero-actions flex flex-wrap gap-2">
          {prospect.phone?<a href={'tel:'+prospect.phone} className="atlas-360-hero-button"><Phone size={18}/> Appeler</a>
            :<button className="atlas-360-hero-button" disabled title="Téléphone non renseigné"><Phone size={18}/> Appeler</button>}
          <button type="button" disabled={saving||enriching} onClick={() => void handleEnrich()}
            className="atlas-360-hero-button">{enriching?<Loader2 size={17} className="animate-spin"/>:<Database size={17}/>} {enriching?'Enrichissement…':'Enrichir automatiquement'}</button>
          <button onClick={() => linkedDeals.length > 0 ? navigate(`/pipeline/${linkedDeals[0].id}`) : openConvertModal()}
            className="atlas-360-hero-button primary"><Plus size={20}/>{linkedDeals.length > 0 ? 'Voir le deal' : 'Créer un deal'}</button>
          {editing ? (
            <>
              <button onClick={() => setEditing(false)} className="atlas-360-hero-button">Annuler</button>
              <button onClick={save} disabled={saving} className="atlas-360-hero-button primary">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}Enregistrer
              </button>
            </>
          ) : null}
          <details className="atlas-360-extra-menu">
            <summary aria-label="Plus d'actions" title="Plus d'actions"><MoreHorizontal size={21}/></summary>
            <div className="atlas-360-extra-popover">
              <button type="button" disabled={editing||returnProcessing||!!resolvingConflict} onClick={()=>openEditor()}><Edit2 size={16}/> Modifier la fiche</button>
              <button type="button" disabled={saving} onClick={()=>openSourceEnrichment()}><Database size={16}/> Rechercher l’identité légale</button>
              <button onClick={toggleStar}><Star size={16}/>{prospect.isStarred?'Retirer des favoris':'Ajouter aux favoris'}</button>
              <button onClick={archiveProspect}><Archive size={16}/>{prospect.status==='archived'?'Restaurer':'Archiver'}</button>
            </div>
          </details>
        </div>
      </div>

      <ConnectorEnrichmentReturn prospectId={id!} onSaved={async() => {await fetchProspect();await fetchActivities();}} onBusyChange={setReturnProcessing}/>
      {active360View==='overview'&&<ProspectOrbitBanner prospect={prospect} onEdit={openEditor}
        onOpenContacts={()=>openDetailedSection('atlas-prospect-contacts')}
        onCall={()=>prospect.phone?window.location.assign('tel:'+prospect.phone):prospect.email
          ?window.location.assign('mailto:'+prospect.email):openDetailedSection('atlas-prospect-contacts')}/>}
      <nav className="atlas-360-tabs" aria-label="Navigation de la fiche prospect 360°">
        <button className={active360View==='overview'?'selected':''} aria-current={active360View==='overview'?'page':undefined}
          onClick={()=>setActive360View('overview')}><LayoutGrid size={17}/> Vue 360°</button>
        {[
          {id:'atlas-prospect-contacts',label:'Contacts',icon:<Users size={17}/>},
          {id:'atlas-prospect-sources',label:'Données & sources',icon:<Database size={17}/>},
          {id:'atlas-prospect-activities',label:'Activités',icon:<Clock size={17}/>},
          {id:'atlas-prospect-monitoring',label:'Surveillance',icon:<BadgeCheck size={17}/>},
        ].map(tab=><button key={tab.id} onClick={()=>openDetailedSection(tab.id)}>{tab.icon} {tab.label}</button>)}
        <button className={active360View==='enrichments'?'selected':''} aria-current={active360View==='enrichments'?'page':undefined} onClick={()=>setActive360View('enrichments')}>{enriching?<Loader2 size={17} className="animate-spin"/>:<Database size={17}/>} Enrichissements</button>
        <button className={active360View==='relations'?'selected':''} aria-current={active360View==='relations'?'page':undefined}
          onClick={()=>setActive360View('relations')}><Network size={17}/> Cartographie</button>
      </nav>
      {active360View==='enrichments'&&<ProspectEnrichmentsTab initialNotice={sourceSavedNotice} prospectId={id} run={enrichmentRun} busy={saving||enriching||editing||returnProcessing} onEnrich={()=>void handleEnrich()} onOpenSources={()=>openDetailedSection('atlas-prospect-sources')} observations={sourceHistory} activities={activities} sourceDetails={prospect.sourceDetails} onReviewed={async()=>{await Promise.all([fetchProspect(),fetchActivities()]);const run=await apiClient.get<EnrichmentRun|null>('/prospects/'+id+'/enrichment');setEnrichmentRun(run);}}/>}
      {active360View==='relations' && <div className="atlas-relationship-view">
        <ProspectRelationshipMap siren={prospect.siren} siret={prospect.siret} company={prospect.company} website={prospect.website} sourceDetails={prospect.sourceDetails}/>
        {!collectedRelationships(prospect)?.source.includes('societe.com/')&&<ProspectPappersDossier siren={prospect.siren} siret={prospect.siret}/>}
      </div>}
      {active360View==='overview' && <>
        <Prospect360Dashboard prospect={prospect} officialManagers={officialManagers} activities={activities} deals={linkedDeals}
          onEdit={openEditor} onAddActivity={()=>setShowAddActivity(true)}
          onOpenDeal={()=>linkedDeals.length?navigate('/pipeline/'+linkedDeals[0].id):openConvertModal()}
          onOpenContacts={()=>openDetailedSection('atlas-prospect-contacts')}
          onOpenActivities={()=>openDetailedSection('atlas-prospect-activities')}
          onOpenSources={()=>openDetailedSection('atlas-prospect-sources')}
          onOpenMonitoring={()=>openDetailedSection('atlas-prospect-monitoring')}
          onEnrich={()=>void handleEnrich()}
          onOpenCrmMap={()=>navigate('/crm-map')}
          locationPreview={prospect.address&&hasLocationPoint
            ?<ProspectMiniMap lat={prospect.lat} lng={prospect.lng} height={155}
                label={[prospect.firstName,prospect.lastName].filter(Boolean).join(' ')||prospect.company||'Prospect'} address={prospect.address}/>
            :<div className="atlas-360-company-geocode"><span>Position GPS non renseignée</span>
              <button type="button" onClick={geocodeNow} disabled={geocoding}>
                {geocoding?<Loader2 size={13} className="animate-spin"/>:<MapPin size={13}/>}
                {geocoding?'Géocodage…':'Localiser l’adresse'}
              </button></div>}
          onStatusChange={status=>void updateOpportunityStatus(status)}/>
        <details ref={legacyDetailsRef} className="atlas-360-extended-record">
          <summary><FileText size={18}/> Informations détaillées, édition et historique <ChevronDown size={17}/></summary>
          {sourceHistory.length>0&&<details className="atlas-360-enrichment-history">
            <summary>Historique des enrichissements <span>{sourceHistory.length} capture(s)</span></summary>
            <div className="atlas-360-enrichment-history-list">
              {[...sourceHistory].reverse().map((entry,index)=><div key={`${entry.captureId}-${index}`}>
                <SourceLogo source={entry.source} size="sm"/><strong>{entry.source.replaceAll('_',' ')}</strong>
                <span>·</span>
                <time>{new Date(entry.capturedAt).toLocaleString('fr-FR')}</time>
                {Array.isArray(entry.fieldsFilled)&&entry.fieldsFilled.length>0&&<p>Données ajoutées : {entry.fieldsFilled.map(f=>conflictLabels[f]||f).join(', ')}</p>}
                {entry.sourceUrl&&<a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer">Consulter la fiche source ↗</a>}
              </div>)}
            </div>
          </details>}
          {editing&&<div className="atlas-360-edit-toolbar" role="status">
            <span><Edit2 size={16}/> Modifications en cours · validez pour enregistrer les changements.</span>
            <div><button type="button" onClick={()=>setEditing(false)}>Annuler</button>
              <button type="button" onClick={save} disabled={saving}>
                {saving?<Loader2 size={14} className="animate-spin"/>:<Save size={14}/>} Enregistrer</button></div>
          </div>}
          <div className="atlas-360-detail-layout">
        {/* Left — Info */}
        <div className="atlas-360-detail-main">
          <div id="atlas-prospect-monitoring" className="atlas-scroll-target atlas-360-detail-module atlas-360-detail-monitoring">
            <ProspectCompanyProfile onEnrich={()=>void handleEnrich()} key={id} prospect={prospect} compactManagers onOpenContacts={()=>openDetailedSection('atlas-prospect-contacts')} onManagerNames={setOfficialManagers}
              onUpdated={async()=>{await fetchProspect();await fetchActivities();}} />
          </div>
          {/* Informations légales structurées, accessibles sans enrichissement */}
          <section id="atlas-prospect-legal" className="atlas-scroll-target atlas-360-detail-module atlas-360-legal-extra rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <div className="flex flex-wrap gap-3 justify-between items-center mb-4">
              <h2 className="font-semibold text-base flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><SourceLogo source="annuaire" size="sm"/>Identifiants et activité officielle</h2>
              <div className="flex items-center gap-2 flex-wrap">
                {!editing&&<button type="button" className="atlas-360-detail-edit-link" onClick={()=>openEditor('atlas-prospect-legal')}><Edit2 size={13}/> Modifier</button>}
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
                    { key: 'company', label: 'Nom commercial / nom affiché', maxLength: 160 },
                    { key: 'siren', label: 'SIREN (9 chiffres)', maxLength: 9 },
                    { key: 'siret', label: 'SIRET de l’établissement (14 chiffres)', maxLength: 14 },
                    { key: 'apeCode', label: 'Code APE / NAF (ex. 43.22A)', maxLength: 6 },
                    { key: 'nafLabel', label: 'Secteur d’activité · libellé NAF', maxLength: 250 },
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
                    { key: 'company', label: 'Nom commercial / nom affiché', value: prospect.company },
                    { key: 'legalName', label: 'Raison sociale', value: businessNames.legalName },
                    { key: 'tradeNames', label: 'Enseignes publiées', value: businessNames.tradeNames.join(' · ') },
                    { key: 'siren', label: 'SIREN', value: prospect.siren },
                    { key: 'nafLabel', label: 'Libellé officiel NAF', value: prospect.nafLabel },
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

          {prospect.source && <div className="atlas-360-origin-line rounded-xl border px-4 py-3 flex flex-wrap items-center gap-2 text-xs" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--text-muted)' }}>
            <SourceLogo source={prospect.source} size="sm"/>
            <span className="font-semibold">Source :</span>
            <span>{prospect.source === 'pagesjaunes' ? 'PagesJaunes.fr' : prospect.source === 'annuaire-entreprises' ? 'Annuaire des entreprises' : prospect.source}</span>
            {pagesJaunesProfile && <a href={prospect.sourceUrl} target="_blank" rel="noreferrer" className="text-teal-700 underline">Voir la fiche source</a>}
            {pagesJaunesProfile && <button onClick={()=>openSourceEnrichment('pagesjaunes')} disabled={saving}
              className="ml-auto px-3 py-2 rounded-lg bg-teal-600 text-white font-semibold disabled:opacity-50 flex gap-1.5 items-center">
              <RefreshCw size={13}/>
              Rechercher sur PagesJaunes
            </button>}
          </div>}
          {pagesJaunesDetails && <section className="atlas-360-detail-module atlas-360-pj-details rounded-2xl border p-4 sm:p-5 space-y-4" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <SourceLogo source="pagesjaunes" size="md"/>
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
          <div id="atlas-prospect-contacts" className="atlas-scroll-target atlas-360-detail-module atlas-360-detail-contacts rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <div className="atlas-360-module-heading"><div><Users size={18}/><h2>Contacts et coordonnées</h2></div>
              {!editing&&<button type="button" onClick={()=>openEditor()}><Edit2 size={14}/> Modifier</button>}</div>
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
                <div className="atlas-360-contact-directory sm:col-span-2">
                  <div className="atlas-360-directory-title">
                    <h3>Personnes identifiées</h3><span>{prospectPeople.length} contact{prospectPeople.length>1?'s':''}</span>
                  </div>
                  {prospectPeople.length>0?<div className="atlas-360-directory-grid">
                    {prospectPeople.map(person=><article key={person.id} className="atlas-360-directory-person">
                      <div className="atlas-360-directory-avatar"><Users size={19}/></div>
                      <div className="atlas-360-directory-info">
                        <strong>{person.name}</strong>
                        <span>{person.role||(person.isManager?'Dirigeant · rôle à confirmer':'Contact CRM')}</span>
                        <small>{person.source==='societe_com'?'Relevé Societe.com':person.source==='pappers'?'Relevé Pappers':person.source==='annuaire'?'Annuaire officiel':person.source==='website'?'Profil public lié par le site':'Enregistré dans GrowthOS'}</small>
                        {(person.phone||person.email||person.profileUrl)&&<div className="atlas-360-directory-actions">
                          {(person.phones||[]).map(phone=><a key={phone} href={'tel:'+phone}><Phone size={13}/>{phone}</a>)}
                          {(person.emails||[]).map(email=><a key={email} href={'mailto:'+email}><Mail size={13}/>{email}</a>)}
                          {person.profileUrl&&<a href={person.profileUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={13}/> Fiche source</a>}
                        </div>}
                      </div>
                    </article>)}
                  </div>:<div className="atlas-360-directory-empty">
                    <Users size={22}/><div><strong>Aucun nom confirmé dans les sources</strong>
                      <p>Enrichissez les dirigeants ou renseignez le contact principal pour compléter le dossier.</p></div>
                  </div>}
                  <ProspectContactPoints prospect={prospect} onSaved={async()=>{await Promise.all([fetchProspect(),fetchActivities()]);}}/>
                  <div className="atlas-360-contact-channel-card">
                    <div><Phone size={17}/><h3>Coordonnées du prospect</h3><span>CRM · non attribuées automatiquement à un dirigeant</span></div>
                    <div className="atlas-360-contact-channels">
                      {prospect.phone&&<a href={'tel:'+prospect.phone}><Phone size={15}/>{prospect.phone}</a>}
                      {prospect.email&&<a href={'mailto:'+prospect.email}><Mail size={15}/>{prospect.email}</a>}
                      {prospect.linkedinUrl&&<a href={prospect.linkedinUrl} target="_blank" rel="noopener noreferrer"><Globe size={15}/>Profil LinkedIn</a>}
                      {!prospect.phone&&!prospect.email&&!prospect.linkedinUrl&&<span>Aucune coordonnée disponible pour le moment.</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {!editing && <div id="atlas-prospect-sources" className="atlas-scroll-target atlas-360-detail-module atlas-360-professional-sources"><ProspectProfessionalSources prospect={prospect} onEnrich={()=>void handleEnrich()}/></div>}

          {/* Données enrichies */}
          <EnrichedDataPanel prospectId={prospect.id} />

          {/* Activités */}
          <div id="atlas-prospect-activities" className="atlas-scroll-target atlas-360-detail-module atlas-360-detail-activities rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-sm" style={{ color: 'var(--text-muted)' }}>Journal des activités <span className="atlas-360-count-pill">{activities.length}</span></h2>
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
                  <div key={act.id} className="atlas-360-activity-item flex gap-3 p-3 rounded-xl" style={{ background: 'var(--body-bg)' }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs"
                      style={{ background: TYPE_COLORS[act.type] || '#6B7280' }}>
                      {TYPE_ICONS[act.type] || <FileText size={12} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{act.title}</div>
                      {act.dealId && act.dealTitle && <button className="text-xs text-teal-700 underline" onClick={() => navigate(`/pipeline/${act.dealId}`)}>Deal · {act.dealTitle}</button>}
                      {act.description && (act.type==='data_update'
                        ?<details className="atlas-360-activity-details">
                          <summary>Consulter les données mises à jour et leur provenance</summary>
                          <div className="whitespace-pre-wrap">{act.description}</div>
                        </details>
                        :<div className="text-xs mt-0.5 whitespace-pre-wrap" style={{ color: 'var(--text-muted)' }}>{act.description}</div>)}
                      <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        {new Date(act.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    {act.type === 'note' && <EditNote note={act} onSaved={fetchActivities} />}
                    {act.type!=='data_update' && <button onClick={() => deleteActivity(act.id)} className="text-red-400 hover:text-red-600 flex-shrink-0">
                      <Trash2 size={13} />
                    </button>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="atlas-360-detail-module atlas-360-collaboration rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <CommentsPanel entityType="prospect" entityId={prospect.id} />
          </div>
        </div>

        {/* Traçabilité et outils spécifiques, sans seconde complétude ni actions doublonnées. */}
        <aside className="atlas-360-detail-side">
          <section className="atlas-360-detail-aside-card">
            <header><Clock size={18}/><h2>Traçabilité du dossier</h2></header>
            <dl className="atlas-360-audit-fields">
              <div><dt>Fiche créée le</dt><dd>{prospect.createdAt?new Date(prospect.createdAt).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}):'Non renseigné'}</dd></div>
              <div><dt>Dernière mise à jour</dt><dd>{prospect.updatedAt?new Date(prospect.updatedAt).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}):'Non renseignée'}</dd></div>
              <div><dt>Activités consignées</dt><dd>{activities.length} événement{activities.length>1?'s':''}</dd></div>
              {lastEnrichedAt&&<div><dt>Dernier enrichissement</dt><dd>{lastEnrichedAt.toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})}</dd></div>}
            </dl>
            <p>Les changements de valeurs sont conservés dans le journal des activités.</p>
          </section>
          <section className="atlas-360-detail-aside-card atlas-360-enrichment-tool">
            <header><Database size={18}/><h2>Enrichissement du dossier</h2></header>
            <p>Mettre à jour les données disponibles, avec contrôle des sources et conservation de l'historique.</p>
            {isRecentlyEnriched&&<div className="atlas-360-enrichment-recent"><BadgeCheck size={16}/>
              Enrichissement récent · {lastEnrichedAt?'il y a '+Math.max(0,Math.floor((Date.now()-lastEnrichedAt.getTime())/86400000))+'j':''}</div>}
              <button type="button" className="atlas-360-enrich-direct" onClick={handleEnrich} disabled={enriching}>
                {enriching?<Loader2 size={16} className="animate-spin"/>:<Zap size={16}/>}
                {enriching?'Enrichissement en cours…':'Enrichir automatiquement'}
              </button>
            <button type="button" className="atlas-360-enrich-sources" onClick={()=>openSourceEnrichment()}>
              Consulter une source manuellement <ExternalLink size={13}/>
            </button>
          </section>
        </aside>
      </div>
        </details>
      </>}
    </div>
  );
}
