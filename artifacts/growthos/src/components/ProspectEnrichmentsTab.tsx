import {Database,Loader2} from 'lucide-react';
import {ProspectEnrichmentStatus,type EnrichmentRun} from './ProspectEnrichmentStatus';
import {ProspectPublicRecords} from './ProspectPublicRecords';
import {SourceLogo} from './atlas/ProspectLogos';
type Observation={captureId:string;source:string;sourceUrl?:string|null;capturedAt:string;fieldsFilled?:string[]};
export function ProspectEnrichmentsTab({prospectId,run,busy,onEnrich,onOpenSources,observations,activities,sourceDetails}:{
  prospectId:string;run:EnrichmentRun|null;busy:boolean;onEnrich:()=>void;onOpenSources:()=>void;observations:Observation[];activities:any[];sourceDetails?:Record<string,any>;
}){
  const updates=activities.filter(a=>a.type==='data_update'&&String(a.title||'').startsWith('Enrichissement'));
  return <section className="atlas-360-detail-module rounded-2xl border p-5 space-y-4" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}} aria-label="Enrichissements du prospect">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold flex items-center gap-2"><Database size={18}/> Enrichissements</h2><p className="text-sm" style={{color:'var(--text-secondary)'}}>Lancement, sources consultées, données confirmées et historique de cette fiche.</p></div>
      <button type="button" disabled={busy} onClick={onEnrich} className="atlas-360-link-button atlas-360-link-button-primary">{busy?<Loader2 size={16} className="animate-spin"/>:<Database size={16}/>} {busy?'Enrichissement en cours…':'Enrichir automatiquement'}</button></div>
    <ProspectEnrichmentStatus run={run} prospectId={prospectId}/>
    {!run&&<p className="text-sm">Aucun enrichissement automatique lancé pour ce prospect.</p>}
    <button type="button" onClick={onOpenSources} className="atlas-360-link-button atlas-360-link-button-secondary">Consulter toutes les données et les désaccords</button>
    <ProspectPublicRecords details={sourceDetails}/>
    <details open><summary className="cursor-pointer font-medium">Historique des captures ({observations.length})</summary>
      {!observations.length&&<p className="text-sm my-2">Aucune capture enregistrée.</p>}
      <div className="atlas-360-enrichment-history-list">{[...observations].reverse().map((entry,index)=><div key={entry.captureId+'_'+index}><SourceLogo source={entry.source} size="sm"/><strong>{entry.source.replaceAll('_',' ')}</strong><time>{new Date(entry.capturedAt).toLocaleString('fr-FR')}</time>
        {!!entry.fieldsFilled?.length&&<p>Champs mis à jour : {entry.fieldsFilled.join(', ')}</p>}
        {entry.sourceUrl&&<a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer">Consulter la source</a>}</div>)}</div>
    </details>
    <details open><summary className="cursor-pointer font-medium">Modifications tracées ({updates.length})</summary>
      {!updates.length&&<p className="text-sm my-2">Aucune modification d’enrichissement enregistrée.</p>}
      <div className="space-y-3 mt-3">{updates.map(a=><article key={a.id} className="border-b pb-3"><strong className="text-sm">{a.title}</strong><time className="block text-xs">{new Date(a.doneAt||a.createdAt||a.created_at).toLocaleString('fr-FR')}</time><p className="text-sm whitespace-pre-wrap">{a.description}</p></article>)}</div>
    </details>
  </section>;
}
