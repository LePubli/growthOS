'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Play, Pause, Plus, Globe, Loader2, CheckCircle, Clock, BarChart2, ChevronRight, Settings, AlertCircle, X } from 'lucide-react';

const SCRAPERS = [
  {id:'linkedin',name:'LinkedIn Sales Navigator',status:'draft',lastRun:'jamais',found:0,category:'Social',description:'Prospection par poste, secteur, taille.',requiresKey:true},
  {id:'google-maps',name:'Google Maps Business',status:'draft',lastRun:'jamais',found:0,category:'Local',description:'Entreprises locales avec contacts.',requiresKey:true},
  {id:'pages-jaunes',name:'Pages Jaunes',status:'active',lastRun:'il y a 2h',found:312,category:'Local',description:'10M+ établissements français.',requiresKey:false},
  {id:'insee',name:'INSEE / SIRENE',status:'active',lastRun:'il y a 30 min',found:1847,category:'Legal',description:'Base officielle entreprises françaises.',requiresKey:false},
  {id:'societe-com',name:'Societe.com',status:'active',lastRun:'il y a 1h',found:567,category:'Legal',description:'Données financières et dirigeants.',requiresKey:false},
  {id:'pappers',name:'Pappers.fr',status:'active',lastRun:'il y a 45 min',found:2341,category:'Legal',description:'API complète SIREN + dirigeants.',requiresKey:true},
  {id:'bodacc',name:'BODACC Annonces',status:'paused',lastRun:'il y a 3j',found:892,category:'Legal',description:'Annonces légales officielles.',requiresKey:false},
  {id:'hunter',name:'Hunter.io Email Finder',status:'draft',lastRun:'jamais',found:0,category:'Email',description:'Emails pro depuis domaines.',requiresKey:true},
];

function NewScraperModal({ onClose }: any) {
  const router = useRouter();
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="rounded-2xl w-full max-w-md p-6 shadow-2xl" style={{background:'var(--card-bg)'}}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold" style={{color:'var(--text-primary)'}}>Choisir un scraper</h2>
          <button onClick={onClose} style={{color:'var(--text-muted)'}}><X className="w-5 h-5"/></button>
        </div>
        <div className="space-y-2 mb-4">
          {SCRAPERS.map(sc=>(
            <button key={sc.id} onClick={()=>{router.push(`/sourcing/${sc.id}`);onClose();}}
              className="w-full flex items-center gap-3 p-3 rounded-xl border text-left hover:opacity-80 transition-all"
              style={{borderColor:'var(--card-border)',background:'var(--body-bg)'}}>
              <Globe className="w-5 h-5 flex-shrink-0" style={{color:'var(--color-primary)'}}/>
              <div className="flex-1"><div className="text-sm font-medium" style={{color:'var(--text-primary)'}}>{sc.name}</div>
                <div className="text-xs" style={{color:'var(--text-muted)'}}>{sc.category} · {sc.requiresKey?'Clé API requise':'Gratuit'}</div></div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${sc.status==='active'?'bg-green-50 text-green-600':sc.status==='draft'?'bg-gray-100 text-gray-500':'bg-amber-50 text-amber-600'}`}>{sc.status}</span>
            </button>
          ))}
        </div>
        <button onClick={onClose} className="w-full py-2.5 border rounded-xl text-sm" style={{borderColor:'var(--card-border)',color:'var(--text-secondary)'}}>Fermer</button>
      </div>
    </div>
  );
}

export default function SourcingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [scrapers, setScrapers] = useState(SCRAPERS);
  const [loading, setLoading] = useState<string|null>(null);
  const [showNew, setShowNew] = useState(searchParams.get('new')==='1');
  const [toast, setToast] = useState<string|null>(null);

  const showToast=(msg:string)=>{setToast(msg);setTimeout(()=>setToast(null),3000);};

  const toggle = (id:string, e:React.MouseEvent) => {
    e.stopPropagation();
    const sc = scrapers.find(s=>s.id===id);
    if (!sc) return;
    if (sc.requiresKey&&sc.status==='draft') { router.push(`/sourcing/${id}`); return; }
    setLoading(id);
    setTimeout(()=>{
      setScrapers(s=>s.map(x=>x.id===id?{...x,status:x.status==='active'?'paused':'active'}:x));
      setLoading(null);
      showToast(sc.status==='active'?`"${sc.name}" mis en pause`:`"${sc.name}" activé ✓`);
    },800);
  };

  return (
    <div className="min-h-screen p-6" style={{background:'var(--body-bg)'}}>
      {toast&&<div className="fixed top-6 right-6 z-50 text-white px-4 py-3 rounded-xl shadow-lg text-sm" style={{background:'var(--color-primary)'}}>{toast}</div>}
      {showNew&&<NewScraperModal onClose={()=>setShowNew(false)}/>}

      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>Scraping & Sourcing</h1>
          <p className="text-sm" style={{color:'var(--text-muted)'}}>Cliquez sur un scraper pour le configurer et lancer</p></div>
        <button onClick={()=>setShowNew(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{background:'var(--color-primary)'}}>
          <Plus className="w-4 h-4"/>Nouveau scraper
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[{l:'Scrapers actifs',v:scrapers.filter(s=>s.status==='active').length},{l:'Prospects trouvés',v:scrapers.reduce((s,sc)=>s+sc.found,0).toLocaleString()},{l:'Sources disponibles',v:scrapers.length}].map((s,i)=>(
          <div key={i} className="rounded-2xl border p-4 flex items-center gap-3" style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:'var(--color-primary-light)',color:'var(--color-primary)'}}>{[<Play className="w-5 h-5"/>,<Globe className="w-5 h-5"/>,<BarChart2 className="w-5 h-5"/>][i]}</div>
            <div><div className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>{s.v}</div><div className="text-xs" style={{color:'var(--text-muted)'}}>{s.l}</div></div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {scrapers.map(sc=>(
          <div key={sc.id} onClick={()=>router.push(`/sourcing/${sc.id}`)}
            className="rounded-2xl border p-5 flex items-center gap-4 cursor-pointer hover:shadow-md transition-all"
            style={{background:'var(--card-bg)',borderColor:'var(--card-border)'}}
            onMouseEnter={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--color-primary)'}
            onMouseLeave={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--card-border)'}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:'var(--color-primary-light)',color:'var(--color-primary)'}}><Globe className="w-5 h-5"/></div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-sm" style={{color:'var(--text-primary)'}}>{sc.name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.status==='active'?'bg-green-50 text-green-600':sc.status==='paused'?'bg-amber-50 text-amber-600':'bg-gray-100 text-gray-500'}`}>{sc.status}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{sc.category}</span>
                {sc.requiresKey&&sc.status==='draft'&&<span className="text-xs flex items-center gap-1 bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full"><AlertCircle className="w-3 h-3"/>Clé requise</span>}
              </div>
              <p className="text-xs mt-0.5" style={{color:'var(--text-muted)'}}>{sc.description}</p>
              <div className="flex gap-4 mt-1 text-xs" style={{color:'var(--text-muted)'}}>
                <span><Clock className="w-3 h-3 inline mr-1"/>{sc.lastRun}</span>
                {sc.found>0&&<span><CheckCircle className="w-3 h-3 inline mr-1 text-green-500"/>{sc.found.toLocaleString()} trouvés</span>}
              </div>
            </div>
            <div className="flex items-center gap-2" onClick={e=>e.stopPropagation()}>
              <button onClick={e=>toggle(sc.id,e)} disabled={loading===sc.id}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium ${sc.status==='active'?'bg-amber-50 text-amber-600':sc.requiresKey&&sc.status==='draft'?'bg-blue-50 text-blue-600':'bg-green-50 text-green-600'} disabled:opacity-50`}>
                {loading===sc.id?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:sc.status==='active'?<><Pause className="w-3.5 h-3.5"/>Pause</>:sc.requiresKey&&sc.status==='draft'?<><Settings className="w-3.5 h-3.5"/>Configurer</>:<><Play className="w-3.5 h-3.5"/>Lancer</>}
              </button>
              <ChevronRight className="w-4 h-4" style={{color:'var(--text-muted)'}}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
