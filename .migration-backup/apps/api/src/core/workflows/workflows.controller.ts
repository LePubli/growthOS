import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, Roles } from '../../common/decorators';
import { WorkflowEngineService } from './workflow-engine.service';
import { TenantPrismaService } from '../../shared/database/tenant-prisma.service';

@ApiTags('Workflows')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('workflows')
export class WorkflowsController {
  constructor(
    private readonly engine: WorkflowEngineService,
    private readonly tenantPrisma: TenantPrismaService,
  ) {}

  @Get()
  async list(@CurrentUser() user: any) {
    return this.tenantPrisma.executeOnTenant<any[]>(
      user.tenantSchema,
      `SELECT id, name, description, trigger_type, trigger_config, is_active, run_count, last_run_at, created_at
       FROM "${user.tenantSchema}".workflows ORDER BY created_at DESC`,
      [],
    );
  }

  @Get(':id')
  async get(@Param('id') id: string, @CurrentUser() user: any) {
    const rows = await this.tenantPrisma.executeOnTenant<any[]>(
      user.tenantSchema,
      `SELECT * FROM "${user.tenantSchema}".workflows WHERE id = $1`,
      [id],
    );
    return rows[0] || null;
  }

  @Post()
  @Roles('admin', 'owner', 'manager')
  async create(@Body() dto: any, @CurrentUser() user: any) {
    const rows = await this.tenantPrisma.executeOnTenant<any[]>(
      user.tenantSchema,
      `INSERT INTO "${user.tenantSchema}".workflows (name, description, trigger_type, trigger_config, steps, is_active, created_by)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7) RETURNING *`,
      [dto.name, dto.description || null, dto.trigger_type || 'manual', JSON.stringify(dto.trigger_config || {}), JSON.stringify(dto.steps || []), dto.is_active !== false, user.id],
    );
    return rows[0];
  }

  @Patch(':id')
  @Roles('admin', 'owner', 'manager')
  async update(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: any) {
    const sets: string[] = [];
    const params: any[] = [];
    let i = 1;

    if (dto.name !== undefined) { sets.push(`name = $${i}`); params.push(dto.name); i++; }
    if (dto.description !== undefined) { sets.push(`description = $${i}`); params.push(dto.description); i++; }
    if (dto.trigger_type !== undefined) { sets.push(`trigger_type = $${i}`); params.push(dto.trigger_type); i++; }
    if (dto.trigger_config !== undefined) { sets.push(`trigger_config = $${i}::jsonb`); params.push(JSON.stringify(dto.trigger_config)); i++; }
    if (dto.steps !== undefined) { sets.push(`steps = $${i}::jsonb`); params.push(JSON.stringify(dto.steps)); i++; }
    if (dto.is_active !== undefined) { sets.push(`is_active = $${i}`); params.push(dto.is_active); i++; }

    if (!sets.length) return { id };
    params.push(id);

    const rows = await this.tenantPrisma.executeOnTenant<any[]>(
      user.tenantSchema,
      `UPDATE "${user.tenantSchema}".workflows SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
      params,
    );
    return rows[0];
  }

  @Post(':id/trigger')
  @Roles('admin', 'owner', 'manager', 'member')
  async trigger(@Param('id') id: string, @Body() context: any, @CurrentUser() user: any) {
    const runId = await this.engine.triggerWorkflow(user.tenantId, user.tenantSchema, id, context);
    return { runId, message: 'Workflow déclenché' };
  }

  @Post(':id/toggle')
  @Roles('admin', 'owner')
  async toggle(@Param('id') id: string, @CurrentUser() user: any) {
    const rows = await this.tenantPrisma.executeOnTenant<any[]>(
      user.tenantSchema,
      `UPDATE "${user.tenantSchema}".workflows SET is_active = NOT is_active WHERE id = $1 RETURNING is_active`,
      [id],
    );
    return { id, is_active: rows[0]?.is_active };
  }

  @Delete(':id')
  @Roles('admin', 'owner')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @CurrentUser() user: any) {
    await this.tenantPrisma.executeOnTenant(user.tenantSchema, `DELETE FROM "${user.tenantSchema}".workflows WHERE id = $1`, [id]);
  }

  @Get('runs/:runId')
  async getRunStatus(@Param('runId') runId: string) {
    return this.engine.getRunStatus(runId);
  }

  @Get('templates/list')
  async getTemplates() {
    return WORKFLOW_TEMPLATES;
  }
}

const WORKFLOW_TEMPLATES = [
  {
    id: 'tpl-welcome',
    name: 'Email de bienvenue',
    description: 'Envoie un email automatique quand un prospect est créé',
    trigger_type: 'event',
    trigger_config: { event: 'prospect.created' },
    steps: [
      { id: 'delay-1', type: 'delay', label: 'Attendre 5 minutes', config: { duration: 5, unit: 'minutes' }, nextStepId: 'email-1' },
      { id: 'email-1', type: 'action_email', label: 'Envoyer email', config: { template: 'welcome', subject: 'Bienvenue {{company_name}}' } },
    ],
  },
  {
    id: 'tpl-score-alert',
    name: 'Alerte lead chaud',
    description: 'Notifie le commercial quand un prospect passe HOT',
    trigger_type: 'event',
    trigger_config: { event: 'prospect.scored' },
    steps: [
      { id: 'cond-1', type: 'condition', label: 'Score HOT ?', config: { field: 'propensity_category', operator: 'eq', value: 'HOT' }, branches: [{ condition: 'true', nextStepId: 'notif-1' }] },
      { id: 'notif-1', type: 'action_notify', label: 'Notifier le commercial', config: { title: '🔥 Lead chaud détecté', message: '{{company_name}} vient de passer en HOT' } },
    ],
  },
  {
    id: 'tpl-no-reply',
    name: 'Relance automatique',
    description: 'Relance si pas de réponse après 3 jours',
    trigger_type: 'event',
    trigger_config: { event: 'email.sent' },
    steps: [
      { id: 'delay-1', type: 'delay', label: 'Attendre 3 jours', config: { duration: 3, unit: 'days' }, nextStepId: 'cond-1' },
      { id: 'cond-1', type: 'condition', label: 'A répondu ?', config: { field: 'replied', operator: 'eq', value: false }, branches: [{ condition: 'true', nextStepId: 'email-1' }] },
      { id: 'email-1', type: 'action_email', label: 'Email de relance', config: { subject: 'Suite à mon précédent email' } },
    ],
  },
];
