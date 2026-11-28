export const prospectFieldLabels:Record<string,string>={company:'Nom affiché',siren:'SIREN',siret:'SIRET',
  address:'Adresse',postalCode:'Code postal',city:'Ville',phone:'Téléphone',email:'Email',website:'Site web',
  linkedinUrl:'LinkedIn',apeCode:'Code APE / NAF',nafLabel:'Secteur d’activité',nafVersion:'Nomenclature'};
export type FieldChanges=Record<string,{before:unknown;after:unknown}>;
const readable=(value:unknown):string=>value==null || value===''?'Non renseigné':Array.isArray(value)?value.map(readable).join(' · '):typeof value==='object'?JSON.stringify(value):String(value);
export function changeDescription(source:string,sourceUrl:string|null,changes:FieldChanges,note:string,capturedAt?:string){
  return [note,...Object.entries(changes).map(([field,c])=>`${prospectFieldLabels[field]||field} : ${readable(c.before)} → ${readable(c.after)}`),
    `Source : ${source}`,sourceUrl?`Lien : ${sourceUrl}`:null,capturedAt?`Données relevées : ${capturedAt}`:null,
    `Enregistré : ${new Date().toISOString()}`].filter(Boolean).join('\n');
}
