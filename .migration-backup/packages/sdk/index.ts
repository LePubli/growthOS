/**
 * ============================================================
 * GrowthOS Developer SDK
 * Créez un plugin en 5 minutes
 * ============================================================
 *
 * Installation :
 *   npm install @growthos/sdk
 *
 * Usage :
 *   import { createPlugin, defineAgent, useGateway } from '@growthos/sdk';
 */

// ── Types ─────────────────────────────────────────────────────

export interface GrowthOSContext {
  tenantId: string;
  tenantSchema: string;
  userId: string;
  role: string;
}

export interface PluginDefinition {
  name: string;
  displayName: string;
  version: string;
  description?: string;
  author?: string;
  category?: string;
  icon?: string;
  onInstall?: (ctx: GrowthOSContext) => Promise<void>;
  onUninstall?: (ctx: GrowthOSContext) => Promise<void>;
  onActivate?: (ctx: GrowthOSContext) => Promise<void>;
  onDeactivate?: (ctx: GrowthOSContext) => Promise<void>;
  hooks?: Record<string, (event: any) => Promise<void>>;
}

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  systemPrompt: string;
  preferLocalFirst?: boolean;
}

// ── Plugin Builder ─────────────────────────────────────────────

export function createPlugin(def: PluginDefinition) {
  return {
    ...def,
    manifest: {
      name: def.name,
      displayName: def.displayName,
      version: def.version,
      description: def.description,
      author: def.author || 'Custom',
      category: def.category || 'TOOLS',
      icon: def.icon || '🔌',
    },
  };
}

// ── Event Bus Client ───────────────────────────────────────────

export class EventBusClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  async publish(eventName: string, payload: Record<string, any>): Promise<void> {
    await fetch(`${this.baseUrl}/api/v1/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
      body: JSON.stringify({ name: eventName, payload }),
    });
  }

  subscribe(eventName: string, handler: (payload: any) => void): () => void {
    // WebSocket subscription
    const ws = new WebSocket(`${this.baseUrl.replace('http', 'ws')}/ws`);
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.event === eventName) handler(data.payload);
    };
    return () => ws.close();
  }
}

// ── AI Gateway Client ──────────────────────────────────────────

export class AIGatewayClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  async complete(messages: { role: string; content: string }[], options?: {
    provider?: 'ollama' | 'anthropic' | 'openai' | 'mistral';
    model?: string;
    maxTokens?: number;
    systemPrompt?: string;
  }): Promise<{ content: string; provider: string; model: string; usage: any }> {
    const res = await fetch(`${this.baseUrl}/api/v1/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
      body: JSON.stringify({ messages, ...options }),
    });
    return res.json();
  }

  async runAgent(agentId: string, message: string, context?: Record<string, any>) {
    const res = await fetch(`${this.baseUrl}/api/v1/ai/agents/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
      body: JSON.stringify({ agentId, message, context }),
    });
    return res.json();
  }

  async scoreProspect(prospect: Record<string, any>) {
    const res = await fetch(`${this.baseUrl}/api/v1/ai/score-prospect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
      body: JSON.stringify(prospect),
    });
    return res.json();
  }
}

// ── Database Client (tenant-aware) ────────────────────────────

export class TenantDBClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  private async req<T>(method: string, path: string, body?: any): Promise<T> {
    const res = await fetch(`${this.baseUrl}/api/v1${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
    return res.json();
  }

  // Prospects
  async listProspects(filters?: Record<string, any>) {
    const params = new URLSearchParams(filters as any).toString();
    return this.req('GET', `/prospects${params ? `?${params}` : ''}`);
  }

  async getProspect(id: string) { return this.req('GET', `/prospects/${id}`); }
  async createProspect(data: Record<string, any>) { return this.req('POST', '/prospects', data); }
  async updateProspect(id: string, data: Record<string, any>) { return this.req('PATCH', `/prospects/${id}`, data); }

  // Pipeline
  async getPipeline() { return this.req('GET', '/pipeline'); }
  async moveProspect(prospectId: string, stageId: string) { return this.req('POST', '/pipeline/move', { prospectId, stageId }); }

  // Signals
  async createSignal(prospectId: string, data: { type: string; title: string; severity?: string }) {
    return this.req('POST', '/signals', { prospect_id: prospectId, ...data });
  }
}

// ── Plugin SDK Helper ─────────────────────────────────────────

export function createPluginSDK(baseUrl: string, token: string) {
  return {
    ai: new AIGatewayClient(baseUrl, token),
    events: new EventBusClient(baseUrl, token),
    db: new TenantDBClient(baseUrl, token),
  };
}

// ── Agent Builder ──────────────────────────────────────────────

export function defineAgent(def: AgentDefinition): AgentDefinition {
  return def;
}

// ── Hooks Builder ──────────────────────────────────────────────

export function defineHook(event: string, handler: (payload: any, sdk: ReturnType<typeof createPluginSDK>) => Promise<void>) {
  return { event, handler };
}

// ── Workflow Action ────────────────────────────────────────────

export interface WorkflowAction {
  type: string;
  label: string;
  configSchema: Record<string, { type: string; label: string; required?: boolean; default?: any }>;
  execute: (config: Record<string, any>, context: Record<string, any>, sdk: ReturnType<typeof createPluginSDK>) => Promise<void>;
}

export function defineWorkflowAction(action: WorkflowAction): WorkflowAction {
  return action;
}

// ── Plugin Manifest Generator ──────────────────────────────────

export function generateManifestYaml(def: PluginDefinition): string {
  return `name: "${def.name}"
displayName: "${def.displayName}"
version: "${def.version}"
description: "${def.description || ''}"
author: "${def.author || 'Custom'}"
category: "${def.category || 'TOOLS'}"
icon: "${def.icon || '🔌'}"

dependencies: []
permissions: []

routes: []
migrations: []
hooks: []
menuItems: []
`;
}

// ── Export principal ───────────────────────────────────────────
export default {
  createPlugin,
  createPluginSDK,
  defineAgent,
  defineHook,
  defineWorkflowAction,
  generateManifestYaml,
  EventBusClient,
  AIGatewayClient,
  TenantDBClient,
};
