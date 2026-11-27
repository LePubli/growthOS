import {readFileSync} from 'node:fs';
const extension=readFileSync(new URL('../../extensions/growthos-pagesjaunes/background.js',import.meta.url),'utf8');
function reader(start,end){
  const a=extension.indexOf(start),b=extension.indexOf(end,a);
  if(a<0||b<a)throw Error('Lecteur PagesJaunes canonique introuvable');
  return '('+extension.slice(a,b).trim()+')()';
}
export const readers={
  societe_com:readFileSync(new URL('../../extensions/growthos-pagesjaunes/societe.js',import.meta.url),'utf8'),
  general:readFileSync(new URL('../../extensions/growthos-pagesjaunes/capture.js',import.meta.url),'utf8'),
  pagesjaunesSearch:reader('function readSearchResults()','async function waitTab('),
  pagesjaunesProfile:reader('async function readBusinessProfile()','async function enrichProfile('),
};
