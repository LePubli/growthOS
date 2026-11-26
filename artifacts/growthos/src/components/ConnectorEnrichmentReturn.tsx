import {useEffect,useRef,useState} from 'react';
import {useSearch} from 'wouter';
import apiClient from '@/lib/api-client';
import {getConnectorTask,acknowledgeConnectorTask} from '@/lib/pagesjaunes-device';

export function ConnectorEnrichmentReturn({prospectId,onSaved,onBusyChange}:{prospectId:string;onSaved:()=>void|Promise<void>;onBusyChange?:(busy:boolean)=>void}){
  const search=useSearch(),taskId=new URLSearchParams(search).get('enrichmentTask');
  const [retry,setRetry]=useState(0),[error,setError]=useState(''),[result,setResult]=useState('');
  const saved=useRef(onSaved);saved.current=onSaved;
  const busy=useRef(onBusyChange);busy.current=onBusyChange;
  useEffect(()=>{
    if(!taskId)return;
    let alive=true;setError('');setResult('');busy.current?.(true);
    (async()=>{
      const response=await getConnectorTask(taskId,prospectId),task=response.task;
      if(!task || task.prospect?.id!==prospectId)throw new Error('La capture ne cible pas ce prospect.');
      if(task.status==='done'){if(alive){setResult('Cet enrichissement a déjà été enregistré.');await saved.current();}return;}
      if(!task.capture || task.status!=='pending')throw new Error('Capture non confirmée dans l’extension.');
      const outcome=await apiClient.post<{filled:string[];conflicts:number;alreadyApplied:boolean}>('/sourcing/device/prospects/'+prospectId+'/enrich-capture',{
        taskId,confirmed:true,capture:task.capture,
      });
      await acknowledgeConnectorTask(taskId,prospectId);
      if(alive){setResult(outcome.alreadyApplied?'Cet enrichissement a déjà été enregistré.':`${outcome.filled.length} champ(s) complété(s). ${outcome.conflicts} désaccord(s) à vérifier sur la fiche.`);await saved.current();}
    })().catch(e=>{if(alive)setError(e instanceof Error?e.message:'Enregistrement impossible.');})
      .finally(()=>{if(alive)busy.current?.(false);});
    return()=>{alive=false;busy.current?.(false);};
  },[taskId,prospectId,retry]);
  if(!taskId)return null;
  return <div className={'p-4 mb-4 rounded-xl border '+(error?'bg-amber-50 text-amber-950':'bg-teal-50 text-teal-950')} role={error?'alert':'status'}>
    {error?<><p>{error}</p><p className="text-sm mt-1">La capture reste dans l’extension pendant 24 h. Vérifiez votre connexion et le prospect ciblé, puis réessayez.</p><button className="mt-2 border rounded-lg px-3 py-2" onClick={()=>setRetry(n=>n+1)}>Réessayer l’enregistrement</button></>
      :result||'Enregistrement des données confirmées dans l’extension…'}
  </div>;
}
