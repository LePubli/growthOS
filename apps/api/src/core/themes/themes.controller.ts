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
    return this.engine.getActiveThemeForTenant(tenantId);
  }

  @Get('css-vars')
  async getCssVars(@CurrentUser() user: any) {
    const theme = await this.engine.getActiveThemeForTenant(user.tenantId);
    return this.engine.generateCssVariables(theme.tokens || {});
  }

  @Get()
  async list() {
    return this.themes.list();
  }

  // Accepte id OU slug (ex: 'light', 'dark', 'default', ou UUID)
  @Post(':idOrSlug/activate')
  @Roles('admin', 'owner')
  async activate(@Param('idOrSlug') idOrSlug: string, @CurrentUser() user: any) {
    const theme = await this.findByIdOrSlug(idOrSlug);
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

  // ── Helper privé ──────────────────────────────────────────────────────
  private async findByIdOrSlug(idOrSlug: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

    if (isUuid) {
      const t = await this.prisma.theme.findUnique({ where: { id: idOrSlug } });
      if (t) return t;
    }

    // Chercher par slug ou name
    const bySlug = await this.prisma.theme.findFirst({
      where: { OR: [{ slug: idOrSlug }, { name: idOrSlug }] },
    });
    if (bySlug) return bySlug;

    // Créer automatiquement le thème builtin si absent
    const displayName = idOrSlug.charAt(0).toUpperCase() + idOrSlug.slice(1).replace(/-/g, ' ');
    return this.prisma.theme.upsert({
      where: { slug: idOrSlug },
      create: {
        name: displayName,
        slug: idOrSlug,
        displayName,
        isActive: true,
        isBuiltin: true,
        tokens: {},
      },
      update: {},
    });
  }
}
