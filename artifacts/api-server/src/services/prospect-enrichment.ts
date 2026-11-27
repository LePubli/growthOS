import {fetchBodaccPage,saveBodaccPage} from './bodacc';
import {randomUUID} from 'node:crypto';
import {db,pool,prospectsTable} from '@workspace/db';
import {and,eq,sql} from 'drizzle-orm';
import {fetchDirectory} from './official-directory';
import {uniqueIdentityMatch,captureIdentityMatches} from '../lib/enrichment-identity';
import {mergeProspectCapture} from '../routes/v1/sourcing';
import {cloudConfigured,CloudBrowserError} from './cloud-browser';
import {providerKeysService} from '../lib/provider-keys/ProviderKeysService';

type Step={status:string;label:string;message?:string;jobId?:string;profileId?:string;filled?:string[];conflicts?:number;offset?:number};
const definitions=[['entreprises','Annuaire des Entreprises · données INSEE'],['google_maps','Google Maps'],['pagesjaunes','PagesJaunes'],['insee','INSEE Sirene · accès direct'],['societe_com','Societe.com'],['pappers','Pappers · données publiques'],['bodacc','BODACC · annonces officielles'],['google_search','Google Search'],['bing','Bing']] as const;
const active=(status:string)=>['queued','running'].includes(status);
const normalizedProspect=(p:any)=>({...p,postalCode:p.postal_code,sourceDetails:p.source_details,apeCode:p.ape_code,nafLabel:p.naf_label,nafVersion:p.naf_version});
async function getProspect(tenant:string,id:string){const q=await pool.query('SELECT * FROM prospects WHERE tenant_id=$1 AND id=$2',[tenant,id]);if(!q.rows[0])throw new CloudBrowserError(404,'Prospect introuvable.');return q.rows[0];}
export function enrichmentSummary(job:any){
  const steps=Object.values(job.steps||{}) as Step[];
  return {...job,summary:{sourcesDone:steps.filter(s=>s.status==='completed').length,sourcesTotal:steps.length,
    fields:[...new Set(steps.flatMap(s=>s.filled||[]))],conflicts:steps.reduce((n,s)=>n+(s.conflicts||0),0),
    interventions:steps.filter(s=>s.status==='needs_review'||s.status==='awaiting_user').length}};
}
export async function startProspectEnrichment(tenant:string,user:string,id:string){
  const p=await getProspect(tenant,id);
  if(!p.company&&!p.siren&&!p.siret)throw new CloudBrowserError(422,'Renseignez le nom de l’entreprise ou un identifiant légal.');
  const q=await pool.query(`INSERT INTO prospect_enrichment_jobs(tenant_id,created_by,prospect_id,steps) VALUES($1,$2,$3,$4)
    ON CONFLICT(tenant_id,prospect_id) WHERE status IN ('queued','running') DO UPDATE SET updated_at=prospect_enrichment_jobs.updated_at RETURNING *`,
    [tenant,user,id,JSON.stringify(Object.fromEntries(definitions.map(([source,label])=>[source,{label,status:'pending'}])))]);
  return enrichmentSummary(q.rows[0]);
}
export async function latestProspectEnrichment(tenant:string,id:string){
  await getProspect(tenant,id);const q=await pool.query('SELECT * FROM prospect_enrichment_jobs WHERE tenant_id=$1 AND prospect_id=$2 ORDER BY created_at DESC LIMIT 1',[tenant,id]);
  return q.rows[0]?enrichmentSummary(q.rows[0]):null;
}
async function mergeOfficial(job:any,candidate:any){
  return db.transaction(async tx=>{
    const locked=await tx.execute(sql`SELECT status,lease FROM prospect_enrichment_jobs WHERE id=${job.id} AND tenant_id=${job.tenant_id} FOR UPDATE`);
    if(locked.rows[0]?.status!=='running'||locked.rows[0]?.lease!==job.lease)throw Error('Tâche interrompue.');
    const [p]=await tx.select().from(prospectsTable).where(and(eq(prospectsTable.id,job.prospect_id),eq(prospectsTable.tenantId,job.tenant_id))).for('update');
    if(!p||!captureIdentityMatches(p,candidate))throw Error('Identité non confirmée.');
    return mergeProspectCapture(p,{...candidate,id:'automatic_'+job.id+'_'+candidate.source,capturedAt:Date.now(),
      sourceDetails:{...(candidate.apeScope&&(!p.apeCode||p.apeCode===candidate.apeCode||candidate.apeScope==='etablissement')?{annuaire:{apeScope:candidate.apeScope}}:{}),[candidate.source]:{apeScope:candidate.apeScope,snapshot:candidate.snapshot,sourceUrl:candidate.sourceUrl,capturedAt:new Date().toISOString()}},targetedIdentity:false},false,job.tenant_id,tx,job.created_by,
      p.siret&&p.siret===candidate.siret?['address','postalCode','city',...(candidate.apeScope==='etablissement'?['apeCode','nafLabel','nafVersion'] as const:[])]:[]);
  });
}
async function officialStep(job:any,p:any):Promise<Step>{
  const data=await fetchDirectory(p.siret||p.siren||p.company,p.postal_code||p.city||'');
  const candidate=uniqueIdentityMatch(normalizedProspect(p),data.candidates);
  if(!candidate)return {label:job.steps.entreprises.label,status:data.candidates.length?'needs_review':'empty',message:data.candidates.length?'Aucun établissement unique confirmé par les identifiants ou le nom et les coordonnées. Aucune donnée appliquée.':'Aucune correspondance officielle.'};
  const merged=await mergeOfficial(job,candidate);
  return {label:job.steps.entreprises.label,status:'completed',filled:merged.filled,conflicts:merged.conflicts,message:'Identité officielle confirmée · '+candidate.siret+' · '+(candidate.snapshot?.fields?.['État de l’établissement']==='Fermé'?'Attention : cet établissement est fermé. Le siège actuel reste distinct. ':'')+'données issues notamment du répertoire INSEE.'};
}
async function inseeStep(job:any,p:any):Promise<Step>{
  const label=job.steps.insee.label;
  const key=await providerKeysService.getKeyWithFallback(job.tenant_id,'insee').catch(()=>null);
  if(!key?.apiKey)return {label,status:'skipped',message:'Accès direct non configuré. Les données INSEE publiques sont consultées via l’Annuaire officiel.'};
  if(!/^\d{14}$/.test(p.siret||''))return {label,status:'skipped',message:'Un SIRET confirmé est nécessaire pour la vérification directe.'};
  const url=process.env.GROWTHOS_SMOKE_TEST==='true'&&process.env.INSEE_TEST_URL?new URL(process.env.INSEE_TEST_URL):new URL('https://api.insee.fr/api-sirene/3.11/siret/'+p.siret);
  const response=await fetch(url,{headers:{'X-INSEE-Api-Key-Integration':key.apiKey,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error('INSEE Sirene : HTTP '+response.status);
  const body=await response.text();if(body.length>1500000)throw Error('Réponse INSEE trop volumineuse');
  const data=JSON.parse(body).etablissement;if(data?.siret!==p.siret)throw Error('La réponse INSEE ne confirme pas le SIRET.');
  const address=data.adresseEtablissement||{},period=data.periodesEtablissement?.find((v:any)=>!v.dateFin)||data.periodesEtablissement?.[0]||{};
  const candidate={source:'insee',siren:data.siren,siret:data.siret,company:p.company,city:address.libelleCommuneEtablissement,codePostal:address.codePostalEtablissement,
    address:[address.numeroVoieEtablissement,address.typeVoieEtablissement,address.libelleVoieEtablissement,address.codePostalEtablissement,address.libelleCommuneEtablissement].filter(Boolean).join(' '),
    apeCode:period.activitePrincipaleEtablissement,apeScope:'etablissement',nafVersion:period.nomenclatureActivitePrincipaleEtablissement,sourceUrl:'https://annuaire-entreprises.data.gouv.fr/etablissement/'+p.siret,
    snapshot:{siret:data.siret,etat:period.etatAdministratifEtablissement,dateMiseAJour:data.dateDernierTraitementEtablissement}};
  const merged=await mergeOfficial(job,candidate);return {label,status:'completed',filled:merged.filled,conflicts:merged.conflicts,message:'SIRET confirmé directement par l’INSEE.'};
}
async function bodaccStep(job:any,p:any,step:Step):Promise<Step>{
  const siren=p.siren||p.siret?.slice(0,9);
  if(p.siren&&p.siret&&!p.siret.startsWith(p.siren))return {...step,status:'needs_review',message:'Le SIREN et le SIRET du prospect diffèrent. Corrigez l’identité avant de rattacher les annonces.'};
  if(!/^\d{9}$/.test(siren||''))return {...step,status:'skipped',message:'Un SIREN confirmé est nécessaire pour rattacher les annonces sans confusion.'};
  const page=await fetchBodaccPage(siren,step.offset||0),saved=await saveBodaccPage(job,siren,page);
  return {...step,status:page.hasMore?'collecting':saved.count?'completed':'empty',offset:page.offset,filled:saved.changed?[...new Set([...(step.filled||[]),'annoncesBodacc'])]:step.filled||[],message:saved.count+' annonce(s) officielles rattachées au SIREN '+siren+(page.hasMore?' · historique en cours de lecture.':'. Les annonces historiques ne valent pas statut actuel.')};
}
async function browserStep(job:any,p:any,source:string,step:Step):Promise<Step>{
  if(step.jobId){
    const q=await pool.query('SELECT * FROM cloud_browser_jobs WHERE id=$1 AND tenant_id=$2',[step.jobId,job.tenant_id]);const child=q.rows[0];
    if(!child)return {...step,status:'failed',message:'La tâche source a été supprimée.'};
    if(active(child.status))return {...step,status:'collecting',message:'Recherche et comparaison en cours…'};
    return {...step,status:child.result?.applied?'completed':child.status==='completed'?'empty':child.status,
      filled:child.result?.applied?.filled||[],conflicts:child.result?.applied?.conflicts||0,
      message:child.result?.applied?'Données concordantes comparées et fiche mise à jour.':child.result?.message||child.error||'Aucune donnée confirmée.'};
  }
  if(!cloudConfigured())return {...step,status:'skipped',message:'Navigateur cloud indisponible dans la configuration.'};
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const lock=await client.query('SELECT status,lease FROM prospect_enrichment_jobs WHERE id=$1 AND tenant_id=$2 FOR UPDATE',[job.id,job.tenant_id]);
    if(lock.rows[0]?.status!=='running'||lock.rows[0]?.lease!==job.lease)throw Error('Tâche interrompue.');
    let profile=(await client.query(`SELECT * FROM cloud_browser_profiles WHERE tenant_id=$1 AND created_by=$2 AND source=$3 AND deleted_at IS NULL ORDER BY CASE mode WHEN 'account' THEN 0 ELSE 1 END,created_at DESC LIMIT 1`,[job.tenant_id,job.created_by,source])).rows[0];
    if(!profile)profile=(await client.query('INSERT INTO cloud_browser_profiles(tenant_id,created_by,source,label) VALUES($1,$2,$3,$4) RETURNING *',[job.tenant_id,job.created_by,source,step.label+' · automatique'])).rows[0];
    const query=['societe_com','pappers'].includes(source)?(p.siret||p.siren||p.company):p.company;
    if(!query) {await client.query('COMMIT');return {...step,status:'skipped',message:'Nom d’entreprise absent.'};}
    const child=(await client.query(`INSERT INTO cloud_browser_jobs(tenant_id,created_by,profile_id,prospect_id,mode,query,area,result) VALUES($1,$2,$3,$4,'enrich',$5,$6,$7) RETURNING id`,[job.tenant_id,job.created_by,profile.id,p.id,String(query).slice(0,160),p.city||'',JSON.stringify({enrichmentRunId:job.id})])).rows[0];
    const next={...step,status:'collecting',jobId:child.id,profileId:profile.id,message:'Recherche en arrière-plan…'};
    // Persist the child link in the same transaction: a restart cannot enqueue it twice.
    await client.query('UPDATE prospect_enrichment_jobs SET steps=jsonb_set(steps,ARRAY[$2]::text[],$3::jsonb) WHERE id=$1',[job.id,source,JSON.stringify(next)]);
    await client.query('COMMIT');return next;
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
export async function runProspectEnrichment(id:string){
  const lease=randomUUID();const claimed=await pool.query(`UPDATE prospect_enrichment_jobs SET status='running',lease=$2,lease_until=NOW()+INTERVAL '2 minutes',updated_at=NOW()
    WHERE id=$1 AND (status='queued' OR (status='running' AND lease_until<NOW())) RETURNING *`,[id,lease]);
  const job=claimed.rows[0];if(!job)return;
  const steps=job.steps as Record<string,Step>;
  try{
    const p=await getProspect(job.tenant_id,job.prospect_id);
    const source=definitions.map(([s])=>s).find(s=>['pending','collecting'].includes(steps[s]?.status));
    if(source){
      try{steps[source]=source==='entreprises'?await officialStep(job,p):source==='insee'?await inseeStep(job,p):source==='bodacc'?await bodaccStep(job,p,steps[source]):await browserStep(job,p,source,steps[source]);}
      catch{steps[source]={...steps[source],status:'failed',message:'Source indisponible ou identité non confirmée. Les autres sources continuent.'};}
    }
    const pending=Object.values(steps).some(s=>['pending','collecting'].includes(s.status));
    const completed=Object.values(steps).some(s=>s.status==='completed');
    const incomplete=Object.values(steps).some(s=>['failed','needs_review','awaiting_user'].includes(s.status));
    const status=pending?'queued':completed?(incomplete?'partial':'completed'):'needs_review';
    await pool.query("UPDATE prospect_enrichment_jobs SET steps=$3,status=$4,lease=NULL,lease_until=NULL,updated_at=NOW() WHERE id=$1 AND tenant_id=$2 AND lease=$5 AND status='running'",[id,job.tenant_id,JSON.stringify(steps),status,lease]);
  }catch{await pool.query("UPDATE prospect_enrichment_jobs SET status='failed',lease=NULL,lease_until=NULL,updated_at=NOW() WHERE id=$1 AND lease=$2 AND status='running'",[id,lease]);}
}
let ticking=false;
export async function tickProspectEnrichments(){
  if(ticking)return;ticking=true;
  try{const q=await pool.query("SELECT id FROM prospect_enrichment_jobs WHERE status='queued' OR (status='running' AND lease_until<NOW()) ORDER BY updated_at LIMIT 1");if(q.rows[0])await runProspectEnrichment(q.rows[0].id);}finally{ticking=false;}
}
export function startProspectEnrichments(){
  if(process.env.GROWTHOS_SMOKE_TEST==='true')return;
  const tick=()=>void tickProspectEnrichments().catch(()=>{});tick();setInterval(tick,3000).unref();
}
