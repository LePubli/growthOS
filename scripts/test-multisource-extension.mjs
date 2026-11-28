import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const root=new URL('../extensions/growthos-pagesjaunes/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',root),'utf8'));
assert.equal(manifest.manifest_version,3);
assert.equal(manifest.side_panel.default_path,'popup.html','L’extension affiche un panneau global persistant');
assert.ok(!manifest.action.default_popup,'Le clic sur l’icône ne doit plus ouvrir un popup éphémère');
assert.ok(manifest.permissions.includes('sidePanel'),'Permission Chrome requise pour le panneau latéral');
assert.ok(Number(manifest.minimum_chrome_version)>=141,'La fermeture par bouton exige Chrome 141+');
assert.ok(!manifest.host_permissions.some(host=>/linkedin|google|bing/.test(host)),
  'La lecture manuelle utilise activeTab : pas de permissions permanentes Google/LinkedIn/Bing');
assert.ok(manifest.host_permissions.includes('https://recherche-entreprises.api.gouv.fr/*'),
  'L’enrichissement officiel utilise une permission limitée au seul annuaire public');
assert.ok(manifest.host_permissions.includes('https://data.geopf.fr/*'),
  'La validation des rues partielles utilise le géocodeur officiel de la Géoplateforme');

assert.ok(manifest.optional_host_permissions.every(host=>/^https:\/\/(?:www\.)?(?:societe\.com|pappers\.fr|google\.(?:com|fr)|bing\.com)\/\*$/.test(host)||host==='https://maps.google.com/*'),'Les permissions optionnelles restent limitées aux sources déclarées');

const captureScript=readFileSync(new URL('capture.js',root),'utf8');
function capture(url,hasAddress=true,localPack=false,textOverride=null){
  const card={
    innerText:textOverride || (localPack
      ? 'Leclerc & Chéry Valnegreen\n3,5 ★★★★ (17) · Plombier\nPlus de 45 ans en activité · Roubaix\nOuvert · 03 20 70 48 97\nSite Web\nItinéraire'
      : hasAddress?'Atelier Test\n14 rue des Tests 59100 Roubaix\nAppeler':'Atelier Test\nRoubaix'),
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
assert.equal(googleLocal.drafts[0].city,null,'Une ville sans libellé ni adresse postale ne doit pas être déduite d’une catégorie');
const categoryOnly=capture('https://www.google.com/maps/search/chauffagiste',false,false,'SOLUTION ENR\nChauffagiste\n07 62 55 71 60\nSite Web\nItinéraire');
assert.equal(categoryOnly.drafts.length,1);
assert.equal(categoryOnly.drafts[0].city,null,'La catégorie Chauffagiste ne devient jamais une ville');
const popupMarkup=readFileSync(new URL('popup.html',root),'utf8');
assert.ok(popupMarkup.indexOf('id="taskRead"')<popupMarkup.indexOf('id="taskPreview"') &&
  popupMarkup.indexOf('id="taskPreview"')<popupMarkup.indexOf('id="taskFinish"'),'Lire précède la comparaison et le retour au prospect');
for(const id of ['sourcePicker','searchView','collectionView','filterReview','selectAll',
  'capturedCount','completeCount','reviewCount','pauseMaps','importAction','manualPanel',
  'minimizePanel','closePanel','restorePanel','compactView']){
  assert.ok(popupMarkup.includes(`id="${id}"`),`Le parcours ATLAS doit conserver ${id}`);
}
const popupLogic=readFileSync(new URL('popup.js',root),'utf8');
assert.ok(popupLogic.includes("url.hash='selected='") && popupLogic.includes('importable(item)'),
  'La sélection du popup doit être transmise comme identifiants, sans importer directement');
assert.ok(!popupLogic.includes('window.close()'),'Le panneau reste ouvert après navigation et capture');
assert.ok(popupLogic.includes('chrome.tabs.onActivated.addListener') && popupLogic.includes('chrome.tabs.onUpdated.addListener'),
  'Les changements d’onglet doivent mettre à jour la source du panneau');
assert.ok(popupLogic.includes('chrome.sidePanel.close({windowId:tab.windowId})'),
  'La croix ferme la barre latérale globale sans arrêter la collecte');
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

let listener,tabActivated;
const storage={};
const opened=[];
let injectedResult=googleLocal;
let mapLinks=[];
let activeTabUrl='https://www.google.com/search?q=plombier%2059100';
let officialResults=[];
const officialRequests=[];
const geocodeRequests=[];
let geocodeResponse={features:[]};
const chrome={
  runtime:{getURL:(path='')=>'chrome-extension://unit-test/'+path,
    onMessage:{addListener:fn=>{listener=fn;}}},
  sidePanel:{setPanelBehavior:async behavior=>{storage.panelBehavior=behavior;},open:async()=>{storage.panelOpened=true;}},
  storage:{local:{get:async key=>({[key]:storage[key]}),set:async changes=>{Object.assign(storage,changes);}}},
  tabs:{create:async data=>{opened.push(data);return{id:12};},
    query:async()=>[{id:42,url:activeTabUrl}],
    get:async(id)=>({id:id||42,url:activeTabUrl,status:'complete'}),
    onActivated:{addListener:fn=>{tabActivated=fn;}},
    update:async (_id,data)=>{if(data.url)activeTabUrl=data.url;return{id:42,url:activeTabUrl,status:'complete'};}},
  scripting:{executeScript:async options=>[{result:options.func?mapLinks:(typeof injectedResult==='function'?injectedResult():injectedResult)}]},
};
vm.runInNewContext(readFileSync(new URL('background.js',root),'utf8'),
  {chrome,URL,crypto:webcrypto,Date,importScripts:()=>{},setTimeout:(fn,ms)=>setTimeout(fn,ms>=4500?ms:0),clearTimeout,Promise,console,AbortController,
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
await Promise.resolve();
assert.equal(storage.panelBehavior?.openPanelOnActionClick,true,
  'Un clic sur l’icône Chrome doit ouvrir ou fermer le panneau latéral');
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
  libelle_commune:'ROUBAIX',siret:'12345678901234',activite_principale:'43.22A'};
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
assert.equal(verified.apeCode,'43.22A');
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
mapLinks=['https://www.google.com/maps/place/Atelier-de-Roubaix'];
injectedResult={source:'google_maps',drafts:[],results:[{source:'google_maps',company:'Atelier de Roubaix',
  address:'20 Rue Nationale 59100 Roubaix',codePostal:'59100',city:'Roubaix',
  sourceUrl:mapLinks[0],phone:'03 20 00 11 22'}]};
const originalUrl=activeTabUrl;
const mapBatch=await send('auto-capture-maps',{query:'plombier',area:'59100'});
assert.equal(mapBatch.added,1);
assert.equal(mapBatch.checked,1);
assert.equal(activeTabUrl,originalUrl,'Après la lecture Maps, revenir à la recherche originale');
assert.equal((await send('auto-capture-status')).status.status,'done');
assert.equal((await send('get-captures',null,growthos)).results.some(item=>item.company==='Atelier de Roubaix'),true);
mapLinks=['https://www.google.com/maps/place/Atelier-de-Roubaix',
  'https://www.google.com/maps/place/Nouveau-Plombier'];
injectedResult={source:'google_maps',drafts:[],results:[{source:'google_maps',company:'Nouveau Plombier',
  address:'22 Rue Nationale 59100 Roubaix',codePostal:'59100',city:'Roubaix',
  sourceUrl:mapLinks[1],phone:'03 20 00 11 23'}]};
const nextBatch=await send('auto-capture-maps',{query:'plombier',area:'59100'});
assert.equal(nextBatch.checked,1,'Le lot suivant ne doit pas rouvrir la première fiche Maps');
assert.equal((await send('get-captures',null,growthos)).results.some(item=>item.company==='Nouveau Plombier'),true);
assert.equal((await send('auto-capture-maps',{query:'plombier',area:'59100'})).ok,false,
  'Quand toutes les fiches chargées sont vues, prévenir au lieu de recommencer les mêmes');
assert.equal((await send('pause-maps-progress')).ok,false,'Le bouton Pause ne doit pas prétendre suspendre une collecte arrêtée');
mapLinks=['https://www.google.com/maps/place/Pause-Un','https://www.google.com/maps/place/Pause-Deux'];
injectedResult=()=>{
  if(activeTabUrl.endsWith('/Pause-Un'))storage.growthos_maps_pause_requested_v1=true;
  return {source:'google_maps',drafts:[],results:[{source:'google_maps',
    company:'Atelier '+activeTabUrl.split('/').pop(),address:'14 rue Test 59100 Roubaix',
    codePostal:'59100',city:'Roubaix',sourceUrl:activeTabUrl}]};
};
const paused=await send('auto-capture-maps',{query:'plombier',area:'59100'});
assert.equal(paused.status,'paused','La pause doit arrêter la lecture avant la fiche suivante');
assert.equal(paused.checked,1,'La fiche en cours doit finir sans perte');
assert.equal((await send('auto-capture-status')).status.status,'paused');
const resumed=await send('auto-capture-maps',{query:'plombier',area:'59100'});
assert.equal(resumed.status,'done','La reprise doit terminer la lecture Maps');
assert.equal(resumed.checked,1,'La reprise ne doit pas refaire les fiches déjà lues');
const newItem=(await send('get-captures',null,growthos)).results.find(item=>item.company==='Nouveau Plombier');
assert.equal((await send('ack-import',{ids:[newItem.id]},growthos)).ok,true);
assert.equal((await send('get-captures',null,growthos)).results.some(item=>item.id===newItem.id),false,
  'Après import CRM confirmé, la capture doit disparaître de la file locale');
assert.equal((await send('reset-maps-progress')).ok,true);
activeTabUrl='https://www.google.com/maps/search/plombiers+Roubaix';
mapLinks=Array.from({length:35},(_,i)=>'https://www.google.com/maps/place/Test-'+i);
injectedResult=()=>({source:'google_maps',drafts:[],results:[{
  source:'google_maps',company:'Entreprise '+activeTabUrl.split('/').pop(),
  address:'14 rue Test 59100 Roubaix',codePostal:'59100',city:'Roubaix',sourceUrl:activeTabUrl,
}]});
const continuous=await send('capture-tab',{});
assert.equal(continuous.checked,35,'Un clic de capture parcourt tous les résultats Maps');
assert.equal(continuous.added,35);
assert.equal(activeTabUrl,'https://www.google.com/maps/search/plombiers+Roubaix');
for(const item of storage.growthos_verified_captures_v1)item.capturedAt=Date.now()-25*60*60*1000;
assert.equal((await send('get-captures',null,growthos)).results.length,0,
  'Les captures expirées ne sortent pas de l’extension');
const cleared=await send('clear-captures');
assert.equal(cleared.results.length,0);
console.log('✓ MV3, lot Maps navigué/restauré, BAN/INSEE conservateurs, URLs, expiration et isolation GrowthOS');

for (const [source,profile] of Object.entries({
  tiktok:'https://www.tiktok.com/@atelier.local/',
  facebook:'https://www.facebook.com/atelier.local/',
  instagram:'https://www.instagram.com/atelier.local/',
  societe_com:'https://www.societe.com/societe/atelier-local-999000001.html',
})) {
  const form={source,company:'Atelier '+source,address:'10 rue de Lille 59100 Roubaix',codePostal:'59100',sourceUrl:profile};
  const result=await send('manual-add',form);
  assert.equal(result.added,1,source);
  assert.equal((await send('manual-add',form)).ignored,1,source);
  assert.equal((await send('manual-add',{...form,sourceUrl:'https://example.org/atelier/'})).ok,false,source);
}
const bingResult=capture('https://www.bing.com/search?q=atelier');
assert.equal(bingResult.results[0].company,'Atelier Test');
assert.equal(bingResult.results[0].codePostal,'59100');

const tiktokForm={source:'tiktok',company:'Atelier TikTok',address:'10 rue de Lille 59100 Roubaix',codePostal:'59100'};
for (const url of [
  'https://www.tiktok.com/@atelier/video/123',
  'https://www.tiktok.com/search/user?q=atelier',
  'https://www.tiktok.com.evil.example/@atelier',
  'https://vm.tiktok.com/faux',
  'http://www.tiktok.com/@atelier',
]) {
  assert.equal((await send('manual-add',{...tiktokForm,sourceUrl:url})).ok,false,url);
}
const tiktokSearch=await send('open-source',{source:'tiktok',query:'artisan',area:'Roubaix'});
assert.equal(tiktokSearch.ok,true);
assert.equal(new URL(tiktokSearch.url).searchParams.get('q'),'artisan Roubaix');
assert.ok((await send('get-captures',null,growthos)).results.some(item=>item.source==='tiktok'));
console.log('✓ TikTok : profil, recherche, import local, doublons et liens invalides');

const societeScript=readFileSync(new URL('societe.js',root),'utf8');
const societeText='ATELIER RECETTE\nSIREN\n999 000 002\nSIRET DU SIEGE SOCIAL\n999 000 002 00017\nACTIVITÉ (NAF / APE)\nPlomberie - 4322A\nADRESSE\n8 RUE DU TEST, 59100 ROUBAIX\nTéléphone\nAfficher le numéro';
function societeCapture(text=societeText,url='https://www.societe.com/societe/atelier-recette-999000002.html') {
  return vm.runInNewContext(societeScript,{
    location:new URL(url),URL,getComputedStyle:()=>({visibility:'visible'}),
    document:{body:{innerText:text},querySelector:selector=>selector==='h1'?{innerText:'ATELIER RECETTE',getClientRects:()=>[{}]}:null},
  },{timeout:1000});
}
const societeResult=societeCapture();
assert.equal(societeResult.results[0].siret,'99900000200017');
assert.equal(societeResult.results[0].apeCode,'43.22A');
assert.equal(societeResult.results[0].phone,null,'Un numéro masqué reste absent');
assert.equal(societeResult.results[0].website,null,'Un site absent reste absent');
assert.ok(societeCapture(societeText.replace('999 000 002\n','888 000 002\n')).error);
assert.ok(societeCapture(societeText.replace('59100','')).error);
assert.ok(societeCapture(societeText,'https://example.com/societe/atelier-recette-999000002.html').error);
console.log('✓ Societe.com : lecture des champs affichés, adresse et SIREN cohérents, données masquées absentes');
const richSociete=societeCapture(societeText+'\nFORME JURIDIQUE\nEntrepreneur individuel\nDATE DE CREATION\n14 octobre 2013\nNUMÉRO DE TVA\nFR00999000002\nCONVENTION COLLECTIVE\nConvention de test\nMail de contact\ncontact@atelier-recette.example.org');
assert.equal(richSociete.results[0].companyDetails.fields['Forme juridique'],'Entrepreneur individuel');
assert.equal(richSociete.results[0].companyDetails.fields['Numéro de TVA'],'FR00999000002');
assert.equal(richSociete.results[0].email,'contact@atelier-recette.example.org');
activeTabUrl='https://www.societe.com/societe/atelier-recette-999000002.html';
injectedResult=richSociete;
const richStored=await send('capture-tab');
assert.ok(richStored.results.some(item=>item.source==='societe_com' && item.companyDetails?.fields['Forme juridique']==='Entrepreneur individuel'));
console.log('✓ Societe.com : informations légales et convention collective conservées dans la capture Chrome');

const societeSearch=await send('open-source',{source:'societe_com',query:'98107525200016',area:''});
assert.equal(new URL(societeSearch.url).pathname,'/recherche');
assert.equal(new URL(societeSearch.url).searchParams.get('q'),'98107525200016');
assert.equal(new URL(societeSearch.url).searchParams.get('ftStatus'),'0');
assert.equal(new URL(societeSearch.url).searchParams.has('champs'),false);
const inlineSociete=societeCapture(societeText.replace('SIREN\n999 000 002','SIREN : 999 000 002').replace('ADRESSE\n','ADRESSE : ')+'\nDirigeant : Denis LIQUARD');
assert.equal(inlineSociete.results[0].siret,'99900000200017');
assert.equal(inlineSociete.results[0].companyDetails.managers[0],'Denis LIQUARD');
// Cartes réelles simulées : séparer les contacts directs du standard et exclure
// les dirigeants recommandés plus bas ainsi que les liens invisibles.
const visibleElement=(innerText,order=0)=>({innerText,order,getClientRects:()=>[{}],
  compareDocumentPosition(other){return this.order<other.order?4:2;}});
const directorHeading=Object.assign(visibleElement('Dirigeants de ATELIER RECETTE',10),{tagName:'H2'});
const directorSubheading=Object.assign(visibleElement('Denis LIQUARD',11),{tagName:'H3'});
const contactHeading=visibleElement('Contacter ATELIER RECETTE',20);
const relatedHeading=visibleElement('Ces entreprises pourraient vous intéresser',30);
const director=Object.assign(visibleElement('Denis LIQUARD',12),{href:'https://www.societe.com/dirigeant/denis-liquard.test.html'});
const directEmail=Object.assign(visibleElement('E-mail professionnel',13),{href:'mailto:denis@atelier-recette.example.org'});
const directPhone=Object.assign(visibleElement('Téléphone direct',14),{href:'tel:+33 6 11 22 33 44'});
const card={innerText:'Denis LIQUARD\nGérant\nE-mail professionnel\nTéléphone direct',querySelectorAll:()=>[director,directEmail,directPhone]};
director.closest=()=>card;
const standard=Object.assign(visibleElement('Téléphone de l’entreprise',22),{href:'tel:03 20 11 22 33'});
const unrelated=Object.assign(visibleElement('Autre dirigeant',32),{href:'https://www.societe.com/dirigeant/autre.html'});
const hidden=Object.assign(visibleElement('Invisible',15),{getClientRects:()=>[],href:'mailto:hidden@example.org'});
const semanticSiren=Object.assign(visibleElement('SIREN'),{nextElementSibling:visibleElement('999 000 002')});
const fixtureRoot={innerText:societeText.replace('SIREN\n999 000 002',''),querySelectorAll:selector=>selector==='dt, th'?[semanticSiren]:selector==='h2, h3'?[directorHeading,directorSubheading,contactHeading,relatedHeading]:[director,directEmail,directPhone,standard,unrelated,hidden]};
const structuredSociete=vm.runInNewContext(societeScript,{location:new URL('https://www.societe.com/societe/atelier-recette-999000002.html'),URL,getComputedStyle:()=>({visibility:'visible'}),document:{body:fixtureRoot,querySelector:selector=>selector==='main'?fixtureRoot:selector==='h1'?visibleElement('ATELIER RECETTE'):null}},{timeout:1000});
const structured=structuredSociete.results[0];
assert.deepEqual(Array.from(structured.companyDetails.managers),['Denis LIQUARD']);
assert.equal(structured.companyDetails.managerContacts[0].name,'Denis LIQUARD');
assert.equal(structured.companyDetails.managerContacts[0].role,'Gérant');
assert.equal(structured.companyDetails.managerContacts[0].email,'denis@atelier-recette.example.org');
assert.equal(structured.companyDetails.managerContacts[0].phone,'+33611223344');
assert.equal(structured.phone,'0320112233');
assert.equal(structured.email,null,'Le contact direct ne devient pas le contact général');
assert.ok(!JSON.stringify(structured).includes('hidden@example.org'));
console.log('✓ Societe.com : URL q/ftStatus, libellés en ligne, dirigeants, rôle et coordonnées visibles séparés du standard');

{
// Parcours ciblé : aucune capture ne doit rejoindre la sélection d'import.
const prospect={id:'10000000-0000-4000-8000-000000000001',company:'Atelier Manuel'};
const queueBefore=JSON.stringify((await send('list-captures')).results);
const started=await send('begin-task',{source:'linkedin',mode:'enrich',query:'Atelier Manuel',area:'Roubaix',prospect},growthos);
assert.equal(started.ok,true);const taskId=started.task.id;
assert.equal(started.task.prospect.id,prospect.id);
assert.ok(opened.at(-1).url.startsWith('https://www.linkedin.com/search/results/companies/'));
assert.equal((await send('manual-add',{source:'linkedin',company:'Accident'})).ok,false,'Le mode ciblé interdit les écritures dans la sélection de listes');
assert.equal((await send('task-preview',{taskId},growthos)).ok,false,'Le site ne peut pas déclencher une lecture de l’onglet actif');
assert.equal((await send('task-complete',{taskId,confirmed:false,capture:{}})).ok,false);
const partial={source:'linkedin',company:prospect.company,sourceUrl:'https://www.linkedin.com/company/atelier-manuel/',website:'https://atelier.example.org'};
assert.equal((await send('task-complete',{taskId,confirmed:true,capture:{...partial,sourceUrl:'https://www.linkedin.com/company/atelier/posts/123'}})).ok,false);
const completed=await send('task-complete',{taskId,confirmed:true,capture:partial});
assert.equal(completed.ok,true);assert.equal(completed.task.status,'pending');
assert.equal(completed.task.capture.id,'task_'+taskId);
assert.equal(completed.task.capture.address,undefined,'Une page sociale enrichit un prospect connu sans inventer une adresse');
assert.equal(opened.at(-1).url,`https://agile.le-publicitaire.fr/prospects/${prospect.id}?enrichmentTask=${taskId}`);
assert.equal(JSON.stringify((await send('list-captures')).results),queueBefore);
assert.equal((await send('get-task-result',{taskId,prospectId:'10000000-0000-4000-8000-000000000002'},growthos)).ok,false);
assert.equal((await send('get-task-result',{taskId,prospectId:prospect.id},{url:'https://evil.example/'})).ok,false);
assert.equal((await send('task-cancel',{taskId})).ok,false,'Une capture non enregistrée reste récupérable');
assert.equal((await send('begin-task',{source:'bing',mode:'discover',query:'plombier'},growthos)).ok,false,'Ne pas abandonner une capture en attente');
const recovered=await send('get-task-result',{taskId,prospectId:prospect.id},growthos);
assert.equal(recovered.task.capture.website,partial.website);
await send('ack-task',{taskId,prospectId:prospect.id},growthos);
assert.equal((await send('task-current')).task,null);
assert.equal((await send('get-task-result',{taskId,prospectId:prospect.id},growthos)).task.status,'done');
chrome.sidePanel.open=async()=>{throw Error('User gesture unavailable');};
const fallback=await send('begin-task',{source:'bing',mode:'enrich',query:prospect.company,prospect},growthos);
assert.equal(fallback.controls,'tab');assert.ok(opened.at(-1).url.startsWith('chrome-extension://unit-test/popup.html?taskControls='));
assert.equal(fallback.task.sourceTabId,12);
activeTabUrl='https://www.bing.com/search?q=Atelier';
await tabActivated({tabId:55});
assert.equal((await send('task-current')).task.sourceTabId,55,'Un résultat ouvert dans un nouvel onglet devient la source à lire');
assert.equal((await send('task-focus-source',{taskId:fallback.task.id})).ok,true);
await send('task-cancel',{taskId:fallback.task.id});chrome.sidePanel.open=async()=>{};
const cloudJobId='10000000-0000-4000-8000-000000000088';
const bound=await send('begin-task',{source:'bing',mode:'enrich',query:prospect.company,prospect,cloudJobId},growthos);
assert.equal(bound.ok,true);assert.equal(bound.task.cloudJobId,cloudJobId);
const boundDone=await send('task-complete',{taskId:bound.task.id,confirmed:true,capture:{...partial,source:'bing',sourceUrl:'https://www.bing.com/search?q=Atelier'}});
assert.equal(boundDone.ok,true);assert.ok(opened.at(-1).url.includes('cloudJobId='+cloudJobId));
await send('ack-task',{taskId:bound.task.id,prospectId:prospect.id},growthos);
assert.equal((await send('begin-task',{source:'bing',mode:'enrich',query:prospect.company,prospect,cloudJobId:'bad-id'},growthos)).ok,false);
const mapTask=await send('begin-task',{source:'google_maps',mode:'enrich',query:prospect.company,prospect},growthos);
activeTabUrl='https://www.google.com/maps/search/Atelier';
assert.equal((await send('task-preview',{taskId:mapTask.task.id})).ok,false,'Une liste Maps ne peut pas enrichir une fiche unique en lot');
activeTabUrl='https://www.google.com/maps/place/Atelier/';injectedResult={results:[{...partial,source:'google_maps',sourceUrl:activeTabUrl}],drafts:[]};
const preview=await send('task-preview',{taskId:mapTask.task.id});
assert.equal(preview.ok,true);assert.equal(preview.task.preview.length,1);
assert.equal(JSON.stringify((await send('list-captures')).results),queueBefore);
await send('task-cancel',{taskId:mapTask.task.id});
const expired=await send('begin-task',{source:'bing',mode:'enrich',query:prospect.company,prospect},growthos);
storage.growthos_contextual_tasks_v1.tasks[expired.task.id].createdAt=Date.now()-86400001;
assert.equal((await send('task-current')).task,null,'Le contexte expire après 24 h');
assert.equal((await send('task-complete',{taskId:expired.task.id,confirmed:true,capture:partial})).ok,false);
const registry=JSON.parse(readFileSync(new URL('modules.json',root),'utf8'));
assert.equal(new Set(registry.map(m=>m.source)).size,registry.length);
assert.ok(registry.filter(m=>m.kind==='assisted').every(m=>m.hint.includes('profession')||m.source==='linkedin'));
console.log('✓ Outils ciblés : liaison au prospect, données partielles, reprise, confirmation, isolation des listes et expiration');

// Le pont n'expose que les actions prévues, sur la fenêtre et l'origine locales.
let webListener;const forwarded=[],responses=[];
const page={location:{origin:'https://agile.le-publicitaire.fr'},addEventListener:(_event,fn)=>{webListener=fn;},postMessage:value=>responses.push(value)};
page.top=page;
const bridgeChrome={runtime:{id:'unit-test',getManifest:()=>({version:'0.11.0'}),sendMessage:(message,reply)=>{
  forwarded.push(message);reply({ok:true,task:{id:taskId,status:'pending',prospect,capture:partial}});
}}};
vm.runInNewContext(readFileSync(new URL('bridge.js',root),'utf8'),{window:page,chrome:bridgeChrome});
const event={source:page,origin:page.location.origin,data:{channel:'growthos-pagesjaunes-device-v1',direction:'to-extension',requestId:'task-read',action:'get-task-result',payload:{taskId,prospectId:prospect.id}}};
webListener({...event,origin:'https://evil.example'});assert.equal(forwarded.length,0);
webListener({...event,source:{}});assert.equal(forwarded.length,0);
webListener({...event,data:{...event.data,action:'task-preview'}});assert.equal(forwarded.length,0);
webListener(event);assert.equal(forwarded.length,1);assert.equal(responses.at(-1).task.prospect.id,prospect.id);
assert.equal(responses.at(-1).task.capture.sourceUrl,partial.sourceUrl);
console.log('✓ Pont navigateur : contexte transmis et lecture active interdite depuis la page web');

}
