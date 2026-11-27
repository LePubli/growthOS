import {lazy,Suspense,useState} from 'react';
const CloudCaptureReview=lazy(()=>import('./cloud-browser/CloudCaptureReview').then(m=>({default:m.CloudCaptureReview})));
import {Link} from 'wouter';
import {
  AlertCircle,ArrowRight,BadgeCheck,Check,CheckCircle2,ChevronRight,Clock3,Database,ExternalLink,
  FileClock,Info,Layers3,Loader2,RotateCw,ShieldAlert,Sparkles,TriangleAlert,
} from 'lucide-react';
import type {EnrichmentRun} from './ProspectEnrichmentStatus';
import {ProspectPublicRecords} from './ProspectPublicRecords';
import {SourceLogo} from './atlas/ProspectLogos';
import '../prospect-enrichments.css';

type Observation={captureId:string;source:string;sourceUrl?:string|null;capturedAt:string;fieldsFilled?:string[]};
type SourceStep=EnrichmentRun['steps'][string];
type Tone='confirmed'|'review'|'unavailable'|'running';
type Filter='all'|'review'|'confirmed';
const sourceOrder=['google_maps','pagesjaunes','societe_com','pappers','google_search','bing','entreprises','website','insee','bodacc'];
const sourceNames:Record<string,string>={website:'Site web du prospect',entreprises:'Annuaire des Entreprises',google_maps:'Google Maps',pagesjaunes:'PagesJaunes',
  insee:'INSEE Sirene',societe_com:'Societe.com',pappers:'Pappers',bodacc:'BODACC',google_search:'Google Search',bing:'Bing'};
const statusNames:Record<string,string>={pending:'En attente',collecting:'Recherche en cours',completed:'Confirmée',
  empty:'Aucune correspondance',skipped:'Non disponible',needs_review:'À vérifier',
  awaiting_user:'Action requise',failed:'Indisponible',cancelled:'Annulée'};
const fieldNames:Record<string,string>={address:'Adresse',city:'Ville',phone:'Téléphone',website:'Site web',postalCode:'Code postal',
  company:'Raison sociale',email:'Email',siret:'SIRET',siren:'SIREN',apeCode:'Code APE',nafLabel:'Activité NAF',
  linkedinUrl:'LinkedIn',firstName:'Prénom',lastName:'Nom'};
const toneOf=(status:string):Tone=>status==='completed'?'confirmed':
  ['needs_review','awaiting_user','failed'].includes(status)?'review':
  ['pending','collecting'].includes(status)?'running':'unavailable';
const dateLabel=(value?:string,withTime=true)=>{
  const d=value?new Date(value):null;
  return d&&Number.isFinite(d.getTime())?d.toLocaleString('fr-FR',{
    day:'2-digit',month:'2-digit',year:'numeric',...(withTime?{hour:'2-digit',minute:'2-digit'}:{})
  }):'Date indisponible';
};
const jobUrl=(source:string,step:SourceStep,prospectId:string)=>
  '/navigateur?'+new URLSearchParams({source,prospectId,profileId:step.profileId||'',jobId:step.jobId||''}).toString();

function StatusIcon({tone}:{tone:Tone}){
  return tone==='confirmed'?<Check size={13}/>:tone==='review'?<TriangleAlert size={13}/>:
    tone==='running'?<Loader2 size={13} className="animate-spin"/>:<Info size={13}/>;
}
function CaptureCard({entry,index}:{entry:Observation;index:number}){
  return <article className="atlas-enrichments-capture" key={entry.captureId+'-'+index}>
    <SourceLogo source={entry.source} size="sm"/>
    <div><strong>{sourceNames[entry.source]||entry.source.replaceAll('_',' ')}</strong>
      <time dateTime={entry.capturedAt}>{dateLabel(entry.capturedAt)}</time>
      {!!entry.fieldsFilled?.length&&<span className="atlas-enrichments-capture-updated"><Check size={12}/>{entry.fieldsFilled.length} champ(s) mis à jour</span>}
    </div>
    {entry.sourceUrl&&<a className="atlas-enrichments-capture-link" href={entry.sourceUrl} target="_blank" rel="noopener noreferrer">Voir la source <ExternalLink size={12}/></a>}
  </article>;
}

export function ProspectEnrichmentsTab({prospectId,run,busy,onEnrich,onOpenSources,observations,activities,sourceDetails,onReviewed}:{
  prospectId:string;run:EnrichmentRun|null;busy:boolean;onEnrich:()=>void;onOpenSources:()=>void;
  observations:Observation[];activities:any[];sourceDetails?:Record<string,any>;onReviewed?:()=>Promise<void>;
}){
  const [savedNotice,setSavedNotice]=useState('');
  const [reviewJob,setReviewJob]=useState<{id:string;source:string;step:SourceStep}|null>(null);
  const openReview=(source:string,step:SourceStep)=>{setSavedNotice('');setReviewJob({id:step.jobId!,source,step});window.setTimeout(()=>document.getElementById('prospect-source-review')?.scrollIntoView({behavior:'smooth',block:'start'}),0);};
  const [filter,setFilter]=useState<Filter>('all');
  const steps=Object.entries(run?.steps||{}).sort(([a],[b])=>{
    const ai=sourceOrder.indexOf(a),bi=sourceOrder.indexOf(b);
    return (ai===-1?999:ai)-(bi===-1?999:bi);
  });
  const count=(tone:Tone)=>steps.filter(([,step])=>toneOf(step.status)===tone).length;
  const confirmed=count('confirmed'),review=count('review'),unavailable=count('unavailable'),running=count('running');
  const visible=steps.filter(([,step])=>filter==='all'||toneOf(step.status)===filter);
  const priority=steps.filter(([,step])=>toneOf(step.status)==='review')
    .sort(([,a],[,b])=>(a.status==='awaiting_user'?0:a.status==='needs_review'?1:2)-(b.status==='awaiting_user'?0:b.status==='needs_review'?1:2));
  const resumable=priority.find(([,step])=>!!step.jobId);
  const active=!!run&&['queued','running'].includes(run.status);
  const history=[...observations].sort((a,b)=>Date.parse(b.capturedAt)-Date.parse(a.capturedAt));
  const lastUpdated=history.find(entry=>!!entry.fieldsFilled?.length);
  const updatedFields=run?.summary?.fields?.length?run.summary.fields:(lastUpdated?.fieldsFilled||[]);
  const updates=activities.filter(a=>a.type==='data_update'&&String(a.title||'').startsWith('Enrichissement'));
  const hasRecords=!!(sourceDetails?.website?.snapshot||sourceDetails?.pappers?.companyDetails||sourceDetails?.bodacc);
  return <section className="atlas-enrichments-tab" aria-label="Enrichissements du prospect">
    <header className="atlas-enrichments-header">
      <div className="atlas-enrichments-title"><span className="atlas-enrichments-title-icon"><Database size={23}/></span>
        <div><h2>Enrichissements</h2><p>Suivi des sources, données confirmées et historique des collectes.</p></div>
      </div>
      <button type="button" className="atlas-enrichments-primary" onClick={onEnrich} disabled={busy}>
        {busy?<Loader2 size={16} className="animate-spin"/>:<RotateCw size={16}/>}
        {busy?'Enrichissement en cours…':'Nouvel enrichissement'}
      </button>
    </header>
    <div className={'atlas-enrichments-banner '+(active?'is-running':confirmed?'is-success':'is-neutral')} role="status" aria-live="polite">
      <span className="atlas-enrichments-banner-icon">{active?<Loader2 size={22} className="animate-spin"/>:
        confirmed?<CheckCircle2 size={22}/>:<AlertCircle size={21}/>}</span>
      <div><strong>{active?'Collecte multisource en cours':confirmed?'Collecte multisource effectuée':run?'Bilan de la collecte multisource':'Prêt pour un enrichissement'}</strong>
        <p>{active?'Les sources sont consultées et comparées en arrière-plan.':run?
          `${confirmed} source(s) confirmée(s)${review?` · ${review} nécessitent une vérification`:''}.`:
          'Aucune collecte multisource enregistrée pour ce prospect.'}</p></div>
      {run&&<button type="button" className="atlas-enrichments-banner-action" onClick={onOpenSources}>Voir les données détaillées <ArrowRight size={14}/></button>}
    </div>
    {savedNotice&&<p role="status" className="atlas-enrichments-banner is-success">{savedNotice}</p>}
    {reviewJob&&<div id="prospect-source-review"><Suspense fallback={<p>Chargement de la comparaison…</p>}><CloudCaptureReview key={reviewJob.id} jobId={reviewJob.id} fallbackUrl={jobUrl(reviewJob.source,reviewJob.step,prospectId)} onClose={()=>setReviewJob(null)} onSaved={async()=>{setSavedNotice('Informations enregistrées. La fiche prospect a été mise à jour.');await onReviewed?.();}}/></Suspense>
      <Link className="atlas-enrichments-priority-link" to={jobUrl(reviewJob.source,reviewJob.step,prospectId)}>Ouvrir la source si la fiche n’a pas encore pu être lue <ExternalLink size={14}/></Link></div>}
    <div className="atlas-enrichments-metrics" aria-label="Synthèse des sources">
      <div className="atlas-enrichments-metric is-sources"><span><Layers3 size={23}/></span><div><strong>{steps.length}</strong><small>Sources consultées</small></div></div>
      <div className="atlas-enrichments-metric is-confirmed"><span><Check size={23}/></span><div><strong>{confirmed}</strong><small>Confirmée(s)</small></div></div>
      <div className="atlas-enrichments-metric is-review"><span><TriangleAlert size={23}/></span><div><strong>{review}</strong><small>À vérifier</small></div></div>
      <div className="atlas-enrichments-metric is-unavailable"><span><ShieldAlert size={23}/></span><div><strong>{unavailable}</strong><small>Sans résultat ou indisponibles</small></div></div>
    </div>
    <div className="atlas-enrichments-workspace">
      <section className="atlas-enrichments-sources" aria-label="État des sources">
        <div className="atlas-enrichments-panel-heading"><h3><Database size={18}/> État des sources</h3>
          <div className="atlas-enrichments-filters" role="group" aria-label="Filtrer les sources">
            {([['all','Toutes',steps.length],['review','À vérifier',review],['confirmed','Confirmées',confirmed]] as const).map(([key,label,total])=>
              <button type="button" key={key} className={filter===key?'is-selected':''} aria-pressed={filter===key}
                onClick={()=>setFilter(key)}>{label} ({total})</button>)}
          </div>
        </div>
        <div className="atlas-enrichments-source-grid">
          {visible.map(([source,step])=>{
            const tone=toneOf(step.status);
            return <article className={'atlas-enrichments-source is-'+tone} key={source}>
              <SourceLogo source={source} size="md"/>
              <div className="atlas-enrichments-source-body">
                <div className="atlas-enrichments-source-line"><strong>{step.label||sourceNames[source]||source.replaceAll('_',' ')}</strong>
                  <span className={'atlas-enrichments-chip is-'+tone}><StatusIcon tone={tone}/>{source==='website'&&step.status==='completed'?'Site consulté':statusNames[step.status]||step.status}</span></div>
                <p title={step.message||undefined}>{step.message||'Aucune précision communiquée par la source.'}</p>
              </div>
              {!active&&step.jobId&&tone==='review'&&(step.status==='needs_review'
                ?<button type="button" className="atlas-enrichments-source-action" onClick={()=>openReview(source,step)}
                    aria-label={'Comparer '+(step.label||sourceNames[source]||source)}><ChevronRight size={17}/></button>
                :<Link className="atlas-enrichments-source-action" to={jobUrl(source,step,prospectId)}
                    aria-label={'Ouvrir '+(step.label||sourceNames[source]||source)+' pour reprendre la collecte'}><ExternalLink size={17}/></Link>)}
            </article>;
          })}
          {!visible.length&&<div className="atlas-enrichments-empty"><Info size={19}/>
            {run?'Aucune source dans cette catégorie.':'Lancez un enrichissement pour consulter les résultats par source.'}</div>}
        </div>
        {running>0&&<p className="atlas-enrichments-footnote"><Loader2 size={13} className="animate-spin"/>{running} source(s) en attente ou en cours de consultation.</p>}
      </section>
      <aside className="atlas-enrichments-rail">
        <section className="atlas-enrichments-priority" aria-label="Actions prioritaires">
          <div className="atlas-enrichments-rail-head"><h3><Sparkles size={18}/> Actions prioritaires</h3><span>{review} source(s) à vérifier</span></div>
          {priority.length?<div className="atlas-enrichments-priority-list">{priority.slice(0,3).map(([source,step],index)=>
            <div className="atlas-enrichments-priority-item" key={source}>
              <span className="atlas-enrichments-priority-rank">{index+1}</span><SourceLogo source={source} size="sm"/>
              <strong>{step.label||sourceNames[source]||source}</strong>
              {step.jobId?(step.status==='needs_review'
                ?<button type="button" onClick={()=>openReview(source,step)} className="atlas-enrichments-priority-link">Comparer <ArrowRight size={14}/></button>
                :<Link to={jobUrl(source,step,prospectId)} className="atlas-enrichments-priority-link">Ouvrir la source <ExternalLink size={14}/></Link>)
                :<span className="atlas-enrichments-priority-pending">À contrôler</span>}
            </div>)}</div>
            :<div className="atlas-enrichments-priority-empty"><BadgeCheck size={21}/><p>{active?
              'La collecte est en cours. Les vérifications apparaîtront ici.':'Aucune vérification à reprendre pour ce bilan.'}</p></div>}
          {resumable?(resumable[1].status==='needs_review'
              ?<button type="button" className="atlas-enrichments-rail-cta" onClick={()=>openReview(resumable[0],resumable[1])}><RotateCw size={15}/> Comparer les informations</button>
              :<Link className="atlas-enrichments-rail-cta" to={jobUrl(resumable[0],resumable[1],prospectId)}><ExternalLink size={15}/> Ouvrir la source à vérifier</Link>)
            :<button type="button" className="atlas-enrichments-rail-cta" onClick={onOpenSources}>Voir les données et désaccords <ArrowRight size={15}/></button>}
        </section>
        <section className="atlas-enrichments-updated" aria-label="Dernières données mises à jour">
          <div className="atlas-enrichments-updated-head"><CheckCircle2 size={21}/><div><h3>Derniers champs mis à jour</h3>
            {lastUpdated&&<p>{sourceNames[lastUpdated.source]||lastUpdated.source.replaceAll('_',' ')} · {dateLabel(lastUpdated.capturedAt,false)}</p>}</div></div>
          {updatedFields.length?<div className="atlas-enrichments-updated-tags">{[...new Set(updatedFields)].map(field=>
            <span key={field}><Check size={13}/>{fieldNames[field]||field}</span>)}</div>
            :<p className="atlas-enrichments-no-fields">Aucun nouveau champ confirmé dans les dernières captures.</p>}
        </section>
      </aside>
    </div>
    <section className="atlas-enrichments-history" aria-label="Historique des captures">
      <div className="atlas-enrichments-panel-heading"><h3><Clock3 size={18}/> Historique des captures <span className="atlas-enrichments-count">{history.length}</span></h3></div>
      {history.length?<><div className="atlas-enrichments-history-grid">{history.slice(0,3).map((entry,i)=><CaptureCard entry={entry} index={i} key={entry.captureId+'-'+i}/>)}</div>
        {history.length>3&&<details className="atlas-enrichments-more"><summary>Afficher les {history.length-3} autre(s) capture(s) <ChevronRight size={14}/></summary>
          <div className="atlas-enrichments-history-grid">{history.slice(3).map((entry,i)=><CaptureCard entry={entry} index={i+3} key={entry.captureId+'-'+i}/>)}</div></details>}</>
        :<p className="atlas-enrichments-empty-note">Aucune capture enregistrée pour ce prospect.</p>}
    </section>
    <details className="atlas-enrichments-trace"><summary><FileClock size={17}/> Modifications tracées ({updates.length}) <ChevronRight size={16}/></summary>
      {updates.length?<div className="atlas-enrichments-trace-list">{updates.map(a=><article key={a.id}><strong>{a.title}</strong>
        <time>{dateLabel(a.doneAt||a.createdAt||a.created_at)}</time><p>{a.description}</p></article>)}</div>
        :<p>Aucune modification d’enrichissement enregistrée.</p>}
    </details>
    {hasRecords&&<details className="atlas-enrichments-trace atlas-enrichments-public"><summary><Database size={17}/> Données du site web, Pappers et BODACC <ChevronRight size={16}/></summary>
      <div className="atlas-enrichments-public-body"><ProspectPublicRecords details={sourceDetails}/></div></details>}
    <p className="atlas-enrichments-disclaimer"><Info size={13}/> Les données concordantes sont conservées ; les divergences restent à vérifier avec leur provenance.</p>
  </section>;
}
