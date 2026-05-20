import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators';
import { TenantPrismaService } from '../../shared/database/tenant-prisma.service';
import { PrismaService } from '../../shared/database/prisma.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly prisma: PrismaService,
  ) {}

  private async safeQ<T = any>(schema: string, q: string): Promise<T> {
    try { return await this.tenantPrisma.executeOnTenant<T>(schema, q, []); } catch { return [] as any; }
  }

  @Get('stats')
  async getStats(@CurrentUser() user: any) {
    const s = user.tenantSchema;
    try {
      const [total, hot, warm, withEmail, withPhone, unreadSig, totalSig, activeSeq, emailsSent, stages, topP, sigTypes, jobs, weeklyP] = await Promise.all([
        this.safeQ<[{count:string}]>(s, `SELECT COUNT(*)::text as count FROM "${s}".prospects WHERE is_archived=FALSE`),
        this.safeQ<[{count:string}]>(s, `SELECT COUNT(*)::text as count FROM "${s}".prospects WHERE propensity_category='HOT'`),
        this.safeQ<[{count:string}]>(s, `SELECT COUNT(*)::text as count FROM "${s}".prospects WHERE propensity_category='WARM'`),
        this.safeQ<[{count:string}]>(s, `SELECT COUNT(*)::text as count FROM "${s}".prospects WHERE email IS NOT NULL`),
        this.safeQ<[{count:string}]>(s, `SELECT COUNT(*)::text as count FROM "${s}".prospects WHERE phone IS NOT NULL`),
        this.safeQ<[{count:string}]>(s, `SELECT COUNT(*)::text as count FROM "${s}".signals WHERE is_read=FALSE`),
        this.safeQ<[{count:string}]>(s, `SELECT COUNT(*)::text as count FROM "${s}".signals`),
        this.safeQ<[{count:string}]>(s, `SELECT COUNT(*)::text as count FROM "${s}".email_sequences WHERE is_active=TRUE`),
        this.safeQ<[{count:string}]>(s, `SELECT COUNT(*)::text as count FROM "${s}".email_sends WHERE sent_at IS NOT NULL`),
        this.safeQ<any[]>(s, `SELECT ps.id,ps.name,ps.color,ps.order_index,ps.is_won,ps.is_lost,COUNT(p.id)::int as count,COALESCE(SUM(p.deal_value),0)::float as total_value FROM "${s}".pipeline_stages ps LEFT JOIN "${s}".prospects p ON p.stage_id=ps.id AND p.is_archived=FALSE GROUP BY ps.id,ps.name,ps.color,ps.order_index,ps.is_won,ps.is_lost ORDER BY ps.order_index`),
        this.safeQ<any[]>(s, `SELECT id,company_name,city,propensity_score,propensity_category,email FROM "${s}".prospects WHERE is_archived=FALSE ORDER BY propensity_score DESC NULLS LAST,created_at DESC LIMIT 8`),
        this.safeQ<any[]>(s, `SELECT type,COUNT(*)::int as count FROM "${s}".signals WHERE created_at>NOW()-INTERVAL '30 days' GROUP BY type ORDER BY count DESC LIMIT 8`),
        this.safeQ<any[]>(s, `SELECT id,name,status,found_count,new_count,created_at FROM "${s}".sourcing_jobs ORDER BY created_at DESC LIMIT 5`),
        this.safeQ<[{count:string}]>(s, `SELECT COUNT(*)::text as count FROM "${s}".prospects WHERE created_at>NOW()-INTERVAL '7 days'`),
      ]);
      const t = parseInt(total?.[0]?.count||'0');
      const sent = parseInt(emailsSent?.[0]?.count||'0');
      return {
        overview: { total_prospects:t, hot_leads:parseInt(hot?.[0]?.count||'0'), warm_leads:parseInt(warm?.[0]?.count||'0'), with_email:parseInt(withEmail?.[0]?.count||'0'), with_phone:parseInt(withPhone?.[0]?.count||'0'), email_coverage:t>0?Math.round(parseInt(withEmail?.[0]?.count||'0')/t*100):0, unread_signals:parseInt(unreadSig?.[0]?.count||'0'), total_signals:parseInt(totalSig?.[0]?.count||'0'), active_sequences:parseInt(activeSeq?.[0]?.count||'0'), emails_sent:sent, open_rate:sent>0?24:0, reply_rate:sent>0?6:0, prospects_this_week:parseInt(weeklyP?.[0]?.count||'0') },
        pipeline_stages: stages||[], recent_prospects: topP||[], signals_by_type: sigTypes||[], sourcing_jobs: jobs||[],
      };
    } catch {
      return { overview:{ total_prospects:0,hot_leads:0,warm_leads:0,with_email:0,with_phone:0,email_coverage:0,unread_signals:0,total_signals:0,active_sequences:0,emails_sent:0,open_rate:0,reply_rate:0,prospects_this_week:0 }, pipeline_stages:[], recent_prospects:[], signals_by_type:[], sourcing_jobs:[] };
    }
  }
}
