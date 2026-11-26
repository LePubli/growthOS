import { useEffect, useRef } from 'react';
import { ArrowUpRight, Building2, CheckCircle2, CircleAlert, ExternalLink, Globe2, Mail, MapPin, Phone, Sparkles, X } from 'lucide-react';

type Preview = {
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
  const name = [p.firstName, p.lastName].filter(Boolean).join(' ');
  const company = p.company || name || 'Prospect';
  const checks = [
    { label: 'Identité légale', ok: !!(p.siren || p.siret) },
    { label: 'Contact', ok: !!(p.phone || p.email) },
    { label: 'Adresse complète', ok: !!(p.address && p.postalCode) },
    { label: 'Site web', ok: !!p.website },
  ];
  const score = Math.round(checks.filter(c => c.ok).length * 25);
  const next = !checks[2].ok ? 'Vérifier l’adresse et le code postal'
    : !checks[0].ok ? 'Identifier l’entreprise (SIREN/SIRET)'
    : !checks[1].ok ? 'Rechercher un contact vérifié'
    : 'Préparer le premier contact';
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
            <div className="atlas-preview-section-header"><strong>Complétude du dossier</strong><b>{score} %</b></div>
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
          {legalId && <a className="atlas-preview-source" href={'https://www.pappers.fr/recherche?q='+encodeURIComponent(legalId)}
            target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/> Vérifier sur Pappers <ArrowUpRight size={15}/></a>}
        </div>
        <footer className="atlas-preview-footer">
          <small>Vue synthétique · fiche complète en pleine page</small>
          <button className="atlas-primary-button" onClick={onOpen360}><ArrowUpRight size={17}/> Ouvrir la fiche 360°</button>
        </footer>
      </aside>
    </div>
  );
}
