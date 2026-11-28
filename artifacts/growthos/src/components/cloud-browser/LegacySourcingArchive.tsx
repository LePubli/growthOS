import {useEffect,useState} from 'react';
import {Link} from 'wouter';
import api from '@/lib/api-client';
export default function LegacySourcingArchive({initialId}:{initialId?:string|null}){
  const [jobs,setJobs]=useState<any[]>([]),[selected,setSelected]=useState(initialId||''),[results,setResults]=useState<any[]>([]),[chosen,setChosen]=useState<Record<string,boolean>>({}),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{void api.get<any[]>('/sourcing/jobs').then(setJobs).catch(()=>setMessage('Ancien historique indisponible.'));},[]);
  const read=async(id:string)=>{const data:any=await api.get('/sourcing/jobs/'+id+'/results');return data.candidates||data.data||[];};
  useEffect(()=>{let alive=true;setChosen({});setResults([]);if(selected)void read(selected).then(rows=>{if(alive)setResults(rows);}).catch(()=>{if(alive)setMessage('Résultats historiques indisponibles.');});return()=>{alive=false;};},[selected]);
  async function importSelected(){
    setBusy(true);setMessage('');
    try{
      const ids=results.filter(r=>chosen[r.id||r.siren]&&!r.imported).map(r=>r.id||r.siren);let count=0;
      for(let i=0;i<ids.length;i+=25){const data:any=await api.post('/sourcing/jobs/'+selected+'/import',{ids:ids.slice(i,i+25)});count+=data.imported||0;}
      setChosen({});setResults(await read(selected));setMessage(count+' prospect(s) créé(s). Les doublons sont conservés dans le CRM.');
    }catch(e:any){setMessage(e.message||'Import indisponible');}finally{setBusy(false);}
  }
  return <details className="cloud-browser-history-drawer" open={!!initialId}>
    <summary>Historique des recherches précédentes · {jobs.length}</summary>
    <p className="text-sm p-3">Vos anciennes recherches sont conservées. Les nouvelles recherches utilisent l’espace de collecte ci-dessus.</p>
    {message&&<p role="status">{message}</p>}
    <div className="p-3 space-y-3">{jobs.map(job=><button key={job.id} disabled={busy} type="button" className="cloud-browser-secondary mr-2" onClick={()=>setSelected(job.id)}>{job.name} · {job.count||0} résultat(s)</button>)}</div>
    {!!selected&&<div className="p-3 space-y-2"><button type="button" className="cloud-browser-secondary" disabled={busy} onClick={()=>setChosen(Object.fromEntries(results.filter(r=>!r.imported).map(r=>[r.id||r.siren,true])))}>Tout sélectionner</button>
      {results.map((r,i)=><label key={r.id||r.siren||i} className="flex gap-2 border rounded-lg p-3"><input type="checkbox" disabled={busy||r.imported} checked={!!chosen[r.id||r.siren]&&!r.imported} onChange={e=>setChosen(c=>({...c,[r.id||r.siren]:e.target.checked}))}/>
        <span><strong>{r.company}</strong> · {r.address} {r.imported?' · Déjà présent dans le CRM':''} {r.prospectId&&<Link to={'/prospects/'+r.prospectId}>Voir la fiche CRM</Link>}</span></label>)}
      <button type="button" className="cloud-browser-primary" disabled={busy||!Object.values(chosen).some(Boolean)} onClick={()=>void importSelected()}>Importer la sélection historique</button>
    </div>}
  </details>;
}
