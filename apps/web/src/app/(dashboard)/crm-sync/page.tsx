'use client';
import { RefreshCw, CheckCircle, AlertCircle, Link, Plus, Clock, Users, Settings } from 'lucide-react';
import { useState } from 'react';

const INTEGRATIONS = [
  { id:'1', name:'HubSpot', logo:'🟠', status:'connected', lastSync:'il y a 5 min', synced:1247, errors:0, direction:'bidirectional' },
  { id:'2', name:'Salesforce', logo:'☁️', status:'disconnected', lastSync:'jamais', synced:0, errors:0, direction:'bidirectional' },
  { id:'3', name:'Pipedrive', logo:'🟢', status:'connected', lastSync:'il y a 1h', synced:432, errors:2, direction:'push' },
  { id:'4', name:'Notion', logo:'⬛', status:'connected', lastSync:'il y a 2h', synced:89, errors:0, direction:'push' },
];

export default function CRMSyncPage() {
  const [syncing, setSyncing] = useState<string|null>(null);

  const handleSync = (id: string) => {
    setSyncing(id);
    setTimeout(() => setSyncing(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CRM Sync</h1>
          <p className="text-sm text-gray-400 mt-0.5">Synchronisez GrowthOS avec vos outils CRM</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium">
          <Plus className="w-4 h-4" /> Connecter un CRM
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label:'CRM connectés', value: INTEGRATIONS.filter(i=>i.status==='connected').length, icon:<Link className="w-5 h-5" />, color:'text-teal-600 bg-teal-50' },
          { label:'Contacts synchronisés', value: INTEGRATIONS.reduce((s,i)=>s+i.synced,0).toLocaleString(), icon:<Users className="w-5 h-5" />, color:'text-blue-600 bg-blue-50' },
          { label:'Erreurs actives', value: INTEGRATIONS.reduce((s,i)=>s+i.errors,0), icon:<AlertCircle className="w-5 h-5" />, color:'text-red-500 bg-red-50' },
        ].map((s,i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>{s.icon}</div>
            <div><div className="text-2xl font-bold text-gray-900">{s.value}</div><div className="text-sm text-gray-400">{s.label}</div></div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {INTEGRATIONS.map(integ => (
          <div key={integ.id} className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-2xl">{integ.logo}</div>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-gray-900">{integ.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${integ.status === 'connected' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                    {integ.status === 'connected' ? '● Connecté' : '○ Déconnecté'}
                  </span>
                  {integ.errors > 0 && <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full">{integ.errors} erreurs</span>}
                </div>
                {integ.status === 'connected' && (
                  <div className="flex items-center gap-4 text-xs text-gray-400 mt-1">
                    <span><Clock className="w-3 h-3 inline mr-1" />Sync: {integ.lastSync}</span>
                    <span><Users className="w-3 h-3 inline mr-1" />{integ.synced.toLocaleString()} contacts</span>
                    <span>Direction: {integ.direction}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                {integ.status === 'connected' && (
                  <>
                    <button onClick={() => handleSync(integ.id)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-teal-50 text-teal-600 rounded-xl text-sm hover:bg-teal-100">
                      <RefreshCw className={`w-4 h-4 ${syncing === integ.id ? 'animate-spin' : ''}`} />
                      Synchroniser
                    </button>
                    <button className="p-2 text-gray-400 hover:text-gray-600 bg-gray-50 rounded-xl">
                      <Settings className="w-4 h-4" />
                    </button>
                  </>
                )}
                {integ.status === 'disconnected' && (
                  <button className="px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700">
                    Connecter
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
