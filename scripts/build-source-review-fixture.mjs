// Bundle the actual React pages. Only the transport is replaced by a local
// fixture backend; browser tests must click through to the real prospect tab.
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dirname,'..'),out=resolve(process.argv[2]||'/tmp/growthos-review-ui');
const require=createRequire(join(root,'artifacts/api-server/build.mjs'));
const {build}=require('esbuild');
await mkdir(out,{recursive:true});
const backend=`
const id='10000000-0000-4000-8000-000000000001',jobId='10000000-0000-4000-8000-000000000002',profileId='10000000-0000-4000-8000-000000000003';
const scenario=new URLSearchParams(location.search).get('scenario')||'waiting';
const otherId='10000000-0000-4000-8000-000000000004';
const p={id,company:'Atelier de recette',phone:'0320112233',email:null,source:'google_maps',sourceDetails:{},status:'new',createdAt:'2026-11-27T12:00:00Z',updatedAt:'2026-11-27T12:00:00Z'};
const capture={id:'task_'+jobId,source:'societe_com',company:p.company,email:'contact@atelier.example',capturedAt:1};
const job={id:jobId,profile_id:profileId,prospect_id:scenario==='discovery'?null:id,mode:scenario==='discovery'?'discover':'enrich',query:p.company,status:!['waiting','busy','lost','applied','discovery'].includes(scenario)?'needs_review':scenario==='applied'||scenario==='discovery'?'completed':'awaiting_user',result:{captures:scenario==='waiting'||scenario==='busy'||scenario==='lost'?[]:[capture]}};
const persisted=sessionStorage.getItem('source-review-fixture');if(persisted){const data=JSON.parse(persisted);Object.assign(p,data.p);Object.assign(job,data.job);}
if(scenario==='applied'){job.result.applied={filled:['email'],conflicts:0};p.email=capture.email;sessionStorage.setItem('source-review-fixture',JSON.stringify({p,job}));}
const profiles=[{id:profileId,source:scenario==='discovery'?'google_maps':'societe_com',label:'Source de recette',mode:'public'}];
const run=()=>({id:'run',status:job.result.applied?'completed':'partial',updated_at:p.updatedAt,steps:{societe_com:{label:'Societe.com',status:job.result.applied?'completed':job.status,jobId,profileId,filled:job.result.applied?['email']:[],message:'Fiche locale de recette'}},summary:{sourcesDone:job.result.applied?1:0,sourcesTotal:1,fields:job.result.applied?['email']:[],conflicts:0,interventions:job.result.applied?0:1}});
window.__reviewCalls={confirm:0,finish:0,open:0,read:0,launch:0,merge:0,device:0,deviceStop:0};let locked=scenario==='busy'||scenario==='lost';window.__releaseSource=()=>locked=false;
const clone=v=>structuredClone(v);
const apiClient={
 async get(url){
  if(job.result.applied&&((scenario==='activities_fail'&&url.startsWith('/activities'))||(scenario==='parent_fail'&&url==='/prospects/'+id+'/enrichment')))throw Object.assign(Error('Suivi temporairement indisponible'),{status:503});
  if(url==='/browser/profiles')return clone(profiles);
  if(url==='/browser/status')return {ready:true,configured:true,automatic:['societe_com','google_maps']};
  if(url==='/browser/jobs')return [clone(job)];
  if(url==='/browser/jobs/'+jobId)return clone(job);
  if(url.startsWith('/browser/jobs/'+jobId+'/review'))return {version:p.updatedAt,expectedValues:{email:p.email},captureDigest:'a'.repeat(64),captureIndex:0,captureCount:1,alreadyApplied:!!job.result.applied,blocked:scenario==='mobile_blocked',legalOnly:false,message:scenario==='mobile_blocked'?'Le SIREN ou le SIRET contredit une identité déjà enregistrée. Cette confirmation ne peut pas l’écraser.':'Vérifiez qu’il s’agit bien de ce prospect. Les champs vides seront complétés.',prospect:clone(p),duplicate:scenario.startsWith('duplicate')&&!job.result.merged?{id:otherId,company:'Identité légale existante',siret:'96677710100019'}:null,source:{name:'societe_com',url:'https://www.societe.com/societe/fixture-966777002.html',company:p.company},fields:[{field:'email',before:p.email,after:capture.email,changed:!p.email},...(scenario==='mobile_long'?['address','city','postalCode','website','apeCode','nafLabel','siren','siret'].map(field=>({field,before:'Valeur CRM '+('ancienne '.repeat(10)),after:'Donnée publiée '+('information source longue '.repeat(25)),changed:true})):[]),...(scenario==='save_conflict'?[{field:'phone',before:p.phone,after:'0320998877',changed:true}]:[])]};
  if(scenario==='device_navigation'&&url==='/prospects/'+otherId)return {...clone(p),id:otherId,company:'Prospect suivant'};
  if(scenario==='device_navigation'&&url==='/prospects/'+otherId+'/enrichment')return run();
  if(url==='/prospects/'+id)return clone(p);
  if(url==='/prospects/'+id+'/enrichment')return run();
  if(url==='/prospects/'+id+'/monitoring')return {snapshot:null};
  if(url==='/notifications')return [];
  // The public discovery view also mounts LegacySourcingArchive. Its jobs
  // endpoint must return an array, just like the actual API, or React crashes
  // before the history drawer becomes available in Chromium.
  if(url==='/sourcing/jobs')return [];
  if(url.includes('history')||url.startsWith('/activities')||url.startsWith('/pipeline')||url.includes('comments'))return [];
  return {};
 },
 async post(url,body){
  if(url==='/browser/device-plan'){window.__devicePlanRuns=window.__devicePlanRuns||[];window.__devicePlanRuns.push(body.runId);if(scenario==='device_plan_retry'&&window.__devicePlanRuns.length===1)throw Object.assign(Error('Réponse de préparation perdue'),{status:503});return {runId:body.runId,deviceId:body.deviceId,prospect:{id,company:p.company},jobs:[{id:jobId,source:'societe_com',query:p.company,area:'Roubaix'}]};}
  if(url.endsWith('/device-result')){window.__reviewCalls.device++;if(scenario==='device_server_retry'&&window.__reviewCalls.device===1)throw Object.assign(Error('Réception temporairement indisponible'),{status:503});job.status='completed';job.result.applied={filled:['email'],conflicts:0};p.email=capture.email;sessionStorage.setItem('source-review-fixture',JSON.stringify({p,job}));return {jobId,status:'completed',applied:true};}
  if(url==='/browser/device-stop'){window.__reviewCalls.deviceStop++;return {stopped:1};}
  if(url.endsWith('/merge-preview'))return {mergeKey:'10000000-0000-4000-8000-000000000005',proofDigest:'b'.repeat(64),current:{id,company:p.company,siret:null,address:null,updatedAt:p.updatedAt,fields:{company:p.company,email:p.email,phone:p.phone}},other:{id:otherId,company:'Identité légale existante',siret:'96677710100019',address:'8 rue du Test',updatedAt:p.updatedAt,fields:{company:'Identité légale existante',email:'direction@atelier.example',phone:'0611223344'}},activities:[],contactCounts:[1,2]};
  if(url.endsWith('/merge')){if(body.confirmed!==true||body.survivorId!==id)throw Error('Fusion non confirmée');window.__reviewCalls.merge++;job.result.merged=true;p.siret='96677710100019';p.sourceDetails.mergeHistory=[{id:body.mergeKey}];return {prospectId:id,mergeId:body.mergeKey};}

  if(url==='/browser/jobs'){window.__reviewCalls.launch++;return clone(job);}
  if(url.endsWith('/open')){window.__reviewCalls.open++;if(locked)throw Object.assign(Error(scenario==='busy'?'Collecte en cours : navigateur occupé.':'Session fermée : réouvrez la source.'),{status:scenario==='busy'?423:409});return {controlId:'control',url:'https://www.societe.com/',image:'data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800"><text x="30" y="70" font-size="24">Fiche source : coordonnées publiées</text></svg>'),width:1280,height:800};}
  if(url.endsWith('/view'))return {url:'https://www.societe.com/',image:'data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800"><text x="30" y="70" font-size="24">Fiche source : coordonnées publiées</text></svg>'),width:1280,height:800,busy:false};
  if(url.endsWith('/retry')){window.__reviewCalls.read++;if(locked)throw Object.assign(Error('Navigateur occupé. Attendez avant de reprendre.'),{status:423});job.status='needs_review';job.result.captures=[capture];return clone(job);}
  if(url.endsWith('/confirm')){window.__reviewCalls.confirm++;if(scenario==='save_conflict'&&window.__reviewCalls.confirm===1)throw Object.assign(Error('La valeur CRM a changé. Actualisez la comparaison.'),{status:409});if(scenario==='save_conflict'&&body.replaceFields.includes('phone'))throw Error('Choix de conservation du téléphone perdu.');if(body.confirmed!==true)throw Error('Confirmation manquante');job.status='completed';job.result.applied={filled:['email'],conflicts:0};p.email=capture.email;sessionStorage.setItem('source-review-fixture',JSON.stringify({p,job}));return {job:clone(job),filled:['email'],conflicts:0};}
  if(url.endsWith('/finish-review')){window.__reviewCalls.finish++;if(scenario==='finish_fail')throw Object.assign(Error('Bilan temporairement indisponible'),{status:503});if(!job.result.applied)throw Error('Sauvegarde absente');return {prospectId:id,jobId,source:'societe_com',url:'/prospects/'+id+'?view=enrichments&reviewedJob='+jobId,filled:['email'],conflicts:0};}
  return {};
 },reportClientError(){},patch(){return Promise.resolve({});}
};export {apiClient};export default apiClient;`;
await build({stdin:{resolveDir:join(root,'artifacts/growthos'),loader:'tsx',contents:`
import React from 'react';import {createRoot} from 'react-dom/client';import {Route,Switch} from 'wouter';
import CloudBrowserPage from './src/pages/CloudBrowserPage';import ProspectDetailPage from './src/pages/ProspectDetailPage';
createRoot(document.getElementById('root')).render(<Switch><Route path="/navigateur"><CloudBrowserPage/></Route><Route path="/prospects/:id"><ProspectDetailPage/></Route></Switch>);
`},outfile:join(out,'app.js'),bundle:true,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{}'},loader:{'.png':'dataurl','.svg':'dataurl'},tsconfig:join(root,'artifacts/growthos/tsconfig.json'),plugins:[{name:'fixture-transport',setup(b){b.onLoad({filter:/\/lib\/api-client\.ts$/},()=>({contents:backend,loader:'js'}));}}],logLevel:'warning'});
await writeFile(join(out,'index.html'),'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/app.css"><style>*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif}button,input,select{font:inherit}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
console.log('Actual source-review and prospect React pages bundled:',out);
