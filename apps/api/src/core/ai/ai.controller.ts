import { Controller, Get, Post, Body, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators';
import { AIGatewayService, AIProvider } from './ai-gateway.service';
import { AIAgentsService, AgentId } from './ai-agents.service';

class ChatDto {
  messages: { role: string; content: string }[];
  provider?: AIProvider;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

class AgentRunDto {
  agentId: AgentId;
  message: string;
  context?: Record<string, any>;
}

class ScoreDto {
  company_name: string;
  naf_code?: string; naf_label?: string;
  city?: string; employee_range?: string;
  website?: string; email?: string; phone?: string;
  sources_used?: string[];
}

class EmailDto {
  company_name: string;
  naf_label?: string; city?: string; website?: string;
  template: string;
}

@ApiTags('AI Gateway')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AIController {
  constructor(
    private readonly gateway: AIGatewayService,
    private readonly agents: AIAgentsService,
  ) {}

  @Get('providers')
  @ApiOperation({ summary: 'Liste les providers IA disponibles (Ollama, Claude, OpenAI, Mistral)' })
  async getProviders() {
    const providers = this.gateway.getProviders();
    const ollamaModels = await this.gateway.listOllamaModels().catch(() => []);
    return providers.map(p => ({
      ...p,
      models: p.name === 'ollama' && ollamaModels.length > 0 ? ollamaModels : p.models,
    }));
  }

  @Get('providers/ollama/models')
  async listOllamaModels() {
    const models = await this.gateway.listOllamaModels();
    return { models, count: models.length };
  }

  @Post('providers/ollama/pull')
  async pullOllamaModel(@Body() body: { model: string }) {
    if (!body.model) throw new BadRequestException('model requis');
    await this.gateway.pullOllamaModel(body.model);
    return { message: `Modèle ${body.model} téléchargé` };
  }

  @Post('chat')
  async chat(@Body() dto: ChatDto, @CurrentUser() user: any) {
    if (!dto.messages?.length) throw new BadRequestException('messages requis');
    return this.gateway.complete({
      messages: dto.messages as any,
      model: dto.model, maxTokens: dto.maxTokens,
      temperature: dto.temperature, systemPrompt: dto.systemPrompt,
      tenantId: user.tenantId,
    }, dto.provider);
  }

  @Get('agents')
  getAgents() {
    return this.agents.getAgents().map(({ systemPrompt, ...rest }) => rest);
  }

  @Post('agents/run')
  async runAgent(@Body() dto: AgentRunDto, @CurrentUser() user: any) {
    if (!dto.agentId || !dto.message) throw new BadRequestException('agentId + message requis');
    return this.agents.runAgent(dto.agentId, dto.message, dto.context, user.tenantId);
  }

  @Post('score-prospect')
  async scoreProspect(@Body() dto: ScoreDto, @CurrentUser() user: any) {
    if (!dto.company_name) throw new BadRequestException('company_name requis');
    return this.agents.scoreProspect(dto, user.tenantId);
  }

  @Post('generate-email')
  async generateEmail(@Body() dto: EmailDto, @CurrentUser() user: any) {
    if (!dto.company_name || !dto.template) throw new BadRequestException('company_name + template requis');
    return this.agents.generateProspectingEmail(dto, dto.template, user.tenantId);
  }

  @Post('analyze-seo')
  async analyzeSEO(@Body() body: { domain: string }, @CurrentUser() user: any) {
    if (!body.domain) throw new BadRequestException('domain requis');
    return this.agents.analyzeSEO(body.domain, user.tenantId);
  }
}
