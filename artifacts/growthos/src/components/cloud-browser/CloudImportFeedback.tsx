import {Link} from 'wouter';
export type CaptureImportState={captureId:string;status:'imported'|'enriched'|'already_present'|'needs_review'|'failed'|'missing';prospectId?:string;message?:string;at?:string};
type Capture={id:string;company?:string};
export const isCloudCaptureHandled=(state?:CaptureImportState)=>!!state&&['imported','enriched','already_present'].includes(state.status);
export function pendingCloudCaptures<T extends Capture>(captures:T[],imports:Record<string,CaptureImportState>={}){return captures.filter(c=>!isCloudCaptureHandled(imports[c.id]));}
const labels:Record<CaptureImportState['status'],string>={imported:'Importée dans le CRM',enriched:'Fiche CRM enrichie',already_present:'Déjà présente dans le CRM',needs_review:'À vérifier dans le CRM',failed:'Import non effectué',missing:'Fiche CRM supprimée · à réimporter'};
export function CaptureImportBadge({state}:{state?:CaptureImportState}){
  return state?<small role="status"><strong>{labels[state.status]}</strong>{state.message?' · '+state.message:''}</small>:null;
}
export default function CloudImportFeedback({captures,imports={}}:{captures:Capture[];imports?:Record<string,CaptureImportState>}){
  const handled=captures.filter(c=>isCloudCaptureHandled(imports[c.id]));
  const count=(status:CaptureImportState['status'])=>captures.filter(c=>imports[c.id]?.status===status).length;
  const imported=count('imported'),enriched=count('enriched'),existing=count('already_present'),review=count('needs_review'),failed=count('failed')+count('missing');
  if(!handled.length&&!review&&!failed)return null;
  return <>
    <div className="cloud-browser-results-note" role="status" aria-live="polite">
      <span>{[imported?`${imported} importée(s)`:null,enriched?`${enriched} enrichie(s)`:null,existing?`${existing} déjà présente(s) dans le CRM`:null,review?`${review} à vérifier`:null,failed?`${failed} restant à traiter`:null].filter(Boolean).join(' · ')}.
        {' '}{captures.length-handled.length} fiche(s) restante(s) à traiter.</span>
    </div>
    {!!handled.length&&<details className="cloud-browser-results-note" style={{display:'block'}}>
      <summary>Fiches traitées ({handled.length}) · consulter dans le CRM</summary>
      <div className="space-y-2 mt-2">{handled.map(c=><div key={c.id} className="cloud-browser-result-row">
        <span className="cloud-browser-result-info"><strong>{c.company||'Entreprise'}</strong><CaptureImportBadge state={imports[c.id]}/>
          {imports[c.id].prospectId&&<Link to={'/prospects/'+imports[c.id].prospectId}>Ouvrir la fiche CRM</Link>}
        </span>
      </div>)}</div>
    </details>}
  </>;
}
