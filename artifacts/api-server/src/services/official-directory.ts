import {DEPARTMENT_TO_REGION,departmentFromPostalCode} from '../lib/france-geo';
import {activityLabel} from '@workspace/db';
import {companySnapshot} from './prospect-monitoring';
const rows=(v:any)=>Array.isArray(v)?v.filter(x=>x&&typeof x==='object'):[];
const strings=(v:any):string[]=>Array.isArray(v)?v.flatMap(strings):typeof v==='string'&&v.trim()?[v.trim()]:[];
export function directoryCandidates(legal:any){
  const sites=[...rows(legal.matching_etablissements),...(legal.siege?[legal.siege]:[])];
  return [...new Map(sites.filter(s=>/^\d{14}$/.test(s.siret||'')&&s.siret.startsWith(legal.siren)).map(site=>{
    const aliases=[...strings(legal.nom_complet),...strings(legal.nom_raison_sociale),...strings(site.nom_commercial),...strings(site.noms_commerciaux),...strings(site.liste_enseignes),...strings(site.enseigne)];
    const ape=site.activite_principale||legal.activite_principale;
    return [site.siret,{source:'entreprises',company:String(legal.nom_complet||legal.nom_raison_sociale||aliases[0]||'').slice(0,160),aliases,tradeNames:[...strings(site.nom_commercial),...strings(site.noms_commerciaux),...strings(site.liste_enseignes),...strings(site.enseigne)],
      siren:legal.siren,siret:site.siret,address:site.adresse||null,codePostal:site.code_postal||null,city:site.libelle_commune||null,
      apeCode:ape||null,apeScope:site.activite_principale?'etablissement':'unite_legale',nafLabel:activityLabel(ape)||null,nafVersion:site.nomenclature_activite_principale||legal.nomenclature_activite_principale||null,
      region:site.code_region||site.region||DEPARTMENT_TO_REGION[site.code_departement||site.departement||departmentFromPostalCode(site.code_postal||'')],departement:site.code_departement||site.departement||departmentFromPostalCode(site.code_postal||''),
      sourceUrl:'https://annuaire-entreprises.data.gouv.fr/entreprise/'+legal.siren,
      snapshot:companySnapshot(legal,site.siret)}];
  })).values()];
}
export async function fetchDirectory(query:string,area='',page=1,filters?:{regions?:string[];departements?:string[];codesPostaux?:string[]}){
  const url=new URL(process.env.GROWTHOS_SMOKE_TEST==='true'&&process.env.COMPANY_DIRECTORY_API_URL||'https://recherche-entreprises.api.gouv.fr/search');
  const identifier=/^\d{9}(?:\d{5})?$/.test(query.trim());
  url.searchParams.set('q',identifier?query.trim():[query.trim(),!/^\d{2,5}$/.test(area)?area:''].filter(Boolean).join(' '));
  if(filters?.regions?.length)url.searchParams.set('region',filters.regions.join(','));
  if(filters?.departements?.length)url.searchParams.set('departement',filters.departements.join(','));
  if(filters?.codesPostaux?.length)url.searchParams.set('code_postal',filters.codesPostaux.join(','));
  else if(/^\d{5}$/.test(area))url.searchParams.set('code_postal',area);
  else if(/^\d{2,3}$/.test(area))url.searchParams.set('departement',area);
  url.searchParams.set('per_page','25');url.searchParams.set('page',String(page));url.searchParams.set('limite_matching_etablissements','100');
  const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(12000),headers:{Accept:'application/json'}});
  if(!response.ok)throw Error('Annuaire officiel : HTTP '+response.status);
  const body=await response.text();if(body.length>2500000)throw Error('Réponse officielle trop volumineuse');
  const data=JSON.parse(body);if(!Array.isArray(data.results))throw Error('Réponse officielle invalide');
  return {legals:data.results,candidates:data.results.flatMap(directoryCandidates),hasMore:page<Number(data.total_pages||1)};
}
export async function collectDirectoryPage(job:any){
  const page=Number(job.result?.pageCursor?.page||1),filters={regions:[],departements:[],codesPostaux:[],...job.result?.criteria};
  if(!filters.codesPostaux.length&&/^\d{5}$/.test(job.area))filters.codesPostaux=[job.area];
  if(!filters.departements.length&&/^(?:\d{2,3}|2[AB])$/.test(job.area))filters.departements=[job.area];
  const data=await fetchDirectory(job.query,job.area,page,filters);
  const captures=data.candidates.filter((c:any)=>c.company&&c.address&&/^\d{5}$/.test(c.codePostal||'')&&
    (!/^\d{14}$/.test(job.query)||c.siret===job.query)&&
    (!filters?.codesPostaux?.length||filters.codesPostaux.includes(c.codePostal))&&
    (!filters?.regions?.length||filters.regions.includes(c.region))&&
    (!filters?.departements?.length||filters.departements.some((d:string)=>c.departement===d||c.codePostal.startsWith(d)))
  ).map(({snapshot,aliases,region,departement,...capture}:any)=>capture);
  return {status:'completed',results:captures,drafts:[],hasMore:data.hasMore,cursor:{source:'entreprises',page:page+1},message:'Annuaire officiel · page '+page};
}
