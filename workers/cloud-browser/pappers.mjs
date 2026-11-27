// Public rendered company data only; account-only/contact/beneficiary fields are not guessed.
export function readPappers(){
  const url=new URL(location.href),siren=url.pathname.match(/^\/entreprise\/(?:[a-z0-9-]+-)?(\d{9})\/?$/i)?.[1];
  const visible=n=>!!n?.getClientRects().length&&getComputedStyle(n).visibility!=='hidden';
  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[\s:]/g,'');
  const title=document.querySelector('h1');
  if(!siren||!visible(title))return {error:'Ouvrez une fiche entreprise Pappers publique.'};
  const root=document.querySelector('main')||document.body;
  const labels=[...root.querySelectorAll('dt,th,div,span,strong,b,p')].filter(n=>visible(n)&&(!n.children.length||['DT','TH'].includes(n.tagName)));
  const field=(...keys)=>{
    const label=labels.find(n=>keys.some(key=>norm(n.innerText)===norm(key)));
    // Some public cards wrap the label in a span while its value is adjacent
    // to the wrapper. Only read rendered siblings; never infer an identifier.
    const value=label?.nextElementSibling||label?.parentElement?.nextElementSibling;
    const text=visible(value)?clean(value.innerText):'';
    return text.length<=1000?text:'';
  };
  if(field('SIREN').replace(/\D/g,'')!==siren)return {error:'SIREN affiché non confirmé.'};
  const shownSiret=field('SIRET (siège)','SIRET du siège').replace(/\D/g,'');
  const siret=shownSiret.length===14&&shownSiret.startsWith(siren)?shownSiret:null;
  const address=field('Adresse','Adresse complète');
  const codePostal=address.match(/\b\d{5}\b/)?.[0]||null;
  const city=codePostal?clean(address.slice(address.indexOf(codePostal)+5)).replace(/^[,\s]+/,''):null;
  const fields={};
  for(const key of ['Forme juridique','Capital social','Numéro de TVA','Inscription au RCS','Inscription au RNE','Création','Effectif','Activité principale déclarée','Convention collective supposée']){
    const value=field(key);if(value&&value.length<=1000&&!/réservé|connecté|habilit/i.test(value))fields[key]=value;
  }
  if(/s’est opposée|s'est opposée/i.test(root.innerText||'')&&/à des fins de prospection/i.test(root.innerText||''))fields['Opposition à la prospection']='Signalée explicitement par Pappers';
  for(const table of [...root.querySelectorAll('table')].filter(visible).slice(0,2)){
    let year='';
    for(const row of table.querySelectorAll('tr')){
      if(!visible(row))continue;const cells=[...row.querySelectorAll('th,td')].map(n=>clean(n.innerText));
      if(cells.some(v=>/^20\d{2}$/.test(v)))year=cells.filter(v=>/^20\d{2}$/.test(v)).join(' / ');
      else if(year&&/^(?:Chiffre d’affaires|Chiffre d'affaires|Résultat net|Trésorerie|Fonds propres)$/i.test(cells[0]||''))fields[(cells[0]+' · '+year).slice(0,100)]=cells.slice(1).join(' · ').slice(0,1000);
    }
  }
  const headings=[...root.querySelectorAll('h2')].filter(visible),heading=headings.find(h=>/^dirigeants? et repr[eé]sentants/i.test(clean(h.innerText)));
  const next=heading?headings[headings.indexOf(heading)+1]:null;
  const anchors=[...root.querySelectorAll('a[href*="/dirigeant/"]')].filter(a=>visible(a)&&heading&&(heading.compareDocumentPosition(a)&4)&&(!next||(next.compareDocumentPosition(a)&2)));
  const managerContacts=[];
  for(const a of anchors){
    const name=clean(a.innerText);if(name.length<3||name.length>150||managerContacts.some(c=>c.name===name))continue;
    let card=a.parentElement;
    for(let parent=card?.parentElement,depth=0;parent&&parent!==root&&depth<5;parent=parent.parentElement,depth++){
      if(clean(parent.innerText).length>1500||parent.querySelector('h2')||new Set([...parent.querySelectorAll('a[href*="/dirigeant/"]')].map(n=>n.href)).size>1)break;
      card=parent;
    }
    const role=clean(card?.innerText).match(/\b(?:Pr[eé]sident(?:e)?|G[eé]rant(?:e)?|Directeur g[eé]n[eé]ral|Administrateur|Associ[eé](?:e)?)(?: et associ[eé] ind[eé]finiment responsable)?\b/i)?.[0]||null;
    const profile=new URL(a.href,url.href);if(profile.hostname.replace(/^www\./,'')!=='pappers.fr')continue;
    managerContacts.push({name,role,phone:null,email:null,profileUrl:profile.href});
    if(managerContacts.length>=30)break;
  }
  const links=[...root.querySelectorAll('a[href]')].filter(visible).flatMap(a=>{
    try{const u=new URL(a.href,url.href),label=clean(a.innerText);return u.protocol==='https:'&&u.hostname.replace(/^www\./,'')==='pappers.fr'&&/statuts|comptes annuels|document juridique/i.test(label)&&label.length<=180?[{label,url:u.href}]:[];}catch{return [];}
  }).slice(0,20);
  const ape=field('Code NAF ou APE').match(/\b\d{2}\.\d{2}[A-Z]\b/)?.[0]||null;
  return {results:[{source:'pappers',company:clean(title.innerText).slice(0,160),siren,siret,address:address||null,codePostal,city,sourceUrl:url.href,apeCode:ape,apeScope:'unite_legale',phone:null,email:null,website:null,
    companyDetails:{fields,managers:managerContacts.map(c=>c.name),managerContacts,establishments:siret?[{siret,address:address||null}]:[],links}}]};
}
