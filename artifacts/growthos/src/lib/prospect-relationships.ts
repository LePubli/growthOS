export type RelationshipNode={id:string;name:string;kind:'company'|'person';x:number;y:number;subtitle:string;url:string;note?:string;historical?:boolean;website?:string};
export type RelationshipEdge={from:string;to:string;label:string;historical?:boolean};
export type RelationshipData={nodes:RelationshipNode[];edges:RelationshipEdge[];source:string;capturedAt:string};
const clean=(v:unknown)=>typeof v==='string'?v.trim():'';
export function collectedRelationships(p:{siren?:string|null;siret?:string|null;company?:string|null;website?:string|null;sourceDetails?:Record<string,any>|null}):RelationshipData|null{
  const siren=(p.siren||p.siret||'').replace(/\D/g,'').slice(0,9);if(siren.length!==9)return null;
  for(const source of ['societe_com','pappers']){
    const record=p.sourceDetails?.[source],details=record?.companyDetails;if(!details)continue;
    let url:URL;try{url=new URL(record.sourceUrl);}catch{continue;}
    const expected=source==='societe_com'?'societe.com':'pappers.fr';
    if(url.protocol!=='https:'||url.username||url.password||url.port||url.hostname.replace(/^www\./,'')!==expected||!(source==='societe_com'?new RegExp('-'+siren+'\\.html/?$'):new RegExp('(?:/|-)'+siren+'/?$')).test(url.pathname))continue;
    const people=new Map<string,{name:string;role:string;profileUrl:string}>();
    for(const person of [...(Array.isArray(details.managerContacts)?details.managerContacts:[]),...(Array.isArray(details.managers)?details.managers:[]).map((name:string)=>({name}))]){
      const name=clean(person.name),key=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();if(!name||people.has(key))continue;
      let profile=url.href;try{const link=new URL(person.profileUrl);if(link.protocol==='https:'&&!link.username&&!link.password&&link.hostname.replace(/^www\./,'')===expected)profile=link.href;}catch{}
      people.set(key,{name,role:clean(person.role)||'Dirigeant · fonction non publiée',profileUrl:profile});
    }
    if(!people.size)continue;
    const center='company_'+siren,nodes:RelationshipNode[]=[{id:center,name:p.company||'Entreprise '+siren,kind:'company',x:510,y:290,subtitle:'SIREN '+siren,url:url.href,website:p.website||undefined}],edges:RelationshipEdge[]=[];
    [...people.values()].forEach((person,index)=>{const id=source+'_person_'+index,angle=2*Math.PI*index/people.size-Math.PI/2;
      const historical=/ancien|ancienne|cess[eé]|termin[eé]/i.test(person.role);
      nodes.push({id,name:person.name,kind:'person',x:510+360*Math.cos(angle),y:290+200*Math.sin(angle),subtitle:person.role,url:person.profileUrl,historical});edges.push({from:id,to:center,label:person.role,historical});});
    const date=new Date(record.capturedAt||0);
    return {nodes,edges,source:url.href,capturedAt:Number.isFinite(date.getTime())&&date.getTime()?date.toLocaleDateString('fr-FR'):'Date non communiquée'};
  }
  return null;
}
