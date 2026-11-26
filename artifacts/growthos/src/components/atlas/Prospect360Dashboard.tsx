import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { collectProspectPeople } from '@/lib/prospect-people';
import { computeProspectCompleteness, hasValidGeoPosition } from '@/lib/prospect-completeness';
import {
  Activity, ArrowRight, Bell, Building2, CalendarDays, Check, CheckCircle2,
  ChevronDown, Circle, CircleAlert, ClipboardList, ExternalLink, FileSearch,
  Globe2, Mail, MapPin, MoreHorizontal, Phone, Plus, RefreshCw, ShieldCheck,
  Sparkles, Target, UserRound, Users, Zap, Navigation,
} from 'lucide-react';

type Prospect = {
  id: string; company?: string|null; firstName?:string|null; lastName?:string|null;
  jobTitle?:string|null; siren?:string|null; siret?:string|null; apeCode?:string|null;
  nafLabel?:string|null; phone?:string|null; email?:string|null; website?:string|null;
  address?:string|null; postalCode?:string|null; city?:string|null;
  lat?:number|null; lng?:number|null;
  status?:string|null; score?:number|null; source?:string|null;
  sourceDetails?:Record<string,any>|null; createdAt?:string|null; updatedAt?:string|null;
};
type ActivityEntry = {id:string;title?:string|null;type?:string|null;createdAt?:string|null;description?:string|null};
type Deal = {id:string;title:string;stage:string};
type Props = {
  prospect:Prospect; officialManagers?:string[]; activities:ActivityEntry[]; deals:Deal[];
  onEdit:()=>void; onAddActivity:()=>void; onOpenDeal:()=>void; onOpenContacts:()=>void;
  onOpenActivities:()=>void; onOpenSources:()=>void; onOpenMonitoring:()=>void;
  onEnrich:()=>void; onStatusChange:(status:string)=>void;
  locationPreview?:ReactNode; onOpenCrmMap:()=>void;
};

const STATUS = [
  {value:'new',label:'Prospect'},{value:'contacted',label:'Contacté'},
  {value:'qualified',label:'Qualifié'},{value:'negotiation',label:'Négociation'},
  {value:'won',label:'Gagné'},{value:'lost',label:'Perdu'},
  {value:'converted',label:'Converti en deal'},{value:'archived',label:'Archivé'},
];
const text = (v?:string|null) => v?.trim() || 'À compléter';
const frDate=(value?:string|null)=>value && !Number.isNaN(Date.parse(value))
  ? new Date(value).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})
  : 'Non renseignée';
export function ProspectOrbitBanner({prospect:p,onEdit,onOpenContacts,onCall}:{
  prospect:Prospect;onEdit:()=>void;onOpenContacts:()=>void;onCall:()=>void;
}) {
  const hasAddress=!!(p.address&&p.postalCode);
  const hasLegalId=!!(p.siren||p.siret);
  const hasContact=!!(p.phone||p.email);
  const label=!hasAddress?'vérifier l’adresse':!hasLegalId?'identifier l’entreprise':!hasContact?'identifier un contact':'préparer le premier contact';
  const action=!hasAddress||!hasLegalId?onEdit:!hasContact?onOpenContacts:onCall;
  return <div className="atlas-360-orbit-banner">
    <span className="atlas-360-orbit-spark"><Sparkles size={20}/></span>
    <p><strong>Prochaine meilleure action :</strong> {label}.</p>
    <button type="button" onClick={action}><Zap size={16}/> Effectuer l’action en 1 clic <span>→</span></button>
  </div>;
}

export function Prospect360Dashboard({
  prospect:p,officialManagers=[],activities,deals,onEdit,onAddActivity,onOpenDeal,onOpenContacts,onOpenActivities,
  onOpenSources,onOpenMonitoring,onEnrich,onStatusChange,locationPreview,onOpenCrmMap,
}:Props) {
  const [selectedAction,setSelectedAction]=useState(0);
  const people=collectProspectPeople(p,officialManagers);
  const directPhone=p.phone||people.find(person=>person.phone)?.phone;
  const directEmail=p.email||people.find(person=>person.email)?.email;
  const contact=!!(directPhone||directEmail);
  const location=!!(p.address&&p.postalCode&&p.city);
  const {criteria,percent:completeness,completed,total}=computeProspectCompleteness(p,officialManagers);
  const hasLocationPoint=hasValidGeoPosition(p.lat,p.lng);
  const addressParts=[p.address?.trim()||''];
  if(p.postalCode&&!addressParts[0].includes(p.postalCode))addressParts.push(p.postalCode);
  if(p.city&&!addressParts.join(' ').toLocaleLowerCase('fr-FR').includes(p.city.toLocaleLowerCase('fr-FR')))addressParts.push(p.city);
  const displayAddress=addressParts.filter(Boolean).join(', ');
  const verified=criteria[1].met;
  const sourceName=p.source==='annuaire-entreprises'?'INSEE / Annuaire':p.source==='pagesjaunes'?'PagesJaunes':p.source?.replaceAll('_',' ')||'À préciser';
  const suggestions=[
    {label:!location?'Vérifier l’adresse':'Contrôler l’adresse',description:location?'Adresse renseignée ; contrôler sa source.':'Compléter l’adresse et son code postal.',icon:MapPin,action:onEdit,done:location},
    {label:!contact?'Identifier le contact':'Vérifier le contact',description:contact?'Coordonnées enregistrées dans GrowthOS.':'Rechercher un contact qualifié.',icon:UserRound,action:onOpenContacts,done:contact},
    {label:'Contacter le prospect',description:directPhone?'Appeler le numéro enregistré.':directEmail?'Préparer un email professionnel.':'Une coordonnée est nécessaire avant toute prise de contact.',icon:Phone,action:()=>directPhone?window.location.assign('tel:'+directPhone):directEmail?window.location.assign('mailto:'+directEmail):onOpenContacts(),done:false},
  ];
  const selected=suggestions[selectedAction]||suggestions[0];
  return (
    <div className="atlas-360-dashboard">
      <div className="atlas-360-overview-grid">
        <section className="atlas-360-card atlas-360-company">
          <header className="atlas-360-card-header"><div><Building2 size={19}/><h2>Identité & données légales</h2></div>
            <button className="atlas-360-text-button" onClick={onOpenSources}>Voir toutes les données <ArrowRight size={14}/></button></header>
          <dl className="atlas-360-legal-list">
            <div><dt>SIRET</dt><dd><strong>{text(p.siret)}</strong>{verified&&<span className="atlas-360-verified"><Check size={13}/> Vérifié</span>}</dd></div>
            <div><dt>Raison sociale</dt><dd>{text(p.company)}</dd></div>
            <div><dt>Code APE</dt><dd><strong>{text(p.apeCode)}</strong>{p.nafLabel&&<span> — {p.nafLabel}</span>}</dd></div>
            <div><dt>Téléphone</dt><dd>{p.phone?<a className="atlas-360-legal-action" href={'tel:'+p.phone}><Phone size={14}/>{p.phone}</a>:<span className="atlas-360-empty">À compléter</span>}</dd></div>
            <div><dt>Site web</dt><dd>{p.website?<a className="atlas-360-legal-action" href={p.website.startsWith('http')?p.website:'https://'+p.website} target="_blank" rel="noopener noreferrer"><Globe2 size={14}/>Ouvrir le site <ExternalLink size={12}/></a>:<span className="atlas-360-empty">À compléter</span>}</dd></div>
            <div><dt>Adresse</dt><dd>{p.address?<span><MapPin size={15}/>{displayAddress}</span>:<span className="atlas-360-alert"><CircleAlert size={15}/> À vérifier</span>}</dd></div>
          </dl>
          {p.address&&<div className="atlas-360-company-location">
            <div className="atlas-360-company-location-toolbar"><span><MapPin size={14}/> Localisation de l'entreprise</span>
              <div><button type="button" onClick={onOpenCrmMap}><Navigation size={12}/> Carte CRM</button>
                {hasLocationPoint&&<a href={'https://www.google.com/maps?q='+p.lat+','+p.lng} target="_blank" rel="noopener noreferrer"><ExternalLink size={12}/> Google Maps</a>}
              </div>
            </div>
            {locationPreview}
          </div>}
        </section>

        <section className="atlas-360-card atlas-360-completeness">
          <header className="atlas-360-card-header"><div><ClipboardList size={19}/><h2>Complétude du dossier</h2></div></header>
          <div className="atlas-360-complete-body">
            <div className="atlas-360-donut" role="img" aria-label={completeness+' % de données renseignées'} style={{'--atlas-score':completeness+'%'} as CSSProperties}>
              <div><strong>{completeness} %</strong><span>Complétude</span></div>
            </div>
            <ul className="atlas-360-complete-list">
              {criteria.map(c=><li key={c.label} title={c.met?'Critère renseigné':c.missing}>{c.met?<CheckCircle2 size={16} className="yes"/>:<Circle size={16} className="no"/>}<span>{c.label}</span></li>)}
            </ul>
          </div>
          <p className="atlas-360-complete-rule">{completed}/{total} critères validés · Les informations incomplètes ou non vérifiées ne comptent pas.</p>
          <footer className="atlas-360-source-confidence">
            <div>Confiance des sources <button title="Confiance indicative basée sur les données du dossier"><CircleAlert size={14}/></button></div>
            <div className="atlas-360-source-chips"><span>INSEE <b>{verified?'Identifiée':'À confirmer'}</b></span>
              <span>Source CRM <b>{sourceName}</b></span></div>
          </footer>
        </section>

        <section className="atlas-360-card atlas-360-copilot">
          <header className="atlas-360-card-header"><div><Sparkles size={20}/><h2>Copilote IA</h2></div>
            <span className="atlas-360-reco-badge">Recommandations</span></header>
          <div className="atlas-360-copilot-list">
            {suggestions.map((item,i)=>{
              const Icon=item.icon;
              return <button key={item.label} type="button" className={selectedAction===i?'selected':''} onClick={()=>setSelectedAction(i)} aria-pressed={selectedAction===i}>
                <span className={'atlas-360-reco-icon reco-'+i}><Icon size={20}/></span>
                <span><strong>{item.label}</strong><small>{item.description}</small></span>
                <ArrowRight size={17}/></button>;
            })}
          </div>
          <button className="atlas-360-orbit-cta" type="button" onClick={selected.action}><Zap size={16}/> Lancer : {selected.label}</button>
          <small className="atlas-360-copilot-footnote">Suggestions contextuelles basées sur le dossier · validation humaine requise.</small>
        </section>
      </div>

      <div className="atlas-360-secondary-grid">
        <section className="atlas-360-card atlas-360-mini">
          <header className="atlas-360-card-header"><div><Users size={19}/><h2>Contacts <small>({people.length} identifié{people.length>1?'s':''})</small></h2></div>
            <button className="atlas-360-text-button" onClick={onOpenContacts}><Plus size={15}/> Ajouter</button></header>
          {people.length?people.slice(0,2).map(person=><button type="button" key={person.id} className="atlas-360-contact-item atlas-360-person-preview" onClick={onOpenContacts}>
            <span className="atlas-360-contact-avatar"><UserRound size={19}/></span>
            <span className="atlas-360-person-info"><strong>{person.name}</strong><small>{person.role||(person.isManager?'Dirigeant · rôle à confirmer':'Contact CRM')}</small></span>
            <ChevronDown size={15} className="atlas-360-person-chevron"/>
          </button>):<div className="atlas-360-people-empty"><Users size={21}/><span>Aucun contact nominatif identifié</span><small>Les coordonnées générales restent disponibles dans la fiche.</small></div>}
          <button className="atlas-360-card-footer-link" onClick={onOpenContacts}>
            {people.length>2?'Voir les '+people.length+' contacts':'Voir le détail des contacts'} <ArrowRight size={16}/></button>
        </section>

        <section className="atlas-360-card atlas-360-mini">
          <header className="atlas-360-card-header"><div><Activity size={19}/><h2>Activités <small>(chronologie)</small></h2></div>
            <button className="atlas-360-text-button" onClick={onOpenActivities}>Voir tout <ArrowRight size={15}/></button></header>
          <div className="atlas-360-mini-timeline">
            {activities.length===0?<div className="atlas-360-no-events"><CalendarDays size={25}/> Aucune activité enregistrée</div>:activities.slice(0,3).map(a=><button type="button" key={a.id} onClick={onOpenActivities}>
              <i className={a.type==='data_update'?'success':''}/><div><strong>{a.title||'Activité'}</strong>
              <span>{a.type==='data_update'?'Mise à jour de données':a.type||'Activité CRM'}</span></div>
              <time>{frDate(a.createdAt)}</time></button>)}
          </div>
        </section>

        <section className="atlas-360-card atlas-360-mini">
          <header className="atlas-360-card-header"><div><Bell size={19}/><h2>Surveillance <small>(journal)</small></h2></div>
            <button className="atlas-360-text-button" onClick={onOpenMonitoring}>Voir tout <ArrowRight size={15}/></button></header>
          <div className="atlas-360-watch-list">
            <div><span className="atlas-360-watch-dot"/><div><strong>Suivi des données légales</strong><p>Consulter le dernier contrôle et les changements</p></div></div>
            <div><RefreshCw size={17}/><div><strong>Dernière modification du prospect</strong><p>{frDate(p.updatedAt)}</p></div></div>
            <div><ShieldCheck size={17}/><div><strong>Source principale</strong><p>{sourceName}</p></div></div>
          </div>
        </section>

        <section className="atlas-360-card atlas-360-mini atlas-360-opportunity">
          <header className="atlas-360-card-header"><div><Target size={19}/><h2>Opportunité</h2></div></header>
          <div className="atlas-360-opportunity-fields">
            <label><span>Statut</span><select value={STATUS.some(s=>s.value===p.status)?p.status||'new':'new'} onChange={e=>onStatusChange(e.target.value)}>
              {STATUS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}</select><ChevronDown size={15}/></label>
            <div><span>Potentiel</span><div className="atlas-360-potential">{Array.from({length:6},(_,i)=><i key={i} className={typeof p.score==='number'&&p.score>i*100/6?'filled':''}/>)}
              <em>{p.score&&p.score>0?p.score+' / 100':'Non évalué'}</em></div></div>
            <div><span>Prochaine action</span><strong><CalendarDays size={15}/>{!location?'Vérifier l’adresse':!contact?'Identifier le contact':'Prendre contact'}</strong></div>
            <div><span>Deal lié</span><strong>{deals[0]?.title||'Aucun deal'}</strong></div>
          </div>
          <button className="atlas-360-create-deal" onClick={onOpenDeal}><Plus size={18}/>{deals.length?'Voir le deal':'Créer un deal'}</button>
        </section>
      </div>

      <aside className="atlas-360-action-rail" aria-label="Actions rapides">
        <button onClick={onEdit} title="Modifier la fiche"><FileSearch size={19}/></button>
        {p.phone?<a href={'tel:'+p.phone} title="Appeler"><Phone size={19}/></a>:<button disabled title="Téléphone manquant"><Phone size={19}/></button>}
        {p.email?<a href={'mailto:'+p.email} title="Envoyer un email"><Mail size={19}/></a>:<button disabled title="Email manquant"><Mail size={19}/></button>}
        <button onClick={onAddActivity} title="Ajouter une activité"><CalendarDays size={19}/></button>
        <button onClick={onOpenDeal} title="Créer ou voir le deal"><Plus size={19}/></button>
        <span/>
        <button onClick={onEnrich} title="Enrichir le dossier"><Zap size={19}/></button>
        <button onClick={onOpenSources} title="Voir les sources"><Globe2 size={19}/></button>
      </aside>
    </div>
  );
}
