export function prospectEnrichmentUrl(prospectId:string,source='societe_com'){
  return '/navigateur?'+new URLSearchParams({source,prospectId}).toString();
}
export function prospectReviewReturnUrl(prospectId:string,jobId?:string){
  return '/prospects/'+encodeURIComponent(prospectId)+'?'+new URLSearchParams({view:'enrichments',...(jobId?{reviewedJob:jobId}:{})}).toString();
}
export function prospectViewFromSearch(search:string):'overview'|'relations'|'enrichments'{
  const view=new URLSearchParams(search).get('view');
  return view==='enrichments'||view==='relations'?view:'overview';
}

export const enrichmentSourceLabel=(source:string)=>({societe_com:'Societe.com',entreprises:'Annuaire des Entreprises',website:'le site web',google_maps:'Google Maps',google_search:'Google Search',pagesjaunes:'PagesJaunes',pappers:'Pappers',bing:'Bing',linkedin:'LinkedIn'} as Record<string,string>)[source]||source;
