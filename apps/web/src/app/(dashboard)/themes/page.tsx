'use client';

import { useState, useEffect } from 'react';
import {
  Palette, Check, RefreshCw, AlertCircle, Loader2,
  Sun, Moon, Zap, Eye, CheckCircle, Paintbrush
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Theme {
  id: string;
  name: string;
  description?: string;
  primaryColor?: string;
  sidebarColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  isActive?: boolean;
  isDark?: boolean;
  preview?: {
    primary: string;
    sidebar: string;
    accent: string;
    background: string;
    text: string;
  };
}

// ─── Thèmes par défaut si API vide ────────────────────────────────────────────
const DEFAULT_THEMES: Theme[] = [
  {
    id: 'odoo',
    name: 'GrowthOS Default',
    description: 'Thème teal professionnel, inspiré des outils B2B modernes',
    isDark: false,
    preview: { primary: '#0D9488', sidebar: '#1E293B', accent: '#14B8A6', background: '#F8FAFC', text: '#1E293B' },
  },
  {
    id: 'dark',
    name: 'Dark Mode',
    description: 'Interface sombre pour travailler en conditions de faible luminosité',
    isDark: true,
    preview: { primary: '#14B8A6', sidebar: '#0F172A', accent: '#06B6D4', background: '#1E293B', text: '#F1F5F9' },
  },
  {
    id: 'light',
    name: 'Light Minimal',
    description: 'Interface claire et épurée pour une lisibilité maximale',
    isDark: false,
    preview: { primary: '#6366F1', sidebar: '#F1F5F9', accent: '#8B5CF6', background: '#FFFFFF', text: '#111827' },
  },
  {
    id: 'ocean',
    name: 'Ocean Blue',
    description: 'Palette bleue profonde inspirée des profondeurs marines',
    isDark: true,
    preview: { primary: '#3B82F6', sidebar: '#0C1931', accent: '#60A5FA', background: '#0F2744', text: '#E2E8F0' },
  },
  {
    id: 'forest',
    name: 'Forest Green',
    description: 'Tons verts naturels pour une atmosphère apaisante',
    isDark: false,
    preview: { primary: '#10B981', sidebar: '#064E3B', accent: '#34D399', background: '#F0FDF4', text: '#065F46' },
  },
  {
    id: 'sunset',
    name: 'Sunset Orange',
    description: 'Palette chaude et énergique pour booster la créativité',
    isDark: false,
    preview: { primary: '#F97316', sidebar: '#431407', accent: '#FB923C', background: '#FFF7ED', text: '#7C2D12' },
  },
];

// ─── Composant mini-preview du thème ─────────────────────────────────────────
function ThemePreview({ theme }: { theme: Theme }) {
  const p = theme.preview || {
    primary: theme.primaryColor || '#0D9488',
    sidebar: theme.sidebarColor || '#1E293B',
    accent: theme.accentColor || '#14B8A6',
    background: theme.backgroundColor || '#F8FAFC',
    text: '#1E293B',
  };

  return (
    <div
      className="w-full h-28 rounded-xl overflow-hidden border border-gray-200 flex"
      style={{ backgroundColor: p.background }}
    >
      {/* Sidebar simulée */}
      <div className="w-1/4 h-full flex flex-col gap-1.5 p-2" style={{ backgroundColor: p.sidebar }}>
        <div className="h-2 rounded-full opacity-60" style={{ backgroundColor: p.primary, width: '70%' }} />
        {[80, 60, 50, 65].map((w, i) => (
          <div key={i} className="h-1.5 rounded-full opacity-30 bg-white" style={{ width: `${w}%` }} />
        ))}
      </div>

      {/* Contenu simulé */}
      <div className="flex-1 p-3 flex flex-col gap-2">
        {/* Header bar */}
        <div className="flex items-center gap-2">
          <div className="h-2.5 rounded flex-1 opacity-20 bg-gray-400" />
          <div className="h-2.5 w-8 rounded" style={{ backgroundColor: p.primary }} />
        </div>
        {/* Cards simulées */}
        <div className="grid grid-cols-3 gap-1.5 flex-1">
          {[p.primary, p.accent, p.sidebar].map((color, i) => (
            <div
              key={i}
              className="rounded-lg flex items-end p-1"
              style={{ backgroundColor: color + '20', border: `1px solid ${color}30` }}
            >
              <div className="h-2 rounded-sm w-full" style={{ backgroundColor: color, opacity: 0.6 }} />
            </div>
          ))}
        </div>
        {/* Bouton simulé */}
        <div className="h-3 w-16 rounded-full self-end" style={{ backgroundColor: p.primary }} />
      </div>
    </div>
  );
}

// ─── Carte thème ──────────────────────────────────────────────────────────────
function ThemeCard({
  theme,
  onActivate,
  loading,
  activeId,
}: {
  theme: Theme;
  onActivate: (id: string) => void;
  loading: string | null;
  activeId: string | null;
}) {
  const isLoading = loading === theme.id;
  const isActive = theme.isActive || theme.id === activeId;

  return (
    <div className={`
      relative bg-white rounded-2xl border p-5 flex flex-col gap-4
      transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer
      ${isActive ? 'border-teal-400 ring-2 ring-teal-100 shadow-md' : 'border-gray-200'}
    `}
      onClick={() => !isActive && onActivate(theme.id)}
    >
      {/* Badge actif */}
      {isActive && (
        <div className="absolute top-3 right-3 flex items-center gap-1 text-xs font-semibold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">
          <Check className="w-3 h-3" /> Actif
        </div>
      )}

      {/* Badge dark/light */}
      <div className="absolute top-3 left-3">
        {theme.isDark
          ? <Moon className="w-3.5 h-3.5 text-gray-400" />
          : <Sun className="w-3.5 h-3.5 text-amber-400" />
        }
      </div>

      {/* Preview */}
      <div className="mt-3">
        <ThemePreview theme={theme} />
      </div>

      {/* Infos */}
      <div>
        <h3 className="font-semibold text-gray-900">{theme.name}</h3>
        {theme.description && (
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{theme.description}</p>
        )}
      </div>

      {/* Palette de couleurs */}
      <div className="flex gap-2">
        {[
          theme.preview?.primary || theme.primaryColor,
          theme.preview?.sidebar || theme.sidebarColor,
          theme.preview?.accent || theme.accentColor,
          theme.preview?.background || theme.backgroundColor,
        ].filter(Boolean).map((color, i) => (
          <div
            key={i}
            className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>

      {/* Bouton */}
      {isActive ? (
        <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-teal-50 text-teal-600 text-sm font-medium">
          <CheckCircle className="w-4 h-4" />
          Thème actuel
        </div>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); onActivate(theme.id); }}
          disabled={!!loading}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-teal-600 transition-all disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <><Zap className="w-4 h-4" /> Appliquer</>
          )}
        </button>
      )}
    </div>
  );
}

// ─── Page principale ───────────────────────────────────────────────────────────
export default function ThemesPage() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'light' | 'dark'>('all');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL || '';

  const getHeaders = () => {
    const token = localStorage.getItem('token') || localStorage.getItem('access_token') || '';
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchThemes = async () => {
    setFetching(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/v1/themes`, { headers: getHeaders() });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const list: Theme[] = Array.isArray(data) ? data : data.data || data.themes || [];

      // Fusionner avec les thèmes locaux (pour les previews visuels)
      const merged = DEFAULT_THEMES.map((def) => {
        const fromApi = list.find((t) => t.id === def.id || t.name === def.name);
        return fromApi ? { ...def, ...fromApi, preview: def.preview } : def;
      });

      // Ajouter les thèmes API non présents dans les défauts
      list.forEach((t) => {
        if (!merged.find((m) => m.id === t.id)) merged.push(t);
      });

      setThemes(merged.length > 0 ? merged : DEFAULT_THEMES);

      // Trouver le thème actif
      const active = list.find((t) => t.isActive);
      if (active) setActiveId(active.id);
    } catch {
      // En cas d'erreur API, utiliser les thèmes par défaut locaux
      setThemes(DEFAULT_THEMES);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => { fetchThemes(); }, []);

  const handleActivate = async (id: string) => {
    setLoading(id);
    try {
      const res = await fetch(`${API}/api/v1/themes/${id}/activate`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error();
      setActiveId(id);
      setThemes((prev) => prev.map((t) => ({ ...t, isActive: t.id === id })));
      showToast('Thème appliqué avec succès ✓');
    } catch {
      // Appliquer localement même si l'API échoue
      setActiveId(id);
      setThemes((prev) => prev.map((t) => ({ ...t, isActive: t.id === id })));
      showToast('Thème appliqué localement');
    } finally {
      setLoading(null);
    }
  };

  const filtered = themes.filter((t) => {
    if (filter === 'light') return !t.isDark;
    if (filter === 'dark') return t.isDark;
    return true;
  });

  const activeTheme = themes.find((t) => t.id === activeId || t.isActive);

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
      <div className="mb-8">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center">
              <Palette className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Thèmes</h1>
              <p className="text-sm text-gray-500">
                {activeTheme ? `Actif : ${activeTheme.name}` : 'Personnalisez l\'apparence de GrowthOS'}
              </p>
            </div>
          </div>
          <button
            onClick={fetchThemes}
            disabled={fetching}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Thème actif — bannière */}
      {activeTheme && (
        <div className="mb-6 bg-teal-600 rounded-2xl p-5 flex items-center gap-5 text-white">
          <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border-2 border-white/20">
            <ThemePreview theme={activeTheme} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider opacity-70 mb-1">Thème actuel</p>
            <h2 className="text-lg font-bold">{activeTheme.name}</h2>
            {activeTheme.description && (
              <p className="text-sm opacity-80 mt-0.5">{activeTheme.description}</p>
            )}
          </div>
          <div className="ml-auto">
            <div className="flex items-center gap-2 bg-white/20 rounded-xl px-4 py-2 text-sm font-medium">
              <Eye className="w-4 h-4" />
              Aperçu actif
            </div>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="flex gap-2 mb-6">
        {(['all', 'light', 'dark'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filter === f
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'
            }`}
          >
            {f === 'all' && <Paintbrush className="w-3.5 h-3.5" />}
            {f === 'light' && <Sun className="w-3.5 h-3.5" />}
            {f === 'dark' && <Moon className="w-3.5 h-3.5" />}
            {f === 'all' ? 'Tous' : f === 'light' ? 'Clairs' : 'Sombres'}
            <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs ml-1">
              {f === 'all' ? themes.length : themes.filter((t) => f === 'dark' ? t.isDark : !t.isDark).length}
            </span>
          </button>
        ))}
      </div>

      {/* Grille de thèmes */}
      {error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <AlertCircle className="w-12 h-12 text-red-400" />
          <p className="text-gray-500">{error}</p>
          <button onClick={fetchThemes} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm">
            Réessayer
          </button>
        </div>
      ) : fetching ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse">
              <div className="h-28 bg-gray-100 rounded-xl mb-4" />
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-full mb-4" />
              <div className="h-10 bg-gray-100 rounded-xl" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              onActivate={handleActivate}
              loading={loading}
              activeId={activeId}
            />
          ))}
        </div>
      )}

      {/* Info footer */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-600 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          <strong>Note :</strong> Le changement de thème s'applique à l'interface de GrowthOS.
          Certains thèmes personnalisés peuvent nécessiter un rechargement de la page pour être pleinement actifs.
        </div>
      </div>
    </div>
  );
}
