import {useRef,useEffect,useState,type ReactNode} from 'react';
import {ArrowRight,Clock3,History} from 'lucide-react';
export type CloudJob={id:string;profile_id:string;prospect_id:string|null;mode:'enrich'|'discover';query:string;area?:string;status:string;error:string|null;result:{message?:string;captures?:any[];drafts?:any[];applied?:{filled:string[];conflicts:number}}};
export type CaptureSelection=Record<string,boolean>;
export const canRemoveHistory=(job:CloudJob)=>['completed','failed','cancelled'].includes(job.status);
export function selectCaptureBatch(current:CaptureSelection,captures:{id:string}[],checked:boolean):CaptureSelection{
  const next={...current};for(const capture of captures)if(checked)next[capture.id]=true;else delete next[capture.id];return next;
}
function BatchCheckbox({checked,mixed,onChange,label,disabled=false}:{checked:boolean;mixed:boolean;onChange:(value:boolean)=>void;label:string;disabled?:boolean}){
  const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(input.current)input.current.indeterminate=mixed;},[mixed]);
  return <label className="inline-flex items-center gap-2 text-sm"><input ref={input} type="checkbox" aria-label={label} aria-checked={mixed?'mixed':checked} checked={checked} disabled={disabled} onChange={e=>onChange(e.target.checked)}/>{label}</label>;
}
export function CaptureBatchControls({captures,chosen,busy,onChooseBatch}:{captures:{id:string}[];chosen:CaptureSelection;busy:boolean;onChooseBatch:(captures:{id:string}[],checked:boolean)=>void}){
  const count=captures.filter(c=>chosen[c.id]).length;
  return <div className="cloud-browser-results-note flex flex-wrap items-center gap-2">
    <BatchCheckbox label="Tout cocher dans ce lot" checked={!!captures.length&&count===captures.length} mixed={count>0&&count<captures.length} disabled={busy||!captures.length} onChange={value=>onChooseBatch(captures,value)}/>
    <span className="cloud-browser-job-actions"><button type="button" disabled={busy||!count} onClick={()=>onChooseBatch(captures,false)}>Tout décocher</button></span>
    <span role="status">{count} / {captures.length} fiche(s) sélectionnée(s)</span>
  </div>;
}
type Props={jobs:CloudJob[];busy:boolean;onRemove:(ids?:string[])=>void;renderJob:(job:CloudJob,selection:ReactNode,remove:ReactNode)=>ReactNode};
export default function CloudJobHistory({jobs,busy,onRemove,renderJob}:Props){
  const [selected,setSelected]=useState<Record<string,boolean>>({});
  const [showAll,setShowAll]=useState(false);
  const visible=showAll?jobs:jobs.slice(0,3),removable=visible.filter(canRemoveHistory),selectedJobs=jobs.filter(j=>canRemoveHistory(j)&&selected[j.id]);
  const visibleSelected=removable.filter(j=>selected[j.id]);
  return <section className="cloud-browser-history" aria-label="Tâches récentes">
    <div className="cloud-browser-history-heading"><h2><History size={19}/> Tâches récentes</h2>
      <div className="cloud-browser-job-actions">
        <button type="button" disabled={busy||!jobs.length} onClick={()=>onRemove()}>Effacer l’historique terminé</button>
        {jobs.length>3&&<button type="button" onClick={()=>setShowAll(value=>!value)}>{showAll?'Réduire':'Voir tout l’historique ('+jobs.length+')'} <ArrowRight size={15}/></button>}
      </div>
    </div>
    {(!!removable.length||!!selectedJobs.length)&&<div className="cloud-browser-job-actions mb-3">
      <BatchCheckbox label="Sélectionner les recherches terminées affichées" checked={!!removable.length&&visibleSelected.length===removable.length} mixed={visibleSelected.length>0&&visibleSelected.length<removable.length} disabled={busy||!removable.length} onChange={value=>setSelected(current=>({...current,...Object.fromEntries(removable.map(j=>[j.id,value]))}))}/>
      <button type="button" disabled={busy||!selectedJobs.length} onClick={()=>onRemove(selectedJobs.map(j=>j.id))}>Supprimer la sélection ({selectedJobs.length})</button>
    </div>}
    <p className="text-xs mb-3" style={{color:'var(--text-muted)'}}>Supprimer une recherche efface ses résultats non importés. Les prospects importés, leurs activités et vos profils restent conservés. Annulez d’abord les tâches en cours ou en attente.</p>
    {jobs.length?<div className="cloud-browser-history-grid">{visible.map(job=>renderJob(job,
      canRemoveHistory(job)?<input type="checkbox" aria-label={'Sélectionner la recherche '+job.query+' pour suppression'} checked={!!selected[job.id]} disabled={busy} onChange={e=>setSelected(v=>({...v,[job.id]:e.target.checked}))}/>:null,
      canRemoveHistory(job)?<button type="button" disabled={busy} onClick={()=>onRemove([job.id])}>Supprimer la tâche</button>:null,
    ))}</div>:<div className="cloud-browser-history-empty"><Clock3 size={22}/> Aucune tâche cloud lancée pour le moment.</div>}
  </section>;
}
