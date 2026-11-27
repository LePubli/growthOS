import {createRequire} from 'node:module';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(new URL('../artifacts/api-server/build.mjs',import.meta.url));
const {build}=require('esbuild');
const directory=await mkdtemp(join(tmpdir(),'growthos-cloud-import-'));
try{
  await build({stdin:{resolveDir:join(root,'artifacts/growthos'),loader:'tsx',contents:String.raw`
    import assert from 'node:assert/strict';
    import {createElement} from 'react';import {Router} from 'wouter';import {renderToStaticMarkup} from 'react-dom/server';
    import Feedback,{pendingCloudCaptures,CaptureImportBadge} from './src/components/cloud-browser/CloudImportFeedback';
    const captures=['new','imported','enriched','known','review','error','missing'].map(id=>({id,company:'Entreprise '+id}));
    const imports={imported:{captureId:'imported',status:'imported',prospectId:'crm-new'},enriched:{captureId:'enriched',status:'enriched',prospectId:'crm-enriched'},
      known:{captureId:'known',status:'already_present',prospectId:'crm-known'},review:{captureId:'review',status:'needs_review',prospectId:'crm-review'},
      error:{captureId:'error',status:'failed'},missing:{captureId:'missing',status:'missing'}};
    assert.deepEqual(pendingCloudCaptures(captures,imports).map(c=>c.id),['new','review','error','missing'],'Les fiches traitées ne restent pas proposées à l’import');
    assert.deepEqual(pendingCloudCaptures(captures).map(c=>c.id),captures.map(c=>c.id),'Pas de reçu inventé pour une nouvelle recherche');
    const render=()=>renderToStaticMarkup(createElement(Router,{ssrPath:'/navigateur'},createElement(Feedback,{captures,imports})));
    const html=render();
    for(const label of ['Importée dans le CRM','Fiche CRM enrichie','Déjà présente dans le CRM','Fiches traitées (3)','4 fiche(s) restante(s)'])assert.ok(html.includes(label),label);
    assert.equal((html.match(/Ouvrir la fiche CRM/g)||[]).length,3);
    assert.ok(html.includes('/prospects/crm-new')&&html.includes('/prospects/crm-known'));
    assert.ok(!html.includes('type="checkbox"'),'Les fiches traitées ne sont pas sélectionnables une deuxième fois');
    assert.equal(render(),html,'Les mêmes reçus serveur donnent le même état après actualisation');
    for(const id of ['review','error','missing'])assert.ok(renderToStaticMarkup(createElement(CaptureImportBadge,{state:imports[id]})).length>0);
    console.log('✓ Imports cloud : fiches traitées retirées de la sélection, statuts précis, liens CRM et erreurs restant à traiter');
  `},outfile:join(directory,'test.mjs'),platform:'node',format:'esm',bundle:true,jsx:'automatic',tsconfig:join(root,'artifacts/growthos/tsconfig.json'),
    banner:{js:"import {createRequire} from 'node:module'; const require=createRequire(import.meta.url);"},logLevel:'warning'});
  await import(pathToFileURL(join(directory,'test.mjs')).href);
}finally{await rm(directory,{recursive:true,force:true});}
