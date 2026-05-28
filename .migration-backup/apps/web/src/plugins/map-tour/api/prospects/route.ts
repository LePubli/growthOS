/**
 * ============================================================
 * Map Tour Plugin - API Route Handler (Prospects)
 * ============================================================
 * GET /api/v1/plugins/map-tour/prospects
 * 
 * Récupère la liste des prospects et clients avec leurs adresses
 * pour permettre à l'utilisateur de les ajouter à sa tournée.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const QuerySchema = z.object({
  tenantId: z.string().min(1),
  search: z.string().optional(),
  type: z.enum(['prospect', 'client', 'all']).optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const validated = QuerySchema.parse({
      tenantId: searchParams.get('tenantId'),
      search: searchParams.get('search'),
      type: searchParams.get('type') || 'all',
      limit: searchParams.get('limit'),
    });

    const { tenantId, search, type, limit } = validated;

    // TODO: Remplacer par un vrai appel Prisma
    // Exemple:
    // const prospects = await prisma.prospect.findMany({
    //   where: {
    //     tenantId,
    //     AND: [
    //       search ? {
    //         OR: [
    //           { name: { contains: search, mode: 'insensitive' } },
    //           { company: { contains: search, mode: 'insensitive' } },
    //         ]
    //       } : {},
    //       type !== 'all' ? { type } : {},
    //     ],
    //   },
    //   select: {
    //     id: true,
    //     name: true,
    //     company: true,
    //     address: true,
    //     type: true,
    //   },
    //   take: limit,
    //   orderBy: { createdAt: 'desc' },
    // });

    // Données mockées pour démonstration
    const mockProspects = [
      {
        id: '1',
        name: 'Jean Dupont',
        company: 'TechCorp',
        address: '10 Rue de la Paix, 75002 Paris',
        type: 'prospect' as const,
      },
      {
        id: '2',
        name: 'Marie Martin',
        company: 'Innovate SAS',
        address: '25 Avenue des Champs-Élysées, 75008 Paris',
        type: 'client' as const,
      },
      {
        id: '3',
        name: 'Pierre Durand',
        company: 'StartupLab',
        address: '15 Boulevard Haussmann, 75009 Paris',
        type: 'prospect' as const,
      },
      {
        id: '4',
        name: 'Sophie Bernard',
        company: 'DigitalFirst',
        address: '8 Rue du Faubourg Saint-Honoré, 75008 Paris',
        type: 'client' as const,
      },
      {
        id: '5',
        name: 'Lucas Petit',
        company: 'GrowthHub',
        address: '30 Rue de Rivoli, 75004 Paris',
        type: 'prospect' as const,
      },
    ];

    let results = mockProspects.filter(p => p.type === type || type === 'all');

    if (search) {
      const searchLower = search.toLowerCase();
      results = results.filter(
        p =>
          p.name.toLowerCase().includes(searchLower) ||
          p.company?.toLowerCase().includes(searchLower)
      );
    }

    results = results.slice(0, limit);

    return NextResponse.json({
      prospects: results,
      total: results.length,
    });
  } catch (error) {
    console.error('Erreur récupération prospects:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Paramètres invalides', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Échec de la récupération des prospects' },
      { status: 500 }
    );
  }
}
