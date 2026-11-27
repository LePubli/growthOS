import {Router} from 'express';
import {db,prospectsTable,pool,activitiesTable} from '@workspace/db';
import {eq,desc,and} from 'drizzle-orm';
import {collectProspectPeople,collectProspectContactPoints} from '@workspace/api-zod';
import {z} from 'zod';
import {recordDiagnosticEvent,errorDiagnosticDetails} from '../../lib/diagnostics';
import {changeDescription} from '../../lib/prospect-change-history';
const router=Router();
// Source facts are persisted on their parent prospect. Read that single truth,
// rather than creating duplicate prospects for every newly discovered manager.
router.get('/',async(req,res)=>{
  const parents=await db.select().from(prospectsTable).where(eq(prospectsTable.tenantId,req.auth!.tenantId)).orderBy(desc(prospectsTable.updatedAt));
  const watched=await pool.query('SELECT prospect_id,snapshot FROM prospect_monitoring WHERE tenant_id=$1',[req.auth!.tenantId]);
  const official=new Map(watched.rows.map(row=>[row.prospect_id,row.snapshot]));
  const data=parents.flatMap(p=>{
    const common={prospectId:p.id,company:p.company,city:p.city,isStarred:p.isStarred,score:p.score};
    const people=collectProspectPeople(p,official.get(p.id)?.siren===(p.siren||p.siret?.slice(0,9))?official.get(p.id)?.managers||[]:[]).map(person=>({
      ...person,...(person.source==='crm'?{phone:p.phone,email:p.email,phones:p.phone?[p.phone]:[],emails:p.email?[p.email]:[]}:{}),
      ...common,id:p.id+':'+person.id,kind:'person',
    }));
    // Keep the general business contact accessible, including email-only CRM
    // entries. It is a separate channel, never a director's direct number.
    if(!p.firstName&&!p.lastName){
      const points=collectProspectContactPoints(p).filter(v=>!v.personName&&v.state!=='review'&&!v.establishmentSiret);
      const emails=[...new Set(points.filter(v=>v.type==='email').map(v=>v.value))];
      const phones=[...new Map(points.filter(v=>v.type==='phone').map(v=>[v.value.replace(/\D/g,'').replace(/^33/,'0'),v.value])).values()];
      if(emails.length||phones.length)people.push({...common,id:p.id+':company',kind:'company',name:p.company||p.email||'Contact général',role:'Coordonnées générales de l’entreprise',phone:p.phone||phones[0]||null,email:p.email||emails[0]||null,phones,emails,profileUrl:null,source:'crm',isManager:false});
    }
    return people;
  });
  res.json({data,total:data.length});
});
router.post('/:id/coordinates/primary',async(req,res)=>{
  const id=z.string().uuid().parse(req.params.id),tenant=req.auth!.tenantId;
  const data=z.object({type:z.enum(['email','phone','address']),value:z.string().trim().min(3).max(500),source:z.string().max(80),sourceUrl:z.string().url().nullable(),establishmentSiret:z.string().regex(/^\d{14}$/).optional(),expectedCurrentValue:z.string().nullable(),confirmed:z.literal(true)}).strict().parse(req.body);
  const outcome=await db.transaction(async tx=>{
    const [p]=await tx.select().from(prospectsTable).where(and(eq(prospectsTable.id,id),eq(prospectsTable.tenantId,tenant))).for('update');
    if(!p)return {status:404,error:'Prospect introuvable.'};
    const retained=collectProspectContactPoints(p);
    const point=retained.find(v=>!v.personName&&v.type===data.type&&v.value===data.value&&v.source===data.source&&v.sourceUrl===data.sourceUrl&&(v.establishmentSiret||null)===(data.establishmentSiret||null));
    if(!point)return {status:409,error:'Cette coordonnée ne figure plus dans les preuves. Rechargez la fiche.'};
    if(point.establishmentSiret&&p.siret&&point.establishmentSiret!==p.siret)return {status:409,error:'Cette adresse appartient à un autre établissement. Le SIRET et l’adresse du prospect sont conservés.'};
    if(point.state==='review'&&point.source==='website'&&(p.sourceDetails as any)?.website?.snapshot?.identity==='contradictory')return {status:409,error:'Le site publie une autre identité juridique. Vérifiez d’abord le bon site de l’entreprise.'};
    if((p[data.type]||null)===data.value)return {status:200,alreadyApplied:true};
    if((p[data.type]||null)!==data.expectedCurrentValue)return {status:409,error:'La coordonnée principale a été modifiée. Rechargez la fiche avant de choisir.'};
    const details:any=p.sourceDetails||{},cross=details.crossSource||{},stamp=new Date().toISOString();
    await tx.update(prospectsTable).set({[data.type]:data.value,...(data.type==='address'?{lat:null,lng:null}:{}),sourceDetails:{...details,contactPoints:retained,crossSource:{...cross,fieldSources:{...cross.fieldSources,[data.type]:{source:point.source,sourceUrl:point.sourceUrl,capturedAt:stamp,confirmedBy:req.auth!.userId}}}},updatedAt:new Date()}).where(and(eq(prospectsTable.id,id),eq(prospectsTable.tenantId,tenant)));
    await tx.insert(activitiesTable).values({type:'data_update',title:'Enrichissement · coordonnée principale',description:changeDescription(point.source,point.sourceUrl,{[data.type]:{before:p[data.type],after:data.value}},'Coordonnée publiée choisie explicitement par l’utilisateur.',stamp),status:'done',doneAt:new Date(),prospectId:id,tenantId:tenant,createdBy:req.auth!.userId});
    return {status:200,alreadyApplied:false};
  });
  void recordDiagnosticEvent({tenantId:tenant,userId:req.auth!.userId,traceId:req.traceId,level:outcome.status===200?'info':'warn',component:'crm-contacts',code:outcome.status===200?'PRIMARY_COORDINATE_SAVED':'PRIMARY_COORDINATE_CONFLICT',message:outcome.status===200?'Coordonnée principale enregistrée':'Choix de coordonnée à vérifier',source:data.source,prospectId:id,details:{field:data.type,httpStatus:outcome.status,alreadyApplied:outcome.alreadyApplied||false}});
  res.status(outcome.status).json(outcome);
});
router.use((error:unknown,req:any,res:any,_next:any)=>{
  const invalid=error instanceof z.ZodError;
  void recordDiagnosticEvent({tenantId:req.auth?.tenantId,userId:req.auth?.userId,traceId:req.traceId,level:invalid?'warn':'error',component:'crm-contacts',code:invalid?'INVALID_COORDINATE_INPUT':'CONTACT_OPERATION_FAILED',message:invalid?'Choix de coordonnée invalide':'Opération sur les contacts en échec',prospectId:z.string().uuid().safeParse(req.params.id).success?req.params.id:null,details:invalid?{issueCount:error.issues.length}:errorDiagnosticDetails(error)});
  res.status(invalid?400:500).json({error:invalid?'Choisissez une coordonnée publiée et confirmez votre choix.':'L’enregistrement ou la lecture des contacts a échoué. Consultez le diagnostic.',traceId:req.traceId});
});
export default router;
