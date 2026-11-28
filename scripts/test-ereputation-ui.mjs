// E-réputation lot 1 — rendu serveur des écrans et absence de valeurs fictives.
// Lancement : node scripts/test-ereputation-ui.mjs (aucune API ni base requise).
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

// ── Contrôles statiques : plus de valeurs inventées dans le module.
const read=p=>readFileSync(join(root,p),'utf8');
assert.ok(!/Math\.random/.test(read('artifacts/growthos/src/plugins/ereputation/SERPTrackingPage.tsx')),'SERP : aucune variation aléatoire');
for(const file of ['artifacts/api-server/src/routes/v1/client-ereputation.ts','artifacts/growthos/src/plugins/client-portal/ClientDashboardPage.tsx']){
  assert.ok(!/\?\?\s*50\b/.test(read(file)),`${file} : aucun score par défaut à 50`);
}
const service=read('artifacts/api-server/src/lib/plugin-ereputation/CampaignService.ts');
assert.ok(!/mock(Serp|Sentiment|Pbn)/.test(service),'Service : générateurs de données factices supprimés');
assert.ok(!/Planifier 5 posts|Vérifier l'état des sites PBN/.test(service),'Service : aucune tâche codée en dur');
assert.ok(!/catch\s*\{\s*\/\*\s*ignore\s*\*\/\s*\}/.test(service),'Service : aucune écriture en échec ignorée');
console.log('✓ E-réputation : aucune donnée aléatoire, score par défaut ou tâche codée en dur');

const temp=await mkdtemp(join(tmpdir(),'growthos-erep-ui-'));
try{
  await build({stdin:{resolveDir:join(root,'artifacts/growthos'),loader:'tsx',contents:`
    import assert from 'node:assert/strict';
    import {createElement} from 'react';
    import {Router} from 'wouter';
    import {renderToStaticMarkup} from 'react-dom/server';
    import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
    import CampaignsPage from './src/plugins/ereputation/CampaignsPage';
    import ERepDashboardPage from './src/plugins/ereputation/ERepDashboardPage';
    import WatchPage from './src/plugins/ereputation/WatchPage';
    const mandate={reference:null,signatory:null,signedAt:null,scope:null,retentionUntil:null};
    const campaigns=[
      {id:'11111111-1111-1111-1111-111111111111',name:'Réputation Acme',targetType:'B2B',targetName:'Acme Lille',targetUrl:null,keywords:['acme avis'],
       description:null,prospectId:'p1',prospectLabel:'Acme SAS',subjectAliases:[],subjectLocation:'Lille (59)',subjectRole:null,mandate,
       status:'active',reputationScore:72,createdAt:'2026-11-28T10:00:00Z'},
      {id:'22222222-2222-2222-2222-222222222222',name:'Réputation Albert Ducamps',targetType:'B2C',targetName:'Albert Ducamps',targetUrl:null,keywords:[],
       description:null,prospectId:null,prospectLabel:null,subjectAliases:['A. Ducamps'],subjectLocation:null,subjectRole:'Dirigeant',
       mandate:{reference:'MAND-2026-014',signatory:'Albert Ducamps',signedAt:'2026-11-28',scope:null,retentionUntil:'2027-11-28'},
       status:'paused',reputationScore:null,createdAt:'2026-11-28T11:00:00Z'},
    ];
    const render=(page,seed,ssrPath='/ereputation/campaigns',ssrSearch='')=>{
      const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});
      seed(client);
      return renderToStaticMarkup(createElement(Router,{ssrPath,ssrSearch},createElement(QueryClientProvider,{client},createElement(page))));
    };
    const list=render(CampaignsPage,c=>c.setQueryData(['erep-campaigns',{showArchived:false}],campaigns));
    assert.ok(list.includes('Entité')&&list.includes('Personne physique'),'Libellés entité / personne physique');
    assert.ok(list.includes('72/100'),'Score mesuré affiché');
    assert.ok(list.includes('Non évalué')&&!list.includes('50/100')&&!list.includes('0/100'),'Score absent affiché « Non évalué »');
    assert.ok(list.includes('Mandat MAND-2026-014'),'Mandat RGPD visible sur la campagne personne');
    assert.ok(list.includes('CRM : Acme SAS'),'Fiche CRM liée visible');
    assert.ok(list.includes('aria-label="Modifier"')&&list.includes('aria-label="Historique"')&&list.includes('aria-label="Supprimer"'),'Actions modifier, historique et supprimer');
    assert.ok(list.includes('En pause')&&list.includes('Archivée'),'Changement de statut proposé');
    const dashboard=render(ERepDashboardPage,c=>c.setQueryData(['erep-campaigns'],campaigns));
    assert.ok(dashboard.includes('Basé sur 1 campagne évaluée sur 2'),'Tableau de bord : moyenne des seules campagnes évaluées');
    assert.ok(dashboard.includes('>72<'),'Tableau de bord : score global = 72 (la campagne non évaluée ne compte pas)');
    console.log('✓ E-réputation : liste, statuts, mandat, lien CRM et score « non évalué » rendus');
    assert.ok(list.includes('aria-label="Veille"')&&list.includes('/ereputation/watch?campaign=11111111-1111-1111-1111-111111111111'),'Accès à la veille depuis la campagne');

    // ── Lot 2 : écran Veille
    const cid='11111111-1111-1111-1111-111111111111';
    const settings={engines:['google_search','bing'],extraQueries:[],mapsUrl:'https://www.google.com/maps/place/Acme',pagesjaunesUrl:null,newsEnabled:true,rssFeeds:[],
      frequency:'daily',dailyDepth:20,weeklyDepth:50,nextRunAt:'2026-11-29T03:46:00Z',nextWeeklyAt:'2026-11-29T03:46:00Z',configured:true};
    const watch=render(WatchPage,c=>{
      c.setQueryData(['erep-campaigns',{showArchived:false}],campaigns);
      c.setQueryData(['erep-watch',cid],{settings,queries:['"Acme Lille"','"Acme Lille" avis'],cloudConfigured:true,profiles:{google_search:true,bing:false,google_maps:true,pagesjaunes:false},lastRun:null});
      c.setQueryData(['erep-watch',cid,'runs'],[
        {id:'r2',kind:'manual',depth:20,status:'awaiting_user',steps:[{type:'reviews',source:'pagesjaunes',url:'https://www.pagesjaunes.fr/pros/1',status:'awaiting_user',message:'Contrôle de sécurité'}],
         stats:{steps:1,newItems:2,dropped:1,moved:3,baseline:false},message:'Une source demande une vérification',createdAt:'2026-11-28T10:00:00Z',finishedAt:'2026-11-28T10:05:00Z'},
        {id:'r1',kind:'daily',depth:20,status:'completed',steps:[],stats:{steps:4,newItems:0,dropped:0,moved:0,baseline:true},message:null,createdAt:'2026-11-27T03:00:00Z',finishedAt:'2026-11-27T03:10:00Z'}]);
      c.setQueryData(['erep-watch',cid,'mentions','new'],{counts:{total:3,new:3,newSinceBaseline:2,negative:1},mentions:[
        {id:'m1',kind:'serp',source:'google_search',url:'https://r6.example/nouveau',title:'Acme Lille arnaque ?',excerpt:'Avis négatif',sentiment:'neg',status:'new',baseline:false,first_seen_at:'2026-11-28T10:01:00Z'},
        {id:'m2',kind:'news',source:'google_news',url:'javascript:alert(1)',title:'Article piégé',excerpt:null,sentiment:'neu',status:'new',baseline:true,first_seen_at:'2026-11-27T03:01:00Z'}]});
      c.setQueryData(['erep-watch',cid,'serp'],[
        {engine:'google_search',query:'"Acme Lille"',position:1,url:'https://r2.example/b',title:'R2',previous_position:2,is_new:false,captured_at:'2026-11-28T10:02:00Z'},
        {engine:'google_search',query:'"Acme Lille"',position:4,url:'https://r6.example/nouveau',title:'R6',previous_position:null,is_new:true,captured_at:'2026-11-28T10:02:00Z'}]);
      c.setQueryData(['erep-watch',cid,'reviews'],{stats:[{source:'google_maps',rating:4.2,review_count:128,captured_at:'2026-11-28T10:03:00Z'}],
        reviews:[{id:'v1',source:'google_maps',author:'Paul',rating:1,review_date:'il y a 1 semaine',text:'Chantier abandonné',sentiment:'neg',owner_response:true}]});
    },'/ereputation/watch','campaign='+cid);
    assert.ok(watch.includes('Vérification requise')&&watch.includes('Reprendre')&&watch.includes('Annuler'),'Veille : passage en attente avec reprise et annulation');
    assert.ok(watch.includes('2 nouveauté(s) · 1 disparu(s) · 3 déplacé(s)')&&watch.includes('Relevé de référence'),'Veille : nouveautés, disparus, déplacés et référence');
    assert.ok(watch.includes('2 nouveauté(s), 1 négative(s)')&&watch.includes('Nouveau')&&watch.includes('Négatif'),'Veille : fil des mentions avec nouveautés et sentiment');
    assert.ok(!watch.includes('javascript:alert')&&watch.includes('Article piégé'),'Veille : lien non http(s) neutralisé');
    assert.ok(watch.includes('▲ 1')&&watch.includes('4,2/5')&&watch.includes('128 avis')&&watch.includes('réponse publiée'),'Veille : évolution SERP, note et avis');
    assert.ok(watch.includes('Profil navigateur manquant : Bing'),'Veille : profil navigateur manquant signalé');
    assert.ok(watch.includes('aria-label="Qualifier"')&&watch.includes('aria-label="Ignorer"'),'Veille : qualification des mentions');
    console.log('✓ E-réputation : écran Veille (passages, fil, SERP, avis, réglages) rendu');
  `},outfile:join(temp,'test.mjs'),platform:'node',format:'esm',bundle:true,jsx:'automatic',
    tsconfig:join(root,'artifacts/growthos/tsconfig.json'),loader:{'.css':'empty'},plugins:[{name:'no-browser-transport',setup(b){
      b.onLoad({filter:/\/lib\/api-client\.ts$/},()=>({contents:'export default {get(){throw Error("Unexpected SSR request")}};',loader:'ts'}));
    }}],banner:{js:"import {createRequire} from 'node:module'; const require=createRequire(import.meta.url);"},logLevel:'warning'});
  await import(pathToFileURL(join(temp,'test.mjs')).href);
}finally{await rm(temp,{recursive:true,force:true});}
