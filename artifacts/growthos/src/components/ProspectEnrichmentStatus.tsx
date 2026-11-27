import {Link} from 'wouter';
import {Loader2,Database,ExternalLink} from 'lucide-react';
export type EnrichmentRun={id:string;status:string;updated_at:string;steps:Record<string,{label:string;status:string;message?:string;jobId?:string;profileId?:string;filled?:string[]}>;summary:{sourcesDone:number;sourcesTotal:number;fields:string[];conflicts:number;interventions:number}};
const labels:Record<string,string>={pending:'En attente',collecting:'Recherche en cours',completed:'Correspondance confirmée',empty:'Aucun résultat confirmé',skipped:'Non disponible',needs_review:'À vérifier',awaiting_user:'Intervention requise',failed:'Indisponible',cancelled:'Annulée'};
export function ProspectEnrichmentStatus({run,prospectId}:{run:EnrichmentRun|null;prospectId:string}){
  if(!run)return null;
  const active=['queued','running'].includes(run.status);
  return <section className="atlas-360-detail-module rounded-2xl border p-4 space-y-3" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}} aria-live="polite">
    <h2 className="font-semibold flex gap-2 items-center">{active?<Loader2 size={17} className="animate-spin"/>:<Database size={17}/>} Enrichissement automatique multisource</h2>
    <p>{active?'Recherche, contrôle de l’identité et comparaison des sources en arrière-plan…':run.summary.fields.length?`${run.summary.fields.length} champ(s) mis à jour · ${run.summary.sourcesDone} source(s) concordante(s).`:run.summary.sourcesDone?'Sources concordantes consultées. Consultez les données détaillées et l’historique de la fiche.':'Aucune nouvelle donnée confirmée pour ce prospect.'}</p>
    {!!run.summary.conflicts&&<p>{run.summary.conflicts} désaccord(s) conservé(s) pour vérification.</p>}
    <details open={active}><summary className="cursor-pointer text-sm">Sources consultées et bilan</summary>
      <ul className="space-y-2 mt-3">{['entreprises','website','google_maps','pagesjaunes','insee','societe_com','pappers','bodacc','google_search','bing'].filter(source=>run.steps[source]).map(source=>[source,run.steps[source]] as const).map(([source,step])=><li key={source} className="text-sm border-b pb-2" style={{borderColor:'var(--card-border)'}}>
        <strong>{step.label}</strong> · {source==='website'&&step.status==='completed'?'Site renseigné consulté':labels[step.status]||step.status}
        {step.message&&<p style={{color:'var(--text-secondary)'}}>{step.message}</p>}
        {!active&&step.jobId&&['needs_review','awaiting_user','failed'].includes(step.status)&&<Link className="underline inline-flex gap-1 items-center" to={'/navigateur?'+new URLSearchParams({source,prospectId,profileId:step.profileId||'',jobId:step.jobId}).toString()}>Vérifier cette source <ExternalLink size={12}/></Link>}
      </li>)}</ul>
    </details>
    <small style={{color:'var(--text-muted)'}}>Les champs concordants sont complétés. Les valeurs divergentes sont signalées, avec provenance et historique dans l’activité du prospect.</small>
  </section>;
}
