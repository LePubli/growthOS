'use client';
import { useState, useEffect } from 'react';
import { Activity, Mail, Users, Zap, Phone, Calendar, Search, Clock, Loader2, RefreshCw } from 'lucide-react';

const TYPE_CONFIG: Record<string,{icon:React.ReactNode,color:string,label:string}> = {
  email:    { icon:<Mail className="w-4 h-4"/>,    color:'text-purple-600 bg-purple-50', label:'Email' },
  call:     { icon:<Phone className="w-4 h-4"/>,   color:'text-blue-600 bg-blue-50',    label:'Appel' },
  meeting:  { icon:<Calendar className="w-4 h-4"/>,color:'text-green-600 bg-green-50',  label:'RDV' },
  prospect: { icon:<Users className="w-4 h-4"/>,   color:'text-teal-600 bg-teal-50',    label:'Prospect' },
  workflow: { icon:<Zap className="w-4 h-4"/>,     color:'text-yellow-600 bg-yellow-50',label:'Workflow' },
  plugin:   { icon:<Activity className="w-4 h-4"/>,color:'text-pink-600 bg-pink-50',    label:'Plugin' },
};

const MOCK_ACTIVITIES = [
  { id:'1', type:'prospect', title:'Prospect créé', desc:'Marie Dupont — TechVision — Plugin SEO score: 78/100', time:'il y a 5 min', status:'success' },
  { id:'2', type:'workflow', title:'Workflow "Prospect créé" déclenché', desc:'growthos-crm-enricher: TechVision enrichi: 50 employés, 1-5M€', time:'il y a 6 min', status:'success' },
  { id:'3', type:'email', title:'Séquence email lancée', desc:'Onboarding SaaS — 47 contacts inscrits', time:'il y a 1h', status:'success' },
  { id:'4', type:'plugin', title:'Plugin SEO Analyzer', desc:'Analyse SEO de techvision.io — Score: 78/100', time:'il y a 1h', status:'success' },
  { id:'5', type:'call', title:'Appel planifié', desc:'Sophie Martin — Acme Corp — 14h00', time:'il y a 2h', status:'planned' },
  { id:'6', type:'prospect', title:'Prospect qualifié', desc:'Pierre Moreau — BigCorp — Score: 91', time:'il y a 4h', status:'success' },
  { id:'7', type:'email', title:'Email de relance envoyé', desc:'Séquence: Relance Cold B2B — Étape 2', time:'hier', status:'success' },
  { id:'8', type:'workflow', title:'Workflow "Relance J+3" déclenché', desc:'23 contacts concernés', time:'hier', status:'success' },
];

export default function ActivitiesPage() {
  const [activities, setActivities] = useState(MOCK_ACTIVITIES);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const API = process.env.NEXT_PUBLIC_API_URL || '';

  const filtered = activities.filter(a => {
    const ms = !search||`${a.title} ${a.desc}`.toLowerCase().includes(search.toLowerCase());
    const mf = filter==='all'||a.type===filter;
    return ms && mf;
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Activités</h1>
          <p className="text-sm text-gray-400">Journal de toutes les actions et événements</p></div>
        <button onClick={()=>{}} disabled={loading} className="p-2 bg-white border border-gray-200 rounded-xl text-gray-500">
          <RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`}/>
        </button>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher..." className="w-full pl-10 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
        </div>
        <div className="flex gap-2 flex-wrap">
          {[{v:'all',l:'Tout'},  ...Object.entries(TYPE_CONFIG).map(([k,v])=>({v:k,l:v.label}))].map(f=>(
            <button key={f.v} onClick={()=>setFilter(f.v)} className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${filter===f.v?'bg-teal-600 text-white':'bg-white border border-gray-200 text-gray-500 hover:border-teal-300'}`}>{f.l}</button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map(a=>{
          const type = TYPE_CONFIG[a.type]||TYPE_CONFIG.prospect;
          return (
            <div key={a.id} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-4 hover:shadow-sm transition-all">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${type.color}`}>{type.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 text-sm">{a.title}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${a.status==='success'?'bg-green-50 text-green-600':a.status==='failed'?'bg-red-50 text-red-500':'bg-amber-50 text-amber-600'}`}>{a.status}</span>
                </div>
                <p className="text-xs text-gray-500 truncate mt-0.5">{a.desc}</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-400 flex-shrink-0">
                <Clock className="w-3 h-3"/>{a.time}
              </div>
            </div>
          );
        })}
        {filtered.length===0 && (
          <div className="text-center py-16"><Activity className="w-10 h-10 text-gray-200 mx-auto mb-3"/><p className="text-gray-400">Aucune activité</p></div>
        )}
      </div>
    </div>
  );
}
