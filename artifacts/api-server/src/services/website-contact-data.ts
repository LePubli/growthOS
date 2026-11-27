import {resolve4,Resolver} from 'node:dns/promises';
import {request as httpsRequest} from 'node:https';
import {request as httpRequest} from 'node:http';
import {validatePublicWebsite,isPublicIPv4} from '../lib/seo/inspectWebsite';
import {professionalSourceUrl} from '@workspace/api-zod';
export function siteUrl(raw:string){const value=raw.trim();const url=new URL(/^https?:\/\//i.test(value)?value:'https://'+value);if(!['http:','https:'].includes(url.protocol)||url.port)throw Error('Adresse du site non prise en charge.');const checked=new URL(url);checked.protocol='https:';validatePublicWebsite(checked.href);url.hash='';return url;}
export const siteHost=(url:URL)=>url.hostname.replace(/^www\./,'');
export async function publicSiteHtml(url:URL,host:string,redirects=0,dependencies={resolve4,httpsRequest,httpRequest}):Promise<{url:string;html:string}>{
  siteUrl(url.href);if(siteHost(url)!==host||redirects>3)throw Error('Redirection hors du site renseigné.');
  const ips=await dependencies.resolve4(url.hostname);if(!ips.length||ips.some(ip=>!isPublicIPv4(ip)))throw Error('Adresse réseau non autorisée.');
  const result=await new Promise<{status:number;location?:string;html:string}>((resolve,reject)=>{
    const req=(url.protocol==='https:'?dependencies.httpsRequest:dependencies.httpRequest)(url,{method:'GET',family:4,timeout:6000,lookup:(_h,_o,cb)=>cb(null,ips[0],4),headers:{'User-Agent':'GrowthOS-ProspectEnrichment/1.0',Accept:'text/html'}},res=>{
      if([301,302,303,307,308].includes(res.statusCode||0)){res.resume();resolve({status:res.statusCode!,location:res.headers.location,html:''});return;}
      if(res.statusCode!==200||!String(res.headers['content-type']).includes('text/html')){res.resume();reject(Error('Site non lisible (HTTP '+res.statusCode+').'));return;}
      const chunks:Buffer[]=[];let bytes=0;res.on('data',(b:Buffer)=>{bytes+=b.length;if(bytes>550000){req.destroy(Error('Page trop volumineuse.'));return;}chunks.push(b);});res.on('error',reject);res.on('end',()=>resolve({status:200,html:Buffer.concat(chunks).toString('utf8')}));
    });req.on('timeout',()=>req.destroy(Error('Site trop lent.')));req.on('error',reject);req.end();
  });
  if(result.location)return publicSiteHtml(siteUrl(new URL(result.location,url).href),host,redirects+1,dependencies);
  return {url:url.href,html:result.html};
}
const entity=(s:string)=>s.replace(/&#(x[0-9a-f]+|\d+);?/gi,(_,v)=>{const n=v[0].toLowerCase()==='x'?parseInt(v.slice(1),16):Number(v);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}).replace(/&(amp|nbsp|quot|apos|lt|gt|commat);/gi,(_,v)=>(({amp:'&',nbsp:' ',quot:'"',apos:"'",lt:'<',gt:'>',commat:'@'} as Record<string,string>)[v.toLowerCase()]||''));
const clean=(s:string)=>entity(s).replace(/\s+/g,' ').trim();
export function readSiteHtml(html:string,url:string){
  // Static public HTML only. Ignore scripts, forms, templates and explicitly hidden subtrees.
  const markup=html.replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style|template|noscript|svg|iframe|form)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
  const stack:{tag:string;hidden:boolean;anchor?:{href:string;label:string}}[]=[],links:{href:string;label:string}[]=[],parts:string[]=[];let heading='',headingDepth=0,sectionTitle='',sectionDepth=0,excludedSection=false;
  for(const m of markup.matchAll(/<\/?([a-z][\w:-]*)\b([^>]*?)>|([^<]+)/gi)){
    if(m[3]!==undefined){if(!stack.some(s=>s.hidden)){const text=entity(m[3]);if(sectionDepth)sectionTitle+=text;if(!excludedSection)parts.push(text);if(headingDepth)heading+=text;const anchor=[...stack].reverse().find(s=>s.anchor)?.anchor;if(anchor)anchor.label+=text;}continue;}
    const tag=m[1].toLowerCase(),closing=m[0].startsWith('</');
    if(closing){const i=stack.map(s=>s.tag).lastIndexOf(tag);if(i>=0){for(const node of stack.splice(i))if(node.anchor&&!node.hidden&&!excludedSection)links.push({href:node.anchor.href,label:clean(node.anchor.label)});}if(tag==='h1')headingDepth=0;if(/^h[1-6]$/.test(tag)&&sectionDepth){excludedSection=/h[ée]berg|hosting|conception du site|cr[ée]ation du site/i.test(sectionTitle);sectionDepth=0;}if(/^(p|div|li|br|address|h[1-6]|section|article|tr)$/.test(tag))parts.push('\n');continue;}
    if(/^h[1-6]$/.test(tag)){sectionTitle='';sectionDepth=1;excludedSection=false;}
    const attrs:Record<string,string>={};for(const a of m[2].matchAll(/([^\s=/'">]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))attrs[a[1].toLowerCase()]=entity(a[2]??a[3]??a[4]??'');
    const hidden=stack.some(s=>s.hidden)||'hidden' in attrs||attrs['aria-hidden']==='true'||/display\s*:\s*none|visibility\s*:\s*hidden/i.test(attrs.style||'')||['head','script','style','form','template','noscript','svg','iframe'].includes(tag);
    if(/^(p|div|li|br|address|h[1-6])$/.test(tag))parts.push('\n');
    if(tag==='h1'&&!hidden&&!heading)headingDepth=stack.length+1;
    if(!['area','base','br','hr','img','input','link','meta','source','wbr'].includes(tag))stack.push({tag,hidden,...(tag==='a'&&attrs.href?{anchor:{href:attrs.href,label:''}}:{})});
  }
  const text=parts.join('').replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n').trim();
  const emails=new Set<string>(),phones=new Set<string>();
  const addEmail=(v:string)=>{const value=v.trim().toLowerCase();if(value.length<=254&&/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(value)&&!/\.(png|jpg|jpeg|gif|svg|webp|woff2?)$/i.test(value))emails.add(value);};
  for(const link of links){if(/^mailto:/i.test(link.href)){try{decodeURIComponent(link.href.slice(7).split('?')[0]).split(/[;,]/).forEach(addEmail);}catch{}}if(/^tel:/i.test(link.href)){const phone=link.href.slice(4).replace(/[ .()-]/g,'');if(/^(?:\+33|0)[1-9]\d{8}$/.test(phone))phones.add(phone.replace(/^\+33/,'0'));}}
  for(const m of text.matchAll(/\b[A-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+\b/gi))addEmail(m[0]);
  for(const m of text.matchAll(/(?<!\d)(?:\+33\s?|0)[1-9](?:[ .-]?\d{2}){4}(?!\d)/g))phones.add(m[0].replace(/[ .-]/g,'').replace(/^\+33/,'0'));
  const ids=(label:string,length:number)=>[...new Set([...text.matchAll(new RegExp('\\b'+label+'\\s*(?:[nN]°)?\\s*[:#-]?\\s*((?:\\d[ .-]?){'+length+'})(?!\\d)','gi'))].map(m=>m[1].replace(/\D/g,'')))];
  const publisherNames=[...text.matchAll(/(?:raison\s+sociale|d[ée]nomination\s+(?:sociale|de\s+l[’']entreprise)|(?:le\s+)?site[^\n]{0,100}(?:est\s+)?[ée]dit[ée]\s+par|[ée]diteur(?:\s+du\s+site)?)\s*[:：]\s*([^\n]{2,160})/gi)].map(m=>clean(m[1])).filter(v=>!/^https?:|siret|siren/i.test(v));
  const apeCodes=[...new Set([...text.matchAll(/(?:code\s+)?(?:APE|NAF)(?:\s*\/\s*(?:APE|NAF))?\s*[:：-]\s*(\d{2}[ .]?\d{2}[A-Z])/gi)].map(m=>m[1].replace(/[ .]/g,'').replace(/^(\d{2})(\d{2}[A-Z])$/,'$1.$2')))];
  const addresses=[...text.matchAll(/\b\d{1,4}\s*(?:(?:bis|ter)\s+)?(?:rue|boulevard|bd\.?|avenue|av\.?|route|place|chemin|impasse|all[ée]e|quai)\s+[^\n]{3,180}?[, \n]+\b\d{5}[ \t]+[^\n,;]{2,70}/gi)].map(m=>clean(m[0]));
  const socials:{source:string;url:string;sourceUrl:string}[]=[];
  for(const link of links)for(const source of ['linkedin','facebook','instagram','tiktok']){let target:string|null=null;try{target=professionalSourceUrl(source,new URL(link.href,url).href);}catch{}if(target&&!socials.some(s=>s.source===source&&s.url===target))socials.push({source,url:target,sourceUrl:url});}
  return {heading:clean(heading),text,publisherNames,apeCodes,emails:[...emails].slice(0,30),phones:[...phones].slice(0,20),sirets:ids('SIRET',14),sirens:ids('SIREN',9),addresses:addresses.slice(0,10),socials,links};
}
export type MailDomainCheck={status:'mx'|'implicit_mx'|'no_mail'|'unknown';detail:string};
export async function mailDomainCheck(domain:string,resolver:Pick<Resolver,'resolveMx'|'resolve4'|'resolve6'>=new Resolver({timeout:1500,tries:1})):Promise<MailDomainCheck>{
  try{siteUrl('https://'+domain);}catch{return {status:'no_mail',detail:'Domaine invalide ou non public.'};}
  try{const mx=await resolver.resolveMx(domain);if(mx.length&&mx.every(m=>!m.exchange||m.exchange==='.'))return {status:'no_mail',detail:'Le domaine déclare ne pas recevoir de courrier (Null MX).'};
    if(mx.some(m=>m.exchange&&m.exchange!=='.'))return {status:'mx',detail:'Serveur de réception déclaré. Existence de la boîte non confirmée.'};
  }catch(e:any){if(e.code==='ENOTFOUND')return {status:'no_mail',detail:'Domaine introuvable.'};if(e.code!=='ENODATA')return {status:'unknown',detail:'Contrôle DNS indisponible. Existence de la boîte non confirmée.'};}
  const answers=await Promise.allSettled([resolver.resolve4(domain),resolver.resolve6(domain)]);
  return answers.some(r=>r.status==='fulfilled'&&r.value.length)?{status:'implicit_mx',detail:'Adresse réseau présente, réception de courrier et boîte non confirmées.'}:{status:'unknown',detail:'Aucun serveur de réception confirmé.'};
}
export async function collectSite(raw:string,options:{load?:(url:URL)=>Promise<{url:string;html:string}>;mail?:(domain:string)=>Promise<MailDomainCheck>}={}){
  const initial=siteUrl(raw),host=siteHost(initial),load=options.load||((url:URL)=>publicSiteHtml(url,host));
  const pending=[initial],seen=new Set<string>(),pages:any[]=[],deadline=Date.now()+45000;
  while(pending.length&&pages.length<7&&Date.now()<deadline){
    const target=pending.shift()!;if(seen.has(target.href))continue;seen.add(target.href);
    try{const response=await load(target),actual=siteUrl(response.url);if(siteHost(actual)!==host)throw Error('Le domaine du site a changé.');
      const read=readSiteHtml(response.html,actual.href);pages.push({url:actual.href,read});
      for(const link of [...read.links].sort((a,b)=>Number(/mentions|legal/i.test(b.href+' '+b.label))-Number(/mentions|legal/i.test(a.href+' '+a.label)))){if(!/contact|mentions?[-_ /]?l[eé]gal|qui[-_ /]?sommes|[àa][- ]propos|about/i.test(link.label+' '+link.href))continue;try{const u=siteUrl(new URL(link.href,actual).href);if(siteHost(u)===host&&!seen.has(u.href)&&!pending.some(p=>p.href===u.href))pending.push(u);}catch{}}
      if(pages.length===1&&!pending.length)for(const path of ['/mentions-legales/','/contact/']){const fallback=siteUrl(new URL(path,initial).href);if(!seen.has(fallback.href))pending.push(fallback);}
    }catch(error){if(!pages.length)throw error;}
  }
  const emails=[...new Map(pages.flatMap(p=>p.read.emails.map((email:string)=>[email,{email,sourceUrl:p.url,origin:'published'}]))).values()] as {email:string;sourceUrl:string;origin:string;check?:MailDomainCheck}[];
  const cache=new Map<string,MailDomainCheck>(),mail=options.mail||mailDomainCheck;
  for(const domain of [...new Set([host,...emails.map(e=>e.email.split('@')[1])])].slice(0,6))cache.set(domain,await mail(domain));
  for(const email of emails)email.check=cache.get(email.email.split('@')[1])||{status:'unknown',detail:'Contrôle DNS non effectué.'};
  const domainCheck=cache.get(host)!;
  return {url:initial.href,pages:pages.map(p=>({url:p.url,heading:p.read.heading})),publishers:pages.flatMap(p=>p.read.publisherNames.map((name:string)=>({name,sourceUrl:p.url}))),apeCodes:[...new Set(pages.flatMap(p=>p.read.apeCodes))] as string[],emails,
    phones:[...new Map(pages.flatMap(p=>p.read.phones.map((phone:string)=>[phone,{phone,sourceUrl:p.url}]))).values()] as {phone:string;sourceUrl:string}[],
    socials:[...new Map<string,{source:string;url:string;sourceUrl:string}>(pages.flatMap(p=>p.read.socials.map((v:any)=>[v.source+':'+v.url,v] as [string,{source:string;url:string;sourceUrl:string}]))).values()],sirets:[...new Set(pages.flatMap(p=>p.read.sirets))] as string[],sirens:[...new Set(pages.flatMap(p=>p.read.sirens))] as string[],
    addresses:[...new Map(pages.flatMap(p=>p.read.addresses.map((address:string)=>[address,{address,sourceUrl:p.url}]))).values()] as {address:string;sourceUrl:string}[],
    text:pages.map(p=>p.read.text).join('\n'),domainCheck,
    suggestions:!emails.length&&domainCheck.status!=='no_mail'?['contact','info','bonjour','service-client'].map(local=>({email:local+'@'+host,origin:'hypothesis',mailboxStatus:'unconfirmed',check:domainCheck})):[]};
}
