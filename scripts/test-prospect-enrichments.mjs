// Contrat visuel/fonctionnel de la fiche Enrichissements : aucun résultat fictif.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(new URL('../artifacts/api-server/build.mjs',import.meta.url));
const {build}=require('esbuild');
const styles=readFileSync(join(root,'artifacts/growthos/src/prospect-enrichments.css'),'utf8');
assert.ok(styles.includes('.atlas-enrichments-workspace')&&styles.includes('grid-template-columns:repeat(2,minmax(0,1fr))'));
assert.ok(readFileSync(join(root,'artifacts/growthos/index.html'),'utf8').includes('700;800;900&display=swap'),
  'Les graisses de titres 800 et 900 doivent être chargées.');
const temp=await mkdtemp(join(tmpdir(),'growthos-prospect-enrichments-'));
try{
  await build({stdin:{resolveDir:join(root,'artifacts/growthos'),loader:'tsx',contents:`
    import assert from 'node:assert/strict';
    import {createElement} from 'react';
    import {Router} from 'wouter';
    import {renderToStaticMarkup} from 'react-dom/server';
    import {ProspectEnrichmentsTab} from './src/components/ProspectEnrichmentsTab';
    const properties={
      prospectId:'prospect-test',busy:false,onEnrich:()=>{},onOpenSources:()=>{},sourceDetails:{},
      activities:[],
      observations:[
        {captureId:'one',source:'google_maps',capturedAt:'2026-11-27T09:08:25Z',fieldsFilled:['address','city','phone'],sourceUrl:'https://www.google.com/maps'},
        {captureId:'two',source:'google_maps',capturedAt:'2026-11-27T13:57:52Z'},
        {captureId:'three',source:'google_maps',capturedAt:'2026-11-27T14:04:07Z'},
      ],
      run:{id:'run',status:'completed',updated_at:'2026-11-27T14:04:07Z',
        steps:{
          google_maps:{label:'Google Maps',status:'completed',message:'Correspondance confirmée'},
          pagesjaunes:{label:'PagesJaunes',status:'awaiting_user',message:'Contrôle Cloudflare',jobId:'job-test'},
          societe_com:{label:'Societe.com',status:'needs_review',message:'Rapprochement incertain'},
          pappers:{label:'Pappers',status:'awaiting_user',message:'Ouvrir la fiche'},
          google_search:{label:'Google Search',status:'awaiting_user',message:'Résultats à contrôler'},
          bing:{label:'Bing',status:'awaiting_user',message:'Résultats à contrôler'},
          entreprises:{label:'Annuaire des Entreprises',status:'empty',message:'Aucune correspondance'},
          insee:{label:'INSEE Sirene',status:'skipped',message:'Accès non configuré'},
          bodacc:{label:'BODACC',status:'skipped',message:'SIREN requis'},
        },
        summary:{sourcesDone:1,sourcesTotal:9,fields:[],conflicts:0,interventions:5}},
    };
    const render=(props)=>renderToStaticMarkup(createElement(Router,{ssrPath:'/prospects/prospect-test'},
      createElement(ProspectEnrichmentsTab,props)));
    const html=render(properties);
    for(const marker of ['atlas-enrichments-metrics','atlas-enrichments-workspace','État des sources',
      'Actions prioritaires','Derniers champs mis à jour','Historique des captures','Modifications tracées',
      'Sources consultées','Confirmée(s)','À vérifier','Sans résultat ou indisponibles',
      'Annuaire des Entreprises','PagesJaunes','Pappers','BODACC','Adresse','Ville','Téléphone']){
      assert.ok(html.includes(marker),'Onglet incomplet : '+marker);
    }
    assert.equal((html.match(/class="atlas-enrichments-source is-/g)||[]).length,9);
    assert.equal((html.match(/class="atlas-enrichments-capture"/g)||[]).length,3);
    assert.ok(html.includes('navigateur?source=pagesjaunes')&&html.includes('jobId=job-test'));
    assert.ok(html.includes('5 source(s) à vérifier')&&html.includes('À vérifier (5)'));
    const empty=render({...properties,run:null,observations:[]});
    assert.ok(empty.includes('Aucune collecte multisource enregistrée')&&empty.includes('Aucune capture enregistrée'));
    assert.ok(!empty.includes('5 source(s) à vérifier')&&!empty.includes('Correspondance confirmée'));
    console.log('✓ Enrichissements : 9 sources réelles, statuts, reprise, 3 captures et état vide');
  `},outfile:join(temp,'test.mjs'),platform:'node',format:'esm',bundle:true,jsx:'automatic',
    tsconfig:join(root,'artifacts/growthos/tsconfig.json'),loader:{'.css':'empty'},
    banner:{js:"import {createRequire} from 'node:module'; const require=createRequire(import.meta.url);"},
    logLevel:'warning'});
  await import(pathToFileURL(join(temp,'test.mjs')).href);
}finally{await rm(temp,{recursive:true,force:true});}
