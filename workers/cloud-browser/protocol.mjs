import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';

export const SOURCES=['google_maps','google_search','bing','societe_com','pagesjaunes','linkedin','facebook','instagram','tiktok'];
export const AUTOMATIC=['google_maps','google_search','bing','societe_com'];
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export class InputError extends Error{constructor(message){super(message);this.status=400;}}
export function scope(input){
  if(!input || !UUID.test(input.tenantId||'') || !UUID.test(input.profileId||'') || !SOURCES.includes(input.source))throw new InputError('Profil navigateur invalide');
  return {tenantId:input.tenantId,profileId:input.profileId,source:input.source};
}
export function searchUrl(source,query='',area='',login=false){
  if(!SOURCES.includes(source))throw new InputError('Source inconnue');
  if(typeof query!=='string'||typeof area!=='string'||query.length>160||area.length>120)throw new InputError('Critères invalides');
  const term=[query.trim(),area.trim()].filter(Boolean).join(' '),q=encodeURIComponent(term);
  const urls={google_maps:'https://www.google.com/maps/search/'+q,google_search:'https://www.google.com/search?q='+q,
    bing:'https://www.bing.com/search?q='+q,societe_com:'https://www.societe.com/recherche?q='+encodeURIComponent(query.trim())+'&ftStatus=0',
    pagesjaunes:'https://www.pagesjaunes.fr/annuaire/chercherlespros?quoiqui='+encodeURIComponent(query.trim())+'&ou='+encodeURIComponent(area.trim()),
    linkedin:'https://www.linkedin.com/search/results/companies/?keywords='+q,
    facebook:'https://www.facebook.com/search/pages/?q='+q,instagram:'https://www.instagram.com/explore/search/keyword/?q='+q,
    tiktok:'https://www.tiktok.com/search/user?q='+q};
  const homes={google_maps:'https://www.google.com/maps/',google_search:'https://www.google.com/',bing:'https://www.bing.com/',
    societe_com:'https://www.societe.com/',pagesjaunes:'https://www.pagesjaunes.fr/',linkedin:'https://www.linkedin.com/login',
    facebook:'https://www.facebook.com/login/',instagram:'https://www.instagram.com/accounts/login/',tiktok:'https://www.tiktok.com/login'};
  // Google OAuth is a separate integration; this does not emulate its consent flow.
  return login||!term?homes[source]:urls[source];
}
const roots={google_maps:['google.com','google.fr'],google_search:['google.com','google.fr'],bing:['bing.com','microsoft.com','live.com'],
  societe_com:['societe.com'],pagesjaunes:['pagesjaunes.fr'],linkedin:['linkedin.com'],facebook:['facebook.com'],instagram:['instagram.com','facebook.com'],tiktok:['tiktok.com']};
const assets={google_maps:['gstatic.com','googleapis.com','googleusercontent.com'],google_search:['gstatic.com','googleapis.com','googleusercontent.com'],
  bing:['bing.net','microsoftonline.com','msauth.net'],societe_com:[],pagesjaunes:['pjms.fr','solocal.com'],linkedin:['licdn.com'],
  facebook:['fbcdn.net','fbsbx.com'],instagram:['cdninstagram.com','fbcdn.net'],tiktok:['tiktokcdn.com','tiktokcdn-eu.com','ttwstatic.com','byteoversea.com']};
export function sourceResource(source,value){
  try{const u=new URL(value);return [...(roots[source]||[]),...(assets[source]||[]),'didomi.io','privacy-center.org','captcha-delivery.com','datadome.co','geetest.com']
    .some(host=>u.hostname===host||u.hostname.endsWith('.'+host));}catch{return false;}
}
export function sourceNavigation(source,value){
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&
    roots[source]?.some(host=>u.hostname===host||u.hostname.endsWith('.'+host));}catch{return false;}
}
export function publicAddress(address){
  if(isIP(address)===4){const b=address.split('.').map(Number);return !(b[0]===0||b[0]===10||b[0]===127||b[0]>=224||
    (b[0]===169&&b[1]===254)||(b[0]===172&&b[1]>=16&&b[1]<=31)||(b[0]===192&&b[1]===168)||
    (b[0]===100&&b[1]>=64&&b[1]<=127)||(b[0]===198&&(b[1]===18||b[1]===19||b[1]===51&&b[2]===100))||
    (b[0]===192&&b[1]===0)||(b[0]===192&&b[1]===88&&b[2]===99)||(b[0]===203&&b[1]===0&&b[2]===113));}
  if(isIP(address)===6){const a=address.toLowerCase();return /^[23]/.test(a)&&!a.startsWith('2002:')&&!/^2001:(?:0:|db8:)/.test(a);}
  return false;
}
export async function publicRequest(value,resolver=lookup){
  try{
    const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port)return false;
    const host=u.hostname.toLowerCase();if(host==='localhost'||host.endsWith('.local')||host.endsWith('.internal')||isIP(host))return false;
    const answers=await resolver(host,{all:true,verbatim:true});return answers.length>0&&answers.every(a=>publicAddress(a.address));
  }catch{return false;}
}
export function actionInput(input){
  const event=input?.event;
  if(!event || !['click','text','key','scroll','back'].includes(event.type))throw new InputError('Action invalide');
  if(event.type==='click' && (!Number.isFinite(event.x)||!Number.isFinite(event.y)||event.x<0||event.x>1279||event.y<0||event.y>799))throw new InputError('Coordonnées invalides');
  if(event.type==='text' && (typeof event.text!=='string'||event.text.length>2000))throw new InputError('Texte invalide');
  if(event.type==='key' && !['Enter','Tab','Backspace','Delete','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Escape','Home','End','Control+A'].includes(event.key))throw new InputError('Touche invalide');
  if(event.type==='scroll' && (!Number.isFinite(event.deltaY)||Math.abs(event.deltaY)>2000))throw new InputError('Défilement invalide');
  return event;
}
