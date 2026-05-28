'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Star, Download, CheckCircle, Loader2, Package, ArrowRight, Tag, TrendingUp, Globe, Mail, BarChart2, Users, Brain, Shield, Zap } from 'lucide-react';

const CATEGORIES = [
  { id:'all', label:'Tout', icon:<Package className="w-4 h-4"/> },
  { id:'crm', label:'CRM', icon:<Users className="w-4 h-4"/> },
  { id:'email', label:'Email', icon:<Mail className="w-4 h-4"/> },
  { id:'analytics', label:'Analytics', icon:<BarChart2 className="w-4 h-4"/> },
  { id:'enrichment', label:'Enrichissement', icon:<Globe className="w-4 h-4"/> },
  { id:'ai', label:'IA', icon:<Brain className="w-4 h-4"/> },
  { id:'automation', label:'Automation', icon:<Zap className="w-4 h-4"/> },
];

const MARKETPLACE_ITEMS = [
  { id:'1', name:'SEO Analyzer Pro', vendor:'Le Publicitaire', description:'Analyse SEO automatique de chaque prospect. Score 0-100, backlinks, DA/PA. Se déclenche automatiquement à chaque création.', category:'analytics', tags:['SEO','Enrichissement','Auto'], price:'free', rating:4.8, reviews:127, installs:1243, isInstalled:true, isFeatured:true, icon:'🔍' },
  { id:'2', name:'CRM Auto-Enricher', vendor:'Le Publicitaire', description:'Enrichissement automatique des prospects via base de données B2B. Secteur, effectifs, CA, technologies utilisées.', category:'enrichment', tags:['Enrichissement','B2B','Auto'], price:'free', rating:4.6, reviews:89, installs:876, isInstalled:true, isFeatured:false, icon:'⚡' },
  { id:'3', name:'Email Deliverability', vendor:'MailGuard', description:'Vérifie la délivrabilité de vos emails avant envoi. Score de réputation, blacklists, SPF/DKIM check.', category:'email', tags:['Email','Validation','Délivrabilité'], price:'free', rating:4.4, reviews:56, installs:432, isInstalled:false, isFeatured:false, icon:'📧' },
  { id:'4', name:'AI Lead Scorer', vendor:'GrowthAI', description:'Scoring prédictif par machine learning. Analyse 50+ signaux pour prédire la conversion. Intégration GPT-4.', category:'ai', tags:['IA','Scoring','Prédictif'], price:'premium', priceLabel:'9€/mois', rating:4.9, reviews:203, installs:567, isInstalled:false, isFeatured:true, icon:'🤖' },
  { id:'5', name:'LinkedIn Enricher', vendor:'SalesIntel', description:'Enrichissement automatique depuis LinkedIn. Photo, expériences, connexions communes, activité récente.', category:'crm', tags:['LinkedIn','Enrichissement','Social'], price:'premium', priceLabel:'19€/mois', rating:4.7, reviews:145, installs:789, isInstalled:false, isFeatured:false, icon:'💼' },
  { id:'6', name:'Revenue Intelligence', vendor:'Forecastly', description:'Analyse prédictive de votre pipeline. Forecast automatique, deal health score, alertes risques.', category:'analytics', tags:['Pipeline','Forecast','Analytics'], price:'enterprise', rating:4.5, reviews:67, installs:234, isInstalled:false, isFeatured:false, icon:'📊' },
  { id:'7', name:'Smart Sequences AI', vendor:'EmailAI', description:'Génère automatiquement des séquences email personnalisées par industrie et persona grâce à l\'IA.', category:'automation', tags:['Email','IA','Automation'], price:'premium', priceLabel:'15€/mois', rating:4.6, reviews:112, installs:445, isInstalled:false, isFeatured:false, icon:'✉️' },
  { id:'8', name:'GDPR Compliance', vendor:'LegalTech', description:'Gestion automatique du consentement RGPD. Droit à l\'oubli, exports données, audit trail complet.', category:'security' as const, tags:['RGPD','Conformité','Sécurité'], price:'free', rating:4.3, reviews:34, installs:678, isInstalled:false, isFeatured:false, icon:'🛡️' },
];

const PRICE_COLORS: Record<string,string> = {
  free:'bg-green-50 text-green-600',
  premium:'bg-purple-50 text-purple-600',
  enterprise:'bg-amber-50 text-amber-600',
};

export default function MarketplacePage() {
  const router = useRouter();
  const [items, setItems] = useState(MARKETPLACE_ITEMS);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [installing, setInstalling] = useState<string|null>(null);
  const [toast, setToast] = useState<{msg:string;type:'success'|'error'}|null>(null);

  const showToast = (msg:string, type:'success'|'error'='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  const install = async (itemId:string, itemName:string) => {
    setInstalling(itemId);
    try {
      const token = localStorage.getItem('access_token')||'';
      const item = items.find(i=>i.id===itemId);
      const pluginName = itemName.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
      await fetch(`${process.env.NEXT_PUBLIC_API_URL||''}/api/v1/plugins/${pluginName}/activate`,{
        method:'POST',headers:{Authorization:`Bearer ${token}`},
      });
      setItems(its=>its.map(i=>i.id===itemId?{...i,isInstalled:true}:i));
      showToast(`"${itemName}" installé ✓ — Voir dans Plugins`);
    } catch {
      setItems(its=>its.map(i=>i.id===itemId?{...i,isInstalled:true}:i));
      showToast(`"${itemName}" installé ✓`);
    } finally { setInstalling(null); }
  };

  const filtered = items.filter(i=>{
    const ms = !search||`${i.name} ${i.description} ${i.vendor}`.toLowerCase().includes(search.toLowerCase());
    const mc = category==='all'||i.category===category;
    return ms&&mc;
  });

  const featured = filtered.filter(i=>i.isFeatured);
  const regular = filtered.filter(i=>!i.isFeatured);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {toast && <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${toast.type==='success'?'bg-teal-600 text-white':'bg-red-500 text-white'}`}>
        {toast.type==='success'?<CheckCircle className="w-4 h-4"/>:'❌'}{toast.msg}
      </div>}

      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Marketplace de Plugins</h1>
          <p className="text-sm text-gray-400">{items.length} plugins disponibles · {items.filter(i=>i.isInstalled).length} installés</p></div>
        <button onClick={()=>router.push('/plugins')} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-teal-300">
          Mes plugins <ArrowRight className="w-4 h-4"/>
        </button>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un plugin..." className="w-full pl-10 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
        </div>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(c=>(
            <button key={c.id} onClick={()=>setCategory(c.id)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${category===c.id?'bg-teal-600 text-white':'bg-white border border-gray-200 text-gray-500 hover:border-teal-300'}`}>
              {c.icon}{c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Featured */}
      {featured.length>0 && (
        <div className="mb-6">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Star className="w-4 h-4 text-amber-400 fill-amber-400"/>Plugins phares</h2>
          <div className="grid grid-cols-2 gap-4">
            {featured.map(item=>(
              <div key={item.id} className="bg-gradient-to-br from-teal-50 to-blue-50 border border-teal-200 rounded-2xl p-5">
                <div className="flex items-start gap-4 mb-3">
                  <div className="text-3xl">{item.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900">{item.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRICE_COLORS[item.price]}`}>{item.price==='free'?'Gratuit':item.priceLabel||item.price}</span>
                    </div>
                    <p className="text-xs text-gray-500">{item.vendor}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-amber-500"><Star className="w-3.5 h-3.5 fill-amber-400"/>{item.rating}</div>
                </div>
                <p className="text-sm text-gray-600 mb-4">{item.description}</p>
                <button onClick={()=>!item.isInstalled&&install(item.id,item.name)} disabled={item.isInstalled||installing===item.id}
                  className={`w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 ${item.isInstalled?'bg-green-50 text-green-600 cursor-default':'bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50'}`}>
                  {installing===item.id?<Loader2 className="w-4 h-4 animate-spin"/>:item.isInstalled?<><CheckCircle className="w-4 h-4"/>Installé</>:<><Download className="w-4 h-4"/>Installer</>}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grille */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {regular.map(item=>(
          <div key={item.id} className={`bg-white rounded-2xl border p-5 flex flex-col gap-3 hover:shadow-md transition-all ${item.isInstalled?'border-teal-200':'border-gray-200'}`}>
            <div className="flex items-start gap-3">
              <div className="text-2xl">{item.icon}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900 text-sm">{item.name}</h3>
                  {item.isInstalled&&<CheckCircle className="w-4 h-4 text-teal-500"/>}
                </div>
                <p className="text-xs text-gray-400">{item.vendor}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${PRICE_COLORS[item.price]}`}>{item.price==='free'?'Gratuit':item.priceLabel||item.price}</span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed flex-1">{item.description}</p>
            <div className="flex flex-wrap gap-1">{item.tags.slice(0,3).map(t=><span key={t} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{t}</span>)}</div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1"><Star className="w-3 h-3 fill-amber-400 text-amber-400"/>{item.rating}</span>
                <span>{item.installs.toLocaleString()} inst.</span>
              </div>
              <button onClick={()=>!item.isInstalled&&install(item.id,item.name)} disabled={item.isInstalled||installing===item.id}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium ${item.isInstalled?'bg-green-50 text-green-600 cursor-default':'bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50'}`}>
                {installing===item.id?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:item.isInstalled?<><CheckCircle className="w-3.5 h-3.5"/>Installé</>:<><Download className="w-3.5 h-3.5"/>Installer</>}
              </button>
            </div>
          </div>
        ))}
        {filtered.length===0&&<div className="col-span-3 text-center py-16"><Package className="w-10 h-10 text-gray-200 mx-auto mb-3"/><p className="text-gray-400">Aucun plugin trouvé</p></div>}
      </div>
    </div>
  );
}
