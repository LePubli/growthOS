'use client';

import { useState } from 'react';
import {
  Plus, MoreHorizontal, DollarSign, Calendar,
  User, ChevronRight, Search, Filter, Building2
} from 'lucide-react';

interface Deal {
  id: string;
  title: string;
  company: string;
  contact: string;
  value: number;
  probability: number;
  dueDate?: string;
  stage: string;
  tags?: string[];
}

const STAGES = [
  { id:'lead',        label:'Leads',         color:'bg-gray-400',   light:'bg-gray-50',   count:0 },
  { id:'contacted',   label:'Contactés',     color:'bg-blue-500',   light:'bg-blue-50',   count:0 },
  { id:'qualified',   label:'Qualifiés',     color:'bg-purple-500', light:'bg-purple-50', count:0 },
  { id:'negotiation', label:'Négociation',   color:'bg-amber-500',  light:'bg-amber-50',  count:0 },
  { id:'won',         label:'Gagnés',        color:'bg-green-500',  light:'bg-green-50',  count:0 },
];

const MOCK_DEALS: Deal[] = [
  { id:'1', title:'Migration CRM',      company:'Acme Corp',    contact:'Sophie Martin', value:12400, probability:75, dueDate:'2026-06-15', stage:'negotiation', tags:['Urgent'] },
  { id:'2', title:'Audit SEO complet',  company:'TechVision',   contact:'Thomas Durand', value:4800,  probability:50, dueDate:'2026-06-30', stage:'qualified',   tags:[] },
  { id:'3', title:'Refonte site web',   company:'StartupX',     contact:'Marie Leroy',   value:8500,  probability:30, dueDate:'2026-07-10', stage:'contacted',   tags:['Nouveau'] },
  { id:'4', title:'Campagne Google Ads',company:'BigCorp',      contact:'Pierre Moreau', value:3200,  probability:90, dueDate:'2026-06-01', stage:'won',         tags:[] },
  { id:'5', title:'Formation équipe',   company:'GrowthCo',     contact:'Lucie Bernard', value:2100,  probability:20, dueDate:'2026-07-20', stage:'lead',        tags:[] },
  { id:'6', title:'Automatisation mails',company:'Agency FR',   contact:'Antoine Petit', value:6700,  probability:60, dueDate:'2026-06-20', stage:'qualified',   tags:['Chaud'] },
  { id:'7', title:'Stratégie LinkedIn', company:'SaaS Plus',    contact:'Julie Simon',   value:5500,  probability:45, dueDate:'2026-07-05', stage:'contacted',   tags:[] },
  { id:'8', title:'Plugin CRM custom',  company:'Corp XYZ',     contact:'Marc Dupont',   value:15000, probability:80, dueDate:'2026-06-25', stage:'negotiation', tags:['Enterprise'] },
];

function DealCard({ deal, onMove }: { deal: Deal; onMove: (id: string, stage: string) => void }) {
  const stageIdx = STAGES.findIndex(s => s.id === deal.stage);
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-all group cursor-grab">
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-medium text-gray-900 text-sm leading-snug flex-1">{deal.title}</h3>
        <button className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 ml-2">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
        <Building2 className="w-3 h-3" />
        <span>{deal.company}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
        <User className="w-3 h-3" />
        <span>{deal.contact}</span>
      </div>
      {deal.tags && deal.tags.length > 0 && (
        <div className="flex gap-1 mb-3">
          {deal.tags.map(t => (
            <span key={t} className="text-xs bg-teal-50 text-teal-600 px-2 py-0.5 rounded-full">{t}</span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-gray-900">{deal.value.toLocaleString()}€</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          deal.probability >= 70 ? 'bg-green-50 text-green-600' :
          deal.probability >= 40 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'
        }`}>{deal.probability}%</span>
      </div>
      {deal.dueDate && (
        <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-400">
          <Calendar className="w-3 h-3" />
          <span>{new Date(deal.dueDate).toLocaleDateString('fr-FR')}</span>
        </div>
      )}
      {/* Boutons déplacer */}
      <div className="flex gap-1 mt-3 pt-3 border-t border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
        {stageIdx > 0 && (
          <button onClick={() => onMove(deal.id, STAGES[stageIdx-1].id)}
            className="flex-1 text-xs py-1 bg-gray-50 rounded-lg text-gray-500 hover:bg-gray-100">
            ← Reculer
          </button>
        )}
        {stageIdx < STAGES.length - 1 && (
          <button onClick={() => onMove(deal.id, STAGES[stageIdx+1].id)}
            className="flex-1 text-xs py-1 bg-teal-50 rounded-lg text-teal-600 hover:bg-teal-100">
            Avancer →
          </button>
        )}
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const [deals, setDeals] = useState<Deal[]>(MOCK_DEALS);
  const [search, setSearch] = useState('');

  const moveDeal = (id: string, newStage: string) => {
    setDeals(prev => prev.map(d => d.id === id ? { ...d, stage: newStage } : d));
  };

  const filtered = deals.filter(d =>
    !search || `${d.title} ${d.company} ${d.contact}`.toLowerCase().includes(search.toLowerCase())
  );

  const totalPipeline = deals.filter(d => d.stage !== 'won').reduce((s, d) => s + d.value, 0);
  const totalWon = deals.filter(d => d.stage === 'won').reduce((s, d) => s + d.value, 0);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pipeline commercial</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {totalPipeline.toLocaleString()}€ en cours · {totalWon.toLocaleString()}€ gagnés
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
              className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700">
            <Plus className="w-4 h-4" /> Nouvelle opportunité
          </button>
        </div>
      </div>

      {/* Kanban */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map(stage => {
          const stageDeals = filtered.filter(d => d.stage === stage.id);
          const stageValue = stageDeals.reduce((s, d) => s + d.value, 0);
          return (
            <div key={stage.id} className="flex-shrink-0 w-72">
              {/* Header colonne */}
              <div className={`flex items-center justify-between px-3 py-2 rounded-xl mb-3 ${stage.light}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
                  <span className="font-semibold text-sm text-gray-700">{stage.label}</span>
                  <span className="text-xs bg-white text-gray-500 px-1.5 py-0.5 rounded-full shadow-sm">
                    {stageDeals.length}
                  </span>
                </div>
                {stageValue > 0 && (
                  <span className="text-xs font-semibold text-gray-600">
                    {stageValue.toLocaleString()}€
                  </span>
                )}
              </div>

              {/* Cards */}
              <div className="space-y-3">
                {stageDeals.map(deal => (
                  <DealCard key={deal.id} deal={deal} onMove={moveDeal} />
                ))}
                <button className="w-full flex items-center justify-center gap-2 py-3 text-sm text-gray-400 hover:text-gray-600 border-2 border-dashed border-gray-200 rounded-xl hover:border-gray-300 transition-all">
                  <Plus className="w-4 h-4" /> Ajouter
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
