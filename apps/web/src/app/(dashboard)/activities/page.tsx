'use client';
import { Activity, Mail, Users, Zap, Phone, Calendar, Filter, Search, Clock } from 'lucide-react';
import { useState } from 'react';

const ACTIVITIES = [
  { id:'1', type:'email', title:'Email envoyé à Sophie Martin', desc:'Objet: Suite à notre échange', time:'il y a 5 min', status:'success' },
  { id:'2', type:'call', title:'Appel avec Thomas Durand', desc:'Durée: 12 minutes', time:'il y a 1h', status:'success' },
  { id:'3', type:'meeting', title:'RDV planifié avec Acme Corp', desc:'Mardi 28 mai à 14h00', time:'il y a 2h', status:'planned' },
  { id:'4', type:'email', title:'Relance automatique envoyée', desc:'Séquence: Onboarding SaaS — Étape 2', time:'il y a 3h', status:'success' },
  { id:'5', type:'prospect', title:'Nouveau prospect qualifié', desc:'Pierre Moreau — BigCorp — Score: 91', time:'il y a 4h', status:'success' },
  { id:'6', type:'workflow', title:'Workflow "Relance J+3" déclenché', desc:'47 contacts concernés', time:'hier', status:'success' },
  { id:'7', type:'call', title:'Tentative d\'appel — Pas de réponse', desc:'Marie Leroy — StartupX', time:'hier', status:'failed' },
];

const TYPE_CONFIG = {
  email:    { icon:<Mail className="w-4 h-4" />,    color:'text-purple-600 bg-purple-50' },
  call:     { icon:<Phone className="w-4 h-4" />,   color:'text-blue-600 bg-blue-50' },
  meeting:  { icon:<Calendar className="w-4 h-4" />, color:'text-green-600 bg-green-50' },
  prospect: { icon:<Users className="w-4 h-4" />,   color:'text-teal-600 bg-teal-50' },
  workflow: { icon:<Zap className="w-4 h-4" />,     color:'text-yellow-600 bg-yellow-50' },
};

export default function ActivitiesPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const filtered = ACTIVITIES.filter(a => {
    const matchSearch = !search || `${a.title} ${a.desc}`.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || a.type === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activités</h1>
          <p className="text-sm text-gray-400 mt-0.5">Historique de toutes vos interactions</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium">
          <Activity className="w-4 h-4" /> Nouvelle activité
        </button>
      </div>

      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
        {['all','email','call','meeting','prospect','workflow'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-2 rounded-xl text-sm font-medium capitalize transition-all ${
              filter === f ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500'
            }`}>{f === 'all' ? 'Tous' : f}</button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(activity => {
          const cfg = TYPE_CONFIG[activity.type as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.email;
          return (
            <div key={activity.id} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-start gap-4 hover:shadow-md transition-all">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.color}`}>{cfg.icon}</div>
              <div className="flex-1">
                <div className="font-medium text-gray-900 text-sm">{activity.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">{activity.desc}</div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400 flex-shrink-0">
                <Clock className="w-3 h-3" />
                {activity.time}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
