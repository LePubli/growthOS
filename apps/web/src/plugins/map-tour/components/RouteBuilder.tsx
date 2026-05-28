/**
 * ============================================================
 * Map Tour - Route Builder Component
 * ============================================================
 * Interface permettant à l'utilisateur de construire sa tournée :
 * 1. Sélectionner des prospects/clients existants
 * 2. Ajouter des adresses manuelles supplémentaires
 * 3. Visualiser et optimiser l'itinéraire
 */

'use client';

import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Trash2, Move, Car, Search, User, Building } from 'lucide-react';
import type { Waypoint, OptimizedRoute } from '../types';

interface RouteBuilderProps {
  tenantId: string;
  userId: string;
  onRouteOptimized?: (route: OptimizedRoute) => void;
}

interface ProspectOption {
  id: string;
  name: string;
  company?: string;
  address?: string;
  type: 'prospect' | 'client';
}

export function RouteBuilder({ tenantId, userId, onRouteOptimized }: RouteBuilderProps) {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [prospects, setProspects] = useState<ProspectOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRoute | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  // Charger les prospects/clients disponibles
  useEffect(() => {
    const loadProspects = async () => {
      try {
        const response = await fetch(`/api/v1/plugins/map-tour/prospects?tenantId=${tenantId}`, {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setProspects(data.prospects || []);
        }
      } catch (error) {
        console.error('Erreur chargement prospects:', error);
      }
    };

    loadProspects();
  }, [tenantId]);

  // Filtrer les prospects selon la recherche
  const filteredProspects = prospects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.company?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Ajouter un prospect/client à la tournée
  const addProspect = (prospect: ProspectOption) => {
    if (!prospect.address) {
      alert('Ce prospect n\'a pas d\'adresse renseignée');
      return;
    }

    const newWaypoint: Waypoint = {
      id: `prospect-${prospect.id}`,
      name: prospect.name,
      address: prospect.address,
      type: prospect.type,
      metadata: {
        prospectId: prospect.id,
        company: prospect.company,
      },
    };

    setWaypoints(prev => [...prev, newWaypoint]);
    setSearchQuery('');
    setShowSearch(false);
    setOptimizedRoute(null);
  };

  // Ajouter une adresse manuelle
  const addManualAddress = () => {
    if (!manualAddress.trim()) return;

    const newWaypoint: Waypoint = {
      id: `manual-${Date.now()}`,
      name: manualAddress.trim(),
      address: manualAddress.trim(),
      type: 'manual',
      metadata: {},
    };

    setWaypoints(prev => [...prev, newWaypoint]);
    setManualAddress('');
    setOptimizedRoute(null);
  };

  // Supprimer un waypoint
  const removeWaypoint = (id: string) => {
    setWaypoints(prev => prev.filter(w => w.id !== id));
    setOptimizedRoute(null);
  };

  // Réorganiser les waypoints (drag & drop simplifié)
  const moveWaypoint = (index: number, direction: 'up' | 'down') => {
    setWaypoints(prev => {
      const newWaypoints = [...prev];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      
      if (newIndex < 0 || newIndex >= newWaypoints.length) return prev;
      
      [newWaypoints[index], newWaypoints[newIndex]] = [newWaypoints[newIndex], newWaypoints[index]];
      return newWaypoints;
    });
    setOptimizedRoute(null);
  };

  // Optimiser la tournée
  const optimizeRoute = async () => {
    if (waypoints.length < 2) {
      alert('Ajoutez au moins 2 points pour optimiser la tournée');
      return;
    }

    setIsOptimizing(true);
    try {
      const response = await fetch('/api/v1/plugins/map-tour/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tenantId,
          userId,
          waypoints,
          options: {
            algorithm: 'nearest-neighbor',
            returnToStart: false,
          },
        }),
      });

      if (!response.ok) throw new Error('Échec de l\'optimisation');

      const result = await response.json();
      setOptimizedRoute(result.route);
      onRouteOptimized?.(result.route);
    } catch (error) {
      console.error('Erreur optimisation:', error);
      alert('Erreur lors de l\'optimisation de la tournée');
    } finally {
      setIsOptimizing(false);
    }
  };

  // Sauvegarder la tournée
  const saveRoute = async () => {
    if (!optimizedRoute) return;

    try {
      const response = await fetch('/api/v1/plugins/map-tour/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tenantId,
          userId,
          name: `Tournée du ${new Date().toLocaleDateString()}`,
          waypoints: optimizedRoute.waypoints,
          totalDistance: optimizedRoute.totalDistance,
          totalDuration: optimizedRoute.totalDuration,
        }),
      });

      if (response.ok) {
        alert('Tournée sauvegardée avec succès !');
      }
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Car className="w-5 h-5 text-blue-600" />
          Construire ma tournée
        </h3>
        {waypoints.length > 0 && (
          <button
            onClick={() => setWaypoints([])}
            className="text-sm text-red-600 hover:text-red-700"
          >
            Tout effacer
          </button>
        )}
      </div>

      {/* Section 1: Ajouter des prospects/clients */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          1. Ajouter des prospects ou clients
        </label>
        
        <div className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un prospect ou client..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearch(true);
                }}
                onFocus={() => setShowSearch(true)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {showSearch && searchQuery && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filteredProspects.length === 0 ? (
                <div className="p-3 text-sm text-gray-500">Aucun résultat</div>
              ) : (
                filteredProspects.map(prospect => (
                  <button
                    key={prospect.id}
                    onClick={() => {
                      addProspect(prospect);
                      setShowSearch(false);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-start gap-3 border-b border-gray-100 last:border-0"
                  >
                    {prospect.type === 'client' ? (
                      <Building className="w-5 h-5 text-green-600 flex-shrink-0" />
                    ) : (
                      <User className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    )}
                    <div>
                      <div className="font-medium text-gray-900">{prospect.name}</div>
                      {prospect.company && (
                        <div className="text-sm text-gray-500">{prospect.company}</div>
                      )}
                      {prospect.address && (
                        <div className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3" />
                          {prospect.address}
                        </div>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Ajouter une adresse manuelle */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          2. Ajouter une adresse supplémentaire
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Ex: 10 Rue de la Paix, 75002 Paris"
            value={manualAddress}
            onChange={(e) => setManualAddress(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addManualAddress()}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={addManualAddress}
            disabled={!manualAddress.trim()}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
        </div>
      </div>

      {/* Section 3: Liste des waypoints */}
      {waypoints.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            3. Votre tournée ({waypoints.length} stops)
          </label>
          <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
            {waypoints.map((waypoint, index) => (
              <div
                key={waypoint.id}
                className="flex items-center gap-3 p-3 hover:bg-gray-50 group"
              >
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => moveWaypoint(index, 'up')}
                    disabled={index === 0}
                    className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  >
                    <Move className="w-3 h-3 rotate-180" />
                  </button>
                  <button
                    onClick={() => moveWaypoint(index, 'down')}
                    disabled={index === waypoints.length - 1}
                    className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  >
                    <Move className="w-3 h-3" />
                  </button>
                </div>

                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-sm font-medium">
                  {index + 1}
                </div>

                {waypoint.type === 'client' ? (
                  <Building className="w-4 h-4 text-green-600 flex-shrink-0" />
                ) : waypoint.type === 'prospect' ? (
                  <User className="w-4 h-4 text-blue-600 flex-shrink-0" />
                ) : (
                  <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{waypoint.name}</div>
                  <div className="text-sm text-gray-500 truncate">{waypoint.address}</div>
                </div>

                <button
                  onClick={() => removeWaypoint(waypoint.id)}
                  className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 4: Actions */}
      <div className="flex gap-3 pt-4 border-t border-gray-200">
        <button
          onClick={optimizeRoute}
          disabled={waypoints.length < 2 || isOptimizing}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isOptimizing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Optimisation...
            </>
          ) : (
            <>
              <Car className="w-4 h-4" />
              Optimiser la tournée
            </>
          )}
        </button>

        {optimizedRoute && (
          <button
            onClick={saveRoute}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Sauvegarder
          </button>
        )}
      </div>

      {/* Résumé de l'itinéraire optimisé */}
      {optimizedRoute && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h4 className="font-semibold text-green-800 mb-2">Itinéraire optimisé</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-green-600">Distance totale:</span>
              <span className="ml-2 font-medium">{optimizedRoute.totalDistance.toFixed(1)} km</span>
            </div>
            <div>
              <span className="text-green-600">Durée estimée:</span>
              <span className="ml-2 font-medium">{Math.round(optimizedRoute.totalDuration / 60)} min</span>
            </div>
          </div>
          <div className="mt-3 text-xs text-green-700">
            Ordre optimal: {optimizedRoute.waypoints.map((w, i) => i + 1).join(' → ')}
          </div>
        </div>
      )}
    </div>
  );
}

export default RouteBuilder;
