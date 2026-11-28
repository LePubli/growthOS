import {CloudCaptureReview} from './cloud-browser/CloudCaptureReview';
import {useEffect,useRef,useState} from 'react';
import {useSearch,useLocation} from 'wouter';
import {AlertTriangle,CheckCircle2,Info,Loader2,X} from 'lucide-react';
import apiClient from '@/lib/api-client';
import {getConnectorTask,acknowledgeConnectorTask} from '@/lib/pagesjaunes-device';

export function ConnectorEnrichmentReturn({prospectId,onSaved,onBusyChange}:{prospectId:string;onSaved:()=>void|Promise<void>;onBusyChange?:(busy:boolean)=>void}){
  const [,navigate]=useLocation();
  const search=useSearch(),taskId=new URLSearchParams(search).get('enrichmentTask');
  const requestedProspectId=new URLSearchParams(search).get('mergedFrom')||prospectId;
  const [reviewJob,setReviewJob]=useState<string|null>(null);
  const [retry,setRetry]=useState(0),[error,setError]=useState(''),[result,setResult]=useState('');
  const [conflicts,setConflicts]=useState(0);
  const [dismissed,setDismissed]=useState(false);
  const saved=useRef(onSaved);saved.current=onSaved;
  const busy=useRef(onBusyChange);busy.current=onBusyChange;
  useEffect(()=>{
    if(!taskId)return;
    let alive=true;setReviewJob(null);setError('');setResult('');setConflicts(0);setDismissed(false);busy.current?.(true);
    (async()=>{
      if(requestedProspectId!==prospectId){const alias=await apiClient.get<any>('/prospects/'+requestedProspectId);if(alias.id!==prospectId||alias.mergedFromId!==requestedProspectId)throw Error('La capture ne cible pas ce dossier fusionné.');}
      const response=await getConnectorTask(taskId,requestedProspectId),task=response.task;
      if(!task || task.prospect?.id!==requestedProspectId)throw new Error('La capture ne cible pas ce prospect.');
      if(task.status==='done'){if(alive){setResult('Cet enrichissement a déjà été enregistré.');await saved.current();}return;}
      if(!task.capture || task.status!=='pending')throw new Error('Capture non confirmée dans l’extension.');
      const staged=await apiClient.post<{job:{id:string;result?:{applied?:{conflicts:number}}};alreadyApplied?:boolean}>('/browser/local-review',{taskId,prospectId,cloudJobId:task.cloudJobId,capture:task.capture});
      if(staged.alreadyApplied){await acknowledgeConnectorTask(taskId,requestedProspectId);if(alive){setResult('Cet enrichissement a déjà été enregistré.');await saved.current();}return;}
      if(alive)setReviewJob(staged.job.id);
    })().catch(e=>{if(alive)setError(e instanceof Error?e.message:'Enregistrement impossible.');})
      .finally(()=>{if(alive)busy.current?.(false);});
    return()=>{alive=false;busy.current?.(false);};
  },[taskId,prospectId,requestedProspectId,retry]);
  if(!taskId||dismissed)return null;
  const duplicate=!error&&result==='Cet enrichissement a déjà été enregistré.';
  const pending=!error&&!result&&!reviewJob;
  const tone=error?'error':pending?'pending':duplicate?'duplicate':'success';
  if(reviewJob&&!result)return <CloudCaptureReview jobId={reviewJob} onClose={()=>setDismissed(true)} onSaved={async(result)=>{void acknowledgeConnectorTask(taskId!,requestedProspectId).catch(()=>apiClient.reportClientError('LOCAL_CAPTURE_ACK_PENDING','Capture enregistrée ; acquittement local à reprendre',{prospectId}));setReviewJob(null);setResult('Enrichissement confirmé et enregistré.');void Promise.resolve(saved.current()).catch(()=>{});navigate(result.url+(result.refreshWarning?'&refreshWarning=1':''),{replace:true});}}/>;
  const Icon=error?AlertTriangle:pending?Loader2:duplicate?Info:CheckCircle2;
  return <section className={'atlas-enrichment-notice atlas-enrichment-notice--'+tone} role={error?'alert':'status'} aria-live="polite">
    <span className="atlas-enrichment-notice-icon"><Icon size={20} className={pending?'animate-spin':undefined}/></span>
    <div className="atlas-enrichment-notice-copy">
      <strong>{error?'Échec de l’enrichissement':pending?'Enregistrement en cours…':duplicate?'Enrichissement déjà enregistré':'Enrichissement enregistré'}</strong>
      <p>{error?error:pending?'Enregistrement des données confirmées dans l’extension…':duplicate?'Cette capture a déjà été intégrée au dossier. Aucun nouvel enregistrement n’est nécessaire.':result}</p>
      {error&&<><small>La capture reste disponible dans l’extension pendant 24 h. Vérifiez la connexion et le prospect ciblé.</small>
        <button type="button" className="atlas-enrichment-notice-action" onClick={()=>setRetry(n=>n+1)}>Réessayer l’enregistrement</button></>}
      {!error&&conflicts>0&&<a href="#enrichment-conflicts" className="atlas-enrichment-notice-action">Comparer les {conflicts} donnée(s) divergente(s)</a>}
    </div>
    {!!result&&!error&&<button type="button" className="atlas-enrichment-notice-dismiss" onClick={()=>setDismissed(true)} title="Masquer cette notification" aria-label="Masquer cette notification"><X size={17}/></button>}
  </section>;
}
