// Sections nav mises à jour pour AppShell.tsx
// Remplace NAV_SECTIONS dans /apps/web/src/components/layout/AppShell.tsx

import {
  LayoutDashboard, Building2, GitBranch, Search, Bell,
  Settings, Puzzle, Palette, Mail, Target, RefreshCw,
  Bot, User, Webhook, BarChart2, Download, Zap,
  Globe, Activity, ShoppingBag, Store,
} from 'lucide-react';

export const NAV_SECTIONS = [
  {
    label: 'Main Menu',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
      { href: '/analytics', label: 'Analytics', icon: BarChart2 },
    ],
  },
  {
    label: 'CRM & Pipeline',
    items: [
      { href: '/prospects', label: 'Prospects', icon: Building2 },
      { href: '/pipeline', label: 'Pipeline', icon: GitBranch },
      { href: '/activities', label: 'Activités', icon: Activity },
    ],
  },
  {
    label: 'Sourcing',
    items: [
      { href: '/sourcing', label: 'Scraping', icon: Search },
      { href: '/signals', label: 'Signaux', icon: Zap },
      { href: '/contacts', label: 'Contact Intel', icon: User },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { href: '/sequences', label: 'Séquences Email', icon: Mail },
      { href: '/inbound', label: 'Inbound', icon: Download },
      { href: '/abm', label: 'ABM / TAM', icon: Target },
      { href: '/crm-sync', label: 'CRM Sync', icon: RefreshCw },
    ],
  },
  {
    label: 'Intelligence IA',
    items: [
      { href: '/ai', label: 'Agent IA', icon: Bot },          // ← NOUVEAU
      { href: '/workflows', label: 'Workflows', icon: Globe },
    ],
  },
  {
    label: 'Système',
    items: [
      { href: '/marketplace', label: 'Marketplace', icon: Store },   // ← NOUVEAU
      { href: '/plugins', label: 'Plugins', icon: Puzzle },
      { href: '/themes', label: 'Thèmes', icon: Palette },
      { href: '/webhooks', label: 'Webhooks', icon: Webhook },
      { href: '/settings', label: 'Paramètres', icon: Settings },
    ],
  },
];
