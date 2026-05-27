'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Play, Pause, Settings, Download, Loader2,
  CheckCircle, Clock, AlertCircle, Globe, Search, Filter,
  RefreshCw, X, ChevronRight, Users, Building2, Mail, Phone
} from 'lucide-react';

const SCRAPER_CONFIGS: Record<string, any> = {
  linkedin: {
    name:'LinkedIn Sales Navigator', category:'Social', icon:'💼',
    description:'Recherche de décideurs B2B par poste, secteur, entreprise et localisation.',
    fields:[
      { key:'keywords', label:'Mots-clés (poste/titre)', placeholder:'CEO, Directeur Commercial, DG PME', type:'text' },
      { key:'location', label:'Localisation', placeholder:'France, Paris, Île-de-France', type:'text' },
      { key:'industry', label:'Secteur d\'activité', placeholder:'SaaS, Industrie, Finance', type:'text' },
      { key:'company_size', label:'Taille d\'entreprise', placeholder:'11-50, 51-200', type:'text' },
      { key:'limit', label:'Nombre max de résultats', placeholder:'100', type:'number' },
    ],
    requiresKey:true, keyLabel:'Cookie LinkedIn (li_at)', keyPlaceholder:'AQEDARxxxx...',
  },
  'google-maps': {
    name:'Google Maps Business', category:'Local', icon:'🗺️',
    description:'Trouve des entreprises locales avec coordonnées, téléphone, email et avis Google.',
    fields:[
      { key:'query', label:'Type d\'entreprise', placeholder:'Restaurant, Plombier, Comptable', type:'text' },
      { key:'location', label:'Ville ou code postal', placeholder:'Paris, 75001', type:'text' },
      { key:'radius', label:'Rayon (km)', placeholder:'20', type:'number' },
      { key:'limit', label:'Nombre max', placeholder:'50', type:'number' },
    ],
    requiresKey:true, keyLabel:'Clé API Google Maps', keyPlaceholder:'AIzaSy...',
  },
  'pages-jaunes': {
    name:'Pages Jaunes', category:'Local', icon:'📒',
    description:'Annuaire professionnel français — 10M+ établissements avec téléphone, adresse, secteur NAF.',
    fields:[
      { key:'query', label:'Activité professionnelle', placeholder:'Agence digitale, Comptable, Avocat', type:'text' },
      { key:'location', label:'Ville', placeholder:'Paris, Lyon, Bordeaux', type:'text' },
      { key:'limit', label:'Nombre max', placeholder:'100', type:'number' },
    ],
    requiresKey:false,
  },
  insee: {
    name:'INSEE / SIRENE', category:'Legal', icon:'🏛️',
    description:'Base officielle des entreprises françaises. SIREN/SIRET, NAF, effectifs, date création, dirigeants.',
    fields:[
      { key:'naf_code', label:'Code NAF', placeholder:'6201Z, 7022Z (optionnel)', type:'text' },
      { key:'region', label:'Région', placeholder:'Île-de-France, Auvergne-Rhône-Alpes', type:'text' },
      { key:'min_employees', label:'Effectif minimum', placeholder:'10', type:'number' },
      { key:'max_employees', label:'Effectif maximum', placeholder:'500', type:'number' },
      { key:'limit', label:'Nombre max', placeholder:'200', type:'number' },
    ],
    requiresKey:false,
  },
  'societe-com': {
    name:'Societe.com', category:'Legal', icon:'📊',
    description:'Données financières, bilans, dirigeants, actionnaires. Idéal pour qualifier les prospects Enterprise.',
    fields:[
      { key:'query', label:'Secteur ou mot-clé', placeholder:'logiciel SaaS, agence marketing', type:'text' },
      { key:'location', label:'Département', placeholder:'75, 69, 33', type:'text' },
      { key:'min_revenue', label:'CA minimum (k€)', placeholder:'500', type:'number' },
      { key:'limit', label:'Nombre max', placeholder:'100', type:'number' },
    ],
    requiresKey:false,
  },
  pappers: {
    name:'Pappers.fr', category:'Legal', icon:'📋',
    description:'API complète SIREN + données légales + dirigeants + dépôts des comptes. 100 req/mois gratuit.',
    fields:[
      { key:'query', label:'Recherche textuelle', placeholder:'Nom d\'entreprise, dirigeant', type:'text' },
      { key:'code_naf', label:'Code NAF', placeholder:'6201Z', type:'text' },
      { key:'departement', label:'Département', placeholder:'75', type:'text' },
      { key:'limit', label:'Nombre max', placeholder:'50', type:'number' },
    ],
    requiresKey:true, keyLabel:'Clé API Pappers', keyPlaceholder:'pappers_xxx...',
  },
  bodacc: {
    name:'BODACC Annonces', category:'Legal', icon:'📜',
    description:'Annonces légales officielles — créations, modifications, cessions, liquidations, procédures collectives.',
    fields:[
      { key:'type', label:'Type d\'annonce', placeholder:'creation, modification, vente', type:'text' },
      { key:'region', label:'Région', placeholder:'Paris, Lyon', type:'text' },
      { key:'date_from', label:'Depuis', placeholder:'2026-01-01', type:'date' },
      { key:'limit', label:'Nombre max', placeholder:'100', type:'number' },
    ],
    requiresKey:false,
  },
  hunter: {
    name:'Hunter.io Email Finder', category:'Email', icon:'📧',
    description:'Trouve les emails professionnels à partir des domaines d\'entreprise. 25 req/mois gratuit.',
    fields:[
      { key:'domain', label:'Domaine(s)', placeholder:'acme.fr, techvision.io', type:'text' },
      { key:'department', label:'Département', placeholder:'sales, marketing, ceo', type:'text' },
      { key:'limit', label:'Nombre max', placeholder:'25', type:'number' },
    ],
    requiresKey:true, keyLabel:'Clé API Hunter.io', keyPlaceholder:'hunter_xxx...',
  },
};

export default function ScraperDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const scraperId = String(id);
  const config = SCRAPER_CONFIGS[scraperId] || SCRAPER_CONFIGS['pages-jaunes'];

  const [fields, setFields] = useState<Record<string,string>>({});
  const [apiKey, setApiKey] = useState('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState<{msg:string;type:'success'|'error'}|null>(null);
  const API = process.env.NEXT_PUBLIC_API_URL || '';

  const showToast = (msg:string, type:'success'|'error'='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3500); };

  const startScraping = async () => {
    if (config.requiresKey && !apiKey) { showToast('Clé API requise','error'); return; }
    setRunning(true); setProgress(0); setResults([]);
    // Simulation de scraping progressif
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          setRunning(false);
          // Résultats mock selon le type de scraper
          const mockResults = generateMockResults(scraperId, parseInt(fields.limit||'10'));
          setResults(mockResults);
          showToast(`${mockResults.length} prospects trouvés ✓`);
          return 100;
        }
        return p + Math.random()*15;
      });
    }, 400);
  };

  const generateMockResults = (type:string, count:number) => {
    const names = [['Marie','Dupont'],['Thomas','Martin'],['Sophie','Bernard'],['Pierre','Moreau'],['Julie','Dubois'],['Nicolas','Leroy'],['Emma','Simon'],['Antoine','Laurent']];
    const companies = ['Acme Corp','TechVision','StartupX','BigCorp','RetailPro','Innovate SAS','WebAgency','GrowthCo'];
    const cities = ['Paris','Lyon','Bordeaux','Nantes','Marseille','Toulouse','Lille','Strasbourg'];
    return Array.from({length:Math.min(count,8)},(_,i)=>({
      id:String(i+1), firstName:names[i%names.length][0], lastName:names[i%names.length][1],
      company:companies[i%companies.length], email:type==='hunter'?`contact@${companies[i%companies.length].toLowerCase().replace(' ','')}.fr`:'',
      phone:type!=='linkedin'?`+33 6 ${Math.floor(Math.random()*90+10)} ${Math.floor(Math.random()*90+10)} ${Math.floor(Math.random()*90+10)} ${Math.floor(Math.random()*90+10)}`:'',
      city:cities[i%cities.length], source:config.name, status:'new' as const,
    }));
  };

  const importSelected = async () => {
    if (selected.size === 0) return;
    setImporting(true);
    try {
      const token = localStorage.getItem('access_token')||'';
      const toImport = results.filter(r=>selected.has(r.id));
      const res = await fetch(`${API}/api/v1/prospects/bulk`,{
        method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
        body:JSON.stringify({prospects:toImport}),
      });
      if (res.ok) showToast(`${selected.size} prospects importés ✓`);
      else throw new Error();
      setSelected(new Set());
    } catch { showToast('Erreur import','error'); }
    finally { setImporting(false); }
  };

  const setField = (k:string,v:string) => setFields(f=>({...f,[k]:v}));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {toast && <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${toast.type==='success'?'bg-teal-600 text-white':'bg-red-500 text-white'}`}>
        {toast.type==='success'?<CheckCircle className="w-4 h-4"/>:<AlertCircle className="w-4 h-4"/>}{toast.msg}
      </div>}

      <div className="flex items-center gap-4 mb-6">
        <button onClick={()=>router.back()} className="p-2 hover:bg-gray-200 rounded-xl"><ArrowLeft className="w-5 h-5 text-gray-600"/></button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{config.icon}</span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{config.name}</h1>
              <p className="text-sm text-gray-400">{config.category}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {selected.size>0 && (
            <button onClick={importSelected} disabled={importing}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700">
              {importing?<Loader2 className="w-4 h-4 animate-spin"/>:<Download className="w-4 h-4"/>}
              Importer ({selected.size})
            </button>
          )}
          <button onClick={startScraping} disabled={running}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${running?'bg-amber-50 text-amber-600':'bg-teal-600 text-white hover:bg-teal-700'}`}>
            {running?<><Loader2 className="w-4 h-4 animate-spin"/>En cours...</>:<><Play className="w-4 h-4"/>Lancer</>}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Config panel */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2"><Settings className="w-4 h-4"/>Configuration</h2>
            <p className="text-xs text-gray-400 mb-4">{config.description}</p>
            <div className="space-y-3">
              {config.fields.map((f:any)=>(
                <div key={f.key}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}</label>
                  <input type={f.type} value={fields[f.key]||''} onChange={e=>setField(f.key,e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
                </div>
              ))}
              {config.requiresKey && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{config.keyLabel} <span className="text-red-400">*</span></label>
                  <input type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)}
                    placeholder={config.keyPlaceholder}
                    className="w-full px-3 py-2 border border-amber-200 bg-amber-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"/>
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>Requis pour ce scraper</p>
                </div>
              )}
            </div>
            <button onClick={startScraping} disabled={running||(!apiKey&&config.requiresKey)}
              className="w-full mt-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {running?<><Loader2 className="w-4 h-4 animate-spin"/>Scraping...</>:<><Play className="w-4 h-4"/>Lancer le scraping</>}
            </button>
          </div>

          {/* Infos */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Informations</h3>
            <dl className="space-y-2 text-sm">
              {[
                ['Catégorie', config.category],
                ['API requise', config.requiresKey?'Oui':'Non (open data)'],
                ['RGPD', 'Données publiques'],
              ].map(([k,v])=>(
                <div key={k} className="flex justify-between">
                  <dt className="text-gray-400">{k}</dt>
                  <dd className="font-medium text-gray-900">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* Résultats */}
        <div className="col-span-2">
          {running && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-700 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/>Scraping {config.name}...</span>
                <span className="text-sm font-bold text-blue-700">{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div className="h-2 rounded-full bg-blue-600 transition-all" style={{width:`${progress}%`}}/>
              </div>
              <p className="text-xs text-blue-500 mt-1">Recherche en cours — les résultats apparaîtront ici</p>
            </div>
          )}

          {results.length>0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <h2 className="font-semibold text-gray-900">{results.length} résultats trouvés</h2>
                  {selected.size>0&&<span className="text-xs bg-teal-50 text-teal-600 px-2 py-0.5 rounded-full">{selected.size} sélectionnés</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={()=>setSelected(new Set(results.map(r=>r.id)))} className="text-xs text-teal-600 hover:underline">Tout sélectionner</button>
                  {selected.size>0&&<button onClick={()=>setSelected(new Set())} className="text-xs text-gray-400 hover:underline">Désélectionner</button>}
                </div>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr>
                  <th className="px-4 py-2 w-8"></th>
                  {['Prénom','Nom','Entreprise','Email','Ville',''].map(h=><th key={h} className="text-left px-3 py-2 text-xs text-gray-500 font-semibold">{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {results.map(r=>(
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selected.has(r.id)}
                          onChange={()=>setSelected(s=>{const n=new Set(s);n.has(r.id)?n.delete(r.id):n.add(r.id);return n;})}
                          className="rounded"/>
                      </td>
                      <td className="px-3 py-3 font-medium text-gray-900">{r.firstName}</td>
                      <td className="px-3 py-3 text-gray-700">{r.lastName}</td>
                      <td className="px-3 py-3 text-gray-700">{r.company}</td>
                      <td className="px-3 py-3 text-teal-600">{r.email||'—'}</td>
                      <td className="px-3 py-3 text-gray-400">{r.city}</td>
                      <td className="px-3 py-3">
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{r.source}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {selected.size>0&&(
                <div className="px-5 py-3 bg-teal-50 border-t border-teal-100 flex items-center justify-between">
                  <span className="text-sm text-teal-700">{selected.size} prospect{selected.size>1?'s':''} prêt{selected.size>1?'s':''} à importer</span>
                  <button onClick={importSelected} disabled={importing}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium">
                    {importing?<Loader2 className="w-4 h-4 animate-spin"/>:<Download className="w-4 h-4"/>}
                    Importer dans GrowthOS
                  </button>
                </div>
              )}
            </div>
          ) : !running && (
            <div className="bg-white rounded-2xl border border-gray-200 flex flex-col items-center justify-center py-20">
              <Globe className="w-16 h-16 text-gray-200 mb-4"/>
              <h3 className="font-semibold text-gray-700 mb-1">Prêt à scraper</h3>
              <p className="text-sm text-gray-400 text-center max-w-sm">Configurez les paramètres et cliquez sur "Lancer le scraping" pour trouver des prospects</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
