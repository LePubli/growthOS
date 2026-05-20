import { Module } from '@nestjs/common';
import { AIController } from './ai.controller';
import { AIGatewayService } from './ai-gateway.service';
import { AIAgentsService } from './ai-agents.service';

@Module({
  controllers: [AIController],
  providers: [AIGatewayService, AIAgentsService],
  exports: [AIGatewayService, AIAgentsService],
})
export class AIModule {}
