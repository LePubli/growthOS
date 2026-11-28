import {randomUUID,createHash} from 'node:crypto';
import {targetCaptureReview,applyTargetCapture} from './sourcing';
import {Router} from 'express';
import {z} from 'zod';
import {pool} from '@workspace/db';
import {importCloudJob,withCloudImportStates} from '../../services/cloud-imports';
import {isProspectIdentityDuplicate,prospectIdentityConstraint} from '../../lib/prospect-identity';
import {logger} from '../../lib/logger';
import {CLOUD_SOURCES,CLOUD_AUTOMATIC,CloudBrowserError,browserCall,cloudConfigured,cloudProfile,cloudJob,tickCloudJobs} from '../../services/cloud-browser';
import {recordDiagnosticEvent,errorDiagnosticDetails} from '../../lib/diagnostics';
import {diagnoseSourceIssue} from '../../lib/source-diagnosis';
import {latestProspectEnrichment} from '../../services/prospect-enrichment';
const router=Router();
const workerIncidents=new Map<string,number>();
const captureDigest=(capture:unknown)=>createHash('sha256').update(JSON.stringify(capture)).digest('hex');
const reviewFields=['company','linkedinUrl','address','postalCode','city','phone','email','website','siret','siren','apeCode','nafLabel','nafVersion'];
const expectedValuesSchema=z.object(Object.fromEntries(reviewFields.map(field=>[field,z.string().max(2000).nullable()]))).strict();
const idSchema=z.string().uuid();
const schedule=()=>{if(process.env.GROWTHOS_SMOKE_TEST!=='true')void tickCloudJobs().catch(()=>logger.error('Cloud browser scheduler failed'));};
router.use((_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
router.get('/status',async(req,res)=>{
  if(!cloudConfigured()){res.json({configured:false,ready:false,sources:CLOUD_SOURCES,automatic:CLOUD_AUTOMATIC});return;}
  try{await browserCall('/healthz',undefined,4000,req.traceId);res.json({configured:true,ready:true,sources:CLOUD_SOURCES,automatic:CLOUD_AUTOMATIC});}
  catch(error){
    const diagnosis=diagnoseSourceIssue({source:'cloud-worker',reason:error instanceof Error?error.message:'Connexion impossible'});
    const last=workerIncidents.get(req.auth!.tenantId)||0;
    if(Date.now()-last>120_000){
      if(workerIncidents.size>2000)workerIncidents.clear();
      workerIncidents.set(req.auth!.tenantId,Date.now());
      void recordDiagnosticEvent({tenantId:req.auth!.tenantId,userId:req.auth!.userId,traceId:req.traceId,level:'error',component:'cloud-browser',code:'WORKER_UNAVAILABLE',message:'Navigateur cloud inaccessible',details:{...diagnosis,...errorDiagnosticDetails(error)}});
    }
    res.json({configured:true,ready:false,sources:CLOUD_SOURCES,automatic:CLOUD_AUTOMATIC});
  }
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
  res.locals.source = profile.source;
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
  res.json(await browserCall('/'+action,{...payload,tenantId:req.auth!.tenantId,profileId:id,source:profile.source},35000,req.traceId));
});
router.get('/jobs',async(req,res)=>{
  const q=await pool.query('SELECT * FROM cloud_browser_jobs WHERE tenant_id=$1 AND created_by=$2 ORDER BY created_at DESC LIMIT 30',[req.auth!.tenantId,req.auth!.userId]);res.json(await withCloudImportStates(q.rows,req.auth!.tenantId));
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
  const data=z.object({profileId:idSchema,query:z.string().trim().min(2).max(160),area:z.string().trim().max(120).default(''),limit:z.number().int().min(1).max(25).default(25),prospectId:idSchema.optional(),filters:z.object({regions:z.array(z.string().regex(/^\d{2}$/)).max(18),departements:z.array(z.string().regex(/^(?:\d{2,3}|2[AB])$/)).max(101),codesPostaux:z.array(z.string().regex(/^\d{5}$/)).max(25)}).strict().optional()}).strict().parse(req.body);
  const profile=await cloudProfile(req.auth!.tenantId,data.profileId,req.auth!.userId);
  if(profile.source!=='entreprises'&&!cloudConfigured())throw new CloudBrowserError(503,'Configurez le navigateur cloud pour lancer une tâche.');
  if(!CLOUD_AUTOMATIC.includes(profile.source))throw new CloudBrowserError(422,'Cette source est navigable ; son collecteur automatique reste à développer.');
  if(['societe_com','pappers'].includes(profile.source)&&!data.prospectId)throw new CloudBrowserError(422,'Choisissez le prospect à enrichir depuis cette source.');
  if(data.prospectId){const p=await pool.query('SELECT id FROM prospects WHERE id=$1 AND tenant_id=$2',[data.prospectId,req.auth!.tenantId]);if(!p.rowCount)throw new CloudBrowserError(404,'Prospect cible introuvable.');}
  const q=await pool.query(`INSERT INTO cloud_browser_jobs(tenant_id,created_by,profile_id,prospect_id,query,area,limit_count,mode,result)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[req.auth!.tenantId,req.auth!.userId,data.profileId,data.prospectId||null,data.query,data.area,data.limit,data.prospectId?'enrich':'discover',JSON.stringify({criteria:data.filters||{}})]);
  res.status(201).json(q.rows[0]);schedule();
});
router.get('/jobs/:id',async(req,res)=>{
  const job=await cloudJob(req.auth!.tenantId,idSchema.parse(req.params.id),req.auth!.userId);
  res.json((await withCloudImportStates([job],req.auth!.tenantId))[0]);
});
router.post('/jobs/:id/import',async(req,res)=>{
  const id=idSchema.parse(req.params.id);
  const data=z.object({captureIds:z.array(z.string().min(3).max(64)).min(1).max(25)}).strict().parse(req.body);
  res.json(await importCloudJob(req.auth!.tenantId,req.auth!.userId,id,data.captureIds));
});
router.post('/local-review',async(req,res)=>{
  const data=z.object({taskId:idSchema,prospectId:idSchema,cloudJobId:idSchema.optional(),capture:z.unknown()}).strict().parse(req.body),tenant=req.auth!.tenantId,user=req.auth!.userId;
  const raw=data.capture as any;if(!raw||typeof raw!=='object'||!CLOUD_SOURCES.includes(raw.source))throw new CloudBrowserError(400,'Source locale invalide.');
  const id=data.cloudJobId||data.taskId,capture={...raw,id:'task_'+id};
  res.locals.source=raw.source;res.locals.prospectId=data.prospectId;res.locals.jobId=id;
  const preview=await targetCaptureReview(tenant,data.prospectId,capture);if(preview.status!==200)throw new CloudBrowserError(preview.status,'error' in preview?preview.error||'Capture invalide.':'Capture invalide.');
  const client=await pool.connect();try{
    await client.query('BEGIN');
    let job=(await client.query('SELECT * FROM cloud_browser_jobs WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if(job&&(job.tenant_id!==tenant||job.created_by!==user||job.prospect_id!==data.prospectId))throw new CloudBrowserError(404,'Tâche introuvable.');
    if(data.cloudJobId&&!job)throw new CloudBrowserError(404,'Tâche cible introuvable.');
    if(job){
      const profile=(await client.query('SELECT source FROM cloud_browser_profiles WHERE id=$1 AND tenant_id=$2',[job.profile_id,tenant])).rows[0];
      if(profile?.source!==raw.source)throw new CloudBrowserError(409,'La capture appartient à une autre source.');
      if(['queued','running'].includes(job.status))throw new CloudBrowserError(409,'Annulez d’abord la collecte cloud en cours.');
      if(job.status==='completed'&&job.result?.applied){await client.query('COMMIT');res.json({job,alreadyApplied:true});return;}
    }else{
      let profile=(await client.query('SELECT id FROM cloud_browser_profiles WHERE tenant_id=$1 AND created_by=$2 AND source=$3 AND deleted_at IS NULL LIMIT 1',[tenant,user,raw.source])).rows[0];
      if(!profile)profile=(await client.query('INSERT INTO cloud_browser_profiles(tenant_id,created_by,source,label) VALUES($1,$2,$3,$4) RETURNING id',[tenant,user,raw.source,'Capture locale · '+raw.source])).rows[0];
      job=(await client.query("INSERT INTO cloud_browser_jobs(id,tenant_id,created_by,profile_id,prospect_id,mode,query,status) VALUES($1,$2,$3,$4,$5,'enrich',$6,'needs_review') RETURNING *",[id,tenant,user,profile.id,data.prospectId,String(raw.company).slice(0,160)])).rows[0];
    }
    const result={...job.result,captureHistory:[...(job.result?.captureHistory||[]),...(job.result?.captures||[])].slice(-20),captures:[capture],applied:undefined,localCapture:{taskId:data.taskId,capturedAt:new Date().toISOString()},message:'Capture issue du Chrome de cet appareil. Comparez puis confirmez son identité.'};
    job=(await client.query("UPDATE cloud_browser_jobs SET status='needs_review',result=$2,error=NULL,lease=NULL,lease_until=NULL,updated_at=NOW() WHERE id=$1 RETURNING *",[id,JSON.stringify(result)])).rows[0];
    await client.query('COMMIT');void recordDiagnosticEvent({tenantId:tenant,userId:user,traceId:req.traceId,level:'info',component:'crm-confirmation',code:'LOCAL_CAPTURE_STAGED',message:'Capture locale conservée pour validation CRM',source:raw.source,prospectId:data.prospectId,jobId:id,details:{resultCount:1}});res.json({job});
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
});
router.get('/jobs/:id/review',async(req,res)=>{
  const job=await cloudJob(req.auth!.tenantId,idSchema.parse(req.params.id),req.auth!.userId);
  res.locals.jobId=job.id;res.locals.prospectId=job.prospect_id;
  const sourceRow=await pool.query('SELECT source FROM cloud_browser_profiles WHERE id=$1 AND tenant_id=$2',[job.profile_id,req.auth!.tenantId]);
  res.locals.source=sourceRow.rows[0]?.source||null;
  if(job.mode!=='enrich'||!job.prospect_id)throw new CloudBrowserError(409,'Cette tâche ne cible pas de prospect.');
  const index=z.coerce.number().int().min(0).parse(req.query.captureIndex||0),capture=job.result?.captures?.[index];
  if(!capture)throw new CloudBrowserError(409,'Aucune fiche capturée. Ouvrez la bonne fiche source puis relancez sa lecture.');
  const preview=await targetCaptureReview(req.auth!.tenantId,job.prospect_id,capture);
  if(preview.status!==200)throw new CloudBrowserError(preview.status,'error' in preview?preview.error||'Comparaison indisponible.':'Comparaison indisponible.');
  void recordDiagnosticEvent({tenantId:req.auth!.tenantId,userId:req.auth!.userId,traceId:req.traceId,level:'info',component:'crm-confirmation',code:'REVIEW_READY',message:'Comparaison prête dans le parcours du prospect',source:res.locals.source,jobId:job.id,prospectId:job.prospect_id,details:{resultCount:job.result.captures.length,blocked:preview.review?.blocked}});
  res.json({...preview.review,captureDigest:captureDigest(capture),captureIndex:index,captureCount:job.result.captures.length,alreadyApplied:!!job.result.applied});
});
router.post('/jobs/:id/finish-review',async(req,res)=>{
  z.object({}).strict().parse(req.body||{});
  const job=await cloudJob(req.auth!.tenantId,idSchema.parse(req.params.id),req.auth!.userId);
  res.locals.jobId=job.id;res.locals.prospectId=job.prospect_id;
  if(job.mode!=='enrich'||!job.prospect_id||job.status!=='completed'||!job.result?.applied)throw new CloudBrowserError(409,'Les données ne sont pas encore enregistrées. La comparaison reste disponible.');
  res.locals.source=job.result.captures?.[0]?.source||null;
  // The saved job is the receipt. Reconciliation must not hold navigation hostage.
  void latestProspectEnrichment(req.auth!.tenantId,job.prospect_id).catch(error=>{
    logger.warn({traceId:req.traceId,jobId:job.id,...errorDiagnosticDetails(error)},'Saved source enrichment refresh failed');
    void recordDiagnosticEvent({tenantId:req.auth!.tenantId,userId:req.auth!.userId,traceId:req.traceId,level:'warn',component:'crm-confirmation',code:'ENRICHMENT_REFRESH_FAILED',message:'Sauvegarde confirmée ; actualisation du bilan à reprendre',source:res.locals.source,prospectId:job.prospect_id,jobId:job.id,details:errorDiagnosticDetails(error)});
  });
  void recordDiagnosticEvent({tenantId:req.auth!.tenantId,userId:req.auth!.userId,traceId:req.traceId,level:'info',component:'crm-confirmation',code:'RETURN_TO_PROSPECT',message:'Retour autorisé vers le prospect après sauvegarde vérifiée',source:res.locals.source,prospectId:job.prospect_id,jobId:job.id,details:{filledFields:job.result.applied.filled?.length||0}});
  res.json({prospectId:job.prospect_id,jobId:job.id,source:res.locals.source,url:'/prospects/'+job.prospect_id+'?'+new URLSearchParams({view:'enrichments',reviewedJob:job.id}).toString(),filled:job.result.applied.filled||[],conflicts:job.result.applied.conflicts||0});
});
router.post('/jobs/:id/confirm',async(req,res)=>{
  const tenant=req.auth!.tenantId,user=req.auth!.userId,id=idSchema.parse(req.params.id);
  const data=z.object({captureIndex:z.number().int().min(0),confirmed:z.literal(true),expectedUpdatedAt:z.string().datetime(),expectedCaptureDigest:z.string().regex(/^[a-f0-9]{64}$/),expectedValues:expectedValuesSchema.optional(),replaceFields:z.array(z.enum(['company','address','postalCode','city','phone','email','website','linkedinUrl','apeCode','nafLabel','nafVersion'])).max(11).default([])}).strict().parse(req.body);
  const job=await cloudJob(tenant,id,user);
  res.locals.jobId=job.id;res.locals.prospectId=job.prospect_id;
  const sourceRow=await pool.query('SELECT source FROM cloud_browser_profiles WHERE id=$1 AND tenant_id=$2',[job.profile_id,tenant]);
  res.locals.source=sourceRow.rows[0]?.source||null;
  void recordDiagnosticEvent({tenantId:tenant,userId:user,traceId:req.traceId,level:'info',component:'crm-confirmation',code:'CONFIRMATION_STARTED',message:'Validation CRM demandée',source:res.locals.source,prospectId:job.prospect_id,jobId:id,details:{local:!!job.result?.localCapture}});
  if(job.result?.applied&&job.status==='completed'){res.json({job,alreadyApplied:true});return;}
  if(job.mode!=='enrich'||!job.prospect_id||!['needs_review','awaiting_user'].includes(job.status))throw new CloudBrowserError(409,'Cette tâche ne peut pas être confirmée dans son état actuel.');
  const capture=job.result?.captures?.[data.captureIndex];if(!capture)throw new CloudBrowserError(404,'Capture introuvable.');
  if(captureDigest(capture)!==data.expectedCaptureDigest)throw new CloudBrowserError(409,'La capture a changé depuis la comparaison. Rechargez les données avant de confirmer.');
  const lease=randomUUID(),claimed=await pool.query("UPDATE cloud_browser_jobs SET status='running',lease=$3,lease_until=NOW()+INTERVAL '2 minutes' WHERE id=$1 AND tenant_id=$2 AND status=$4 AND result->'captures'->($5::integer)=$6::jsonb RETURNING id",[id,tenant,lease,job.status,data.captureIndex,JSON.stringify(capture)]);
  if(!claimed.rows.length)throw new CloudBrowserError(409,'La tâche a changé d’état. Rechargez-la.');
  try{
    const applied=await applyTargetCapture(tenant,user,job.prospect_id,id,capture,false,{lease,result:{...job.result,manualConfirmation:{userId:user,captureIndex:data.captureIndex,confirmedAt:new Date().toISOString()}}},{expectedUpdatedAt:data.expectedUpdatedAt,confirmed:true,replaceFields:data.replaceFields,expectedValues:data.expectedValues});
    if(applied.status!==200)throw new CloudBrowserError(applied.status,'error' in applied?applied.error:'Confirmation impossible.');
    void recordDiagnosticEvent({tenantId:tenant,userId:user,traceId:req.traceId,level:'info',component:'crm-confirmation',code:'CONFIRMATION_SAVED',message:'Validation CRM enregistrée',source:res.locals.source,prospectId:job.prospect_id,jobId:id,details:{filledFields:('filled' in applied?applied.filled.length:0)||0,conflicts:('conflicts' in applied?applied.conflicts:0),alreadyApplied:'alreadyApplied' in applied&&applied.alreadyApplied}});
    res.json({job:await cloudJob(tenant,id,user),...applied});
  }catch(error){await pool.query("UPDATE cloud_browser_jobs SET status='needs_review',lease=NULL,lease_until=NULL WHERE id=$1 AND tenant_id=$2 AND lease=$3",[id,tenant,lease]);throw error;}
});
router.post('/jobs/:id/retry',async(req,res)=>{
  const id=idSchema.parse(req.params.id);const data=z.object({resume:z.boolean().default(true)}).strict().parse(req.body||{});
  const job=await cloudJob(req.auth!.tenantId,id,req.auth!.userId);
  if(!['awaiting_user','needs_review','failed','cancelled'].includes(job.status))throw new CloudBrowserError(409,'Cette tâche ne peut pas être reprise dans son état actuel.');
  const q=await pool.query(`UPDATE cloud_browser_jobs SET status='queued',resume=$3,error=NULL,updated_at=NOW() WHERE id=$1 AND tenant_id=$2 AND status IN ('awaiting_user','needs_review','failed','cancelled') RETURNING *`,[id,req.auth!.tenantId,data.resume]);
  if(!q.rows[0])throw new CloudBrowserError(409,'La tâche a changé d’état. Actualisez la liste.');
  res.json(q.rows[0]);schedule();
});
router.post('/jobs/:id/cancel',async(req,res)=>{
  const id=idSchema.parse(req.params.id);const previous=await cloudJob(req.auth!.tenantId,id,req.auth!.userId);
  const q=await pool.query(`UPDATE cloud_browser_jobs SET status='cancelled',updated_at=NOW() WHERE id=$1 AND tenant_id=$2 AND status IN ('queued','running','awaiting_user','needs_review','failed') RETURNING *`,[id,req.auth!.tenantId]);
  if(!q.rows[0])throw new CloudBrowserError(409,'Tâche déjà terminée.');
  const profile=await cloudProfile(req.auth!.tenantId,q.rows[0].profile_id,req.auth!.userId);
  if(previous.status==='running')await browserCall('/stop',{tenantId:req.auth!.tenantId,profileId:profile.id,source:profile.source},5000,req.traceId).catch(()=>undefined);
  res.json(q.rows[0]);
});
router.use((error:unknown,req:any,res:any,_next:any)=>{
  const source=typeof res.locals.source==='string'?res.locals.source:null;
  const invalidInput=error instanceof z.ZodError;
  const identityDuplicate=isProspectIdentityDuplicate(error),identityConstraint=prospectIdentityConstraint(error);
  const saving=/\/jobs\/[^/]+\/confirm$|\/local-review$/.test(req.path);
  const errorDetails=errorDiagnosticDetails(error);
  if(identityDuplicate||identityConstraint){
    void recordDiagnosticEvent({tenantId:req.auth?.tenantId,userId:req.auth?.userId,traceId:req.traceId,level:'warn',component:'crm-confirmation',code:identityDuplicate?'CRM_IDENTITY_DUPLICATE':'CRM_IDENTITY_INCONSISTENT',message:'Validation CRM bloquée par une contrainte d’identité',source,prospectId:res.locals.prospectId,jobId:res.locals.jobId,details:{...errorDetails,causeCode:identityDuplicate?'CRM_IDENTITY_DUPLICATE':'CRM_IDENTITY_INCONSISTENT',certainty:'observed',cause:identityDuplicate?'Un identifiant est déjà utilisé par une autre fiche de cette agence.':'Les identifiants légaux de la capture sont incohérents.',action:'Vérifier le doublon ou les identifiants dans le CRM avant de confirmer.'}});
    res.status(409).json({error:identityDuplicate?'Ce SIRET ou SIREN appartient déjà à une autre fiche prospect. Vérifiez le doublon dans le CRM. La capture est conservée.':'Le SIREN et le SIRET sont incohérents. Corrigez les identifiants avant de valider.',code:identityDuplicate?'CRM_IDENTITY_DUPLICATE':'CRM_IDENTITY_INCONSISTENT',traceId:req.traceId});return;
  }
  const expectedConflict=error instanceof CloudBrowserError&&error.status>=400&&error.status<500;
  const captureRequired=expectedConflict&&/Aucune fiche capturée|Capture introuvable/i.test(error.message);
  const diagnosis=diagnoseSourceIssue({source,status:error instanceof CloudBrowserError?'failed':undefined,httpStatus:error instanceof CloudBrowserError?error.status:undefined,reason:invalidInput?'Paramètres invalides':error instanceof Error?error.message:''});
  void recordDiagnosticEvent({tenantId:req.auth?.tenantId,userId:req.auth?.userId,traceId:req.traceId,
    level:invalidInput||expectedConflict?'warn':'error',component:saving?'crm-confirmation':'cloud-browser',code:invalidInput?'INVALID_BROWSER_INPUT':captureRequired?'CAPTURE_REQUIRED':expectedConflict?'BROWSER_ACTION_CONFLICT':saving?'CRM_SAVE_FAILED':'BROWSER_OPERATION_FAILED',
    message:expectedConflict?'Action navigateur non réalisable dans cet état':'Opération navigateur en erreur',source,
    jobId:typeof res.locals.jobId==='string'?res.locals.jobId:null,prospectId:typeof res.locals.prospectId==='string'?res.locals.prospectId:null,
    details:{...(invalidInput?{errorType:'ZodError',issueCount:error.issues.length}:errorDetails),...(saving?{causeCode:'CRM_SAVE_FAILED',certainty:'observed',cause:'L’enregistrement CRM a échoué ; la capture est conservée.',action:'Rechercher le code SQLSTATE et la trace dans les logs API.'}:diagnosis)}});
  if(error instanceof z.ZodError){res.status(400).json({error:'Paramètres du navigateur invalides.'});return;}
  if(error instanceof CloudBrowserError){res.status(error.status).json({error:error.message,traceId:req.traceId});return;}
  // Never log browser input: it may include user-entered credentials.
  logger.error({reason:error instanceof Error?error.name:'unknown'},'Cloud browser operation failed');
  const workerFailure=!saving&&!errorDetails.databaseCode&&/^\/profiles\/[^/]+\/(?:open|view|action|erase)$/.test(req.path);
  res.status(workerFailure?503:500).json({error:workerFailure?'Navigateur temporairement indisponible. Réessayez après son rétablissement.':saving?'L’enregistrement CRM a échoué. La capture est conservée ; consultez le centre de diagnostic avec cette référence.':'L’opération a échoué. Consultez le centre de diagnostic avec cette référence.',code:saving?'CRM_SAVE_FAILED':'BROWSER_OPERATION_FAILED',traceId:req.traceId});
});
export default router;
