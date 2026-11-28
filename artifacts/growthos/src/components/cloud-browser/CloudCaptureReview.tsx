import {useEffect,useState,useRef} from 'react';
import {Link} from 'wouter';
import api from '@/lib/api-client';
import {prospectReviewReturnUrl} from '@/lib/prospect-enrichment';
import './source-review.css';
type Review={version:string;captureDigest:string;expectedValues:Record<string,string|null>;captureIndex:number;captureCount:number;alreadyApplied:boolean;blocked:boolean;legalOnly:boolean;message:string;prospect:{company:string;siren?:string;siret?:string;address?:string};source:{name:string;url:string;company:string;siren?:string;siret?:string;address?:string};fields:{field:string;before:string|null;after:string;changed:boolean}[]};
export type SavedSourceReview={prospectId:string;jobId:string;source:string;url:string;filled:string[];conflicts:number;refreshWarning?:boolean};
type SavedJob={id?:string;mode?:string;prospect_id?:string;status:string;result?:{applied?:{filled?:string[];conflicts?:number};captures?:{source?:string}[]}};
const labels:Record<string,string>={company:'Nom affiché (facultatif)',siren:'SIREN',siret:'SIRET',address:'Adresse',postalCode:'Code postal',city:'Ville',phone:'Téléphone',email:'Email',website:'Site web',apeCode:'Code APE / NAF',nafLabel:'Activité',linkedinUrl:'LinkedIn'};
export function CloudCaptureReview({jobId,onSaved,onClose,fallbackUrl}:{jobId:string;onSaved:(result:SavedSourceReview)=>Promise<void>;onClose:()=>void;fallbackUrl?:string}){
  const saved=useRef(false),finishing=useRef(false),callbacks=useRef({onSaved,onClose});callbacks.current={onSaved,onClose};
  const receipt=useRef<SavedJob|null>(null),dialog=useRef<HTMLElement|null>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.focus();return()=>{if(previous?.isConnected)previous.focus();};},[]);
  async function finish(){
    let result:SavedSourceReview;
    try{result=await api.post<SavedSourceReview>('/browser/jobs/'+jobId+'/finish-review',{}, {timeoutMs:5000});}
    catch(error){
      const job=receipt.current,status=(error as any)?.status;
      if(!job?.prospect_id||job.mode!=='enrich'||job.status!=='completed'||!job.result?.applied||status&&status<500)throw error;
      result={prospectId:job.prospect_id,jobId,source:job.result.captures?.[0]?.source||'source',url:prospectReviewReturnUrl(job.prospect_id,jobId),filled:job.result.applied.filled||[],conflicts:job.result.applied.conflicts||0,refreshWarning:true};
      api.reportClientError('SOURCE_RETURN_REFRESH_FAILED','Sauvegarde confirmée ; retour conservé malgré un rafraîchissement indisponible',{jobId,prospectId:job.prospect_id});
    }
    await callbacks.current.onSaved(result);callbacks.current.onClose();
  }
  const [revision,setRevision]=useState(0);
  const [index,setIndex]=useState(0),[review,setReview]=useState<Review|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[replace,setReplace]=useState<string[]>([]),[missingCapture,setMissingCapture]=useState(false);
  const choicesFor=useRef('');
  useEffect(()=>{saved.current=false;receipt.current=null;choicesFor.current='';},[jobId]);
  useEffect(()=>{let alive=true;setReview(null);setError('');setMissingCapture(false);
    void (async()=>{
      // A source can be awaiting human intervention without having captured a business.
      // Do not call /review (HTTP 409) until a real capture is persisted.
      const job=await api.get<SavedJob>('/browser/jobs/'+jobId);
      if(job.status==='completed'&&job.result?.applied){receipt.current=job;saved.current=true;if(!finishing.current){finishing.current=true;try{await finish();}finally{finishing.current=false;}}return;}
      if(!job.result?.captures?.[index]){if(alive)setMissingCapture(true);return;}
      const r=await api.get<Review>('/browser/jobs/'+jobId+'/review?captureIndex='+index);
      if(alive){const key=jobId+':'+index,preserve=choicesFor.current===key,available=r.fields.filter(f=>f.changed&&f.before&&!['siren','siret'].includes(f.field)).map(f=>f.field);setReview(r);setReplace(current=>preserve?current.filter(field=>available.includes(field)):available.filter(field=>field!=='company'));choicesFor.current=key;}
    })().catch(e=>{if(alive)setError(e instanceof Error?e.message:'Comparaison indisponible.');});return()=>{alive=false;};},[jobId,index,revision]);
  async function confirm(){if(!review||review.blocked)return;setBusy(true);setError('');try{if(!saved.current){const response=await api.post<{job:SavedJob}>('/browser/jobs/'+jobId+'/confirm',{captureIndex:index,confirmed:true,expectedUpdatedAt:review.version,expectedCaptureDigest:review.captureDigest,expectedValues:review.expectedValues,replaceFields:replace});if(response.job?.status!=='completed'||!response.job.result?.applied)throw Error('La sauvegarde n’a pas été confirmée. La capture reste disponible.');receipt.current=response.job;saved.current=true;}await finish();}catch(e){setError((e instanceof Error?e.message:(saved.current?'Les données sont enregistrées, mais le retour a échoué. Réessayez.':'Enregistrement impossible.'))+((e as any)?.data?.traceId?' Référence diagnostic : '+(e as any).data.traceId:''));}finally{setBusy(false);}}
  return <section ref={dialog} tabIndex={-1} role="dialog" aria-label="Comparer et valider cette fiche" className="cloud-capture-review rounded-xl border p-4 space-y-3" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
    <h3 className="font-semibold">Comparer et valider cette fiche</h3>
    {error&&<div><p role="alert" className="text-sm text-red-700">{error}</p><button type="button" disabled={busy} onClick={()=>setRevision(n=>n+1)}>Actualiser la comparaison</button></div>}
    {missingCapture&&<div role="status" className="space-y-2"><p className="text-sm">Aucune fiche de cette source n’a encore été capturée. Ouvrez la bonne fiche dans le navigateur cloud et relancez sa lecture avant de comparer les données.</p>
      {fallbackUrl&&<Link className="atlas-360-link-button atlas-360-link-button-primary" to={fallbackUrl}>Ouvrir la source à vérifier</Link>}</div>}
    {review?<><p className="text-sm"><strong>CRM : {review.prospect.company}</strong><br/>{review.prospect.siret||review.prospect.siren||'Identifiant absent'} · {review.prospect.address}</p>
      <p className="text-sm"><strong>Source : {review.source.company}</strong><br/>{review.source.siret||review.source.siren||'Identifiant absent'} · {review.source.address}<br/><a className="underline" href={review.source.url} target="_blank" rel="noreferrer">Voir la preuve source</a></p>
      {review.captureCount>1&&<label className="text-sm">Fiche capturée <select value={index} onChange={e=>setIndex(Number(e.target.value))}>{Array.from({length:review.captureCount},(_,i)=><option key={i} value={i}>{i+1}</option>)}</select></label>}
      <p className="text-sm">{review.message}</p>
      <button type="button" className="atlas-360-link-button atlas-360-link-button-primary" disabled={busy||review.blocked||review.alreadyApplied} onClick={()=>void confirm()}>{busy?'Enregistrement…':saved.current?'Revenir au prospect':'Valider et enregistrer'}</button>
      <div className="overflow-x-auto"><table className="text-xs w-full"><thead><tr><th>Champ</th><th>CRM</th><th>Source</th><th>Choix</th></tr></thead><tbody>{review.fields.filter(f=>f.changed).map(f=><tr key={f.field}><td data-label="Champ">{labels[f.field]||f.field}</td><td data-label="CRM">{f.before||'Non renseigné'}</td><td data-label="Source">{f.after}</td><td data-label="Choix">{f.before&&!['siren','siret'].includes(f.field)&&!review.blocked&&<label><input type="checkbox" checked={replace.includes(f.field)} onChange={e=>setReplace(values=>e.target.checked?[...values,f.field]:values.filter(v=>v!==f.field))}/>Remplacer par cette valeur</label>}</td></tr>)}</tbody></table></div>
      {!review.blocked&&!review.alreadyApplied&&<p className="text-sm">En validant, vous confirmez qu’il s’agit du bon prospect. Les champs vides et les remplacements cochés seront enregistrés.{review.legalOnly?' Seules les données de l’entreprise seront rattachées.':''}</p>}
    </>:!error&&!missingCapture&&<p className="text-sm">Chargement de la comparaison…</p>}
    <button type="button" disabled={busy} className="atlas-360-link-button atlas-360-link-button-secondary" onClick={onClose}>Fermer</button>
  </section>;
}
