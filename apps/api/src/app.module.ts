import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';

// Core modules
import { DatabaseModule }    from './shared/database/database.module';
import { RedisModule }       from './shared/redis/redis.module';
import { AuthModule }        from './core/auth/auth.module';
import { TenantsModule }     from './core/tenants/tenants.module';
import { UsersModule }       from './core/users/users.module';
import { PluginsModule }     from './core/plugins/plugins.module';
import { ThemesModule }      from './core/themes/themes.module';
import { EventsModule }      from './core/events/events.module';
import { WorkflowsModule }   from './core/workflows/workflows.module';
import { PermissionsModule } from './core/permissions/permissions.module';
import { MarketplaceModule } from './core/marketplace/marketplace.module';
import { SettingsModule }    from './core/settings/settings.module';
import { NotificationsModule } from './core/notifications/notifications.module';
import { AuditModule }       from './core/audit/audit.module';
import { HealthModule }      from './core/health/health.module';

@Module({
  imports: [
    // ── Config ──────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // ── Rate limiting ────────────────────────────────────
    ThrottlerModule.forRoot([
      { name: 'short',  ttl: 1000,  limit: 20  },
      { name: 'medium', ttl: 10000, limit: 100 },
      { name: 'long',   ttl: 60000, limit: 1000 },
    ]),

    // ── Event Emitter (Event Bus interne) ────────────────
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
      ignoreErrors: false,
    }),

    // ── BullMQ (Job Queue) ───────────────────────────────
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get('REDIS_PASSWORD'),
        },
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 500,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        },
      }),
    }),

    // ── Cache Redis ──────────────────────────────────────
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        store: redisStore,
        socket: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get('REDIS_PASSWORD'),
        },
        ttl: 300_000,
      }),
    }),

    // ── Shared ───────────────────────────────────────────
    DatabaseModule,
    RedisModule,

    // ── Core modules ─────────────────────────────────────
    AuthModule,
    TenantsModule,
    UsersModule,
    PluginsModule,
    ThemesModule,
    EventsModule,
    WorkflowsModule,
    PermissionsModule,
    MarketplaceModule,
    SettingsModule,
    NotificationsModule,
    AuditModule,
    HealthModule,
  ],
})
export class AppModule {}
