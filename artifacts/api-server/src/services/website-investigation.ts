import {publicSocialReference} from '@workspace/api-zod';
import {publicSiteHtml,siteUrl,siteHost,readSiteHtml} from './website-contact-data';
const words=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const personName=(v:string)=>v.replace(/\s*[|·].*$/,'').split(/\s+[-–]\s+/)[0].trim();
export async function readLinkedPeople(socials:{url:string;sourceUrl:string;kind?:string;nameHint?:string}[],company:string,options:{load?:(url:URL)=>Promise<{url:string;html:string}>}={}){
  const people=[];
  for(const social of socials.filter(s=>s.kind==='person').slice(0,2)){
    const ref=publicSocialReference(social.url);if(!ref||ref.source!=='linkedin'||ref.kind!=='person')continue;
    const clue:{name:string|null;nameState:'candidate'|'observed';profileUrl:string;sourceUrl:string;association:string;reasonCode:string;role?:string}={name:ref.nameHint||null,nameState:'candidate',profileUrl:ref.url,sourceUrl:social.sourceUrl,association:'linked_by_website',reasonCode:'PROFILE_URL_HINT'};
    try{
      const u=siteUrl(ref.url),response=await (options.load||((url:URL)=>publicSiteHtml(url,siteHost(u))))(u);
      const actual=publicSocialReference(response.url);if(actual?.url!==ref.url)throw Error('Profil public non accessible.');
      const read=readSiteHtml(response.html,response.url);
      const title=response.html.match(/<title[^>]*>([^<]{2,250})<\/title>/i)?.[1]||'';
      const name=personName(read.heading||title);
      const tokens=name.split(/\s+/);
      if(tokens.length<2||tokens.length>5||!/^[\p{L} .’'-]+$/u.test(name)||/sign in|log in|connexion|linkedin|join|inscri/i.test(name))throw Error('Nom public non lisible.');
      clue.name=name;clue.nameState='observed';clue.association=company&&(' '+words(read.text)+' ').includes(' '+words(company)+' ')?'company_mentioned_on_profile':'linked_by_website';clue.reasonCode='PUBLIC_PROFILE_READ';
    }catch{clue.reasonCode='PUBLIC_PROFILE_UNAVAILABLE';}
    people.push(clue);
  }
  return people;
}
