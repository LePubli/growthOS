export function prospectEnrichmentUrl(prospectId:string,source='societe_com'){
  return '/navigateur?'+new URLSearchParams({source,prospectId}).toString();
}
