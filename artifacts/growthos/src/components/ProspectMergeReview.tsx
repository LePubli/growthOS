import {useEffect,useRef,useState} from 'react';
import {useLocation} from 'wouter';
import api from '@/lib/api-client';
import './cloud-browser/source-review.css';
type Profile={id:string;company:string;siret:string|null;siren:string|null;address:string|null;updatedAt:string;fields:Record<string,string|null>};
type Preview={mergeKey:string;proofDigest:string;current:Profile;other:Profile;contactCounts:number[];activities:{prospect_id:string;count:number}[]};
const labels:Record<string,string>={company:'Nom affiché',firstName:'Prénom',lastName:'Nom',email:'Email',phone:'Téléphone',address:'Adresse',city:'Ville',postalCode:'Code postal',website:'Site web',jobTitle:'Fonction',linkedinUrl:'LinkedIn',apeCode:'Code APE',nafLabel:'Activité',nafVersion:'Version NAF',siret:'SIRET',siren:'SIREN',notes:'Notes',isStarred:'Favori'};
export function ProspectMergeReview({prospectId,otherId,jobId,runId,captureIndex=0,source,onClose}:{prospectId:string;otherId:string;jobId?:string;runId?:string;captureIndex?:number;source?:string;onClose:()=>void}){
 const [,navigate]=useLocation(),dialog=useRef<HTMLElement|null>(null);
 const [preview,setPreview]=useState<Preview|null>(null),[revision,setRevision]=useState(0),[survivor,setSurvivor]=useState(prospectId),[replace,setReplace]=useState<string[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const context={otherId,...(jobId?{jobId}:{}),...(runId?{runId}:{}),captureIndex};
 useEffect(()=>{let alive=true;setPreview(null);setError('');void api.post<Preview>('/prospects/'+prospectId+'/merge-preview',context).then(p=>{if(alive){setPreview(p);setReplace([]);}}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[prospectId,otherId,jobId,runId,captureIndex,revision]);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.focus();return()=>{if(previous?.isConnected)previous.focus();};},[]);
 async function merge(){if(!preview||busy)return;setBusy(true);setError('');try{const result=await api.post<{prospectId:string;mergeId:string}>('/prospects/'+prospectId+'/merge',{...context,mergeKey:preview.mergeKey,proofDigest:preview.proofDigest,survivorId:survivor,confirmed:true,expectedVersions:{[preview.current.id]:preview.current.updatedAt,[preview.other.id]:preview.other.updatedAt},replaceFields:replace});
   navigate(jobId?'/navigateur?'+new URLSearchParams({source:source||'societe_com',prospectId:result.prospectId,jobId,merged:result.mergeId}).toString():'/prospects/'+result.prospectId+'?view=enrichments&merged='+result.mergeId,{replace:true});
 }catch(e:any){setError(e.message+(e.data?.traceId?' Référence diagnostic : '+e.data.traceId:''));}finally{setBusy(false);}}
 const keep=preview&&(survivor===preview.current.id?preview.current:preview.other),donor=preview&&(survivor===preview.current.id?preview.other:preview.current);
 return <section ref={dialog} tabIndex={-1} role="dialog" aria-label="Comparer et fusionner les doublons" className="cloud-capture-review rounded-xl border p-4 space-y-3" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
  <h3>Comparer et fusionner les doublons</h3>
  {error&&<div role="alert"><p>{error}</p><button disabled={busy} onClick={()=>setRevision(n=>n+1)}>Actualiser les fiches</button></div>}
  {!preview&&!error&&<p>Lecture des deux dossiers…</p>}
  {preview&&<><p>Ce SIRET est déjà rattaché à une fiche CRM. Choisissez la fiche à conserver. Les champs vides seront complétés ; les autres coordonnées, les contacts, les sources et l’historique seront conservés. Les valeurs renseignées de la fiche choisie restent prioritaires, sauf remplacements cochés.</p>
   <fieldset disabled={busy}><legend>Fiche à conserver</legend>{[preview.current,preview.other].map((p,i)=><div key={p.id}><label><input type="radio" name="merge-survivor" value={p.id} checked={survivor===p.id} onChange={()=>{setSurvivor(p.id);setReplace([]);}}/>{p.company||'Sans nom'} · {p.siret||'SIRET à compléter'}</label><p>{p.address||'Adresse à compléter'} · {preview.contactCounts[i]} coordonnée(s) · {preview.activities.find(a=>a.prospect_id===p.id)?.count||0} activité(s)</p><a href={'/prospects/'+p.id} target="_blank" rel="noreferrer">Consulter cette fiche</a></div>)}</fieldset>
   <table><thead><tr><th>Champ</th><th>Fiche conservée</th><th>Autre fiche</th><th>Choix</th></tr></thead><tbody>{Object.keys(keep!.fields).filter(f=>keep!.fields[f]||donor!.fields[f]).map(f=><tr key={f}><td data-label="Champ">{labels[f]}</td><td data-label="Fiche conservée">{keep!.fields[f]||'À compléter'}</td><td data-label="Autre fiche">{donor!.fields[f]||'Non renseigné'}</td><td data-label="Choix">{keep!.fields[f]&&donor!.fields[f]&&keep!.fields[f]!==donor!.fields[f]?<label><input type="checkbox" checked={replace.includes(f)} onChange={e=>setReplace(v=>e.target.checked?[...v,f]:v.filter(x=>x!==f))}/>Utiliser l’autre valeur</label>:!keep!.fields[f]?'Sera complété':''}</td></tr>)}</tbody></table>
   <p>La fusion regroupe les deux dossiers dans la fiche choisie. Les deux états avant fusion sont archivés. Vous pourrez ensuite terminer la comparaison avec la source.</p>
   <button type="button" disabled={busy} className="atlas-360-link-button atlas-360-link-button-primary" onClick={()=>void merge()}>{busy?'Fusion en cours…':'Confirmer la fusion et continuer'}</button>
  </>}
  <button type="button" disabled={busy} className="atlas-360-link-button atlas-360-link-button-secondary" onClick={onClose}>Annuler</button>
 </section>;
}

export function ProspectMergeHistory({prospectId}:{prospectId:string}){
 const [entries,setEntries]=useState<any[]|null>(null),[error,setError]=useState('');
 async function load(){try{setEntries(await api.get<any[]>('/prospects/'+prospectId+'/merges'));setError('');}catch(e:any){setError(e.message);}}
 return <details className="cloud-capture-review" onToggle={e=>{if(e.currentTarget.open&&!entries)void load();}}><summary>Dossiers regroupés et états avant fusion</summary>
  {error&&<p role="alert">{error}<button onClick={()=>void load()}>Réessayer la lecture</button></p>}
  {entries?.map(entry=><article key={entry.id}><p>Fusion du {new Date(entry.createdAt).toLocaleString('fr-FR')}</p><dl>{Object.entries(entry.changes||{}).map(([key,value]:[string,any])=><div key={key}><dt>{labels[key]||key}</dt><dd>{String(value.before??'Non renseigné')} → {String(value.after??'Non renseigné')}</dd></div>)}</dl>{entry.profiles.map((p:any)=><details key={p.id}><summary>{p.company||'Sans nom'} · {p.siret||'SIRET non renseigné avant fusion'}</summary><dl>{Object.entries(p.fields||{}).filter(([,v])=>!!v).map(([key,value])=><div key={key}><dt>{labels[key]||key}</dt><dd>{String(value)}</dd></div>)}</dl><ul>{p.contacts?.map((c:any,i:number)=><li key={i}>{c.value}{c.sourceUrl&&<> · <a href={c.sourceUrl} target="_blank" rel="noreferrer">Preuve source</a></>}</li>)}</ul><ul>{p.people?.map((c:any,i:number)=><li key={i}>{c.name}{c.role?' · '+c.role:''}</li>)}</ul></details>)}<p>{entry.archivedMonitoring} état(s) de surveillance et {entry.archivedEnrichments} donnée(s) d’enrichissement archivés.</p></article>)}
 </details>;
}
