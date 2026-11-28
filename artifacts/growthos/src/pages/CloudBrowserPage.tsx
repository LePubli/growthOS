import {beginConnectorTask,isMobileConnectorRequired} from '@/lib/pagesjaunes-device';
import {prospectReviewReturnUrl} from '@/lib/prospect-enrichment';
import {CloudCaptureReview} from '@/components/cloud-browser/CloudCaptureReview';
import LegacySourcingArchive from '@/components/cloud-browser/LegacySourcingArchive';
import GeoMultiSelect from '@/components/sourcing/GeoMultiSelect';
import {FRENCH_REGIONS,FRENCH_DEPARTMENTS} from '@/lib/france-geo';
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { Link, useSearch,useLocation } from 'wouter';
import {
  AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown,
  Clock3, ExternalLink, EyeOff, Globe2, History, Layers, LogOut,
  MapPin, Maximize2, Minimize2, Phone, Play, Plus, Search, ShieldCheck,
} from 'lucide-react';
import api from '@/lib/api-client';
import CloudImportFeedback,{CaptureImportBadge,pendingCloudCaptures,isCloudCaptureHandled,type CaptureImportState} from '@/components/cloud-browser/CloudImportFeedback';
import CloudJobHistory,{CaptureBatchControls,selectCaptureBatch} from '@/components/cloud-browser/CloudJobHistory';
import { SourceLogo } from '@/components/atlas/ProspectLogos';
import modules from '../../../../extensions/growthos-pagesjaunes/modules.json';
import '@/cloud-browser.css';

type Profile = { id: string; source: string; label: string; mode: 'public' | 'account' };
type Capture = { id: string; company?: string; address?: string; city?: string; phone?: string };
type Job = {
  id: string; profile_id: string; prospect_id: string | null;
  mode: 'enrich' | 'discover'; query: string; area?: string; status: string; error: string | null;
  result: {
    references?:{url:string;label:string}[]; message?: string; hasMore?:boolean; progress?:{captured:number;discovered:number}; captures?: Capture[]; drafts?: unknown[]; imports?: Record<string,CaptureImportState>;
    applied?: { filled: string[]; conflicts: number };
  };
};
type View = { url: string; title: string; image: string; busy: boolean; width: number; height: number };

const labels: Record<string, string> = {
  queued: 'En file', running: 'Collecte en cours', awaiting_user: 'Intervention requise',
  needs_review: 'À vérifier', completed: 'Terminée', failed: 'Échec', cancelled: 'Annulée',
};
const sourceName = (source: string) => modules.find(module => module.source === source)?.name || source;
const activeStatuses = ['queued', 'running', 'awaiting_user', 'needs_review', 'failed'];
const canResume = ['awaiting_user', 'needs_review', 'failed', 'cancelled'];

export default function CloudBrowserPage(){return <CloudBrowserWorkspace key={useSearch()}/>;}
function CloudBrowserWorkspace() {
  const [,navigate]=useLocation();
  const params = new URLSearchParams(useSearch()), prospectId = params.get('prospectId');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selected, setSelected] = useState(params.get('profileId')||'');
  const [status, setStatus] = useState<{ ready: boolean; configured: boolean; automatic: string[] } | null>(null);
  const [source, setSource] = useState(params.get('source') || (prospectId ? 'societe_com' : 'google_maps'));
  const native=source==='entreprises';
  const [regions,setRegions]=useState<string[]>([]),[departements,setDepartements]=useState<string[]>([]),[postalInput,setPostalInput]=useState('');
  const [profileLabel, setProfileLabel] = useState('');
  const [mode, setMode] = useState<'public' | 'account'>('public');
  const [prospect, setProspect] = useState<any>(null);
  const [query, setQuery] = useState(params.get('query') || '');
  const [area, setArea] = useState(params.get('area') || '');
  const [view, setView] = useState<View | null>(null);
  const [viewing, setViewing] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(()=>{let alive=true;const merged=params.get('merged');if(merged&&prospectId)void api.get<any[]>('/prospects/'+prospectId+'/merges').then(rows=>{if(alive&&Array.isArray(rows)&&rows.some(row=>row.id===merged))setNotice('Fusion enregistrée. Les deux dossiers sont regroupés ; vous pouvez terminer la comparaison avec la source.');}).catch(()=>{});return()=>{alive=false;};},[prospectId,params.get('merged')]);
  const [reviewJob,setReviewJob]=useState<string|null>(null);
  const [activeJobId, setActiveJobId] = useState('');
  const [verificationJobId,setVerificationJobId]=useState(params.get('jobId')||'');
  const latestVerification=useRef(verificationJobId);latestVerification.current=verificationJobId;
  const initialContextLoaded=useRef(false),openedSource=useRef(''),openedComparison=useRef(''),returned=useRef(false);
  const [expandedBrowser, setExpandedBrowser] = useState(false);
  const [sourceZoom,setSourceZoom]=useState(()=>typeof window!=='undefined'&&window.matchMedia('(max-width:720px)').matches?1:0);
  const [resultsShare, setResultsShare] = useState(28);
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  const workspaceRef = useRef<HTMLDivElement>(null);
  const resizing = useRef(false);
  const control = useRef('');
  const inputQueue = useRef(Promise.resolve());
  const viewProfile = useRef('');
  const latestSelected = useRef(selected);
  latestSelected.current = selected;

  const jobsRequest = useRef(0);
  async function readJobs() {
    const version = ++jobsRequest.current;
    const result = await api.get<Job[]>('/browser/jobs');
    const requested=latestVerification.current;
    if(requested&&!result.some(job=>job.id===requested)){
      const job=await api.get<Job>('/browser/jobs/'+requested).catch(()=>null);
      if(job)result.unshift(job);
    }
    if (version === jobsRequest.current) setJobs(result);
  }
  async function refresh() {
    const [p, s] = await Promise.all([
      api.get<Profile[]>('/browser/profiles'),
      api.get<{ ready: boolean; configured: boolean; automatic: string[] }>('/browser/status'), readJobs(),
    ]);
    setProfiles(p); setStatus(s);
  }

  useEffect(() => {
    void refresh().catch(e => setError(e.message));
    const timer = window.setInterval(() => {
      void readJobs().catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!selected) {
      const match = profiles.find(profile => profile.source === source);
      if (match) setSelected(match.id);
    }
  }, [profiles, source, selected]);
  useEffect(() => {
    if (prospectId) void api.get<any>('/prospects/' + prospectId).then(p => {
      if(p.mergedFromId&&p.id!==prospectId){const next=new URLSearchParams(params);next.set('prospectId',p.id);navigate('/navigateur?'+next.toString(),{replace:true});return;}
      setProspect(p);
      if(!latestVerification.current)setQuery(['societe_com','pappers','bodacc'].includes(params.get('source') || 'societe_com')
        ? (p.siret || p.siren || p.company || '') : (p.company || ''));
      if(!latestVerification.current)setArea(p.city||'');
    }).catch(e => setError(e.message));
  }, [prospectId]);
  useEffect(() => {
    if(viewProfile.current===selected)return;
    setView(null); setViewing(false); control.current = ''; viewProfile.current = '';
  }, [selected]);
  useEffect(() => {
    if (!selected || !viewing) return;
    let alive = true, pending = false;
    const read = async () => {
      if (pending) return;
      pending = true;
      try {
        const result = await api.post<View>('/browser/profiles/' + selected + '/view', {});
        if (alive && latestSelected.current === selected) setView(result);
      } catch (e) {
        if (alive) {
          setViewing(false);
          setError(e instanceof Error ? e.message : 'Vue indisponible.');
        }
      } finally { pending = false; }
    };
    void read();
    const timer = window.setInterval(() => void read(), 1800);
    return () => { alive = false; window.clearInterval(timer); };
  }, [selected, viewing]);

  async function perform(label: string, run: () => Promise<void>) {
    setBusy(label); setError(''); setNotice('');
    try { await run(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Opération impossible.'); }
    finally { setBusy(''); }
  }

  const profile = profiles.find(p => p.id === selected);
  const automatic = native||status?.automatic.includes(profile?.source || source);
  const sourceProfiles = profiles.filter(p => p.source === source);
  const verificationJob=prospectId?jobs.find(job=>job.id===verificationJobId&&job.mode==='enrich'&&job.prospect_id===prospectId):undefined;
  const profileBusy=jobs.some(job=>job.profile_id===selected&&['queued','running'].includes(job.status));
  async function finishVerification(result:{prospectId:string;jobId:string;refreshWarning?:boolean}){
    const target=jobs.find(job=>job.id===result.jobId);
    if(target?.mode!=='enrich'||target.prospect_id!==result.prospectId)throw Error('La sauvegarde ne correspond pas à la tâche vérifiée.');
    returned.current=true;
    navigate(prospectReviewReturnUrl(result.prospectId,result.jobId)+(result.refreshWarning?'&refreshWarning=1':''),{replace:true});
  }
  useEffect(()=>{
    if(!verificationJob||initialContextLoaded.current)return;
    const target=profiles.find(p=>p.id===verificationJob.profile_id);if(!target)return;
    initialContextLoaded.current=true;setSelected(target.id);setSource(target.source);setQuery(verificationJob.query);setArea(verificationJob.area||'');
  },[profiles,verificationJob]);
  useEffect(()=>{
    if(!verificationJob||!initialContextLoaded.current)return;
    if(verificationJob.status==='completed'&&verificationJob.result?.applied){
      if(returned.current)return;returned.current=true;
      setReviewJob(verificationJob.id);return;
    }
    if(['needs_review','awaiting_user'].includes(verificationJob.status)&&verificationJob.result?.captures?.length){
      const key=verificationJob.id+JSON.stringify(verificationJob.result.captures);
      if(openedComparison.current!==key){openedComparison.current=key;setReviewJob(verificationJob.id);}return;
    }
    const key=verificationJob.id+'|'+selected;
    if(!native&&selected===verificationJob.profile_id&&!profileBusy&&status?.ready&&openedSource.current!==key){openedSource.current=key;void open(false,true);}
  },[verificationJob,selected,profiles,status?.ready,profileBusy]);
  async function readVerification(){
    if(!verificationJob)return;
    await perform('Lire la fiche',async()=>{
      if(profileBusy)throw Error('Une collecte est en cours dans ce profil. Attendez sa fin avant de lire la fiche.');
      if(['needs_review','awaiting_user'].includes(verificationJob.status)&&verificationJob.result?.captures?.length){setReviewJob(verificationJob.id);return;}
      if(!canResume.includes(verificationJob.status))throw Error('La lecture est déjà en cours.');
      await api.post('/browser/jobs/'+verificationJob.id+'/retry',{resume:true});await readJobs();
    });
  }
  const discoveryJobs = jobs.filter(job => job.mode === 'discover'&&!prospectId);
  const activeJob = discoveryJobs.find(job => job.id === activeJobId)
    || discoveryJobs.find(job => job.result?.captures?.length)
    || discoveryJobs[0];
  const allCaptures = activeJob?.result?.captures || [];
  const imports = activeJob?.result?.imports || {};
  const captures = pendingCloudCaptures(allCaptures,imports);
  const draftsCount = activeJob?.result?.drafts?.length || 0;
  const chosenCount = captures.filter(capture => chosen[capture.id]).length;

  async function create() {
    await perform('Créer', async () => {
      const p = await api.post<Profile>('/browser/profiles', {
        source, label: profileLabel.trim() || sourceName(source) + ' · ' + (mode === 'public' ? 'public' : 'mon compte'), mode,
      });
      setProfiles(value => [...value, p]); setSelected(p.id); setProfileLabel('');
    });
  }

  async function ensureProfile(){
    if(profile)return profile;
    const made=await api.post<Profile>('/browser/profiles',{source,label:profileLabel.trim()||sourceName(source)+' · '+(mode==='public'?'public':'mon compte'),mode});
    setProfiles(current=>[...current,made]);
    viewProfile.current=made.id;setView(null);setViewing(false);setSelected(made.id);return made;
  }
  async function open(login = false, keepPage = false) {
    await perform('Ouvrir', async () => {
      const target=await ensureProfile();
      const result = await api.post<any>('/browser/profiles/' + target.id + '/open',
        { query, area, login, keepPage }, { timeoutMs: 35000 });
      control.current = result.controlId;
      viewProfile.current = target.id;
      setViewing(true);
      setNotice('Session ouverte. Les connexions éventuelles restent dans ce profil ; une session ouverte ne garantit pas que le site vous a authentifié.');
    });
  }

  function action(event: object) {
    const target = selected, lease = control.current;
    if (!lease || !viewing || view?.busy) return;
    inputQueue.current = inputQueue.current.then(async () => {
      if (latestSelected.current !== target || control.current !== lease) return;
      if(profileBusy)throw Error('Collecte en cours : le navigateur sera disponible à la fin de la lecture.');
      await api.post('/browser/profiles/' + target + '/action', { event, controlId: lease });
    }).catch(e => { setError(e.message); });
  }

  async function launch() {
    await perform('Collecter', async () => {
      if (!automatic) throw new Error('Collecteur automatique indisponible pour cette source.');
      if (prospectId && !prospect) throw new Error('Prospect cible non chargé.');
      let target = profile;
      if (!target) {
        target = await api.post<Profile>('/browser/profiles', {
          source, label: profileLabel.trim() || sourceName(source) + ' · ' + (mode === 'public' ? 'public' : 'mon compte'), mode,
        });
        setProfiles(value => [...value, target!]); setSelected(target.id);
      }
      const job = await api.post<Job>('/browser/jobs', {
        profileId: target.id, query, area, ...(native?{filters:{regions,departements,codesPostaux:postalInput.split(/[\s,;]+/).filter(Boolean)}}:{}), ...(prospectId ? { prospectId } : {}),
      });
      setJobs(value => [job, ...value]);
      if (job.mode === 'discover') setActiveJobId(job.id); setVerificationJobId(job.id);
      setNotice('Recherche mise en file. Vous pouvez quitter cette page ; la tâche s’exécute sur le serveur.');
    });
  }

  async function importSelected(job: Job) {
    await perform('Importer', async () => {
      const candidates = pendingCloudCaptures(job.result?.captures || [],job.result?.imports).filter(capture => chosen[capture.id]);
      if (!candidates.length) throw new Error('Sélectionnez au moins une fiche vérifiée.');
      const totals={imported:0,enriched:0,alreadyPresent:0,needsReview:0,failed:0};
      for(let start=0;start<candidates.length;start+=25){
        const result=await api.post<any>('/browser/jobs/'+job.id+'/import',
          {captureIds:candidates.slice(start,start+25).map(capture=>capture.id)}, {timeoutMs:60000});
        ++jobsRequest.current;
        setJobs(current=>current.map(item=>item.id===job.id?result.job:item));
        const processed=new Set<string>(result.processedIds||[]);
        setChosen(current=>Object.fromEntries(Object.entries(current).filter(([id])=>!processed.has(id))));
        for(const field of Object.keys(totals) as Array<keyof typeof totals>)totals[field]+=result[field]||0;
        setNotice(`${Math.min(start+25,candidates.length)} / ${candidates.length} fiches traitées · ${totals.imported} créée(s), ${totals.enriched} enrichie(s), ${totals.alreadyPresent} déjà présente(s), ${totals.needsReview} à vérifier, ${totals.failed} en échec.`);
      }
    });
  }

  async function removeHistory(ids?: string[]) {
    const subject = ids ? (ids.length === 1 ? 'cette recherche' : `ces ${ids.length} recherches`)
      : 'toutes vos recherches terminées, échouées ou annulées, y compris les anciennes non affichées';
    if (!confirm(`Supprimer ${subject} et leurs résultats non importés ? Les prospects importés, leurs activités et vos profils restent conservés. Cette suppression est définitive.`)) return;
    await perform('Supprimer', async () => {
      const result = await api.post<{deleted: number; deletedIds: string[]}>('/browser/jobs/history/delete', ids ? {scope: 'selected', ids} : {scope: 'all'});
      const removed = new Set(result.deletedIds); ++jobsRequest.current;
      const oldCaptures = jobs.filter(job => removed.has(job.id)).flatMap(job => job.result?.captures || []);
      setChosen(current => selectCaptureBatch(current, oldCaptures, false));
      setJobs(current => current.filter(job => !removed.has(job.id)));
      setActiveJobId(current => removed.has(current) ? '' : current);
      await refresh();
      setNotice(`${result.deleted} recherche(s) supprimée(s). Les prospects et leurs activités sont conservés.`);
    });
  }

  function selectJob(job: Job) {
    setActiveJobId(job.id); setVerificationJobId(job.id);
    if (job.mode === 'discover') document.getElementById('cloud-browser-results')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function resizeWorkspace(clientX: number) {
    const bounds = workspaceRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width < 700) return;
    const minimum = Math.max(24, 320 / bounds.width * 100);
    const maximum = Math.min(43, (bounds.width - 470) / bounds.width * 100);
    if (minimum > maximum) return;
    const percentage = (bounds.right - clientX) / bounds.width * 100;
    setResultsShare(Math.round(Math.max(minimum, Math.min(maximum, percentage)) * 10) / 10);
  }

  function onDividerPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (expandedBrowser || event.button !== 0) return;
    resizing.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeWorkspace(event.clientX);
  }

  function jobCard(job: Job, historySelection: ReactNode, removeAction: ReactNode) {
    const jobProfile = profiles.find(p => p.id === job.profile_id);
    const jobCaptures = job.result?.captures?.length || 0;
    const handledCount=(job.result?.captures||[]).filter(c=>isCloudCaptureHandled(job.result?.imports?.[c.id])).length;
    return <article key={job.id} className={'cloud-browser-job-card' + (activeJob?.id === job.id ? ' is-active' : '')}>
      <div className="cloud-browser-job-top">
        {historySelection}
        <span className="cloud-browser-job-logo"><SourceLogo source={jobProfile?.source || source} size="sm"/></span>
        <div className="cloud-browser-job-title">
          <strong>{job.query || 'Recherche sans titre'}</strong>
          <small>{sourceName(jobProfile?.source || source)} · {jobCaptures} fiche(s){handledCount?' · '+handledCount+' traitée(s)':''}</small>
        </div>
        <span className={'cloud-browser-job-status cloud-browser-job-status--' + job.status}>{labels[job.status] || job.status}</span>
      </div>
      {(job.error || job.result?.message) && <p className="cloud-browser-job-message">{job.error || job.result.message}</p>}
      {job.result?.applied && <p className="cloud-browser-job-message">{job.result.applied.filled.length} champ(s) mis à jour · {job.result.applied.conflicts} désaccord(s)</p>}
      {reviewJob===job.id&&<CloudCaptureReview jobId={job.id} onClose={()=>setReviewJob(null)} onSaved={finishVerification}/>}
      <div className="cloud-browser-job-actions">
        {job.mode === 'discover' && <button type="button" onClick={() => selectJob(job)}>Voir les résultats <ArrowRight size={13}/></button>}
        {!prospectId&&<button type="button" onClick={() => {
          setSelected(job.profile_id);
          setNotice('Profil sélectionné. Utilisez « Reprendre le contrôle » pour consulter la page sans relancer la recherche.');
        }}>Voir le profil</button>}
        {job.prospect_id && !prospectId && <Link to={prospectReviewReturnUrl(job.prospect_id)}>Voir le prospect <ExternalLink size={12}/></Link>}
        {job.mode==='enrich'&&job.id!==verificationJobId&&jobCaptures>0&&['needs_review','awaiting_user'].includes(job.status)&&<button type="button" onClick={()=>setReviewJob(job.id)}>Comparer et valider</button>}
        {job.prospect_id&&canResume.includes(job.status)&&['pagesjaunes','societe_com','google_maps','google_search','bing'].includes(jobProfile?.source||source)&&<button type="button" disabled={!!busy||isMobileConnectorRequired()} title={isMobileConnectorRequired()?'La lecture locale nécessite une extension compatible sur cet appareil.':'La source sera ouverte dans votre Chrome, avec la connexion réseau de votre PC.'} onClick={()=>void perform('Ouvrir sur cet appareil',async()=>{
          await beginConnectorTask({source:jobProfile?.source||source,mode:'enrich',query:job.query,area:job.area||'',cloudJobId:job.id,prospect:{id:job.prospect_id!,company:prospect?.company||job.query}});
          setNotice('Source ouverte dans le Chrome de cet appareil. Lisez puis confirmez la capture dans l’extension ; vous reviendrez sur la comparaison du prospect.');
        })}>Lire avec Chrome sur cet appareil</button>}
        {job.id!==verificationJobId&&canResume.includes(job.status) && <button type="button" disabled={!!busy} onClick={() => void perform('Reprendre', async () => {
          await api.post('/browser/jobs/' + job.id + '/retry', { resume: true });
          setChosen(current => selectCaptureBatch(current, job.result?.captures || [], false)); await refresh();
        })}>Relire la fiche ouverte</button>}
        {activeStatuses.includes(job.status) && <button type="button" disabled={!!busy} onClick={() => void perform('Annuler', async () => {
          await api.post('/browser/jobs/' + job.id + '/cancel', {}); await refresh();
        })}>Annuler</button>}
        {removeAction}
      </div>
    </article>;
  }

  return <main className="cloud-browser-page" style={{ color: 'var(--text-primary)' }}>
    <div className="cloud-browser-heading">
      <div>
        <Link to={prospectId ? prospectReviewReturnUrl(prospectId) : '/outils'} className="cloud-browser-back"><ArrowLeft size={14}/> {prospectId ? 'Retour au prospect' : 'Catalogue des outils'}</Link>
        <h1><span className="cloud-browser-heading-icon"><Globe2 size={25}/></span> Recherche et collecte</h1>
        <p>Rechercher, explorer et importer vos entreprises depuis GrowthOS.</p>
      </div>
      <span className={'cloud-browser-health ' + ((native||status?.ready) ? 'is-ready' : status ? 'is-offline' : 'is-loading')}>
        {(native||status?.ready) ? <CheckCircle2 size={16}/> : <AlertCircle size={16}/>}
        {native?'Annuaire disponible':status?.ready ? 'Navigateur opérationnel' : status ? 'Navigateur indisponible' : 'Vérification du service…'}
      </span>
    </div>

    {!native&&status && !status.ready && <div role="status" className="cloud-browser-alert is-warning">
      {status.configured ? 'Le navigateur cloud est actuellement indisponible.' : 'Ajoutez le service navigateur cloud à la stack GrowthOS pour activer ce parcours.'}
      <Link to={'/outils' + (prospectId ? '?mode=enrich&prospectId=' + prospectId : '')}>Outils et secours Chrome <ArrowRight size={14}/></Link>
    </div>}
    {error && <div role="alert" className="cloud-browser-alert is-error"><AlertCircle size={18}/>{error}</div>}
    {notice && <div role="status" className="cloud-browser-alert is-info"><CheckCircle2 size={18}/>{notice}</div>}
    {prospect && <div className="cloud-browser-prospect-context">
      <ShieldCheck size={18}/>
      <span><strong>Enrichissement de {prospect.company}</strong> · {prospect.siret || prospect.siren || 'Identité à vérifier'} · {prospect.city || ''}</span>
      <small>Identité et activité confirmées : mise à jour avec traçabilité. Autres désaccords proposés à vérifier.</small>
    </div>}

    <section className="cloud-browser-command" aria-label="Recherche et collecte">
      <div className="cloud-browser-command-grid">
        <label className="cloud-browser-field"><span>Source</span>
          <div className="cloud-browser-select-with-logo"><SourceLogo source={source} size="sm"/>
            <select aria-label="Source" value={source} onChange={e => {
              setVerificationJobId('');setReviewJob(null);initialContextLoaded.current=false;setSource(e.target.value); setSelected('');
              if (prospect) setQuery(e.target.value === 'societe_com'
                ? (prospect.siret || prospect.siren || prospect.company || '') : (prospect.company || ''));
            }}>{modules.map(m => <option key={m.source} value={m.source}>{m.name}</option>)}</select>
          </div>
        </label>
        <label className="cloud-browser-field"><span>Profil de navigation</span>
          <select aria-label="Profil utilisé" value={selected} onChange={e=>{setVerificationJobId('');setReviewJob(null);initialContextLoaded.current=false;setSelected(e.target.value);}}>
            <option value="">Choisir un profil</option>
            {sourceProfiles.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        <label className="cloud-browser-field cloud-browser-search-field"><span>Recherche</span>
          <span className="cloud-browser-input-icon"><Search size={15}/>
            <input aria-label="Recherche" value={query} onChange={e => setQuery(e.target.value)} placeholder="Entreprise, activité, SIREN…" maxLength={160}/>
          </span>
        </label>
        <label className="cloud-browser-field"><span>Localisation</span>
          <span className="cloud-browser-input-icon"><MapPin size={15}/>
            <input aria-label="Ville ou code postal" value={area} onChange={e => setArea(e.target.value)} placeholder="Ville ou département" maxLength={120}/>
          </span>
        </label>
        <div className="cloud-browser-field cloud-browser-limit"><span>Résultats</span><strong>Tous les résultats accessibles</strong></div>
        <button type="button" className="cloud-browser-primary cloud-browser-launch"
          disabled={!!busy || profileBusy || (!native&&!status?.ready) || (automatic&&query.trim().length < 2)
            || (['societe_com','pappers'].includes(profile?.source || source) && !prospectId)}
          onClick={()=>void (verificationJob?readVerification():automatic?launch():open())}><Play size={16}/>
          {verificationJob?profileBusy?'Lecture en cours…':['needs_review','awaiting_user'].includes(verificationJob.status)&&verificationJob.result?.captures?.length?'Vérifier et valider':'Lire cette fiche':busy === 'Collecter' ? 'Mise en file…' : !automatic?'Ouvrir cette source':prospectId ? 'Enrichir ce prospect' : 'Lancer la collecte'}
        </button>
      </div>
      <div className="cloud-browser-command-secondary">
        {!native&&<button type="button" className="cloud-browser-secondary" disabled={!!busy || (!native&&!status?.ready)}
          onClick={() => void open()}><ExternalLink size={15}/> Ouvrir dans GrowthOS</button>}
        {!native&&profile?.mode === 'account' && <button type="button" className="cloud-browser-secondary" disabled={!!busy || (!native&&!status?.ready)}
          onClick={() => void open(true)}><LogOut size={15}/> Ouvrir la connexion à la source</button>}
        <details className="cloud-browser-profile-manager">
          <summary><Plus size={15}/> Nouveau profil <ChevronDown size={14}/></summary>
          <div className="cloud-browser-profile-form">
            <strong>Mes profils de navigation</strong>
            <label>Mode de navigation <select value={mode} onChange={e => setMode(e.target.value as 'public' | 'account')}>
              <option value="public">Sans compte · public</option>
              <option value="account">Mon compte · connexion dans la source</option>
            </select></label>
            <label>Nom du profil <input aria-label="Nom du profil" placeholder="Nom du profil (facultatif)" maxLength={80}
              value={profileLabel} onChange={e => setProfileLabel(e.target.value)}/></label>
            <button type="button" className="cloud-browser-primary" disabled={!!busy} onClick={() => void create()}>Créer le profil</button>
            <small>Profils séparés par compte et par agence ; les accès possibles dépendent du site source.</small>
          </div>
        </details>
        <span className="cloud-browser-command-helper">
          {native?'Accès public direct · aucun compte ni extension requis.':profile ? (profile.mode === 'account' ? 'Profil avec compte · connectez-vous directement sur la source.' : 'Profil public · sans connexion requise.') : 'Le profil public sera créé automatiquement à l’ouverture de la source.'}
        </span>
      </div>
      {profile && !automatic && <p className="cloud-browser-command-footnote">Cette source peut être ouverte dans le navigateur. Son collecteur automatique n'est pas encore disponible.</p>}
      {(profile?.source || source) === 'societe_com' && !prospectId && <p className="cloud-browser-command-footnote">Pour Societe.com, ouvrez « Enrichir » depuis la fiche d'un prospect identifié.</p>}
    </section>

    <div ref={workspaceRef} className={'cloud-browser-workspace' + (prospectId?' has-verification':'') + (expandedBrowser ? ' is-expanded' : '')}
      style={{ '--cb-results-share': `${resultsShare}%` } as CSSProperties}>
      <section className="cloud-browser-view-panel" aria-label="Vue du navigateur cloud">
        <div className="cloud-browser-panel-toolbar">
          <div className="cloud-browser-browser-name">
            <SourceLogo source={profile?.source || source} size="md"/>
            <div><strong>{sourceName(profile?.source || source)}</strong>
              <small className={'cloud-browser-session-pill' + (viewing && view ? ' is-live' : '')}>
                {native?'Recherche officielle':view?.busy ? 'Navigation automatique' : viewing && view ? 'Session active' : 'Vue en attente'}</small></div>
          </div>
          <div className="cloud-browser-url" title={native?'recherche-entreprises.api.gouv.fr':view?.url || 'Ouvrez une recherche pour afficher la source'}>
            <ShieldCheck size={14}/>
            <span>{native?'recherche-entreprises.api.gouv.fr':view?.url || 'Ouvrez une recherche pour afficher la source'}</span>
            {view?.busy && <span className="cloud-browser-live-dot" title="Lecture en cours"/>}
          </div>
          {!native&&<div className="cloud-browser-browser-actions">
            <button type="button" disabled={!!busy || (!native&&!status?.ready)} onClick={() => void open(false, true)}
              title="Afficher ou reprendre la session ouverte"><Globe2 size={15}/> Reprendre le contrôle</button>
            <button type="button" disabled={!view} onClick={() => action({ type: 'back' })} title="Page précédente"><ArrowLeft size={16}/></button>
            <button type="button" onClick={() => setExpandedBrowser(value => !value)}
              title={expandedBrowser ? 'Réduire le navigateur' : 'Agrandir le navigateur'}>
              {expandedBrowser ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}</button>
            <button type="button" disabled={!viewing} onClick={() => { setViewing(false); setView(null); }}
              title="Masquer la vue"><EyeOff size={16}/></button>
            <button type="button" disabled={!selected || !!busy || (!native&&!status?.ready)}
              title="Déconnecter et effacer la session conservée sur le serveur" onClick={() => {
                if (confirm('Déconnecter ce profil et effacer sa session conservée sur le serveur ?')) void perform('Déconnecter', async () => {
                  await api.post('/browser/profiles/' + selected + '/erase', {});
                  setViewing(false); setView(null); control.current = ''; setNotice('Session effacée.');
                });
              }}><LogOut size={16}/></button>
          </div>}
        </div>
        {!native&&view&&<div className="cloud-browser-view-tools" role="group" aria-label="Lisibilité de la source">
          <button type="button" onClick={()=>setSourceZoom(0)} aria-pressed={sourceZoom===0}>Ajuster</button>
          <button type="button" onClick={()=>setSourceZoom(1)} aria-pressed={sourceZoom===1}>Taille réelle</button>
          <button type="button" disabled={sourceZoom>=2} onClick={()=>setSourceZoom(z=>z?Math.min(2,z+.5):1)}>Agrandir le texte</button>
          <button type="button" disabled={profileBusy} onClick={()=>action({type:'scroll',deltaY:-550})}>Source : haut</button>
          <button type="button" disabled={profileBusy} onClick={()=>action({type:'scroll',deltaY:550})}>Source : bas</button>
          <small>{sourceZoom?'Déplacez la vue au doigt ou avec les barres de défilement. Touchez un lien pour l’ouvrir.':'Vue entière. Utilisez Taille réelle pour lire le texte.'}</small>
        </div>}
        {native?<div className="p-5 space-y-4 overflow-auto">
          <h2 className="font-semibold">Annuaire des Entreprises · données officielles publiques</h2>
          <p>Recherchez par activité, nom, SIREN ou SIRET. Les résultats sont sélectionnables et importés dans le même espace que les autres sources.</p>
          <GeoMultiSelect label="Régions" options={FRENCH_REGIONS} values={regions} onChange={setRegions} placeholder="Toutes les régions"/>
          <GeoMultiSelect label="Départements" options={FRENCH_DEPARTMENTS} values={departements} onChange={setDepartements} placeholder="Tous les départements"/>
          <label className="block">Codes postaux<input className="block border rounded-lg p-3 w-full" value={postalInput} onChange={e=>setPostalInput(e.target.value)} placeholder="59100, 59800…"/></label>
          <p className="text-sm">Pagination automatique jusqu’à la fin des résultats accessibles ; aucun quota total de fiches dans GrowthOS.</p>
          <small>L’Annuaire réunit notamment les données du répertoire INSEE. Aucune extension ni connexion à un navigateur n’est nécessaire.</small>
        </div>:view ? <div tabIndex={0} aria-label="Navigateur distant interactif"
          className={'cloud-browser-remote'+(sourceZoom?' is-zoomed':'')} onKeyDown={e => {
            if (e.altKey && e.key === 'Escape') { e.currentTarget.blur(); return; }
            if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;
            const key = e.ctrlKey && e.key.toLowerCase() === 'a' ? 'Control+A' : e.key;
            if (['Enter', 'Tab', 'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Escape', 'Home', 'End', 'Control+A'].includes(key)) {
              e.preventDefault(); action({ type: 'key', key });
            } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
              e.preventDefault(); action({ type: 'text', text: e.key });
            }
          }} onPaste={e => { e.preventDefault(); action({ type: 'text', text: e.clipboardData.getData('text').slice(0, 2000) }); }}
          onWheel={e => { if(sourceZoom)return;action({ type: 'scroll', deltaY: Math.max(-1500, Math.min(1500, e.deltaY)) }); }}>
          <img style={sourceZoom?{width:(view.width||1280)*sourceZoom,maxWidth:'none',maxHeight:'none',flexShrink:0}:undefined} src={view.image} alt={view.title || 'Page de la source'} draggable={false}
            onClick={e => {
              e.currentTarget.parentElement?.focus();
              const box = e.currentTarget.getBoundingClientRect();
              action({ type: 'click', x: Math.min((view.width||1280)-1, Math.floor((e.clientX - box.left) / box.width * (view.width||1280))),
                y: Math.min((view.height||800)-1, Math.floor((e.clientY - box.top) / box.height * (view.height||800))) });
            }}/>
        </div> : <div className="cloud-browser-empty-view">
          <span><Globe2 size={36}/></span>
          <strong>Votre navigateur est prêt</strong>
          <p>Ouvrez une recherche pour voir et contrôler le site source directement depuis GrowthOS.</p>
          <button type="button" className="cloud-browser-primary" disabled={!!busy || (!native&&!status?.ready)}
            onClick={() => void open(false, true)}>Afficher / reprendre le contrôle</button>
        </div>}
        <div className="cloud-browser-browser-footer">
          <span><ShieldCheck size={14}/> {native?'Données officielles · accès natif':'La session est isolée par profil et par agence.'}</span>
          <small>{native?'Choisissez les résultats à importer dans Prospects.':'Dans la vue : clic, molette, clavier · Alt + Échap libère le focus.'}</small>
        </div>
      </section>

      {!expandedBrowser && <div role="separator" aria-label="Redimensionner les panneaux navigateur et résultats"
        aria-orientation="vertical" aria-valuemin={24} aria-valuemax={43} aria-valuenow={Math.round(resultsShare)}
        tabIndex={0} className="cloud-browser-divider" title="Glisser pour ajuster la largeur des panneaux"
        onPointerDown={onDividerPointerDown}
        onPointerMove={event => { if (resizing.current) resizeWorkspace(event.clientX); }}
        onPointerUp={event => {
          resizing.current = false;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => { resizing.current = false; }}
        onLostPointerCapture={() => { resizing.current = false; }}
        onKeyDown={event => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            setResultsShare(current => Math.max(24, Math.min(43, current + (event.key === 'ArrowLeft' ? 2 : -2))));
          }
        }}><span aria-hidden="true"/></div>}

      {prospectId?<section id="cloud-browser-results" className="cloud-browser-results cloud-browser-verification p-4 space-y-3" aria-label="Vérification de ce prospect">
        <h2 className="font-semibold">Vérification de {prospect?.company||'ce prospect'}</h2>
        <p>L’enrichissement automatique se lance et se suit depuis la fiche. Cet espace sert à consulter une source lorsqu’une intervention est nécessaire.</p>
        <Link className="cloud-browser-primary" to={prospectReviewReturnUrl(prospectId!)}>Retour à la fiche prospect</Link>
        {jobs.filter(job=>job.prospect_id===prospectId&&job.profile_id===selected&&(!verificationJobId||job.id===verificationJobId)).map(job=><div key={job.id}>{jobCard(job,null,null)}
          {!!job.result?.references?.length&&<details><summary>Liens Web repérés · identité à vérifier</summary>{job.result.references.map(r=><p key={r.url}><a href={r.url} target="_blank" rel="noopener noreferrer">{r.label||r.url}</a></p>)}</details>}
        </div>)}
      </section>:<section id="cloud-browser-results" className="cloud-browser-results" aria-label="Résultats de collecte">
        <header className="cloud-browser-results-header">
          <span><Layers size={20}/></span>
          <div><h2>Résultats de collecte</h2><p>{activeJob?.query || 'Aucune collecte sélectionnée'} {activeJob?.area ? '· ' + activeJob.area : ''}</p></div>
        </header>
        <div className="cloud-browser-results-summary">
          <CheckCircle2 size={16}/>
          <span>{allCaptures.length} entreprise(s) trouvée(s) · {captures.length} restante(s){activeJob?.result?.hasMore?['awaiting_user','cancelled','failed'].includes(activeJob.status)?' · suite en attente':' · collecte de la suite en cours':''}{draftsCount ? ' · ' + draftsCount + ' à vérifier' : ''}</span>
        </div>
        <CloudImportFeedback captures={allCaptures} imports={imports}/>
        {!!captures.length && <div className="cloud-browser-batch-wrap"><CaptureBatchControls captures={captures} chosen={chosen} busy={!!busy}
          onChooseBatch={(items, value) => setChosen(current => selectCaptureBatch(current, items, value))}/></div>}
        <div className="cloud-browser-results-list">
          {activeJob && captures.length ? captures.map(capture => <label key={capture.id} className={'cloud-browser-result-row' + (chosen[capture.id] ? ' is-checked' : '')}>
            <input type="checkbox" disabled={!!busy} checked={!!chosen[capture.id]} onChange={e => setChosen(current => selectCaptureBatch(current, [capture], e.target.checked))}/>
            <span className="cloud-browser-result-info">
              <span className="cloud-browser-result-title"><strong>{capture.company || 'Entreprise sans nom'}</strong>
                <span className={'cloud-browser-result-status' + (capture.address && capture.phone ? ' is-complete' : ' is-partial')}>
                  {capture.address && capture.phone ? 'Coordonnées' : 'Données partielles'}
                </span>
              </span>
              {[capture.address, capture.city].filter(Boolean).length > 0 && <small><MapPin size={12}/>{[capture.address, capture.city].filter(Boolean).join(' · ')}</small>}
              {capture.phone && <small><Phone size={12}/>{capture.phone}</small>}
              <CaptureImportBadge state={imports[capture.id]}/>
              {imports[capture.id]?.prospectId&&<Link to={'/prospects/'+imports[capture.id].prospectId}>Vérifier la fiche CRM</Link>}
            </span>
          </label>) : <div className="cloud-browser-no-results">
            <Search size={26}/>
            <strong>{allCaptures.length ? activeJob?.result?.hasMore?'Les fiches disponibles sont traitées ; la suite reste à collecter':'Toutes les fiches de ce lot sont traitées' : activeJob ? 'Aucune fiche vérifiée disponible' : 'Vos résultats apparaîtront ici'}</strong>
            <p>{allCaptures.length ? 'Retrouvez-les dans les fiches traitées ci-dessus ou dans Prospects.' : activeJob ? 'Consultez le statut de la tâche ou relancez sa collecte si nécessaire.' : 'Lancez une collecte, puis sélectionnez les entreprises à importer.'}</p>
          </div>}
        </div>
        {activeJob?.error && <p className="cloud-browser-results-note is-error">{activeJob.error}</p>}
        {draftsCount > 0 && <p className="cloud-browser-results-note"><AlertCircle size={15}/> {draftsCount} fiche(s) partielle(s) conservée(s) : import impossible sans vérification.</p>}
        <footer className="cloud-browser-results-footer">
          <span><strong>{chosenCount}</strong> sélectionnée(s)</span>
          <button type="button" className="cloud-browser-primary" disabled={!activeJob || !chosenCount || !!busy}
            onClick={() => activeJob && void importSelected(activeJob)}>
            <Check size={16}/>{busy === 'Importer' ? 'Import en cours…' : `Importer dans Prospects (${chosenCount})`}
          </button>
        </footer>
      </section>}
    </div>

    <details className="cloud-browser-history-drawer">
      <summary><span className="cloud-browser-history-drawer-label"><History size={18}/> Tâches récentes <ChevronDown size={15}/></span>
        <span className="cloud-browser-history-preview">{jobs.slice(0, 2).map(job => <span key={job.id} className="cloud-browser-history-preview-item">
          <span className={'cloud-browser-history-preview-dot cloud-browser-job-status--' + job.status}/>
          <strong>{job.query || 'Recherche'}</strong><small>{labels[job.status] || job.status}</small>
        </span>)}</span>
        <span className="cloud-browser-history-manage">Gérer l’historique</span>
      </summary>
      <CloudJobHistory jobs={jobs} busy={!!busy} onRemove={ids => void removeHistory(ids)} renderJob={jobCard}/>
    </details>
    {!prospectId&&<LegacySourcingArchive initialId={params.get('legacyJobId')}/>}
    <Link className="cloud-browser-external-help" to={'/outils' + (prospectId ? '?mode=enrich&prospectId=' + prospectId : '')}>
      Catalogue et secours externe Chrome <ExternalLink size={14}/>
    </Link>
  </main>;
}
