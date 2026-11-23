/* Aucune connexion directe au serveur GrowthOS ; toutes les fiches restent dans Chrome. */
const $ = id => document.getElementById(id);
const labels = {google_maps:'Maps',google_search:'Google',bing:'Bing',linkedin:'LinkedIn',pagesjaunes:'PagesJaunes'};
let source='google_maps';
let currentUrl='';
let pendingDraftId=null;
function message(action,payload){return new Promise((resolve,reject)=>{
  chrome.runtime.sendMessage({action,payload},response=>{
    const error=chrome.runtime.lastError;
    if(error||!response?.ok){reject(new Error(error?.message||response?.error||'Connecteur indisponible'));return;}
    resolve(response);
  });
});}
function notice(value,error=false){
  const el=$('notice');el.textContent=value;el.classList.toggle('error',error);el.hidden=false;
}
function sourceFromUrl(value){
  try{
    const u=new URL(value),host=u.hostname;
    if(/(^|\.)bing\.com$/.test(host))return 'bing';
    if(/(^|\.)google\.(?:com|fr)$/.test(host))return u.pathname.startsWith('/maps')?'google_maps':'google_search';
    if(/(^|\.)linkedin\.com$/.test(host))return 'linkedin';
    if(/(^|\.)pagesjaunes\.fr$/.test(host))return 'pagesjaunes';
  }catch{}
  return null;
}
function selectSource(value){
  source=value;
  pendingDraftId=null;
  for(const btn of document.querySelectorAll('[data-source]'))btn.setAttribute('aria-pressed',String(btn.dataset.source===value));
  const isLinkedin=value==='linkedin',isPagesjaunes=value==='pagesjaunes';
  $('capture').disabled=isLinkedin||isPagesjaunes;
  $('manualPanel').hidden=isPagesjaunes;
  $('sourceHint').textContent=isLinkedin
    ? 'Connectez-vous normalement à LinkedIn. Son règlement interdit le scraping par extension : utilisez seulement la saisie manuelle d’une entreprise que vous avez vérifiée.'
    : isPagesjaunes ? 'PagesJaunes est collecté automatiquement depuis le formulaire GrowthOS. Vous pouvez aussi ouvrir les résultats ici.'
    : 'Ouvrez les résultats, choisissez une vraie fiche d’établissement puis cliquez sur l’icône GrowthOS pour capturer les données visibles.';
  $('manualPanel').open=isLinkedin;
  $('sourceUrl').value=sourceFromUrl(currentUrl)===value?currentUrl:'';
}
async function refresh(){
  const [data,draftData]=await Promise.all([message('list-captures'),message('list-drafts')]);
  const queue=data.results||[]; $('total').textContent=String(queue.length);
  const drafts=draftData.drafts||[];
  $('autoEnrich').disabled=!drafts.length;
  $('draftCount').textContent=String(drafts.length);
  const draftsBox=$('drafts');draftsBox.replaceChildren();
  if(!drafts.length){const p=document.createElement('p');p.className='empty';p.textContent='Aucune fiche à compléter';draftsBox.append(p);}
  for(const draft of [...drafts].reverse().slice(0,35)){
    const row=document.createElement('div');row.className='draft-row';
    const info=document.createElement('div');info.className='info';
    const title=document.createElement('strong');title.textContent=draft.company;
    const small=document.createElement('small');small.textContent=(labels[draft.source]||draft.source)
      +' · '+[draft.city,draft.phone].filter(Boolean).join(' · ');
    info.append(title,small);
    const complete=document.createElement('button');complete.textContent='Compléter';
    complete.addEventListener('click',()=>{
      selectSource(draft.source);pendingDraftId=draft.id;
      for(const [id,value] of Object.entries({company:draft.company,address:draft.address||'',
        postal:'',city:draft.city||'',phone:draft.phone||'',website:draft.website||'',sourceUrl:draft.sourceUrl})){
        $(id).value=value;
      }
      $('manualPanel').open=true;
      $('manualPanel').scrollIntoView({behavior:'smooth',block:'center'});
      $('address').focus();
      notice('Nom et coordonnées visibles préremplis. Vérifiez l’adresse et le code postal avant de valider.');
    });
    const remove=document.createElement('button');remove.className='remove';remove.textContent='✕';remove.title='Ignorer ce brouillon';
    remove.addEventListener('click',async()=>{
      try{await message('remove-draft',{id:draft.id});await refresh();}catch(e){notice(e.message,true);}
    });
    row.append(info,complete,remove);draftsBox.append(row);
  }
  const box=$('queue');box.replaceChildren();
  if(!queue.length){const p=document.createElement('p');p.className='empty';p.textContent='Aucune fiche capturée';box.append(p);return;}
  for(const item of [...queue].reverse().slice(0,40)){
    const row=document.createElement('div');row.className='item';
    const content=document.createElement('div');const title=document.createElement('strong');title.textContent=item.company;
    const small=document.createElement('small');small.textContent=(labels[item.source]||item.source)+' · '+item.codePostal+' · '+item.city;
    const remove=document.createElement('button');remove.textContent='✕';remove.title='Retirer cette fiche';
    remove.addEventListener('click',async()=>{try{await message('remove-capture',{id:item.id});await refresh();}catch(e){notice(e.message,true);}});
    content.append(title,small);row.append(content,remove);box.append(row);
  }
}
async function init(){
  try{
    const tabs=await chrome.tabs.query({active:true,currentWindow:true});
    currentUrl=tabs[0]?.url||'';
    const current=sourceFromUrl(currentUrl);
    $('currentTab').textContent=current?'· '+labels[current]:'· Ouvrez un moteur de recherche';
    selectSource(current||source);
    const saved=await chrome.storage.local.get('growthos_popup_prefs');
    $('query').value=saved.growthos_popup_prefs?.query||'';
    $('area').value=saved.growthos_popup_prefs?.area||'';
    await refresh();
  }catch(e){notice(e.message,true);}
}
for(const btn of document.querySelectorAll('[data-source]'))btn.addEventListener('click',()=>selectSource(btn.dataset.source));
$('open').addEventListener('click',async()=>{
  const query=$('query').value.trim(),area=$('area').value.trim();
  try{await chrome.storage.local.set({growthos_popup_prefs:{query,area}});
    await message('open-source',{source,query,area});window.close();
  }catch(e){notice(e.message,true);}
});
$('capture').addEventListener('click',async()=>{
  $('capture').disabled=true;
  try{const r=await message('capture-tab');await refresh();
    notice((r.added||r.draftAdded)
      ? `${r.added||0} fiche(s) prêtes · ${r.draftAdded||0} fiche(s) à compléter ci-dessous · ${(r.ignored||0)+(r.draftIgnored||0)} doublon(s)`
      : r.warning||'Aucune nouvelle fiche');
  }catch(e){notice(e.message,true);}
  finally{$('capture').disabled=source==='linkedin'||source==='pagesjaunes';}
});
$('autoEnrich').addEventListener('click',async()=>{
  const button=$('autoEnrich');button.disabled=true;
  button.textContent='Enrichissement en cours (12 fiches maximum)…';
  try{
    const result=await message('enrich-local-drafts',{area:$('area').value.trim()});
    await refresh();
    const explanation=result.errors?.length?' · Annuaire indisponible pour '+result.errors.length+' fiche(s) : '+result.errors[0]:'';
    notice(`${result.checked} fiche(s) examinée(s) · ${result.added} enrichie(s) et prêtes à sélectionner · ${result.already} déjà présentes · ${result.pending} à vérifier`+
      (result.skipped?` · ${result.skipped} à examiner au prochain clic`:'')+explanation,
    Boolean(result.errors?.length && !result.added));
  }catch(error){notice(error.message,true);}
  finally{button.textContent='✦ Enrichir les fiches à vérifier (annuaire officiel)';
    try{button.disabled=!(await message('list-drafts')).drafts?.length;}catch{button.disabled=false;}}
});
$('manualForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const form={source,company:$('company').value,address:$('address').value,codePostal:$('postal').value,
    city:$('city').value,phone:$('phone').value,website:$('website').value,sourceUrl:$('sourceUrl').value,
    draftId:pendingDraftId};
  try{const result=await message('manual-add',form);$('manualForm').reset();
    pendingDraftId=null;
    await refresh();notice(result.added?'Fiche ajoutée. Vérifiez-la dans GrowthOS avant import.':'Fiche déjà présente.');
  }catch(error){notice(error.message,true);}
});
$('clear').addEventListener('click',async()=>{
  if(!confirm('Vider toutes les fiches locales non importées ?'))return;
  try{await message('clear-captures');await refresh();notice('Sélection locale vidée.');}catch(e){notice(e.message,true);}
});
init();
