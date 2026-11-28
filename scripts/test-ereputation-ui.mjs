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
    const render=(page,seed)=>{
      const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});
      seed(client);
      return renderToStaticMarkup(createElement(Router,{ssrPath:'/ereputation/campaigns'},createElement(QueryClientProvider,{client},createElement(page))));
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
  `},outfile:join(temp,'test.mjs'),platform:'node',format:'esm',bundle:true,jsx:'automatic',
    tsconfig:join(root,'artifacts/growthos/tsconfig.json'),loader:{'.css':'empty'},plugins:[{name:'no-browser-transport',setup(b){
      b.onLoad({filter:/\/lib\/api-client\.ts$/},()=>({contents:'export default {get(){throw Error("Unexpected SSR request")}};',loader:'ts'}));
    }}],banner:{js:"import {createRequire} from 'node:module'; const require=createRequire(import.meta.url);"},logLevel:'warning'});
  await import(pathToFileURL(join(temp,'test.mjs')).href);
}finally{await rm(temp,{recursive:true,force:true});}
