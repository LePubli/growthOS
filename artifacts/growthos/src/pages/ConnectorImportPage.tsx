import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, CheckCircle2, DownloadCloud, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';
import { acknowledgeLocalImport, getLocalCaptures, getLocalDrafts, pingLocalPagesJaunes,
  type LocalCompany, type LocalDraft } from '@/lib/pagesjaunes-device';

type Capture = (LocalCompany & {incomplete?:false}) | (LocalDraft & {incomplete:true});
const LABELS:Record<string,string> = {
  google_maps:'Google Maps',google_search:'Google Search',bing:'Bing',linkedin:'LinkedIn',pagesjaunes:'PagesJaunes',
};
export default function ConnectorImportPage(){
  const [,navigate]=useLocation();
  const [items,setItems]=useState<Capture[]>([]);
  const [selected,setSelected]=useState<string[]>([]);
  const [loading,setLoading]=useState(false);
  const [importing,setImporting]=useState(false);
  const [error,setError]=useState('');
  const [extension,setExtension]=useState('');
  const [lastResult,setLastResult]=useState('');
  const reload=useCallback(async()=>{
    setLoading(true);setError('');
    try{
      const [ping,captures,drafts]=await Promise.all([
        pingLocalPagesJaunes(),getLocalCaptures(),getLocalDrafts(),
      ]);
      setExtension(`${ping.version||'?'} · ${ping.extensionId||'identifiant indisponible'}`);
      const verified:Capture[]=captures.map(c=>({...c,incomplete:false}));
      const complete=verified.map(v=>v.id);
      const merged=[...verified,...drafts.filter(d=>!verified.some(v=>
        v.source===d.source && v.company.toLocaleLowerCase('fr')===d.company.toLocaleLowerCase('fr') &&
        Boolean(v.phone && d.phone && v.phone.replace(/\D/g,'')===d.phone.replace(/\D/g,''))))
        .map(d=>({...d,incomplete:true as const}))];
      setItems(merged);
      setSelected(complete.slice(0,25));
      if((ping.results.length||ping.drafts.length) && !merged.length)
        setError('Des captures sont présentes dans le pont, mais leur source ne correspond pas au type attendu. Rechargez l’extension puis cette page.');
      if(!merged.length && !ping.results.length && !ping.drafts.length)
        setError('Aucune capture sur ce connecteur. Vérifiez que Chrome utilise une seule installation de l’extension, puis rechargez GrowthOS.');
    }catch(e:any){setError(e?.message||'Connecteur inaccessible. Rechargez cette page après mise à jour de l’extension.');}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void reload();},[reload]);
  const toggle=(id:string)=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):s.length>=25?s:[...s,id]);
  const importable=(item:Capture)=>!item.incomplete || Boolean(item.phone||item.website||item.address);
  const submit=async()=>{
    const selectedItems=items.filter(item=>selected.includes(item.id)&&importable(item));
    if(!selectedItems.length){toast.error('Sélectionnez au moins une fiche');return;}
    if(selectedItems.length>25){toast.error('Importez par lots de 25 fiches maximum');return;}
    setImporting(true);setError('');
    try{
      const result=await apiClient.post('/sourcing/device/import-prospects',{
        verified:selectedItems.filter(item=>!item.incomplete),
        drafts:selectedItems.filter(item=>item.incomplete),
      }) as {imported:number;skipped:number;processedIds:string[]};
      setLastResult(`${result.imported} prospect(s) ajouté(s) · ${result.skipped} doublon(s) ou fiche(s) ignorée(s).`);
      toast.success('Import terminé dans Prospects');
      try{if(result.processedIds.length)await acknowledgeLocalImport(result.processedIds);}catch{
        toast.warning('Prospects enregistrés. Rechargez l’extension pour synchroniser la sélection locale.');
      }
      await reload();
    }catch(e:any){setError(e.message||'Import impossible');}
    finally{setImporting(false);}
  };
  const verified=items.filter(item=>!item.incomplete).length;
  const incomplete=items.length-verified;
  return <div className="mx-auto max-w-5xl p-4 md:p-7 space-y-5">
    <button type="button" onClick={()=>navigate('/prospects')} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
      <ArrowLeft size={16}/> Retour aux prospects
    </button>
    <div className="rounded-2xl border border-gray-200 bg-white p-5 md:p-7 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Importer depuis le connecteur Chrome</h1>
          <p className="mt-2 text-sm text-gray-600">Vos captures Google Maps, Google et Bing arrivent directement dans le CRM, sans recherche de sourcing intermédiaire.</p>
          <p className="mt-2 text-xs text-gray-400">Connecteur : {extension||'Vérification…'}</p>
        </div>
        <button type="button" onClick={()=>void reload()} disabled={loading||importing} className="flex gap-2 items-center rounded-xl border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50">
          <RefreshCw size={15} className={loading?'animate-spin':''}/> Actualiser les captures
        </button>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 md:gap-4">
        <div className="rounded-xl bg-gray-50 p-3"><div className="text-xl font-bold">{items.length}</div><div className="text-xs text-gray-600">Fiches locales</div></div>
        <div className="rounded-xl bg-green-50 p-3"><div className="text-xl font-bold text-green-700">{verified}</div><div className="text-xs text-green-700">Adresses complètes</div></div>
        <div className="rounded-xl bg-amber-50 p-3"><div className="text-xl font-bold text-amber-700">{incomplete}</div><div className="text-xs text-amber-700">À compléter plus tard</div></div>
      </div>
      {lastResult&&<div className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800 flex gap-2"><CheckCircle2 size={18}/>{lastResult}</div>}
      {error&&<div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 flex gap-2"><AlertTriangle className="shrink-0" size={18}/>{error}</div>}
    </div>
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 border-b">
        <h2 className="font-semibold">Sélection manuelle · {selected.length}/25</h2>
        <div className="flex gap-3 text-sm">
          <button type="button" onClick={()=>setSelected(items.filter(importable).slice(0,25).map(item=>item.id))} className="text-teal-700">Tout sélectionner</button>
          <button type="button" onClick={()=>setSelected([])} className="text-gray-500">Tout désélectionner</button>
        </div>
      </div>
      <p className="px-4 py-3 text-xs text-gray-600 bg-blue-50">Les fiches incomplètes sont importables si elles ont au moins une coordonnée utile (téléphone, site ou adresse partielle). Aucun code postal, SIREN ou SIRET n’est inventé. Les doublons déjà présents dans le CRM sont ignorés.</p>
      <div className="max-h-[56vh] overflow-y-auto divide-y">
        {items.map(item=><label key={item.id} className="flex gap-3 items-start px-4 py-3 hover:bg-gray-50 cursor-pointer">
          <input type="checkbox" className="mt-1 accent-teal-600" checked={selected.includes(item.id)} disabled={!importable(item)||(!selected.includes(item.id)&&selected.length>=25)} onChange={()=>toggle(item.id)}/>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-2 items-center"><strong className="text-sm text-gray-900 break-words">{item.company}</strong>
              <span className={`text-xs rounded-full px-2 py-0.5 ${item.incomplete?'bg-amber-100 text-amber-800':'bg-green-100 text-green-800'}`}>
                {item.incomplete?'Incomplet':'Adresse vérifiée'}
              </span><span className="text-xs text-gray-500">{LABELS[item.source||'']||item.source}</span></div>
            <p className="text-xs text-gray-600 mt-1 break-words">{item.address||'Adresse inconnue'}{!item.incomplete?` · ${item.codePostal}`:''} · {item.city||'Ville inconnue'}</p>
            <p className="text-xs text-gray-500">{item.phone||'Sans téléphone'}{item.website?` · ${item.website}`:''}</p>
            {!importable(item)&&<p className="text-xs text-orange-700">Pas assez de coordonnées pour créer un prospect utile.</p>}
          </div>
        </label>)}
        {!items.length&&<p className="text-sm p-8 text-center text-gray-500">{loading?'Lecture des captures Chrome…':'Aucune fiche pour le moment'}</p>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t">
        <span className="text-xs text-gray-500">L’import nécessite votre confirmation. Les fiches restent dans Chrome en cas d’échec.</span>
        <button type="button" onClick={()=>void submit()} disabled={importing||loading||!selected.length} className="flex gap-2 items-center rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50 hover:bg-teal-700">
          {importing?<Loader2 size={16} className="animate-spin"/>:<DownloadCloud size={16}/>}
          {importing?'Import en cours…':`Importer ${selected.length} prospect(s)`}
        </button>
      </div>
    </div>
  </div>;
}
