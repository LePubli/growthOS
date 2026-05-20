import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

/**
 * Service de connexion Prisma par tenant.
 * Chaque tenant a son propre schema PostgreSQL.
 * On utilise SET search_path pour isoler les données.
 *
 * Architecture : schema-per-tenant
 * - public      : données partagées (tenants, users, plugins...)
 * - tenant_{id} : données du tenant (prospects, contacts, pipelines...)
 */
@Injectable()
export class TenantPrismaService {
  private readonly logger = new Logger(TenantPrismaService.name);
  private readonly clients = new Map<string, PrismaClient>();

  constructor(private readonly config: ConfigService) {}

  /**
   * Retourne un client Prisma configuré pour le schema du tenant.
   * Utilise un pool de clients avec cache.
   */
  async getClient(tenantSchema: string): Promise<PrismaClient> {
    if (this.clients.has(tenantSchema)) {
      return this.clients.get(tenantSchema)!;
    }

    const baseUrl = this.config.get<string>('DATABASE_URL')!;
    // Ajoute le search_path au DSN
    const url = baseUrl.includes('?')
      ? `${baseUrl}&options=-csearch_path%3D${tenantSchema},public`
      : `${baseUrl}?options=-csearch_path%3D${tenantSchema},public`;

    const client = new PrismaClient({
      datasources: { db: { url } },
      log: this.config.get('NODE_ENV') === 'development' ? ['error'] : ['error'],
    });

    await client.$connect();
    this.clients.set(tenantSchema, client);
    this.logger.debug(`Client Prisma créé pour schema: ${tenantSchema}`);

    return client;
  }

  /**
   * Crée le schema PostgreSQL pour un nouveau tenant + tables de base.
   */
  async createTenantSchema(tenantSchema: string): Promise<void> {
    const client = await this.getClient('public');

    await client.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${tenantSchema}"`);

    // Tables de base communes à tous les tenants
    await client.$executeRawUnsafe(`
      SET search_path TO "${tenantSchema}";

      CREATE TABLE IF NOT EXISTS "${tenantSchema}"."prospects" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_name VARCHAR(500) NOT NULL,
        siren VARCHAR(9),
        siret VARCHAR(14),
        naf_code VARCHAR(10),
        naf_label VARCHAR(255),
        legal_form VARCHAR(100),
        address TEXT,
        postal_code VARCHAR(10),
        city VARCHAR(100),
        department VARCHAR(3),
        region VARCHAR(100),
        country VARCHAR(2) DEFAULT 'FR',
        employee_range VARCHAR(50),
        phone VARCHAR(30),
        email VARCHAR(255),
        email_verified BOOLEAN DEFAULT FALSE,
        email_confidence FLOAT DEFAULT 0,
        website VARCHAR(500),
        linkedin_url VARCHAR(500),
        propensity_score FLOAT,
        propensity_category VARCHAR(10),
        sources_used JSONB DEFAULT '[]',
        tags JSONB DEFAULT '[]',
        custom_fields JSONB DEFAULT '{}',
        stage_id UUID,
        pipeline_id UUID,
        assigned_to UUID,
        is_archived BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_prospects_siren ON "${tenantSchema}"."prospects"(siren);
      CREATE INDEX IF NOT EXISTS idx_prospects_email ON "${tenantSchema}"."prospects"(email);
      CREATE INDEX IF NOT EXISTS idx_prospects_stage ON "${tenantSchema}"."prospects"(stage_id);
      CREATE INDEX IF NOT EXISTS idx_prospects_score ON "${tenantSchema}"."prospects"(propensity_score);

      CREATE TABLE IF NOT EXISTS "${tenantSchema}"."pipeline_stages" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pipeline_id UUID,
        name VARCHAR(100) NOT NULL,
        color VARCHAR(20) DEFAULT '#0d6efd',
        order_index INTEGER DEFAULT 0,
        is_won BOOLEAN DEFAULT FALSE,
        is_lost BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "${tenantSchema}"."activities" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        prospect_id UUID REFERENCES "${tenantSchema}"."prospects"(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255),
        description TEXT,
        metadata JSONB DEFAULT '{}',
        done_at TIMESTAMPTZ,
        due_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "${tenantSchema}"."signals" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        prospect_id UUID REFERENCES "${tenantSchema}"."prospects"(id) ON DELETE CASCADE,
        type VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        source VARCHAR(100),
        severity VARCHAR(20) DEFAULT 'medium',
        is_read BOOLEAN DEFAULT FALSE,
        signal_date TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "${tenantSchema}"."email_sequences" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "${tenantSchema}"."workflows" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        trigger_type VARCHAR(100),
        trigger_config JSONB DEFAULT '{}',
        steps JSONB DEFAULT '[]',
        is_active BOOLEAN DEFAULT TRUE,
        run_count INTEGER DEFAULT 0,
        last_run_at TIMESTAMPTZ,
        created_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    this.logger.log(`✓ Schema tenant créé: ${tenantSchema}`);
  }

  /**
   * Exécute une requête raw sur le schema d'un tenant.
   */
  async executeOnTenant<T = any>(
    tenantSchema: string,
    query: string,
    params: any[] = [],
  ): Promise<T> {
    const client = await this.getClient(tenantSchema);
    return client.$queryRawUnsafe<T>(query, ...params);
  }

  /**
   * Nettoie les connexions inactives.
   */
  async cleanup(): Promise<void> {
    for (const [schema, client] of this.clients.entries()) {
      await client.$disconnect();
      this.clients.delete(schema);
    }
  }
}
