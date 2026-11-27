import {SourceLogo} from '@/components/atlas/ProspectLogos';
export function ProspectPublicRecords({details}:{details?:Record<string,any>}){
  const pappers=details?.pappers,bodacc=details?.bodacc;
  if(!pappers&&!bodacc)return null;
  return <div className="space-y-3">
    {pappers?.companyDetails&&<details><summary className="cursor-pointer font-medium text-sm"><SourceLogo source="pappers" size="sm"/> Informations publiques Pappers</summary>
      <p className="text-xs my-2">Lecture du {new Date(pappers.capturedAt).toLocaleString('fr-FR')} · <a className="underline" href={pappers.sourceUrl} target="_blank" rel="noreferrer">Fiche source</a></p>
      {pappers.scope==='unite_legale'&&<p className="text-xs">Données de l’entreprise. L’établissement CRM conserve son adresse et son SIRET.</p>}
      <dl className="space-y-2 text-sm">{Object.entries(pappers.companyDetails.fields||{}).map(([key,value])=><div key={key}><dt className="font-medium">{key}</dt><dd>{String(value)}</dd></div>)}</dl>
      <ul className="space-y-2 mt-3 text-sm">{(pappers.companyDetails.managerContacts||[]).map((c:any)=><li key={c.profileUrl||c.name}>{c.name}{c.role?' · '+c.role:''} {c.profileUrl&&<a className="underline" href={c.profileUrl} target="_blank" rel="noreferrer">Fiche du dirigeant</a>}</li>)}</ul>
      {!!pappers.history?.length&&<p className="text-xs mt-2">{pappers.history.length} version(s) précédente(s) conservée(s) ; changements dans les activités.</p>}
    </details>}
    {bodacc&&<details><summary className="cursor-pointer font-medium text-sm"><SourceLogo source="bodacc" size="sm"/> Annonces officielles BODACC ({bodacc.announcements?.length||0})</summary>
      <p className="text-xs my-2">SIREN {bodacc.siren} · contrôle du {new Date(bodacc.capturedAt).toLocaleString('fr-FR')} · <a className="underline" href={bodacc.sourceUrl} target="_blank" rel="noreferrer">Toutes les annonces sur BODACC.fr</a></p>
      <p className="text-xs">Les annonces sont des événements datés. Elles ne remplacent pas le contrôle du statut actuel de l’établissement.</p>
      {bodacc.hasMore&&<p className="text-xs">Chargement de l’historique en cours… {bodacc.pending?.announcements?.length||0} / {bodacc.total}</p>}
      <ul className="space-y-3 mt-3 text-sm">{(bodacc.announcements||[]).map((a:any)=><li key={a.id}><a className="underline font-medium" href={a.url} target="_blank" rel="noreferrer">{a.date} · {a.type}</a><p>{a.company} · {a.tribunal}</p>{a.details&&<details><summary>Détail de l’annonce</summary><pre className="whitespace-pre-wrap text-xs">{a.details}</pre></details>}</li>)}</ul>
      {!bodacc.announcements?.length&&<p className="text-sm mt-2">Aucune annonce correspondant au SIREN n’a été retournée par la source.</p>}
    </details>}
  </div>;
}
