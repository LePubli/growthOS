import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';

@Injectable()
export class SignalsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, filters: { type?: string; unread?: boolean } = {}) {
    const where: any = { tenantId };
    if (filters.type)   where.type   = filters.type;
    if (filters.unread) where.isRead = false;
    return this.prisma.signal.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async markRead(id: string, tenantId: string) {
    return this.prisma.signal.update({ where: { id }, data: { isRead: true } });
  }

  async markAllRead(tenantId: string) {
    return this.prisma.signal.updateMany({ where: { tenantId, isRead: false }, data: { isRead: true } });
  }

  async getStats(tenantId: string) {
    const [total, unread] = await Promise.all([
      this.prisma.signal.count({ where: { tenantId } }),
      this.prisma.signal.count({ where: { tenantId, isRead: false } }),
    ]);
    return { total, unread };
  }
}
