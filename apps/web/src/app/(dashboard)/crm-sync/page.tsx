'use client';
import { useState } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Link, Plus, Clock, Users, Settings, Loader2, X, ExternalLink, ArrowRight, ArrowLeft, ArrowLeftRight } from 'lucide-react';

const INTEGRATIONS = [
  { id:'1', name:'HubSpot', logo:'🟠', status:'connected', lastSync:'il y a 5 min', synced:1247, errors:0, direction:'bidirectional', color:'bg-orange-50 border-orange-200' },
  { id:'2', name:'Salesforce', logo:'☁️', status:'disconnected', lastSync:'jamais', synced:0, errors:0, direction:'bidirectional', color:'bg-blue-50 border-blue-200' },
  { id:'3', name:'Pipedrive', logo:'🟢', status:'connected', lastSync:'il y a 1h', synced:432, errors:2, direction:'push', color:'bg-green-50 border-green-200' },
  { id:'4', name:'Notion', logo:'⬛', status:'connected', lastSync:'il y a 2h', synced:89, errors:0, direction:'push', color:'bg-gray-50 border-gray-200' },
  { id:'5', name:'Brevo (Sendinblue)', logo:'🔵', status:'disconnected', lastSync:'jamais', synced:0, errors:0, direction:'push', color:'bg-blue-50 border-blue-200' },
  { id:'6', name:'Airtable', logo:'🟡', status:'disconnected', lastSync:'jamais', synced:0, errors:0, direction:'bidirectional', color:'bg-yellow-50 border-yellow-200' },
];

const DIRECTION_ICONS: Record<string,React.ReactNode> = {
  push: <ArrowRight className="w-3.5 h-3.5"/>,
  pull: <ArrowLeft className="w-3.5 h-3.5"/>,
  bidirectional: <ArrowLeftRight className="w-3.5 h-3.5"/>,
};

function ConnectModal({ integ, onClose, onConnect }: any) {
  const [apiKey, setApiKey] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string|null>(null);

  const connect = async () => {
    if (!apiKey.trim()) { setError('Clé API requise'); return; }
    setConnecting(true); setError(null);
    await new Promise(r=>setTimeout(r,1000));
    onConnect(integ.id);
    onClose();
    setConnecting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{integ.logo}</span>
            <h2 className="text-lg font-bold text-gray-900">Connecter {integ.name}</h2>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400"/></button>
        </div>

        <div className="bg-teal-50 rounded-xl p-4 mb-4">
          <p className="text-sm text-teal-700 font-medium mb-1">Synchronisation {integ.name} → GrowthOS</p>
          <div className="flex items-center gap-2 text-xs text-teal-600">
            {DIRECTION_ICONS[integ.direction]}<span>Mode: {integ.direction}</span>
          </div>
          <ul className="text-xs text-teal-600 mt-2 space-y-0.5">
            <li>✓ Contacts → Prospects GrowthOS</li>
            <li>✓ Deals → Pipeline GrowthOS</li>
            <li>✓ Activités → Journal GrowthOS</li>
          </ul>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 mb-1">Clé API {integ.name}</label>
          <input value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder={`Entrez votre clé API ${integ.name}`} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
          <a href={`https://${integ.name.toLowerCase().replace(' ','')}.com/settings/api`} target="_blank" className="text-xs text-teal-600 hover:underline mt-1 flex items-center gap-1 w-fit">
            <ExternalLink className="w-3 h-3"/>Obtenir ma clé API {integ.name}
          </a>
        </div>

        {error && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 mb-3"><AlertCircle className="w-4 h-4"/>{error}</div>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Annuler</button>
          <button onClick={connect} disabled={connecting||!apiKey} className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
            {connecting?<Loader2 className="w-4 h-4 animate-spin"/>:<Link className="w-4 h-4"/>}Connecter
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CRMSyncPage() {
  const [integrations, setIntegrations] = useState(INTEGRATIONS);
  const [syncing, setSyncing] = useState<string|null>(null);
  const [connecting, setConnecting] = useState<any>(null);
  const [toast, setToast] = useState<{msg:string;type:'success'|'error'}|null>(null);

  const showToast = (msg:string, type:'success'|'error'='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  const handleSync = async (id:string) => {
    setSyncing(id);
    await new Promise(r=>setTimeout(r,2000));
    setIntegrations(ints=>ints.map(i=>i.id===id?{...i,lastSync:'À l\'instant',synced:i.synced+Math.floor(Math.random()*10)}:i));
    showToast('Synchronisation terminée ✓');
    setSyncing(null);
  };

  const handleConnect = (id:string) => {
    setIntegrations(ints=>ints.map(i=>i.id===id?{...i,status:'connected',lastSync:'À l\'instant'}:i));
    showToast('Connecté avec succès ✓');
  };

  const handleDisconnect = (id:string) => {
    setIntegrations(ints=>ints.map(i=>i.id===id?{...i,status:'disconnected',lastSync:'jamais',synced:0}:i));
    showToast('Déconnecté');
  };

  const connected = integrations.filter(i=>i.status==='connected');
  const totalSynced = integrations.reduce((s,i)=>s+i.synced,0);
  const totalErrors = integrations.reduce((s,i)=>s+i.errors,0);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {toast && <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${toast.type==='success'?'bg-teal-600 text-white':'bg-red-500 text-white'}`}>
        {toast.type==='success'?<CheckCircle className="w-4 h-4"/>:<AlertCircle className="w-4 h-4"/>}{toast.msg}
      </div>}
      {connecting && <ConnectModal integ={connecting} onClose={()=>setConnecting(null)} onConnect={handleConnect}/>}

      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">CRM Sync</h1>
          <p className="text-sm text-gray-400">Synchronisez GrowthOS avec vos outils CRM et marketing</p></div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          {label:'CRM connectés',value:connected.length,icon:<Link className="w-5 h-5"/>,color:'text-teal-600 bg-teal-50'},
          {label:'Contacts synchronisés',value:totalSynced.toLocaleString(),icon:<Users className="w-5 h-5"/>,color:'text-blue-600 bg-blue-50'},
          {label:'Erreurs actives',value:totalErrors,icon:<AlertCircle className="w-5 h-5"/>,color:totalErrors>0?'text-red-500 bg-red-50':'text-green-600 bg-green-50'},
        ].map((s,i)=>(
          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>{s.icon}</div>
            <div><div className="text-2xl font-bold text-gray-900">{s.value}</div><div className="text-sm text-gray-400">{s.label}</div></div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {integrations.map(integ=>(
          <div key={integ.id} className={`bg-white rounded-2xl border p-5 ${integ.status==='connected'?'border-teal-200':'border-gray-200'}`}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-2xl flex-shrink-0">{integ.logo}</div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-semibold text-gray-900">{integ.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${integ.status==='connected'?'bg-green-50 text-green-600':'bg-gray-100 text-gray-500'}`}>
                    {integ.status==='connected'?'● Connecté':'○ Déconnecté'}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                    {DIRECTION_ICONS[integ.direction]}{integ.direction}
                  </span>
                  {integ.errors>0&&<span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{integ.errors} erreurs</span>}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span><Clock className="w-3 h-3 inline mr-1"/>Dernier sync: {integ.lastSync}</span>
                  {integ.synced>0&&<span><Users className="w-3 h-3 inline mr-1"/>{integ.synced.toLocaleString()} contacts</span>}
                </div>
              </div>
              <div className="flex gap-2">
                {integ.status==='connected' ? (
                  <>
                    <button onClick={()=>handleSync(integ.id)} disabled={syncing===integ.id}
                      className="flex items-center gap-2 px-4 py-2 bg-teal-50 text-teal-600 rounded-xl text-sm font-medium hover:bg-teal-100 disabled:opacity-50">
                      <RefreshCw className={`w-4 h-4 ${syncing===integ.id?'animate-spin':''}`}/>Sync maintenant
                    </button>
                    <button onClick={()=>handleDisconnect(integ.id)} className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-500 rounded-xl text-sm hover:bg-red-100">
                      <X className="w-4 h-4"/>Déconnecter
                    </button>
                  </>
                ) : (
                  <button onClick={()=>setConnecting(integ)} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700">
                    <Link className="w-4 h-4"/>Connecter
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
