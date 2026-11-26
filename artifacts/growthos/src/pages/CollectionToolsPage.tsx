import {useEffect,useState} from 'react';
import {Link,useSearch} from 'wouter';
import {ArrowLeft,ExternalLink,Search,Building2} from 'lucide-react';
import apiClient from '@/lib/api-client';
import {beginConnectorTask} from '@/lib/pagesjaunes-device';
import modules from '../../../../extensions/growthos-pagesjaunes/modules.json';

export default function CollectionToolsPage(){
  const search=useSearch(),params=new URLSearchParams(search);
  const prospectId=params.get('prospectId');
  const [mode,setMode]=useState<'discover'|'enrich'>(params.get('mode')==='enrich'?'enrich':'discover');
  const [prospect,setProspect]=useState<any>(null);
  const [query,setQuery]=useState(''),[area,setArea]=useState('');
  const [busy,setBusy]=useState<string|null>(null),[notice,setNotice]=useState(''),[error,setError]=useState('');
  const [filter,setFilter]=useState('');
  useEffect(()=>{
    let alive=true;setProspect(null);
    if(prospectId)apiClient.get('/prospects/'+prospectId).then(p=>{
      if(alive){setProspect(p);setQuery(p.company||'');setArea(p.city||'');}
    }).catch(e=>{if(alive)setError(e.message);});
    return()=>{alive=false;};
  },[prospectId]);
  async function launch(source:string){
    setBusy(source);setError('');setNotice('');
    try{
      if(mode==='enrich' && !prospect)throw new Error('Ouvrez une fiche prospect puis cliquez sur Enrichir.');
      const term=source==='societe_com' && prospect && query.trim()===prospect.company
        ? prospect.siret||prospect.siren||query : query;
      await beginConnectorTask({source,mode,query:term.trim(),area:area.trim(),
        ...(mode==='enrich'?{prospect:{id:prospect.id,company:prospect.company}}:{})});
      setNotice(mode==='enrich'
        ? 'Recherche ouverte. Choisissez la bonne fiche, ouvrez l’extension GrowthOS, puis confirmez ses données. Vous reviendrez directement sur ce prospect.'
        : 'Recherche ouverte. Utilisez l’extension pour collecter les fiches, puis vérifiez votre sélection avant import.');
    }catch(e){setError(e instanceof Error?e.message:'Ouverture impossible.');}
    finally{setBusy(null);}
  }
  return <main className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">
    <Link to={prospectId?'/prospects/'+prospectId:'/prospects'} className="inline-flex items-center gap-2 text-sm"><ArrowLeft size={16}/> {prospectId?'Retour au prospect':'Prospects'}</Link>
    <div><h1 className="text-2xl font-semibold">Collecte et enrichissement</h1>
      <p className="mt-2 text-sm" style={{color:'var(--text-muted)'}}>Choisissez une fonction et une source. Le navigateur cloud exécute les collecteurs disponibles dans GrowthOS ; Chrome reste un secours externe.</p></div>
    <Link to={'/navigateur'+(prospectId?'?prospectId='+prospectId:'')} className="inline-block border rounded-xl px-4 py-3">Mes profils et navigateur cloud</Link>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Fonction">
      <button className="px-4 py-3 rounded-xl border" style={{background:mode==='discover'?'#e4f9f5':'var(--card-bg)'}} aria-pressed={mode==='discover'} onClick={()=>setMode('discover')}>Rechercher de nouveaux prospects</button>
      <button className="px-4 py-3 rounded-xl border" style={{background:mode==='enrich'?'#e4f9f5':'var(--card-bg)'}} aria-pressed={mode==='enrich'} onClick={()=>setMode('enrich')}>Compléter un prospect</button>
    </div>
    {mode==='enrich' && <div className="p-4 rounded-xl border border-teal-200 bg-teal-50 text-teal-950">
      {prospect?<><strong>{prospect.company}</strong><p className="text-sm mt-1">{[prospect.city,prospect.siret||prospect.siren].filter(Boolean).join(' · ')}</p>
        <p className="text-sm mt-2">Les champs vides seront complétés. Les désaccords resteront à arbitrer sur cette fiche.</p></>
        :<p>Pour cibler une fiche, <Link to="/prospects" className="underline">ouvrez un prospect</Link> puis cliquez sur « Enrichir ».</p>}
    </div>}
    <div className="grid sm:grid-cols-2 gap-4 p-4 border rounded-xl" style={{background:'var(--card-bg)'}}>
      <label className="text-sm">{mode==='enrich'?'Entreprise ou dirigeant recherché':'Activité ou entreprise'}
        <input className="block w-full border rounded-lg p-3 mt-2" value={query} onChange={e=>setQuery(e.target.value)} maxLength={120} placeholder={mode==='enrich'?'Nom de l’entreprise':'Ex. plombier'}/></label>
      <label className="text-sm">Ville ou code postal
        <input className="block w-full border rounded-lg p-3 mt-2" value={area} onChange={e=>setArea(e.target.value)} maxLength={100} placeholder="Ex. Roubaix"/></label>
    </div>
    {error && <p role="alert" className="p-4 bg-red-50 text-red-900 rounded-xl">{error} Le secours externe nécessite l’extension GrowthOS 0.11 ou ultérieure.</p>}
    {notice && <p role="status" className="p-4 bg-teal-50 text-teal-950 rounded-xl">{notice}</p>}
    <label className="flex items-center gap-2 text-sm"><Search size={16}/><input className="border rounded-lg p-2 w-full sm:max-w-sm" placeholder="Filtrer les outils" value={filter} onChange={e=>setFilter(e.target.value)}/></label>
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      {modules.filter(m=>m.modes.includes(mode) && (m.name+' '+m.description).toLocaleLowerCase('fr').includes(filter.toLocaleLowerCase('fr'))).map(m=><article key={m.source} className="p-5 rounded-2xl border flex flex-col gap-3" style={{background:'var(--card-bg)'}}>
        <div className="flex items-center gap-2"><Building2 size={20}/><h2 className="font-semibold">{m.name}</h2></div>
        <span className="text-xs font-medium text-teal-700">{m.kind==='official'?'Données officielles':['societe_com','google_maps','google_search','bing'].includes(m.source)?'Collecteur cloud · données visibles':m.kind==='assisted'?'Navigateur cloud · collecteur en préparation':'Lecture de la fiche visible'}</span>
        <p className="text-sm">{m.description}</p><p className="text-xs grow" style={{color:'var(--text-muted)'}}>{m.hint}</p>
        {m.source==='entreprises' || (m.source==='pagesjaunes' && mode==='discover')
          ? <Link className="border rounded-lg p-3 text-sm text-center" to={'/sourcing?source='+m.source+'&query='+encodeURIComponent(query)+'&area='+encodeURIComponent(area)}>Configurer la recherche <ExternalLink className="inline ml-1" size={14}/></Link>
          : <><Link className="border border-teal-300 bg-teal-50 text-teal-900 rounded-lg p-3 text-sm text-center" to={'/navigateur?source='+m.source+'&query='+encodeURIComponent(query)+'&area='+encodeURIComponent(area)+(mode==='enrich'&&prospectId?'&prospectId='+prospectId:'')}>
            {mode==='enrich'?'Enrichir dans GrowthOS':'Rechercher dans GrowthOS'}</Link>
            <button className="text-xs underline disabled:opacity-50" disabled={!!busy || (mode==='enrich'&&!prospect) || query.trim().length<3} onClick={()=>void launch(m.source)}>{busy===m.source?'Ouverture…':'Secours externe · Chrome'}</button></>}
      </article>)}
    </div>
    {mode==='discover' && <Link to="/prospects/connecteur" className="inline-block underline text-sm">Vérifier et importer la sélection du connecteur</Link>}
    <p className="text-xs" style={{color:'var(--text-muted)'}}>Les profils LinkedIn et réseaux sociaux peuvent être ouverts dans le navigateur cloud ; leurs collecteurs automatiques restent à développer. Les campagnes LinkedIn, RNE, BODACC et les annuaires sectoriels restent à développer.</p>
  </main>;
}
