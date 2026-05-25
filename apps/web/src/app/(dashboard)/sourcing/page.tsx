'use client';
import { Search, Play, Pause, Plus, Globe, Loader2, CheckCircle, Clock, BarChart2 } from 'lucide-react';
import { useState } from 'react';

const SCRAPERS = [
  { id:'1', name:'LinkedIn Sales Navigator', status:'active', lastRun:'il y a 5 min', found:234, url:'linkedin.com/sales', category:'Social' },
  { id:'2', name:'Google Maps B2B', status:'active', lastRun:'il y a 1h', found:89, url:'maps.google.com', category:'Local' },
  { id:'3', name:'BODACC Annonces', status:'paused', lastRun:'il y a 2j', found:456, url:'bodacc.fr', category:'Legal' },
  { id:'4', name:'Pappers.fr', status:'active', lastRun:'il y a 30 min', found:1247, url:'pappers.fr', category:'Legal' },
  { id:'5', name:'Societe.com', status:'draft', lastRun:'jamais', found:0, url:'societe.com', category:'Legal' },
];

export default function SourcingPage() {
  const [scrapers, setScrapers] = useState(SCRAPERS);
  const [loading, setLoading] = useState<string|null>(null);

  const toggle = (id: string) => {
    setLoading(id);
    setTimeout(() => {
      setScrapers(s => s.map(sc => sc.id === id ? {...sc, status: sc.status === 'active' ? 'paused' : 'active'} : sc));
      setLoading(null);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scraping & Sourcing</h1>
          <p className="text-sm text-gray-400 mt-0.5">{scrapers.filter(s=>s.status==='active').length} scrapers actifs</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium">
          <Plus className="w-4 h-4" /> Nouveau scraper
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label:'Scrapers actifs', value: scrapers.filter(s=>s.status==='active').length, icon:<Play className="w-5 h-5" />, color:'text-green-600 bg-green-50' },
          { label:'Prospects trouvés', value: scrapers.reduce((s,sc)=>s+sc.found,0).toLocaleString(), icon:<Globe className="w-5 h-5" />, color:'text-blue-600 bg-blue-50' },
          { label:'Sources connectées', value: scrapers.length, icon:<BarChart2 className="w-5 h-5" />, color:'text-teal-600 bg-teal-50' },
        ].map((s,i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>{s.icon}</div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{s.value}</div>
              <div className="text-sm text-gray-400">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {scrapers.map(sc => (
          <div key={sc.id} className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4 hover:shadow-md transition-all">
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600"><Globe className="w-5 h-5" /></div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-gray-900">{sc.name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  sc.status==='active' ? 'bg-green-50 text-green-600' : sc.status==='paused' ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-500'
                }`}>{sc.status}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-400 mt-1">
                <span>{sc.url}</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{sc.lastRun}</span>
                <span className="flex items-center gap-1 text-teal-600"><CheckCircle className="w-3 h-3" />{sc.found} trouvés</span>
              </div>
            </div>
            <button onClick={() => toggle(sc.id)} disabled={loading === sc.id || sc.status === 'draft'}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                sc.status === 'active' ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-green-50 text-green-600 hover:bg-green-100'
              }`}>
              {loading === sc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : sc.status === 'active' ? <><Pause className="w-4 h-4"/>Pause</> : <><Play className="w-4 h-4"/>Lancer</>}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
