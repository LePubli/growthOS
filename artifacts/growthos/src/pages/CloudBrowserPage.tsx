import {useEffect,useRef,useState} from 'react';
import {Link,useSearch} from 'wouter';
import api from '@/lib/api-client';
import {SourceLogo} from '@/components/atlas/ProspectLogos';
import modules from '../../../../extensions/growthos-pagesjaunes/modules.json';
import '@/cloud-browser.css';

type Profile={id:string;source:string;label:string;mode:'public'|'account'};
type Job={id:string;profile_id:string;prospect_id:string|null;mode:'enrich'|'discover';query:string;status:string;error:string|null;result:{message?:string;captures?:any[];drafts?:any[];applied?:{filled:string[];conflicts:number}}};
type View={url:string;title:string;image:string;busy:boolean;width:number;height:number};
const labels:Record<string,string>={queued:'En file',running:'Recherche et collecte en cours',awaiting_user:'Intervention dans le navigateur',needs_review:'Rapprochement à vérifier',completed:'Terminé',failed:'Échec',cancelled:'Annulé'};
const sourceName=(source:string)=>modules.find(m=>m.source===source)?.name||source;
export default function CloudBrowserPage(){
  const params=new URLSearchParams(useSearch()),prospectId=params.get('prospectId');
  const [profiles,setProfiles]=useState<Profile[]>([]),[jobs,setJobs]=useState<Job[]>([]),[selected,setSelected]=useState('');
  const [status,setStatus]=useState<{ready:boolean;configured:boolean;automatic:string[]}|null>(null);
  const [limit,setLimit]=useState(10);
  const [source,setSource]=useState(params.get('source')||'societe_com'),[profileLabel,setProfileLabel]=useState(''),[mode,setMode]=useState<'public'|'account'>('public');
  const [prospect,setProspect]=useState<any>(null),[query,setQuery]=useState(params.get('query')||''),[area,setArea]=useState(params.get('area')||'');
  const [view,setView]=useState<View|null>(null),[viewing,setViewing]=useState(false),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const control=useRef(''),inputQueue=useRef(Promise.resolve()),viewProfile=useRef(''),latestSelected=useRef(selected);latestSelected.current=selected;
  const [chosen,setChosen]=useState<Record<string,boolean>>({});
  async function refresh(){const [p,j,s]=await Promise.all([api.get<Profile[]>('/browser/profiles'),api.get<Job[]>('/browser/jobs'),api.get<any>('/browser/status')]);setProfiles(p);setJobs(j);setStatus(s);}
  useEffect(()=>{void refresh().catch(e=>setError(e.message));const timer=window.setInterval(()=>{void api.get<Job[]>('/browser/jobs').then(setJobs).catch(()=>undefined);},3000);return()=>window.clearInterval(timer);},[]);
  useEffect(()=>{if(!selected){const match=profiles.find(p=>p.source===source);if(match)setSelected(match.id);}},[profiles,source,selected]);
  useEffect(()=>{if(prospectId)void api.get('/prospects/'+prospectId).then(p=>{setProspect(p);setQuery(p.siret||p.siren||p.company||'');setArea(p.city||'');}).catch(e=>setError(e.message));},[prospectId]);
  useEffect(()=>{setView(null);setViewing(false);control.current='';viewProfile.current='';},[selected]);
  useEffect(()=>{
    if(!selected||!viewing)return;
    let alive=true,pending=false;
    const read=async()=>{
      if(pending)return;pending=true;
      try{const result=await api.post<View>('/browser/profiles/'+selected+'/view',{});if(alive&&latestSelected.current===selected)setView(result);}
      catch(e){if(alive){setViewing(false);setError(e instanceof Error?e.message:'Vue indisponible.');}}
      finally{pending=false;}
    };
    void read();const timer=window.setInterval(()=>void read(),1800);
    return()=>{alive=false;window.clearInterval(timer);};
  },[selected,viewing]);
  async function perform(label:string,run:()=>Promise<void>){setBusy(label);setError('');setNotice('');try{await run();}catch(e){setError(e instanceof Error?e.message:'Opération impossible.');}finally{setBusy('');}}
  const profile=profiles.find(p=>p.id===selected),automatic=status?.automatic.includes(profile?.source||source);
  async function create(){await perform('Créer',async()=>{
    const p=await api.post<Profile>('/browser/profiles',{source,label:profileLabel.trim()||sourceName(source)+' · '+(mode==='public'?'public':'mon compte'),mode});
    setProfiles(v=>[...v,p]);setSelected(p.id);setProfileLabel('');
  });}
  async function open(login=false,keepPage=false){await perform('Ouvrir',async()=>{
    const result=await api.post<any>('/browser/profiles/'+selected+'/open',{query,area,login,keepPage},{timeoutMs:35000});
    control.current=result.controlId;viewProfile.current=selected;setViewing(true);setNotice('Session ouverte. Les connexions éventuelles restent dans ce profil ; une session ouverte ne garantit pas que le site vous a authentifié.');
  });}
  function action(event:object){
    const target=selected,lease=control.current;if(!lease||!viewing||view?.busy)return;
    inputQueue.current=inputQueue.current.then(async()=>{
      if(latestSelected.current!==target||control.current!==lease)return;
      await api.post('/browser/profiles/'+target+'/action',{event,controlId:lease});
    }).catch(e=>{setError(e.message);});
  }
  async function launch(){await perform('Collecter',async()=>{
    if(!automatic)throw new Error('Collecteur automatique indisponible pour cette source.');
    if(prospectId&&!prospect)throw new Error('Prospect cible non chargé.');
    let target=profile;
    if(!target){target=await api.post<Profile>('/browser/profiles',{source,label:profileLabel.trim()||sourceName(source)+' · '+(mode==='public'?'public':'mon compte'),mode});setProfiles(p=>[...p,target!]);setSelected(target.id);}
    const job=await api.post<Job>('/browser/jobs',{profileId:target.id,query,area,limit,...(prospectId?{prospectId}:{})});
    setJobs(j=>[job,...j]);setNotice('Recherche mise en file. Vous pouvez quitter cette page ; la tâche s’exécute sur le serveur.');
  });}
  async function importSelected(job:Job){await perform('Importer',async()=>{
    const candidates=(job.result.captures||[]).filter(c=>chosen[c.id]);
    if(!candidates.length)throw new Error('Sélectionnez au moins une fiche vérifiée.');
    const result=await api.post<any>('/sourcing/device/import-prospects',{verified:candidates,drafts:[]},{timeoutMs:60000});
    setNotice(`${result.imported||0} prospect(s) créé(s), ${result.enriched||0} enrichi(s). Les éventuels désaccords restent à vérifier dans le CRM.`);
  });}
  return <main className="cloud-browser-page p-4 sm:p-6 space-y-5 max-w-7xl mx-auto" style={{color:'var(--text-primary)'}}>
    <Link to={prospectId?'/prospects/'+prospectId:'/outils'} className="text-sm underline">← {prospectId?'Retour au prospect':'Catalogue des outils'}</Link>
    <h1 className="text-2xl font-semibold">Navigateur cloud et collecte</h1>
    <p className="text-sm" style={{color:'var(--text-muted)'}}>Recherchez depuis GrowthOS. Vos profils sont conservés sur votre serveur et restent séparés par compte et par agence.</p>
    {status&&!status.ready&&<div role="status" className="p-4 rounded-xl border bg-amber-50 text-amber-950">{status.configured?'Le navigateur cloud est actuellement indisponible.':'Ajoutez le service navigateur cloud à la stack GrowthOS pour activer ce parcours.'} <Link to={'/outils'+(prospectId?'?mode=enrich&prospectId='+prospectId:'')} className="underline">Retour aux outils et au secours Chrome</Link>.</div>}
    {error&&<p role="alert" className="p-4 rounded-xl border bg-red-50 text-red-900">{error}</p>}
    {notice&&<p role="status" className="p-4 rounded-xl border bg-teal-50 text-teal-950">{notice}</p>}
    {prospect&&<div className="border p-4 rounded-xl"><strong>Enrichissement de {prospect.company}</strong><p className="text-sm">{prospect.siret||prospect.siren||'Identité à vérifier'} · {prospect.city||''}</p><p className="text-sm mt-2">Même SIRET sur Societe.com : identité, adresse et activité confirmées peuvent être mises à jour automatiquement, avec trace dans les activités. Les autres valeurs divergentes restent proposées.</p></div>}
    <section className="border rounded-xl p-4 space-y-3" style={{background:'var(--card-bg)'}}>
      <h2 className="font-semibold">Mes profils de navigation</h2>
      <div className="flex flex-wrap gap-2">
        <label className="text-sm">Source <select className="border rounded p-2 ml-1" value={source} onChange={e=>{setSource(e.target.value);setSelected('');}}>{modules.filter(m=>m.source!=='entreprises').map(m=><option key={m.source} value={m.source}>{m.name}</option>)}</select></label>
        <label className="text-sm">Mode <select className="border rounded p-2 ml-1" value={mode} onChange={e=>setMode(e.target.value as 'public'|'account')}><option value="public">Sans compte · public</option><option value="account">Mon compte · connexion dans la source</option></select></label>
        <input aria-label="Nom du profil" className="border rounded p-2" placeholder="Nom du profil (facultatif)" maxLength={80} value={profileLabel} onChange={e=>setProfileLabel(e.target.value)}/>
        <button className="border rounded p-2" disabled={!!busy} onClick={()=>void create()}>Créer le profil</button>
      </div>
      <label className="block text-sm">Profil utilisé <select className="border rounded p-2 ml-2" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choisir un profil</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.label} · {sourceName(p.source)}</option>)}</select></label>
      {profile&&<p className="text-xs" style={{color:'var(--text-muted)'}}>Profil {profile.mode==='account'?'destiné à votre compte : connectez-vous directement sur la source.':'public : aucune connexion requise pour les pages publiques.'} Les possibilités de recherche dépendent des accès offerts par le site.</p>}
    </section>
    <section className="border rounded-xl p-4 space-y-3" style={{background:'var(--card-bg)'}}>
      <h2 className="font-semibold">Rechercher et exécuter</h2>
      <div className="flex flex-wrap gap-2"><input aria-label="Recherche" className="border rounded p-2 grow" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Entreprise, activité, SIREN ou SIRET" maxLength={160}/><input aria-label="Ville ou code postal" className="border rounded p-2" value={area} onChange={e=>setArea(e.target.value)} placeholder="Ville ou code postal" maxLength={120}/></div>
      <label className="block text-sm">Nombre maximum de fiches dans ce lot <input type="number" min={1} max={25} value={limit} className="border rounded p-2 ml-2 w-20" onChange={e=>setLimit(Math.max(1,Math.min(25,Number(e.target.value)||1)))}/></label>
      <div className="flex flex-wrap gap-2">
        <button className="border rounded-lg p-3" disabled={!selected||!!busy||!status?.ready} onClick={()=>void open()}>Ouvrir dans GrowthOS</button>
        {profile?.mode==='account'&&<button className="border rounded-lg p-3" disabled={!!busy||!status?.ready} onClick={()=>void open(true)}>Ouvrir la connexion à la source</button>}
        <button className="border rounded-lg p-3 bg-teal-700 text-white disabled:opacity-40" disabled={!automatic||!!busy||!status?.ready||query.trim().length<2||((profile?.source||source)==='societe_com'&&!prospectId)} onClick={()=>void launch()}>{busy==='Collecter'?'Mise en file…':prospectId?'Enrichir automatiquement ce prospect':'Lancer la collecte automatique'}</button>
      </div>
      {profile&&!automatic&&<p className="text-sm">Le navigateur de cette source est disponible. Son collecteur automatique reste à développer ; aucune donnée n’est présentée comme collectée automatiquement.</p>}
      {profile?.source==='societe_com'&&!prospectId&&<p className="text-sm">Pour Societe.com, ouvrez « Enrichir » depuis un prospect afin de conserver son identité et sa fiche cible.</p>}
    </section>
    {selected&&<section className="border rounded-xl p-4 space-y-3" style={{background:'var(--card-bg)'}}>
      <div className="flex justify-between gap-2 flex-wrap"><h2 className="font-semibold flex items-center gap-2"><SourceLogo source={profile?.source||source}/> Vue du navigateur · {profile?.label}</h2><div className="flex gap-2"><button className="border rounded p-2 text-sm" disabled={!!busy||!status?.ready} onClick={()=>void open(false,true)}>Afficher / reprendre le contrôle</button><button className="border rounded p-2 text-sm" onClick={()=>{setViewing(false);setView(null);}}>Masquer la vue</button><button className="border rounded p-2 text-sm" disabled={!!busy||!status?.ready} onClick={()=>{if(confirm('Déconnecter ce profil et effacer sa session conservée sur le serveur ?'))void perform('Déconnecter',async()=>{await api.post('/browser/profiles/'+selected+'/erase',{});setViewing(false);setView(null);control.current='';setNotice('Session effacée.');});}}>Déconnecter / effacer la session</button></div></div>
      {view&&<><p className="text-xs break-all">Source réelle : {view.url} {view.busy?'· Lecture automatique en cours':''}</p>
        <p className="text-xs" style={{color:'var(--text-muted)'}}>Cliquez dans la page puis utilisez le clavier. Alt + Échap libère le focus ; Tab et Entrée sont transmis à la page.</p>
        <div tabIndex={0} aria-label="Navigateur distant interactif" className="border rounded overflow-hidden focus:outline-teal-600" onKeyDown={e=>{
          if(e.altKey&&e.key==='Escape'){e.currentTarget.blur();return;}if(e.key==='Shift'||e.key==='Control'||e.key==='Alt'||e.key==='Meta')return;
          const key=e.ctrlKey&&e.key.toLowerCase()==='a'?'Control+A':e.key;
          if(['Enter','Tab','Backspace','Delete','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Escape','Home','End','Control+A'].includes(key)){e.preventDefault();action({type:'key',key});}
          else if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();action({type:'text',text:e.key});}
        }} onPaste={e=>{e.preventDefault();action({type:'text',text:e.clipboardData.getData('text').slice(0,2000)});}} onWheel={e=>{action({type:'scroll',deltaY:Math.max(-1500,Math.min(1500,e.deltaY))});}}>
          <img src={view.image} alt={view.title||'Page de la source'} draggable={false} className="block w-full h-auto" onClick={e=>{e.currentTarget.parentElement?.focus();const box=e.currentTarget.getBoundingClientRect();action({type:'click',x:Math.min(1279,Math.floor((e.clientX-box.left)/box.width*1280)),y:Math.min(799,Math.floor((e.clientY-box.top)/box.height*800))});}}/>
        </div><button className="border rounded p-2 text-sm" onClick={()=>action({type:'back'})}>Page précédente</button></>}
      {!view&&<p className="text-sm" style={{color:'var(--text-muted)'}}>La vue s’affiche à l’ouverture d’une recherche ou avec « Afficher ».</p>}
    </section>}
    <section className="space-y-3"><h2 className="font-semibold">Tâches récentes</h2>
      {!jobs.length&&<p className="text-sm">Aucune tâche cloud lancée.</p>}
      {jobs.map(job=><article key={job.id} className="border rounded-xl p-4 space-y-2" style={{background:'var(--card-bg)'}}>
        <div className="flex gap-3 flex-wrap justify-between"><strong>{job.query}</strong><span>{labels[job.status]||job.status}</span></div>
        {(job.error||job.result.message)&&<p className="text-sm">{job.error||job.result.message}</p>}
        {job.result.applied&&<p className="text-sm">{job.result.applied.filled.length} champ(s) mis à jour, {job.result.applied.conflicts} désaccord(s) à vérifier.</p>}
        {job.prospect_id&&<Link className="underline text-teal-700" to={'/prospects/'+job.prospect_id}>Voir le prospect et son historique</Link>}
        <div className="flex flex-wrap gap-2">
          <button className="border rounded p-2 text-sm" onClick={()=>{setSelected(job.profile_id);setNotice('Profil sélectionné. Utilisez « Afficher / reprendre le contrôle » pour consulter la page sans relancer la recherche.');}}>Voir son profil de navigation</button>
          {['awaiting_user','needs_review','failed'].includes(job.status)&&<button className="border rounded p-2 text-sm" disabled={!!busy} onClick={()=>void perform('Reprendre',async()=>{await api.post('/browser/jobs/'+job.id+'/retry',{resume:true});await refresh();})}>Reprendre depuis la page ouverte</button>}
          {['queued','running','awaiting_user','needs_review','failed'].includes(job.status)&&<button className="border rounded p-2 text-sm" disabled={!!busy} onClick={()=>void perform('Annuler',async()=>{await api.post('/browser/jobs/'+job.id+'/cancel',{});await refresh();})}>Annuler</button>}
        </div>
        {job.mode==='discover'&&!!job.result.captures?.length&&<div className="space-y-2">
          {job.result.captures.map(c=><label key={c.id} className="block text-sm border rounded p-2"><input type="checkbox" checked={!!chosen[c.id]} onChange={e=>setChosen(v=>({...v,[c.id]:e.target.checked}))}/> <strong>{c.company}</strong> · {[c.address,c.city,c.phone].filter(Boolean).join(' · ')}</label>)}
          <button className="border rounded p-2" disabled={!!busy} onClick={()=>void importSelected(job)}>Importer les fiches sélectionnées</button>
        </div>}
        {!!job.result.drafts?.length&&<p className="text-sm">{job.result.drafts.length} fiche(s) partielle(s) conservée(s) dans cette tâche. Elles ne sont pas importées sans vérification.</p>}
      </article>)}
    </section>
    <p className="text-sm"><Link to={'/outils'+(prospectId?'?mode=enrich&prospectId='+prospectId:'')} className="underline">Catalogue et secours externe Chrome</Link></p>
  </main>;
}
