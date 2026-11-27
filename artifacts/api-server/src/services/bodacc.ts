import {db,prospectsTable,activitiesTable} from '@workspace/db';
import {and,eq,sql} from 'drizzle-orm';
import {isDeepStrictEqual} from 'node:util';
import {changeDescription} from '../lib/prospect-change-history';
const record=(v:any):Record<string,any>=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
export async function fetchBodaccPage(siren:string,offset=0){
  if(!/^\d{9}$/.test(siren)||!Number.isSafeInteger(offset)||offset<0)throw Error('SIREN ou pagination BODACC invalide.');
  const url=new URL(process.env.GROWTHOS_SMOKE_TEST==='true'&&process.env.BODACC_TEST_URL||'https://www.bodacc.fr/api/explore/v2.1/catalog/datasets/annonces-commerciales/records');
  url.searchParams.set('where','search(registre,"'+siren+'")');url.searchParams.set('order_by','dateparution desc,id desc');
  url.searchParams.set('limit','100');url.searchParams.set('offset',String(offset));
  const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(15000),headers:{Accept:'application/json'}});
  if(!response.ok)throw Error('BODACC : HTTP '+response.status);
  const raw=await response.text();if(raw.length>2500000)throw Error('Réponse BODACC trop volumineuse.');
  const data=JSON.parse(raw);if(!Array.isArray(data.results)||!Number.isSafeInteger(data.total_count)||data.total_count<0)throw Error('Réponse BODACC invalide.');
  const announcements=data.results.flatMap((r:any)=>{
    const identifiers=[].concat(r.registre||[]).flatMap((v:any)=>String(v).split(/[,;|]/)).map((v:string)=>v.replace(/\s/g,''));
    if(!identifiers.includes(siren)||!/^\d{4}-\d{2}-\d{2}$/.test(r.dateparution||'')||!/^[ABC]\d{5,30}$/.test(r.id||''))return [];
    const detail=['jugement','modificationsgenerales','radiationaurcs','depot','acte'].flatMap(key=>{
      const value=r[key];if(!value)return [];try{return [JSON.stringify(typeof value==='string'?JSON.parse(value):value).slice(0,2000)];}catch{return [String(value).slice(0,2000)];}
    }).join('\n').slice(0,6000);
    return [{id:r.id,date:r.dateparution,type:String(r.familleavis_lib||r.typeavis_lib||'Annonce').slice(0,180),company:String(r.commercant||'').slice(0,160),tribunal:String(r.tribunal||'').slice(0,250),details:detail,
      url:'https://www.bodacc.fr/pages/annonces-commerciales-detail/?q.id=id:'+encodeURIComponent(r.id)}];
  });
  const next=offset+data.results.length;
  return {announcements,total:data.total_count,offset:next,hasMore:data.results.length>0&&next<data.total_count};
}
export async function saveBodaccPage(job:any,siren:string,data:Awaited<ReturnType<typeof fetchBodaccPage>>){
  return db.transaction(async tx=>{
    const lease=await tx.execute(sql`SELECT status,lease FROM prospect_enrichment_jobs WHERE id=${job.id} AND tenant_id=${job.tenant_id} FOR UPDATE`);
    if(lease.rows[0]?.status!=='running'||lease.rows[0]?.lease!==job.lease)throw Error('Tâche interrompue.');
    const [p]=await tx.select().from(prospectsTable).where(and(eq(prospectsTable.id,job.prospect_id),eq(prospectsTable.tenantId,job.tenant_id))).for('update');
    if(!p||(p.siren||p.siret?.slice(0,9))!==siren)throw Error('Identité du prospect modifiée.');
    const details=record(p.sourceDetails),prior=record(details.bodacc);
    const accumulated=prior.pending?.enrichmentRunId===job.id&&prior.siren===siren&&Array.isArray(prior.pending.announcements)?prior.pending.announcements:[];
    const collected=[...new Map([...accumulated,...data.announcements].map((v:any)=>[v.id,v])).values()].sort((a:any,b:any)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
    const announcements=data.hasMore?(prior.siren===siren?prior.announcements||[]:[]):collected;
    const changed=!data.hasMore&&(prior.siren!==siren||!isDeepStrictEqual(prior.announcements||[],announcements));
    const now=new Date(),sourceUrl='https://www.bodacc.fr/explore/dataset/annonces-commerciales/?q='+siren;
    const next={siren,announcements,total:data.total,hasMore:data.hasMore,offset:data.offset,pending:data.hasMore?{enrichmentRunId:job.id,announcements:collected}:null,sourceUrl,capturedAt:data.hasMore?prior.capturedAt||now.toISOString():now.toISOString(),
      history:changed&&prior.capturedAt?[...(Array.isArray(prior.history)?prior.history:[]),{siren:prior.siren,announcements:prior.announcements,capturedAt:prior.capturedAt}].slice(-5):prior.history||[]};
    await tx.update(prospectsTable).set({sourceDetails:{...details,bodacc:next},updatedAt:now}).where(and(eq(prospectsTable.id,p.id),eq(prospectsTable.tenantId,job.tenant_id)));
    if(changed)await tx.insert(activitiesTable).values({tenantId:job.tenant_id,prospectId:p.id,createdBy:job.created_by,type:'data_update',title:'Enrichissement · BODACC',status:'done',doneAt:now,
      description:changeDescription('bodacc',sourceUrl,{'Annonces BODACC':{before:prior.announcements||[],after:announcements}},'Annonces officielles rattachées au SIREN exact. Les publications historiques ne remplacent pas le statut actuel de l’établissement.',now.toISOString())});
    return {count:collected.length,changed};
  });
}
