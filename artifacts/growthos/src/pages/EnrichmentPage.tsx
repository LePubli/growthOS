import React, { useState, useEffect, useCallback } from 'react';
import {
  Database, Zap, Search, CheckCircle, XCircle, AlertCircle, RefreshCw,
  ChevronDown, ChevronUp, Globe, Building2, Users, BarChart2, Newspaper,
  Briefcase, Network, Key, ToggleLeft, ToggleRight, Clock, TrendingUp,
  Play, Loader2, Settings, Eye, Lock, Unlock, ArrowRight, Star
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

/* ── Types ── */
interface Source {
  id: string;
  name: string;
  type: 'api' | 'scrape' | 'rss';
  dataType: string;
  free: boolean;
  rateLimitPerMinute: number;
  description: string;
  isActive: boolean;
  hasKey: boolean;
  lastTestedAt: string | null;
  testStatus: string | null;
}

interface EnrichResult {
  score: number;
  signals: Array<{ type: string; title: string; description: string; source: string; impactScore: number }>;
  sourcesAttempted: number;
  sourcesSucceeded: number;
  sourcesFailed: number;
  results: Record<string, any>;
}

interface Prospect { id: string; company: string; firstName?: string; lastName?: string; email?: string; }
interface HistoryItem { id: string; startedAt: string; completedAt: string; status: string; sourcesAttempted: number; sourcesSucceeded: number; sourcesFailed: number; }

/* ── Helpers ── */
const DATA_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  legal:     { label: 'Légal',       icon: <Building2 size={14}/>,  color: 'blue'   },
  financial: { label: 'Financier',   icon: <BarChart2 size={14}/>,  color: 'green'  },
  digital:   { label: 'Digital',     icon: <Globe size={14}/>,      color: 'purple' },
  social:    { label: 'Social',      icon: <Users size={14}/>,      color: 'pink'   },
  news:      { label: 'Actualités',  icon: <Newspaper size={14}/>,  color: 'orange' },
  jobs:      { label: 'Emploi',      icon: <Briefcase size={14}/>,  color: 'amber'  },
  org_chart: { label: 'Organigramme',icon: <Network size={14}/>,    color: 'teal'   },
};

const SOURCE_TYPE_BADGE: Record<string, string> = {
  api: 'bg-blue-100 text-blue-700',
  scrape: 'bg-purple-100 text-purple-700',
  rss: 'bg-orange-100 text-orange-700',
};

function SignalBadge({ type, impactScore }: { type: string; impactScore: number }) {
  const colors: Record<string, string> = {
    hiring: 'bg-green-100 text-green-700 border-green-200',
    funding: 'bg-blue-100 text-blue-700 border-blue-200',
    leadership_change: 'bg-amber-100 text-amber-700 border-amber-200',
    tech_investment: 'bg-purple-100 text-purple-700 border-purple-200',
    media_positive: 'bg-teal-100 text-teal-700 border-teal-200',
    expansion: 'bg-orange-100 text-orange-700 border-orange-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colors[type] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}>
      <Zap size={10}/> {impactScore}pts
    </span>
  );
}

/* ── Main Page ── */
export default function EnrichmentPage() {
  const [tab, setTab] = useState<'config' | 'enrich' | 'signals'>('config');
  const [sources, setSources] = useState<Source[]>([]);
  const [loadingSources, setLoadingSources] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [keyInputs, setKeyInputs] = useState<Record<string, { apiKey: string; apiSecret: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  // Enrich tab
  const [prospectSearch, setProspectSearch] = useState('');
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichResult, setEnrichResult] = useState<EnrichResult | null>(null);
  const [resultTab, setResultTab] = useState('legal');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Signals tab
  const [recentSignals, setRecentSignals] = useState<any[]>([]);

  /* Load sources */
  const loadSources = useCallback(async () => {
    setLoadingSources(true);
    try {
      const data = await apiClient.get('/enrich/sources') as Source[];
      setSources(data);
    } catch { setSources([]); } finally { setLoadingSources(false); }
  }, []);

  useEffect(() => { loadSources(); }, [loadSources]);

  /* Search prospects */
  useEffect(() => {
    if (!prospectSearch.trim()) { setProspects([]); return; }
    const t = setTimeout(async () => {
      try {
        const data = await apiClient.get('/prospects', { params: { search: prospectSearch, limit: '10' } }) as any;
        setProspects(Array.isArray(data) ? data : data?.data ?? []);
      } catch { setProspects([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [prospectSearch]);

  /* Load history when prospect selected */
  useEffect(() => {
    if (!selectedProspect) { setHistory([]); return; }
    setLoadingHistory(true);
    apiClient.get(`/enrich/history/${selectedProspect.id}`)
      .then((d: any) => setHistory(Array.isArray(d) ? d : []))
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  }, [selectedProspect]);

  /* Save API config */
  const saveConfig = async (sourceId: string) => {
    const inp = keyInputs[sourceId] ?? {};
    setSaving(sourceId);
    try {
      await apiClient.put(`/enrich/api-config/${sourceId}`, { apiKey: inp.apiKey || undefined, apiSecret: inp.apiSecret || undefined, isActive: true });
      toast.success('Configuration sauvegardée');
      setExpanded(null);
      loadSources();
    } catch { toast.error('Erreur lors de la sauvegarde'); } finally { setSaving(null); }
  };

  /* Test connection */
  const testConnection = async (sourceId: string) => {
    setTesting(sourceId);
    try {
      const r = await apiClient.post(`/enrich/test-connection/${sourceId}`, {}) as any;
      if (r.ok) toast.success(`${sourceId}: ${r.message}`);
      else toast.warning(`${sourceId}: ${r.message}`);
      loadSources();
    } catch { toast.error('Erreur de connexion'); } finally { setTesting(null); }
  };

  /* Toggle source */
  const toggleSource = async (source: Source) => {
    setToggling(source.id);
    try {
      await apiClient.put(`/enrich/api-config/${source.id}`, { isActive: !source.isActive });
      loadSources();
    } catch {} finally { setToggling(null); }
  };

  /* Enrich prospect */
  const runEnrich = async () => {
    if (!selectedProspect) return;
    setEnriching(true);
    setEnrichResult(null);
    try {
      const r = await apiClient.post(`/enrich/${selectedProspect.id}`, {}) as EnrichResult;
      setEnrichResult(r);
      if (r.signals.length > 0) setRecentSignals(prev => [...r.signals, ...prev].slice(0, 50));
      toast.success(`Enrichissement terminé — score ${r.score}/100`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Erreur d\'enrichissement');
    } finally {
      setEnriching(false);
      // Refresh history
      const hist = await apiClient.get(`/enrich/history/${selectedProspect.id}`).catch(() => []) as any;
      setHistory(Array.isArray(hist) ? hist : []);
    }
  };

  /* ─── SECTION: CONFIG ─── */
  const freeCount = sources.filter(s => s.free).length;
  const paidWithKey = sources.filter(s => !s.free && s.hasKey).length;
  const activeCount = sources.filter(s => s.isActive).length;

  const renderConfigTab = () => (
    <div>
      {/* Stats banner */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Sources actives', value: activeCount, color: 'teal' },
          { label: 'Gratuites', value: freeCount, color: 'green' },
          { label: 'Payantes configurées', value: paidWithKey, color: 'blue' },
        ].map(s => (
          <div key={s.label} className={`bg-${s.color}-50 border border-${s.color}-100 rounded-xl p-4`}>
            <p className={`text-2xl font-bold text-${s.color}-700`}>{loadingSources ? '…' : s.value}</p>
            <p className={`text-sm text-${s.color}-600`}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Sources list */}
      {loadingSources ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-gray-300"/></div>
      ) : (
        <div className="space-y-2">
          {Object.entries(DATA_TYPE_LABELS).map(([dtype, meta]) => {
            const group = sources.filter(s => s.dataType === dtype);
            if (!group.length) return null;
            return (
              <div key={dtype} className="mb-4">
                <div className={`flex items-center gap-2 mb-2 text-sm font-semibold text-${meta.color}-700`}>
                  {meta.icon} {meta.label}
                  <span className="text-xs font-normal text-gray-400">({group.length})</span>
                </div>
                <div className="space-y-1">
                  {group.map(src => (
                    <div key={src.id} className={`border rounded-xl transition-all ${expanded === src.id ? 'border-teal-300 bg-teal-50/30' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpanded(expanded === src.id ? null : src.id)}>
                        {/* Toggle */}
                        <button
                          onClick={e => { e.stopPropagation(); toggleSource(src); }}
                          disabled={toggling === src.id}
                          className="flex-shrink-0"
                          title={src.isActive ? 'Désactiver' : 'Activer'}
                        >
                          {toggling === src.id
                            ? <Loader2 size={18} className="animate-spin text-gray-400"/>
                            : src.isActive
                              ? <ToggleRight size={18} className="text-teal-500"/>
                              : <ToggleLeft size={18} className="text-gray-300"/>}
                        </button>
                        {/* Name */}
                        <span className={`text-sm font-medium flex-1 ${src.isActive ? 'text-gray-900' : 'text-gray-400'}`}>{src.name}</span>
                        {/* Badges */}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SOURCE_TYPE_BADGE[src.type]}`}>{src.type}</span>
                        {src.free
                          ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Gratuit</span>
                          : src.hasKey
                            ? <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium"><Unlock size={10}/>Configuré</span>
                            : <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium"><Lock size={10}/>Clé requise</span>}
                        {/* Test status */}
                        {src.testStatus === 'ok' && <CheckCircle size={14} className="text-green-500"/>}
                        {src.testStatus === 'no_key' && <AlertCircle size={14} className="text-amber-400"/>}
                        {/* Expand arrow */}
                        {expanded === src.id ? <ChevronUp size={14} className="text-gray-400"/> : <ChevronDown size={14} className="text-gray-400"/>}
                      </div>
                      {/* Expanded config panel */}
                      {expanded === src.id && (
                        <div className="px-4 pb-4 border-t border-gray-100 mt-1 pt-3">
                          <p className="text-xs text-gray-500 mb-3">{src.description}</p>
                          {!src.free && (
                            <div className="space-y-2 mb-3">
                              <div>
                                <label className="text-xs font-medium text-gray-600 block mb-1">API Key</label>
                                <input
                                  type="password"
                                  placeholder="sk-•••••••••••••••"
                                  value={keyInputs[src.id]?.apiKey ?? ''}
                                  onChange={e => setKeyInputs(prev => ({ ...prev, [src.id]: { ...prev[src.id], apiKey: e.target.value } }))}
                                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-gray-600 block mb-1">API Secret <span className="text-gray-400">(optionnel)</span></label>
                                <input
                                  type="password"
                                  placeholder="secret"
                                  value={keyInputs[src.id]?.apiSecret ?? ''}
                                  onChange={e => setKeyInputs(prev => ({ ...prev, [src.id]: { ...prev[src.id], apiSecret: e.target.value } }))}
                                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                                />
                              </div>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => testConnection(src.id)}
                              disabled={testing === src.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
                            >
                              {testing === src.id ? <Loader2 size={12} className="animate-spin"/> : <Play size={12}/>}
                              Tester la connexion
                            </button>
                            {!src.free && (
                              <button
                                onClick={() => saveConfig(src.id)}
                                disabled={saving === src.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700 disabled:opacity-50"
                              >
                                {saving === src.id ? <Loader2 size={12} className="animate-spin"/> : <Key size={12}/>}
                                Sauvegarder la clé
                              </button>
                            )}
                            <span className="text-xs text-gray-400 ml-auto">
                              <Clock size={10} className="inline mr-1"/>{src.rateLimitPerMinute} req/min
                            </span>
                          </div>
                          {src.lastTestedAt && (
                            <p className="text-xs text-gray-400 mt-2">
                              Dernier test : {new Date(src.lastTestedAt).toLocaleString('fr-FR')}
                              {src.testStatus === 'ok' ? ' ✓' : ' ✗'}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  /* ─── SECTION: ENRICH ─── */
  const renderEnrichTab = () => (
    <div className="space-y-6">
      {/* Prospect selector */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Search size={15}/> Sélectionner un prospect
        </h3>
        <div className="relative">
          <input
            value={prospectSearch}
            onChange={e => setProspectSearch(e.target.value)}
            placeholder="Rechercher par entreprise, nom, email…"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          {prospects.length > 0 && !selectedProspect && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
              {prospects.map(p => (
                <button key={p.id} onClick={() => { setSelectedProspect(p); setProspectSearch(p.company || `${p.firstName} ${p.lastName}`); setProspects([]); }}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 border-b border-gray-50 last:border-0">
                  <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs font-bold flex-shrink-0">
                    {(p.company || p.firstName || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.company || `${p.firstName} ${p.lastName}`}</p>
                    {p.email && <p className="text-xs text-gray-400">{p.email}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        {selectedProspect && (
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 flex items-center gap-3 p-3 bg-teal-50 border border-teal-200 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center text-white text-sm font-bold">
                {(selectedProspect.company || selectedProspect.firstName || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">{selectedProspect.company || `${selectedProspect.firstName} ${selectedProspect.lastName}`}</p>
                {selectedProspect.email && <p className="text-xs text-gray-500">{selectedProspect.email}</p>}
              </div>
              <button onClick={() => { setSelectedProspect(null); setProspectSearch(''); setEnrichResult(null); }}
                className="text-xs text-gray-400 hover:text-gray-600">Changer</button>
            </div>
            <button onClick={runEnrich} disabled={enriching}
              className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors shadow-sm">
              {enriching ? <Loader2 size={15} className="animate-spin"/> : <Zap size={15}/>}
              {enriching ? 'Enrichissement…' : 'Enrichir maintenant'}
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      {enrichResult && (
        <div className="space-y-4">
          {/* Score + stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-1 bg-gradient-to-br from-teal-500 to-teal-700 text-white rounded-xl p-4 flex flex-col items-center justify-center">
              <Star size={20} className="mb-1 opacity-80"/>
              <p className="text-3xl font-bold">{enrichResult.score}</p>
              <p className="text-xs opacity-80">Score / 100</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{enrichResult.sourcesAttempted}</p>
              <p className="text-xs text-gray-500">Sources</p>
            </div>
            <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{enrichResult.sourcesSucceeded}</p>
              <p className="text-xs text-green-600">Succès</p>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{enrichResult.sourcesFailed}</p>
              <p className="text-xs text-red-500">Échecs</p>
            </div>
          </div>

          {/* Signals */}
          {enrichResult.signals.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
                <Zap size={14}/> {enrichResult.signals.length} signal{enrichResult.signals.length > 1 ? 's' : ''} détecté{enrichResult.signals.length > 1 ? 's' : ''}
              </h4>
              <div className="space-y-2">
                {enrichResult.signals.map((sig, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <SignalBadge type={sig.type} impactScore={sig.impactScore}/>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{sig.title}</p>
                      <p className="text-xs text-gray-500">{sig.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data tabs */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex border-b border-gray-100 bg-gray-50">
              {Object.entries(DATA_TYPE_LABELS).map(([k, v]) => {
                const hasData = enrichResult.results[k];
                return (
                  <button key={k} onClick={() => setResultTab(k)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                      resultTab === k ? 'border-teal-500 text-teal-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'
                    } ${!hasData ? 'opacity-40' : ''}`}>
                    {v.icon} {v.label}
                  </button>
                );
              })}
            </div>
            <div className="p-4 max-h-64 overflow-y-auto">
              {enrichResult.results[resultTab] ? (
                <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono bg-gray-50 rounded-lg p-3 overflow-x-auto">
                  {JSON.stringify(enrichResult.results[resultTab], null, 2)}
                </pre>
              ) : (
                <p className="text-sm text-gray-400 text-center py-8">Aucune donnée disponible pour cette catégorie</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* History */}
      {selectedProspect && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Clock size={14}/> Historique</h4>
            {loadingHistory && <Loader2 size={14} className="animate-spin text-gray-400"/>}
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Aucun enrichissement effectué</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {history.map(h => (
                <div key={h.id} className="flex items-center gap-4 px-4 py-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${h.status === 'completed' ? 'bg-green-400' : h.status === 'failed' ? 'bg-red-400' : 'bg-amber-400'}`}/>
                  <div className="flex-1">
                    <p className="text-sm text-gray-700">{new Date(h.startedAt).toLocaleString('fr-FR')}</p>
                    <p className="text-xs text-gray-400">{h.sourcesSucceeded}/{h.sourcesAttempted} sources réussies</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    h.status === 'completed' ? 'bg-green-100 text-green-700' :
                    h.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>{h.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  /* ─── SECTION: SIGNALS ─── */
  const renderSignalsTab = () => (
    <div>
      <p className="text-sm text-gray-500 mb-4">Signaux faibles détectés lors des enrichissements de cette session.</p>
      {recentSignals.length === 0 ? (
        <div className="text-center py-16">
          <Zap size={40} className="mx-auto text-gray-200 mb-3"/>
          <p className="text-gray-400 text-sm">Aucun signal détecté pour l'instant.</p>
          <p className="text-gray-300 text-xs mt-1">Enrichissez un prospect pour générer des signaux.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recentSignals.map((sig, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Zap size={14} className="text-amber-600"/>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-semibold text-gray-900">{sig.title}</p>
                  <SignalBadge type={sig.type} impactScore={sig.impactScore}/>
                </div>
                <p className="text-xs text-gray-500">{sig.description}</p>
                <p className="text-xs text-gray-300 mt-0.5">via {sig.source}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  /* ─── RENDER ─── */
  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Database size={22} className="text-teal-600"/> Data Enrichment Engine
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">23 sources · API + Scraping + RSS · Signaux faibles automatiques</p>
        </div>
        <button onClick={loadSources} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
          <RefreshCw size={16}/>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6 w-fit">
        {([
          { key: 'config', label: 'Configuration APIs', icon: <Settings size={14}/> },
          { key: 'enrich', label: 'Enrichissement', icon: <Zap size={14}/> },
          { key: 'signals', label: `Signaux${recentSignals.length ? ` (${recentSignals.length})` : ''}`, icon: <TrendingUp size={14}/> },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'config' && renderConfigTab()}
      {tab === 'enrich' && renderEnrichTab()}
      {tab === 'signals' && renderSignalsTab()}
    </div>
  );
}
