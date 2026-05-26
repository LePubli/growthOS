'use client';
import { useState } from 'react';
import { Zap, Plus, Copy, Trash2, CheckCircle, AlertCircle, Clock, Globe, Eye, EyeOff } from 'lucide-react';

const EVENTS = ['prospect.created','prospect.updated','deal.created','deal.stage_changed','email.sent','email.opened','email.replied','workflow.triggered','plugin.activated'];

const MOCK = [
  { id:'1', name:'HubSpot Sync', url:'https://api.hubspot.com/webhooks/grow', events:['prospect.created','deal.created'], secret:'sk_live_xxx', isActive:true, lastCall:'il y a 2 min', successRate:98.2 },
  { id:'2', name:'Slack Notifications', url:'https://hooks.slack.com/services/T00/B00/xxx', events:['deal.stage_changed','email.replied'], secret:'sk_live_yyy', isActive:true, lastCall:'il y a 1h', successRate:100 },
  { id:'3', name:'Zapier Integration', url:'https://hooks.zapier.com/hooks/catch/xxx', events:['prospect.created'], secret:'sk_live_zzz', isActive:false, lastCall:'il y a 3j', successRate:95.1 },
];

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState(MOCK);
  const [showSecret, setShowSecret] = useState<Record<string,boolean>>({});
  const [copied, setCopied] = useState<string|null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newWh, setNewWh] = useState({ name:'', url:'', events:[] as string[] });
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id); setTimeout(() => setCopied(null), 2000);
  };

  const toggleActive = (id: string) => setWebhooks(w => w.map(x => x.id === id ? { ...x, isActive: !x.isActive } : x));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Webhooks</h1><p className="text-sm text-gray-400 mt-0.5">Envoyez des événements GrowthOS vers vos services externes</p></div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium"><Plus className="w-4 h-4" /> Nouveau webhook</button>
      </div>

      {/* Endpoint inbound */}
      <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 mb-6">
        <div className="flex items-center gap-2 mb-2"><Zap className="w-4 h-4 text-teal-600" /><span className="font-medium text-teal-800 text-sm">Votre endpoint inbound</span></div>
        <div className="flex items-center gap-3">
          <code className="flex-1 text-xs bg-white border border-teal-200 rounded-xl px-3 py-2 text-gray-600">{API_BASE}/api/v1/inbound/webhook/[YOUR_TOKEN]</code>
          <button onClick={() => copy(`${API_BASE}/api/v1/inbound/webhook/token`, 'inbound')}
            className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 text-white rounded-xl text-sm">
            {copied==='inbound' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />} Copier
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {webhooks.map(wh => (
          <div key={wh.id} className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 flex-shrink-0"><Zap className="w-5 h-5" /></div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-semibold text-gray-900">{wh.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${wh.isActive?'bg-green-50 text-green-600':'bg-gray-100 text-gray-500'}`}>
                    {wh.isActive ? '● Actif' : '○ Inactif'}
                  </span>
                  <span className="text-xs text-gray-400">{wh.successRate}% succès</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <code className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-lg flex-1 truncate">{wh.url}</code>
                  <button onClick={() => copy(wh.url, `url-${wh.id}`)} className="text-gray-400 hover:text-gray-600">
                    {copied===`url-${wh.id}` ? <CheckCircle className="w-3.5 h-3.5 text-teal-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {wh.events.map(e => <span key={e} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{e}</span>)}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Secret:</span>
                  <code className="text-xs text-gray-500">{showSecret[wh.id] ? wh.secret : '••••••••••••'}</code>
                  <button onClick={() => setShowSecret(s => ({ ...s, [wh.id]: !s[wh.id] }))} className="text-gray-400 hover:text-gray-600">
                    {showSecret[wh.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <span className="text-xs text-gray-300 ml-2"><Clock className="w-3 h-3 inline mr-1" />{wh.lastCall}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => toggleActive(wh.id)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium ${wh.isActive?'bg-amber-50 text-amber-600':'bg-green-50 text-green-600'}`}>
                  {wh.isActive ? 'Désactiver' : 'Activer'}
                </button>
                <button onClick={() => setWebhooks(w => w.filter(x => x.id !== wh.id))} className="p-1.5 text-red-400 hover:bg-red-50 rounded-xl">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal create */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Nouveau webhook</h2>
            <div className="space-y-3 mb-4">
              <input placeholder="Nom" value={newWh.name} onChange={e => setNewWh(w => ({...w, name:e.target.value}))}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              <input placeholder="URL" value={newWh.url} onChange={e => setNewWh(w => ({...w, url:e.target.value}))}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Événements</p>
                <div className="flex flex-wrap gap-2">
                  {EVENTS.map(e => (
                    <button key={e} onClick={() => setNewWh(w => ({ ...w, events: w.events.includes(e) ? w.events.filter(x=>x!==e) : [...w.events, e] }))}
                      className={`text-xs px-2 py-1 rounded-full ${newWh.events.includes(e)?'bg-teal-600 text-white':'bg-gray-100 text-gray-500'}`}>{e}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Annuler</button>
              <button onClick={() => {
                setWebhooks(w => [...w, { id:Date.now().toString(), ...newWh, secret:`sk_live_${Math.random().toString(36).slice(2)}`, isActive:true, lastCall:'jamais', successRate:100 }]);
                setShowCreate(false); setNewWh({ name:'', url:'', events:[] });
              }} className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium">Créer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
