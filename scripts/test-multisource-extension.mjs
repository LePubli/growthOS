import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const root=new URL('../extensions/growthos-pagesjaunes/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',root),'utf8'));
assert.equal(manifest.manifest_version,3);
assert.equal(manifest.action.default_popup,'popup.html');
assert.ok(!manifest.host_permissions.some(host=>/linkedin|google|bing/.test(host)),
  'La lecture manuelle utilise activeTab : pas de permissions permanentes Google/LinkedIn/Bing');
assert.ok(manifest.host_permissions.includes('https://recherche-entreprises.api.gouv.fr/*'),
  'L’enrichissement officiel utilise une permission limitée au seul annuaire public');
assert.ok(manifest.host_permissions.includes('https://data.geopf.fr/*'),
  'La validation des rues partielles utilise le géocodeur officiel de la Géoplateforme');

const captureScript=readFileSync(new URL('capture.js',root),'utf8');
function capture(url,hasAddress=true,localPack=false){
  const card={
    innerText:localPack
      ? 'Leclerc & Chéry Valnegreen\n3,5 ★★★★ (17) · Plombier\nPlus de 45 ans en activité · Roubaix\nOuvert · 03 20 70 48 97\nSite Web\nItinéraire'
      : hasAddress?'Atelier Test\n14 rue des Tests 59100 Roubaix\nAppeler':'Atelier Test\nRoubaix',
    getClientRects:()=>[{}],
    querySelector:()=>null,
    querySelectorAll:()=>[],
    closest:()=>null,
  };
  const document={body:card,title:'Atelier Test',querySelectorAll:(selector)=>
    selector==='[role="article"]' || selector==='#rhs' || selector==='#b_context' ||
    (selector==='.rllt__details' && localPack)?[card]:[],querySelector:()=>null};
  return vm.runInNewContext(captureScript,{document,location:new URL(url),URL,
    getComputedStyle:()=>({visibility:'visible'})},{timeout:1000});
}
const maps=capture('https://www.google.com/maps/search/plombier');
assert.equal(maps.source,'google_maps');
assert.equal(maps.results.length,1);
assert.equal(maps.results[0].codePostal,'59100');
assert.equal(capture('https://www.bing.com/search?q=plombier').source,'bing');
assert.equal(capture('https://www.google.com/search?q=plombier',false).results.length,0,
  'Aucune fiche sans code postal n’est inventée');
const googleLocal=capture('https://www.google.com/search?q=plombier%2059100',false,true);
assert.equal(googleLocal.results.length,0,'Un CP dans la recherche ne suffit pas pour importer');
assert.equal(googleLocal.drafts.length,1);
assert.equal(googleLocal.drafts[0].company,'Leclerc & Chéry Valnegreen');
assert.equal(googleLocal.drafts[0].phone,'03 20 70 48 97');
assert.equal(googleLocal.drafts[0].codePostal,null);
const partialCard={innerText:'France Dépannage\nPlombier · 35 Av. Jean Lebas\nRoubaix\n03 20 70 48 97',
  getClientRects:()=>[{}],querySelector:()=>null,querySelectorAll:()=>[],closest:()=>null};
const partialDocument={body:partialCard,querySelectorAll:selector=>selector==='[role="article"]'?[partialCard]:[],querySelector:()=>null};
const partial=vm.runInNewContext(captureScript,{document:partialDocument,
  location:new URL('https://www.google.com/maps/search/plombier+59100'),URL,
  getComputedStyle:()=>({visibility:'visible'})},{timeout:1000});
assert.equal(partial.results.length,0,'La rue seule ne prouve pas le code postal');
assert.equal(partial.drafts[0].address,'35 Av. Jean Lebas',
  'La rue affichée doit être conservée pour vérifier le rapprochement officiel');
// Une fiche Maps détaillée possède une vraie adresse dans son bouton Adresse.
// Ne jamais confondre le CP présent dans la requête avec celui du panneau.
const detailsTitle={innerText:'France Dépannage',getClientRects:()=>[{}]};
const addressControl={innerText:'35 Avenue Jean Lebas, 59100 Roubaix',
  getAttribute:key=>key==='aria-label'?'Adresse : 35 Avenue Jean Lebas, 59100 Roubaix':null,
  matches:selector=>selector==='[data-item-id="address"]',getClientRects:()=>[{}]};
const detailsPanel={innerText:'France Dépannage\n35 Avenue Jean Lebas, 59100 Roubaix\n03 20 70 48 97',
  getClientRects:()=>[{}],
  querySelector:selector=>selector==='h1'?detailsTitle:
    selector.startsWith('button[data-item-id^="phone"')?{getAttribute:()=> 'Téléphone : 03 20 70 48 97'}:
    selector.startsWith('a[data-item-id="authority"')?{href:'https://example-pro.fr'}:null,
  querySelectorAll:selector=>selector.includes('[data-item-id="address"]')?[addressControl]:[],
};
const detailsDocument={body:detailsPanel,querySelector:selector=>selector==='[role="main"]'?detailsPanel:null,
  querySelectorAll:()=>[]};
const details=vm.runInNewContext(captureScript,{document:detailsDocument,
  location:new URL('https://www.google.com/maps/place/France-Depannage/'),URL,
  getComputedStyle:()=>({visibility:'visible'})},{timeout:1000});
assert.equal(details.results.length,1);
assert.equal(details.results[0].codePostal,'59100');
assert.equal(details.results[0].company,'France Dépannage');
assert.equal(details.results[0].phone,'03 20 70 48 97');
assert.ok(capture('https://www.linkedin.com/company/test').error,
  'Aucun scraping LinkedIn par le lecteur de pages');

let listener;
const storage={};
const opened=[];
let injectedResult=googleLocal;
let officialResults=[];
const officialRequests=[];
const geocodeRequests=[];
let geocodeResponse={features:[]};
const chrome={
  runtime:{getURL:(path='')=>'chrome-extension://unit-test/'+path,
    onMessage:{addListener:fn=>{listener=fn;}}},
  storage:{local:{get:async key=>({[key]:storage[key]}),set:async changes=>{Object.assign(storage,changes);}}},
  tabs:{create:async data=>{opened.push(data);return{id:12};},
    query:async()=>[{id:42,url:'https://www.google.com/search?q=plombier%2059100'}]},
  scripting:{executeScript:async()=>[{result:injectedResult}]},
};
vm.runInNewContext(readFileSync(new URL('background.js',root),'utf8'),
  {chrome,URL,crypto:webcrypto,Date,setTimeout,clearTimeout,Promise,console,AbortController,
    fetch:async url=>{
      const request=new URL(url);
      if(request.hostname==='data.geopf.fr'){
        geocodeRequests.push(String(url));
        return {ok:true,json:async()=>geocodeResponse};
      }
      officialRequests.push(String(url));
      assert.equal(request.hostname,'recherche-entreprises.api.gouv.fr');
      return {ok:true,json:async()=>({total_results:officialResults.length,results:officialResults})};
    }},{timeout:1500});
const sender={url:'chrome-extension://unit-test/popup.html'};
const growthos={url:'https://agile.le-publicitaire.fr/sourcing'};
function send(action,payload,from=sender){
  return new Promise(resolve=>{listener({action,payload},from,resolve);});
}
const manual=await send('manual-add',{source:'linkedin',company:'Atelier Manuel',
  address:'10 rue de Lille 59100 Roubaix',codePostal:'59100',city:'Roubaix',
  sourceUrl:'https://www.linkedin.com/company/atelier-manuel/'});
assert.equal(manual.added,1);
assert.equal((await send('get-captures',null,growthos)).results.length,1);
assert.equal((await send('get-captures',null,{url:'https://other.example/sourcing'})).ok,false,
  'Aucun autre site ne peut lire les fiches locales');
const forged=await send('manual-add',{source:'linkedin',company:'Fausse fiche',
  address:'10 rue Exemple 59100 Roubaix',codePostal:'59100',sourceUrl:'https://evil-linkedin.example/company/faux'});
assert.equal(forged.ok,false);
const openedPage=await send('open-source',{source:'bing',query:'plombier',area:'Roubaix'});
assert.equal(openedPage.ok,true);
assert.ok(opened[0].url.startsWith('https://www.bing.com/search?q=plombier%20Roubaix'));
const staged=await send('capture-tab');
assert.equal(staged.added,0);
assert.equal(staged.draftAdded,1);
assert.equal((await send('get-captures',null,growthos)).results.length,1,
  'Une fiche incomplète ne doit jamais être envoyée au CRM');
const [draft]=(await send('list-drafts')).drafts;
assert.equal(draft.company,'Leclerc & Chéry Valnegreen');
assert.equal((await send('get-drafts',null,growthos)).drafts.length,1,
  'GrowthOS récupère les brouillons sans adresse pour leur rapprochement officiel');
assert.equal((await send('get-drafts',null,{url:'https://other.example/sourcing'})).ok,false,
  'Une origine étrangère ne peut pas lire les brouillons');
const completed=await send('manual-add',{source:draft.source,draftId:draft.id,company:draft.company,
  address:'12 rue de Lille 59100 Roubaix',codePostal:'59100',city:'Roubaix',phone:draft.phone,
  sourceUrl:draft.sourceUrl});
assert.equal(completed.added,1);
assert.equal((await send('list-drafts')).drafts.length,0);
assert.equal((await send('get-captures',null,growthos)).results.length,2);
injectedResult={source:'google_maps',results:[],drafts:[{
  source:'google_maps',company:'Entreprise Test Vérifiée',address:'35 Av. Jean Lebas',
  city:'Roubaix',phone:null,sourceUrl:'https://www.google.com/maps/place/entreprise-test',
}]};
assert.equal((await send('capture-tab')).draftAdded,1);
const officialSite={adresse:'35 AVENUE JEAN LEBAS 59100 ROUBAIX',code_postal:'59100',
  libelle_commune:'ROUBAIX',siret:'12345678901234'};
officialResults=[{nom_complet:'ENTREPRISE TEST VÉRIFIÉE',matching_etablissements:[officialSite,
  {...officialSite,siret:'12345678905678'}]}];
assert.equal((await send('enrich-local-drafts',{area:'Roubaix'})).ok,false,
  'Un code postal non vérifié n’est jamais inféré de la ville');
const ambiguous=await send('enrich-local-drafts',{area:'59100 Roubaix'});
assert.equal(ambiguous.added,0,'Deux établissements homonymes empêchent l’enrichissement automatique');
assert.equal((await send('list-drafts')).drafts.length,1);
officialResults=[{nom_complet:'ENTREPRISE TEST VÉRIFIÉE',matching_etablissements:[
  {...officialSite,adresse:'11 RUE AUTRE 59100 ROUBAIX'}]}];
assert.equal((await send('enrich-local-drafts',{area:'59100 Roubaix'})).added,0,
  'Une rue visible contradictoire empêche le rapprochement même si le nom correspond');
officialResults=[{nom_complet:'ENTREPRISE TEST VÉRIFIÉE',matching_etablissements:[officialSite]}];
const enriched=await send('enrich-local-drafts',{area:'59100 Roubaix'});
assert.equal(enriched.checked,1);
assert.equal(enriched.added,1);
assert.equal((await send('list-drafts')).drafts.length,0);
const verified=(await send('get-captures',null,growthos)).results.find(r=>r.company==='Entreprise Test Vérifiée');
assert.equal(verified.address,'35 AVENUE JEAN LEBAS 59100 ROUBAIX');
assert.equal(verified.siret,'12345678901234');
assert.ok(officialRequests.every(url=>new URL(url).searchParams.get('code_postal')==='59100'));
injectedResult={source:'google_search',results:[],drafts:[{
  source:'google_search',company:'Boulangerie Exemple',address:'18 rue de Lille',
  city:'Roubaix',phone:'03 20 01 02 03',sourceUrl:'https://www.google.com/search?q=boulangerie+exemple',
}]};
assert.equal((await send('capture-tab')).draftAdded,1);
officialResults=[];
geocodeResponse={features:[{properties:{label:'19 Rue de Lille 59100 Roubaix',
  housenumber:'19',street:'Rue de Lille',postcode:'59100',city:'Roubaix',score:0.99,type:'housenumber'}}]};
const badGeocode=await send('enrich-local-drafts',{area:'59100 Roubaix'});
assert.equal(badGeocode.added,0,'Le géocodeur ne doit pas inventer un autre numéro de rue');
assert.ok(badGeocode.details[0]?.reason,'Les raisons des échecs doivent être visibles dans le connecteur');
geocodeResponse={features:[{properties:{label:'18 Rue de Lille 59100 Roubaix',
  housenumber:'18',street:'Rue de Lille',postcode:'59100',city:'Roubaix',score:0.97,type:'housenumber'}}]};
const geocoded=await send('enrich-local-drafts',{area:'59100 Roubaix'});
assert.equal(geocoded.added,1,'La BAN confirme une adresse affichée partiellement sur Google');
assert.equal(geocoded.fromGeocoder,1);
const geocodedItem=(await send('get-captures',null,growthos)).results.find(r=>r.company==='Boulangerie Exemple');
assert.equal(geocodedItem.address,'18 Rue de Lille 59100 Roubaix');
assert.equal(geocodedItem.siret,null,'Le géocodage ne prouve aucun identifiant SIRET');
assert.ok(geocodeRequests.every(url=>new URL(url).searchParams.get('postcode')==='59100'));
for(const item of storage.growthos_verified_captures_v1)item.capturedAt=Date.now()-25*60*60*1000;
assert.equal((await send('get-captures',null,growthos)).results.length,0,
  'Les captures expirées ne sortent pas de l’extension');
const cleared=await send('clear-captures');
assert.equal(cleared.results.length,0);
console.log('✓ MV3, fiche Maps détaillée, BAN/INSEE conservateurs, URLs, expiration et isolation GrowthOS');
