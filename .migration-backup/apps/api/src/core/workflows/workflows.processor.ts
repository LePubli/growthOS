import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { WorkflowEngineService } from './workflow-engine.service';

@Processor('workflows')
export class WorkflowsProcessor {
  private readonly logger = new Logger(WorkflowsProcessor.name);

  constructor(private readonly engine: WorkflowEngineService) {}

  @Process('execute')
  async execute(job: Job) {
    const { runId, tenantId, tenantSchema, workflowId, context } = job.data;
    await this.engine.executeWorkflow(runId, tenantId, tenantSchema, workflowId, context);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(`[WorkflowProcessor] Job ${job.id} failed: ${error.message}`);
  }
}
