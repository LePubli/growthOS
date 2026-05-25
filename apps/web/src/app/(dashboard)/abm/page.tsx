'use client';
import { Target, Building2, TrendingUp, Plus, Search, Globe, BarChart2, Users } from 'lucide-react';

const ACCOUNTS = [
  { id:'1', name:'Acme Corp', industry:'SaaS', size:'50-200', revenue:'5M€', score:94, stage:'Engaged', contacts:3, territory:'France' },
  { id:'2', name:'TechVision', industry:'Tech', size:'10-50', revenue:'1M€', score:78, stage:'Prospecting', contacts:1, territory:'France' },
  { id:'3', name:'BigCorp', industry:'Enterprise', size:'200+', revenue:'50M€', score:88, stage:'Qualified', contacts:4, territory:'Europe' },
  { id:'4', name:'GrowthCo', industry:'Marketing', size:'10-50', revenue:'2M€', score:71, stage:'Prospecting', contacts:2, territory:'France' },
];

const TAM = { total: 12400, addressable: 3200, obtainable: 480, current: 47 };

export default function ABMPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ABM / TAM</h1>
          <p className="text-sm text-gray-400 mt-0.5">Account-Based Marketing & Total Addressable Market</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium">
          <Plus className="w-4 h-4" /> Ajouter compte cible
        </button>
      </div>

      {/* TAM Stats */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Analyse du marché adressable</h2>
        <div className="grid grid-cols-4 gap-6">
          {[
            { label:'Marché total (TAM)', value: TAM.total.toLocaleString(), color:'bg-gray-100', desc:'Toutes entreprises potentielles' },
            { label:'Marché adressable (SAM)', value: TAM.addressable.toLocaleString(), color:'bg-blue-100', desc:'Critères ICP correspondants' },
            { label:'Marché accessible (SOM)', value: TAM.obtainable.toLocaleString(), color:'bg-teal-100', desc:'Capacité actuelle équipe' },
            { label:'Clients actuels', value: TAM.current.toString(), color:'bg-green-100', desc:'Comptes actifs' },
          ].map((t, i) => (
            <div key={i} className={`${t.color} rounded-xl p-4 text-center`}>
              <div className="text-3xl font-bold text-gray-900">{t.value}</div>
              <div className="text-sm font-medium text-gray-700 mt-1">{t.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{t.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Comptes cibles */}
      <h2 className="font-semibold text-gray-900 mb-3">Comptes cibles</h2>
      <div className="space-y-3">
        {ACCOUNTS.map(acc => (
          <div key={acc.id} className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4 hover:shadow-md transition-all">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600"><Building2 className="w-5 h-5" /></div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-gray-900">{acc.name}</h3>
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{acc.industry}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-400 mt-1">
                <span>{acc.size} employés</span>
                <span>CA: {acc.revenue}</span>
                <span>{acc.territory}</span>
                <span className="flex items-center gap-1"><Users className="w-3 h-3" />{acc.contacts} contacts</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                acc.stage === 'Engaged' ? 'bg-green-50 text-green-600' :
                acc.stage === 'Qualified' ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-500'
              }`}>{acc.stage}</span>
              <span className={`text-sm font-bold px-2.5 py-1 rounded-xl ${acc.score >= 80 ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>{acc.score}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
