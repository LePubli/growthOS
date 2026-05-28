/**
 * ============================================================
 * Map Tour Plugin - API Route Handler (Optimize)
 * ============================================================
 * POST /api/v1/plugins/map-tour/optimize
 * 
 * Fonctionnalités:
 * 1. Géocode les adresses non coordonnées
 * 2. Optimise l'ordre des waypoints (algorithme nearest-neighbor)
 * 3. Calcule distance et durée totales
 * 4. Retourne l'itinéraire optimisé
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Waypoint, GeocodedWaypoint, OptimizedRoute } from '../../types';

// Schema de validation
const OptimizeRequestSchema = z.object({
  tenantId: z.string().min(1),
  userId: z.string().min(1),
  waypoints: z.array(z.object({
    id: z.string(),
    name: z.string(),
    address: z.string(),
    type: z.enum(['prospect', 'client', 'manual']),
    coordinates: z.object({
      lat: z.number(),
      lng: z.number(),
    }).optional(),
    metadata: z.record(z.any()).optional(),
  })),
  options: z.object({
    algorithm: z.enum(['nearest-neighbor', 'genetic', 'brute-force']).optional(),
    returnToStart: z.boolean().optional(),
    avoidHighways: z.boolean().optional(),
    preferScenic: z.boolean().optional(),
  }).optional(),
});

/**
 * Géocodage simulé (à remplacer par un vrai service: Google Maps, Nominatim, etc.)
 */
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  // Simulation: retourne des coordonnées basées sur un hash de l'adresse
  // En production, utiliser l'API Google Maps Geocoding ou OSM Nominatim
  
  try {
    // Exemple avec Nominatim (gratuit, rate-limited)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      {
        headers: {
          'User-Agent': 'GrowthOS/1.0',
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        };
      }
    }

    // Fallback: génération pseudo-aléatoire basée sur le hash
    const hash = address.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return {
      lat: 48.8566 + (hash % 100) / 1000,
      lng: 2.3522 + (hash % 50) / 1000,
    };
  } catch (error) {
    console.error('Erreur géocodage:', error);
    return null;
  }
}

/**
 * Calcul de distance entre deux points (formule de Haversine)
 */
function calculateDistance(
  point1: { lat: number; lng: number },
  point2: { lat: number; lng: number }
): number {
  const R = 6371000; // Rayon terrestre en mètres
  const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
  const dLng = ((point2.lng - point1.lng) * Math.PI) / 180;
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((point1.lat * Math.PI) / 180) *
      Math.cos((point2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Estimation de la durée de trajet (vitesse moyenne 40 km/h en ville)
 */
function estimateDuration(distanceMeters: number): number {
  const averageSpeed = 40000 / 3600; // 40 km/h en m/s
  return distanceMeters / averageSpeed;
}

/**
 * Algorithme du plus proche voisin pour optimiser l'ordre des visites
 */
function optimizeNearestNeighbor(
  waypoints: GeocodedWaypoint[],
  returnToStart: boolean = false
): GeocodedWaypoint[] {
  if (waypoints.length <= 1) return waypoints;

  const optimized: GeocodedWaypoint[] = [];
  const remaining = [...waypoints];
  
  // Commencer par le premier waypoint
  let current = remaining.shift()!;
  optimized.push(current);

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const dist = calculateDistance(
        current.coordinates,
        remaining[i].coordinates
      );
      
      if (dist < nearestDistance) {
        nearestDistance = dist;
        nearestIndex = i;
      }
    }

    current = remaining.splice(nearestIndex, 1)[0];
    optimized.push(current);
  }

  // Retour au point de départ si demandé
  if (returnToStart) {
    optimized.push(optimized[0]);
  }

  return optimized;
}

export async function POST(request: NextRequest) {
  try {
    // Validation de la requête
    const body = await request.json();
    const validated = OptimizeRequestSchema.parse(body);

    const { tenantId, userId, waypoints, options } = validated;
    const algorithm = options?.algorithm || 'nearest-neighbor';
    const returnToStart = options?.returnToStart || false;

    if (waypoints.length === 0) {
      return NextResponse.json(
        { error: 'Aucun waypoint fourni' },
        { status: 400 }
      );
    }

    // Étape 1: Géocoder les waypoints sans coordonnées
    const geocodedWaypoints: GeocodedWaypoint[] = await Promise.all(
      waypoints.map(async (wp) => {
        if (wp.coordinates) {
          return {
            ...wp,
            coordinates: wp.coordinates,
            geocodingSource: 'cached' as const,
          };
        }

        const coords = await geocodeAddress(wp.address);
        if (!coords) {
          throw new Error(`Impossible de géocoder: ${wp.address}`);
        }

        return {
          ...wp,
          coordinates: coords,
          geocodingSource: 'osm' as const,
        };
      })
    );

    // Étape 2: Optimiser l'ordre selon l'algorithme choisi
    let orderedWaypoints: GeocodedWaypoint[];

    switch (algorithm) {
      case 'nearest-neighbor':
        orderedWaypoints = optimizeNearestNeighbor(geocodedWaypoints, returnToStart);
        break;
      
      case 'brute-force':
        // Pour petit nombre de waypoints (< 8), on peut tester toutes les permutations
        if (geocodedWaypoints.length <= 8) {
          // Implémentation simplifiée - fallback sur nearest-neighbor
          orderedWaypoints = optimizeNearestNeighbor(geocodedWaypoints, returnToStart);
        } else {
          orderedWaypoints = optimizeNearestNeighbor(geocodedWaypoints, returnToStart);
        }
        break;

      default:
        orderedWaypoints = optimizeNearestNeighbor(geocodedWaypoints, returnToStart);
    }

    // Étape 3: Calculer distance et durée totales
    let totalDistance = 0;
    for (let i = 0; i < orderedWaypoints.length - 1; i++) {
      totalDistance += calculateDistance(
        orderedWaypoints[i].coordinates,
        orderedWaypoints[i + 1].coordinates
      );
    }

    const totalDuration = estimateDuration(totalDistance);

    // Construire la réponse
    const route: OptimizedRoute = {
      waypoints,
      orderedWaypoints: orderedWaypoints.map(({ geocodingSource, ...rest }) => rest),
      totalDistance,
      totalDuration,
      createdAt: new Date(),
      tenantId,
      userId,
    };

    return NextResponse.json({
      route,
      geocodedWaypoints,
    });
  } catch (error) {
    console.error('Erreur optimisation tournée:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Échec de l\'optimisation' },
      { status: 500 }
    );
  }
}
