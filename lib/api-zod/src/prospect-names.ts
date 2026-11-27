const record=(v:unknown):Record<string,any>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,any>:{};
const text=(v:unknown)=>typeof v==='string'?v.trim():'';
export const distinctBusinessNames=(values:unknown[]):string[]=>[...new Map(values.flatMap(v=>Array.isArray(v)?v:[v]).map(text).filter(Boolean).map(v=>[v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),v])).values()].slice(0,30);
export function prospectBusinessNames(p:{company?:string|null;siren?:string|null;siret?:string|null;sourceDetails?:unknown}){
  const details=record(p.sourceDetails),identity=record(details.identity),known=p.siren||p.siret?.slice(0,9);
  const bound=!identity.siren||identity.siren===known;
  const legalName=bound?text(identity.legalName):'';
  return {displayName:text(p.company),legalName,tradeNames:bound?distinctBusinessNames(identity.tradeNames||[]):[],previousLegalNames:bound?distinctBusinessNames(identity.previousLegalNames||[]):[]};
}
export function businessIdentity(previous:unknown,input:{legalName:string;tradeNames?:string[];siren?:string|null;source:string;sourceUrl?:string|null;capturedAt:string}){
  const old=record(previous),same=!old.siren||old.siren===input.siren;
  const proposed=text(input.legalName),prior=same?text(old.legalName):'';
  const keepOfficial=!!(prior&&old.source==='entreprises'&&input.source!=='entreprises');
  const legalName=keepOfficial?prior:proposed;
  return {...(same&&old.displayNameHistory?{displayNameHistory:old.displayNameHistory}:{}),legalName,tradeNames:distinctBusinessNames([...(same?old.tradeNames||[]:[]),...(input.tradeNames||[])]).filter(v=>v.toLocaleLowerCase('fr-FR')!==legalName.toLocaleLowerCase('fr-FR')),
    previousLegalNames:distinctBusinessNames([...(same?old.previousLegalNames||[]:[]),...(prior&&prior!==legalName?[prior]:[])]),siren:input.siren||null,source:keepOfficial?old.source:input.source,sourceUrl:keepOfficial?old.sourceUrl:input.sourceUrl||null,capturedAt:keepOfficial?old.capturedAt:input.capturedAt};
}
/** Only propose an undo when a recorded rename ends at the current CRM title. */
export function previousProspectDisplayName(company:string|null|undefined,activities:{type?:string|null;description?:string|null}[]):string|null{
  for(const activity of activities){
    if(activity.type!=='data_update'||!/Enrichissement automatique|Veille activée/.test(activity.description||''))continue;
    for(const line of (activity.description||'').split('\n')){
      const match=line.match(/^(?:Fiche · )?(?:Raison sociale|Nom affiché) : (.+) → (.+)$/);
      if(match&&match[2]===company&&match[1]!==company&&match[1]!=='Non renseigné'&&match[1].length<=160)return match[1];
    }
  }
  return null;
}
