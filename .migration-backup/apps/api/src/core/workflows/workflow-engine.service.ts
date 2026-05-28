import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../shared/database/prisma.service';
import { TenantPrismaService } from '../../shared/database/tenant-prisma.service';

export type TriggerType =
  | 'event'           // événement système (lead.created, email.opened...)
  | 'schedule'        // cron (tous les jours à 9h)
  | 'webhook'         // appel HTTP entrant
  | 'manual';         // déclenché manuellement

export type StepType =
  | 'condition'       // if/else
  | 'action_email'    // envoyer un email
  | 'action_notify'   // notification interne
  | 'action_webhook'  // appel HTTP sortant
  | 'action_ai'       // appel IA
  | 'action_stage'    // changer l'étape pipeline
  | 'action_assign'   // assigner à un utilisateur
  | 'action_tag'      // ajouter un tag
  | 'action_score'    // recalculer le score
  | 'delay'           // attendre X temps
  | 'loop'            // boucle sur une liste
  | 'branch';         // branchement multiple

export interface WorkflowStep {
  id: string;
  type: StepType;
  label: string;
  config: Record<string, any>;
  nextStepId?: string;
  branches?: { condition: string; nextStepId: string }[];
}

export interface WorkflowDefinition {
  trigger: {
    type: TriggerType;
    config: Record<string, any>;
  };
  steps: WorkflowStep[];
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  tenantId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  context: Record<string, any>;
  currentStepId?: string;
  logs: Array<{ step: string; status: string; message: string; ts: string }>;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

@Injectable()
export class WorkflowEngineService {
  private readonly logger = new Logger(WorkflowEngineService.name);
  // Runs actifs en mémoire (pour les workflows courts)
  private readonly activeRuns = new Map<string, WorkflowRun>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly events: EventEmitter2,
    @InjectQueue('workflows') private readonly workflowQueue: Queue,
  ) {
    // Écoute tous les événements pour déclencher les workflows liés
    this.events.onAny((eventName: string, payload: any) => {
      if (payload?.tenantId && eventName !== 'workflow.triggered') {
        this.checkAndTrigger(payload.tenantId, eventName, payload).catch(() => {});
      }
    });
  }

  /**
   * Vérifie si des workflows sont configurés pour cet événement et les déclenche.
   */
  async checkAndTrigger(tenantId: string, eventName: string, payload: Record<string, any>): Promise<void> {
    try {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) return;

      // Cherche les workflows actifs avec ce trigger dans le schema du tenant
      const workflows = await this.tenantPrisma.executeOnTenant<any[]>(
        tenant.schemaName,
        `SELECT * FROM "${tenant.schemaName}".workflows
         WHERE is_active = TRUE
         AND trigger_type = 'event'
         AND trigger_config->>'event' = $1`,
        [eventName],
      );

      for (const wf of workflows) {
        await this.triggerWorkflow(tenantId, tenant.schemaName, wf.id, payload);
      }
    } catch (e) {
      this.logger.debug(`[Workflow] checkAndTrigger error: ${e.message}`);
    }
  }

  /**
   * Déclenche un workflow.
   */
  async triggerWorkflow(
    tenantId: string,
    tenantSchema: string,
    workflowId: string,
    context: Record<string, any> = {},
  ): Promise<string> {
    const runId = crypto.randomUUID();

    // Queue pour traitement async
    await this.workflowQueue.add('execute', {
      runId, tenantId, tenantSchema, workflowId, context,
    }, {
      attempts: 2,
      backoff: { type: 'fixed', delay: 5000 },
    });

    this.logger.log(`[Workflow] Triggered: ${workflowId} → run ${runId}`);

    this.events.emit('workflow.triggered', { tenantId, workflowId, runId, context });
    return runId;
  }

  /**
   * Exécute un workflow complet (appelé par le processor BullMQ).
   */
  async executeWorkflow(
    runId: string,
    tenantId: string,
    tenantSchema: string,
    workflowId: string,
    context: Record<string, any>,
  ): Promise<void> {
    const run: WorkflowRun = {
      id: runId, workflowId, tenantId,
      status: 'running', context,
      logs: [], startedAt: new Date(),
    };

    this.activeRuns.set(runId, run);

    try {
      // Charge la définition du workflow
      const workflows = await this.tenantPrisma.executeOnTenant<any[]>(
        tenantSchema,
        `SELECT * FROM "${tenantSchema}".workflows WHERE id = $1`,
        [workflowId],
      );

      if (!workflows.length) throw new Error(`Workflow ${workflowId} introuvable`);
      const wf = workflows[0];

      await this.tenantPrisma.executeOnTenant(
        tenantSchema,
        `UPDATE "${tenantSchema}".workflows SET run_count = run_count + 1, last_run_at = NOW() WHERE id = $1`,
        [workflowId],
      );

      const definition: WorkflowDefinition = {
        trigger: wf.trigger_config,
        steps: wf.steps,
      };

      // Exécuter les steps en séquence
      await this.executeSteps(run, definition.steps, tenantId, tenantSchema);

      run.status = 'completed';
      run.completedAt = new Date();
      this.log(run, 'workflow', 'completed', `Workflow terminé en ${Date.now() - run.startedAt.getTime()}ms`);

    } catch (error) {
      run.status = 'failed';
      run.error = error.message;
      run.completedAt = new Date();
      this.log(run, 'workflow', 'failed', error.message);
      this.logger.error(`[Workflow] Run ${runId} failed: ${error.message}`);
    }

    this.events.emit(
      run.status === 'completed' ? 'workflow.completed' : 'workflow.failed',
      { tenantId, workflowId, runId, status: run.status },
    );
  }

  private async executeSteps(
    run: WorkflowRun,
    steps: WorkflowStep[],
    tenantId: string,
    tenantSchema: string,
  ): Promise<void> {
    const stepMap = new Map(steps.map(s => [s.id, s]));
    const firstStep = steps[0];
    if (!firstStep) return;

    let currentStep: WorkflowStep | undefined = firstStep;

    while (currentStep) {
      run.currentStepId = currentStep.id;
      this.log(run, currentStep.id, 'running', `Exécution: ${currentStep.label}`);

      let nextStepId: string | undefined;

      try {
        nextStepId = await this.executeStep(run, currentStep, tenantId, tenantSchema);
        this.log(run, currentStep.id, 'completed', `✓ ${currentStep.label}`);
      } catch (e) {
        this.log(run, currentStep.id, 'failed', `✗ ${e.message}`);
        throw e;
      }

      currentStep = nextStepId ? stepMap.get(nextStepId) : undefined;
    }
  }

  private async executeStep(
    run: WorkflowRun,
    step: WorkflowStep,
    tenantId: string,
    tenantSchema: string,
  ): Promise<string | undefined> {
    const { type, config, nextStepId } = step;

    switch (type) {

      case 'condition': {
        const { field, operator, value } = config;
        const actual = run.context[field];
        const result = this.evaluateCondition(actual, operator, value);
        const branches = step.branches || [];
        const branch = branches.find(b => b.condition === (result ? 'true' : 'false'));
        return branch?.nextStepId || nextStepId;
      }

      case 'action_email': {
        this.log(run, step.id, 'info', `Email → ${config.to}`);
        // TODO: intégrer SMTP service
        break;
      }

      case 'action_notify': {
        await this.prisma.notification.create({
          data: {
            tenantId,
            userId: config.userId || run.context.userId || '',
            type: config.type || 'info',
            title: this.interpolate(config.title, run.context),
            message: this.interpolate(config.message, run.context),
            link: config.link,
          },
        });
        break;
      }

      case 'action_webhook': {
        const { url, method = 'POST', headers = {} } = config;
        const { default: axios } = await import('axios');
        await axios.request({
          url, method, headers,
          data: { ...run.context, _event: run.workflowId },
          timeout: 10_000,
        });
        break;
      }

      case 'action_ai': {
        this.log(run, step.id, 'info', 'Appel IA en cours...');
        // TODO: intégrer AI Gateway
        break;
      }

      case 'action_stage': {
        const { stageId } = config;
        const prospectId = run.context.prospectId || run.context.id;
        if (prospectId && stageId) {
          await this.tenantPrisma.executeOnTenant(
            tenantSchema,
            `UPDATE "${tenantSchema}".prospects SET stage_id = $1, updated_at = NOW() WHERE id = $2`,
            [stageId, prospectId],
          );
        }
        break;
      }

      case 'action_tag': {
        const { tags } = config;
        const prospectId = run.context.prospectId || run.context.id;
        if (prospectId && tags?.length) {
          await this.tenantPrisma.executeOnTenant(
            tenantSchema,
            `UPDATE "${tenantSchema}".prospects SET tags = tags || $1::jsonb WHERE id = $2`,
            [JSON.stringify(tags), prospectId],
          );
        }
        break;
      }

      case 'delay': {
        const { duration, unit } = config;
        const ms = this.toMs(duration, unit);
        if (ms <= 60_000) await new Promise(r => setTimeout(r, ms));
        // Pour les délais longs → schedule via BullMQ avec delay
        break;
      }
    }

    return nextStepId;
  }

  private evaluateCondition(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'eq':  return actual == expected;
      case 'neq': return actual != expected;
      case 'gt':  return Number(actual) > Number(expected);
      case 'lt':  return Number(actual) < Number(expected);
      case 'gte': return Number(actual) >= Number(expected);
      case 'lte': return Number(actual) <= Number(expected);
      case 'contains': return String(actual).includes(String(expected));
      case 'exists': return actual !== null && actual !== undefined;
      case 'empty': return !actual;
      default: return false;
    }
  }

  private interpolate(template: string, context: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(context[key] || ''));
  }

  private toMs(duration: number, unit: string): number {
    const units: Record<string, number> = {
      seconds: 1_000, minutes: 60_000, hours: 3_600_000, days: 86_400_000,
    };
    return duration * (units[unit] || 1_000);
  }

  private log(run: WorkflowRun, step: string, status: string, message: string) {
    run.logs.push({ step, status, message, ts: new Date().toISOString() });
  }

  async getRunStatus(runId: string): Promise<WorkflowRun | null> {
    return this.activeRuns.get(runId) || null;
  }
}
