import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Schema de validation pour une Activité
const CreateActivitySchema = z.object({
  type: z.enum(['call', 'meeting', 'email', 'task', 'note']),
  subject: z.string().min(1, "Le sujet est requis"),
  description: z.string().optional(),
  status: z.enum(['scheduled', 'completed', 'cancelled']).default('scheduled'),
  dueDate: z.string().optional(),
  accountId: z.string().optional(),
  contactId: z.string().optional(),
  dealId: z.string().optional(),
  relatedToId: z.string().optional(),
  relatedToType: z.enum(['account', 'deal', 'contact']).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = { id: 'user-123', tenantId: 'tenant-456' };
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const validation = CreateActivitySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.errors }, { status: 400 });
    }

    const data = validation.data;
    
    // Logique de priorité : si des IDs spécifiques sont fournis, on les utilise
    // Sinon on fallback sur relatedToId polymorphique
    const activityData: any = {
      ...data,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      tenantId: user.tenantId,
      ownerId: user.id,
    };

    // Création de l'activité
    const activity = await globalThis.prisma.crmActivity.create({
      data: activityData,
      include: {
        account: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        deal: { select: { id: true, title: true } }
      }
    });

    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    console.error('[CRM Plugin] Error creating activity:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = { id: 'user-123', tenantId: 'tenant-456' };
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const relatedToId = searchParams.get('relatedToId');
    
    const where: any = {
      tenantId: user.tenantId,
      ownerId: user.id,
    };

    if (type) where.type = type;
    if (status) where.status = status;
    if (relatedToId) {
      where.OR = [
        { accountId: relatedToId },
        { contactId: relatedToId },
        { dealId: relatedToId },
      ];
    }

    const activities = await globalThis.prisma.crmActivity.findMany({
      where,
      orderBy: { dueDate: 'desc' },
      include: {
        account: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        deal: { select: { id: true, title: true } }
      },
      take: 50
    });

    return NextResponse.json(activities);
  } catch (error) {
    console.error('[CRM Plugin] Error fetching activities:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
