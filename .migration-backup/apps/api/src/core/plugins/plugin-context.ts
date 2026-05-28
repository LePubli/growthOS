import { Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * PluginContext — API disponible pour chaque plugin.
 * Injecté comme premier argument dans toutes les méthodes du plugin.
 * Principe identique à l'API WordPress ($wpdb, hooks, etc.)
 */
export interface IPluginContext {
  tenantId: string;
  pluginName: string;

  // Base de données (Prisma scopé au tenant)
  db: {
    prospects: {
      findMany: (args?: any) => Promise<any[]>;
      findFirst: (args?: any) => Promise<any>;
      create: (args: any) => Promise<any>;
      update: (args: any) => Promise<any>;
      count: (args?: any) => Promise<number>;
    };
    deals: {
      findMany: (args?: any) => Promise<any[]>;
      create: (args: any) => Promise<any>;
      update: (args: any) => Promise<any>;
    };
    raw: (sql: string, ...args: any[]) => Promise<any>;
  };

  // Événements
  events: {
    emit: (event: string, payload: any) => void;
    on: (event: string, handler: (payload: any) => void) => void;
  };

  // HTTP client pour appels externes
  http: {
    get: (url: string, options?: RequestInit) => Promise<any>;
    post: (url: string, body: any, options?: RequestInit) => Promise<any>;
  };

  // Config du plugin (stockée en DB)
  config: {
    get: (key: string, defaultValue?: any) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
    getAll: () => Promise<Record<string, any>>;
  };

  // Logger
  log: (message: string, level?: 'log' | 'warn' | 'error') => void;

  // Enregistrer des routes API dynamiques
  router: {
    get: (path: string, handler: (req: any) => Promise<any>) => void;
    post: (path: string, handler: (req: any) => Promise<any>) => void;
  };
}

export class PluginContext implements IPluginContext {
  readonly tenantId: string;
  readonly pluginName: string;
  private readonly logger: Logger;
  private readonly dynamicRoutes: Map<string, { method: string; handler: Function }>;

  constructor(
    tenantId: string,
    pluginName: string,
    private readonly prisma: PrismaService,
    private readonly emitter: EventEmitter2,
    private readonly pluginConfig: Record<string, any> = {},
    routes: Map<string, { method: string; handler: Function }> = new Map(),
  ) {
    this.tenantId = tenantId;
    this.pluginName = pluginName;
    this.logger = new Logger(`Plugin:${pluginName}`);
    this.dynamicRoutes = routes;
  }

  // ── Base de données ────────────────────────────────────────────────────
  db = {
    prospects: {
      findMany: (args: any = {}) => this.prisma.prospect.findMany({
        ...args,
        where: { ...args.where, tenantId: this.tenantId },
      }),
      findFirst: (args: any = {}) => this.prisma.prospect.findFirst({
        ...args,
        where: { ...args.where, tenantId: this.tenantId },
      }),
      create: (args: any) => this.prisma.prospect.create({
        ...args,
        data: { ...args.data, tenantId: this.tenantId },
      }),
      update: (args: any) => this.prisma.prospect.update(args),
      count: (args: any = {}) => this.prisma.prospect.count({
        ...args,
        where: { ...args.where, tenantId: this.tenantId },
      }),
    },
    deals: {
      findMany: (args: any = {}) => this.prisma.deal.findMany({
        ...args,
        where: { ...args.where, tenantId: this.tenantId },
      }),
      create: (args: any) => this.prisma.deal.create({
        ...args,
        data: { ...args.data, tenantId: this.tenantId },
      }),
      update: (args: any) => this.prisma.deal.update(args),
    },
    raw: (sql: string, ...args: any[]) => this.prisma.$queryRawUnsafe(sql, ...args),
  };

  // ── Événements ─────────────────────────────────────────────────────────
  events = {
    emit: (event: string, payload: any) => {
      this.emitter.emit(`plugin.${this.pluginName}.${event}`, payload);
    },
    on: (event: string, handler: (payload: any) => void) => {
      this.emitter.on(event, handler);
    },
  };

  // ── HTTP ───────────────────────────────────────────────────────────────
  http = {
    get: async (url: string, options: RequestInit = {}) => {
      const res = await fetch(url, { ...options, method: 'GET' });
      return res.json();
    },
    post: async (url: string, body: any, options: RequestInit = {}) => {
      const res = await fetch(url, {
        ...options,
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      });
      return res.json();
    },
  };

  // ── Config ─────────────────────────────────────────────────────────────
  config = {
    get: async (key: string, defaultValue?: any) => {
      return this.pluginConfig[key] ?? defaultValue;
    },
    set: async (key: string, value: any) => {
      this.pluginConfig[key] = value;
    },
    getAll: async () => ({ ...this.pluginConfig }),
  };

  // ── Logger ─────────────────────────────────────────────────────────────
  log = (message: string, level: 'log' | 'warn' | 'error' = 'log') => {
    this.logger[level](`[${this.pluginName}] ${message}`);
  };

  // ── Router dynamique ───────────────────────────────────────────────────
  router = {
    get: (path: string, handler: (req: any) => Promise<any>) => {
      this.dynamicRoutes.set(`GET:${this.pluginName}:${path}`, { method: 'GET', handler });
    },
    post: (path: string, handler: (req: any) => Promise<any>) => {
      this.dynamicRoutes.set(`POST:${this.pluginName}:${path}`, { method: 'POST', handler });
    },
  };
}
