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

const captureScript=readFileSync(new URL('capture.js',root),'utf8');
function capture(url,hasAddress=true){
  const card={
    innerText:hasAddress?'Atelier Test\n14 rue des Tests 59100 Roubaix\nAppeler':'Atelier Test\nRoubaix',
    getClientRects:()=>[{}],
    querySelector:(selector)=>selector==='h1,h2,h3,[role="heading"],.fontHeadlineSmall'?{innerText:'Atelier Test'}:null,
    querySelectorAll:()=>[],
    closest:()=>null,
  };
  const document={body:card,title:'Atelier Test',querySelectorAll:(selector)=>
    selector==='[role="article"]' || selector==='#rhs' || selector==='#b_context'?[card]:[]};
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
assert.ok(capture('https://www.linkedin.com/company/test').error,
  'Aucun scraping LinkedIn par le lecteur de pages');

let listener;
const storage={};
const opened=[];
const chrome={
  runtime:{getURL:(path='')=>'chrome-extension://unit-test/'+path,
    onMessage:{addListener:fn=>{listener=fn;}}},
  storage:{local:{get:async key=>({[key]:storage[key]}),set:async changes=>{Object.assign(storage,changes);}}},
  tabs:{create:async data=>{opened.push(data);return{id:12};}},
};
vm.runInNewContext(readFileSync(new URL('background.js',root),'utf8'),
  {chrome,URL,crypto:webcrypto,Date,setTimeout,clearTimeout,Promise,console},{timeout:1500});
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
storage.growthos_verified_captures_v1[0].capturedAt=Date.now()-25*60*60*1000;
assert.equal((await send('get-captures',null,growthos)).results.length,0,
  'Les captures expirées ne sortent pas de l’extension');
const cleared=await send('clear-captures');
assert.equal(cleared.results.length,0);
console.log('✓ MV3 permissions, collecte visible, données manuelles, URLs, expiration et isolation GrowthOS');
