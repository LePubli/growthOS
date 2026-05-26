'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Play, Pause, Settings, Download, RefreshCw, Globe, CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';

const MOCK_RESULTS = [
  { id:'1', company:'Acme Corp', contact:'Sophie Martin', role:'DG', email:'s.martin@acmecorp.fr', phone:'+33 6 12 34 56 78', website:'acmecorp.fr', found:'il y a 5 min', status:'new' },
  { id:'2', company:'TechVision', contact:'Thomas Durand', role:'CTO', email:'t.durand@techvision.io', phone:'+33 6 98 76 54', website:'techvision.io', found:'il y a 8 min', status:'new' },
  { id:'3', company:'StartupX', contact:'Marie Leroy', role:'CEO', email:'m.leroy@startupx.fr', phone:'', website:'startupx.fr', found:'il y a 12 min', status:'enriched' },
];

export default function ScraperDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(MOCK_RESULTS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [config, setConfig] = useState({ keywords:'CEO DG PME France', location:'Paris', industry:'SaaS Tech', limit:'100' });

  const startScraping = () => {
    setRunning(true); setProgress(0);
    const interval = setInterval(() => {
      setProgress(p => { if (p >= 100) { clearInterval(interval); setRunning(false); return 100; } return p + 10; });
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-200 rounded-xl"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
        <div className="flex-1"><h1 className="text-2xl font-bold text-gray-900">LinkedIn Sales Navigator</h1><p className="text-sm text-gray-400">Scraper de prospects B2B</p></div>
        <div className="flex gap-2">
          {selected.size > 0 && <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium"><Download className="w-4 h-4" />Importer ({selected.size})</button>}
          <button onClick={startScraping} disabled={running}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${running?'bg-amber-50 text-amber-600':'bg-green-50 text-green-600 hover:bg-green-100'}`}>
            {running ? <><Loader2 className="w-4 h-4 animate-spin" />En cours...</> : <><Play className="w-4 h-4" />Lancer</>}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5 mb-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Settings className="w-4 h-4" />Configuration</h2>
          <div className="space-y-3">
            {[{k:'keywords',l:'Mots-clés'},{k:'location',l:'Localisation'},{k:'industry',l:'Secteur'},{k:'limit',l:'Limite de résultats'}].map(f => (
              <div key={f.k}>
                <label className="block text-xs text-gray-400 mb-1">{f.l}</label>
                <input value={(config as any)[f.k]} onChange={e => setConfig(c => ({...c,[f.k]:e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-2 bg-white rounded-2xl border border-gray-200 p-5">
          {running && (
            <div className="mb-4 p-4 bg-blue-50 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-700">Scraping en cours...</span>
                <span className="text-sm text-blue-600">{progress}%</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2"><div className="h-2 rounded-full bg-blue-600 transition-all" style={{width:`${progress}%`}} /></div>
            </div>
          )}

          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">{results.length} résultats trouvés</h2>
            <button onClick={() => setSelected(new Set(results.map(r=>r.id)))} className="text-xs text-teal-600">Tout sélectionner</button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>{['','Entreprise','Contact','Rôle','Email','Statut',''].map(h => <th key={h} className="text-left px-3 py-2 text-xs text-gray-500 font-medium">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-100">
                {results.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3"><input type="checkbox" checked={selected.has(r.id)} onChange={() => setSelected(s => { const n=new Set(s); n.has(r.id)?n.delete(r.id):n.add(r.id); return n; })} /></td>
                    <td className="px-3 py-3 font-medium text-gray-900">{r.company}</td>
                    <td className="px-3 py-3 text-gray-700">{r.contact}</td>
                    <td className="px-3 py-3 text-gray-500">{r.role}</td>
                    <td className="px-3 py-3 text-teal-600">{r.email}</td>
                    <td className="px-3 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${r.status==='enriched'?'bg-green-50 text-green-600':'bg-gray-100 text-gray-500'}`}>{r.status}</span></td>
                    <td className="px-3 py-3 text-xs text-gray-400">{r.found}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
