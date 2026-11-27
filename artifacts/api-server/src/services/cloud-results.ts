const normalize=(value:unknown)=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const fields=['source','company','address','codePostal','city','phone','email','website','sourceUrl','siret','siren','apeCode','nafLabel','nafVersion','apeScope','companyDetails','pagesjaunesProfile','mapsDetail'];
function key(c:any){return [c.source,normalize(c.company),normalize(c.address)||String(c.sourceUrl||'').split('#')[0],c.siret||''].join('|');}
export function appendCloudResult(previous:any,data:any,jobId:string,source:string,target=false){
  const captures=[...(previous?.captures||[])],drafts=[...(previous?.drafts||[])];
  const seen=new Set(captures.map(key)),partial=new Set(drafts.map(key));
  for(const raw of Array.isArray(data.results)?data.results:[]){
    if(raw?.source!==source||seen.has(key(raw)))continue;
    const out:any={id:target?'task_'+jobId:'cloud_'+jobId+'_'+captures.length,collectionMode:'visible',capturedAt:Date.now()};
    for(const field of fields)if(raw[field]!==undefined)out[field]=raw[field];captures.push(out);seen.add(key(raw));
  }
  for(const raw of Array.isArray(data.drafts)?data.drafts:[]){
    if(raw?.source!==source||partial.has(key(raw))||seen.has(key(raw)))continue;
    const out:any={id:'draft_'+jobId+'_'+drafts.length,capturedAt:Date.now()};
    for(const field of ['source','company','address','city','phone','website','sourceUrl'])if(raw[field]!==undefined)out[field]=raw[field];
    drafts.push(out);partial.add(key(raw));
  }
  const references=[...new Map([...(previous?.references||[]),...(Array.isArray(data.references)?data.references:[])].flatMap((r:any)=>{
    try{const u=new URL(r.url);return u.protocol==='https:'&&!u.username&&!u.password&&typeof r.label==='string'?[[u.href,{url:u.href.slice(0,1000),label:r.label.slice(0,180)}]]:[];}catch{return [];}
  })).values()].slice(-100);
  return {...previous,captures,drafts,references,message:String(data.message||'').slice(0,500),
    pageCursor:data.hasMore||data.status==='awaiting_user'?data.cursor||previous?.pageCursor||null:null,
    hasMore:!!data.hasMore,progress:{captured:captures.length,drafts:drafts.length,discovered:data.cursor?.pending?.length?captures.length+data.cursor.pending.length:captures.length}};
}
