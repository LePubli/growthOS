import {Router} from 'express';
import {z} from 'zod';
import {pool} from '@workspace/db';
import {logger} from '../../lib/logger';
import {CLOUD_SOURCES,CLOUD_AUTOMATIC,CloudBrowserError,browserCall,cloudConfigured,cloudProfile,cloudJob,tickCloudJobs} from '../../services/cloud-browser';
const router=Router();
const idSchema=z.string().uuid();
const schedule=()=>{if(process.env.GROWTHOS_SMOKE_TEST!=='true')void tickCloudJobs().catch(()=>logger.error('Cloud browser scheduler failed'));};
router.use((_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
router.get('/status',async(_req,res)=>{
  if(!cloudConfigured()){res.json({configured:false,ready:false,sources:CLOUD_SOURCES,automatic:CLOUD_AUTOMATIC});return;}
  try{await browserCall('/healthz',undefined,4000);res.json({configured:true,ready:true,sources:CLOUD_SOURCES,automatic:CLOUD_AUTOMATIC});}
  catch{res.json({configured:true,ready:false,sources:CLOUD_SOURCES,automatic:CLOUD_AUTOMATIC});}
});
router.get('/profiles',async(req,res)=>{
  const q=await pool.query('SELECT id,source,label,mode,created_at FROM cloud_browser_profiles WHERE tenant_id=$1 AND created_by=$2 AND deleted_at IS NULL ORDER BY created_at',[req.auth!.tenantId,req.auth!.userId]);res.json(q.rows);
});
router.post('/profiles',async(req,res)=>{
  const data=z.object({source:z.enum(CLOUD_SOURCES),label:z.string().trim().min(2).max(80),mode:z.enum(['public','account']).default('public')}).strict().parse(req.body);
  const q=await pool.query(`INSERT INTO cloud_browser_profiles(tenant_id,created_by,source,label,mode) VALUES($1,$2,$3,$4,$5) RETURNING id,source,label,mode,created_at`,[req.auth!.tenantId,req.auth!.userId,data.source,data.label,data.mode]);res.status(201).json(q.rows[0]);
});
for(const action of ['open','view','action','erase'] as const)router.post('/profiles/:id/'+action,async(req,res)=>{
  const id=idSchema.parse(req.params.id),profile=await cloudProfile(req.auth!.tenantId,id,req.auth!.userId);
  const shape=action==='open'?z.object({query:z.string().max(160).default(''),area:z.string().max(120).default(''),login:z.boolean().optional(),keepPage:z.boolean().optional()}).strict()
    :action==='action'?z.object({controlId:idSchema,event:z.discriminatedUnion('type',[
      z.object({type:z.literal('click'),x:z.number().min(0).max(1279),y:z.number().min(0).max(799)}).strict(),
      z.object({type:z.literal('scroll'),deltaY:z.number().min(-2000).max(2000)}).strict(),
      z.object({type:z.literal('text'),text:z.string().max(2000)}).strict(),
      z.object({type:z.literal('key'),key:z.enum(['Enter','Tab','Backspace','Delete','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Escape','Home','End','Control+A'])}).strict(),
      z.object({type:z.literal('back')}).strict(),
    ])}).strict():z.object({}).strict();
  const payload=shape.parse(req.body||{});
  if(action==='erase'){
    const busy=await pool.query("SELECT id FROM cloud_browser_jobs WHERE profile_id=$1 AND tenant_id=$2 AND status IN ('queued','running') LIMIT 1",[id,req.auth!.tenantId]);
    if(busy.rowCount)throw new CloudBrowserError(409,'Terminez ou annulez les tâches avant de déconnecter ce profil.');
  }
  res.json(await browserCall('/'+action,{...payload,tenantId:req.auth!.tenantId,profileId:id,source:profile.source}));
});
router.get('/jobs',async(req,res)=>{
  const q=await pool.query('SELECT * FROM cloud_browser_jobs WHERE tenant_id=$1 AND created_by=$2 ORDER BY created_at DESC LIMIT 30',[req.auth!.tenantId,req.auth!.userId]);res.json(q.rows);
});
router.post('/jobs/history/delete',async(req,res)=>{
  const selection=z.discriminatedUnion('scope',[
    z.object({scope:z.literal('all')}).strict(),
    z.object({scope:z.literal('selected'),ids:z.array(idSchema).min(1).max(100)}).strict(),
  ]).parse(req.body);
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const ids=selection.scope==='selected'?[...new Set(selection.ids)]:null;
    if(ids){
      const rows=await client.query('SELECT id,status FROM cloud_browser_jobs WHERE tenant_id=$1 AND created_by=$2 AND id=ANY($3::uuid[]) ORDER BY id FOR UPDATE',[req.auth!.tenantId,req.auth!.userId,ids]);
      if(rows.rowCount!==ids.length)throw new CloudBrowserError(404,'Une recherche est introuvable. Actualisez la liste.');
      if(rows.rows.some(row=>!['completed','failed','cancelled'].includes(row.status)))
        throw new CloudBrowserError(409,'Annulez les recherches en cours ou en attente avant de les supprimer.');
    }
    const removed=await client.query(`DELETE FROM cloud_browser_jobs WHERE tenant_id=$1 AND created_by=$2
      AND status IN ('completed','failed','cancelled') AND ($3::uuid[] IS NULL OR id=ANY($3::uuid[])) RETURNING id`,[req.auth!.tenantId,req.auth!.userId,ids]);
    await client.query('COMMIT');
    res.json({deleted:removed.rowCount,deletedIds:removed.rows.map(row=>row.id)});
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
});
router.post('/jobs',async(req,res)=>{
  if(!cloudConfigured())throw new CloudBrowserError(503,'Configurez le navigateur cloud pour lancer une tâche.');
  const data=z.object({profileId:idSchema,query:z.string().trim().min(2).max(160),area:z.string().trim().max(120).default(''),limit:z.number().int().min(1).max(25).default(10),prospectId:idSchema.optional()}).strict().parse(req.body);
  const profile=await cloudProfile(req.auth!.tenantId,data.profileId,req.auth!.userId);
  if(!CLOUD_AUTOMATIC.includes(profile.source))throw new CloudBrowserError(422,'Cette source est navigable ; son collecteur automatique reste à développer.');
  if(profile.source==='societe_com'&&!data.prospectId)throw new CloudBrowserError(422,'Choisissez le prospect à enrichir depuis Societe.com.');
  if(data.prospectId){const p=await pool.query('SELECT id FROM prospects WHERE id=$1 AND tenant_id=$2',[data.prospectId,req.auth!.tenantId]);if(!p.rowCount)throw new CloudBrowserError(404,'Prospect cible introuvable.');}
  const q=await pool.query(`INSERT INTO cloud_browser_jobs(tenant_id,created_by,profile_id,prospect_id,query,area,limit_count,mode)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[req.auth!.tenantId,req.auth!.userId,data.profileId,data.prospectId||null,data.query,data.area,data.limit,data.prospectId?'enrich':'discover']);
  res.status(201).json(q.rows[0]);schedule();
});
router.get('/jobs/:id',async(req,res)=>res.json(await cloudJob(req.auth!.tenantId,idSchema.parse(req.params.id),req.auth!.userId)));
router.post('/jobs/:id/retry',async(req,res)=>{
  const id=idSchema.parse(req.params.id);const data=z.object({resume:z.boolean().default(true)}).strict().parse(req.body||{});
  const job=await cloudJob(req.auth!.tenantId,id,req.auth!.userId);
  if(!['awaiting_user','needs_review','failed','cancelled'].includes(job.status))throw new CloudBrowserError(409,'Cette tâche ne peut pas être reprise dans son état actuel.');
  const q=await pool.query(`UPDATE cloud_browser_jobs SET status='queued',resume=$3,error=NULL,result='{}'::jsonb,updated_at=NOW() WHERE id=$1 AND tenant_id=$2 AND status IN ('awaiting_user','needs_review','failed','cancelled') RETURNING *`,[id,req.auth!.tenantId,data.resume]);
  if(!q.rows[0])throw new CloudBrowserError(409,'La tâche a changé d’état. Actualisez la liste.');
  res.json(q.rows[0]);schedule();
});
router.post('/jobs/:id/cancel',async(req,res)=>{
  const id=idSchema.parse(req.params.id);const previous=await cloudJob(req.auth!.tenantId,id,req.auth!.userId);
  const q=await pool.query(`UPDATE cloud_browser_jobs SET status='cancelled',updated_at=NOW() WHERE id=$1 AND tenant_id=$2 AND status IN ('queued','running','awaiting_user','needs_review','failed') RETURNING *`,[id,req.auth!.tenantId]);
  if(!q.rows[0])throw new CloudBrowserError(409,'Tâche déjà terminée.');
  const profile=await cloudProfile(req.auth!.tenantId,q.rows[0].profile_id,req.auth!.userId);
  if(previous.status==='running')await browserCall('/stop',{tenantId:req.auth!.tenantId,profileId:profile.id,source:profile.source},5000).catch(()=>undefined);
  res.json(q.rows[0]);
});
router.use((error:unknown,_req:any,res:any,_next:any)=>{
  if(error instanceof z.ZodError){res.status(400).json({error:'Paramètres du navigateur invalides.'});return;}
  if(error instanceof CloudBrowserError){res.status(error.status).json({error:error.message});return;}
  // The global error handler logs request bodies. Browser input can contain credentials.
  logger.error('Cloud browser operation failed');
  res.status(503).json({error:'Navigateur temporairement indisponible. Réessayez après son rétablissement.'});
});
export default router;
