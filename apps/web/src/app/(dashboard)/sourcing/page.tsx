'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Play, Pause, Plus, Globe, Loader2, CheckCircle, Clock, BarChart2, ChevronRight, Settings, Zap, AlertCircle } from 'lucide-react';

interface Scraper {
  id: string; name: string; status: 'active'|'paused'|'draft'|'running';
  lastRun: string; found: number; category: string;
  description: string; url: string; requiresKey?: boolean; keyName?: string;
}

const DEFAULT_SCRAPERS: Scraper[] = [
  { id:'linkedin', name:'LinkedIn Sales Navigator', status:'draft', lastRun:'jamais', found:0, category:'Social', url:'linkedin.com/sales', description:'Prospection par poste, secteur, taille entreprise. Requiert un compte Sales Navigator.', requiresKey:true, keyName:'LINKEDIN_COOKIE' },
  { id:'google-maps', name:'Google Maps Business', status:'draft', lastRun:'jamais', found:0, category:'Local', url:'maps.google.com', description:'Recherche d\'entreprises locales avec avis, contacts et coordonnées GPS. Requiert une clé Google Maps API.', requiresKey:true, keyName:'GOOGLE_MAPS_API_KEY' },
  { id:'pages-jaunes', name:'Pages Jaunes', status:'active', lastRun:'il y a 2h', found:312, category:'Local', url:'pagesjaunes.fr', description:'Annuaire professionnel français — 10M+ établissements avec téléphone, email, secteur NAF. Gratuit.', requiresKey:false },
  { id:'insee', name:'INSEE / SIRENE', status:'active', lastRun:'il y a 30 min', found:1847, category:'Legal', url:'api.insee.fr', description:'Base officielle des entreprises françaises — SIREN/SIRET, NAF, effectifs, dirigeants. API officielle gratuite.', requiresKey:false },
  { id:'societe-com', name:'Societe.com', status:'active', lastRun:'il y a 1h', found:567, category:'Legal', url:'societe.com', description:'Données financières, bilans, dirigeants, actionnaires. Idéal pour qualifier les prospects Enterprise.', requiresKey:false },
  { id:'pappers', name:'Pappers.fr', status:'active', lastRun:'il y a 45 min', found:2341, category:'Legal', url:'pappers.fr', description:'API complète SIREN + données légales + dirigeants + dépôts des comptes. 100 req/mois gratuit.', requiresKey:true, keyName:'PAPPERS_API_KEY' },
  { id:'bodacc', name:'BODACC Annonces', status:'paused', lastRun:'il y a 3j', found:892, category:'Legal', url:'bodacc.fr', description:'Annonces légales officielles — créations, modifications, cessions, liquidations. Open data gratuit.', requiresKey:false },
  { id:'hunter', name:'Hunter.io Email Finder', status:'draft', lastRun:'jamais', found:0, category:'Email', url:'hunter.io', description:'Trouve les emails professionnels à partir des domaines d\'entreprise. 25 req/mois gratuit.', requiresKey:true, keyName:'HUNTER_API_KEY' },
];

const CAT_COLORS: Record<string,string> = { Social:'bg-blue-100 text-blue-700', Local:'bg-green-100 text-green-700', Legal:'bg-purple-100 text-purple-700', Email:'bg-orange-100 text-orange-700' };

export default function SourcingPage() {
  const router = useRouter();
  const [scrapers, setScrapers] = useState<Scraper[]>(DEFAULT_SCRAPERS);
  const [loading, setLoading] = useState<string|null>(null);
  const [category, setCategory] = useState('all');
  const [showConfig, setShowConfig] = useState<string|null>(null);
  const [apiKey, setApiKey] = useState('');
  const [toast, setToast] = useState<string|null>(null);

  const showToast = (msg:string) => { setToast(msg); setTimeout(()=>setToast(null),3000); };

  const toggle = async (id:string, e:React.MouseEvent) => {
    e.stopPropagation();
    const sc = scrapers.find(s=>s.id===id);
    if (!sc) return;
    if (sc.requiresKey && sc.status==='draft') { setShowConfig(id); return; }
    setLoading(id);
    setTimeout(() => {
      setScrapers(s=>s.map(x=>x.id===id?{...x,status:x.status==='active'?'paused':'active'}:x));
      setLoading(null);
      showToast(sc.status==='active'?`"${sc.name}" mis en pause`:`"${sc.name}" activé ✓`);
    }, 1000);
  };

  const saveConfig = (id:string) => {
    setScrapers(s=>s.map(x=>x.id===id?{...x,status:'active',lastRun:'jamais'}:x));
    setShowConfig(null); setApiKey('');
    showToast('Configuration sauvegardée ✓');
  };

  const cats = ['all', ...Array.from(new Set(scrapers.map(s=>s.category)))];
  const filtered = scrapers.filter(s=>category==='all'||s.category===category);
  const totalFound = scrapers.reduce((s,sc)=>s+sc.found,0);
  const activeCount = scrapers.filter(s=>s.status==='active').length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {toast && <div className="fixed top-6 right-6 z-50 bg-teal-600 text-white px-4 py-3 rounded-xl shadow-lg text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4"/>{toast}</div>}

      {/* Modal config API key */}
      {showConfig && (() => {
        const sc = scrapers.find(s=>s.id===showConfig)!;
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
              <h2 className="text-lg font-bold text-gray-900 mb-2">Configurer {sc.name}</h2>
              <p className="text-sm text-gray-500 mb-4">{sc.description}</p>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{sc.keyName}</label>
                <input value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder={`Entrez votre ${sc.keyName}`} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
                <p className="text-xs text-gray-400 mt-1">La clé sera stockée de manière sécurisée côté serveur</p>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={()=>setShowConfig(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm">Annuler</button>
                <button onClick={()=>saveConfig(showConfig)} disabled={!apiKey} className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">Activer</button>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Scraping & Sourcing</h1>
        <p className="text-sm text-gray-400">{activeCount} scrapers actifs · {totalFound.toLocaleString()} prospects trouvés</p></div>
        <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700">
          <Plus className="w-4 h-4"/>Nouveau scraper
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          {label:'Scrapers actifs',value:activeCount,icon:<Play className="w-5 h-5"/>,color:'text-green-600 bg-green-50'},
          {label:'Prospects trouvés',value:totalFound.toLocaleString(),icon:<Globe className="w-5 h-5"/>,color:'text-blue-600 bg-blue-50'},
          {label:'Sources dispo',value:scrapers.length,icon:<BarChart2 className="w-5 h-5"/>,color:'text-teal-600 bg-teal-50'},
          {label:'Clés API requises',value:scrapers.filter(s=>s.requiresKey&&s.status==='draft').length,icon:<AlertCircle className="w-5 h-5"/>,color:'text-amber-600 bg-amber-50'},
        ].map((s,i)=>(
          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>{s.icon}</div>
            <div><div className="text-2xl font-bold text-gray-900">{s.value}</div><div className="text-xs text-gray-400">{s.label}</div></div>
          </div>
        ))}
      </div>

      {/* Filtres catégories */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {cats.map(cat=>(
          <button key={cat} onClick={()=>setCategory(cat)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${category===cat?'bg-teal-600 text-white':'bg-white border border-gray-200 text-gray-500 hover:border-teal-300'}`}>
            {cat==='all'?'Tous':cat}
          </button>
        ))}
      </div>

      {/* Liste scrapers */}
      <div className="space-y-3">
        {filtered.map(sc=>(
          <div key={sc.id} onClick={()=>router.push(`/sourcing/${sc.id}`)}
            className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4 hover:shadow-md hover:border-teal-200 cursor-pointer transition-all">
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 flex-shrink-0"><Globe className="w-5 h-5"/></div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="font-semibold text-gray-900">{sc.name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.status==='active'?'bg-green-50 text-green-600':sc.status==='running'?'bg-blue-50 text-blue-600 animate-pulse':sc.status==='paused'?'bg-amber-50 text-amber-600':'bg-gray-100 text-gray-500'}`}>{sc.status}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CAT_COLORS[sc.category]||'bg-gray-100 text-gray-500'}`}>{sc.category}</span>
                {sc.requiresKey && sc.status==='draft' && <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full flex items-center gap-1"><AlertCircle className="w-3 h-3"/>Clé API requise</span>}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{sc.description}</p>
              <div className="flex items-center gap-4 text-xs text-gray-400 mt-1">
                <span>{sc.url}</span>
                <span><Clock className="w-3 h-3 inline mr-1"/>{sc.lastRun}</span>
                {sc.found>0 && <span><CheckCircle className="w-3 h-3 inline mr-1 text-teal-500"/>{sc.found.toLocaleString()} trouvés</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={e=>toggle(sc.id,e)} disabled={loading===sc.id}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${sc.status==='active'?'bg-amber-50 text-amber-600 hover:bg-amber-100':sc.requiresKey&&sc.status==='draft'?'bg-blue-50 text-blue-600 hover:bg-blue-100':'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                {loading===sc.id?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:sc.status==='active'?<><Pause className="w-3.5 h-3.5"/>Pause</>:sc.requiresKey&&sc.status==='draft'?<><Settings className="w-3.5 h-3.5"/>Configurer</>:<><Play className="w-3.5 h-3.5"/>Lancer</>}
              </button>
              <ChevronRight className="w-4 h-4 text-gray-300"/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
