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
