import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';

import { DatabaseModule }    from './shared/database/database.module';
import { AuthModule }        from './core/auth/auth.module';
import { TenantsModule }     from './core/tenants/tenants.module';
import { PluginsModule }     from './core/plugins/plugins.module';
import { ThemesModule }      from './core/themes/themes.module';
import { EventsModule }      from './core/events/events.module';
import { WorkflowsModule }   from './core/workflows/workflows.module';
import { HealthModule }      from './core/health/health.module';
import { DashboardModule }   from './core/dashboard/dashboard.module';
import { AIModule }          from './core/ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.local', '.env'] }),
    ThrottlerModule.forRoot([
      { name: 'short',  ttl: 1000,  limit: 20 },
      { name: 'medium', ttl: 10000, limit: 100 },
      { name: 'long',   ttl: 60000, limit: 1000 },
    ]),
    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.', maxListeners: 30, ignoreErrors: false }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        redis: { host: c.get('REDIS_HOST','localhost'), port: c.get<number>('REDIS_PORT',6379), password: c.get('REDIS_PASSWORD') },
        defaultJobOptions: { removeOnComplete: 100, removeOnFail: 500, attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
      }),
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (c: ConfigService) => ({
        store: redisStore,
        socket: { host: c.get('REDIS_HOST','localhost'), port: c.get<number>('REDIS_PORT',6379), password: c.get('REDIS_PASSWORD') },
        ttl: 300_000,
      }),
    }),
    DatabaseModule,
    AuthModule,
    TenantsModule,
    PluginsModule,
    ThemesModule,
    EventsModule,
    WorkflowsModule,
    HealthModule,
    DashboardModule,
    AIModule,
  ],
})
export class AppModule {}
