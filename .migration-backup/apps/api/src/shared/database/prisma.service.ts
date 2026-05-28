import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly config: ConfigService) {
    super({
      datasources: { db: { url: config.get<string>('DATABASE_URL') } },
      log: config.get('NODE_ENV') === 'development'
        ? ['query', 'warn', 'error']
        : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('✓ PostgreSQL connecté (schema public)');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
