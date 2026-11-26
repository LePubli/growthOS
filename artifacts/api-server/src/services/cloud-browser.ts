import {pool} from '@workspace/db';
import {randomUUID} from 'node:crypto';
import {applyTargetCapture} from '../routes/v1/sourcing';
import {logger} from '../lib/logger';

export const CLOUD_SOURCES=['google_maps','google_search','bing','societe_com','pagesjaunes','linkedin','facebook','instagram','tiktok'] as const;
export const CLOUD_AUTOMATIC=['google_maps','google_search','bing','societe_com'];
export class CloudBrowserError extends Error{constructor(public status:number,message:string){super(message);}}
export function cloudConfigured(){return !!process.env.CLOUD_BROWSER_URL && (process.env.CLOUD_BROWSER_TOKEN||'').length>=32;}
export async function browserCall(path:string,payload?:object,timeout=35000):Promise<any>{
  if(!cloudConfigured())throw new CloudBrowserError(503,'Le service navigateur cloud doit être configuré dans la stack GrowthOS.');
  const base=new URL(process.env.CLOUD_BROWSER_URL!);
  if(!['http:','https:'].includes(base.protocol)||base.username||base.password||base.search||base.hash)throw new CloudBrowserError(503,'Configuration du navigateur invalide.');
  const response=await fetch(new URL(path,base),{method:payload?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(timeout),
    headers:{'Content-Type':'application/json','X-Worker-Token':process.env.CLOUD_BROWSER_TOKEN!},...(payload?{body:JSON.stringify(payload)}:{})});
  const raw=await response.text();if(raw.length>2200000)throw new CloudBrowserError(502,'Réponse du navigateur trop volumineuse.');
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
const normalize=(v:unknown)=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const phone=(v:unknown)=>String(v||'').replace(/^\+33/,'0').replace(/\D/g,'');
function targetMatches(p:any,c:any){
  const known=p.siren||p.siret?.slice(0,9),incoming=c.siret?.slice(0,9)||new URL(c.sourceUrl).pathname.match(/-(\d{9})\.html/i)?.[1];
  if(known&&incoming&&known!==incoming)return false;
  if(p.siret&&c.siret)return p.siret===c.siret;
  if(c.source==='societe_com'&&known===incoming)return !p.city||!c.city||normalize(p.city)===normalize(c.city);
  if(normalize(p.company)!==normalize(c.company))return false;
  if(p.city&&c.city&&normalize(p.city)!==normalize(c.city))return false;
  return (!!p.phone&&phone(p.phone)===phone(c.phone)) || (!!p.address&&normalize(p.address)===normalize(c.address));
}
export async function runCloudJob(id:string){
  const lease=randomUUID();
  const claimed=await pool.query(`UPDATE cloud_browser_jobs SET status='running',lease=$2,lease_until=NOW()+INTERVAL '12 minutes',updated_at=NOW(),error=NULL
    WHERE id=$1 AND status='queued' RETURNING *`,[id,lease]);
  const job=claimed.rows[0];if(!job)return;
  try{
    const profile=await cloudProfile(job.tenant_id,job.profile_id,job.created_by);
    let prospect:any=null;
    if(job.mode==='enrich'&&!job.prospect_id)throw new CloudBrowserError(404,'Le prospect cible a été supprimé.');
    if(job.prospect_id){const q=await pool.query('SELECT * FROM prospects WHERE id=$1 AND tenant_id=$2',[job.prospect_id,job.tenant_id]);prospect=q.rows[0];if(!prospect)throw new CloudBrowserError(404,'Prospect cible introuvable.');}
    const data=await browserCall('/collect',{tenantId:job.tenant_id,profileId:profile.id,source:profile.source,
      query:job.query,area:job.area,limit:job.limit_count,resume:job.resume,
      target:prospect?{company:prospect.company,siren:prospect.siren,siret:prospect.siret}:undefined},600000);
    const latest=await cloudJob(job.tenant_id,id);if(latest.status==='cancelled')return;
    const allowed=['source','company','address','codePostal','city','phone','email','website','sourceUrl','siret','apeCode','nafLabel','nafVersion','apeScope','companyDetails'];
    const captures=(Array.isArray(data.results)?data.results:[]).slice(0,25).map((c:any,index:number)=>{
      const out:any={id:prospect?'task_'+id:'cloud_'+id+'_'+index,collectionMode:'visible',capturedAt:Date.now()};
      for(const key of allowed)if(c[key]!==undefined)out[key]=c[key];return out;
    });
    let result:any={captures,drafts:(data.drafts||[]).slice(0,25),message:String(data.message||'').slice(0,500)};
    let status=data.status==='awaiting_user'?'awaiting_user':'completed';
    if(prospect&&captures.length){
      const matches=captures.filter((c:any)=>{try{return targetMatches(prospect,c);}catch{return false;}});
      if(matches.length!==1){status='needs_review';result.message='Le rapprochement n’est pas certain. Vérifiez le bon établissement dans le navigateur avant de reprendre.';}
      else{
        const applied=await applyTargetCapture(job.tenant_id,job.created_by,prospect.id,id,matches[0],true,{lease,result});
        if(applied.status!==200){status='needs_review';result.message='error' in applied?applied.error:'Vérifiez la fiche cible.';}
        else result.applied=applied;
      }
    }
    await pool.query(`UPDATE cloud_browser_jobs SET status=$3,result=$4,lease=NULL,lease_until=NULL,updated_at=NOW()
      WHERE id=$1 AND tenant_id=$2 AND lease=$5 AND status='running'`,[id,job.tenant_id,status,JSON.stringify(result),lease]);
  }catch(error){
    const detail=error instanceof CloudBrowserError?error.message:'La collecte n’a pas pu se terminer. Consultez le navigateur puis réessayez.';
    const waiting=error instanceof CloudBrowserError&&[409,423,429].includes(error.status);
    await pool.query(`UPDATE cloud_browser_jobs SET status=$3,error=$4,lease=NULL,lease_until=NULL,updated_at=NOW()
      WHERE id=$1 AND tenant_id=$2 AND lease=$5 AND status='running'`,[id,job.tenant_id,waiting?'awaiting_user':'failed',detail,lease]);
  }
}
let running=false;
export async function tickCloudJobs(){
  if(running||!cloudConfigured())return;running=true;
  try{
    await pool.query(`UPDATE cloud_browser_jobs SET status='queued',lease=NULL,lease_until=NULL WHERE status='running' AND lease_until<NOW()`);
    const next=await pool.query("SELECT id FROM cloud_browser_jobs WHERE status='queued' ORDER BY created_at LIMIT 1");
    if(next.rows[0])await runCloudJob(next.rows[0].id);
  }finally{running=false;}
}
export function startCloudJobs(){
  if(process.env.GROWTHOS_SMOKE_TEST==='true')return;
  const tick=()=>void tickCloudJobs().catch(()=>logger.error('Cloud browser scheduler failed'));
  tick();setInterval(tick,5000).unref();
}
