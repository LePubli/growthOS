import {useState} from 'react';
import {collectProspectContactPoints,type ProspectContactPoint} from '../../../../lib/api-zod/src/prospect-contacts';
import api from '@/lib/api-client';
export function ProspectContactPoints({prospect,onSaved}:{prospect:any;onSaved:()=>Promise<void>}){
  const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
  const points=collectProspectContactPoints(prospect).filter(p=>!p.personName);
  const groups=new Map<string,ProspectContactPoint[]>();
  for(const p of points){const key=p.type+'|'+(p.type==='phone'?p.value.replace(/\D/g,'').replace(/^33/,'0'):p.value.toLocaleLowerCase('fr'))+'|'+(p.establishmentSiret||'');
    groups.set(key,[...(groups.get(key)||[]),p]);}
  async function choose(p:ProspectContactPoint){setBusy(true);setError('');setNotice('');try{
    await api.post('/contacts/'+prospect.id+'/coordinates/primary',{type:p.type,value:p.value,source:p.source,sourceUrl:p.sourceUrl,...(p.establishmentSiret?{establishmentSiret:p.establishmentSiret}:{}),expectedCurrentValue:prospect[p.type]||null,confirmed:true});
    await onSaved();setNotice('Coordonnée principale mise à jour. Toutes les autres restent conservées.');
  }catch(e){setError(e instanceof Error?e.message:'Mise à jour impossible.');}finally{setBusy(false);}}
  if(!points.length)return null;
  return <section className="space-y-2 mt-3" aria-label="Coordonnées enregistrées et publiées">
    <h3 className="font-semibold text-sm">Coordonnées enregistrées et publiées</h3>
    <p className="text-xs">Les coordonnées générales restent rattachées à l’entreprise. Les lignes directes figurent auprès de la personne identifiée.</p>
    {notice&&<p role="status" className="text-sm">{notice}</p>}{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    <ul className="space-y-3 text-sm">{[...groups].map(([key,entries])=>{const p=entries.find(v=>v.state==='confirmed')||entries[0];const primary=p.type==='phone'?String(prospect.phone||'').replace(/\D/g,'').replace(/^33/,'0')===p.value.replace(/\D/g,'').replace(/^33/,'0'):String(prospect[p.type]||'').toLowerCase()===p.value.toLowerCase();
      return <li key={key}><strong>{p.type==='email'?'Email':p.type==='phone'?'Téléphone':'Adresse'} : </strong>
        {p.establishmentSiret&&<span>Établissement {p.establishmentSiret} · </span>}{p.type==='address'?p.value:<a className="underline" href={(p.type==='email'?'mailto:':'tel:')+p.value}>{p.value}</a>}
        {primary?<span> · Principale</span>:<button type="button" className="atlas-360-link-button ml-2" disabled={busy||!!(p.establishmentSiret&&prospect.siret&&p.establishmentSiret!==prospect.siret)} onClick={()=>void choose(p)}>Utiliser comme principale</button>}
        <div className="text-xs">{entries.map((v,i)=><span key={i}>{i?' · ':''}{v.sourceUrl?<a className="underline" href={v.sourceUrl} target="_blank" rel="noreferrer">{v.source} · preuve</a>:v.source}{v.state==='review'?' · À vérifier':v.state==='published'?' · Publiée sur le site lié':''}</span>)}</div>
      </li>;})}</ul>
  </section>;
}
