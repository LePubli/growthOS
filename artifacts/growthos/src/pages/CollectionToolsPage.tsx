import {useEffect,useState} from 'react';
import {Link,useSearch} from 'wouter';
import {ArrowLeft,ArrowRight,Check,Compass,ExternalLink,FileSearch,Globe2,Info,Layers3,MoreHorizontal,Search,ShieldCheck,Sparkles,Building2} from 'lucide-react';
import apiClient from '@/lib/api-client';
import {beginConnectorTask} from '@/lib/pagesjaunes-device';
import {CompanyLogo,SourceLogo} from '@/components/atlas/ProspectLogos';
import modules from '../../../../extensions/growthos-pagesjaunes/modules.json';
import '@/collection-tools.css';

type Module=(typeof modules)[number];
type Mode='discover'|'enrich';
const shortDescriptions:Record<string,string>={
  entreprises:'Identité légale, activité NAF et établissements.',
  google_maps:'Établissements, adresse, téléphone et site.',
  pagesjaunes:'Coordonnées et activité locale.',
  google_search:'Recherche web et présence locale.',
  bing:'Fiches locales complémentaires.',
  societe_com:'Identité légale, SIREN et dirigeants.',
};
const localSearch=(source:string,_mode:Mode)=>source==='entreprises';

export default function CollectionToolsPage(){
  const params=new URLSearchParams(useSearch()),prospectId=params.get('prospectId');
  const [mode,setMode]=useState<Mode>(params.get('mode')==='enrich'?'enrich':'discover');
  const [prospect,setProspect]=useState<any>(null);
  const [query,setQuery]=useState(''),[area,setArea]=useState('');
  const [busy,setBusy]=useState<string|null>(null),[notice,setNotice]=useState(''),[error,setError]=useState('');
  const [filter,setFilter]=useState(''),[selectedSource,setSelectedSource]=useState('google_maps');
  useEffect(()=>{
    let alive=true;setProspect(null);
    if(prospectId)apiClient.get('/prospects/'+prospectId).then(p=>{
      if(alive){setProspect(p);setQuery(p.company||'');setArea(p.city||'');}
    }).catch(e=>{if(alive)setError(e.message);});
    return()=>{alive=false;};
  },[prospectId]);
  const available=modules.filter(m=>m.modes.includes(mode)&&m.kind!=='assisted');
  const upcoming=modules.filter(m=>m.modes.includes(mode)&&m.kind==='assisted');
  const term=filter.trim().toLocaleLowerCase('fr');
  const matches=(m:Module)=>(m.name+' '+m.description).toLocaleLowerCase('fr').includes(term);
  const shownAvailable=available.filter(matches),shownUpcoming=upcoming.filter(matches);
  const selectedModule=available.find(m=>m.source===selectedSource)||available[0];
  function changeMode(next:Mode){
    setMode(next);setSelectedSource('google_maps');setFilter('');
    if(prospect){setQuery(next==='enrich'?prospect.company||'':'');setArea(prospect.city||'');}
  }
  function targetFor(source:string){
    const terms='&query='+encodeURIComponent(query)+'&area='+encodeURIComponent(area);
    return localSearch(source,mode)?'/sourcing?source='+source+terms
      :'/navigateur?source='+source+terms+(mode==='enrich'&&prospectId?'&prospectId='+prospectId:'');
  }
  async function launch(source:string){
    setBusy(source);setError('');setNotice('');
    try{
      if(mode==='enrich'&&!prospect)throw new Error('Ouvrez une fiche prospect puis cliquez sur Enrichir.');
      const name=source==='societe_com'&&prospect&&query.trim()===prospect.company
        ? prospect.siret||prospect.siren||query:query;
      await beginConnectorTask({source,mode,query:name.trim(),area:area.trim(),
        ...(mode==='enrich'?{prospect:{id:prospect.id,company:prospect.company}}:{})});
      setNotice(mode==='enrich'
        ?'Recherche ouverte. Choisissez la bonne fiche, ouvrez l’extension GrowthOS, puis confirmez ses données. Vous reviendrez directement sur ce prospect.'
        :'Recherche ouverte. Utilisez l’extension pour collecter les fiches, puis vérifiez votre sélection avant import.');
    }catch(e){setError(e instanceof Error?e.message:'Ouverture impossible.');}
    finally{setBusy(null);}
  }
  return <main className="collection-hub">
    <header className="collection-hub-header">
      <div>
        <Link to={prospectId?'/prospects/'+prospectId:'/prospects'} className="collection-hub-back">
          <ArrowLeft size={14}/>{prospectId?'Retour au prospect':'Prospects'}</Link>
        <h1><span className="collection-hub-heading-icon"><Layers3 size={25}/></span>Collecte et enrichissement</h1>
        <p>Trouvez de nouveaux prospects ou enrichissez une fiche existante.</p>
      </div>
      <Link className="collection-hub-primary collection-hub-cloud-link" to={'/navigateur'+(prospectId?'?prospectId='+prospectId:'')}>
        <Globe2 size={17}/>Ouvrir le navigateur cloud</Link>
    </header>
    <div className="collection-hub-mode" role="group" aria-label="Fonction">
      <button type="button" aria-pressed={mode==='discover'} className={mode==='discover'?'is-active':''}
        onClick={()=>changeMode('discover')}><Compass size={18}/>Trouver des prospects</button>
      <button type="button" aria-pressed={mode==='enrich'} className={mode==='enrich'?'is-active':''}
        onClick={()=>changeMode('enrich')}><FileSearch size={18}/>Compléter un prospect</button>
    </div>
    {mode==='enrich'&&<section className="collection-hub-prospect" aria-label="Prospect à enrichir">
      {prospect?<><div className="collection-hub-prospect-identity">
        <CompanyLogo name={prospect.company||'Prospect'} website={prospect.website} logoUrl={prospect.logoUrl} size="lg"/>
        <span><strong>{prospect.company}</strong><small>{prospect.city||'Localisation inconnue'} · Prospect à enrichir</small></span>
      </div>
      <p>Les champs manquants seront complétés. Les désaccords restent à vérifier.</p>
      <Link to={'/prospects/'+prospectId} className="collection-hub-secondary">Voir la fiche 360° <ExternalLink size={14}/></Link></>
      :<><div className="collection-hub-prospect-identity"><span className="collection-hub-prospect-placeholder"><Building2 size={22}/></span>
        <span><strong>Aucun prospect sélectionné</strong><small>Sélectionnez une fiche CRM pour l’enrichir.</small></span></div>
        <p>Pour cibler une fiche, ouvrez un prospect puis cliquez sur « Enrichir ».</p>
        <Link to="/prospects" className="collection-hub-secondary">Choisir un prospect <ArrowRight size={14}/></Link></>}
    </section>}
    <section className="collection-hub-search" aria-label="Critères de recherche">
      <label><span>{mode==='enrich'?'Entreprise ou dirigeant':'Activité ou entreprise'}</span>
        <input value={query} onChange={e=>setQuery(e.target.value)} maxLength={120}
          placeholder={mode==='enrich'?'Nom de l’entreprise':'Ex. plombier'}/></label>
      <label><span>Ville ou code postal</span>
        <input value={area} onChange={e=>setArea(e.target.value)} maxLength={100} placeholder="Ex. Roubaix"/></label>
      <button type="button" className="collection-hub-search-action"
        onClick={()=>document.getElementById('collection-hub-sources')?.scrollIntoView({behavior:'smooth',block:'start'})}>
        <Search size={16}/>Voir les sources</button>
    </section>
    {error&&<div role="alert" className="collection-hub-alert is-error"><Info size={17}/>
      {error} Le secours externe nécessite l’extension GrowthOS 0.11 ou ultérieure.</div>}
    {notice&&<div role="status" className="collection-hub-alert is-success"><ShieldCheck size={17}/>{notice}</div>}
    <div className="collection-hub-content">
      <section id="collection-hub-sources" className="collection-hub-sources" aria-label="Sources disponibles">
        <div className="collection-hub-section-heading">
          <div><h2>Sources disponibles <span className="collection-hub-count">{available.length} sources</span></h2>
            <p>Collectez des informations publiques et complétez votre dossier dans GrowthOS.</p></div>
          <label className="collection-hub-filter"><Search size={16}/>
            <input aria-label="Filtrer les outils" placeholder="Filtrer les sources" value={filter} onChange={e=>setFilter(e.target.value)}/></label>
        </div>
        <div className="collection-hub-cards">{shownAvailable.map(m=>{
          const active=selectedModule?.source===m.source;
          return <article key={m.source} className={'collection-hub-source collection-hub-source--'+m.source+(active?' is-selected':'')}>
            <div className="collection-hub-source-top">
              <span className="collection-hub-source-logo"><SourceLogo source={m.source==='entreprises'?'annuaire':m.source} size="lg"/></span>
              <div className="collection-hub-source-title"><h3>{m.name}</h3>
                <span className="collection-hub-source-capability">{m.kind==='official'?'Données officielles':'Collecteur cloud'}</span></div>
              <button type="button" className={'collection-hub-source-choice'+(active?' is-selected':'')}
                aria-label={'Sélectionner '+m.name} aria-pressed={active} onClick={()=>setSelectedSource(m.source)}>
                {active?<><Check size={12}/>Sélectionnée</>:<span className="collection-hub-radio"/>}</button>
            </div>
            <p>{shortDescriptions[m.source]||m.description}</p>
            <div className="collection-hub-card-actions">
              {mode==='enrich'&&!prospect
                ?<Link to="/prospects" className="collection-hub-source-button">Choisir un prospect <ArrowRight size={15}/></Link>
                :<Link to={targetFor(m.source)} className={'collection-hub-source-button'+(active?' is-primary':'')}
                  onClick={()=>setSelectedSource(m.source)}>
                  {localSearch(m.source,mode)?'Configurer la recherche':active?'Ouvrir la source':'Utiliser cette source'} <ArrowRight size={15}/></Link>}
              {!localSearch(m.source,mode)&&<details className="collection-hub-source-more">
                <summary title={'Options pour '+m.name} aria-label={'Options pour '+m.name}><MoreHorizontal size={17}/></summary>
                <div><p>{m.hint}</p><button type="button"
                  disabled={!!busy||(mode==='enrich'&&!prospect)||query.trim().length<3}
                  onClick={()=>void launch(m.source)}><ExternalLink size={13}/>{busy===m.source?'Ouverture…':'Secours externe · Chrome'}</button></div>
              </details>}
            </div>
          </article>;
        })}</div>
        {!shownAvailable.length&&<div className="collection-hub-empty">Aucune source disponible ne correspond à « {filter} ».</div>}
      </section>
      <aside className="collection-hub-assistant" aria-label="Parcours conseillé">
        <div className="collection-hub-assistant-header"><Sparkles size={26}/>
          <div><h2>Parcours conseillé</h2><p>{mode==='enrich'
            ?prospect?'Complétez la fiche de '+prospect.company+' en trois étapes.':'Sélectionnez d’abord un prospect à enrichir.'
            :'Collectez et vérifiez vos prospects en trois étapes.'}</p></div></div>
        <ol className="collection-hub-steps">
          <li><span>1</span><div><strong>Choisir une source</strong>
            <p>{selectedModule?.name||'Une source'} est sélectionnée. Vous pouvez en changer.</p></div></li>
          <li><span>2</span><div><strong>Contrôler les données</strong>
            <p>Vérifiez les informations obtenues et les éventuels désaccords.</p></div></li>
          <li><span>3</span><div><strong>{mode==='enrich'?'Enrichir le prospect':'Importer les prospects'}</strong>
            <p>{mode==='enrich'?'Confirmez les données avant de compléter la fiche CRM.':'Validez les fiches sélectionnées avant l’import dans Prospects.'}</p></div></li>
        </ol>
        {mode==='enrich'&&!prospect
          ?<Link to="/prospects" className="collection-hub-primary collection-hub-assistant-action">Choisir un prospect <ArrowRight size={16}/></Link>
          :<Link to={selectedModule?targetFor(selectedModule.source):'/navigateur'} className="collection-hub-primary collection-hub-assistant-action">
            <ExternalLink size={16}/>{selectedModule&&localSearch(selectedModule.source,mode)?'Configurer cette source':'Lancer dans le navigateur'}</Link>}
        <p className="collection-hub-assistant-footnote"><ShieldCheck size={13}/> Validation humaine avant modification du CRM.</p>
      </aside>
    </div>
    <section className="collection-hub-upcoming" aria-label="Connecteurs en préparation">
      <div className="collection-hub-upcoming-title"><h2>Connecteurs en préparation</h2>
        <small>Ouverture manuelle possible dans le navigateur cloud.</small></div>
      <div className="collection-hub-upcoming-grid">{shownUpcoming.map(m=><article key={m.source} className="collection-hub-upcoming-source">
        <span className="collection-hub-upcoming-logo"><SourceLogo source={m.source} size="md"/></span>
        <div><strong>{m.name.replace(' Entreprises','').replace(' Pages','').replace(' professionnel','')}</strong>
          <small>Automatisation à venir</small></div>
        <span className="collection-hub-upcoming-badge">Bientôt</span>
        <Link to={targetFor(m.source)} title={'Ouvrir '+m.name+' en navigation manuelle'} aria-label={'Ouvrir '+m.name+' en navigation manuelle'}>
          <ExternalLink size={14}/></Link>
      </article>)}</div>
      {!shownUpcoming.length&&term&&<p className="collection-hub-upcoming-empty">Aucun connecteur en préparation ne correspond au filtre.</p>}
    </section>
    <footer className="collection-hub-footer"><Info size={15}/>
      <span>Les imports restent traçables et les conflits sont soumis à validation.</span>
      {mode==='discover'&&<Link to="/prospects/connecteur">Vérifier et importer la sélection du connecteur <ExternalLink size={13}/></Link>}
      <small>Les campagnes LinkedIn, RNE, BODACC et les annuaires sectoriels restent à développer.</small>
    </footer>
  </main>;
}
