/**
 * ============================================================
 * Map Tour Plugin - Route Summary Component
 * ============================================================
 * Composant de résumé des tournées pour le dashboard
 * Affiche les statistiques et tournées récentes
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Car, MapPin, TrendingUp, Clock } from 'lucide-react';

interface DashboardSlotProps {
  tenantId: string;
  userId: string;
}

interface RouteStats {
  totalRoutes: number;
  totalDistance: number;
  totalDuration: number;
  lastWeekRoutes: number;
}

export function RouteSummary({ tenantId, userId }: DashboardSlotProps) {
  const [stats, setStats] = useState<RouteStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await fetch(
          `/api/v1/plugins/map-tour/routes?tenantId=${tenantId}&userId=${userId}`,
          { credentials: 'include' }
        );

        if (response.ok) {
          const data = await response.json();
          const routes = data.routes || [];

          const totalDistance = routes.reduce((acc: number, r: any) => acc + (r.totalDistance || 0), 0);
          const totalDuration = routes.reduce((acc: number, r: any) => acc + (r.totalDuration || 0), 0);

          // Calculer les tournées de la dernière semaine
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
          const lastWeekRoutes = routes.filter((r: any) => 
            new Date(r.createdAt) > oneWeekAgo
          ).length;

          setStats({
            totalRoutes: routes.length,
            totalDistance,
            totalDuration,
            lastWeekRoutes,
          });
        }
      } catch (error) {
        console.error('Erreur chargement stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, [tenantId, userId]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-16 bg-gray-100 rounded"></div>
          <div className="h-16 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (!stats || stats.totalRoutes === 0) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-sm border border-blue-100 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Car className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Tournées Commerciales</h3>
        </div>
        <p className="text-gray-600 text-sm">
          Aucune tournée créée pour le moment. Commencez par optimiser vos déplacements !
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-sm border border-blue-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Car className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Tournées Commerciales</h3>
        </div>
        {stats.lastWeekRoutes > 0 && (
          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            {stats.lastWeekRoutes} cette semaine
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <MapPin className="w-4 h-4" />
            Tournées
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.totalRoutes}</div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <TrendingUp className="w-4 h-4" />
            Distance
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {(stats.totalDistance / 1000).toFixed(1)} km
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Clock className="w-4 h-4" />
            Durée totale
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {Math.round(stats.totalDuration / 3600)}h
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Car className="w-4 h-4" />
            Moyenne/tournée
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {stats.totalRoutes > 0 ? Math.round(stats.totalDistance / stats.totalRoutes / 1000) : 0} km
          </div>
        </div>
      </div>
    </div>
  );
}

export default RouteSummary;
