'use client';

import { useState, useEffect } from 'react';
import {
  Package, Download, Trash2, ToggleLeft, ToggleRight,
  Search, Star, Zap, CheckCircle, AlertCircle, Loader2,
  Shield, BarChart2, Mail, Users, Globe, Brain, RefreshCw
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Plugin {
  name: string;
  displayName: string;
  description: string;
  version: string;
  author: string;
  category: string;
  icon?: string;
  tags?: string[];
  isActive?: boolean;
  isInstalled?: boolean;
  isPremium?: boolean;
  rating?: number;
  installs?: number;
}

// ─── Icônes par catégorie ─────────────────────────────────────────────────────
const categoryIcon: Record<string, React.ReactNode> = {
  crm:         <Users className="w-5 h-5" />,
  marketing:   <Mail className="w-5 h-5" />,
  analytics:   <BarChart2 className="w-5 h-5" />,
  prospecting: <Globe className="w-5 h-5" />,
  ai:          <Brain className="w-5 h-5" />,
  security:    <Shield className="w-5 h-5" />,
  automation:  <Zap className="w-5 h-5" />,
};

const categoryColor: Record<string, string> = {
  crm:         'bg-blue-100 text-blue-700',
  marketing:   'bg-purple-100 text-purple-700',
  analytics:   'bg-green-100 text-green-700',
  prospecting: 'bg-orange-100 text-orange-700',
  ai:          'bg-pink-100 text-pink-700',
  security:    'bg-red-100 text-red-700',
  automation:  'bg-yellow-100 text-yellow-700',
};

// ─── Composant carte plugin ────────────────────────────────────────────────────
function PluginCard({
  plugin,
  onToggle,
  onInstall,
  onUninstall,
  loading,
}: {
  plugin: Plugin;
  onToggle: (name: string) => void;
  onInstall: (name: string) => void;
  onUninstall: (name: string) => void;
  loading: string | null;
}) {
  const isLoading = loading === plugin.name;
  const cat = plugin.category?.toLowerCase() || 'automation';

  return (
    <div className={`
      relative bg-white rounded-2xl border p-6 flex flex-col gap-4
      transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5
      ${plugin.isActive ? 'border-teal-300 shadow-teal-50 shadow-md' : 'border-gray-200'}
    `}>
      {/* Badge actif */}
      {plugin.isActive && (
        <span className="absolute top-3 right-3 flex items-center gap-1 text-xs font-semibold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">
          <CheckCircle className="w-3 h-3" /> Actif
        </span>
      )}

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className={`
          w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0
          ${categoryColor[cat] || 'bg-gray-100 text-gray-600'}
        `}>
          {categoryIcon[cat] || <Package className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 truncate">
              {plugin.displayName || plugin.name}
            </h3>
            {plugin.isPremium && (
              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                PRO
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            v{plugin.version} · {plugin.author}
          </p>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 leading-relaxed flex-1">
        {plugin.description}
      </p>

      {/* Tags */}
      {plugin.tags && plugin.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {plugin.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Stats */}
      {(plugin.rating || plugin.installs) && (
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {plugin.rating && (
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              {plugin.rating}
            </span>
          )}
          {plugin.installs && (
            <span className="flex items-center gap-1">
              <Download className="w-3 h-3" />
              {plugin.installs.toLocaleString()} installs
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-gray-100">
        {plugin.isInstalled ? (
          <>
            <button
              onClick={() => onToggle(plugin.name)}
              disabled={isLoading}
              className={`
                flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg
                text-sm font-medium transition-all
                ${plugin.isActive
                  ? 'bg-teal-50 text-teal-600 hover:bg-teal-100'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }
              `}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : plugin.isActive ? (
                <><ToggleRight className="w-4 h-4" /> Désactiver</>
              ) : (
                <><ToggleLeft className="w-4 h-4" /> Activer</>
              )}
            </button>
            <button
              onClick={() => onUninstall(plugin.name)}
              disabled={isLoading}
              className="flex items-center justify-center gap-1 py-2 px-3 rounded-lg text-sm text-red-500 hover:bg-red-50 transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        ) : (
          <button
            onClick={() => onInstall(plugin.name)}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 transition-all disabled:opacity-60"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <><Download className="w-4 h-4" /> Installer</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Page principale ───────────────────────────────────────────────────────────
export default function PluginsPage() {
  const [marketplace, setMarketplace] = useState<Plugin[]>([]);
  const [installed, setInstalled] = useState<Plugin[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [tab, setTab] = useState<'marketplace' | 'installed'>('marketplace');
  const [loading, setLoading] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL || '';

  // Récupère le token depuis localStorage
  const getHeaders = () => {
    const token = localStorage.getItem('token') || localStorage.getItem('access_token') || '';
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Charger marketplace + installés
  const fetchAll = async () => {
    setFetching(true);
    setError(null);
    try {
      const [mktRes, instRes] = await Promise.all([
        fetch(`${API}/api/v1/plugins/marketplace`, { headers: getHeaders() }),
        fetch(`${API}/api/v1/plugins`, { headers: getHeaders() }),
      ]);

      if (!mktRes.ok) throw new Error('Erreur marketplace');
      const mktData = await mktRes.json();
      const mktPlugins: Plugin[] = Array.isArray(mktData)
        ? mktData
        : mktData.data || mktData.plugins || [];

      let instPlugins: Plugin[] = [];
      if (instRes.ok) {
        const instData = await instRes.json();
        instPlugins = Array.isArray(instData)
          ? instData
          : instData.data || instData.plugins || [];
      }

      const installedNames = new Set(instPlugins.map((p) => p.name));
      const activeNames = new Set(
        instPlugins.filter((p) => p.isActive).map((p) => p.name)
      );

      const enriched = mktPlugins.map((p) => ({
        ...p,
        isInstalled: installedNames.has(p.name),
        isActive: activeNames.has(p.name),
      }));

      setMarketplace(enriched);
      setInstalled(instPlugins);
    } catch (e) {
      setError('Impossible de charger les plugins. Vérifiez la connexion API.');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // Installer
  const handleInstall = async (name: string) => {
    setLoading(name);
    try {
      const res = await fetch(`${API}/api/v1/plugins/${name}/activate`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error();
      showToast(`Plugin "${name}" installé et activé ✓`);
      await fetchAll();
    } catch {
      showToast(`Échec de l'installation de "${name}"`, 'error');
    } finally {
      setLoading(null);
    }
  };

  // Toggle actif/inactif
  const handleToggle = async (name: string) => {
    setLoading(name);
    try {
      const res = await fetch(`${API}/api/v1/plugins/${name}/toggle`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error();
      const plugin = marketplace.find((p) => p.name === name);
      showToast(`Plugin "${name}" ${plugin?.isActive ? 'désactivé' : 'activé'} ✓`);
      await fetchAll();
    } catch {
      showToast(`Échec du toggle pour "${name}"`, 'error');
    } finally {
      setLoading(null);
    }
  };

  // Désinstaller
  const handleUninstall = async (name: string) => {
    if (!confirm(`Désinstaller le plugin "${name}" ?`)) return;
    setLoading(name);
    try {
      const res = await fetch(`${API}/api/v1/plugins/${name}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error();
      showToast(`Plugin "${name}" désinstallé`);
      await fetchAll();
    } catch {
      showToast(`Échec de la désinstallation`, 'error');
    } finally {
      setLoading(null);
    }
  };

  // Filtres
  const categories = ['all', ...Array.from(new Set(marketplace.map((p) => p.category?.toLowerCase()).filter(Boolean)))];

  const displayed = (tab === 'marketplace' ? marketplace : installed).filter((p) => {
    const matchSearch = !search ||
      p.displayName?.toLowerCase().includes(search.toLowerCase()) ||
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === 'all' || p.category?.toLowerCase() === category;
    return matchSearch && matchCat;
  });

  const activeCount = marketplace.filter((p) => p.isActive).length;
  const installedCount = marketplace.filter((p) => p.isInstalled).length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Toast */}
      {toast && (
        <div className={`
          fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium
          ${toast.type === 'success' ? 'bg-teal-600 text-white' : 'bg-red-500 text-white'}
        `}>
          {toast.type === 'success'
            ? <CheckCircle className="w-4 h-4" />
            : <AlertCircle className="w-4 h-4" />
          }
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-gray-900">Plugins</h1>
          <button
            onClick={fetchAll}
            disabled={fetching}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>
        <p className="text-gray-500 text-sm">
          {installedCount} installé{installedCount > 1 ? 's' : ''} · {activeCount} actif{activeCount > 1 ? 's' : ''}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
        {(['marketplace', 'installed'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'marketplace' ? '🛍 Marketplace' : `⚙️ Installés (${installedCount})`}
          </button>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un plugin..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-2 rounded-xl text-sm font-medium transition-all capitalize ${
                category === cat
                  ? 'bg-teal-600 text-white'
                  : 'bg-white text-gray-500 border border-gray-200 hover:border-teal-300'
              }`}
            >
              {cat === 'all' ? 'Tous' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Contenu */}
      {error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <AlertCircle className="w-12 h-12 text-red-400" />
          <p className="text-gray-500">{error}</p>
          <button onClick={fetchAll} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm">
            Réessayer
          </button>
        </div>
      ) : fetching ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 p-6 animate-pulse">
              <div className="flex gap-4 mb-4">
                <div className="w-12 h-12 bg-gray-200 rounded-xl" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
              <div className="h-3 bg-gray-100 rounded mb-2" />
              <div className="h-3 bg-gray-100 rounded w-4/5" />
            </div>
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Package className="w-12 h-12 text-gray-300" />
          <p className="text-gray-400 text-sm">Aucun plugin trouvé</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayed.map((plugin) => (
            <PluginCard
              key={plugin.name}
              plugin={plugin}
              onToggle={handleToggle}
              onInstall={handleInstall}
              onUninstall={handleUninstall}
              loading={loading}
            />
          ))}
        </div>
      )}
    </div>
  );
}
