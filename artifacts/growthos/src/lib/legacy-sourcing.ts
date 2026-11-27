export function legacySourcingTarget(search:string,id?:string){
  const params=new URLSearchParams(search),sources=['entreprises','pagesjaunes','google_maps','google_search','bing','societe_com','linkedin','facebook','instagram','tiktok'];
  if(!sources.includes(params.get('source')||''))params.set('source','entreprises');
  if(id)params.set('legacyJobId',id);
  return '/navigateur?'+params.toString();
}
