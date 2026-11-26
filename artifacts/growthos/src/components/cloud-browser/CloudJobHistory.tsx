import {useRef,useEffect,useState} from 'react';
import {Link} from 'wouter';

export type CloudJob={id:string;profile_id:string;prospect_id:string|null;mode:'enrich'|'discover';query:string;area?:string;status:string;error:string|null;result:{message?:string;captures?:any[];drafts?:any[];applied?:{filled:string[];conflicts:number}}};
export type CaptureSelection=Record<string,boolean>;
const labels:Record<string,string>={queued:'En file',running:'Recherche et collecte en cours',awaiting_user:'Intervention dans le navigateur',needs_review:'Rapprochement à vérifier',completed:'Terminé',failed:'Échec',cancelled:'Annulé'};
export const canRemoveHistory=(job:CloudJob)=>['completed','failed','cancelled'].includes(job.status);
export function selectCaptureBatch(current:CaptureSelection,captures:{id:string}[],checked:boolean):CaptureSelection{
  const next={...current};for(const capture of captures)if(checked)next[capture.id]=true;else delete next[capture.id];return next;
}
function BatchCheckbox({checked,mixed,onChange,label,disabled=false}:{checked:boolean;mixed:boolean;onChange:(value:boolean)=>void;label:string;disabled?:boolean}){
  const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(input.current)input.current.indeterminate=mixed;},[mixed]);
  return <label className="inline-flex items-center gap-2 text-sm"><input ref={input} type="checkbox" aria-label={label} aria-checked={mixed?'mixed':checked} checked={checked} disabled={disabled} onChange={e=>onChange(e.target.checked)}/>{label}</label>;
}
type Props={jobs:CloudJob[];busy:boolean;chosen:CaptureSelection;onChoose:(captureId:string,checked:boolean)=>void;onChooseBatch:(captures:{id:string}[],checked:boolean)=>void;onImport:(job:CloudJob)=>void;onRemove:(ids?:string[])=>void;onProfile:(job:CloudJob)=>void;onRetry:(job:CloudJob)=>void;onCancel:(job:CloudJob)=>void};
export default function CloudJobHistory({jobs,busy,chosen,onChoose,onChooseBatch,onImport,onRemove,onProfile,onRetry,onCancel}:Props){
  const [selected,setSelected]=useState<Record<string,boolean>>({});
  const removable=jobs.filter(canRemoveHistory),selectedJobs=removable.filter(j=>selected[j.id]);
  return <section className="cloud-job-history space-y-3">
    <div className="flex justify-between items-center flex-wrap gap-2"><h2 className="font-semibold">Tâches récentes</h2>
      <button className="border rounded p-2 text-sm" disabled={busy||!jobs.length} onClick={()=>onRemove()}>Effacer l’historique terminé</button></div>
    {!!removable.length&&<div className="flex items-center flex-wrap gap-3">
      <BatchCheckbox label="Sélectionner les recherches terminées affichées" checked={selectedJobs.length===removable.length} mixed={selectedJobs.length>0&&selectedJobs.length<removable.length} disabled={busy} onChange={value=>setSelected(Object.fromEntries(removable.map(j=>[j.id,value])))}/>
      <button className="border rounded p-2 text-sm" disabled={busy||!selectedJobs.length} onClick={()=>onRemove(selectedJobs.map(j=>j.id))}>Supprimer la sélection ({selectedJobs.length})</button>
    </div>}
    <p className="text-xs" style={{color:'var(--text-muted)'}}>Supprimer une recherche efface ses résultats non importés. Les prospects importés, leurs activités et vos profils restent conservés. Annulez d’abord les tâches en cours ou en attente.</p>
    {!jobs.length&&<p className="text-sm">Aucune tâche cloud dans l’historique.</p>}
    {jobs.map(job=>{
      const captures=job.mode==='discover'&&job.status==='completed'?(job.result.captures||[]):[];
      const count=captures.filter(c=>chosen[c.id]).length;
      return <article key={job.id} className="border rounded-xl p-4 space-y-2" style={{background:'var(--card-bg)'}}>
        <div className="flex gap-3 flex-wrap justify-between"><div className="flex items-center gap-2">
          {canRemoveHistory(job)&&<input type="checkbox" aria-label={'Sélectionner la recherche '+job.query+' pour suppression'} checked={!!selected[job.id]} disabled={busy} onChange={e=>setSelected(v=>({...v,[job.id]:e.target.checked}))}/>}
          <strong>{job.query}</strong>{job.area&&<span className="text-sm" style={{color:'var(--text-muted)'}}>· {job.area}</span>}
        </div><span>{labels[job.status]||job.status}</span></div>
        {(job.error||job.result.message)&&<p className="text-sm">{job.error||job.result.message}</p>}
        {job.result.applied&&<p className="text-sm">{job.result.applied.filled.length} champ(s) mis à jour, {job.result.applied.conflicts} désaccord(s) à vérifier.</p>}
        {job.prospect_id&&<Link className="underline text-teal-700" to={'/prospects/'+job.prospect_id}>Voir le prospect et son historique</Link>}
        <div className="flex flex-wrap gap-2">
          <button className="border rounded p-2 text-sm" disabled={busy} onClick={()=>onProfile(job)}>Voir son profil de navigation</button>
          {['awaiting_user','needs_review','failed','cancelled'].includes(job.status)&&<button className="border rounded p-2 text-sm" disabled={busy} onClick={()=>onRetry(job)}>{job.status==='cancelled'?'Reprendre la tâche annulée':'Reprendre la tâche'}</button>}
          {['queued','running','awaiting_user','needs_review','failed'].includes(job.status)&&<button className="border rounded p-2 text-sm" disabled={busy} onClick={()=>onCancel(job)}>Annuler la tâche</button>}
          {canRemoveHistory(job)&&<button className="border rounded p-2 text-sm" disabled={busy} onClick={()=>onRemove([job.id])}>Supprimer cette recherche</button>}
        </div>
        {!!captures.length&&<div className="space-y-2">
          <div className="flex gap-3 items-center flex-wrap">
            <BatchCheckbox label="Tout cocher dans ce lot" checked={count===captures.length} mixed={count>0&&count<captures.length} disabled={busy} onChange={value=>onChooseBatch(captures,value)}/>
            <button className="border rounded p-2 text-sm" disabled={busy||count===0} onClick={()=>onChooseBatch(captures,false)}>Tout décocher</button>
            <span className="text-sm" role="status">{count} / {captures.length} fiche(s) sélectionnée(s)</span>
          </div>
          {captures.map(c=><label key={c.id} className="block text-sm border rounded p-2"><input type="checkbox" disabled={busy} checked={!!chosen[c.id]} onChange={e=>onChoose(c.id,e.target.checked)}/> <strong>{c.company}</strong> · {[c.address,c.city,c.phone].filter(Boolean).join(' · ')}</label>)}
          <button className="border rounded p-2" disabled={busy||!count} onClick={()=>onImport(job)}>Importer les fiches sélectionnées ({count})</button>
        </div>}
        {!!job.result.drafts?.length&&<p className="text-sm">{job.result.drafts.length} fiche(s) partielle(s) conservée(s) dans cette tâche. Elles ne sont pas importées sans vérification.</p>}
      </article>;
    })}
  </section>;
}
