import {createHash,randomUUID} from 'node:crypto';
import {pool} from '@workspace/db';
import {collectProspectContactPoints,collectProspectPeople} from '@workspace/api-zod';
export class ProspectMergeError extends Error {constructor(public status:number,message:string){super(message);}}
export const mergeFields=['company','firstName','lastName','email','phone','website','address','city','postalCode','jobTitle','linkedinUrl','apeCode','nafLabel','nafVersion'] as const;
const columns:Record<string,string>={company:'company',firstName:'first_name',lastName:'last_name',email:'email',phone:'phone',website:'website',address:'address',city:'city',postalCode:'postal_code',jobTitle:'job_title',linkedinUrl:'linkedin_url',apeCode:'ape_code',nafLabel:'naf_label',nafVersion:'naf_version'};
const digits=(s:any)=>String(s||'').replace(/\s/g,'');
const mapped=(p:any)=>({...p,firstName:p.first_name,lastName:p.last_name,jobTitle:p.job_title,sourceUrl:p.source_url,sourceDetails:p.source_details});
const hash=(v:any)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export async function siretDuplicate(tenant:string,id:string,siret:unknown){
 const value=digits(siret);if(!/^\d{14}$/.test(value))return null;
 return (await pool.query("SELECT id,company,siret,address,city FROM prospects WHERE tenant_id=$1 AND id<>$2 AND regexp_replace(siret,'[[:space:]]','','g')=$3 ORDER BY created_at,id LIMIT 1",[tenant,id,value])).rows[0]||null;
}
export type MergeContext={otherId:string;jobId?:string;runId?:string;captureIndex:number};
async function proof(client:Pick<typeof pool,'query'>,tenant:string,user:string,id:string,other:any,c:MergeContext){
 let evidence:any;
 if(c.jobId){
  const job=(await client.query('SELECT * FROM cloud_browser_jobs WHERE id=$1 AND tenant_id=$2 AND created_by=$3 AND prospect_id=$4 AND mode=\'enrich\'',[c.jobId,tenant,user,id])).rows[0];
  const capture=job?.result?.captures?.[c.captureIndex];
  if(!capture||!['needs_review','awaiting_user'].includes(job.status))throw new ProspectMergeError(409,'La capture à comparer n’est plus disponible. Actualisez la source.');
  evidence={jobId:job.id,capture};
 }else if(c.runId){
  const job=(await client.query('SELECT * FROM prospect_enrichment_jobs WHERE id=$1 AND tenant_id=$2 AND prospect_id=$3',[c.runId,tenant,id])).rows[0];
  const step=Object.values(job?.steps||{}).find((s:any)=>s.duplicateId===other.id) as any;
  if(!step)throw new ProspectMergeError(409,'La proposition de doublon n’est plus disponible. Actualisez le bilan.');
  evidence={runId:job.id,capture:{siret:step.siret},source:step};
 }else throw new ProspectMergeError(400,'Une preuve d’enrichissement est nécessaire pour comparer ce doublon.');
 if(!/^\d{14}$/.test(digits(other.siret))||digits(evidence.capture.siret)!==digits(other.siret))throw new ProspectMergeError(409,'La source et le doublon ne portent pas le même SIRET.');
 return hash(evidence);
}
function compatible(a:any,b:any){
 const sa=digits(a.siret),sb=digits(b.siret),la=digits(a.siren)||sa.slice(0,9),lb=digits(b.siren)||sb.slice(0,9);
 if(sa&&sb&&sa!==sb||la&&lb&&la!==lb)throw new ProspectMergeError(409,'Les identifiants légaux des deux fiches sont différents. Fusion refusée.');
}
const summary=(p:any)=>({id:p.id,company:p.company,siret:p.siret,siren:p.siren,address:p.address,city:p.city,updatedAt:new Date(p.updated_at).toISOString(),fields:Object.fromEntries(Object.entries(columns).map(([key,col])=>[key,p[col]||null]))});
export const mergeArchiveProfile=(p:any)=>({...summary(p),email:p.email,phone:p.phone,source:p.source,sourceUrl:p.source_url,contacts:collectProspectContactPoints(mapped(p)),people:collectProspectPeople(mapped(p))});
export async function previewProspectMerge(tenant:string,user:string,id:string,c:MergeContext){
 if(id===c.otherId)throw new ProspectMergeError(400,'Sélectionnez deux fiches différentes.');
 const rows=(await pool.query('SELECT * FROM prospects WHERE tenant_id=$1 AND id=ANY($2::uuid[])',[tenant,[id,c.otherId]])).rows;
 const a=rows.find(p=>p.id===id),b=rows.find(p=>p.id===c.otherId);if(!a||!b)throw new ProspectMergeError(404,'Fiche prospect introuvable.');
 compatible(a,b);const proofDigest=await proof(pool,tenant,user,id,b,c);
 const activityCounts=(await pool.query('SELECT prospect_id,COUNT(*)::int AS count FROM activities WHERE tenant_id=$1 AND prospect_id=ANY($2::uuid[]) GROUP BY prospect_id',[tenant,[id,c.otherId]])).rows;
 return {mergeKey:randomUUID(),proofDigest,current:summary(a),other:summary(b),activities:activityCounts,contactCounts:[collectProspectContactPoints(mapped(a)).length,collectProspectContactPoints(mapped(b)).length]};
}
const record=(v:any)=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
function combine(a:any,b:any):any {
 if(a===undefined||a===null||a==='')return b;
 if(Array.isArray(a)&&Array.isArray(b))return [...new Map([...a,...b].map(v=>[JSON.stringify(v),v])).values()];
 if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b))return Object.fromEntries([...new Set([...Object.keys(b),...Object.keys(a)])].map(k=>[k,combine(a[k],b[k])]));
 return a;
}
const quote=(s:string)=>'"'+s.replace(/"/g,'""')+'"';
export async function mergeProspects(tenant:string,user:string,id:string,c:MergeContext&{mergeKey:string;proofDigest:string;survivorId:string;expectedVersions:Record<string,string>;replaceFields:string[]}){
 const client=await pool.connect();
 try{
  await client.query('BEGIN');await client.query("SET LOCAL lock_timeout='1500ms'");
  const prior=(await client.query('SELECT * FROM prospect_merge_receipts WHERE id=$1 AND tenant_id=$2',[c.mergeKey,tenant])).rows[0];
  if(prior){if(JSON.stringify(prior.request_ids)!==JSON.stringify([id,c.otherId].sort())||prior.archive.decisionHash!==hash({survivorId:c.survivorId,replaceFields:c.replaceFields,proofDigest:c.proofDigest}))throw new ProspectMergeError(409,'Ce reçu correspond à une autre fusion.');await client.query('COMMIT');return {prospectId:prior.survivor_id,mergeId:prior.id,alreadyMerged:true};}
  const rows=(await client.query('SELECT * FROM prospects WHERE tenant_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR UPDATE',[tenant,[id,c.otherId]])).rows;
  const a=rows.find(p=>p.id===id),b=rows.find(p=>p.id===c.otherId);if(!a||!b)throw new ProspectMergeError(404,'Fiche prospect introuvable ou déjà fusionnée.');
  compatible(a,b);
  if(await proof(client,tenant,user,id,b,c)!==c.proofDigest)throw new ProspectMergeError(409,'La preuve source a changé. Actualisez la comparaison.');
  if(rows.some(p=>new Date(p.updated_at).toISOString()!==c.expectedVersions[p.id]))throw new ProspectMergeError(409,'Une fiche a changé. Actualisez la comparaison avant de fusionner.');
  const keep=rows.find(p=>p.id===c.survivorId),drop=rows.find(p=>p.id!==c.survivorId);if(!keep||!drop)throw new ProspectMergeError(400,'Choix de fiche à conserver invalide.');
  for(const table of ['cloud_browser_jobs','prospect_enrichment_jobs']){
   const jobs=(await client.query(`SELECT status FROM ${table} WHERE tenant_id=$1 AND prospect_id=ANY($2::uuid[]) FOR UPDATE NOWAIT`,[tenant,[id,c.otherId]])).rows;
   if(jobs.some(j=>['queued','running'].includes(j.status)))throw new ProspectMergeError(423,'Une collecte est en cours sur une des fiches. Attendez sa fin avant de fusionner.');
  }
  const monitors=(await client.query('SELECT * FROM prospect_monitoring WHERE tenant_id=$1 AND prospect_id=ANY($2::uuid[]) FOR UPDATE NOWAIT',[tenant,[id,c.otherId]])).rows;
  if(monitors.some(m=>m.lease_token&&m.lease_until&&new Date(m.lease_until).getTime()>Date.now()))throw new ProspectMergeError(423,'Un contrôle de surveillance est en cours. Réessayez après sa fin.');
  const details=combine(record(keep.source_details),record(drop.source_details));
  details.contactPoints=collectProspectContactPoints({sourceDetails:{contactPoints:[...collectProspectContactPoints(mapped(keep)),...collectProspectContactPoints(mapped(drop))]}});
  details.mergedPeople=combine(collectProspectPeople(mapped(keep)),collectProspectPeople(mapped(drop)));
  details.mergeHistory=[...(record(keep.source_details).mergeHistory||[]),...(record(drop.source_details).mergeHistory||[]),{id:c.mergeKey,fromId:drop.id,fromCompany:drop.company,at:new Date().toISOString()}];
  const snapshots=(await client.query('SELECT * FROM enrichment_data WHERE prospect_id=ANY($1::uuid[])',[rows.map(p=>p.id)])).rows;
  await client.query('INSERT INTO prospect_merge_receipts(id,tenant_id,removed_id,survivor_id,request_ids,archive,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)',[c.mergeKey,tenant,drop.id,keep.id,JSON.stringify([id,c.otherId].sort()),JSON.stringify({prospects:rows,monitoring:monitors,enrichmentData:snapshots,decisionHash:hash({survivorId:c.survivorId,replaceFields:c.replaceFields,proofDigest:c.proofDigest})}),user]);
  // Release the donor identifier only inside this transaction; every subsequent failure rolls it back.
  await client.query('UPDATE prospects SET siret=NULL,siren=NULL WHERE id=$1 AND tenant_id=$2',[drop.id,tenant]);
  const values:any[]=[];const set=Object.entries(columns).map(([key,col])=>{const v=c.replaceFields.includes(key)?drop[col]||keep[col]:keep[col]||drop[col]||null;values.push(v);return quote(col)+'=$'+values.length;});
  const extra:any={siret:keep.siret||drop.siret||null,siren:keep.siren||drop.siren||(keep.siret||drop.siret||'').slice(0,9)||null,source:[...new Set([keep.source,drop.source].filter(Boolean).flatMap((v:string)=>v.split(',')))].join(','),source_details:JSON.stringify(details),is_starred:keep.is_starred||drop.is_starred,notes:[keep.notes,drop.notes&&drop.notes!==keep.notes?'Dossier fusionné — '+(drop.company||drop.id)+'\n'+drop.notes:null].filter(Boolean).join('\n\n')||null};
  if(!keep.address||c.replaceFields.some(f=>['address','city','postalCode'].includes(f))){extra.lat=keep.address?null:drop.lat;extra.lng=keep.address?null:drop.lng;}
  for(const [col,value] of Object.entries(extra)){values.push(value);set.push(quote(col)+'=$'+values.length);}
  values.push(keep.id,tenant);await client.query(`UPDATE prospects SET ${set.join(',')},updated_at=NOW() WHERE id=$${values.length-1} AND tenant_id=$${values.length}`,values);
  if(monitors.length===2){await client.query('UPDATE prospect_monitoring SET enabled=enabled OR $3,interval_hours=LEAST(interval_hours,$4) WHERE prospect_id=$1 AND tenant_id=$2',[keep.id,tenant,monitors.find(m=>m.prospect_id===drop.id).enabled,monitors.find(m=>m.prospect_id===drop.id).interval_hours]);await client.query('DELETE FROM prospect_monitoring WHERE prospect_id=$1 AND tenant_id=$2',[drop.id,tenant]);}
  await client.query('DELETE FROM enrichment_data d USING enrichment_data k WHERE d.prospect_id=$1 AND k.prospect_id=$2 AND d.source_id=k.source_id AND d.data_type=k.data_type',[drop.id,keep.id]);
  // Discover actual foreign keys: future linked tables either move atomically or make the merge roll back.
  const refs=(await client.query(`SELECT DISTINCT n.nspname AS schema,t.relname AS name,a.attname AS col FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=c.conkey[1] WHERE c.contype='f' AND c.confrelid='prospects'::regclass AND cardinality(c.conkey)=1 AND n.nspname='public'`)).rows;
  for(const ref of refs){
   const table=quote(ref.schema)+'.'+quote(ref.name),col=quote(ref.col);
   const scoped=(await client.query('SELECT 1 FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND column_name=$3',[ref.schema,ref.name,'tenant_id'])).rowCount;
   if(scoped&&(await client.query(`SELECT 1 FROM ${table} WHERE ${col}=$1 AND tenant_id<>$2 LIMIT 1`,[drop.id,tenant])).rowCount)throw new ProspectMergeError(409,'Une liaison entre agences est incohérente. Fusion annulée pour préserver les données.');
   await client.query(`UPDATE ${table} SET ${col}=$1 WHERE ${col}=$2`+(scoped?' AND tenant_id=$3':''),scoped?[keep.id,drop.id,tenant]:[keep.id,drop.id]);
  }
  for(const table of ['tasks','mentions'])await client.query(`UPDATE ${table} SET entity_id=$1 WHERE tenant_id=$2 AND entity_type='prospect' AND entity_id=$3`,[keep.id,tenant,drop.id]);
  await client.query(`UPDATE cloud_browser_jobs j SET result=jsonb_set(j.result,'{imports}',(SELECT jsonb_object_agg(k,CASE WHEN v->>'prospectId'=$3 THEN v||jsonb_build_object('prospectId',$1::text) ELSE v END) FROM jsonb_each(j.result->'imports') x(k,v))) WHERE tenant_id=$2 AND jsonb_typeof(result->'imports')='object' AND EXISTS(SELECT 1 FROM jsonb_each(j.result->'imports') x(k,v) WHERE v->>'prospectId'=$3)`,[keep.id,tenant,drop.id]);
  const latest=(await client.query('SELECT * FROM prospect_enrichment_jobs WHERE tenant_id=$1 AND prospect_id=$2 ORDER BY created_at DESC LIMIT 1 FOR UPDATE',[tenant,keep.id])).rows[0];
  if(latest){const steps=latest.steps||{};let pending=false;for(const source of ['entreprises','insee','bodacc','pappers'])if(steps[source]&&['skipped','empty','needs_review','awaiting_user','failed'].includes(steps[source].status)){steps[source]={label:steps[source].label,status:'pending',message:'Doublon fusionné et identité confirmée : nouvelle vérification programmée.'};pending=true;}if(pending)await client.query("UPDATE prospect_enrichment_jobs SET steps=$2,status='queued',updated_at=NOW() WHERE id=$1",[latest.id,JSON.stringify(steps)]);}
  await client.query('DELETE FROM prospects WHERE id=$1 AND tenant_id=$2',[drop.id,tenant]);
  await client.query("INSERT INTO activities(type,title,description,status,done_at,prospect_id,tenant_id,created_by) VALUES('data_update','Fusion de fiches prospect',$1,'done',NOW(),$2,$3,$4)",['Dossier « '+(drop.company||drop.id)+' » regroupé dans « '+(keep.company||keep.id)+' ».\nSIRET : '+(keep.siret||'Non renseigné')+' → '+(keep.siret||drop.siret)+'\nLes deux états avant fusion, les coordonnées, les sources et l’historique sont conservés. Référence : '+c.mergeKey,keep.id,tenant,user]);
  await client.query('COMMIT');return {prospectId:keep.id,mergeId:c.mergeKey,alreadyMerged:false};
 }catch(error){await client.query('ROLLBACK');const code=(error as any)?.code;if(['55P03','40P01'].includes(code))throw new ProspectMergeError(423,'Une opération utilise ces fiches. Réessayez après sa fin.');throw error;}finally{client.release();}
}
