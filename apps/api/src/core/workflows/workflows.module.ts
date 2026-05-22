import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { WorkflowsController } from './workflows.controller';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowsProcessor } from './workflows.processor';

@Module({
  imports: [BullModule.registerQueue({ name: 'workflows' })],
  controllers: [WorkflowsController],
  providers: [WorkflowEngineService, WorkflowsProcessor],
  exports: [WorkflowEngineService],
})
export class WorkflowsModule {}
