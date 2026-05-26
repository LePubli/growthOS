'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Play, Pause, Trash2, Settings, Code, Activity, CheckCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';

export default function PluginDetailPage() {
  const { name } = useParams();
  const router = useRouter();
  const [plugin, setPlugin] = useState<any>(null);
  const [tab, setTab] = useState<'overview'|'config'|'logs'>('overview');
  const [config, setConfig] = useState<Record<string,string>>({});
  const [logs, setLogs] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const API = process.env.NEXT_PUBLIC_API_URL || '';

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const token = localStorage.getItem('access_token') || '';
        const [pRes, cRes] = await Promise.all([
          fetch(`${API}/api/v1/plugins/${name}`, { headers:{ Authorization:`Bearer ${token}` } }),
          fetch(`${API}/api/v1/plugins/${name}/config`, { headers:{ Authorization:`Bearer ${token}` } }),
        ]);
        if (pRes.ok) setPlugin(await pRes.json());
        if (cRes.ok) setConfig(await cRes.json());
      } catch {
        setPlugin({ name, displayName: String(name).replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase()), version:'1.0.0', author:'Le Publicitaire', description:'Plugin GrowthOS installé', category:'TOOLS', isActive:true, isInstalled:true });
      }
      setLogs([`[${new Date().toISOString()}] Plugin chargé`, `[${new Date().toISOString()}] onActivate() appelé`, `[${new Date().toISOString()}] En attente d'événements...`]);
    };
    fetch_();
  }, [name]);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('access_token') || '';
      await fetch(`${API}/api/v1/plugins/${name}/config`, { method:'PATCH', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`}, body:JSON.stringify(config) });
    } catch {} finally { setSaving(false); }
  };

  if (!plugin) return <div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-200 rounded-xl"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{plugin.displayName}</h1>
          <p className="text-sm text-gray-400">v{plugin.version} · {plugin.author}</p>
        </div>
        <div className="flex gap-2">
          <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${plugin.isActive?'bg-green-50 text-green-600':'bg-gray-100 text-gray-500'}`}>
            {plugin.isActive ? '● Actif' : '○ Inactif'}
          </span>
          <button className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${plugin.isActive?'bg-amber-50 text-amber-600':'bg-green-50 text-green-600'}`}>
            {plugin.isActive ? <><Pause className="w-4 h-4"/>Désactiver</> : <><Play className="w-4 h-4"/>Activer</>}
          </button>
          <button className="p-2 text-red-400 hover:bg-red-50 rounded-xl"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
        {[{k:'overview',l:'Vue d\'ensemble',i:<Activity className="w-4 h-4"/>},{k:'config',l:'Configuration',i:<Settings className="w-4 h-4"/>},{k:'logs',l:'Logs',i:<Code className="w-4 h-4"/>}].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab===t.k?'bg-white shadow text-gray-900':'text-gray-500 hover:text-gray-700'}`}>
            {t.i}{t.l}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Informations</h2>
            <dl className="space-y-3">
              {[['Nom',plugin.name],['Version',plugin.version],['Auteur',plugin.author],['Catégorie',plugin.category],['Description',plugin.description]].map(([k,v]) => (
                <div key={k as string} className="flex gap-4"><dt className="text-sm text-gray-400 w-24 flex-shrink-0">{k}</dt><dd className="text-sm text-gray-900">{v}</dd></div>
              ))}
            </dl>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Hooks actifs</h2>
            <div className="space-y-2">
              {['prospect.created','email.sent','workflow.triggered'].map(h => (
                <div key={h} className="flex items-center gap-2 p-2 bg-green-50 rounded-xl">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <code className="text-xs text-green-700 font-mono">{h}</code>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'config' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-lg">
          <h2 className="font-semibold text-gray-900 mb-4">Configuration</h2>
          {Object.keys(config).length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Settings className="w-10 h-10 mx-auto mb-2 text-gray-200" />
              <p className="text-sm">Aucune configuration disponible pour ce plugin</p>
              <p className="text-xs mt-1">Ajoutez des options dans votre plugin.yaml</p>
            </div>
          ) : (
            <>
              <div className="space-y-3 mb-4">
                {Object.entries(config).map(([k,v]) => (
                  <div key={k}>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{k}</label>
                    <input value={v as string} onChange={e => setConfig(c => ({...c,[k]:e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                ))}
              </div>
              <button onClick={saveConfig} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Sauvegarder
              </button>
            </>
          )}
        </div>
      )}

      {tab === 'logs' && (
        <div className="bg-gray-900 rounded-2xl p-5 font-mono">
          <div className="flex items-center justify-between mb-3">
            <span className="text-green-400 text-sm">● Live logs</span>
            <button onClick={() => setLogs(l => [...l, `[${new Date().toISOString()}] Actualisation...`])} className="text-gray-400 hover:text-white"><RefreshCw className="w-4 h-4" /></button>
          </div>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {logs.map((l,i) => <div key={i} className="text-xs text-gray-300">{l}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}
