import {
  Controller, Get, Post, Patch, Delete, Param, Body,
  UseGuards, UseInterceptors, UploadedFile, HttpCode, HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, CurrentUser, Public } from '../../common/decorators';
import { ThemeEngineService } from './theme-engine.service';
import { ThemesService } from './themes.service';
import { PrismaService } from '../../shared/database/prisma.service';

// Map slug built-in → nom complet (pour éviter les doublons avec les thèmes en base)
const BUILTIN_SLUGS: Record<string, { name: string; displayName: string; previewColor: string }> = {
  'default':  { name: 'GrowthOS Default', displayName: 'GrowthOS Default',  previewColor: '#0D9488' },
  'dark':     { name: 'Dark Mode',        displayName: 'Dark Mode',          previewColor: '#14B8A6' },
  'light':    { name: 'Light Minimal',    displayName: 'Light Minimal',      previewColor: '#6366F1' },
  'minimal':  { name: 'Light Minimal',    displayName: 'Light Minimal',      previewColor: '#6366F1' },
  'ocean':    { name: 'Ocean Blue',       displayName: 'Ocean Blue',         previewColor: '#3B82F6' },
  'forest':   { name: 'Forest Green',     displayName: 'Forest Green',       previewColor: '#10B981' },
  'sunset':   { name: 'Sunset Orange',    displayName: 'Sunset Orange',      previewColor: '#F97316' },
  'odoo-default': { name: 'GrowthOS Default', displayName: 'GrowthOS Default', previewColor: '#0D9488' },
};

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('themes')
export class ThemesController {
  constructor(
    private readonly engine: ThemeEngineService,
    private readonly themes: ThemesService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('active')
  @Public()
  async getActive(@CurrentUser() user: any) {
    const tenantId = user?.tenantId;
    if (!tenantId) return { slug: 'default', tokens: {}, name: 'GrowthOS Default' };
    try {
      return await this.engine.getActiveThemeForTenant(tenantId);
    } catch {
      return { slug: 'default', tokens: {}, name: 'GrowthOS Default' };
    }
  }

  @Get('css-vars')
  async getCssVars(@CurrentUser() user: any) {
    try {
      const theme = await this.engine.getActiveThemeForTenant(user.tenantId);
      return this.engine.generateCssVariables(theme.tokens || {});
    } catch {
      return {};
    }
  }

  @Get()
  async list() {
    return this.themes.list();
  }

  @Post(':idOrSlug/activate')
  @Roles('admin', 'owner')
  async activate(@Param('idOrSlug') idOrSlug: string, @CurrentUser() user: any) {
    const theme = await this.findOrCreateTheme(idOrSlug);
    const activated = await this.engine.activateTheme(user.tenantId, theme.id);
    return { message: `Thème "${activated.name}" activé`, theme: activated.name };
  }

  @Post()
  @Roles('admin', 'owner')
  async create(@Body() body: any, @CurrentUser() user: any) {
    return this.themes.create(body, user.id);
  }

  @Patch('custom-tokens')
  @Roles('admin', 'owner')
  async updateTokens(@Body() tokens: Record<string, any>, @CurrentUser() user: any) {
    await this.engine.updateCustomTokens(user.tenantId, tokens);
    return { message: 'Tokens mis à jour' };
  }

  @Patch(':id')
  @Roles('admin', 'owner')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.themes.update(id, body);
  }

  @Post('import')
  @Roles('admin', 'owner')
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
  async export(@Param('id') id: string) {
    return this.themes.exportToJson(id);
  }

  @Delete(':id')
  @Roles('owner')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.themes.delete(id);
  }

  // ── Trouve un thème par id/slug ou le crée si absent ─────────────────
  private async findOrCreateTheme(idOrSlug: string) {
    // 1. UUID → chercher par id
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    if (isUuid) {
      const t = await this.prisma.theme.findUnique({ where: { id: idOrSlug } });
      if (t) return t;
    }

    // 2. Chercher par slug
    const bySlug = await this.prisma.theme.findFirst({ where: { slug: idOrSlug } });
    if (bySlug) return bySlug;

    // 3. Chercher par name (ex: 'light' → 'Light Minimal')
    const info = BUILTIN_SLUGS[idOrSlug];
    if (info) {
      const byName = await this.prisma.theme.findFirst({ where: { name: info.name } });
      if (byName) return byName;
    }

    // 4. Créer le thème builtin — seulement les champs requis sans isActive
    const meta = BUILTIN_SLUGS[idOrSlug] || {
      name: idOrSlug.charAt(0).toUpperCase() + idOrSlug.slice(1).replace(/-/g, ' '),
      displayName: idOrSlug.charAt(0).toUpperCase() + idOrSlug.slice(1).replace(/-/g, ' '),
      previewColor: '#0D9488',
    };

    return this.prisma.theme.create({
      data: {
        name: meta.name,
        slug: idOrSlug,
        displayName: meta.displayName,
        isBuiltin: true,
        isPublic: true,
        previewColor: meta.previewColor,
        tokens: {},
        layout: {},
        components: {},
      },
    });
  }
}
