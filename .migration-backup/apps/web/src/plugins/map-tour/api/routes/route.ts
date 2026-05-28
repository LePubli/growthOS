/**
 * ============================================================
 * Map Tour Plugin - API Route Handler (Routes CRUD)
 * ============================================================
 * GET  /api/v1/plugins/map-tour/routes - Liste des tournées sauvegardées
 * POST /api/v1/plugins/map-tour/routes - Créer une nouvelle tournée
 * DELETE /api/v1/plugins/map-tour/routes/:id - Supprimer une tournée
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const CreateRouteSchema = z.object({
  tenantId: z.string().min(1),
  userId: z.string().min(1),
  name: z.string().min(1).max(200),
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
  totalDistance: z.number().positive(),
  totalDuration: z.number().positive(),
});

// Store in-memory pour démonstration (à remplacer par Prisma)
const savedRoutes = new Map<string, any>();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const userId = searchParams.get('userId');

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'tenantId et userId requis' },
        { status: 400 }
      );
    }

    // Filtrer les routes par tenant et user
    const routes = Array.from(savedRoutes.values()).filter(
      (r) => r.tenantId === tenantId && r.userId === userId
    );

    return NextResponse.json({
      routes,
      total: routes.length,
    });
  } catch (error) {
    console.error('Erreur récupération routes:', error);
    return NextResponse.json(
      { error: 'Échec de la récupération des tournées' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = CreateRouteSchema.parse(body);

    const { tenantId, userId, name, waypoints, totalDistance, totalDuration } = validated;

    // Créer un ID unique
    const routeId = `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newRoute = {
      id: routeId,
      name,
      tenantId,
      userId,
      waypoints,
      orderedWaypoints: waypoints, // L'ordre optimisé vient déjà du frontend
      totalDistance,
      totalDuration,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Sauvegarder
    savedRoutes.set(routeId, newRoute);

    return NextResponse.json({
      success: true,
      route: newRoute,
    }, { status: 201 });
  } catch (error) {
    console.error('Erreur création route:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Échec de la création de la tournée' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const routeId = searchParams.get('id');

    if (!routeId) {
      return NextResponse.json(
        { error: 'ID de tournée requis' },
        { status: 400 }
      );
    }

    const deleted = savedRoutes.delete(routeId);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Tournée non trouvée' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Tournée supprimée avec succès',
    });
  } catch (error) {
    console.error('Erreur suppression route:', error);
    return NextResponse.json(
      { error: 'Échec de la suppression de la tournée' },
      { status: 500 }
    );
  }
}
