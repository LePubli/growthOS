import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { 
  HealthCheck, 
  HealthCheckService, 
  PrismaHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
  HealthCheckResult,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators';
import { PrismaService } from '../../shared/database/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Vérification complète de santé du service' })
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prismaIndicator.pingCheck('database', (this.prismaIndicator as any).prisma),
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
      () => this.disk.checkStorage('storage', { path: '/app', thresholdPercent: 0.9 }),
    ]);
  }

  @Get('ready')
  @Public()
  @ApiOperation({ summary: 'Vérification de readiness (démarrage complet)' })
  @HealthCheck()
  async ready(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prismaIndicator.pingCheck('database', (this.prismaIndicator as any).prisma),
    ]);
  }

  @Get('live')
  @Public()
  @ApiOperation({ summary: 'Vérification de liveness (service en cours d\'exécution)' })
  async live(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}

@Module({
  imports: [
    TerminusModule,
    HttpModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: PrismaHealthIndicator,
      useFactory: (prisma: PrismaService) => {
        const indicator = new PrismaHealthIndicator(null as any);
        (indicator as any).prisma = prisma;
        return indicator;
      },
      inject: [PrismaService],
    },
    MemoryHealthIndicator,
    DiskHealthIndicator,
  ],
})
export class HealthModule {}
