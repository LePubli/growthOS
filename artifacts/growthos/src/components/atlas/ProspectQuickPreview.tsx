import api from '@/lib/api-client';
import {computeProspectCompleteness,type CompletenessProspect} from '@/lib/prospect-completeness';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Building2, CheckCircle2, CircleAlert, ExternalLink, Globe2, Mail, MapPin, Phone, Sparkles, X } from 'lucide-react';

type Preview = CompletenessProspect & {
  id: string; firstName?: string; lastName?: string; company?: string; jobTitle?: string;
  email?: string; phone?: string; website?: string; address?: string; city?: string;
  postalCode?: string; siren?: string; siret?: string; apeCode?: string; status?: string;
};
type Props = { prospect: Preview; onClose: () => void; onOpen360: () => void };

export function ProspectQuickPreview({ prospect: p, onClose, onOpen360 }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const [current,setCurrent]=useState(p),[officialManagers,setOfficialManagers]=useState<string[]>([]),[checking,setChecking]=useState(true);
  useEffect(()=>{
    let alive=true;setCurrent(p);setOfficialManagers([]);setChecking(true);
    void Promise.all([api.get<Preview>('/prospects/'+p.id),api.get<any>('/prospects/'+p.id+'/monitoring').catch(()=>null)]).then(([record,monitor])=>{if(alive){setCurrent(record);setOfficialManagers(monitor?.snapshot?.managers||[]);}}).catch(()=>{}).finally(()=>{if(alive)setChecking(false);});
    return()=>{alive=false;};
  },[p.id]);
  p=current;
  const name = [p.firstName, p.lastName].filter(Boolean).join(' ');
  const company = p.company || name || 'Prospect';
  const completeness=computeProspectCompleteness(p,officialManagers);
  const checks=completeness.criteria.map(c=>({label:c.label,ok:c.met}));
  const score=completeness.percent;
  const next=completeness.criteria.find(c=>!c.met)?.missing||'Préparer le premier contact';
  const legalId = p.siren || p.siret;
  return (
    <div className="atlas-preview-backdrop" onMouseDown={onClose}>
      <aside className="atlas-preview-panel" role="dialog" aria-modal="true" aria-label={'Aperçu de ' + company} onMouseDown={e => e.stopPropagation()}>
        <header className="atlas-preview-header">
          <div><div className="atlas-preview-eyebrow">● APERÇU RAPIDE</div><h2>Fiche prospect</h2></div>
          <button ref={closeRef} className="atlas-icon-button" onClick={onClose} aria-label="Fermer"><X size={19}/></button>
        </header>
        <div className="atlas-preview-scroll">
          <div className="atlas-preview-identity">
            <div className="atlas-preview-avatar"><Building2 size={28}/></div>
            <h3>{company}</h3>
            <span className="atlas-status-pill">{p.status || 'Prospect'}</span>
            {name && company !== name && <p>{name}{p.jobTitle ? ' · ' + p.jobTitle : ''}</p>}
          </div>
          <section className="atlas-preview-card atlas-preview-assistant">
            <div className="atlas-preview-card-title"><Sparkles size={16}/> Prochaine meilleure action</div>
            <p>{next}</p>
            <small>Suggestion calculée à partir des champs manquants. Aucune action automatique.</small>
          </section>
          <section className="atlas-preview-card">
            <div className="atlas-preview-section-header"><strong>Complétude du dossier</strong><b>{checking?'Vérification…':score+' %'}</b></div>
            <div className="atlas-progress-track"><div style={{width: score + '%'}}/></div>
            <div className="atlas-preview-checks">
              {checks.map(c=><div key={c.label}>{c.ok?<CheckCircle2 size={15} className="atlas-green"/>:<CircleAlert size={15} className="atlas-amber"/>}{c.label}</div>)}
            </div>
          </section>
          <section className="atlas-preview-card">
            <div className="atlas-preview-section-header"><strong>Informations clés</strong></div>
            <dl className="atlas-preview-fields">
              <div><dt><Building2 size={15}/> SIREN / SIRET</dt><dd>{legalId || 'À compléter'}</dd></div>
              <div><dt><MapPin size={15}/> Adresse</dt><dd>{[p.address,p.postalCode,p.city].filter(Boolean).join(', ') || 'À vérifier'}</dd></div>
              <div><dt><Phone size={15}/> Téléphone</dt><dd>{p.phone?<a href={'tel:'+p.phone}>{p.phone}</a>:'À compléter'}</dd></div>
              <div><dt><Mail size={15}/> Email</dt><dd>{p.email?<a href={'mailto:'+p.email}>{p.email}</a>:'À compléter'}</dd></div>
              <div><dt><Globe2 size={15}/> Site web</dt><dd>{p.website || 'À compléter'}</dd></div>
              <div><dt><Building2 size={15}/> Code APE</dt><dd>{p.apeCode || 'À compléter'}</dd></div>
            </dl>
          </section>
          {legalId && <a className="atlas-preview-source" href={'https://www.societe.com/recherche?q='+encodeURIComponent(legalId)+'&ftStatus=0'}
            target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/> Vérifier sur Societe.com <ArrowUpRight size={15}/></a>}
        </div>
        <footer className="atlas-preview-footer">
          <small>Vue synthétique · fiche complète en pleine page</small>
          <button className="atlas-primary-button" onClick={onOpen360}><ArrowUpRight size={17}/> Ouvrir la fiche 360°</button>
        </footer>
      </aside>
    </div>
  );
}
