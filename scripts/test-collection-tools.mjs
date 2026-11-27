// Le catalogue réel et son rendu React, sans session ni service distant.
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(new URL('../artifacts/api-server/build.mjs',import.meta.url));
const cloudStyles=readFileSync(join(root,'artifacts/growthos/src/cloud-browser.css'),'utf8');
if(!cloudStyles.includes(':is(input,select):focus-visible {outline:none')
  ||!cloudStyles.includes('.cloud-browser-input-icon:focus-within')){
  throw new Error('Les champs du navigateur doivent utiliser un focus discret sur leur contenant, sans encart bleu intérieur.');
}
const {build}=require('esbuild');
const directory=await mkdtemp(join(tmpdir(),'growthos-collection-tools-'));
try{
  await build({stdin:{resolveDir:join(root,'artifacts/growthos'),loader:'tsx',contents:`
    import assert from 'node:assert/strict';
    import {createElement} from 'react';
    import {Router} from 'wouter';
    import {renderToStaticMarkup} from 'react-dom/server';
    import CollectionToolsPage from './src/pages/CollectionToolsPage';
    import CloudBrowserPage from './src/pages/CloudBrowserPage';
    import {ConnectorEnrichmentReturn} from './src/components/ConnectorEnrichmentReturn';
    import modules from '../../extensions/growthos-pagesjaunes/modules.json';
    const render=(search='')=>renderToStaticMarkup(createElement(Router,{ssrPath:'/outils',ssrSearch:search},createElement(CollectionToolsPage)));
    const discovery=render();
    assert.equal((discovery.match(/<article/g)||[]).length,modules.filter(m=>m.modes.includes('discover')).length);
    for(const source of modules.filter(m=>m.modes.includes('discover'))) assert.ok(discovery.includes(source.name));
    assert.ok(discovery.includes('/navigateur?source=entreprises') && discovery.includes('/navigateur?source=pagesjaunes'));
    assert.ok(discovery.includes('Collecteur cloud') && discovery.includes('Connecteurs en préparation'));
    assert.ok(discovery.includes('/navigateur?source=google_maps') && discovery.includes('Secours externe'));
    assert.ok(discovery.indexOf('Ouvrir la source')<discovery.indexOf('Secours externe'));
    for(const marker of ['collection-hub-mode','collection-hub-search',
      'collection-hub-cards','collection-hub-assistant','Parcours conseillé','collection-hub-upcoming-grid',
      'aria-pressed="true"','Automatisation à venir','Validation humaine avant modification du CRM']){
      assert.ok(discovery.includes(marker),'Catalogue redessiné incomplet : '+marker);
    }
    assert.ok(discovery.indexOf('collection-hub-cards')<discovery.indexOf('collection-hub-assistant'));
    const browserHtml=renderToStaticMarkup(createElement(Router,{ssrPath:'/navigateur',ssrSearch:'source=societe_com'},createElement(CloudBrowserPage)));
    assert.ok(browserHtml.includes('Recherche et collecte') && browserHtml.includes('Sans compte') && browserHtml.includes('Mon compte'));
    assert.ok(browserHtml.includes('Mes profils de navigation') && browserHtml.includes('Tâches récentes'));
    assert.ok(browserHtml.includes('Tous les résultats accessibles')&&!browserHtml.includes('Nombre maximum de fiches'),'Pas de plafond total affiché');
    assert.ok(!browserHtml.includes('Compte connecté'),'Ne pas présenter une session non vérifiée comme connectée');
    for(const marker of ['cloud-browser-command-grid','cloud-browser-workspace','cloud-browser-view-panel',
      'cloud-browser-results-list','cloud-browser-history','Importer dans Prospects',
      'Reprendre le contrôle','Ouvrir cette source','Déconnecter et effacer la session']){
      assert.ok(browserHtml.includes(marker),'Espace navigateur manquant : '+marker);
    }
    assert.ok(browserHtml.indexOf('cloud-browser-command-grid')<browserHtml.indexOf('cloud-browser-workspace'));
    assert.ok(browserHtml.indexOf('cloud-browser-view-panel')<browserHtml.indexOf('cloud-browser-results-list'));
    assert.ok(browserHtml.includes('role="separator"')&&browserHtml.includes('aria-label="Redimensionner les panneaux navigateur et résultats"'),
      'La répartition navigateur/résultats doit rester ajustable et accessible');
    assert.ok(browserHtml.indexOf('cloud-browser-view-panel')<browserHtml.indexOf('cloud-browser-divider')
      &&browserHtml.indexOf('cloud-browser-divider')<browserHtml.indexOf('cloud-browser-results"'),
      'Le séparateur doit se trouver exactement entre les deux panneaux');
    assert.ok(browserHtml.includes('cloud-browser-history-drawer')&&browserHtml.includes('Gérer l’historique'),
      'La vue immersive replie les tâches tout en conservant leur accès');
    assert.ok(browserHtml.includes('cloud-browser-results-footer')&&browserHtml.includes('Importer dans Prospects (0)'),
      'Le bouton d’import doit rester fixé dans la colonne des résultats');
    const officialHtml=renderToStaticMarkup(createElement(Router,{ssrPath:'/navigateur',ssrSearch:'source=entreprises'},createElement(CloudBrowserPage)));
    assert.ok(officialHtml.includes('Régions')&&officialHtml.includes('Départements')&&officialHtml.includes('Codes postaux'));
    assert.ok(officialHtml.includes('Aucune extension')&&!officialHtml.includes('Afficher / reprendre le contrôle'),'Annuaire natif dans le même espace, sans ancien assistant');
    assert.ok(officialHtml.includes('Historique des recherches précédentes'));
    const enrich=render('mode=enrich');
    assert.equal((enrich.match(/<article/g)||[]).length,modules.filter(m=>m.modes.includes('enrich')).length);
    assert.ok(enrich.includes('collection-hub-prospect')&&enrich.includes('Voir la fiche 360°')===false);
    assert.ok(enrich.includes('Choisir un prospect')&&enrich.includes('aria-pressed="true"'));
    assert.ok(enrich.includes('Societe.com') && enrich.includes('ouvrez un prospect'));
    assert.ok(!enrich.includes('/sourcing?source=entreprises'));
    assert.ok(!enrich.includes('Importer la sélection'));
    assert.ok(enrich.includes('campagnes LinkedIn') && enrich.includes('restent à développer'));
    const returnHtml=renderToStaticMarkup(createElement(Router,{ssrPath:'/prospects/test',ssrSearch:'enrichmentTask=10000000-0000-4000-8000-000000000001'},createElement(ConnectorEnrichmentReturn,{prospectId:'test',onSaved:()=>{}})));
    assert.ok(returnHtml.includes('Enregistrement des données confirmées'));
    assert.equal(renderToStaticMarkup(createElement(Router,{ssrPath:'/prospects/test'},createElement(ConnectorEnrichmentReturn,{prospectId:'test',onSaved:()=>{}}))),'');
    console.log('✓ Catalogue et navigateur cloud : parcours intégré prioritaire, secours Chrome, capacités réelles, profils et tâches');
  `},outfile:join(directory,'test.mjs'),platform:'node',format:'esm',bundle:true,jsx:'automatic',
    tsconfig:join(root,'artifacts/growthos/tsconfig.json'),loader:{'.css':'empty'},plugins:[{name:'no-browser-transport',setup(build){
      build.onLoad({filter:/\/lib\/api-client\.ts$/},()=>({contents:'export default {get(){throw Error("Unexpected SSR request")}};',loader:'ts'}));
      build.onLoad({filter:/\/lib\/pagesjaunes-device\.ts$/},()=>({contents:'export function isMobileConnectorRequired(){return false};export function beginConnectorTask(){};export function getConnectorTask(){};export function acknowledgeConnectorTask(){};',loader:'ts'}));
    }}],banner:{js:"import {createRequire} from 'node:module'; const require=createRequire(import.meta.url);"},logLevel:'warning'});
  await import(pathToFileURL(join(directory,'test.mjs')).href);
}finally{await rm(directory,{recursive:true,force:true});}
