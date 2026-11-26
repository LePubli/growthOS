import {createRequire} from 'node:module';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(new URL('../artifacts/api-server/build.mjs',import.meta.url));
const {build}=require('esbuild');
const directory=await mkdtemp(join(tmpdir(),'growthos-cloud-history-'));
try{
  await build({stdin:{resolveDir:join(root,'artifacts/growthos'),loader:'tsx',contents:String.raw`
    import assert from 'node:assert/strict';
    import {createElement} from 'react';
    import {Router} from 'wouter';
    import {renderToStaticMarkup} from 'react-dom/server';
    import History,{CaptureBatchControls,selectCaptureBatch,canRemoveHistory} from './src/components/cloud-browser/CloudJobHistory';
    const captures=[{id:'a',company:'Atelier A',address:'1 rue du Test',city:'Roubaix'},{id:'b',company:'Atelier B'}];
    const base={profile_id:'profile',prospect_id:null,mode:'discover',query:'plombier',area:'Roubaix',error:null};
    const done={...base,id:'done',status:'completed',result:{captures,drafts:[{id:'draft'}]}};
    const cancelled={...base,id:'cancelled',query:'annulée',status:'cancelled',result:{}};
    const queued={...base,id:'queued',query:'en cours',status:'queued',result:{}};
    const noop=()=>{};
    const render=(chosen={})=>renderToStaticMarkup(createElement(Router,{ssrPath:'/navigateur'},createElement('div',null,
      createElement(CaptureBatchControls,{captures,chosen,busy:false,onChooseBatch:noop}),
      createElement(History,{jobs:[done,cancelled,queued],busy:false,onRemove:noop,
        renderJob:(job,selection,remove)=>createElement('article',{key:job.id},selection,job.query,remove)}))));
    const checked=selectCaptureBatch({other:true},captures,true);
    assert.deepEqual(checked,{other:true,a:true,b:true});
    assert.deepEqual(selectCaptureBatch(checked,captures,false),{other:true},'Décocher le lot conserve la sélection des autres recherches');
    assert.deepEqual(selectCaptureBatch({other:true},[],true),{other:true});
    assert.equal(canRemoveHistory(done),true);assert.equal(canRemoveHistory(cancelled),true);
    assert.equal(canRemoveHistory(queued),false);assert.equal(canRemoveHistory({...queued,status:'running'}),false);
    assert.equal(canRemoveHistory({...queued,status:'needs_review'}),false);
    const empty=render();
    assert.ok(empty.includes('Tout cocher dans ce lot')&&empty.includes('Tout décocher'));
    assert.ok(empty.includes('0 / 2 fiche(s) sélectionnée(s)'));
    assert.ok(/disabled=""[^>]*>Tout décocher/.test(empty));
    assert.ok(empty.includes('Effacer l’historique terminé')&&empty.includes('Supprimer la sélection (0)'));
    assert.equal((empty.match(/Supprimer la tâche/g)||[]).length,2,'Seules les deux tâches terminées ont une suppression directe');
    assert.ok(empty.includes('cloud-browser-history-grid'),'Conserver les cartes compactes du nouveau design');
    assert.ok(render({a:true}).includes('aria-checked="mixed"'));
    const all=render(checked);
    assert.ok(all.includes('2 / 2 fiche(s) sélectionnée(s)'));
    assert.ok(!/disabled=""[^>]*>Tout décocher/.test(all));
    assert.ok(!all.includes('3 / 2'),'La sélection d’un autre lot ne compte pas dans ce lot');
    console.log('✓ Historique cloud : sélection totale/partielle par lot, isolation des sélections, import borné, reprise et suppression des seules tâches terminées');
  `},outfile:join(directory,'test.mjs'),platform:'node',format:'esm',bundle:true,jsx:'automatic',tsconfig:join(root,'artifacts/growthos/tsconfig.json'),
    banner:{js:"import {createRequire} from 'node:module'; const require=createRequire(import.meta.url);"},logLevel:'warning'});
  await import(pathToFileURL(join(directory,'test.mjs')).href);
}finally{await rm(directory,{recursive:true,force:true});}
