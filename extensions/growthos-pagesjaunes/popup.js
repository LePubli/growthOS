/* Aucune connexion directe au serveur GrowthOS ; toutes les fiches restent dans Chrome. */
const $ = id => document.getElementById(id);
const labels = {google_maps:'Maps',google_search:'Google',bing:'Bing',linkedin:'LinkedIn',societe_com:'Societe.com',facebook:'Facebook Pages',instagram:'Instagram professionnel',tiktok:'TikTok professionnel',pagesjaunes:'PagesJaunes'};
const manualSources = new Set(['linkedin','societe_com','facebook','instagram','tiktok']);
let source='google_maps';
let currentUrl='';
let pendingDraftId=null;
let context=null;
let modules=[];
let phase='search';
let filterMode='all';
let expandedResults=false;
let lastQueue=[];
let lastDrafts=[];
let selectedIds=new Set();
let initializedSelection=false;
let latestMapStatus={status:'idle'};
const crmImportUrl='https://agile.le-publicitaire.fr/prospects/connecteur';
function setPhase(next){
  phase=next;
  document.body.className='phase-'+next;
  $('searchView').hidden=next!=='search';
  $('collectionView').hidden=next!=='collect';
  $('searchFooter').hidden=next!=='search';
  $('collectFooter').hidden=next!=='collect';
  if(next==='collect')$('manualPanel').hidden=source==='pagesjaunes';
  if(next==='task')$('manualPanel').hidden=false;
  document.querySelectorAll('[data-step]').forEach(el=>{
    const order=['source','search','collect','import'];
    const active=next==='search'?'search':'collect';
    el.classList.toggle('is-complete',order.indexOf(el.dataset.step)<order.indexOf(active));
    el.classList.toggle('is-active',el.dataset.step===active);
  });
}
function sourceMark(type){
  const marks={google_maps:['maps','●'],google_search:['google','G'],bing:['bing','b'],pagesjaunes:['pj','J'],societe_com:['societe','S'],linkedin:['linkedin','in'],facebook:['facebook','f'],instagram:['instagram','◎'],tiktok:['tiktok','♪']};
  const [css,label]=marks[type]||['maps','●'];
  const span=document.createElement('span');span.className='source-mark '+css;span.textContent=label;return span;
}
function importable(item){
  const draft=item.incomplete===true||String(item.id||'').startsWith('draft_');
  return !draft||Boolean(item.phone||item.website||item.address);
}
function updateImportLink(){
  const available=[...lastQueue,...lastDrafts].filter(item=>importable(item)&&selectedIds.has(item.id));
  $('selectedCount').textContent=String(available.length);
  const link=$('importAction');
  const url=new URL(crmImportUrl);
  // La page GrowthOS confirme l'import. Ce paramètre ne contient que des IDs locaux,
  // jamais des coordonnées ou identifiants légaux des entreprises.
  // Le fragment reste dans Chrome (il n'est pas envoyé au serveur ni aux logs HTTP).
  // Il évite aussi de dépasser la taille maximale des URLs côté proxy pour les lots.
  url.hash='selected='+encodeURIComponent(available.map(item=>item.id).join(','));
  link.href=url.toString();link.classList.toggle('is-disabled',!available.length);
  link.setAttribute('aria-disabled',String(!available.length));
}
function renderResults(){
  const all=[...lastQueue.map(item=>({...item,incomplete:false})),...lastDrafts.map(item=>({...item,incomplete:true}))];
  const visible=(filterMode==='review'?all.filter(item=>item.incomplete):all).slice().reverse();
  const list=expandedResults?visible:visible.slice(0,8);
  $('filterAllCount').textContent=String(all.length);
  $('filterReviewCount').textContent=String(lastDrafts.length);
  $('filterAll').setAttribute('aria-pressed',String(filterMode==='all'));
  $('filterReview').setAttribute('aria-pressed',String(filterMode==='review'));
  const eligible=visible.filter(importable);
  $('selectAll').checked=Boolean(eligible.length)&&eligible.every(item=>selectedIds.has(item.id));
  $('selectAll').indeterminate=eligible.some(item=>selectedIds.has(item.id))&&!$('selectAll').checked;
  const box=$('queue');box.replaceChildren();
  if(!all.length){const p=document.createElement('p');p.className='empty';p.textContent='Aucune fiche capturée pour le moment.';box.append(p);}
  else if(!visible.length){const p=document.createElement('p');p.className='empty';p.textContent='Aucune fiche à vérifier.';box.append(p);}
  for(const item of list){
    const row=document.createElement('div');row.className='result-row';row.setAttribute('role','listitem');
    const check=document.createElement('input');check.type='checkbox';check.checked=selectedIds.has(item.id);
    check.disabled=!importable(item);check.setAttribute('aria-label','Sélectionner '+item.company);
    check.addEventListener('change',()=>{
      if(check.checked)selectedIds.add(item.id);else selectedIds.delete(item.id);
      renderResults();updateImportLink();
    });
    const info=document.createElement('div');info.className='result-copy';
    const name=document.createElement('strong');name.textContent=item.company;
    const details=document.createElement('small');
    details.textContent=[item.address||item.city||'Adresse non relevée',item.codePostal||'',item.phone||'',labels[item.source]||item.source].filter(Boolean).join(' · ');
    info.append(name,details);
    const badge=document.createElement('span');badge.className='result-tag'+(item.incomplete?' review':'');
    badge.textContent=item.incomplete?'! À vérifier':'✓ Complète';
    const remove=document.createElement('button');remove.className='remove';remove.textContent='×';remove.type='button';
    remove.title='Retirer cette fiche';
    remove.addEventListener('click',async()=>{
      try{await message(item.incomplete?'remove-draft':'remove-capture',{id:item.id});selectedIds.delete(item.id);await refresh();}
      catch(error){notice(error.message,true);}
    });
    row.append(check,sourceMark(item.source),info,badge,remove);box.append(row);
  }
  const more=$('resultCountHint');more.hidden=visible.length<=8;
  more.textContent=expandedResults?'Réduire la liste':`Voir les ${visible.length-8} autres fiches ↓`;
  more.setAttribute('role','button');more.tabIndex=more.hidden?-1:0;
  updateImportLink();
}
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
    if(['societe.com','www.societe.com'].includes(host))return 'societe_com';
    if(['facebook.com','www.facebook.com'].includes(host))return 'facebook';
    if(['tiktok.com','www.tiktok.com'].includes(host))return 'tiktok';
    if(['instagram.com','www.instagram.com'].includes(host))return 'instagram';
    if(/(^|\.)linkedin\.com$/.test(host))return 'linkedin';
    if(/(^|\.)pagesjaunes\.fr$/.test(host))return 'pagesjaunes';
  }catch{}
  return null;
}
function selectSource(value){
  source=value;
  pendingDraftId=null;
  for(const btn of document.querySelectorAll('[data-source]'))btn.setAttribute('aria-pressed',String(btn.dataset.source===value));
  $('activeSource').textContent=labels[value]||value;
  $('collectionSource').textContent=labels[value]||value;
  $('collectionMark').replaceWith(Object.assign(sourceMark(value),{id:'collectionMark'}));
  const chosen=document.querySelector(`[data-source="${value}"]`);
  if(chosen && [...chosen.parentElement.children].indexOf(chosen)>4){
    $('sourcePicker').classList.add('is-expanded');$('sourceMore').setAttribute('aria-expanded','true');
    $('sourceMore').firstChild.textContent='Réduire la liste ';
  }
  const isManual=manualSources.has(value),isPagesjaunes=value==='pagesjaunes';
  $('legalIdentity').hidden=value!=='societe_com';
  $('siret').disabled=value!=='societe_com';
  $('siret').value='';
  $('capture').disabled=(isManual && value!=='societe_com')||isPagesjaunes;
  $('capture').textContent=value==='societe_com'?'Capturer la fiche Societe.com':'⤓ Capturer les fiches';
  $('autoMaps').disabled=!['google_maps','google_search'].includes(sourceFromUrl(currentUrl));
  $('manualPanel').hidden=isPagesjaunes;
  $('sourceHint').textContent=value==='societe_com'
    ? 'Ouvrez une fiche société, puis capturez les informations affichées. GrowthOS vous permettra de les comparer à un prospect existant avant enrichissement.'
    : isManual
    ? 'Ouvrez la page professionnelle de l’entreprise. Confirmez son identité et renseignez les coordonnées affichées avant de valider la fiche.'
    : isPagesjaunes ? 'PagesJaunes est collecté automatiquement depuis le formulaire GrowthOS. Vous pouvez aussi ouvrir les résultats ici.'
    : 'Ouvrez les résultats puis cliquez sur Capturer. Sur une liste Maps, les fiches détaillées seront ouvertes successivement.';
  $('manualPanel').open=isManual;
  $('sourceUrl').value=sourceFromUrl(currentUrl)===value?currentUrl:'';
  const module=modules.find(m=>m.source===value);
  if(module)$('sourceHint').textContent=module.hint;
}
function renderContext(task){
  context=task;
  if(!task)return;
  selectSource(task.source);
  $('query').value=task.query;$('area').value=task.area;
  if(task.mode!=='enrich'){
    $('sourceHint').textContent=(modules.find(m=>m.source===task.source)?.hint||'')+' Mode : nouveaux prospects.';
    return;
  }
  setPhase('task');
  const module=modules.find(m=>m.source===task.source);
  $('taskPanel').hidden=false;$('sourcePicker').hidden=true;
  $('taskTitle').textContent=(module?.name||labels[task.source])+' · Enrichir';
  $('taskTarget').textContent='Prospect : '+task.prospect.company;
  $('taskHint').textContent=module?.hint||'';
  $('bulkControls').hidden=true;$('selectionHead').closest('section').hidden=true;
  $('collectTitle').textContent='Données de la fiche affichée';
  $('taskRead').hidden=module?.kind!=='reader';
  $('manualPanel').hidden=false;$('manualPanel').open=module?.kind==='assisted';
  $('manualSubmit').textContent='Confirmer ces données et revenir au prospect';
  $('address').required=false;$('postal').required=false;
  document.querySelector('label[for=address]').textContent='Adresse affichée (facultatif)';
  document.querySelector('label[for=postal]').textContent='Code postal (facultatif)';
  $('taskFinish').disabled=!task.preview?.length;
  $('growthos').href='https://agile.le-publicitaire.fr/prospects/'+task.prospect.id;
  if(task.status==='pending'){
    $('taskHint').textContent='Capture confirmée, en attente d’enregistrement dans GrowthOS. Revenez sur le prospect ; les données restent conservées jusqu’au succès.';
    $('taskFinish').disabled=false;$('taskFinish').textContent='Revenir au prospect pour terminer';
    $('taskRead').hidden=true;$('manualPanel').hidden=true;$('taskCancel').textContent='Abandonner cette capture';
  }
  const box=$('taskPreview');box.replaceChildren();
  for(const [index,capture] of (task.preview||[]).entries()){
    const label=document.createElement('label'),radio=document.createElement('input');
    radio.type='radio';radio.name='taskCandidate';radio.value=String(index);radio.checked=index===0;
    const title=document.createElement('strong');title.textContent=capture.company;
    const details=document.createElement('small');
    details.textContent=[capture.address,capture.city,capture.phone,capture.email,capture.website,capture.siret,capture.sourceUrl].filter(Boolean).join(' · ');
    label.append(radio,title,details);box.append(label);
  }
}
async function refresh(){
  const [data,draftData,mapRun]=await Promise.all([message('list-captures'),message('list-drafts'),message('auto-capture-status')]);
  const progress=$('mapProgress'),status=mapRun.status||{};
  latestMapStatus=status;
  progress.hidden=false;
  const running=status.status==='running',paused=status.status==='paused';
  progress.textContent=running
    ? `Lecture Maps en cours · ${status.checked||0}/${status.total||'?'} fiches examinées · ${status.added||0} ajoutée(s).`
    : paused ? `Lecture en pause après ${status.checked||0} fiche(s). Relancez le lot pour poursuivre.`
    : status.status==='idle'||!status.status ? 'Prêt à capturer les fiches de la page affichée.'
    : `Dernière lecture Maps · ${status.checked||0}/${status.total||0} fiches · ${status.added||0} ajoutée(s)`+
      (status.errors?.length?` · ${status.errors[0]}`:'')+'.';
  $('progressFill').style.width=status.total?Math.min(100,Math.max(0,(status.checked||0)/status.total*100))+'%':'0%';
  $('pauseMaps').hidden=!running;
  $('autoMaps').textContent=paused?'Reprendre la lecture Maps':'Lancer la collecte Maps par activité';
  const queue=data.results||[];
  const drafts=draftData.drafts||[];
  lastQueue=queue;lastDrafts=drafts;
  if(!initializedSelection){selectedIds=new Set([...queue,...drafts].filter(importable).map(item=>item.id));initializedSelection=true;}
  const allowed=new Set([...queue,...drafts].map(item=>item.id));
  for(const id of selectedIds)if(!allowed.has(id))selectedIds.delete(id);
  $('capturedCount').textContent=String(queue.length+drafts.length);
  $('completeCount').textContent=String(queue.length);
  $('reviewCount').textContent=String(drafts.length);
  $('searchCount').textContent=String(queue.length+drafts.length);
  $('collectionQuery').textContent=[$('query').value.trim(),$('area').value.trim()].filter(Boolean).join(' · ')||'Captures en attente';
  $('autoEnrich').disabled=!drafts.length;
  $('draftCount').textContent=String(drafts.length);
  const draftsBox=$('drafts');draftsBox.replaceChildren();
  if(!drafts.length){const p=document.createElement('p');p.className='empty';p.textContent='Aucune fiche à compléter';draftsBox.append(p);}
  for(const draft of [...drafts].reverse()){
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
    const openMaps=document.createElement('button');openMaps.textContent='Maps';
    openMaps.title='Rechercher cette entreprise dans Google Maps pour ouvrir sa fiche détaillée';
    openMaps.addEventListener('click',async()=>{
      const location=$('area').value.trim();
      const url='https://www.google.com/maps/search/'+encodeURIComponent([draft.company,location].filter(Boolean).join(' '));
      try{await chrome.tabs.create({url,active:true});window.close();}
      catch(error){notice('Impossible d’ouvrir Google Maps : '+String(error?.message||error),true);}
    });
    const remove=document.createElement('button');remove.className='remove';remove.textContent='✕';remove.title='Ignorer ce brouillon';
    remove.addEventListener('click',async()=>{
      try{await message('remove-draft',{id:draft.id});await refresh();}catch(e){notice(e.message,true);}
    });
    row.append(info,openMaps,complete,remove);draftsBox.append(row);
  }
  renderResults();
}
async function init(){
  try{
    $('extensionIdentity').textContent='v'+chrome.runtime.getManifest().version+' · '+chrome.runtime.id.slice(-8);
    const tabs=await chrome.tabs.query({active:true,currentWindow:true});
    currentUrl=tabs[0]?.url||'';
    const current=sourceFromUrl(currentUrl);
    $('currentTab').textContent=current?'· '+labels[current]:'· Ouvrez un moteur de recherche';
    selectSource(current||source);
    const saved=await chrome.storage.local.get('growthos_popup_prefs');
    $('query').value=saved.growthos_popup_prefs?.query||'';
    $('area').value=saved.growthos_popup_prefs?.area||'';
    modules=await fetch(chrome.runtime.getURL('modules.json')).then(r=>r.json());
    const taskState=await message('task-current');
    renderContext(taskState.task);
    if(context?.mode!=='enrich'){
      await refresh();
      setPhase(lastQueue.length||lastDrafts.length||latestMapStatus.status==='running'||latestMapStatus.status==='paused'?'collect':'search');
    }
  }catch(e){notice(e.message,true);}
}
for(const btn of document.querySelectorAll('[data-source]'))btn.addEventListener('click',()=>selectSource(btn.dataset.source));
$('sourceMore').addEventListener('click',()=>{
  const expanded=$('sourcePicker').classList.toggle('is-expanded');
  $('sourceMore').setAttribute('aria-expanded',String(expanded));
  $('sourceMore').firstChild.textContent=expanded?'Réduire la liste ':'Voir les 9 sources ';
});
for(const id of ['openCollection','footerResults'])$(id).addEventListener('click',()=>setPhase('collect'));
$('editSearch').addEventListener('click',()=>setPhase('search'));
for(const [id,filter] of [['filterAll','all'],['filterReview','review']])$(id).addEventListener('click',()=>{
  filterMode=filter;expandedResults=false;renderResults();
});
$('selectAll').addEventListener('change',event=>{
  const items=filterMode==='review'?lastDrafts:[...lastQueue,...lastDrafts];
  for(const item of items.filter(importable)){
    if(event.target.checked)selectedIds.add(item.id);else selectedIds.delete(item.id);
  }
  renderResults();
});
function toggleExpandedResults(){expandedResults=!expandedResults;renderResults();}
$('resultCountHint').addEventListener('click',toggleExpandedResults);
$('resultCountHint').addEventListener('keydown',event=>{
  if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleExpandedResults();}
});
$('importAction').addEventListener('click',event=>{
  if($('importAction').getAttribute('aria-disabled')==='true')event.preventDefault();
});
$('pauseMaps').addEventListener('click',async()=>{
  try{await message('pause-maps-progress');notice('Pause demandée. La fiche Maps en cours se termine avant l’arrêt.');}
  catch(error){notice(error.message,true);}
});
$('open').addEventListener('click',async()=>{
  const query=$('query').value.trim(),area=$('area').value.trim();
  try{await chrome.storage.local.set({growthos_popup_prefs:{query,area}});
    await message('open-source',{source,query,area});window.close();
  }catch(e){notice(e.message,true);}
});
$('capture').addEventListener('click',async()=>{
  setPhase('collect');
  $('capture').disabled=true;
  try{const r=await message('capture-tab',{query:$('query').value.trim(),area:$('area').value.trim()});await refresh();
    notice(r.checked!==undefined ? `${r.checked} fiche(s) Maps examinée(s) · ${r.added} ajoutée(s).` : (r.added||r.draftAdded)
      ? `${r.added||0} fiche(s) prêtes · ${r.draftAdded||0} fiche(s) à compléter ci-dessous · ${(r.ignored||0)+(r.draftIgnored||0)} doublon(s)`
      : r.warning||'Aucune nouvelle fiche');
  }catch(e){notice(e.message,true);}
  finally{$('capture').disabled=(manualSources.has(source)&&source!=='societe_com')||source==='pagesjaunes';}
});
$('autoMaps').addEventListener('click',async()=>{
  setPhase('collect');
  const query=$('query').value.trim(),area=$('area').value.trim();
  if(query.length<3||!area){notice('Renseignez une activité et une zone géographique avant la lecture Maps.',true);return;}
  const button=$('autoMaps');button.disabled=true;
  try{
    await chrome.storage.local.set({growthos_popup_prefs:{query,area}});
    notice('La lecture Maps a démarré. L’onglet Google va naviguer entre les fiches. Rouvrez ensuite l’extension pour voir le bilan.');
    const result=await message('auto-capture-maps',{query,area});
    await refresh();
    notice(`${result.checked} fiche(s) Maps examinée(s) · ${result.added} adresse(s) complète(s) ajoutée(s).${result.status==='paused'?' Lecture en pause.':''}`);
  }catch(error){notice(error.message,true);}
  finally{button.disabled=!['google_maps','google_search'].includes(sourceFromUrl(currentUrl));}
});
$('resetMaps').addEventListener('click',async()=>{
  if(!confirm('Recommencer la lecture des fiches Maps depuis le début ? Les captures déjà enregistrées sont conservées.'))return;
  try{await message('reset-maps-progress');notice('Parcours Maps réinitialisé ; les captures existantes restent conservées.');}
  catch(error){notice(error.message,true);}
});
$('autoEnrich').addEventListener('click',async()=>{
  const button=$('autoEnrich');button.disabled=true;
  button.textContent='Enrichissement en cours…';
  try{
    const result=await message('enrich-local-drafts',{area:$('area').value.trim()});
    await refresh();
    const panel=$('diagnosticPanel'),diagnostics=$('diagnostics');
    diagnostics.replaceChildren();
    for(const item of result.details||[]){
      const p=document.createElement('p');
      const strong=document.createElement('strong');strong.textContent=item.company+' : ';
      p.append(strong,document.createTextNode(item.reason));diagnostics.append(p);
    }
    panel.hidden=!(result.details||[]).length;
    panel.open=Boolean(result.details?.length);
    const explanation=result.errors?.length?' · Annuaire indisponible pour '+result.errors.length+' fiche(s) : '+result.errors[0]:'';
    notice(`${result.checked} fiche(s) examinée(s) · ${result.added} enrichie(s) (${result.fromGeocoder||0} adresse(s) BAN, ${result.fromDirectory||0} entreprise(s) officielles) · ${result.already} déjà présentes · ${result.pending} à vérifier`+
      (result.skipped?` · ${result.skipped} à examiner au prochain clic`:'')+explanation,
    Boolean(result.errors?.length && !result.added));
  }catch(error){notice(error.message,true);}
  finally{button.textContent='✦ Vérifier les adresses (BAN + annuaire officiel)';
    try{button.disabled=!(await message('list-drafts')).drafts?.length;}catch{button.disabled=false;}}
});
$('manualForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const form={source,company:$('company').value,address:$('address').value,codePostal:$('postal').value,
    city:$('city').value,phone:$('phone').value,email:$('email').value,website:$('website').value,sourceUrl:$('sourceUrl').value,
    siret:source==='societe_com'?$('siret').value.trim():undefined,draftId:pendingDraftId};
  try{
    if(context?.mode==='enrich'){
      await message('task-complete',{taskId:context.id,capture:form,confirmed:$('taskConfirmed').checked});window.close();return;
    }
    const result=await message('manual-add',form);$('manualForm').reset();
    pendingDraftId=null;
    await refresh();notice(result.added?'Fiche ajoutée. Vérifiez-la dans GrowthOS avant import.':'Fiche déjà présente.');
  }catch(error){notice(error.message,true);}
});
$('taskRead').addEventListener('click',async()=>{
  $('taskRead').disabled=true;
  try{const result=await message('task-preview',{taskId:context.id});renderContext(result.task);notice('Vérifiez les données, puis confirmez le bon établissement.');}
  catch(error){notice(error.message,true);}
  finally{$('taskRead').disabled=false;}
});
$('taskFinish').addEventListener('click',async()=>{
  const selected=document.querySelector('input[name=taskCandidate]:checked');
  $('taskFinish').disabled=true;
  try{await message('task-complete',{taskId:context.id,index:Number(selected?.value||0),confirmed:$('taskConfirmed').checked});window.close();}
  catch(error){notice(error.message,true);$('taskFinish').disabled=false;}
});
$('taskCancel').addEventListener('click',async()=>{
  if(context.status==='pending' && !confirm('Abandonner la copie locale de cette capture ? Si elle n’a pas été enregistrée dans GrowthOS, ces données seront perdues. Les données déjà enregistrées dans le CRM restent conservées.'))return;
  try{await message('task-cancel',{taskId:context.id,discardConfirmed:context.status==='pending'});window.location.reload();}catch(error){notice(error.message,true);}
});
$('clear').addEventListener('click',async()=>{
  if(!confirm('Vider toutes les fiches locales non importées ?'))return;
  try{await message('clear-captures');await refresh();notice('Sélection locale vidée.');}catch(e){notice(e.message,true);}
});
init();
// Une collecte Maps peut continuer quand le popup est rouvert : garder les chiffres et
// la liste synchronisés sans modifier la sélection que l'utilisateur a déjà choisie.
setInterval(()=>{
  if(phase==='collect'&&!document.hidden)refresh().catch(()=>{});
},2800);
