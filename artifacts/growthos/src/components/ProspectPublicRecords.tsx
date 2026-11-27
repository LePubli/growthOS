import {SourceLogo} from '@/components/atlas/ProspectLogos';
export function ProspectPublicRecords({details}:{details?:Record<string,any>}){
  const pappers=details?.pappers,bodacc=details?.bodacc,website=details?.website,site=website?.snapshot;
  if(!pappers&&!bodacc&&!site)return null;
  return <div className="space-y-3">
    {site&&<details open><summary className="cursor-pointer font-medium text-sm">Site web du prospect · coordonnées et preuves</summary>
      <p className="text-xs my-2">Lecture du {new Date(website.capturedAt).toLocaleString('fr-FR')}. HTML public initial ; les pages nécessitant JavaScript peuvent rester incomplètes.</p>
      {site.identity==='contradictory'&&<p className="text-sm text-red-700">Identifiant différent sur le site : coordonnées non appliquées au CRM.</p>}
      <ul className="text-sm space-y-2">{(site.publishers||[]).map((p:any,i:number)=><li key={"publisher"+i}>Éditeur / raison sociale publiée : {p.name} · <a className="underline" href={p.sourceUrl} target="_blank" rel="noreferrer">Mentions légales</a></li>)}{site.sirets?.length>0&&<li>SIRET publié(s) : {site.sirets.join(", ")}</li>}{site.sirens?.length>0&&<li>SIREN publié(s) : {site.sirens.join(", ")}</li>}{site.apeCodes?.length>0&&<li>APE / NAF publié(s) : {site.apeCodes.join(", ")}</li>}{(site.emails||[]).map((e:any)=><li key={e.email}><strong>{e.email}</strong> · publié sur le site · <a className="underline" href={e.sourceUrl} target="_blank" rel="noreferrer">Preuve</a><p className="text-xs">{e.check?.detail}</p></li>)}
      {(site.phones||[]).map((p:any)=><li key={p.phone}>{p.phone} · <a className="underline" href={p.sourceUrl} target="_blank" rel="noreferrer">Preuve du téléphone</a></li>)}
      {(site.addresses||[]).map((a:any,i:number)=><li key={i}>{a.address} · <a className="underline" href={a.sourceUrl} target="_blank" rel="noreferrer">Preuve de l’adresse</a></li>)}
      {(site.socials||[]).map((s:any,i:number)=><li key={i}><a className="underline" href={s.url} target="_blank" rel="noreferrer">{s.source}</a> · <a className="underline" href={s.sourceUrl} target="_blank" rel="noreferrer">Publié sur cette page</a></li>)}</ul>
      {!!site.people?.length&&<details open className="mt-3"><summary>Pistes nominatives et recoupement des réseaux</summary><ul>{site.people.map((p:any,i:number)=><li key={i}>{p.name||'Profil lié'} · {p.nameState==='observed'?'nom lu sur un profil public':'piste issue du lien, à recouper'} · <a className="underline" href={p.profileUrl} target="_blank" rel="noreferrer">Profil source</a> · <a className="underline" href={p.sourceUrl} target="_blank" rel="noreferrer">Lien publié par le site</a>{p.reasonCode==='PUBLIC_PROFILE_UNAVAILABLE'&&<p>Le profil n’a pas fourni de contenu public lisible ; son nom éventuel reste une piste. Aucun rôle de dirigeant n’en est déduit.</p>}</li>)}</ul></details>}
      {!!site.openingHours?.length&&<ul>{site.openingHours.map((v:any,i:number)=><li key={i}>Horaires publiés : {v.hours} · <a className="underline" href={v.sourceUrl} target="_blank" rel="noreferrer">Preuve</a></li>)}</ul>}
      {!site.emails?.length&&<p className="text-sm my-2">Aucun email publié trouvé dans les pages lues.</p>}
      {!!site.suggestions?.length&&<div className="mt-3"><strong className="text-sm">Hypothèses d’email · non confirmées</strong><p className="text-xs">Ces variantes ne sont pas ajoutées à l’email du CRM. Le DNS ne confirme pas l’existence de la boîte ; aucun email de test n’a été envoyé.</p><ul className="text-sm">{site.suggestions.map((s:any)=><li key={s.email}>{s.email} · {s.check.detail}</li>)}</ul></div>}
      <details className="mt-3"><summary className="text-sm">Pages consultées ({site.pages?.length||0})</summary>{(site.pages||[]).map((p:any)=><p className="text-xs" key={p.url}><a className="underline" href={p.url} target="_blank" rel="noreferrer">{p.url}</a></p>)}</details>
    </details>}

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
