'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

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
  id:           string;
  name:         string;
  description?: string;
  isDark:       boolean;
  tokens:       ThemeTokens;
}

interface ThemeContextValue {
  theme:     Theme;
  themes:    Theme[];
  setTheme:  (id: string) => Promise<void>;
  isLoading: boolean;
}

// ─── Slugs qui correspondent EXACTEMENT à la base de données ─────────────
export const BUILT_IN_THEMES: Theme[] = [
  {
    id: 'odoo-default', name: 'GrowthOS Default', isDark: false,
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
    id: 'light', name: 'Light Minimal', isDark: false,
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
    id: 'dark-pro', name: 'Dark Pro', isDark: true,
    tokens: {
      '--color-primary':       '#6366F1',
      '--color-primary-light': '#1E1B4B',
      '--color-primary-dark':  '#4F46E5',
      '--color-accent':        '#8B5CF6',
      '--sidebar-bg':          '#0F0F1A',
      '--sidebar-text':        '#A5B4FC',
      '--sidebar-hover':       '#1E1B4B',
      '--body-bg':             '#13131F',
      '--card-bg':             '#0F0F1A',
      '--card-border':         '#2D2B55',
      '--text-primary':        '#EEF2FF',
      '--text-secondary':      '#C7D2FE',
      '--text-muted':          '#6366F1',
      '--radius-card':         '0.75rem',
      '--font-sans':           'Inter, system-ui, sans-serif',
    },
  },
];

function applyTokens(tokens: ThemeTokens, isDark: boolean) {
  const root = document.documentElement;
  Object.entries(tokens).forEach(([key, val]) => root.style.setProperty(key, val));
  root.setAttribute('data-theme', isDark ? 'dark' : 'light');
  isDark ? root.classList.add('dark') : root.classList.remove('dark');
}

const STORAGE_KEY = 'growthos-theme-id';
function getStoredThemeId(): string {
  if (typeof window === 'undefined') return 'odoo-default';
  return localStorage.getItem(STORAGE_KEY) || 'odoo-default';
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: BUILT_IN_THEMES[0],
  themes: BUILT_IN_THEMES,
  setTheme: async () => {},
  isLoading: false,
});

export function useTheme() { return useContext(ThemeContext); }

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themes, setThemes]   = useState<Theme[]>(BUILT_IN_THEMES);
  const [current, setCurrent] = useState<Theme>(BUILT_IN_THEMES[0]);
  const [isLoading, setIsLoading] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL || '';

  const loadThemes = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token') || '';
      const res = await fetch(`${API}/api/v1/themes`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const data = await res.json();
      const apiThemes: any[] = Array.isArray(data) ? data : data.data || [];

      // Fusionner API themes avec built-in (garder tokens built-in si API n'en a pas)
      const merged = BUILT_IN_THEMES.map(bt => {
        const api = apiThemes.find(a => a.slug === bt.id || a.id === bt.id);
        return api ? { ...bt, ...api, id: bt.id, tokens: bt.tokens } : bt;
      });

      // Ajouter les thèmes API non présents dans built-in
      apiThemes.forEach(at => {
        if (!merged.find(m => m.id === at.slug)) {
          merged.push({
            id: at.slug || at.id,
            name: at.name || at.displayName,
            isDark: at.slug?.includes('dark') || false,
            tokens: { ...BUILT_IN_THEMES[0].tokens, ...(at.tokens || {}) },
          });
        }
      });

      setThemes(merged);

      // Appliquer le thème actif depuis API ou localStorage
      const storedId = getStoredThemeId();
      const toApply = merged.find(t => t.id === storedId) || merged[0];
      setCurrent(toApply);
      applyTokens(toApply.tokens, toApply.isDark);
    } catch {
      const storedId = getStoredThemeId();
      const fallback = BUILT_IN_THEMES.find(t => t.id === storedId) || BUILT_IN_THEMES[0];
      setCurrent(fallback);
      applyTokens(fallback.tokens, fallback.isDark);
    }
  }, [API]);

  useEffect(() => {
    const storedId = getStoredThemeId();
    const instant = BUILT_IN_THEMES.find(t => t.id === storedId) || BUILT_IN_THEMES[0];
    applyTokens(instant.tokens, instant.isDark);
    setCurrent(instant);
    loadThemes();
  }, [loadThemes]);

  const setTheme = useCallback(async (id: string) => {
    setIsLoading(true);
    const found = themes.find(t => t.id === id);
    if (!found) { setIsLoading(false); return; }

    // Appliquer immédiatement
    applyTokens(found.tokens, found.isDark);
    setCurrent(found);
    localStorage.setItem(STORAGE_KEY, id);

    // Persister en API (le slug en base correspond à l'id)
    try {
      const token = localStorage.getItem('access_token') || '';
      await fetch(`${API}/api/v1/themes/${id}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
    } catch { /* silencieux — thème déjà appliqué localement */ }
    finally { setIsLoading(false); }
  }, [themes, API]);

  return (
    <ThemeContext.Provider value={{ theme: current, themes, setTheme, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
}
