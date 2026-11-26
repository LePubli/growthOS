// Le catalogue réel et son rendu React, sans session ni service distant.
import {createRequire} from 'node:module';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(new URL('../artifacts/api-server/build.mjs',import.meta.url));
const {build}=require('esbuild');
const directory=await mkdtemp(join(tmpdir(),'growthos-collection-tools-'));
try{
  await build({stdin:{resolveDir:join(root,'artifacts/growthos'),loader:'tsx',contents:`
    import assert from 'node:assert/strict';
    import {createElement} from 'react';
    import {Router} from 'wouter';
    import {renderToStaticMarkup} from 'react-dom/server';
    import CollectionToolsPage from './src/pages/CollectionToolsPage';
    import {ConnectorEnrichmentReturn} from './src/components/ConnectorEnrichmentReturn';
    import modules from '../../extensions/growthos-pagesjaunes/modules.json';
    const render=(search='')=>renderToStaticMarkup(createElement(Router,{ssrPath:'/outils',ssrSearch:search},createElement(CollectionToolsPage)));
    const discovery=render();
    assert.equal((discovery.match(/<article/g)||[]).length,modules.filter(m=>m.modes.includes('discover')).length);
    for(const source of modules.filter(m=>m.modes.includes('discover'))) assert.ok(discovery.includes(source.name));
    assert.ok(discovery.includes('/sourcing?source=entreprises') && discovery.includes('/sourcing?source=pagesjaunes'));
    assert.ok(discovery.includes('Saisie assistée') && discovery.includes('Lecture de la fiche visible'));
    const enrich=render('mode=enrich');
    assert.equal((enrich.match(/<article/g)||[]).length,modules.filter(m=>m.modes.includes('enrich')).length);
    assert.ok(enrich.includes('Societe.com') && enrich.includes('ouvrez un prospect'));
    assert.ok(!enrich.includes('/sourcing?source=entreprises'));
    assert.ok(!enrich.includes('Importer la sélection'));
    assert.ok(enrich.includes('campagnes LinkedIn') && enrich.includes('restent à développer'));
    const returnHtml=renderToStaticMarkup(createElement(Router,{ssrPath:'/prospects/test',ssrSearch:'enrichmentTask=10000000-0000-4000-8000-000000000001'},createElement(ConnectorEnrichmentReturn,{prospectId:'test',onSaved:()=>{}})));
    assert.ok(returnHtml.includes('Enregistrement des données confirmées'));
    assert.equal(renderToStaticMarkup(createElement(Router,{ssrPath:'/prospects/test'},createElement(ConnectorEnrichmentReturn,{prospectId:'test',onSaved:()=>{}}))),'');
    console.log('✓ Catalogue : fonctions distinctes, sources assistées, cibles obligatoires et retour direct sur la fiche');
  `},outfile:join(directory,'test.mjs'),platform:'node',format:'esm',bundle:true,jsx:'automatic',
    tsconfig:join(root,'artifacts/growthos/tsconfig.json'),plugins:[{name:'no-browser-transport',setup(build){
      build.onLoad({filter:/\/lib\/api-client\.ts$/},()=>({contents:'export default {get(){throw Error("Unexpected SSR request")}};',loader:'ts'}));
      build.onLoad({filter:/\/lib\/pagesjaunes-device\.ts$/},()=>({contents:'export function beginConnectorTask(){};export function getConnectorTask(){};export function acknowledgeConnectorTask(){};',loader:'ts'}));
    }}],banner:{js:"import {createRequire} from 'node:module'; const require=createRequire(import.meta.url);"},logLevel:'warning'});
  await import(pathToFileURL(join(directory,'test.mjs')).href);
}finally{await rm(directory,{recursive:true,force:true});}
