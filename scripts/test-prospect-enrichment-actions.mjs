import {createRequire} from 'node:module';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),require=createRequire(new URL('../artifacts/api-server/build.mjs',import.meta.url)),{build}=require('esbuild');
const directory=await mkdtemp(join(tmpdir(),'growthos-enrichment-actions-'));
try{
  await build({stdin:{resolveDir:join(root,'artifacts/growthos'),loader:'tsx',contents:String.raw`
    import assert from 'node:assert/strict';import {createElement} from 'react';import {Router} from 'wouter';import {renderToStaticMarkup} from 'react-dom/server';
    import {ProspectCompanyProfile} from './src/components/ProspectCompanyProfile';import {ProspectProfessionalSources} from './src/components/ProspectProfessionalSources';
    import {Prospect360Dashboard} from './src/components/atlas/Prospect360Dashboard';import {prospectEnrichmentUrl} from './src/lib/prospect-enrichment';
    import {appendCloudResult} from '../../artifacts/api-server/src/services/cloud-results';
    const id='10000000-0000-4000-8000-000000000007',prospect={id,company:'Atelier',city:'Roubaix'},noop=()=>{};
    const render=node=>renderToStaticMarkup(createElement(Router,{ssrPath:'/prospects/'+id},node));
    const unverified=render(createElement(ProspectCompanyProfile,{prospect,onUpdated:noop}));
    assert.ok(unverified.includes('Rechercher le SIREN / SIRET')&&unverified.includes('source=societe_com'));
    assert.ok(!unverified.includes('Vérifier maintenant'),'Une identité absente propose une recherche active au lieu d’un contrôle grisé');
    const sources=render(createElement(ProspectProfessionalSources,{prospect}));
    assert.ok(sources.includes('Enrichir ce prospect dans GrowthOS')&&sources.includes('prospectId='+id));
    assert.equal(new URL('https://growthos.invalid'+prospectEnrichmentUrl(id,'pagesjaunes')).searchParams.get('source'),'pagesjaunes');
    const dash=render(createElement(Prospect360Dashboard,{prospect,activities:[],deals:[],onEdit:noop,onAddActivity:noop,onOpenDeal:noop,onOpenContacts:noop,onOpenActivities:noop,onOpenSources:noop,onOpenMonitoring:noop,onEnrich:noop,onStatusChange:noop,onOpenCrmMap:noop}));
    assert.ok(dash.includes('Copilote IA')&&dash.includes('Lancer :'),'Conserver les commandes IA existantes');
    const raw=Array.from({length:38},(_,i)=>({source:'google_maps',company:'Atelier '+i,address:i+' rue du Test 59100 Roubaix',sourceUrl:'https://www.google.com/maps/place/'+i}));
    const first=appendCloudResult({}, {results:raw.slice(0,25),hasMore:true,cursor:{step:1}},id,'google_maps');
    first.imports={[first.captures[0].id]:{status:'imported',prospectId:'crm'}};
    const next=appendCloudResult(first,{results:raw.slice(24),hasMore:false},id,'google_maps');
    assert.equal(next.captures.length,38);assert.equal(next.captures[0].id,first.captures[0].id);assert.equal(next.imports[first.captures[0].id].status,'imported');
    assert.equal(next.pageCursor,null);assert.equal(next.hasMore,false);
    console.log('✓ Enrichissement : recherche légale active sans identifiant, parcours cloud ciblé, IA conservée, 38 résultats et reçus sans doublon');
  `},outfile:join(directory,'test.mjs'),platform:'node',format:'esm',bundle:true,jsx:'automatic',tsconfig:join(root,'artifacts/growthos/tsconfig.json'),plugins:[{name:'no-api',setup(b){b.onLoad({filter:/\/lib\/api-client\.ts$/},()=>({contents:'export default {get(){throw Error("Unexpected API during SSR")}};',loader:'ts'}));}}],banner:{js:"import {createRequire} from 'node:module'; const require=createRequire(import.meta.url);"},logLevel:'warning'});
  await import(pathToFileURL(join(directory,'test.mjs')).href);
}finally{await rm(directory,{recursive:true,force:true});}
