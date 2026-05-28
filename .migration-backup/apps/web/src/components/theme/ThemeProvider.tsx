'use client';

import { useEffect, useState, createContext, useContext } from 'react';
import { apiClient } from '@/lib/api-client';

interface ThemeTokens {
  colors?: Record<string, string>;
  typography?: Record<string, string>;
  spacing?: Record<string, string>;
  radius?: Record<string, string>;
  shadows?: Record<string, string>;
  layout?: Record<string, string>;
}

interface ThemeData {
  id?: string;
  name: string;
  slug: string;
  tokens: ThemeTokens;
}

interface ThemeCtx {
  theme: ThemeData | null;
  refresh: () => Promise<void>;
  loading: boolean;
}

const ThemeContext = createContext<ThemeCtx>({ theme: null, refresh: async () => {}, loading: true });

export const useTheme = () => useContext(ThemeContext);

const CACHE_KEY = 'growthos_theme';
const CACHE_TTL = 5 * 60 * 1000;

function flattenTokens(tokens: ThemeTokens): Record<string, string> {
  const vars: Record<string, string> = {};

  const toKebab = (s: string) => s.replace(/([A-Z])/g, '-$1').toLowerCase();

  const process = (obj: any, prefix: string) => {
    for (const [key, value] of Object.entries(obj || {})) {
      if (typeof value === 'object' && value !== null) {
        process(value, `${prefix}-${toKebab(key)}`);
      } else {
        vars[`${prefix}-${toKebab(key)}`] = value as string;
      }
    }
  };

  // Map chaque groupe vers les variables CSS Odoo
  const mapping: Record<string, string> = {
    brand:           '--color-brand',
    primary:         '--color-primary',
    secondary:       '--color-secondary',
    success:         '--color-success',
    danger:          '--color-danger',
    warning:         '--color-warning',
    info:            '--color-info',
    bgApp:           '--bg-app',
    bgCard:          '--bg-card',
    bgSidebar:       '--bg-sidebar',
    bgHeader:        '--bg-header',
    bgHover:         '--bg-hover',
    bgActive:        '--bg-active',
    textPrimary:     '--text-primary',
    textSecondary:   '--text-secondary',
    textMuted:       '--text-muted',
    textSidebar:     '--text-sidebar',
    textSidebarMuted:'--text-sidebar-muted',
    border:          '--border-color',
    borderLight:     '--border-light',
  };

  // Couleurs
  for (const [key, value] of Object.entries(tokens.colors || {})) {
    const cssVar = mapping[key] || `--color-${toKebab(key)}`;
    vars[cssVar] = value;
  }

  // Typography
  for (const [key, value] of Object.entries(tokens.typography || {})) {
    vars[`--font-${toKebab(key)}`] = value;
  }

  // Layout
  for (const [key, value] of Object.entries(tokens.layout || {})) {
    vars[`--${toKebab(key)}`] = value;
  }

  // Shadows
  for (const [key, value] of Object.entries(tokens.shadows || {})) {
    vars[`--shadow-${toKebab(key)}`] = value;
  }

  return vars;
}

function applyTheme(theme: ThemeData) {
  const root = document.documentElement;
  const vars = flattenTokens(theme.tokens || {});

  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }

  // Data-theme attribute pour CSS conditionnel
  const bg = theme.tokens?.colors?.bgApp || '#F9F9F9';
  const isDark = bg.startsWith('#1') || bg.startsWith('#0') || bg.startsWith('rgb(1') || bg.startsWith('rgb(0');
  root.setAttribute('data-theme', isDark ? 'dark' : 'light');

  // Google Font Noto Sans si pas déjà chargé
  if (!document.getElementById('growthos-font')) {
    const link = document.createElement('link');
    link.id = 'growthos-font';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&family=Noto+Sans+Mono:wght@400;500&display=swap';
    document.head.appendChild(link);
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeData | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const data = await apiClient.get<ThemeData>('/themes/active');
      setTheme(data);
      applyTheme(data);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
    } catch (e) {
      // Fallback silencieux — CSS par défaut du globals.css
      console.warn('[ThemeProvider] Fallback to default theme');
    }
  };

  useEffect(() => {
    const loadTheme = async () => {
      // Check cache
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_TTL) {
            setTheme(data);
            applyTheme(data);
            setLoading(false);
            // Refresh en background
            refresh().catch(() => {});
            return;
          }
        }
      } catch {}

      await refresh();
      setLoading(false);
    };

    loadTheme();

    // Expose pour refresh externe (ex: après activation thème)
    (window as any).__refreshTheme = refresh;
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, refresh, loading }}>
      {children}
    </ThemeContext.Provider>
  );
}
