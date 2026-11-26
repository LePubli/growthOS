/* Aucune connexion directe au serveur GrowthOS ; toutes les fiches restent dans Chrome. */
const $ = id => document.getElementById(id);
const labels = {google_maps:'Maps',google_search:'Google',bing:'Bing',linkedin:'LinkedIn',societe_com:'Societe.com',facebook:'Facebook Pages',instagram:'Instagram professionnel',tiktok:'TikTok professionnel',pagesjaunes:'PagesJaunes'};
const manualSources = new Set(['linkedin','societe_com','facebook','instagram','tiktok']);
let source='google_maps';
let currentUrl='';
let pendingDraftId=null;
let context=null;
let modules=[];
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
  progress.hidden=status.status==='idle'||!status.status;
  progress.textContent=status.status==='running'
    ? `Lecture Maps en cours : ${status.checked||0}/${status.total||'?'} fiche(s), ${status.added||0} ajoutée(s).`
    : `Dernière lecture Maps : ${status.checked||0}/${status.total||0} fiche(s), ${status.added||0} ajoutée(s)`+
      (status.errors?.length?` · ${status.errors.length} fiche(s) sans adresse complète ou erreur : ${status.errors[0]}`:'')+'.';
  const queue=data.results||[]; $('total').textContent=String(queue.length);
  const drafts=draftData.drafts||[];
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
  const box=$('queue');box.replaceChildren();
  if(!queue.length){const p=document.createElement('p');p.className='empty';p.textContent='Aucune fiche capturée';box.append(p);return;}
  for(const item of [...queue].reverse()){
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
    if(context?.mode!=='enrich')await refresh();
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
  try{const r=await message('capture-tab',{query:$('query').value.trim(),area:$('area').value.trim()});await refresh();
    notice(r.checked!==undefined ? `${r.checked} fiche(s) Maps examinée(s) · ${r.added} ajoutée(s).` : (r.added||r.draftAdded)
      ? `${r.added||0} fiche(s) prêtes · ${r.draftAdded||0} fiche(s) à compléter ci-dessous · ${(r.ignored||0)+(r.draftIgnored||0)} doublon(s)`
      : r.warning||'Aucune nouvelle fiche');
  }catch(e){notice(e.message,true);}
  finally{$('capture').disabled=(manualSources.has(source)&&source!=='societe_com')||source==='pagesjaunes';}
});
$('autoMaps').addEventListener('click',async()=>{
  const query=$('query').value.trim(),area=$('area').value.trim();
  if(query.length<3||!area){notice('Renseignez une activité et une zone géographique avant la lecture Maps.',true);return;}
  const button=$('autoMaps');button.disabled=true;
  try{
    await chrome.storage.local.set({growthos_popup_prefs:{query,area}});
    notice('La lecture Maps a démarré. L’onglet Google va naviguer entre les fiches. Rouvrez ensuite l’extension pour voir le bilan.');
    const result=await message('auto-capture-maps',{query,area});
    await refresh();
    notice(`${result.checked} fiche(s) Maps examinée(s) · ${result.added} adresse(s) complète(s) ajoutée(s).`);
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
