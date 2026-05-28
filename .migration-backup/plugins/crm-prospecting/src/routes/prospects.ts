import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsArray, IsBoolean, IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../../../../../apps/api/src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../../apps/api/src/common/guards/roles.guard';
import { CurrentUser } from '../../../../../apps/api/src/common/decorators';
import { TenantPrismaService } from '../../../../../apps/api/src/shared/database/tenant-prisma.service';
import { EventBusService } from '../../../../../apps/api/src/core/events/event-bus.service';

class ProspectFiltersDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() naf_code?: string;
  @IsOptional() @IsString() propensity_category?: string;
  @IsOptional() @IsString() stage_id?: string;
  @IsOptional() @IsNumber() min_score?: number;
  @IsOptional() @IsBoolean() has_email?: boolean;
  @IsOptional() @IsBoolean() has_phone?: boolean;
  @IsOptional() @IsNumber() page?: number;
  @IsOptional() @IsNumber() page_size?: number;
}

class CreateProspectDto {
  @IsString() company_name: string;
  @IsOptional() @IsString() siren?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() naf_code?: string;
  @IsOptional() @IsString() stage_id?: string;
  @IsOptional() @IsArray() tags?: string[];
}

class UpdateProspectDto {
  @IsOptional() @IsString() company_name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() stage_id?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsArray() tags?: string[];
}

@ApiTags('Prospects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/prospects')
export class ProspectsController {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly events: EventBusService,
  ) {}

  @Get()
  async list(@CurrentUser() user: any, @Query() filters: ProspectFiltersDto) {
    const schema = user.tenantSchema;
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(200, filters.page_size || 50);
    const offset = (page - 1) * limit;

    let where = 'WHERE is_archived = FALSE';
    const params: any[] = [];
    let i = 1;

    if (filters.search) {
      where += ` AND (company_name ILIKE $${i} OR city ILIKE $${i} OR siren = $${i + 1})`;
      params.push(`%${filters.search}%`, filters.search);
      i += 2;
    }
    if (filters.propensity_category) {
      where += ` AND propensity_category = $${i}`;
      params.push(filters.propensity_category); i++;
    }
    if (filters.city) {
      where += ` AND city ILIKE $${i}`;
      params.push(`%${filters.city}%`); i++;
    }
    if (filters.region) {
      where += ` AND region ILIKE $${i}`;
      params.push(`%${filters.region}%`); i++;
    }
    if (filters.naf_code) {
      where += ` AND naf_code = $${i}`;
      params.push(filters.naf_code); i++;
    }
    if (filters.stage_id) {
      where += ` AND stage_id = $${i}`;
      params.push(filters.stage_id); i++;
    }
    if (filters.min_score !== undefined) {
      where += ` AND propensity_score >= $${i}`;
      params.push(filters.min_score); i++;
    }
    if (filters.has_email === true) { where += ' AND email IS NOT NULL'; }
    if (filters.has_phone === true) { where += ' AND phone IS NOT NULL'; }

    const [items, countResult] = await Promise.all([
      this.tenantPrisma.executeOnTenant<any[]>(
        schema,
        `SELECT * FROM "${schema}".prospects ${where} ORDER BY propensity_score DESC NULLS LAST, created_at DESC LIMIT ${limit} OFFSET ${offset}`,
        params,
      ),
      this.tenantPrisma.executeOnTenant<[{ count: string }]>(
        schema,
        `SELECT COUNT(*)::text as count FROM "${schema}".prospects ${where}`,
        params,
      ),
    ]);

    return {
      items,
      total: parseInt(countResult[0]?.count || '0'),
      page,
      page_size: limit,
      pages: Math.ceil(parseInt(countResult[0]?.count || '0') / limit),
    };
  }

  @Get('stats')
  async stats(@CurrentUser() user: any) {
    const schema = user.tenantSchema;

    const [total, hot, warm, cold, withEmail, withPhone, withWebsite] = await Promise.all([
      this.tenantPrisma.executeOnTenant<[{ count: string }]>(schema, `SELECT COUNT(*)::text as count FROM "${schema}".prospects WHERE is_archived = FALSE`, []),
      this.tenantPrisma.executeOnTenant<[{ count: string }]>(schema, `SELECT COUNT(*)::text as count FROM "${schema}".prospects WHERE propensity_category = 'HOT'`, []),
      this.tenantPrisma.executeOnTenant<[{ count: string }]>(schema, `SELECT COUNT(*)::text as count FROM "${schema}".prospects WHERE propensity_category = 'WARM'`, []),
      this.tenantPrisma.executeOnTenant<[{ count: string }]>(schema, `SELECT COUNT(*)::text as count FROM "${schema}".prospects WHERE propensity_category = 'COLD'`, []),
      this.tenantPrisma.executeOnTenant<[{ count: string }]>(schema, `SELECT COUNT(*)::text as count FROM "${schema}".prospects WHERE email IS NOT NULL`, []),
      this.tenantPrisma.executeOnTenant<[{ count: string }]>(schema, `SELECT COUNT(*)::text as count FROM "${schema}".prospects WHERE phone IS NOT NULL`, []),
      this.tenantPrisma.executeOnTenant<[{ count: string }]>(schema, `SELECT COUNT(*)::text as count FROM "${schema}".prospects WHERE website IS NOT NULL`, []),
    ]);

    const t = parseInt(total[0]?.count || '0');
    return {
      total: t,
      hot: parseInt(hot[0]?.count || '0'),
      warm: parseInt(warm[0]?.count || '0'),
      cold: parseInt(cold[0]?.count || '0'),
      with_email: parseInt(withEmail[0]?.count || '0'),
      with_phone: parseInt(withPhone[0]?.count || '0'),
      with_website: parseInt(withWebsite[0]?.count || '0'),
      email_coverage: t > 0 ? Math.round(parseInt(withEmail[0]?.count || '0') / t * 100) : 0,
    };
  }

  @Get(':id')
  async get(@Param('id') id: string, @CurrentUser() user: any) {
    const schema = user.tenantSchema;
    const rows = await this.tenantPrisma.executeOnTenant<any[]>(
      schema,
      `SELECT p.*, ps.name as stage_name, ps.color as stage_color
       FROM "${schema}".prospects p
       LEFT JOIN "${schema}".pipeline_stages ps ON p.stage_id = ps.id
       WHERE p.id = $1`,
      [id],
    );
    return rows[0] || null;
  }

  @Post()
  async create(@Body() dto: CreateProspectDto, @CurrentUser() user: any) {
    const schema = user.tenantSchema;
    const rows = await this.tenantPrisma.executeOnTenant<any[]>(
      schema,
      `INSERT INTO "${schema}".prospects (company_name, siren, city, region, phone, email, website, naf_code, stage_id, tags, sources_used)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, '["manual"]'::jsonb)
       RETURNING *`,
      [dto.company_name, dto.siren || null, dto.city || null, dto.region || null, dto.phone || null, dto.email || null, dto.website || null, dto.naf_code || null, dto.stage_id || null, JSON.stringify(dto.tags || [])],
    );
    const prospect = rows[0];
    await this.events.publish({ name: 'prospect.created', tenantId: user.tenantId, payload: { id: prospect.id, company_name: prospect.company_name }, source: 'crm-prospecting' });
    return prospect;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateProspectDto, @CurrentUser() user: any) {
    const schema = user.tenantSchema;
    const sets: string[] = [];
    const params: any[] = [];
    let i = 1;

    const fields = ['company_name', 'phone', 'email', 'website', 'stage_id', 'notes'] as const;
    for (const f of fields) {
      if (dto[f] !== undefined) { sets.push(`${f} = $${i}`); params.push(dto[f]); i++; }
    }
    if (dto.tags !== undefined) { sets.push(`tags = $${i}::jsonb`); params.push(JSON.stringify(dto.tags)); i++; }
    if (!sets.length) return { id };

    params.push(id);
    const rows = await this.tenantPrisma.executeOnTenant<any[]>(
      schema,
      `UPDATE "${schema}".prospects SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
      params,
    );

    await this.events.publish({ name: 'prospect.updated', tenantId: user.tenantId, payload: { id }, source: 'crm-prospecting' });
    return rows[0];
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async archive(@Param('id') id: string, @CurrentUser() user: any) {
    const schema = user.tenantSchema;
    await this.tenantPrisma.executeOnTenant(schema, `UPDATE "${schema}".prospects SET is_archived = TRUE WHERE id = $1`, [id]);
  }

  @Post('bulk-delete')
  async bulkDelete(@Body() body: { ids: string[] }, @CurrentUser() user: any) {
    const schema = user.tenantSchema;
    await this.tenantPrisma.executeOnTenant(schema, `UPDATE "${schema}".prospects SET is_archived = TRUE WHERE id = ANY($1::uuid[])`, [body.ids]);
    return { deleted: body.ids.length };
  }

  @Get(':id/activities')
  async getActivities(@Param('id') id: string, @CurrentUser() user: any) {
    const schema = user.tenantSchema;
    return this.tenantPrisma.executeOnTenant<any[]>(
      schema,
      `SELECT * FROM "${schema}".activities WHERE prospect_id = $1 ORDER BY created_at DESC`,
      [id],
    );
  }

  @Post(':id/activities')
  async addActivity(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: any) {
    const schema = user.tenantSchema;
    const rows = await this.tenantPrisma.executeOnTenant<any[]>(
      schema,
      `INSERT INTO "${schema}".activities (prospect_id, user_id, type, title, description, due_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, user.id, dto.type, dto.title, dto.description, dto.due_at || null],
    );
    return rows[0];
  }
}

// Pipeline Controller
@ApiTags('Pipeline')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/pipeline')
export class PipelineController {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  @Get()
  async getPipeline(@CurrentUser() user: any) {
    const schema = user.tenantSchema;
    const stages = await this.tenantPrisma.executeOnTenant<any[]>(
      schema,
      `SELECT ps.*, COUNT(p.id)::int as prospect_count, COALESCE(SUM(p.deal_value), 0) as total_value
       FROM "${schema}".pipeline_stages ps
       LEFT JOIN "${schema}".prospects p ON p.stage_id = ps.id AND p.is_archived = FALSE
       ORDER BY ps.order_index`,
      [],
    );
    return stages;
  }

  @Post('move')
  async moveProspect(@Body() dto: { prospectId: string; stageId: string }, @CurrentUser() user: any) {
    const schema = user.tenantSchema;
    await this.tenantPrisma.executeOnTenant(
      schema,
      `UPDATE "${schema}".prospects SET stage_id = $1, updated_at = NOW() WHERE id = $2`,
      [dto.stageId, dto.prospectId],
    );
    return { moved: true };
  }

  @Get('stages')
  async getStages(@CurrentUser() user: any) {
    const schema = user.tenantSchema;
    return this.tenantPrisma.executeOnTenant<any[]>(schema, `SELECT * FROM "${schema}".pipeline_stages ORDER BY order_index`, []);
  }
}

// Router export (compatible NestJS)
import { Module } from '@nestjs/common';

@Module({
  controllers: [ProspectsController, PipelineController],
})
export class CrmProspectingRoutesModule {}

export const router = CrmProspectingRoutesModule;
