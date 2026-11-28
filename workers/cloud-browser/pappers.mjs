import {readFileSync} from 'node:fs';
// Same reader in the local Chrome and server browser.
export const readPappers=readFileSync(new URL('../../extensions/growthos-pagesjaunes/pappers.js',import.meta.url),'utf8');
