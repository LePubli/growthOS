import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators';
import { PrismaService } from '../../shared/database/prisma.service';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('stats')
  async getStats(@CurrentUser() user: any) {
    const tenantId = user?.tenantId;

    try {
      // ── Utilise les vraies tables Prisma (schema public) ──────────────
      const [
        totalProspects,
        prospectsByStatus,
        recentProspects,
        totalDeals,
        dealsByStage,
        wonValue,
        totalSignals,
        unreadSignals,
        signalsByType,
        totalSequences,
        activeSequences,
      ] = await Promise.all([
        // Prospects
        this.prisma.prospect.count({ where: { tenantId } }),
        this.prisma.prospect.groupBy({
          by: ['status'], where: { tenantId },
          _count: { status: true },
        }),
        this.prisma.prospect.findMany({
          where: { tenantId },
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: { id:true, firstName:true, lastName:true, company:true, email:true, score:true, status:true, createdAt:true },
        }),
        // Deals
        this.prisma.deal.count({ where: { tenantId } }),
        this.prisma.deal.groupBy({
          by: ['stage'], where: { tenantId },
          _count: { stage: true },
          _sum: { value: true },
        }),
        this.prisma.deal.aggregate({
          where: { tenantId, stage: 'won' },
          _sum: { value: true },
        }),
        // Signals
        this.prisma.signal.count({ where: { tenantId } }),
        this.prisma.signal.count({ where: { tenantId, isRead: false } }),
        this.prisma.signal.groupBy({
          by: ['type'], where: { tenantId },
          _count: { type: true },
        }),
        // Sequences
        this.prisma.emailSequence.count({ where: { tenantId } }),
        this.prisma.emailSequence.count({ where: { tenantId, status: 'active' } }),
      ]);

      // ── Calculs ──────────────────────────────────────────────────────
      const statusMap = prospectsByStatus.reduce((acc, s) => ({
        ...acc, [s.status]: s._count.status,
      }), {} as Record<string, number>);

      const stageMap = dealsByStage.map(s => ({
        stage: s.stage,
        count: s._count.stage,
        value: s._sum.value || 0,
      }));

      const pipelineValue = dealsByStage
        .filter(s => s.stage !== 'won' && s.stage !== 'lost')
        .reduce((sum, s) => sum + (s._sum.value || 0), 0);

      const withEmail = await this.prisma.prospect.count({
        where: { tenantId, email: { not: null } },
      });
      const withPhone = await this.prisma.prospect.count({
        where: { tenantId, phone: { not: null } },
      });
      const thisWeek = await this.prisma.prospect.count({
        where: { tenantId, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      });

      return {
        overview: {
          total_prospects: totalProspects,
          hot_leads: (statusMap['qualified'] || 0) + (statusMap['negotiation'] || 0),
          warm_leads: statusMap['contacted'] || 0,
          new_leads: statusMap['new'] || 0,
          won: statusMap['won'] || 0,
          with_email: withEmail,
          with_phone: withPhone,
          email_coverage: totalProspects > 0 ? Math.round(withEmail / totalProspects * 100) : 0,
          prospects_this_week: thisWeek,
          // Deals
          total_deals: totalDeals,
          pipeline_value: pipelineValue,
          won_value: wonValue._sum.value || 0,
          // Signals
          total_signals: totalSignals,
          unread_signals: unreadSignals,
          // Sequences
          total_sequences: totalSequences,
          active_sequences: activeSequences,
          // Mocks pour métriques email (pas encore de vrai envoi)
          emails_sent: activeSequences * 12,
          open_rate: activeSequences > 0 ? 42.3 : 0,
          reply_rate: activeSequences > 0 ? 6.8 : 0,
        },
        pipeline_stages: stageMap,
        recent_prospects: recentProspects.map(p => ({
          id: p.id,
          company_name: p.company,
          full_name: `${p.firstName || ''} ${p.lastName || ''}`.trim(),
          email: p.email,
          propensity_score: p.score,
          propensity_category: (p.score || 0) >= 80 ? 'HOT' : (p.score || 0) >= 50 ? 'WARM' : 'COLD',
          created_at: p.createdAt,
          status: p.status,
        })),
        signals_by_type: signalsByType.map(s => ({
          type: s.type,
          count: s._count.type,
        })),
        sourcing_jobs: [],
      };
    } catch (e) {
      return {
        overview: {
          total_prospects: 0, hot_leads: 0, warm_leads: 0, new_leads: 0,
          won: 0, with_email: 0, with_phone: 0, email_coverage: 0,
          prospects_this_week: 0, total_deals: 0, pipeline_value: 0,
          won_value: 0, total_signals: 0, unread_signals: 0,
          total_sequences: 0, active_sequences: 0,
          emails_sent: 0, open_rate: 0, reply_rate: 0,
        },
        pipeline_stages: [], recent_prospects: [], signals_by_type: [], sourcing_jobs: [],
        _error: (e as Error).message,
      };
    }
  }
}
