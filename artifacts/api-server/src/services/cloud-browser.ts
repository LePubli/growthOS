import {collectDirectoryPage} from './official-directory';
import {captureIdentityMatches} from '../lib/enrichment-identity';
import {appendCloudResult} from './cloud-results';
import {pool} from '@workspace/db';
import {randomUUID} from 'node:crypto';
import {applyTargetCapture} from '../routes/v1/sourcing';
import {logger} from '../lib/logger';
import {recordDiagnosticEvent,errorDiagnosticDetails} from '../lib/diagnostics';
import {diagnoseSourceIssue} from '../lib/source-diagnosis';

export const CLOUD_SOURCES=['entreprises','google_maps','google_search','bing','societe_com','pappers','bodacc','pagesjaunes','linkedin','facebook','instagram','tiktok'] as const;
export const CLOUD_AUTOMATIC=['entreprises','google_maps','google_search','bing','societe_com','pappers','pagesjaunes'];
export class CloudBrowserError extends Error{constructor(public status:number,message:string){super(message);}}
export function cloudConfigured(){return !!process.env.CLOUD_BROWSER_URL && (process.env.CLOUD_BROWSER_TOKEN||'').length>=32;}
export async function browserCall(path:string,payload?:object,timeout=35000,diagnosticId?:string):Promise<any>{
  if(!cloudConfigured())throw new CloudBrowserError(503,'Le service navigateur cloud doit être configuré dans la stack GrowthOS.');
  const base=new URL(process.env.CLOUD_BROWSER_URL!);
  if(!['http:','https:'].includes(base.protocol)||base.username||base.password||base.search||base.hash)throw new CloudBrowserError(503,'Configuration du navigateur invalide.');
  const response=await fetch(new URL(path,base),{method:payload?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(timeout),
    headers:{'Content-Type':'application/json','X-Worker-Token':process.env.CLOUD_BROWSER_TOKEN!,...(diagnosticId?{'X-Diagnostic-Id':diagnosticId}:{})},...(payload?{body:JSON.stringify(payload)}:{})});
  const raw=await response.text();if(raw.length>8*1024*1024)throw new CloudBrowserError(502,'Réponse du navigateur trop volumineuse.');
  let data;try{data=JSON.parse(raw);}catch{throw new CloudBrowserError(502,'Réponse navigateur invalide.');}
  if(!response.ok)throw new CloudBrowserError(response.status,data.error||'Navigateur indisponible.');return data;
}
export async function cloudProfile(tenantId:string,id:string,userId?:string){
  const result=await pool.query('SELECT * FROM cloud_browser_profiles WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL',[id,tenantId]);
  if(!result.rows[0] || result.rows[0].created_by!==userId)throw new CloudBrowserError(404,'Profil navigateur introuvable.');return result.rows[0];
}
export async function cloudJob(tenantId:string,id:string,userId?:string){
  const result=await pool.query('SELECT * FROM cloud_browser_jobs WHERE id=$1 AND tenant_id=$2',[id,tenantId]);
  if(!result.rows[0] || userId && result.rows[0].created_by!==userId)throw new CloudBrowserError(404,'Tâche introuvable.');return result.rows[0];
}
export async function runCloudJob(id:string){
  const lease=randomUUID();
  const claimed=await pool.query(`UPDATE cloud_browser_jobs SET status='running',lease=$2,lease_until=NOW()+INTERVAL '12 minutes',updated_at=NOW(),error=NULL
    WHERE id=$1 AND status='queued' RETURNING *`,[id,lease]);
  const job=claimed.rows[0];if(!job)return;
  const started=Date.now();
  let jobSource:string|null=null;
  void recordDiagnosticEvent({tenantId:job.tenant_id,userId:job.created_by,component:'cloud-browser',code:'JOB_STARTED',level:'info',message:'Collecte démarrée',jobId:id,prospectId:job.prospect_id,details:{mode:job.mode}});
  try{
    const profile=await cloudProfile(job.tenant_id,job.profile_id,job.created_by);
    jobSource=profile.source;
    let prospect:any=null;
    if(job.mode==='enrich'&&!job.prospect_id)throw new CloudBrowserError(404,'Le prospect cible a été supprimé.');
    if(job.prospect_id){const q=await pool.query('SELECT * FROM prospects WHERE id=$1 AND tenant_id=$2',[job.prospect_id,job.tenant_id]);prospect=q.rows[0];if(!prospect)throw new CloudBrowserError(404,'Prospect cible introuvable.');}
    const data=profile.source==='entreprises'?await collectDirectoryPage(job):await browserCall('/collect',{tenantId:job.tenant_id,profileId:profile.id,source:profile.source,
      query:job.query,area:job.area,limit:job.limit_count,resume:job.resume,cursor:job.result?.pageCursor,
      target:prospect?{company:prospect.company,siren:prospect.siren,siret:prospect.siret,address:prospect.address,city:prospect.city,phone:prospect.phone}:undefined},600000,id);
    const latest=await cloudJob(job.tenant_id,id);if(latest.status==='cancelled'||latest.lease!==lease)return;
    const result=appendCloudResult(latest.result,data,id,profile.source,!!prospect);
    let status=data.status==='awaiting_user'?'awaiting_user':data.hasMore?'queued':'completed';
    if(prospect){
      const matches=result.captures.filter((c:any)=>{try{return captureIdentityMatches(prospect,c)||(['societe_com','pappers'].includes(c.source)&&c.companyDetails&&/^\d{14}$/.test(prospect.siret||'')&&/^\d{14}$/.test(c.siret||'')&&c.siret.slice(0,9)===prospect.siret.slice(0,9)&&(c.source==='societe_com'?new URL(c.sourceUrl).pathname.endsWith('-'+prospect.siret.slice(0,9)+'.html'):new URL(c.sourceUrl).pathname.replace(/\/$/,'').endsWith(prospect.siret.slice(0,9))));}catch{return false;}});
      if(matches.length===1){
        const applied=await applyTargetCapture(job.tenant_id,job.created_by,prospect.id,id,matches[0],true,{lease,result:{...result,pageCursor:null,hasMore:false}});
        if(applied.status===200){
          void recordDiagnosticEvent({tenantId:job.tenant_id,userId:job.created_by,level:'info',component:'cloud-browser',code:'JOB_APPLIED',message:'Collecte appliquée au prospect',source:profile.source,prospectId:job.prospect_id,jobId:id,details:{durationMs:Date.now()-started,matched:1}});
          return;
        }
        status='needs_review';result.message='error' in applied?applied.error:'Vérifiez la fiche cible.';
      }else if((status==='completed'&&result.captures.length>0)||matches.length>1){status='needs_review';result.message='Le rapprochement n’est pas certain. Vérifiez le bon établissement dans le navigateur avant de reprendre.';}
    }
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      const locked=await client.query("SELECT * FROM cloud_browser_jobs WHERE id=$1 AND tenant_id=$2 FOR UPDATE",[id,job.tenant_id]);
      const current=locked.rows[0];
      if(current?.status==='running'&&current.lease===lease){
        // Imports may complete while Chromium reads the next batch. Preserve their receipts.
        const merged=prospect?result:appendCloudResult(current.result,data,id,profile.source);
        await client.query(`UPDATE cloud_browser_jobs SET status=$3,result=$4,lease=NULL,lease_until=NULL,resume=true,updated_at=NOW()
          WHERE id=$1 AND tenant_id=$2 AND lease=$5 AND status='running'`,[id,job.tenant_id,status,JSON.stringify(merged),lease]);
      }
      await client.query('COMMIT');
      void recordDiagnosticEvent({tenantId:job.tenant_id,userId:job.created_by,level:status==='needs_review'||status==='awaiting_user'?'warn':'info',component:'cloud-browser',code:`JOB_${status.toUpperCase()}`,message:'Étape navigateur terminée',source:profile.source,prospectId:job.prospect_id,jobId:id,details:{durationMs:Date.now()-started,items:result.captures?.length||0,status,...(['needs_review','awaiting_user'].includes(status)?{...diagnoseSourceIssue({source:profile.source,status,reason:result.message}),reason:result.message}:{})}});
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }catch(error){
    const detail=error instanceof CloudBrowserError?error.message:'La collecte n’a pas pu se terminer. Consultez le navigateur puis réessayez.';
    const waiting=error instanceof CloudBrowserError&&[409,423,429].includes(error.status);
    const diagnosis=diagnoseSourceIssue({source:jobSource,status:waiting?'awaiting_user':'failed',httpStatus:error instanceof CloudBrowserError?error.status:undefined,reason:error instanceof Error?error.message:''});
    void recordDiagnosticEvent({tenantId:job.tenant_id,userId:job.created_by,level:waiting?'warn':'error',component:'cloud-browser',code:waiting?'JOB_AWAITING_USER':'JOB_FAILED',message:'Échec de collecte navigateur',source:jobSource,jobId:id,prospectId:job.prospect_id,details:{durationMs:Date.now()-started,...errorDiagnosticDetails(error),...diagnosis}});
    await pool.query(`UPDATE cloud_browser_jobs SET status=$3,error=$4,lease=NULL,lease_until=NULL,updated_at=NOW()
      WHERE id=$1 AND tenant_id=$2 AND lease=$5 AND status='running'`,[id,job.tenant_id,waiting?'awaiting_user':'failed',detail,lease]);
  }
}
let running=false;
export async function tickCloudJobs(){
  if(running)return;running=true;
  try{
    await pool.query(`UPDATE cloud_browser_jobs SET status='queued',lease=NULL,lease_until=NULL WHERE status='running' AND lease_until<NOW()`);
    const next=await pool.query("SELECT id FROM cloud_browser_jobs WHERE status='queued' ORDER BY updated_at LIMIT 1");
    if(next.rows[0])await runCloudJob(next.rows[0].id);
  }finally{running=false;}
}
export function startCloudJobs(){
  if(process.env.GROWTHOS_SMOKE_TEST==='true')return;
  const tick=()=>void tickCloudJobs().catch(error=>logger.error({err:error},'Cloud browser scheduler failed'));
  tick();setInterval(tick,5000).unref();
}
