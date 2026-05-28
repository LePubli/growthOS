import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/database/prisma.service';
import axios from 'axios';

// ── Types ────────────────────────────────────────────────────

export type AIProvider = 'anthropic' | 'openai' | 'mistral' | 'ollama';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIRequest {
  messages: AIMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  systemPrompt?: string;
  tenantId?: string;
  agentId?: string;
  metadata?: Record<string, any>;
}

export interface AIResponse {
  content: string;
  provider: AIProvider;
  model: string;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
  latencyMs: number;
  cached?: boolean;
}

export interface ProviderConfig {
  name: AIProvider;
  label: string;
  available: boolean;
  models: string[];
  defaultModel: string;
  maxTokens: number;
  isLocal: boolean;
  baseUrl?: string;
  costPer1kInput?: number;   // € pour tracking
  costPer1kOutput?: number;
}

// ── AI Gateway Service ────────────────────────────────────────

@Injectable()
export class AIGatewayService {
  private readonly logger = new Logger(AIGatewayService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Retourne la liste des providers disponibles et configurés.
   */
  getProviders(): ProviderConfig[] {
    return [
      {
        name: 'ollama',
        label: 'Ollama (Local)',
        available: !!this.config.get('OLLAMA_HOST'),
        models: ['llama3.2', 'llama3.1', 'mistral', 'mistral-nemo', 'qwen2.5', 'deepseek-r1', 'phi4', 'gemma2', 'codellama'],
        defaultModel: this.config.get('OLLAMA_DEFAULT_MODEL', 'llama3.2'),
        maxTokens: 8192,
        isLocal: true,
        baseUrl: this.config.get('OLLAMA_HOST', 'http://localhost:11434'),
        costPer1kInput: 0,
        costPer1kOutput: 0,
      },
      {
        name: 'anthropic',
        label: 'Anthropic Claude',
        available: !!this.config.get('ANTHROPIC_API_KEY'),
        models: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5'],
        defaultModel: 'claude-sonnet-4-5',
        maxTokens: 8192,
        isLocal: false,
        costPer1kInput: 0.003,
        costPer1kOutput: 0.015,
      },
      {
        name: 'openai',
        label: 'OpenAI GPT',
        available: !!this.config.get('OPENAI_API_KEY'),
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
        defaultModel: 'gpt-4o-mini',
        maxTokens: 8192,
        isLocal: false,
        costPer1kInput: 0.00015,
        costPer1kOutput: 0.0006,
      },
      {
        name: 'mistral',
        label: 'Mistral AI',
        available: !!this.config.get('MISTRAL_API_KEY'),
        models: ['mistral-large-latest', 'mistral-small-latest', 'open-mixtral-8x22b'],
        defaultModel: 'mistral-small-latest',
        maxTokens: 8192,
        isLocal: false,
        costPer1kInput: 0.0002,
        costPer1kOutput: 0.0006,
      },
    ];
  }

  /**
   * Point d'entrée principal — sélectionne le provider et fait l'appel.
   * Ordre de priorité : local Ollama → Anthropic → OpenAI → Mistral
   */
  async complete(req: AIRequest, preferredProvider?: AIProvider): Promise<AIResponse> {
    const start = Date.now();
    const providers = this.getProviders();

    // Priorité : Ollama d'abord si dispo (gratuit + local)
    const order: AIProvider[] = preferredProvider
      ? [preferredProvider, 'ollama', 'anthropic', 'openai', 'mistral']
      : ['ollama', 'anthropic', 'openai', 'mistral'];

    const available = order.filter(p => providers.find(c => c.name === p && c.available));

    if (!available.length) {
      throw new BadRequestException('Aucun provider IA disponible. Configurez OLLAMA_HOST ou une API key.');
    }

    let lastError: Error | null = null;

    for (const providerName of available) {
      try {
        const providerConfig = providers.find(p => p.name === providerName)!;
        const model = req.model || providerConfig.defaultModel;

        this.logger.debug(`[AI] Essai provider: ${providerName} / ${model}`);

        let response: AIResponse;

        switch (providerName) {
          case 'ollama':    response = await this.callOllama(req, model, providerConfig); break;
          case 'anthropic': response = await this.callAnthropic(req, model); break;
          case 'openai':    response = await this.callOpenAI(req, model); break;
          case 'mistral':   response = await this.callMistral(req, model); break;
          default: continue;
        }

        response.latencyMs = Date.now() - start;

        // Track usage
        await this.trackUsage(req.tenantId, providerName, model, response, req.agentId).catch(() => {});

        this.logger.log(`[AI] ${providerName}/${model} → ${response.usage.totalTokens} tokens en ${response.latencyMs}ms`);
        return response;

      } catch (err: any) {
        this.logger.warn(`[AI] ${providerName} failed: ${err.message} — fallback...`);
        lastError = err;
        continue;
      }
    }

    throw lastError || new Error('Tous les providers IA ont échoué');
  }

  // ── Ollama (LOCAL) ────────────────────────────────────────────

  async callOllama(req: AIRequest, model: string, config: ProviderConfig): Promise<AIResponse> {
    const baseUrl = config.baseUrl || 'http://localhost:11434';

    const messages: any[] = [];
    if (req.systemPrompt) {
      messages.push({ role: 'system', content: req.systemPrompt });
    }
    messages.push(...req.messages);

    const response = await axios.post(`${baseUrl}/api/chat`, {
      model,
      messages,
      stream: false,
      options: {
        temperature: req.temperature ?? 0.7,
        num_predict: req.maxTokens || 2048,
      },
    }, { timeout: 120_000 });

    const data = response.data;
    const content = data.message?.content || '';

    // Ollama retourne des stats d'usage
    const inputTokens = data.prompt_eval_count || Math.round(this.estimateTokens(messages.map(m => m.content).join(' ')));
    const outputTokens = data.eval_count || Math.round(this.estimateTokens(content));

    return {
      content,
      provider: 'ollama',
      model,
      usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
      latencyMs: 0,
    };
  }

  async listOllamaModels(): Promise<string[]> {
    try {
      const baseUrl = this.config.get('OLLAMA_HOST', 'http://localhost:11434');
      const response = await axios.get(`${baseUrl}/api/tags`, { timeout: 5_000 });
      return (response.data?.models || []).map((m: any) => m.name);
    } catch {
      return [];
    }
  }

  async pullOllamaModel(model: string): Promise<void> {
    const baseUrl = this.config.get('OLLAMA_HOST', 'http://localhost:11434');
    await axios.post(`${baseUrl}/api/pull`, { name: model, stream: false }, { timeout: 300_000 });
    this.logger.log(`[Ollama] Modèle "${model}" téléchargé`);
  }

  // ── Anthropic Claude ──────────────────────────────────────────

  async callAnthropic(req: AIRequest, model: string): Promise<AIResponse> {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');

    const messages = req.messages.filter(m => m.role !== 'system');
    const systemMsg = req.systemPrompt || req.messages.find(m => m.role === 'system')?.content;

    const body: any = { model, messages, max_tokens: req.maxTokens || 2048 };
    if (systemMsg) body.system = systemMsg;

    const response = await axios.post('https://api.anthropic.com/v1/messages', body, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      timeout: 60_000,
    });

    const data = response.data;
    const content = data.content?.[0]?.text || '';
    const usage = { inputTokens: data.usage?.input_tokens || 0, outputTokens: data.usage?.output_tokens || 0, totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0) };

    return { content, provider: 'anthropic', model, usage, latencyMs: 0 };
  }

  // ── OpenAI ────────────────────────────────────────────────────

  async callOpenAI(req: AIRequest, model: string): Promise<AIResponse> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');

    const messages: any[] = [];
    if (req.systemPrompt) messages.push({ role: 'system', content: req.systemPrompt });
    messages.push(...req.messages);

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model, messages, max_tokens: req.maxTokens || 2048, temperature: req.temperature ?? 0.7,
    }, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 60_000,
    });

    const data = response.data;
    const content = data.choices?.[0]?.message?.content || '';
    const usage = { inputTokens: data.usage?.prompt_tokens || 0, outputTokens: data.usage?.completion_tokens || 0, totalTokens: data.usage?.total_tokens || 0 };

    return { content, provider: 'openai', model, usage, latencyMs: 0 };
  }

  // ── Mistral ───────────────────────────────────────────────────

  async callMistral(req: AIRequest, model: string): Promise<AIResponse> {
    const apiKey = this.config.get<string>('MISTRAL_API_KEY');

    const messages: any[] = [];
    if (req.systemPrompt) messages.push({ role: 'system', content: req.systemPrompt });
    messages.push(...req.messages);

    const response = await axios.post('https://api.mistral.ai/v1/chat/completions', {
      model, messages, max_tokens: req.maxTokens || 2048, temperature: req.temperature ?? 0.7,
    }, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 60_000,
    });

    const data = response.data;
    const content = data.choices?.[0]?.message?.content || '';
    const usage = { inputTokens: data.usage?.prompt_tokens || 0, outputTokens: data.usage?.completion_tokens || 0, totalTokens: data.usage?.total_tokens || 0 };

    return { content, provider: 'mistral', model, usage, latencyMs: 0 };
  }

  // ── Helpers ───────────────────────────────────────────────────

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private async trackUsage(
    tenantId: string | undefined,
    provider: string,
    model: string,
    response: AIResponse,
    agentId?: string,
  ): Promise<void> {
    if (!tenantId) return;

    await this.prisma.systemEvent.create({
      data: {
        tenantId,
        name: 'ai.usage',
        payload: {
          provider, model, agentId,
          inputTokens: response.usage.inputTokens,
          outputTokens: response.usage.outputTokens,
          totalTokens: response.usage.totalTokens,
          latencyMs: response.latencyMs,
        },
        source: 'ai-gateway',
        processed: true,
      },
    });
  }
}
