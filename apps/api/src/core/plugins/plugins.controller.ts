import {
  Controller, Get, Post, Patch, Delete, Param, Body,
  UseGuards, UseInterceptors, UploadedFile, Query,
  ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody, ApiOperation } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, CurrentUser } from '../../common/decorators';
import { PluginsService } from './plugins.service';

@ApiTags('Plugins')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('plugins')
export class PluginsController {
  constructor(private readonly plugins: PluginsService) {}

  // ── Marketplace ──────────────────────────────────────────────

  @Get('marketplace')
  @ApiOperation({ summary: 'Liste tous les plugins disponibles dans la marketplace' })
  async marketplace(
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('page') page: number = 1,
  ) {
    return this.plugins.listMarketplace({ category, search, page });
  }

  // ── Plugins du tenant ────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Liste tous les plugins (installés + disponibles) pour ce tenant' })
  async list(@CurrentUser() user: any) {
    return this.plugins.listForTenant(user.tenantId);
  }

  @Get(':name')
  @ApiOperation({ summary: 'Détail d\'un plugin' })
  async get(@Param('name') name: string, @CurrentUser() user: any) {
    return this.plugins.getPlugin(name, user.tenantId);
  }

  // ── Installation depuis ZIP ───────────────────────────────────

  @Post('upload')
  @Roles('admin', 'owner')
  @ApiOperation({ summary: 'Upload et install un plugin ZIP' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
    fileFilter: (_, file, cb) => {
      if (!file.originalname.endsWith('.zip')) {
        return cb(new Error('Seuls les fichiers .zip sont acceptés'), false);
      }
      cb(null, true);
    },
  }))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    return this.plugins.installFromZip(
      user.tenantId,
      user.id,
      file.buffer,
      file.originalname,
    );
  }

  // ── Activation / Désactivation ───────────────────────────────

  @Post(':name/activate')
  @Roles('admin', 'owner')
  @ApiOperation({ summary: 'Activer un plugin (hot-reload instantané)' })
  async activate(@Param('name') name: string, @CurrentUser() user: any) {
    await this.plugins.activate(user.tenantId, name, user.id);
    return { plugin: name, status: 'active', hotReload: true };
  }

  @Post(':name/deactivate')
  @Roles('admin', 'owner')
  @ApiOperation({ summary: 'Désactiver un plugin (hot-reload instantané)' })
  async deactivate(@Param('name') name: string, @CurrentUser() user: any) {
    await this.plugins.deactivate(user.tenantId, name);
    return { plugin: name, status: 'inactive', hotReload: true };
  }

  @Post(':name/toggle')
  @Roles('admin', 'owner')
  @ApiOperation({ summary: 'Toggle ON/OFF d\'un plugin' })
  async toggle(@Param('name') name: string, @CurrentUser() user: any) {
    return this.plugins.toggle(user.tenantId, name, user.id);
  }

  // ── Configuration ────────────────────────────────────────────

  @Get(':name/config')
  @ApiOperation({ summary: 'Lire la config d\'un plugin pour ce tenant' })
  async getConfig(@Param('name') name: string, @CurrentUser() user: any) {
    return this.plugins.getConfig(user.tenantId, name);
  }

  @Patch(':name/config')
  @Roles('admin', 'owner')
  @ApiOperation({ summary: 'Mettre à jour la config d\'un plugin' })
  async updateConfig(
    @Param('name') name: string,
    @Body() config: Record<string, any>,
    @CurrentUser() user: any,
  ) {
    await this.plugins.updateConfig(user.tenantId, name, config);
    return { plugin: name, config };
  }

  // ── Menu items dynamiques ─────────────────────────────────────

  @Get('menu/items')
  @ApiOperation({ summary: 'Menu items injectés par les plugins actifs' })
  async menuItems(@CurrentUser() user: any) {
    return this.plugins.getMenuItems(user.tenantId);
  }

  // ── Désinstallation ───────────────────────────────────────────

  @Delete(':name')
  @Roles('owner')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Désinstaller un plugin (owner seulement)' })
  async uninstall(@Param('name') name: string, @CurrentUser() user: any) {
    await this.plugins.uninstall(user.tenantId, name);
  }
}
