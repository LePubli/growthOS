// ── themes.controller.ts ──────────────────────────────────────
import {
  Controller, Get, Post, Patch, Delete, Param, Body,
  UseGuards, UseInterceptors, UploadedFile, HttpCode, HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, CurrentUser, Public } from '../../common/decorators';
import { ThemeEngineService } from './theme-engine.service';
import { ThemesService } from './themes.service';

@ApiTags('Themes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('themes')
export class ThemesController {
  constructor(
    private readonly engine: ThemeEngineService,
    private readonly themes: ThemesService,
  ) {}

  @Get('active')
  @Public()
  @ApiOperation({ summary: 'Thème actif (public — appelé par ThemeProvider)' })
  async getActive(@CurrentUser() user: any) {
    const tenantId = user?.tenantId;
    if (!tenantId) {
      // Retourne le thème par défaut pour les utilisateurs non authentifiés
      return { slug: 'odoo-default', tokens: {}, name: 'GrowthOS Default' };
    }
    return this.engine.getActiveThemeForTenant(tenantId);
  }

  @Get('css-vars')
  @ApiOperation({ summary: 'CSS variables du thème actif' })
  async getCssVars(@CurrentUser() user: any) {
    const theme = await this.engine.getActiveThemeForTenant(user.tenantId);
    return this.engine.generateCssVariables(theme.tokens || {});
  }

  @Get()
  @ApiOperation({ summary: 'Liste tous les thèmes disponibles' })
  async list() {
    return this.themes.list();
  }

  @Post(':id/activate')
  @Roles('admin', 'owner')
  @ApiOperation({ summary: 'Activer un thème — changement instantané' })
  async activate(@Param('id') id: string, @CurrentUser() user: any) {
    const theme = await this.engine.activateTheme(user.tenantId, id);
    return { message: `Thème "${theme.name}" activé`, theme: theme.name };
  }

  @Post()
  @Roles('admin', 'owner')
  @ApiOperation({ summary: 'Créer un thème custom' })
  async create(@Body() body: any, @CurrentUser() user: any) {
    return this.themes.create(body, user.id);
  }

  @Patch(':id')
  @Roles('admin', 'owner')
  @ApiOperation({ summary: 'Modifier un thème' })
  async update(@Param('id') id: string, @Body() body: any) {
    return this.themes.update(id, body);
  }

  @Patch('custom-tokens')
  @Roles('admin', 'owner')
  @ApiOperation({ summary: 'Override CSS tokens sur le thème actif' })
  async updateTokens(@Body() tokens: Record<string, any>, @CurrentUser() user: any) {
    await this.engine.updateCustomTokens(user.tenantId, tokens);
    return { message: 'Tokens mis à jour' };
  }

  @Post('import')
  @Roles('admin', 'owner')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Importer un thème depuis un fichier JSON' })
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_, file, cb) => {
      if (!file.originalname.endsWith('.json')) return cb(new Error('JSON requis'), false);
      cb(null, true);
    },
  }))
  async import(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: any) {
    const data = JSON.parse(file.buffer.toString());
    return this.themes.importFromJson(data, user.id);
  }

  @Get(':id/export')
  @ApiOperation({ summary: 'Exporter un thème en JSON' })
  async export(@Param('id') id: string) {
    return this.themes.exportToJson(id);
  }

  @Delete(':id')
  @Roles('owner')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.themes.delete(id);
  }
}

// ── themes.service.ts ─────────────────────────────────────────
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
      data: { name: data.name, slug, displayName: data.displayName || data.name, description: data.description, author: data.author || 'Importé', version: data.version || '1.0.0', previewColor: data.previewColor || '#017E84', previewBg: data.previewBg || '#F9F9F9', tokens: data.tokens, isBuiltin: false },
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

// ── themes.module.ts ──────────────────────────────────────────
import { Module } from '@nestjs/common';

@Module({
  controllers: [ThemesController],
  providers: [ThemeEngineService, ThemesService],
  exports: [ThemeEngineService],
})
export class ThemesModule {}
