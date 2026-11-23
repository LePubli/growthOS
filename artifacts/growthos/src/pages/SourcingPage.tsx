import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import {
  Search, Plus, Play, Pause, CheckCircle, Clock, AlertCircle, Loader2,
  Globe, Users, ChevronRight, X, RotateCcw, Trash2, Eye, Zap, Filter, Laptop, Smartphone, Link2,
} from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';
import GeoMultiSelect from '@/components/sourcing/GeoMultiSelect';
import { FRENCH_DEPARTMENTS, FRENCH_REGIONS } from '@/lib/france-geo';
import { pingLocalPagesJaunes, searchLocalPagesJaunes, localPagesJaunesLocations, isMobileConnectorRequired } from '@/lib/pagesjaunes-device';

const SCRAPER_TYPES: Record<string, { name: string; icon: string; desc: string; color: string; fields: { key:string; label:string; placeholder:string; type?:string }[] }> = {
  entreprises: {
    name: 'Annuaire des entreprises', icon: '🇫🇷', desc: 'Entreprises françaises — données officielles publiques', color: '#2563EB',
    fields: [
      { key: 'query', label: 'Activité ou nom d’entreprise (sans ville)', placeholder: 'Ex : plombier, boulangerie' },
      { key: 'limit', label: 'Nombre de résultats (1 à 25)', placeholder: '10', type: 'number' },
    ],
  },
  linkedin: {
    name:'LinkedIn Sales Navigator', icon:'💼', desc:'Décideurs B2B — titre, entreprise, localisation', color:'#0A66C2',
    fields:[
      { key:'keywords', label:'Mots-clés / titre', placeholder:'Ex: Directeur Commercial, VP Sales, CEO' },
      { key:'location', label:'Localisation', placeholder:'Ex: Paris, Lyon, Île-de-France' },
      { key:'company_size', label:'Taille entreprise', placeholder:'Ex: 50-200, 200+, 1000+' },
      { key:'industry', label:'Secteur', placeholder:'Ex: SaaS, Fintech, Retail' },
      { key:'limit', label:'Nombre max. de profils', placeholder:'100', type:'number' },
    ],
  },
  google: {
    name:'Google Maps', icon:'🗺️', desc:'Établissements locaux, contacts et avis', color:'#EA4335',
    fields:[
      { key:'query', label:'Recherche', placeholder:'Ex: Agences immobilières Bordeaux' },
      { key:'location', label:'Ville / Zone', placeholder:'Ex: Bordeaux, 33000' },
      { key:'category', label:'Catégorie', placeholder:'Ex: restaurant, agence, artisan' },
      { key:'limit', label:'Nombre max.', placeholder:'50', type:'number' },
    ],
  },
  societe_info: {
    name:'Societe.info', icon:'🏢', desc:'Données légales entreprises françaises', color:'#1E3A5F',
    fields:[
      { key:'activity', label:'Activité / NAF', placeholder:'Ex: 6201Z, Logiciels, Conseil' },
      { key:'location', label:'Département / Région', placeholder:'Ex: 75, Île-de-France' },
      { key:'size', label:'Taille (effectif)', placeholder:'Ex: 10-49, 50-249' },
      { key:'keywords', label:'Mots-clés nom', placeholder:'Ex: Tech, Digital, Conseil' },
      { key:'limit', label:'Nombre max.', placeholder:'100', type:'number' },
    ],
  },
  pagesjaunes: {
    name: 'PagesJaunes.fr', icon: '📒',
    desc: 'Professionnels locaux — navigateur de votre appareil ou du VPS', color: '#EAB308',
    fields: [
      { key: 'query', label: 'Activité / métier', placeholder: 'Ex : artisans, restaurants' },
      { key: 'location', label: 'Ville ou département', placeholder: 'Ex : Lille, 59' },
      { key: 'limit', label: 'Nombre de résultats', placeholder: '10', type: 'number' },
    ],
  },
  twitter: {
    name:'Twitter / X', icon:'🐦', desc:'Signaux sociaux, mentions et profils', color:'#1D9BF0',
    fields:[
      { key:'keywords', label:'Mots-clés / hashtags', placeholder:'Ex: #SaaS #startup levée fonds' },
      { key:'location', label:'Localisation', placeholder:'Ex: France' },
      { key:'min_followers', label:'Followers minimum', placeholder:'1000', type:'number' },
      { key:'limit', label:'Nombre max.', placeholder:'50', type:'number' },
    ],
  },
  custom: {
    name:'Custom Scraper', icon:'⚙️', desc:'Script personnalisé via URL ou API', color:'#6B7280',
    fields:[
      { key:'url', label:'URL cible', placeholder:'https://exemple.com/annuaire' },
      { key:'selector', label:'Sélecteur CSS (optionnel)', placeholder:'.contact-card, .listing-item' },
      { key:'script', label:'Script JS (optionnel)', placeholder:'// return { name, email, company }' },
      { key:'limit', label:'Nombre max.', placeholder:'50', type:'number' },
    ],
  },
};
const SUPPORTED_TYPES = new Set(['entreprises', 'pagesjaunes']);

const STATUS_CONFIG: Record<string,{label:string;color:string;bg:string;dot:string}> = {
  completed:{ label:'Terminé',  color:'#065F46', bg:'#ECFDF5', dot:'#10B981' },
  running:  { label:'En cours', color:'#1E40AF', bg:'#EFF6FF', dot:'#3B82F6' },
  paused:   { label:'Pause',    color:'#92400E', bg:'#FFFBEB', dot:'#F59E0B' },
  error:    { label:'Erreur',   color:'#991B1B', bg:'#FEF2F2', dot:'#EF4444' },
  queued:   { label:'En attente',color:'#374151',bg:'#F3F4F6', dot:'#9CA3AF' },
};

function LaunchModal({ onClose, onLaunch, initialSource, browserStatus, deviceConnected }: { onClose:()=>void; onLaunch:(job:any)=>void; initialSource:string; browserStatus: 'direct' | 'ready' | 'offline'; deviceConnected:boolean }) {
  const [step, setStep] = useState<1|2>(1);
  const [sources, setSources] = useState<string[]>([initialSource]);
  const [name, setName] = useState('');
  const [params, setParams] = useState<Record<string,string>>({});
  const [launching, setLaunching] = useState(false);
  const [launchStage, setLaunchStage] = useState<'collect'|'save'|'api'|null>(null);
  const [regions, setRegions] = useState<string[]>([]);
  const [departements, setDepartements] = useState<string[]>([]);
  const [codesPostauxInput, setCodesPostauxInput] = useState('');
  const parsedCodes = codesPostauxInput.split(/[\s,;]+/).map(code => code.trim()).filter(Boolean);
  const codesPostaux = [...new Set(parsedCodes)];
  const zonesValid = (regions.length + departements.length + codesPostaux.length) > 0
    && codesPostaux.length <= 25 && codesPostaux.every(code => /^\d{5}$/.test(code));

  const setParam = (k:string, v:string) => setParams(p=>({...p,[k]:v}));
  const searchReady = Boolean((params.query?.trim().length ?? 0) >= 3 && zonesValid && sources.length);

  const launch = async () => {
    if (!sources.length || sources.some(source => !SUPPORTED_TYPES.has(source))) { toast.error('Sélectionnez au moins une source disponible'); return; }
    if (!searchReady) {
      toast.error('Saisissez une activité et une ou plusieurs régions, départements ou codes postaux valides.');
      return;
    }
    setLaunching(true);
    let currentStage: 'collect'|'save'|'api' = sources.includes('pagesjaunes') && deviceConnected ? 'collect' : 'api';
    setLaunchStage(currentStage);
    try {
      const jobName = name.trim() || `${params.query.trim()} · ${sources.length} source(s)`;
      const criteria = {sources, query:params.query.trim(), limit:params.limit || '10',regions,departements,codesPostaux};
      let job: any;
      if (sources.includes('pagesjaunes') && deviceConnected) {
        const departmentNames = Object.fromEntries(FRENCH_DEPARTMENTS.map(item=>[item.code,item.label]));
        const regionNames = Object.fromEntries(FRENCH_REGIONS.map(item=>[item.code,item.label]));
        const locations = localPagesJaunesLocations({regions,departements,codesPostaux,departmentNames,regionNames});
        if (locations.length > 8) {
          toast.error('Le connecteur local accepte 8 zones par recherche. Réduisez la sélection ou lancez plusieurs recherches.');
          return;
        }
        toast.info('Recherche PagesJaunes dans votre navigateur. Gardez GrowthOS ouvert pendant l’opération.');
        const local = await searchLocalPagesJaunes({query:criteria.query,locations,limit:Number(criteria.limit)});
        if (local.warnings.length) toast.warning(local.warnings.slice(0,2).join(' · '));
        if (!local.results.length && local.warnings.length) throw new Error(local.warnings[0]);
        currentStage = 'save';
        setLaunchStage(currentStage);
        job = await apiClient.post('/sourcing/device/jobs',
          {name:jobName,params:criteria,candidates:local.results}, {timeoutMs: 90000});
        toast.success('Recherche locale terminée. Choisissez les entreprises à importer.');
      } else {
        job = await apiClient.post('/sourcing/jobs', {type:'multi',name:jobName,params:criteria});
        toast.success('Recherche lancée. Les sources seront analysées indépendamment.');
      }
      onLaunch(job);
      onClose();
    } catch (error: any) {
      const phase = currentStage === 'collect' ? 'Navigation PagesJaunes sur cet appareil'
        : currentStage === 'save' ? 'Enregistrement des résultats dans GrowthOS'
        : 'Recherche sur le serveur';
      toast.error(`${phase} : ${error.message ?? 'Échec inattendu'}`, {duration: 10000});
    } finally { setLaunching(false); setLaunchStage(null); }
  };

  const toggleSource = (id: string) => setSources(previous => previous.includes(id)
    ? previous.filter(source => source !== id) : [...previous, id]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center text-green-600"><Search size={16}/></div>
            <h2 className="text-base font-bold text-gray-900">Recherche d'entreprises</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${step>=1?'bg-teal-600 text-white':'bg-gray-100 text-gray-400'}`}>1</span>
              <div className={`w-10 h-0.5 ${step>=2?'bg-teal-600':'bg-gray-200'}`}/>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${step>=2?'bg-teal-600 text-white':'bg-gray-100 text-gray-400'}`}>2</span>
            </div>
            <button onClick={onClose}><X size={18} className="text-gray-400"/></button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto">
          {step === 1 ? (
            <>
              <h3 className="font-semibold text-gray-800 mb-2">Choisissez une ou plusieurs sources</h3>
              <p className="text-xs text-gray-500 mb-4">Les résultats seront regroupés dans une seule recherche. Une source indisponible ne bloquera pas les autres.</p>
              <div className="grid grid-cols-2 gap-3 mb-5">
                {Object.entries(SCRAPER_TYPES).map(([id,t])=>(
                  <button key={id} onClick={()=>toggleSource(id)} disabled={!SUPPORTED_TYPES.has(id)} aria-pressed={sources.includes(id)}
                    className={`text-left p-3.5 rounded-xl border-2 transition-all ${sources.includes(id)?'border-teal-500 bg-teal-50':'border-gray-200 hover:border-gray-300'} ${SUPPORTED_TYPES.has(id) ? '' : 'opacity-40 cursor-not-allowed'}`}>
                    <div className="text-2xl mb-2">{t.icon}</div>
                    <div className="font-semibold text-sm text-gray-900 mb-0.5">{t.name}</div>
                    <div className="text-xs text-gray-400">{t.desc}</div>
                    {!SUPPORTED_TYPES.has(id) && <div className="text-xs text-amber-700 mt-1">{id === 'pagesjaunes' ? 'Accord/API partenaire Solocal nécessaire' : 'Intégration non disponible'}</div>}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mb-4">{browserStatus === 'ready' ? '🟢 Navigateur Chromium privé connecté.' : browserStatus === 'offline' ? '🔴 Navigateur privé configuré mais inaccessible : vérifier son conteneur dans DockerPanel.' : '🟡 Navigation directe uniquement : activez le conteneur Chromium dans DockerPanel.'} Aucun abonnement externe n’est requis.</p>
              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Annuler</button>
                <button onClick={()=>setStep(2)} disabled={!sources.length} className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">Suivant →</button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">🔎</span>
                <h3 className="font-semibold text-gray-800">Critères communs · {sources.map(id => SCRAPER_TYPES[id]?.name).join(' + ')}</h3>
              </div>
              <div className="space-y-3 mb-5">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Nom de la recherche (facultatif)</label>
                  <input value={name} onChange={e=>setName(e.target.value)} autoFocus
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Ex : Plombiers Lille centre"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Métier ou activité *</label>
                  <input value={params.query || ''} onChange={e => setParam('query', e.target.value)} placeholder="Ex : plombier, électricien, boulangerie" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Résultats maximum par source (1 à 25)</label>
                  <input type="number" min={1} max={25} value={params.limit || '10'} onChange={e => setParam('limit', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
                </div>
                {sources.includes('pagesjaunes') && <p className="text-xs rounded-lg bg-amber-50 text-amber-800 p-3">{deviceConnected ? '✓ Connecteur de cet appareil actif. PagesJaunes sera consulté depuis votre navigateur actuel. Gardez cet onglet ouvert jusqu’à la fin.' : '⚠ Connecteur non activé. La recherche passera par le navigateur du VPS, qui peut être bloqué par PagesJaunes (HTTP 403). Utilisez « Connecter cet appareil » sur la page précédente.'}</p>}
                {<div className="rounded-xl border border-teal-100 bg-teal-50/40 p-3 space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800">Zone de prospection *</h4>
                    <p className="text-xs text-gray-500 mt-1">Choisissez une ou plusieurs régions, départements et/ou codes postaux. Entre les types de zone, les filtres se cumulent.</p>
                  </div>
                  <GeoMultiSelect label="Régions" options={FRENCH_REGIONS} values={regions} onChange={setRegions} placeholder="Choisir des régions…" />
                  <GeoMultiSelect label="Départements" options={FRENCH_DEPARTMENTS} values={departements} onChange={setDepartements} placeholder="Choisir des départements…" />
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Codes postaux (plusieurs possibles)</label>
                    <textarea rows={2} value={codesPostauxInput} onChange={e => setCodesPostauxInput(e.target.value)}
                      placeholder="59000, 59100, 59800" className="w-full rounded-xl border border-gray-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
                    <p className={`text-xs mt-1 ${codesPostaux.length && !codesPostaux.every(code => /^\d{5}$/.test(code)) ? 'text-red-600' : 'text-gray-500'}`}>
                      Séparez par une virgule, un espace ou un retour à la ligne · 25 codes maximum
                    </p>
                  </div>
                </div>}
              </div>
              <div className="flex gap-3">
                <button onClick={()=>setStep(1)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">← Retour</button>
                <button onClick={launch} disabled={launching || !searchReady}
                  className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                  {launching?<Loader2 size={14} className="animate-spin"/>:<Zap size={14}/>}
                  {launching ? launchStage === 'collect' ? 'Collecte locale…'
                    : launchStage === 'save' ? 'Enregistrement…' : 'Recherche en cours…'
                    : 'Rechercher les entreprises'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SourcingPage() {
  const [, navigate] = useLocation();
  const [jobs, setJobs] = useState<any[]>([]);
  const [jobListError,setJobListError] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [browserStatus, setBrowserStatus] = useState<'direct' | 'ready' | 'offline'>('direct');
  const [initialSource, setInitialSource] = useState('entreprises');
  const [deviceConnected,setDeviceConnected] = useState(false);
  const [deviceConnecting,setDeviceConnecting] = useState(false);
  const mobileConnector = isMobileConnectorRequired();
  const connectDevice = async () => {
    if (mobileConnector) {
      toast.info('Sur Android, une application compagnon est nécessaire. Le connecteur Chrome est pour ordinateur.');
      return;
    }
    setDeviceConnecting(true);
    try {
      await pingLocalPagesJaunes();
      setDeviceConnected(true);
      toast.success('Extension Chrome connectée sur cet ordinateur !');
    } catch(error:any) {
      setDeviceConnected(false);
      toast.error(error.message || 'Extension non détectée');
    } finally {setDeviceConnecting(false);}
  };
  const openSearch = (source = 'entreprises') => { setInitialSource(source); setShowNew(true); };
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  useEffect(() => {
    void apiClient.get<{ pagesjaunes?: { mode: string; browserReady: boolean } }>('/sourcing/sources/status')
      .then(data => setBrowserStatus(data.pagesjaunes?.mode === 'browser'
        ? (data.pagesjaunes.browserReady ? 'ready' : 'offline') : 'direct'))
      .catch(() => setBrowserStatus('direct'));
  }, []);
  useEffect(()=>{
    let mounted = true;
    const reload = () => apiClient.get('/sourcing/jobs').then((d:any)=>{
      if (mounted) {setJobs(Array.isArray(d) ? d : d?.data ?? []); setJobListError(false);}
    }).catch(()=>{ if (mounted) setJobListError(true); });
    reload();
    const timer = setInterval(reload, 15000);
    return ()=>{ mounted = false; clearInterval(timer); };
  },[]);

  const retryJob = async (id:string, e:React.MouseEvent) => {
    e.stopPropagation();
    const old = jobs.find(j=>j.id===id);
    if (!old || !(SUPPORTED_TYPES.has(old.type) || old.type === 'multi')) { toast.error('Source non disponible'); return; }
    try {
      const newJob = await apiClient.post('/sourcing/jobs', { type: old.type, name: old.name, params: old.params });
      setJobs(js=>[newJob,...js]);
      toast.success('Nouvelle recherche effectuée');
    } catch (error: any) { toast.error(error.message ?? 'Échec de la recherche'); }
  };

  const deleteJob = async (id:string, e:React.MouseEvent) => {
    e.stopPropagation();
    if(!confirm('Supprimer ce job ?')) return;
    try {
      await apiClient.delete(`/sourcing/jobs/${id}`);
      setJobs(js=>js.filter(j=>j.id!==id));
      toast.success('Recherche supprimée (les prospects importés restent dans le CRM)');
    } catch (error: any) { toast.error(error.message ?? 'Suppression impossible'); }
  };

  const filtered = jobs.filter(j=>{
    const q = search.toLowerCase();
    const names = (j.params?.sources || [j.type]).map((source:string) => SCRAPER_TYPES[source]?.name || source).join(' ');
    const matchSearch = !q || `${j.name} ${names}`.toLowerCase().includes(q);
    const matchStatus = statusFilter==='all' || j.status===statusFilter;
    return matchSearch && matchStatus;
  });

  const totalCollected = jobs.filter(j=>j.status==='completed').reduce((s,j)=>s+Number(j.count || 0),0);
  const running = jobs.filter(j=>j.status==='running').length;
  const completed = jobs.filter(j=>j.status==='completed').length;

  return (
    <div className="min-h-screen p-6" style={{background:'var(--body-bg)'}}>
      {showNew && <LaunchModal initialSource={initialSource} browserStatus={browserStatus} deviceConnected={deviceConnected} onClose={()=>setShowNew(false)} onLaunch={j=>{setJobs(js=>[j,...js]);navigate(`/sourcing/${j.id}`);}}/>}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>Scraping & Sourcing</h1>
          <p className="text-sm" style={{color:'var(--text-muted)'}}>
            {running>0?<span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse inline-block"/>{running} job{running>1?'s':''} en cours</span>:`${totalCollected} entreprises trouvées au total`}
          </p>
        </div>
        <button onClick={()=>openSearch()} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{background:'var(--color-primary)'}}>
          <Plus size={14}/>Nouvelle recherche
        </button>
      </div>

      {jobListError && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-xs px-3 py-2 mb-4">
        La liste des recherches n’a pas répondu au serveur. Les recherches depuis cet appareil restent accessibles : réessayez l’actualisation plus tard.
      </div>}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          {l:'Entreprises trouvées', v:totalCollected, icon:<Users size={16}/>, color:'text-blue-600 bg-blue-50'},
          {l:'Jobs terminés',       v:completed,       icon:<CheckCircle size={16}/>, color:'text-green-600 bg-green-50'},
          {l:'En cours',           v:running,         icon:<Loader2 size={16}/>, color:'text-purple-600 bg-purple-50'},
          {l:'Sources dispo.',     v:SUPPORTED_TYPES.size, icon:<Globe size={16}/>, color:'text-teal-600 bg-teal-50'},
        ].map((m,i)=>(
          <div key={i} className="rounded-2xl border p-4 flex items-center gap-3" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${m.color}`}>{m.icon}</div>
            <div>
              <div className="text-xl font-bold" style={{color:'var(--text-primary)'}}>{m.v}</div>
              <div className="text-xs" style={{color:'var(--text-muted)'}}>{m.l}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Sources rapides */}
      <div className="rounded-2xl border p-4 mb-5" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
        <div className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{color:'var(--text-muted)'}}>Sources disponibles — cliquez pour lancer</div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(SCRAPER_TYPES).map(([id,t])=>(
            <button key={id} onClick={()=>openSearch(id)} disabled={!SUPPORTED_TYPES.has(id)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all hover:shadow-sm"
              style={{background:'var(--body-bg)',borderColor:'var(--card-border)',color:'var(--text-secondary)',opacity:SUPPORTED_TYPES.has(id)?1:.4,cursor:SUPPORTED_TYPES.has(id)?'pointer':'not-allowed'}} title={SUPPORTED_TYPES.has(id) ? t.name : 'Connecteur non disponible'}>
              <span>{t.icon}</span>{t.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Connecteur appareil : jamais de permission ou de token partagé avec le navigateur tiers. */}
      <div className="rounded-2xl border p-4 mb-5 flex flex-wrap items-center gap-3" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
        <div className="flex-1 min-w-[220px]">
          <div className="flex items-center gap-2 text-sm font-semibold" style={{color:'var(--text-primary)'}}>
            {mobileConnector ? <Smartphone size={17}/> : <Laptop size={17}/>} Connecteur PagesJaunes sur cet appareil
            {deviceConnected && <span className="rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-xs">Connecté</span>}
          </div>
          <p className="text-xs mt-1" style={{color:'var(--text-muted)'}}>
            {mobileConnector ? 'Android : application compagnon à installer (pas encore disponible). La version Chrome ordinateur est prête à tester.'
              : deviceConnected ? 'La prochaine recherche PagesJaunes utilisera ce Chrome. Les entreprises restent à sélectionner avant import.'
              : 'Installez une fois l’extension Chrome, actualisez GrowthOS, puis cliquez sur « Connecter cet appareil ». Le VPS reste inchangé.'}
          </p>
        </div>
        <a href="https://github.com/LePubli/growthOS/blob/fix/growthos-functional-redesign/docs/CONNECTEUR_APPAREIL.md" target="_blank" rel="noreferrer"
          className="flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline"><Link2 size={14}/> Installation</a>
        <button onClick={connectDevice} disabled={deviceConnecting || mobileConnector}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
          style={{background:'var(--color-primary)'}}>
          {deviceConnecting ? 'Connexion…' : deviceConnected ? 'Vérifier la connexion' : 'Connecter cet appareil'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{color:'var(--text-muted)'}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un job..."
            className="w-full pl-8 pr-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            style={{background:'var(--card-bg)',border:'1px solid var(--card-border)',color:'var(--text-primary)'}}/>
        </div>
        <div className="flex gap-1 p-1 rounded-xl" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)'}}>
          {[{v:'all',l:'Tous'},{v:'running',l:'En cours'},{v:'completed',l:'Terminés'},{v:'paused',l:'Pause'},{v:'error',l:'Erreurs'}].map(f=>(
            <button key={f.v} onClick={()=>setStatusFilter(f.v)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={statusFilter===f.v?{background:'var(--color-primary)',color:'#fff'}:{color:'var(--text-muted)',background:'transparent',border:'none',cursor:'pointer'}}>
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {/* Jobs list */}
      {filtered.length===0 ? (
        <div className="rounded-2xl border py-16 text-center" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
          <Search size={40} className="mx-auto mb-3" style={{color:'var(--card-border)'}}/>
          <p className="text-sm mb-4" style={{color:'var(--text-muted)'}}>Aucun job trouvé</p>
          <button onClick={()=>openSearch()} className="px-4 py-2 rounded-xl text-sm text-white" style={{background:'var(--color-primary)'}}>
            + Lancer une recherche
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(job=>{
            const sc = job.type === 'multi' && job.status === 'completed' && job.error
              ? { label: 'Partiellement terminé', color: '#92400E', bg: '#FFFBEB', dot: '#F59E0B' }
              : STATUS_CONFIG[job.status] || STATUS_CONFIG.paused;
            const src = job.type === 'multi'
              ? { icon: '🔎', name: (job.params?.sources || []).map((id: string) => SCRAPER_TYPES[id]?.name || id).join(' + ') || 'Recherche multisource' }
              : SCRAPER_TYPES[job.type] || SCRAPER_TYPES.custom;
            const isRunning = job.status==='running';
            return (
              <div key={job.id}
                className="rounded-2xl border cursor-pointer transition-all hover:shadow-md"
                style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}
                onMouseEnter={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--color-primary)'}
                onMouseLeave={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--card-border)'}>

                <div className="flex items-center gap-4 p-4" onClick={()=>navigate(`/sourcing/${job.id}`)}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{background:'var(--body-bg)'}}>{src.icon}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-semibold text-sm" style={{color:'var(--text-primary)'}}>{job.name}</span>
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full" style={{background:sc.dot, animation:isRunning?'pulse 1.5s infinite':undefined}}/>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{background:sc.bg,color:sc.color}}>{sc.label}</span>
                      </div>
                    </div>
                    <div className="text-xs mb-1" style={{color:'var(--text-muted)'}}>{src.name} · {job.createdAt ? new Date(job.createdAt).toLocaleString('fr-FR') : 'Date inconnue'}</div>
                    {job.error && <div className="text-xs text-red-500 mb-1">⚠ {job.error}</div>}
                    {/* Progress bar for running jobs */}
                    {isRunning && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full transition-all" style={{width:`${job.progress||0}%`,background:'var(--color-primary)'}}/>
                        </div>
                        <span className="text-xs" style={{color:'var(--text-muted)'}}>{job.progress||0}%</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    {job.count>0&&(
                      <div className="text-right">
                        <div className="text-sm font-bold" style={{color:'var(--color-primary)'}}>{job.count}</div>
                        <div className="text-xs" style={{color:'var(--text-muted)'}}>résultats</div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-1" onClick={e=>e.stopPropagation()}>
                      {job.count>0 && (
                        <button onClick={()=>navigate(`/sourcing/${job.id}`)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" title="Voir résultats">
                          <Eye size={14} style={{color:'var(--text-muted)'}}/>
                        </button>
                      )}
                      {(job.status==='error'||job.status==='paused') && (SUPPORTED_TYPES.has(job.type)||job.type==='multi') && (
                        <button onClick={e=>retryJob(job.id,e)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors" title="Relancer">
                          <RotateCcw size={14} style={{color:'#2563EB'}}/>
                        </button>
                      )}
                      <button onClick={e=>deleteJob(job.id,e)}
                        className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Supprimer">
                        <Trash2 size={14} className="text-red-400"/>
                      </button>
                    </div>
                    <ChevronRight size={15} style={{color:'var(--text-muted)'}}/>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
