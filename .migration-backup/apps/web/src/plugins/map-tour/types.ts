/**
 * ============================================================
 * Map Tour Plugin - Types TypeScript
 * ============================================================
 * Définition des types pour le plugin de tournées commerciales
 */

export interface Waypoint {
  id: string;
  name: string;
  address: string;
  type: 'prospect' | 'client' | 'manual';
  coordinates?: {
    lat: number;
    lng: number;
  };
  metadata?: Record<string, any>;
}

export interface GeocodedWaypoint extends Waypoint {
  coordinates: {
    lat: number;
    lng: number;
  };
  geocodingSource: 'google' | 'osm' | 'cached';
}

export interface OptimizedRoute {
  id?: string;
  waypoints: Waypoint[];
  orderedWaypoints: Waypoint[];
  totalDistance: number; // en mètres
  totalDuration: number; // en secondes
  createdAt?: Date;
  tenantId?: string;
  userId?: string;
}

export interface RouteOptimizationOptions {
  algorithm: 'nearest-neighbor' | 'genetic' | 'brute-force';
  returnToStart?: boolean;
  avoidHighways?: boolean;
  preferScenic?: boolean;
}

export interface OptimizeRouteRequest {
  tenantId: string;
  userId: string;
  waypoints: Waypoint[];
  options?: RouteOptimizationOptions;
}

export interface OptimizeRouteResponse {
  route: OptimizedRoute;
  geocodedWaypoints: GeocodedWaypoint[];
}

export interface SavedRoute {
  id: string;
  name: string;
  tenantId: string;
  userId: string;
  waypoints: Waypoint[];
  orderedWaypoints: Waypoint[];
  totalDistance: number;
  totalDuration: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MapTourConfig {
  autoGeocodeOnProspectCreate: boolean;
  defaultAlgorithm: RouteOptimizationOptions['algorithm'];
  maxWaypoints: number;
  cacheGeocodingResults: boolean;
}

export interface ProspectOption {
  id: string;
  name: string;
  company?: string;
  address?: string;
  type: 'prospect' | 'client';
}
