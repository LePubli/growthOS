'use client';
import { useState } from 'react';
import { CheckCircle, Link, RefreshCw, Settings } from 'lucide-react';

const INTEGRATIONS = [
  { id:'hubspot', name:'HubSpot', desc:'Sync bidirectionnel CRM — contacts, deals, activités', logo:'🟠', category:'CRM', connected:false },
  { id:'salesforce', name:'Salesforce', desc:'Import/export leads et opportunités', logo:'☁️', category:'CRM', connected:false },
  { id:'gmail', name:'Gmail', desc:'Envoi d\'emails depuis votre boîte Gmail', logo:'📧', category:'Email', connected:true },
  { id:'outlook', name:'Outlook', desc:'Synchronisation calendrier et emails', logo:'📨', category:'Email', connected:false },
  { id:'slack', name:'Slack', desc:'Notifications en temps réel dans vos channels', logo:'💬', category:'Notifications', connected:true },
  { id:'zapier', name:'Zapier', desc:'Connectez GrowthOS à 5000+ apps', logo:'⚡', category:'Automation', connected:false },
  { id:'linkedin', name:'LinkedIn Sales Navigator', desc:'Import de leads et enrichissement', logo:'💼', category:'Prospecting', connected:false },
  { id:'stripe', name:'Stripe', desc:'Suivi des paiements et revenus clients', logo:'💳', category:'Finance', connected:false },
];

export default function SettingsIntegrationsPage() {
  const [integrations, setIntegrations] = useState(INTEGRATIONS);
  const [category, setCategory] = useState('Tous');
  const cats = ['Tous', ...Array.from(new Set(INTEGRATIONS.map(i => i.category)))];
  const filtered = integrations.filter(i => category === 'Tous' || i.category === category);
  const toggle = (id: string) => setIntegrations(ints => ints.map(i => i.id===id ? {...i,connected:!i.connected} : i));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Intégrations</h1>
      <p className="text-sm text-gray-400 mb-6">{integrations.filter(i=>i.connected).length} connectées sur {integrations.length} disponibles</p>

      <div className="flex gap-2 mb-6 flex-wrap">
        {cats.map(c => <button key={c} onClick={() => setCategory(c)} className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${category===c?'bg-teal-600 text-white':'bg-white border border-gray-200 text-gray-500 hover:border-teal-300'}`}>{c}</button>)}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {filtered.map(integ => (
          <div key={integ.id} className={`bg-white rounded-2xl border p-5 ${integ.connected?'border-teal-200':'border-gray-200'}`}>
            <div className="flex items-start gap-4">
              <div className="text-3xl">{integ.logo}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900">{integ.name}</h3>
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{integ.category}</span>
                  {integ.connected && <CheckCircle className="w-4 h-4 text-teal-500" />}
                </div>
                <p className="text-xs text-gray-400 mb-3">{integ.desc}</p>
                <button onClick={() => toggle(integ.id)} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium ${integ.connected?'bg-red-50 text-red-500 hover:bg-red-100':'bg-teal-50 text-teal-600 hover:bg-teal-100'}`}>
                  {integ.connected ? <><RefreshCw className="w-3.5 h-3.5" />Déconnecter</> : <><Link className="w-3.5 h-3.5" />Connecter</>}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
