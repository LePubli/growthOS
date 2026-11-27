import {db} from '@workspace/db';
import {sql} from 'drizzle-orm';
import {deviceImportSchema,importParsedCaptures,captureHasPendingConflict,type CaptureImportOutcome} from '../routes/v1/sourcing';
import {CloudBrowserError} from './cloud-browser';
import {isProspectIdentityDuplicate} from '../lib/prospect-identity';

type Job={id:string;tenant_id:string;created_by:string;mode:string;status:string;result:any;[key:string]:any};
type Reader=Pick<typeof db,'execute'>;
export const handledImport=(state?:CaptureImportOutcome)=>!!state&&['imported','enriched','already_present'].includes(state.status);

// Read existing CRM evidence as well as new receipts. GET never fabricates a successful import.
export async function withCloudImportStates(jobs:Job[],tenantId:string,reader:Reader=db):Promise<Job[]>{
  const ids=[...new Set(jobs.flatMap(j=>(j.result?.captures||[]).map((c:any)=>String(c.id))))];
  const receipts=jobs.flatMap(j=>Object.values(j.result?.imports||{})) as CaptureImportOutcome[];
  const prospectIds=[...new Set(receipts.map(r=>r.prospectId).filter((id):id is string=>!!id))];
  if(!ids.length)return jobs;
  const q=await reader.execute(sql`SELECT id,source_details,company,address,postal_code AS "postalCode",city,phone,email,website,siret,siren,ape_code AS "apeCode",naf_label AS "nafLabel",naf_version AS "nafVersion",linkedin_url AS "linkedinUrl" FROM prospects WHERE tenant_id=${tenantId} AND (
    id::text=ANY(${sql.param(prospectIds)}::text[]) OR
    source_details->'browserCapture'->>'localCaptureId'=ANY(${sql.param(ids)}::text[]) OR EXISTS(
      SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(source_details->'crossSource'->'observations')='array'
        THEN source_details->'crossSource'->'observations' ELSE '[]'::jsonb END) observation
      WHERE observation->>'captureId'=ANY(${sql.param(ids)}::text[])))`);
  const alive=new Set(q.rows.map(p=>String(p.id))),evidence=new Map<string,Set<string>>();
  const wanted=new Set(ids);
  for(const p of q.rows){
    const details:any=p.source_details||{};
    const seen=[details.browserCapture?.localCaptureId,...(Array.isArray(details.crossSource?.observations)?details.crossSource.observations.map((o:any)=>o.captureId):[])];
    for(const id of seen)if(wanted.has(id)){if(!evidence.has(id))evidence.set(id,new Set());evidence.get(id)!.add(String(p.id));}
  }
  return jobs.map(job=>{
    const imports:Record<string,CaptureImportOutcome>={...job.result?.imports};
    for(const capture of job.result?.captures||[]){
      const saved=imports[capture.id];
      if(saved?.prospectId){
        if(!alive.has(saved.prospectId))imports[capture.id]={...saved,status:'missing',prospectId:undefined,message:'La fiche CRM a été supprimée. Vous pouvez réimporter ce résultat.'};
        else if(saved.status==='missing')imports[capture.id]={...saved,status:'already_present',message:undefined};
      }
      if(!saved){
        const found=[...(evidence.get(capture.id)||[])];
        if(found.length===1){
          // Old imports can contain unresolved proposals: keep them available for review.
          const prospect=q.rows.find(p=>String(p.id)===found[0]);
          const pending=!!prospect&&captureHasPendingConflict({...prospect,sourceDetails:prospect.source_details},capture);
          imports[capture.id]={captureId:capture.id,status:pending?'needs_review':'already_present',prospectId:found[0],
            message:pending?'Des valeurs différentes restent à vérifier sur la fiche CRM.':'Déjà enregistré dans le CRM.'};
        }else if(found.length>1)imports[capture.id]={captureId:capture.id,status:'needs_review',message:'Plusieurs fiches CRM contiennent cette capture : vérifiez les doublons.'};
      }
    }
    return {...job,result:{...job.result,imports}};
  });
}

export async function importCloudJob(tenantId:string,userId:string,jobId:string,captureIds:string[]){
  return db.transaction(async tx=>{
    const query=await tx.execute(sql`SELECT * FROM cloud_browser_jobs WHERE id=${jobId} AND tenant_id=${tenantId} AND created_by=${userId} FOR UPDATE`);
    const raw=query.rows[0] as Job|undefined;
    if(!raw)throw new CloudBrowserError(404,'Recherche introuvable.');
    if(raw.mode!=='discover')throw new CloudBrowserError(409,'Choisissez une tâche de collecte pour importer des prospects.');
    const [job]=await withCloudImportStates([raw],tenantId,tx);
    const captures=new Map<string,any>((job.result.captures||[]).map((c:any)=>[c.id,c]));
    const ids=[...new Set(captureIds)];
    if(ids.some(id=>!captures.has(id)))throw new CloudBrowserError(400,'Une fiche sélectionnée ne fait pas partie de cette collecte.');
    // Serialize cloud imports in the same agency, including two searches for the same establishment.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId},7319))`);
    const imports:Record<string,CaptureImportOutcome>={...job.result.imports};
    const processedIds:string[]=[];let imported=0,enriched=0,alreadyPresent=0,needsReview=0,failed=0;
    for(const id of ids){
      if(handledImport(imports[id])){alreadyPresent++;processedIds.push(id);continue;}
      const parsed=deviceImportSchema.safeParse({verified:[captures.get(id)],drafts:[]});
      if(!parsed.success){imports[id]={captureId:id,status:'failed',message:'Fiche incomplète ou invalide. Vérifiez les données avant import.',at:new Date().toISOString()};failed++;continue;}
      try{
        const result=await tx.transaction(async savepoint=>{
          const batch=await importParsedCaptures(parsed.data,tenantId,userId,savepoint,false);
          if(!batch.outcomes[0])throw Error('Import without receipt');
          return batch;
        });
        const state=result.outcomes[0];
        imports[id]=state;
        if(state.status==='imported')imported++;else if(state.status==='enriched')enriched++;else if(state.status==='already_present')alreadyPresent++;
        else if(state.status==='needs_review')needsReview++;else failed++;
        if(handledImport(state))processedIds.push(id);
      }catch(error){
        const identity=isProspectIdentityDuplicate(error);
        imports[id]={captureId:id,status:identity?'needs_review':'failed',at:new Date().toISOString(),
          message:identity?'Identifiant déjà utilisé : vérifiez la fiche CRM existante.':'Cette fiche n’a pas été importée. Vous pouvez réessayer.'};
        if(identity)needsReview++;else failed++;
      }
    }
    const result={...job.result,imports};
    await tx.execute(sql`UPDATE cloud_browser_jobs SET result=${JSON.stringify(result)}::jsonb,updated_at=NOW() WHERE id=${jobId} AND tenant_id=${tenantId}`);
    return {imported,enriched,alreadyPresent,needsReview,failed,processedIds,job:{...job,result}};
  });
}
