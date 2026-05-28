import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Schema de validation pour la création d'un Deal
const CreateDealSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  stage: z.enum(['new', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']),
  amount: z.number().optional(),
  currency: z.string().default('EUR'),
  probability: z.number().min(0).max(100).optional(),
  closeDate: z.string().optional(),
  accountId: z.string().optional(),
  contactIds: z.array(z.string()).optional(),
  description: z.string().optional(),
});

const UpdateDealSchema = CreateDealSchema.partial();

// GET: Liste des deals avec pagination et filtres
export async function GET(req: NextRequest) {
  try {
    // TODO: Remplacer par une vraie fonction d'auth
    const user = { id: 'user-123', tenantId: 'tenant-456' }; 
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const stage = searchParams.get('stage');
    const status = searchParams.get('status');
    const cursor = searchParams.get('cursor');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: any = {
      tenantId: user.tenantId,
      ownerId: user.id,
    };

    if (stage) where.stage = stage;
    if (status) where.status = status;

    const deals = await prisma.crmDeal.findMany({
      where,
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { updatedAt: 'desc' },
      include: {
        account: { select: { id: true, name: true } },
        contacts: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { activities: true, products: true } }
      }
    });

    let nextCursor: string | undefined = undefined;
    if (deals.length > limit) {
      const nextItem = deals.pop();
      nextCursor = nextItem?.id;
    }

    return NextResponse.json({
      data: deals,
      nextCursor,
    });
  } catch (error) {
    console.error('[CRM Plugin] Error fetching deals:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Créer un nouveau deal
export async function POST(req: NextRequest) {
  try {
    const user = { id: 'user-123', tenantId: 'tenant-456' };
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const validation = CreateDealSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.errors }, { status: 400 });
    }

    const { contactIds, ...dealData } = validation.data;

    const deal = await prisma.crmDeal.create({
      data: {
        ...dealData,
        closeDate: dealData.closeDate ? new Date(dealData.closeDate) : null,
        tenantId: user.tenantId,
        ownerId: user.id,
        contacts: contactIds && contactIds.length > 0 ? {
          connect: contactIds.map(id => ({ id }))
        } : undefined
      },
      include: {
        account: true,
        contacts: true,
        products: true
      }
    });

    // Hook: Émettre un événement si nécessaire
    // await emitHook('deal:created', { deal, user });

    return NextResponse.json(deal, { status: 201 });
  } catch (error) {
    console.error('[CRM Plugin] Error creating deal:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
