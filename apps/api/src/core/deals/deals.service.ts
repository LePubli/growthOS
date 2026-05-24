import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';

export interface CreateDealDto {
  title:        string;
  company?:     string;
  contact?:     string;
  value?:       number;
  probability?: number;
  stage?:       string;
  dueDate?:     string;
  tags?:        string[];
  prospectId?:  string;
}

@Injectable()
export class DealsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, stage?: string) {
    const where: any = { tenantId };
    if (stage) where.stage = stage;
    return this.prisma.deal.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string, tenantId: string) {
    const d = await this.prisma.deal.findFirst({ where: { id, tenantId } });
    if (!d) throw new NotFoundException(`Deal ${id} introuvable`);
    return d;
  }

  async create(tenantId: string, dto: CreateDealDto) {
    return this.prisma.deal.create({
      data: {
        ...dto,
        tenantId,
        stage:       dto.stage       || 'lead',
        value:       dto.value       || 0,
        probability: dto.probability || 0,
        tags:        dto.tags        || [],
        dueDate:     dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });
  }

  async update(id: string, tenantId: string, dto: Partial<CreateDealDto>) {
    await this.findOne(id, tenantId);
    return this.prisma.deal.update({
      where: { id },
      data: { ...dto, dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined },
    });
  }

  async moveStage(id: string, tenantId: string, stage: string) {
    return this.update(id, tenantId, { stage });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.deal.delete({ where: { id } });
  }

  async getPipelineStats(tenantId: string) {
    const [grouped, deals] = await Promise.all([
      this.prisma.deal.groupBy({ by: ['stage'], where: { tenantId }, _count: { stage: true }, _sum: { value: true } }),
      this.prisma.deal.findMany({ where: { tenantId }, select: { stage: true, value: true } }),
    ]);
    return grouped.map(g => ({
      stage: g.stage,
      count: g._count.stage,
      value: g._sum.value || 0,
    }));
  }
}
