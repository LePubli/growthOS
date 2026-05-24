import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';

export interface CreateSequenceDto {
  name:         string;
  description?: string;
  status?:      string;
  steps?:       any[];
}

@Injectable()
export class SequencesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.emailSequence.findMany({
      where: { tenantId }, orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const s = await this.prisma.emailSequence.findFirst({ where: { id, tenantId } });
    if (!s) throw new NotFoundException(`Séquence ${id} introuvable`);
    return s;
  }

  async create(tenantId: string, dto: CreateSequenceDto) {
    return this.prisma.emailSequence.create({
      data: { ...dto, tenantId, status: dto.status || 'draft', steps: dto.steps || [] },
    });
  }

  async update(id: string, tenantId: string, dto: Partial<CreateSequenceDto>) {
    await this.findOne(id, tenantId);
    return this.prisma.emailSequence.update({ where: { id }, data: dto });
  }

  async toggle(id: string, tenantId: string) {
    const seq = await this.findOne(id, tenantId);
    const newStatus = seq.status === 'active' ? 'paused' : 'active';
    return this.prisma.emailSequence.update({ where: { id }, data: { status: newStatus } });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.emailSequence.delete({ where: { id } });
  }
}
