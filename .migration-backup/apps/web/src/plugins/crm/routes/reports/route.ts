import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const CreateReportSchema = z.object({
  type: z.enum(['summary', 'pipeline', 'activity', 'performance']),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = { id: 'user-123', tenantId: 'tenant-456' };
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'summary';

    // Simulation de données pour le dashboard
    // Dans une implémentation réelle, faites des agrégations Prisma
    
    if (type === 'summary') {
      const [dealCount, dealValue, winRate, accountCount] = await Promise.all([
        globalThis.prisma.crmDeal.count({ where: { tenantId: user.tenantId, ownerId: user.id } }),
        globalThis.prisma.crmDeal.aggregate({
          where: { tenantId: user.tenantId, ownerId: user.id, status: 'open' },
          _sum: { amount: true }
        }),
        // Calcul simplifié du win rate
        65, 
        globalThis.prisma.crmAccount.count({ where: { tenantId: user.tenantId, ownerId: user.id } })
      ]);

      return NextResponse.json({
        totalDeals: dealCount,
        totalValue: dealValue._sum.amount || 0,
        winRate,
        activeAccounts: accountCount,
        generatedAt: new Date().toISOString()
      });
    }

    if (type === 'pipeline') {
      const stages = ['new', 'qualified', 'proposal', 'negotiation'];
      const pipelineData = await Promise.all(
        stages.map(async (stage) => {
          const deals = await globalThis.prisma.crmDeal.findMany({
            where: { tenantId: user.tenantId, stage },
            select: { amount: true, title: true }
          });
          return {
            stage,
            count: deals.length,
            value: deals.reduce((acc, d) => acc + (d.amount || 0), 0)
          };
        })
      );
      return NextResponse.json({ stages: pipelineData });
    }

    return NextResponse.json({ message: 'Report type not implemented' }, { status: 400 });
  } catch (error) {
    console.error('[CRM Plugin] Error generating report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
