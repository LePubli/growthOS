'use client';

import { useState, useEffect } from 'react';
import {
  Users, TrendingUp, Mail, Target, ArrowUp, ArrowDown,
  RefreshCw, AlertCircle, BarChart2, Activity, Zap,
  Calendar, Clock, CheckCircle, Circle, ChevronRight,
  DollarSign, Eye, MousePointer, Send
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface KPI {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

interface Activity {
  id: string;
  type: 'prospect' | 'email' | 'workflow' | 'plugin' | 'conversion';
  message: string;
  time: string;
  status?: 'success' | 'pending' | 'error';
}

interface ChartBar {
  label: string;
  value: number;
  secondary?: number;
}

// ─── Données mockées enrichies ─────────────────────────────────────────────────
const MOCK_STATS = {
  prospects: 1247,
  prospectsChange: 12.5,
  emailsSent: 8934,
  emailsChange: 8.2,
  conversionRate: 3.8,
  conversionChange: -0.4,
  revenue: 24600,
  revenueChange: 18.7,
  activeWorkflows: 7,
  pluginsActive: 4,
  openRate: 42.3,
  clickRate: 6.8,
};

const MOCK_CHART: ChartBar[] = [
  { label: 'Lun', value: 45, secondary: 12 },
  { label: 'Mar', value: 78, secondary: 23 },
  { label: 'Mer', value: 62, secondary: 18 },
  { label: 'Jeu', value: 91, secondary: 31 },
  { label: 'Ven', value: 110, secondary: 28 },
  { label: 'Sam', value: 34, secondary: 8 },
  { label: 'Dim', value: 56, secondary: 15 },
];

const MOCK_ACTIVITIES: Activity[] = [
  { id: '1', type: 'prospect', message: '3 nouveaux prospects importés depuis LinkedIn', time: 'il y a 5 min', status: 'success' },
  { id: '2', type: 'email', message: 'Séquence "Onboarding SaaS" envoyée à 47 contacts', time: 'il y a 18 min', status: 'success' },
  { id: '3', type: 'workflow', message: 'Workflow "Relance J+3" déclenché automatiquement', time: 'il y a 1h', status: 'success' },
  { id: '4', type: 'conversion', message: 'Lead "Acme Corp" converti en opportunité (12 400€)', time: 'il y a 2h', status: 'success' },
  { id: '5', type: 'email', message: 'Campagne "Q2 Promo" en attente de validation', time: 'il y a 3h', status: 'pending' },
  { id: '6', type: 'plugin', message: 'Plugin "CRM Sync HubSpot" synchronisé (234 contacts)', time: 'il y a 4h', status: 'success' },
  { id: '7', type: 'prospect', message: 'Enrichissement waterfall terminé pour 89 prospects', time: 'hier', status: 'success' },
];

const PIPELINE_STAGES = [
  { label: 'Nouveaux', count: 423, value: 0, color: '#94A3B8' },
  { label: 'Contactés', count: 218, value: 12400, color: '#3B82F6' },
  { label: 'Qualifiés', count: 87, value: 68200, color: '#8B5CF6' },
  { label: 'En négociation', count: 34, value: 124500, color: '#F59E0B' },
  { label: 'Gagnés', count: 12, value: 89400, color: '#10B981' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const activityIcon = (type: Activity['type']) => {
  switch (type) {
    case 'prospect': return <Users className="w-4 h-4" />;
    case 'email': return <Mail className="w-4 h-4" />;
    case 'workflow': return <Zap className="w-4 h-4" />;
    case 'plugin': return <Activity className="w-4 h-4" />;
    case 'conversion': return <DollarSign className="w-4 h-4" />;
  }
};

const activityColor = (type: Activity['type']) => {
  switch (type) {
    case 'prospect': return 'bg-blue-100 text-blue-600';
    case 'email': return 'bg-purple-100 text-purple-600';
    case 'workflow': return 'bg-yellow-100 text-yellow-600';
    case 'plugin': return 'bg-gray-100 text-gray-600';
    case 'conversion': return 'bg-green-100 text-green-600';
  }
};

const statusIcon = (status?: Activity['status']) => {
  switch (status) {
    case 'success': return <CheckCircle className="w-3 h-3 text-green-500" />;
    case 'pending': return <Circle className="w-3 h-3 text-amber-400" />;
    case 'error': return <AlertCircle className="w-3 h-3 text-red-400" />;
    default: return null;
  }
};

const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toString();
const fmtEur = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(0)}k€` : `${n}€`;

// ─── Composant KPI Card ───────────────────────────────────────────────────────
function KPICard({ kpi }: { kpi: KPI }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${kpi.bgColor}`}>
          <div className={kpi.color}>{kpi.icon}</div>
        </div>
        {kpi.change !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
            kpi.change >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
          }`}>
            {kpi.change >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {Math.abs(kpi.change)}%
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-gray-900 mb-1">{kpi.value}</div>
      <div className="text-sm text-gray-500">{kpi.label}</div>
      {kpi.changeLabel && (
        <div className="text-xs text-gray-400 mt-1">{kpi.changeLabel}</div>
      )}
    </div>
  );
}

// ─── Mini bar chart ───────────────────────────────────────────────────────────
function MiniBarChart({ data }: { data: ChartBar[] }) {
  const max = Math.max(...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-2 h-32">
      {data.map((bar, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full flex flex-col justify-end gap-0.5" style={{ height: '100px' }}>
            {bar.secondary !== undefined && (
              <div
                className="w-full rounded-t bg-teal-200"
                style={{ height: `${(bar.secondary / max) * 100}%` }}
              />
            )}
            <div
              className="w-full rounded-t bg-teal-600"
              style={{ height: `${((bar.value - (bar.secondary || 0)) / max) * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-400">{bar.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Page principale ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [stats, setStats] = useState(MOCK_STATS);
  const [activities, setActivities] = useState<Activity[]>(MOCK_ACTIVITIES);
  const [fetching, setFetching] = useState(false);
  const [tab, setTab] = useState<'commercial' | 'sourcing' | 'operations'>('commercial');
  const [greeting, setGreeting] = useState('Bonjour');
  const [date, setDate] = useState('');

  const API = process.env.NEXT_PUBLIC_API_URL || '';

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir');
    setDate(new Date().toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    }));
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setFetching(true);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('access_token') || '';
      const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      const res = await fetch(`${API}/api/v1/dashboard/stats`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data && Object.keys(data).length > 0) setStats({ ...MOCK_STATS, ...data });
      }
    } catch { /* Garder les données mock */ }
    finally { setFetching(false); }
  };

  const kpis: KPI[] = [
    {
      label: 'Prospects total',
      value: fmt(stats.prospects),
      change: stats.prospectsChange,
      changeLabel: 'vs mois dernier',
      icon: <Users className="w-5 h-5" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Emails envoyés',
      value: fmt(stats.emailsSent),
      change: stats.emailsChange,
      changeLabel: 'ce mois',
      icon: <Send className="w-5 h-5" />,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      label: 'Taux de conversion',
      value: `${stats.conversionRate}%`,
      change: stats.conversionChange,
      changeLabel: 'vs période préc.',
      icon: <Target className="w-5 h-5" />,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      label: 'Revenus pipeline',
      value: fmtEur(stats.revenue),
      change: stats.revenueChange,
      changeLabel: 'opportunités actives',
      icon: <DollarSign className="w-5 h-5" />,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: 'Taux d\'ouverture',
      value: `${stats.openRate}%`,
      icon: <Eye className="w-5 h-5" />,
      color: 'text-teal-600',
      bgColor: 'bg-teal-50',
    },
    {
      label: 'Taux de clic',
      value: `${stats.clickRate}%`,
      icon: <MousePointer className="w-5 h-5" />,
      color: 'text-pink-600',
      bgColor: 'bg-pink-50',
    },
    {
      label: 'Workflows actifs',
      value: stats.activeWorkflows,
      icon: <Zap className="w-5 h-5" />,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
    {
      label: 'Plugins actifs',
      value: stats.pluginsActive,
      icon: <Activity className="w-5 h-5" />,
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
    },
  ];

  const maxPipeline = Math.max(...PIPELINE_STAGES.map((s) => s.count));

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting} 👋
          </h1>
          <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
            <Calendar className="w-4 h-4" />
            <span className="capitalize">{date}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Tabs vue */}
          <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 text-sm">
            {(['commercial', 'sourcing', 'operations'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg font-medium capitalize transition-all ${
                  tab === t ? 'bg-teal-600 text-white' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'commercial' ? '📈 Commercial' : t === 'sourcing' ? '🔍 Sourcing' : '⚙️ Opérations'}
              </button>
            ))}
          </div>
          <button
            onClick={fetchStats}
            disabled={fetching}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors bg-white border border-gray-200 px-3 py-2 rounded-xl"
          >
            <RefreshCw className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>
      </div>

      {/* ── KPIs ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => <KPICard key={i} kpi={kpi} />)}
      </div>

      {/* ── Row 2 : Chart + Pipeline ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Chart activité */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-semibold text-gray-900">Activité cette semaine</h2>
              <p className="text-sm text-gray-400">Prospects contactés vs réponses</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-teal-600" />
                <span>Contactés</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-teal-200" />
                <span>Réponses</span>
              </div>
            </div>
          </div>
          <MiniBarChart data={MOCK_CHART} />
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-sm">
            <span className="text-gray-400">Total semaine</span>
            <div className="flex gap-6">
              <span className="font-semibold text-teal-600">
                {MOCK_CHART.reduce((s, d) => s + d.value, 0)} contactés
              </span>
              <span className="font-semibold text-teal-300">
                {MOCK_CHART.reduce((s, d) => s + (d.secondary || 0), 0)} réponses
              </span>
            </div>
          </div>
        </div>

        {/* Pipeline */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-gray-900">Pipeline commercial</h2>
            <BarChart2 className="w-4 h-4 text-gray-400" />
          </div>
          <div className="space-y-3">
            {PIPELINE_STAGES.map((stage, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1 text-sm">
                  <span className="text-gray-600">{stage.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{stage.count}</span>
                    {stage.value > 0 && (
                      <span className="text-xs text-gray-400">{fmtEur(stage.value)}</span>
                    )}
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${(stage.count / maxPipeline) * 100}%`,
                      backgroundColor: stage.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Valeur totale pipeline</span>
              <span className="font-bold text-gray-900">
                {fmtEur(PIPELINE_STAGES.reduce((s, st) => s + st.value, 0))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 3 : Activité + Quick actions ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Activité récente */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-gray-900">Activité récente</h2>
            <button className="text-sm text-teal-600 hover:text-teal-700 flex items-center gap-1">
              Tout voir <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${activityColor(activity.type)}`}>
                  {activityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 leading-snug">{activity.message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="w-3 h-3 text-gray-300" />
                    <span className="text-xs text-gray-400">{activity.time}</span>
                    {statusIcon(activity.status)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions rapides + santé système */}
        <div className="space-y-5">
          {/* Actions rapides */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Actions rapides</h2>
            <div className="space-y-2">
              {[
                { label: 'Importer des prospects', icon: <Users className="w-4 h-4" />, color: 'text-blue-600 bg-blue-50', href: '/prospects' },
                { label: 'Créer une séquence email', icon: <Mail className="w-4 h-4" />, color: 'text-purple-600 bg-purple-50', href: '/pipeline' },
                { label: 'Lancer un workflow', icon: <Zap className="w-4 h-4" />, color: 'text-yellow-600 bg-yellow-50', href: '/workflows' },
                { label: 'Voir le marketplace', icon: <Activity className="w-4 h-4" />, color: 'text-teal-600 bg-teal-50', href: '/plugins' },
              ].map((action, i) => (
                <a
                  key={i}
                  href={action.href}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${action.color}`}>
                    {action.icon}
                  </div>
                  <span className="text-sm text-gray-700 group-hover:text-gray-900 font-medium">
                    {action.label}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-300 ml-auto group-hover:text-gray-400" />
                </a>
              ))}
            </div>
          </div>

          {/* Santé système */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Santé système</h2>
            <div className="space-y-3">
              {[
                { label: 'API NestJS', status: 'up', latency: '12ms' },
                { label: 'Base de données', status: 'up', latency: '3ms' },
                { label: 'Redis / Queue', status: 'up', latency: '1ms' },
                { label: 'MinIO Storage', status: 'up', latency: '8ms' },
                { label: 'Worker BullMQ', status: 'up', latency: '—' },
              ].map((service, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${service.status === 'up' ? 'bg-green-400' : 'bg-red-400'} animate-pulse`} />
                    <span className="text-sm text-gray-600">{service.label}</span>
                  </div>
                  <span className="text-xs text-gray-400 font-mono">{service.latency}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
