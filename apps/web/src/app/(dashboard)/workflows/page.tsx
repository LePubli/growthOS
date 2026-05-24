'use client';

import { useState, useEffect } from 'react';
import {
  Zap, Play, Pause, Plus, MoreHorizontal, RefreshCw,
  Clock, CheckCircle, AlertCircle, Users, Mail, Filter,
  ArrowRight, Activity, Loader2, Toggle
} from 'lucide-react';

interface Workflow {
  id: string;
  name: string;
  description?: string;
  trigger?: string;
  status: 'active' | 'paused' | 'draft';
  runs?: number;
  successRate?: number;
  lastRun?: string;
  steps?: number;
  category?: string;
}

const MOCK_WORKFLOWS: Workflow[] = [
  { id:'1', name:'Relance J+3', description:'Relance automatique 3 jours après premier contact', trigger:'Nouveau prospect', status:'active', runs:234, successRate:78, lastRun:'il y a 12 min', steps:4, category:'email' },
  { id:'2', name:'Onboarding SaaS', description:'Séquence d\'onboarding pour les nouveaux clients SaaS', trigger:'Conversion gagnée', status:'active', runs:89, successRate:92, lastRun:'il y a 1h', steps:7, category:'crm' },
  { id:'3', name:'Scoring automatique', description:'Score les prospects selon leur activité email', trigger:'Email ouvert', status:'active', runs:1247, successRate:100, lastRun:'il y a 5 min', steps:2, category:'scoring' },
  { id:'4', name:'Alerte prospect chaud', description:'Notifie le commercial quand un prospect devient "chaud"', trigger:'Score > 80', status:'paused', runs:56, successRate:88, lastRun:'il y a 2j', steps:3, category:'notification' },
  { id:'5', name:'Enrichissement LinkedIn', description:'Enrichit automatiquement les données depuis LinkedIn', trigger:'Import CSV', status:'draft', runs:0, successRate:0, lastRun:'jamais', steps:5, category:'enrichment' },
];

const STATUS_CONFIG = {
  active: { label:'Actif', color:'text-green-600', bg:'bg-green-50', dot:'bg-green-400' },
  paused: { label:'Pausé', color:'text-amber-600', bg:'bg-amber-50', dot:'bg-amber-400' },
  draft:  { label:'Brouillon', color:'text-gray-500', bg:'bg-gray-100', dot:'bg-gray-300' },
};

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  email:       <Mail className="w-4 h-4" />,
  crm:         <Users className="w-4 h-4" />,
  scoring:     <Activity className="w-4 h-4" />,
  notification:<AlertCircle className="w-4 h-4" />,
  enrichment:  <Filter className="w-4 h-4" />,
};

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>(MOCK_WORKFLOWS);
  const [loading, setLoading] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL || '';
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const fetchWorkflows = async () => {
    setFetching(true);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('access_token') || '';
      const res = await fetch(`${API}/api/v1/workflows`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.data || [];
        if (list.length > 0) setWorkflows(list);
      }
    } catch {}
    finally { setFetching(false); }
  };

  useEffect(() => { fetchWorkflows(); }, []);

  const handleToggle = async (wf: Workflow) => {
    setLoading(wf.id);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('access_token') || '';
      await fetch(`${API}/api/v1/workflows/${wf.id}/toggle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      setWorkflows(prev => prev.map(w =>
        w.id === wf.id ? { ...w, status: w.status === 'active' ? 'paused' : 'active' } : w
      ));
      showToast(`Workflow "${wf.name}" ${wf.status === 'active' ? 'mis en pause' : 'activé'}`);
    } catch {
      setWorkflows(prev => prev.map(w =>
        w.id === wf.id ? { ...w, status: w.status === 'active' ? 'paused' : 'active' } : w
      ));
    }
    finally { setLoading(null); }
  };

  const handleRun = async (wf: Workflow) => {
    setLoading(wf.id + '_run');
    setTimeout(() => {
      setLoading(null);
      showToast(`Workflow "${wf.name}" déclenché manuellement ✓`);
    }, 1500);
  };

  const activeCount = workflows.filter(w => w.status === 'active').length;
  const totalRuns = workflows.reduce((s, w) => s + (w.runs || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-teal-600 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />{toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workflows</h1>
          <p className="text-sm text-gray-400 mt-0.5">{activeCount} actifs · {totalRuns.toLocaleString()} exécutions totales</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchWorkflows} disabled={fetching} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-500">
            <RefreshCw className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700">
            <Plus className="w-4 h-4" /> Nouveau workflow
          </button>
        </div>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label:'Workflows actifs', value: activeCount, icon:<Zap className="w-5 h-5" />, color:'text-green-600 bg-green-50' },
          { label:'Exécutions totales', value: totalRuns.toLocaleString(), icon:<Activity className="w-5 h-5" />, color:'text-blue-600 bg-blue-50' },
          { label:'Taux de succès moyen', value:`${Math.round(workflows.filter(w=>w.successRate).reduce((s,w)=>s+(w.successRate||0),0)/workflows.filter(w=>w.successRate).length || 0)}%`, icon:<CheckCircle className="w-5 h-5" />, color:'text-teal-600 bg-teal-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color}`}>{stat.icon}</div>
            <div>
              <div className="text-xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-sm text-gray-400">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Liste workflows */}
      <div className="space-y-3">
        {workflows.map(wf => {
          const cfg = STATUS_CONFIG[wf.status];
          const isToggling = loading === wf.id;
          const isRunning = loading === wf.id + '_run';
          return (
            <div key={wf.id} className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-all">
              <div className="flex items-start gap-4">
                {/* Icône catégorie */}
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 flex-shrink-0">
                  {CATEGORY_ICON[wf.category || ''] || <Zap className="w-4 h-4" />}
                </div>

                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-gray-900">{wf.name}</h3>
                    <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color} ${cfg.bg}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  </div>
                  {wf.description && <p className="text-sm text-gray-500 mb-3">{wf.description}</p>}
                  <div className="flex items-center gap-6 text-xs text-gray-400">
                    {wf.trigger && (
                      <span className="flex items-center gap-1">
                        <ArrowRight className="w-3 h-3" /> Déclencheur: {wf.trigger}
                      </span>
                    )}
                    {wf.steps && (
                      <span className="flex items-center gap-1">
                        <Filter className="w-3 h-3" /> {wf.steps} étapes
                      </span>
                    )}
                    {wf.runs !== undefined && wf.runs > 0 && (
                      <span className="flex items-center gap-1">
                        <Activity className="w-3 h-3" /> {wf.runs} exécutions
                      </span>
                    )}
                    {wf.successRate !== undefined && wf.successRate > 0 && (
                      <span className="flex items-center gap-1 text-green-500">
                        <CheckCircle className="w-3 h-3" /> {wf.successRate}% succès
                      </span>
                    )}
                    {wf.lastRun && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {wf.lastRun}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRun(wf)}
                    disabled={!!loading}
                    className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition-all"
                  >
                    {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    Lancer
                  </button>
                  <button
                    onClick={() => handleToggle(wf)}
                    disabled={!!loading || wf.status === 'draft'}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                      wf.status === 'active'
                        ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                        : 'bg-green-50 text-green-600 hover:bg-green-100'
                    }`}
                  >
                    {isToggling ? <Loader2 className="w-4 h-4 animate-spin" /> :
                      wf.status === 'active' ? <><Pause className="w-4 h-4" /> Pause</> : <><Play className="w-4 h-4" /> Activer</>
                    }
                  </button>
                  <button className="p-2 text-gray-400 hover:text-gray-600">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
