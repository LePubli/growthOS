'use client';
import { useState } from 'react';
import { Key, Plus, Copy, Trash2, Eye, EyeOff, CheckCircle, RefreshCw } from 'lucide-react';

const MOCK_KEYS = [
  { id:'1', name:'Production', key:'gos_live_xK9mP2qR...', prefix:'gos_live_', createdAt:'20 Mai 2026', lastUsed:'il y a 2h', requests:1247 },
  { id:'2', name:'Development', key:'gos_test_aB3nQ7wS...', prefix:'gos_test_', createdAt:'15 Mai 2026', lastUsed:'il y a 1j', requests:89 },
];

export default function SettingsApiPage() {
  const [keys, setKeys] = useState(MOCK_KEYS);
  const [show, setShow] = useState<Record<string,boolean>>({});
  const [copied, setCopied] = useState<string|null>(null);
  const [newName, setNewName] = useState('');

  const copy = (id: string, text: string) => { navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(null), 2000); };
  const create = () => {
    if (!newName) return;
    const newKey = `gos_live_${Math.random().toString(36).slice(2,18)}`;
    setKeys(k => [...k, { id:Date.now().toString(), name:newName, key:newKey, prefix:'gos_live_', createdAt:'Aujourd\'hui', lastUsed:'jamais', requests:0 }]);
    setNewName('');
  };

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  return (
    <div className="min-h-screen bg-gray-50 p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">API & Clés</h1>
      <p className="text-sm text-gray-400 mb-6">Gérez vos clés API pour intégrer GrowthOS dans vos applications</p>

      <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 mb-6">
        <h3 className="font-medium text-teal-800 text-sm mb-2">Base URL de l'API</h3>
        <div className="flex items-center gap-3">
          <code className="flex-1 text-xs bg-white border border-teal-200 rounded-xl px-3 py-2 text-gray-600">{API}/api/v1</code>
          <button onClick={() => copy('base', `${API}/api/v1`)} className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 text-white rounded-xl text-xs">
            {copied==='base' ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} Copier
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
        <h2 className="font-semibold text-gray-900 mb-4">Créer une clé API</h2>
        <div className="flex gap-3">
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nom de la clé (ex: Production)" className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          <button onClick={create} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium"><Plus className="w-4 h-4" />Créer</button>
        </div>
      </div>

      <div className="space-y-3">
        {keys.map(k => (
          <div key={k.id} className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">{k.name}</h3>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>Créée le {k.createdAt}</span>
                <span>·</span>
                <span>{k.requests.toLocaleString()} requêtes</span>
                <span>·</span>
                <span>Dernière utilisation: {k.lastUsed}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-gray-50 px-3 py-2 rounded-xl text-gray-600 font-mono">{show[k.id] ? k.key : k.prefix+'•'.repeat(24)}</code>
              <button onClick={() => setShow(s => ({...s,[k.id]:!s[k.id]}))} className="p-2 text-gray-400 hover:text-gray-600">{show[k.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
              <button onClick={() => copy(k.id, k.key)} className="p-2 text-gray-400 hover:text-teal-600">{copied===k.id ? <CheckCircle className="w-4 h-4 text-teal-600" /> : <Copy className="w-4 h-4" />}</button>
              <button onClick={() => setKeys(ks => ks.filter(x => x.id !== k.id))} className="p-2 text-gray-300 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
