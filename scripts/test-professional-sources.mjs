/** Real shared helpers and React markup; no browser session or remote service. */
import {createRequire} from 'node:module';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(new URL('../artifacts/api-server/build.mjs',import.meta.url));
const {build}=require('esbuild');
const directory=await mkdtemp(join(tmpdir(),'growthos-professional-sources-'));
try {
  await build({stdin:{resolveDir:join(root,'artifacts/growthos'),loader:'tsx',contents:`
    import assert from 'node:assert/strict';
    import {createElement} from 'react';
    import {Router} from 'wouter';
    import {renderToStaticMarkup} from 'react-dom/server';
    import {PROFESSIONAL_SOURCES,professionalSourceUrl} from '../../lib/api-zod/src/professional-sources';
    import {prospectSourceLinks} from './src/lib/prospect-source-links';
    import {ProspectProfessionalSources} from './src/components/ProspectProfessionalSources';
    assert.equal(professionalSourceUrl('linkedin','https://linkedin.com/company/ATELIER/about/?trk=x#about'),'https://www.linkedin.com/company/atelier/');
    const urls={linkedin:'https://www.linkedin.com/company/atelier/',facebook:'https://www.facebook.com/atelier.test/',instagram:'https://www.instagram.com/atelier.test/',tiktok:'https://www.tiktok.com/@atelier.test/',bing:'https://www.bing.com/search?q=atelier+Roubaix'};
    for(const [source,url] of Object.entries(urls)) {
      assert.equal(professionalSourceUrl(source,url),url);
      assert.equal(professionalSourceUrl(source,url.replace('https:','http:')),null);
      assert.equal(professionalSourceUrl(source,url.replace('.com/','.com.evil.example/')),null);
      assert.equal(professionalSourceUrl(source,url.replace('https://','https://user:pass@')),null);
    }
    for(const [source,url] of [
      ['linkedin','https://www.linkedin.com/in/dirigeant/'],
      ['linkedin','https://www.linkedin.com/company/atelier/posts/123'],
      ['facebook','https://www.facebook.com/atelier.test/posts/123'],
      ['facebook','https://www.facebook.com/search/?q=atelier'],
      ['instagram','https://www.instagram.com/p/123'],
      ['instagram','https://www.instagram.com/explore/'],
      ['tiktok','https://www.tiktok.com/@atelier.test/video/123'],
      ['linkedin','https://www.linkedin.com:444/company/atelier/'],
      ['linkedin','javascript:alert(1)'],['linkedin',null],['unknown',urls.linkedin],
    ]) assert.equal(professionalSourceUrl(source,url),null);
    const observations=Object.entries(urls).map(([source,sourceUrl])=>({source,sourceUrl,capturedAt:'2026-11-25T10:00:00Z'}));
    observations.push({source:'linkedin',sourceUrl:'https://linkedin.com/company/ATELIER/about/?trk=test',capturedAt:'2026-11-25T11:00:00Z'});
    observations.push({source:'facebook',sourceUrl:'https://www.facebook.com.evil.example/atelier/',capturedAt:'invalid'});
    observations.push({source:'linkedin',sourceUrl:'javascript:alert(1)',capturedAt:'invalid'});
    observations.push(null);
    const prospect={company:'Atelier Test',city:'Roubaix',phone:'03 20 11 22 33',linkedinUrl:urls.linkedin,
      source:'linkedin',sourceUrl:urls.linkedin,sourceDetails:{crossSource:{observations},pagesjaunes:{socials:{facebook:urls.facebook},capturedAt:'2026-11-24T09:00:00Z'}}};
    const links=prospectSourceLinks(prospect);
    assert.equal(links.length,5,'Une seule ligne par URL de profil canonique');
    assert.equal(links[0].url,urls.linkedin);
    assert.equal(links[0].capturedAt,'2026-11-25T11:00:00.000Z');
    assert.ok(links[0].origins.includes('Champ LinkedIn du CRM'));
    assert.ok(links[0].origins.includes('Capture du connecteur'));
    assert.ok(links.find(link=>link.source==='facebook').origins.includes('Relevé sur PagesJaunes'));
    assert.deepEqual(prospectSourceLinks({sourceDetails:{crossSource:{observations:'invalid'}}}),[]);
    const invalidDate=prospectSourceLinks({sourceDetails:{crossSource:{observations:[{source:'linkedin',sourceUrl:urls.linkedin,capturedAt:'invalid'}]}}});
    assert.equal(invalidDate[0].capturedAt,null);
    const render=(prospect)=>renderToStaticMarkup(createElement(Router,{ssrPath:'/prospects/test'},createElement(ProspectProfessionalSources,{prospect})));
    const html=render(prospect);
    for(const source of PROFESSIONAL_SOURCES) assert.ok(html.includes(source.label));
    for(const url of Object.values(urls)) assert.ok(html.includes(url.replaceAll('&','&amp;')));
    assert.ok(html.includes('Capture du connecteur'));
    assert.ok(html.includes('dateTime="2026-11-25T11:00:00.000Z"'));
    assert.ok(html.includes('/prospects/connecteur'));
    assert.ok(!html.includes('javascript:'));
    assert.ok(!html.includes('evil.example'));
    assert.ok(!html.includes('03 20 11 22 33'),'La recherche utilise le nom, pas le téléphone');
    assert.ok(html.includes(encodeURIComponent('site:linkedin.com/company/ Atelier Test Roubaix')));
    assert.ok(html.includes('https://www.bing.com/search?q='+encodeURIComponent('Atelier Test Roubaix')));
    const empty=render({company:'Entreprise test'});
    assert.equal((empty.match(/Aucun lien collecté/g)||[]).length,5);
    assert.ok(!empty.includes('NaN') && !empty.includes('Invalid Date'));
    const unnamed=render({city:'Roubaix'});
    assert.ok(!unnamed.includes('google.com/search') && !unnamed.includes('bing.com/search'),'Une ville seule ne déclenche pas une recherche présentée comme un nom');
    console.log('✓ Sources professionnelles : URLs, refus des publications, provenance, dédoublonnage et rendu React des cinq sources');
  `},outfile:join(directory,'test.mjs'),platform:'node',format:'esm',bundle:true,jsx:'automatic',
    tsconfig:join(root,'artifacts/growthos/tsconfig.json'),
    banner:{js:"import {createRequire} from 'node:module'; const require=createRequire(import.meta.url);"},logLevel:'warning'});
  await import(pathToFileURL(join(directory,'test.mjs')).href);
} finally {
  await rm(directory,{recursive:true,force:true});
}
