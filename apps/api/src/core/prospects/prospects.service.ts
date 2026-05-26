import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface CreateProspectDto {
  firstName?:   string;
  lastName?:    string;
  email?:       string;
  phone?:       string;
  company?:     string;
  jobTitle?:    string;
  website?:     string;
  linkedinUrl?: string;
  status?:      string;
  score?:       number;
  tags?:        string[];
  notes?:       string;
}

@Injectable()
export class ProspectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emitter: EventEmitter2,
  ) {}

  async findAll(tenantId: string, filters: {
    search?: string; status?: string;
    page?: number; limit?: number;
    orderBy?: string; order?: 'asc' | 'desc';
  } = {}) {
    const { search, status, page = 1, limit = 50, orderBy = 'createdAt', order = 'desc' } = filters;
    const skip = (page - 1) * limit;
    const where: any = { tenantId };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { firstName:  { contains: search, mode: 'insensitive' } },
        { lastName:   { contains: search, mode: 'insensitive' } },
        { email:      { contains: search, mode: 'insensitive' } },
        { company:    { contains: search, mode: 'insensitive' } },
        { jobTitle:   { contains: search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.prospect.findMany({ where, skip, take: limit, orderBy: { [orderBy]: order } }),
      this.prisma.prospect.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, tenantId: string) {
    const p = await this.prisma.prospect.findFirst({ where: { id, tenantId } });
    if (!p) throw new NotFoundException(`Prospect ${id} introuvable`);
    return p;
  }

  async create(tenantId: string, dto: CreateProspectDto) {
    const prospect = await this.prisma.prospect.create({
      data: {
        ...dto,
        tenantId,
        status: dto.status || 'new',
        score:  dto.score  || 0,
        tags:   dto.tags   || [],
      },
    });

    // ← Émettre l'événement pour les plugins
    this.emitter.emit('prospect.created', { tenantId, prospect });

    return prospect;
  }

  async update(id: string, tenantId: string, dto: Partial<CreateProspectDto>) {
    await this.findOne(id, tenantId);
    const updated = await this.prisma.prospect.update({ where: { id }, data: dto });

    // ← Émettre l'événement pour les plugins
    this.emitter.emit('prospect.updated', { tenantId, prospect: updated });

    return updated;
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.prospect.delete({ where: { id } });
  }

  async bulkCreate(tenantId: string, prospects: CreateProspectDto[]) {
    const data = prospects.map(p => ({
      ...p, tenantId,
      status: p.status || 'new', score: p.score || 0, tags: p.tags || [],
    }));
    const result = await this.prisma.prospect.createMany({ data, skipDuplicates: true });

    // Émettre un événement global pour l'import en masse
    this.emitter.emit('prospects.bulk_created', { tenantId, count: result.count });

    return result;
  }

  async getStats(tenantId: string) {
    const [total, byStatus] = await Promise.all([
      this.prisma.prospect.count({ where: { tenantId } }),
      this.prisma.prospect.groupBy({
        by: ['status'], where: { tenantId }, _count: { status: true },
      }),
    ]);
    return {
      total,
      byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s.status]: s._count.status }), {}),
    };
  }
}
