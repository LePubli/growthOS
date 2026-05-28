'use client';

import React, { useEffect, useState } from 'react';
import { DollarSign, Briefcase, TrendingUp, Users } from 'lucide-react';

interface CrmStats {
  totalDeals: number;
  totalValue: number;
  winRate: number;
  activeAccounts: number;
}

export function CrmDashboardWidgets() {
  const [stats, setStats] = useState<CrmStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        // Appel à l'endpoint de reporting du plugin
        const res = await fetch('/api/v1/plugins/crm/reports?type=summary');
        if (!res.ok) throw new Error('Failed to fetch stats');
        const data = await res.json();
        setStats(data);
      } catch (err) {
        console.error('Failed to load CRM stats', err);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 my-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const widgets = [
    {
      title: 'Valeur Pipeline',
      value: `${stats.totalValue.toLocaleString()} €`,
      icon: DollarSign,
      color: 'text-green-600',
      bg: 'bg-green-50'
    },
    {
      title: 'Opportunités',
      value: stats.totalDeals.toString(),
      icon: Briefcase,
      color: 'text-blue-600',
      bg: 'bg-blue-50'
    },
    {
      title: 'Taux de Victoire',
      value: `${stats.winRate}%`,
      icon: TrendingUp,
      color: 'text-purple-600',
      bg: 'bg-purple-50'
    },
    {
      title: 'Comptes Actifs',
      value: stats.activeAccounts.toString(),
      icon: Users,
      color: 'text-orange-600',
      bg: 'bg-orange-50'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 my-8">
      {widgets.map((widget) => (
        <div key={widget.title} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className={`p-3 rounded-xl ${widget.bg}`}>
              <widget.icon className={`w-6 h-6 ${widget.color}`} />
            </div>
            <span className="text-xs font-medium text-gray-400">En temps réel</span>
          </div>
          <h3 className="text-gray-500 text-sm font-medium">{widget.title}</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">{widget.value}</p>
        </div>
      ))}
    </div>
  );
}
