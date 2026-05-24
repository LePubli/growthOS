'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ThemeTokens {
  '--color-primary':       string;
  '--color-primary-light': string;
  '--color-primary-dark':  string;
  '--color-accent':        string;
  '--sidebar-bg':          string;
  '--sidebar-text':        string;
  '--sidebar-hover':       string;
  '--body-bg':             string;
  '--card-bg':             string;
  '--card-border':         string;
  '--text-primary':        string;
  '--text-secondary':      string;
  '--text-muted':          string;
  '--radius-card':         string;
  '--font-sans':           string;
}

export interface Theme {
  id:          string;
  name:        string;
  description?: string;
  isDark:      boolean;
  tokens:      ThemeTokens;
}

interface ThemeContextValue {
  theme:     Theme;
  themes:    Theme[];
  setTheme:  (id: string) => Promise<void>;
  isLoading: boolean;
}

// ─── Thèmes intégrés (fallback si API non dispo) ──────────────────────────────
export const BUILT_IN_THEMES: Theme[] = [
  {
    id: 'default', name: 'GrowthOS Default', isDark: false,
    tokens: {
      '--color-primary':       '#0D9488',
      '--color-primary-light': '#CCFBF1',
      '--color-primary-dark':  '#0F766E',
      '--color-accent':        '#14B8A6',
      '--sidebar-bg':          '#1E293B',
      '--sidebar-text':        '#CBD5E1',
      '--sidebar-hover':       '#334155',
      '--body-bg':             '#F8FAFC',
      '--card-bg':             '#FFFFFF',
      '--card-border':         '#E2E8F0',
      '--text-primary':        '#0F172A',
      '--text-secondary':      '#475569',
      '--text-muted':          '#94A3B8',
      '--radius-card':         '1rem',
      '--font-sans':           'Inter, system-ui, sans-serif',
    },
  },
  {
    id: 'dark', name: 'Dark Mode', isDark: true,
    tokens: {
      '--color-primary':       '#14B8A6',
      '--color-primary-light': '#0F3D3A',
      '--color-primary-dark':  '#0D9488',
      '--color-accent':        '#06B6D4',
      '--sidebar-bg':          '#0F172A',
      '--sidebar-text':        '#94A3B8',
      '--sidebar-hover':       '#1E293B',
      '--body-bg':             '#1E293B',
      '--card-bg':             '#0F172A',
      '--card-border':         '#334155',
      '--text-primary':        '#F1F5F9',
      '--text-secondary':      '#CBD5E1',
      '--text-muted':          '#64748B',
      '--radius-card':         '1rem',
      '--font-sans':           'Inter, system-ui, sans-serif',
    },
  },
  {
    id: 'ocean', name: 'Ocean Blue', isDark: true,
    tokens: {
      '--color-primary':       '#3B82F6',
      '--color-primary-light': '#1E3A5F',
      '--color-primary-dark':  '#2563EB',
      '--color-accent':        '#60A5FA',
      '--sidebar-bg':          '#0C1931',
      '--sidebar-text':        '#93C5FD',
      '--sidebar-hover':       '#1E3A5F',
      '--body-bg':             '#0F2744',
      '--card-bg':             '#0C1931',
      '--card-border':         '#1E3A5F',
      '--text-primary':        '#EFF6FF',
      '--text-secondary':      '#BFDBFE',
      '--text-muted':          '#60A5FA',
      '--radius-card':         '0.75rem',
      '--font-sans':           'Inter, system-ui, sans-serif',
    },
  },
  {
    id: 'forest', name: 'Forest Green', isDark: false,
    tokens: {
      '--color-primary':       '#10B981',
      '--color-primary-light': '#D1FAE5',
      '--color-primary-dark':  '#059669',
      '--color-accent':        '#34D399',
      '--sidebar-bg':          '#064E3B',
      '--sidebar-text':        '#6EE7B7',
      '--sidebar-hover':       '#065F46',
      '--body-bg':             '#F0FDF4',
      '--card-bg':             '#FFFFFF',
      '--card-border':         '#D1FAE5',
      '--text-primary':        '#064E3B',
      '--text-secondary':      '#065F46',
      '--text-muted':          '#6B7280',
      '--radius-card':         '1.25rem',
      '--font-sans':           'Inter, system-ui, sans-serif',
    },
  },
  {
    id: 'sunset', name: 'Sunset Orange', isDark: false,
    tokens: {
      '--color-primary':       '#F97316',
      '--color-primary-light': '#FED7AA',
      '--color-primary-dark':  '#EA580C',
      '--color-accent':        '#FB923C',
      '--sidebar-bg':          '#431407',
      '--sidebar-text':        '#FED7AA',
      '--sidebar-hover':       '#7C2D12',
      '--body-bg':             '#FFF7ED',
      '--card-bg':             '#FFFFFF',
      '--card-border':         '#FED7AA',
      '--text-primary':        '#431407',
      '--text-secondary':      '#7C2D12',
      '--text-muted':          '#9CA3AF',
      '--radius-card':         '1rem',
      '--font-sans':           'Inter, system-ui, sans-serif',
    },
  },
  {
    id: 'minimal', name: 'Light Minimal', isDark: false,
    tokens: {
      '--color-primary':       '#6366F1',
      '--color-primary-light': '#EEF2FF',
      '--color-primary-dark':  '#4F46E5',
      '--color-accent':        '#8B5CF6',
      '--sidebar-bg':          '#F8FAFC',
      '--sidebar-text':        '#475569',
      '--sidebar-hover':       '#E2E8F0',
      '--body-bg':             '#FFFFFF',
      '--card-bg':             '#FFFFFF',
      '--card-border':         '#E2E8F0',
      '--text-primary':        '#111827',
      '--text-secondary':      '#374151',
      '--text-muted':          '#9CA3AF',
      '--radius-card':         '0.5rem',
      '--font-sans':           'Inter, system-ui, sans-serif',
    },
  },
];

// ─── Applique les CSS variables sur :root ─────────────────────────────────────
function applyTokens(tokens: ThemeTokens, isDark: boolean) {
  const root = document.documentElement;
  Object.entries(tokens).forEach(([key, val]) => {
    root.style.setProperty(key, val);
  });
  root.setAttribute('data-theme', isDark ? 'dark' : 'light');
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

// ─── Persistance locale ───────────────────────────────────────────────────────
const STORAGE_KEY = 'growthos-theme-id';

function getStoredThemeId(): string {
  if (typeof window === 'undefined') return 'default';
  return localStorage.getItem(STORAGE_KEY) || 'default';
}

function storeThemeId(id: string) {
  if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, id);
}

// ─── Context ──────────────────────────────────────────────────────────────────
const ThemeContext = createContext<ThemeContextValue>({
  theme: BUILT_IN_THEMES[0],
  themes: BUILT_IN_THEMES,
  setTheme: async () => {},
  isLoading: false,
});

export function useTheme() {
  return useContext(ThemeContext);
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themes, setThemes]   = useState<Theme[]>(BUILT_IN_THEMES);
  const [current, setCurrent] = useState<Theme>(BUILT_IN_THEMES[0]);
  const [isLoading, setIsLoading] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL || '';

  // Charge les thèmes depuis l'API et fusionne avec les built-in
  const loadThemes = useCallback(async () => {
    try {
      const token = typeof window !== 'undefined'
        ? (localStorage.getItem('token') || localStorage.getItem('access_token') || '')
        : '';
      const res = await fetch(`${API}/api/v1/themes`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const data = await res.json();
      const apiThemes: any[] = Array.isArray(data) ? data : data.data || [];

      // Fusionner : les thèmes API enrichissent les built-in avec les tokens custom
      const merged = BUILT_IN_THEMES.map(bt => {
        const apiVersion = apiThemes.find(at => at.id === bt.id || at.slug === bt.id);
        if (apiVersion?.tokens) return { ...bt, ...apiVersion, tokens: { ...bt.tokens, ...apiVersion.tokens } };
        return bt;
      });

      // Ajouter les thèmes API custom non présents dans les built-in
      apiThemes.forEach(at => {
        if (!merged.find(m => m.id === at.id)) {
          merged.push({
            id: at.id, name: at.name, isDark: at.isDark || false,
            tokens: { ...BUILT_IN_THEMES[0].tokens, ...at.tokens },
          });
        }
      });

      setThemes(merged);

      // Appliquer le thème actif depuis l'API ou le localStorage
      const activeApi = apiThemes.find(at => at.isActive);
      const storedId  = getStoredThemeId();
      const toApply   = merged.find(t => t.id === (activeApi?.id || storedId)) || merged[0];
      setCurrent(toApply);
      applyTokens(toApply.tokens, toApply.isDark);
    } catch {
      // Fallback : appliquer le thème du localStorage
      const storedId = getStoredThemeId();
      const fallback = BUILT_IN_THEMES.find(t => t.id === storedId) || BUILT_IN_THEMES[0];
      setCurrent(fallback);
      applyTokens(fallback.tokens, fallback.isDark);
    }
  }, [API]);

  useEffect(() => {
    // Appliquer immédiatement le thème stocké (évite le flash)
    const storedId = getStoredThemeId();
    const instant  = BUILT_IN_THEMES.find(t => t.id === storedId) || BUILT_IN_THEMES[0];
    applyTokens(instant.tokens, instant.isDark);
    setCurrent(instant);
    // Puis charger depuis l'API
    loadThemes();
  }, [loadThemes]);

  const setTheme = useCallback(async (id: string) => {
    setIsLoading(true);
    const found = themes.find(t => t.id === id);
    if (!found) { setIsLoading(false); return; }

    // Appliquer immédiatement (UI réactive)
    applyTokens(found.tokens, found.isDark);
    setCurrent(found);
    storeThemeId(id);

    // Persister en API
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('access_token') || '';
      await fetch(`${API}/api/v1/themes/${id}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
    } catch { /* silencieux — le thème est déjà appliqué localement */ }
    finally { setIsLoading(false); }
  }, [themes, API]);

  return (
    <ThemeContext.Provider value={{ theme: current, themes, setTheme, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
}
