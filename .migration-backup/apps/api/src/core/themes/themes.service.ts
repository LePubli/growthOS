import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { randomUUID } from 'crypto';

@Injectable()
export class ThemesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.theme.findMany({ orderBy: [{ isBuiltin: 'desc' }, { name: 'asc' }] });
  }

  async create(data: any, userId: string) {
    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const existing = await this.prisma.theme.findUnique({ where: { slug } });
    if (existing) throw new BadRequestException(`Slug '${slug}' déjà utilisé`);

    return this.prisma.theme.create({
      data: { ...data, slug, isBuiltin: false, isPublic: false },
    });
  }

  async update(id: string, data: any) {
    const theme = await this.prisma.theme.findUnique({ where: { id } });
    if (!theme) throw new NotFoundException('Thème introuvable');
    return this.prisma.theme.update({ where: { id }, data });
  }

  async importFromJson(data: any, userId: string) {
    if (!data.name || !data.tokens) throw new BadRequestException('Format invalide — name + tokens requis');
    const slug = `${data.slug || data.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${randomUUID().slice(0, 6)}`;
    return this.prisma.theme.create({
      data: { 
        name: data.name, 
        slug, 
        displayName: data.displayName || data.name, 
        description: data.description, 
        author: data.author || 'Importé', 
        version: data.version || '1.0.0', 
        previewColor: data.previewColor || '#017E84', 
        previewBg: data.previewBg || '#F9F9F9', 
        tokens: data.tokens, 
        isBuiltin: false 
      },
    });
  }

  async exportToJson(id: string) {
    const theme = await this.prisma.theme.findUnique({ where: { id } });
    if (!theme) throw new NotFoundException('Thème introuvable');
    const { id: _, createdAt, updatedAt, ...exportable } = theme;
    return { ...exportable, exportedAt: new Date().toISOString(), format: 'growthos-theme-v1' };
  }

  async delete(id: string) {
    const theme = await this.prisma.theme.findUnique({ where: { id } });
    if (!theme) throw new NotFoundException('Thème introuvable');
    if (theme.isBuiltin) throw new BadRequestException('Impossible de supprimer un thème builtin');
    await this.prisma.theme.delete({ where: { id } });
  }
}
